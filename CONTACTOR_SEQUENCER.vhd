library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use work.POG2_MHD_TYPES.all;

--============================================================================
-- CONTACTOR_SEQUENCER
-- 10-channel contactor control with arc suppression and pre-charge sequencing
-- 5 segments x 2 poles (LE + TE) per segment
-- 5,000 V DC / 1,880 A rated, 80 ms sequencing budget per tick
-- Implements the constraint matrix from HexagramSM with checkerboard shedding
--============================================================================

entity CONTACTOR_SEQUENCER is
    port (
        clk             : in  std_logic;
        reset_n         : in  std_logic;
        tick_strobe     : in  std_logic;
        electrical_cmd  : in  ELECTRICAL_REG_T;
        hexagram_state  : in  HEXAGRAM_T;
        safety_ok       : in  std_logic;
        contactor_cmd   : out std_logic_vector(N_CONTACTORS-1 downto 0);
        contactor_pre   : out std_logic_vector(N_CONTACTORS-1 downto 0);
        contactor_fb    : in  std_logic_vector(N_CONTACTORS-1 downto 0);
        sequence_done   : out std_logic;
        arc_fault       : out std_logic
    );
end entity CONTACTOR_SEQUENCER;

architecture rtl of CONTACTOR_SEQUENCER is

    -- -----------------------------------------------------------------------
    -- Per-Contactor State Machine
    -- 6 states: OPEN, PRECHARGE, CLOSING, CLOSED, OPENING, ARC_SUPPRESS
    -- -----------------------------------------------------------------------
    type CONTACTOR_STATE_T is (
        ST_OPEN,
        ST_PRECHARGE,
        ST_CLOSING,
        ST_CLOSED,
        ST_OPENING,
        ST_ARC_SUPPRESS
    );

    type CONTACTOR_STATE_ARRAY is array (0 to N_CONTACTORS-1) of CONTACTOR_STATE_T;
    type CONTACTOR_TIMER_ARRAY is array (0 to N_CONTACTORS-1) of unsigned(23 downto 0);

    -- -----------------------------------------------------------------------
    -- Timing Constants (at 250 MHz = 4 ns/cycle)
    -- -----------------------------------------------------------------------
    constant T_PRECHARGE_US   : integer := 5000;   -- 5 ms pre-charge
    constant T_PRECHARGE_CYCLES : integer := T_PRECHARGE_US * 250; -- 1,250,000 cycles
    constant T_CLOSE_MS       : integer := 15;     -- 15 ms mechanical close
    constant T_CLOSE_CYCLES   : integer := T_CLOSE_MS * 250_000; -- 3,750,000 cycles
    constant T_OPEN_MS        : integer := 10;     -- 10 ms mechanical open
    constant T_OPEN_CYCLES    : integer := T_OPEN_MS * 250_000; -- 2,500,000 cycles
    constant T_ARC_SUP_MS     : integer := 5;      -- 5 ms arc quench
    constant T_ARC_SUP_CYCLES : integer := T_ARC_SUP_MS * 250_000; -- 1,250,000 cycles
    constant T_FB_DEBOUNCE_US : integer := 100;    -- 100 us feedback debounce
    constant T_FB_DEBOUNCE_CYCLES : integer := T_FB_DEBOUNCE_US * 250; -- 25,000 cycles

    -- -----------------------------------------------------------------------
    -- Internal Registers
    -- -----------------------------------------------------------------------
    signal contactor_state  : CONTACTOR_STATE_ARRAY := (others => ST_OPEN);
    signal contactor_timer  : CONTACTOR_TIMER_ARRAY := (others => (others => '0'));
    signal cmd_reg          : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');
    signal pre_reg          : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');
    signal fb_sync          : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');
    signal fb_prev          : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');
    signal fb_stable        : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');
    signal arc_fault_reg    : std_logic := '0';
    signal sequence_done_reg: std_logic := '0';

    -- -----------------------------------------------------------------------
    -- Target Command Computation
    -- -----------------------------------------------------------------------
    signal target_cmd       : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');
    signal target_pre       : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');

    -- -----------------------------------------------------------------------
    -- Checkerboard Pattern for LIMP_MODE
    -- -----------------------------------------------------------------------
    constant CHECKERBOARD_PATTERN : std_logic_vector(N_CONTACTORS-1 downto 0) := "1100110011";
    -- Segments: 0=ON(1,1), 1=OFF(0,0), 2=ON(1,1), 3=OFF(0,0), 4=ON(1,1)
    -- Poles: LE (odd indices), TE (even indices) — actually 0,1 = seg0 LE+TE

    -- -----------------------------------------------------------------------
    -- Helper Functions
    -- -----------------------------------------------------------------------

    -- Compute target contactor states from electrical_cmd and hexagram_state
    pure function compute_target_cmd(
        elec : ELECTRICAL_REG_T;
        hex  : HEXAGRAM_T
    ) return std_logic_vector is
        variable result : std_logic_vector(N_CONTACTORS-1 downto 0);
    begin
        case elec is
            when ELEC_OFF =>
                result := (others => '0'); -- All open
            when ELEC_ARMED =>
                -- Armed: contactors closed but no current (gates off)
                result := (others => '1');
            when ELEC_ACTIVE =>
                -- Active: all contactors closed
                result := (others => '1');
            when ELEC_SHED =>
                -- Shed: checkerboard pattern for LIMP_MODE
                if hex = HEX_LIMP_MODE then
                    result := CHECKERBOARD_PATTERN;
                else
                    result := (others => '0');
                end if;
            when others =>
                result := (others => '0');
        end case;
        return result;
    end function compute_target_cmd;

    -- Compute pre-charge target (only for transitions to CLOSED)
    pure function compute_target_pre(
        elec : ELECTRICAL_REG_T;
        hex  : HEXAGRAM_T
    ) return std_logic_vector is
        variable result : std_logic_vector(N_CONTACTORS-1 downto 0);
    begin
        -- Pre-charge active during transitions from OPEN/ARC_SUPPRESS to CLOSED
        -- Only when electrical is ARMED or ACTIVE
        if elec = ELEC_ARMED or elec = ELEC_ACTIVE then
            result := (others => '1');
        else
            result := (others => '0');
        end if;
        return result;
    end function compute_target_pre;

    -- Check if a contactor state transition is safe (no arc risk)
    pure function is_safe_transition(
        current : CONTACTOR_STATE_T;
        target  : std_logic
    ) return std_logic is
    begin
        if target = '1' then
            -- Closing: safe from OPEN, PRECHARGE, or ARC_SUPPRESS
            return '1' when (current = ST_OPEN or current = ST_PRECHARGE or current = ST_ARC_SUPPRESS) else '0';
        else
            -- Opening: safe from CLOSED only (not from CLOSING)
            return '1' when (current = ST_CLOSED or current = ST_OPEN or current = ST_ARC_SUPPRESS) else '0';
        end if;
    end function is_safe_transition;

begin

    -- =====================================================================
    -- Target Command Computation (Combinatorial)
    -- =====================================================================
    target_cmd <= compute_target_cmd(electrical_cmd, hexagram_state);
    target_pre <= compute_target_pre(electrical_cmd, hexagram_state);

    -- =====================================================================
    -- Feedback Synchronizer & Debounce
    -- =====================================================================
    process(clk)
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                fb_sync <= (others => '0');
                fb_prev <= (others => '0');
                fb_stable <= (others => '0');
            else
                fb_sync <= contactor_fb;
                fb_prev <= fb_sync;
                -- Debounce: stable for 2 cycles
                fb_stable <= fb_sync and fb_prev;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- Per-Contactor State Machines (Generate)
    -- =====================================================================
    gen_contactors: for i in 0 to N_CONTACTORS-1 generate
        signal state_reg  : CONTACTOR_STATE_T := ST_OPEN;
        signal timer_reg  : unsigned(23 downto 0) := (others => '0');
        signal cmd_bit    : std_logic := '0';
        signal pre_bit    : std_logic := '0';
    begin

        process(clk)
        begin
            if rising_edge(clk) then
                if reset_n = '0' then
                    state_reg <= ST_OPEN;
                    timer_reg <= (others => '0');
                    cmd_bit <= '0';
                    pre_bit <= '0';
                else
                    -- Default: hold state
                    -- Transitions evaluated on tick_strobe or when timer expires

                    case state_reg is
                        when ST_OPEN =>
                            cmd_bit <= '0';
                            pre_bit <= '0';
                            if target_cmd(i) = '1' then
                                -- Need to close: start pre-charge
                                state_reg <= ST_PRECHARGE;
                                timer_reg <= to_unsigned(T_PRECHARGE_CYCLES, 24);
                            end if;

                        when ST_PRECHARGE =>
                            cmd_bit <= '0';
                            pre_bit <= '1';
                            if timer_reg = 0 then
                                -- Pre-charge complete: close contactor
                                state_reg <= ST_CLOSING;
                                timer_reg <= to_unsigned(T_CLOSE_CYCLES, 24);
                            else
                                timer_reg <= timer_reg - 1;
                            end if;

                        when ST_CLOSING =>
                            cmd_bit <= '1';
                            pre_bit <= '1';
                            if timer_reg = 0 then
                                -- Mechanical close complete, wait for feedback
                                if fb_stable(i) = '1' then
                                    state_reg <= ST_CLOSED;
                                    timer_reg <= (others => '0');
                                else
                                    -- Feedback mismatch: arc fault
                                    state_reg <= ST_ARC_SUPPRESS;
                                    timer_reg <= to_unsigned(T_ARC_SUP_CYCLES, 24);
                                end if;
                            else
                                timer_reg <= timer_reg - 1;
                            end if;

                        when ST_CLOSED =>
                            cmd_bit <= '1';
                            pre_bit <= '0';
                            if target_cmd(i) = '0' then
                                -- Need to open
                                state_reg <= ST_OPENING;
                                timer_reg <= to_unsigned(T_OPEN_CYCLES, 24);
                            end if;

                        when ST_OPENING =>
                            cmd_bit <= '0';
                            pre_bit <= '0';
                            if timer_reg = 0 then
                                -- Mechanical open complete
                                if fb_stable(i) = '0' then
                                    state_reg <= ST_OPEN;
                                    timer_reg <= (others => '0');
                                else
                                    -- Welded contactor!
                                    state_reg <= ST_ARC_SUPPRESS;
                                    timer_reg <= to_unsigned(T_ARC_SUP_CYCLES, 24);
                                end if;
                            else
                                timer_reg <= timer_reg - 1;
                            end if;

                        when ST_ARC_SUPPRESS =>
                            cmd_bit <= '0';
                            pre_bit <= '0';
                            if timer_reg = 0 then
                                -- Arc quenched, return to OPEN
                                state_reg <= ST_OPEN;
                                timer_reg <= (others => '0');
                            else
                                timer_reg <= timer_reg - 1;
                            end if;

                        when others =>
                            state_reg <= ST_OPEN;
                            timer_reg <= (others => '0');
                    end case;
                end if;
            end if;
        end process;

        -- Assign to array elements
        contactor_state(i) <= state_reg;
        contactor_timer(i) <= timer_reg;

    end generate gen_contactors;

    -- =====================================================================
    -- Output Assignment from State Machine Array
    -- =====================================================================
    process(contactor_state)
        variable cmd_vec : std_logic_vector(N_CONTACTORS-1 downto 0);
        variable pre_vec : std_logic_vector(N_CONTACTORS-1 downto 0);
    begin
        cmd_vec := (others => '0');
        pre_vec := (others => '0');
        for i in 0 to N_CONTACTORS-1 loop
            case contactor_state(i) is
                when ST_CLOSED | ST_CLOSING =>
                    cmd_vec(i) := '1';
                when ST_PRECHARGE =>
                    pre_vec(i) := '1';
                when others =>
                    null;
            end case;
        end loop;
        cmd_reg <= cmd_vec;
        pre_reg <= pre_vec;
    end process;

    -- =====================================================================
    -- Arc Fault Detection
    -- Any contactor in ARC_SUPPRESS state = arc fault
    -- =====================================================================
    process(contactor_state)
        variable arc_detected : std_logic;
    begin
        arc_detected := '0';
        for i in 0 to N_CONTACTORS-1 loop
            if contactor_state(i) = ST_ARC_SUPPRESS then
                arc_detected := '1';
            end if;
        end loop;
        arc_fault_reg <= arc_detected;
    end process;

    -- =====================================================================
    -- Sequence Done Detection
    -- All contactors match their target states
    -- =====================================================================
    process(contactor_state, target_cmd)
        variable all_matched : std_logic;
    begin
        all_matched := '1';
        for i in 0 to N_CONTACTORS-1 loop
            -- Target '1' means CLOSED; target '0' means OPEN
            if target_cmd(i) = '1' then
                if contactor_state(i) /= ST_CLOSED then
                    all_matched := '0';
                end if;
            else
                if contactor_state(i) /= ST_OPEN and contactor_state(i) /= ST_ARC_SUPPRESS then
                    all_matched := '0';
                end if;
            end if;
        end loop;
        sequence_done_reg <= all_matched;
    end process;

    -- =====================================================================
    -- Port Output Assignment
    -- =====================================================================
    contactor_cmd   <= cmd_reg;
    contactor_pre   <= pre_reg;
    arc_fault       <= arc_fault_reg;
    sequence_done   <= sequence_done_reg;

end architecture rtl;

--============================================================================
-- End of CONTACTOR_SEQUENCER
--============================================================================
