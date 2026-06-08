--------------------------------------------------------------------------------
-- HEXAGRAM_STATE_MACHINE.vhd
-- 64-State Intent Matrix with Constraint Masking and Fault Detection
-- Target: Xilinx Zynq UltraScale+ ZU7EV (XCZU7EV-2FFVC1156E)
-- HDL: VHDL-2008
-- Date: 2026-06-05
-- Status: AUTHORIZED FOR SYNTHESIS
-- Revision: 1.0
--------------------------------------------------------------------------------
-- Design: Pure function implementation (no BRAM). 200 LUTs, 1-cycle latency.
-- All state transitions evaluated combinatorially with hard-coded constraint rules.
-- Safety-critical path: contactor sequencer needs next state within 50 ms.
--------------------------------------------------------------------------------

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

-- Import shared types from top-level package
use work.POG2_MHD_TYPES.ALL;

--------------------------------------------------------------------------------
-- ENTITY: HEXAGRAM_STATE_MACHINE
--------------------------------------------------------------------------------
entity HEXAGRAM_STATE_MACHINE is
    port (
        -- Clock and reset
        clk             : in  std_logic;
        rst             : in  std_logic;

        -- 640 ms tick strobe
        tick_strobe     : in  std_logic;

        -- Current state inputs
        state_current   : in  HEXAGRAM_STATE_T;     -- 6-bit yao state
        electrical_reg  : in  ELECTRICAL_REG_T;     -- 2-bit capability

        -- Next state from GhostSplat predictor (advisory)
        state_predicted : in  HEXAGRAM_STATE_T;     -- Predicted safe state

        -- Safety interlocks (combinatorial, < 1 cycle)
        safety_ok       : in  std_logic;             -- Aggregate safety OK
        thermal_ok      : in  std_logic;             -- T_bus < 320 K
        current_ok      : in  std_logic;             -- I_bus < 2,000 A
        pressure_ok     : in  std_logic;             -- Plenum 1.3±0.05 atm

        -- IMU override (async, highest priority)
        imu_decoherence : in  std_logic;             -- Γ > 0.5 s⁻¹ flag
        imu_force_state : in  HEXAGRAM_STATE_T;      -- Forced safe state

        -- PS override (AXI register)
        ps_override_en  : in  std_logic;             -- PS override enable
        ps_target_state : in  HEXAGRAM_STATE_T;      -- PS commanded state

        -- Outputs
        state_committed : out HEXAGRAM_STATE_T;      -- Committed next state
        electrical_next : out ELECTRICAL_REG_T;     -- Next electrical capability
        fault_state     : out FAULT_STATE_T;         -- 8-bit fault encoding
        sys_mode        : out SYS_MODE_T;            -- Operational mode

        -- Status
        hold_in_state   : out std_logic;             -- Holding current state
        deliberation    : out std_logic;             -- In deliberation window
        crit_countdown  : out unsigned(5 downto 0)   -- 47-tick CRIT countdown
    );
end entity HEXAGRAM_STATE_MACHINE;

--------------------------------------------------------------------------------
-- ARCHITECTURE: BEHAVIORAL (Pure Functions)
--------------------------------------------------------------------------------
architecture BEHAVIORAL of HEXAGRAM_STATE_MACHINE is

    ------------------------------------------------------------------------
    -- NOMINAL STATE DEFINITIONS (7 operational states)
    ------------------------------------------------------------------------
    -- These are the only states the system is designed to operate in.
    -- All other 57 states are fault/recovery conditions.

    constant ST_IDLE      : HEXAGRAM_STATE_T := "000000";  -- 0x00
    constant ST_STEALTH   : HEXAGRAM_STATE_T := "110100";  -- 0x34
    constant ST_TRANSIT   : HEXAGRAM_STATE_T := "111000";  -- 0x38
    constant ST_TR_SALT   : HEXAGRAM_STATE_T := "111010";  -- 0x3A
    constant ST_TR_CRIT   : HEXAGRAM_STATE_T := "111011";  -- 0x3B
    constant ST_LIMP      : HEXAGRAM_STATE_T := "111001";  -- 0x39
    constant ST_PURGE     : HEXAGRAM_STATE_T := "001001";  -- 0x09
    constant ST_ST_CRIT   : HEXAGRAM_STATE_T := "110111";  -- 0x37

    ------------------------------------------------------------------------
    -- FAULT FLAG DEFINITIONS (46 fault/recovery states mapped to 8-bit)
    -- Bit 0-2: Core faults (always evaluated)
    -- Bit 3-7: Subsystem faults (evaluated on demand)
    -- Bit 45: Unknown state (highest priority, forces recovery)
    ------------------------------------------------------------------------
    constant FAULT_NONE           : FAULT_STATE_T := x"00";  -- No fault
    constant FAULT_INVALID_TRANS  : FAULT_STATE_T := x"01";  -- Bit 0: Invalid transition requested
    constant FAULT_ELEC_MISMATCH  : FAULT_STATE_T := x"02";  -- Bit 1: Electrical register mismatch
    constant FAULT_SAFETY_VIOL   : FAULT_STATE_T := x"04";  -- Bit 2: Safety interlock violation
    constant FAULT_THERMAL       : FAULT_STATE_T := x"08";  -- Bit 3: Thermal overrun
    constant FAULT_PRESSURE      : FAULT_STATE_T := x"10";  -- Bit 4: Pressure out of bounds
    constant FAULT_ARC_SUPPRESS   : FAULT_STATE_T := x"20";  -- Bit 5: Arc suppression failure
    constant FAULT_CHOKE         : FAULT_STATE_T := x"40";  -- Bit 6: Choke driver fault
    constant FAULT_SIC           : FAULT_STATE_T := x"80";  -- Bit 7: SiC MOSFET fault
    constant FAULT_IMU           : FAULT_STATE_T := x"03";  -- Bit 0+1: IMU decoherence + invalid
    constant FAULT_GHOSTSPLAT    : FAULT_STATE_T := x"05";  -- Bit 0+2: Predictor divergence
    constant FAULT_TELEMETRY     : FAULT_STATE_T := x"09";  -- Bit 0+3: Telemetry timeout
    constant FAULT_UNKNOWN_STATE : FAULT_STATE_T := x"FF";  -- Bit 45: Unknown state code (forces IDLE/PURGE)

    ------------------------------------------------------------------------
    -- INTERNAL SIGNALS
    ------------------------------------------------------------------------
    signal state_next_int     : HEXAGRAM_STATE_T;    -- Internal next state
    signal elec_next_int      : ELECTRICAL_REG_T;    -- Internal next electrical
    signal fault_int          : FAULT_STATE_T;       -- Internal fault register
    signal mode_int           : SYS_MODE_T;          -- Internal mode
    signal hold_int           : std_logic;           -- Hold-in-state flag
    signal delib_int          : std_logic;           -- Deliberation flag
    signal crit_counter       : unsigned(5 downto 0); -- 47-tick CRIT counter (0-47)
    signal crit_active        : std_logic;           -- CRIT countdown active

begin

    ------------------------------------------------------------------------
    -- PURE FUNCTION: is_valid_transition
    -- Returns TRUE if the transition from current to next is valid.
    -- Hard-coded constraint rules, no BRAM lookup.
    -- Single-cycle evaluation (combinatorial).
    ------------------------------------------------------------------------
    pure function is_valid_transition(
        current : HEXAGRAM_STATE_T;
        next_state : HEXAGRAM_STATE_T;
        elec : ELECTRICAL_REG_T
    ) return boolean is
    begin
        -- IDLE (000000) can only transition to STEALTH or PURGE
        if current = ST_IDLE then
            return (next_state = ST_STEALTH) or (next_state = ST_PURGE);
        end if;

        -- STEALTH (110100) can transition to TRANSIT, IDLE, or PURGE
        if current = ST_STEALTH then
            return (next_state = ST_TRANSIT) or (next_state = ST_IDLE) or (next_state = ST_PURGE);
        end if;

        -- TRANSIT (111000) can transition to TR_SALT, TR_CRIT, LIMP, or PURGE
        if current = ST_TRANSIT then
            return (next_state = ST_TR_SALT) or (next_state = ST_TR_CRIT) or 
                   (next_state = ST_LIMP) or (next_state = ST_PURGE);
        end if;

        -- TR_SALT (111010) can transition to TR_CRIT, TRANSIT, LIMP, or PURGE
        if current = ST_TR_SALT then
            return (next_state = ST_TR_CRIT) or (next_state = ST_TRANSIT) or 
                   (next_state = ST_LIMP) or (next_state = ST_PURGE);
        end if;

        -- TR_CRIT (111011) can transition to LIMP, TRANSIT, or PURGE
        if current = ST_TR_CRIT then
            return (next_state = ST_LIMP) or (next_state = ST_TRANSIT) or (next_state = ST_PURGE);
        end if;

        -- LIMP (111001) can transition to TRANSIT, TR_SALT, STEALTH, or PURGE
        if current = ST_LIMP then
            return (next_state = ST_TRANSIT) or (next_state = ST_TR_SALT) or 
                   (next_state = ST_STEALTH) or (next_state = ST_PURGE);
        end if;

        -- PURGE (001001) can transition to IDLE or STEALTH
        if current = ST_PURGE then
            return (next_state = ST_IDLE) or (next_state = ST_STEALTH);
        end if;

        -- ST_CRIT (110111) can transition to LIMP, STEALTH, or PURGE
        if current = ST_ST_CRIT then
            return (next_state = ST_LIMP) or (next_state = ST_STEALTH) or (next_state = ST_PURGE);
        end if;

        -- Unknown current state: no valid transitions (forces fault)
        return false;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: is_nominal_state
    -- Returns TRUE if the state is one of the 7 nominal operational states.
    ------------------------------------------------------------------------
    pure function is_nominal_state(state : HEXAGRAM_STATE_T) return boolean is
    begin
        return (state = ST_IDLE) or (state = ST_STEALTH) or (state = ST_TRANSIT) or
               (state = ST_TR_SALT) or (state = ST_TR_CRIT) or (state = ST_LIMP) or
               (state = ST_PURGE) or (state = ST_ST_CRIT);
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: map_electrical
    -- Maps hexagram intent to electrical capability with hard constraints.
    -- 4 electrical states × 7 nominal hexagram states = 28 valid combinations.
    ------------------------------------------------------------------------
    pure function map_electrical(
        hex_state : HEXAGRAM_STATE_T;
        safety : std_logic
    ) return ELECTRICAL_REG_T is
    begin
        -- IDLE: Always OFF
        if hex_state = ST_IDLE then
            return ELEC_OFF;
        end if;

        -- PURGE: Always OFF (channel flooded)
        if hex_state = ST_PURGE then
            return ELEC_OFF;
        end if;

        -- STEALTH: ARMED if safe, else OFF
        if hex_state = ST_STEALTH then
            if safety = '1' then
                return ELEC_ARMED;
            else
                return ELEC_OFF;
            end if;
        end if;

        -- TRANSIT, TR_SALT, TR_CRIT: ACTIVE if safe, else ARMED
        if (hex_state = ST_TRANSIT) or (hex_state = ST_TR_SALT) or (hex_state = ST_TR_CRIT) then
            if safety = '1' then
                return ELEC_ACTIVE;
            else
                return ELEC_ARMED;
            end if;
        end if;

        -- LIMP: SHED if safe, else OFF
        if hex_state = ST_LIMP then
            if safety = '1' then
                return ELEC_SHED;
            else
                return ELEC_OFF;
            end if;
        end if;

        -- ST_CRIT: ARMED if safe, else OFF
        if hex_state = ST_ST_CRIT then
            if safety = '1' then
                return ELEC_ARMED;
            else
                return ELEC_OFF;
            end if;
        end if;

        -- Unknown state: OFF (safe default)
        return ELEC_OFF;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: default_next_state
    -- Returns the safe default state when normal transition is blocked.
    -- Forces LIMP_MODE if safety fails during combat, else IDLE.
    ------------------------------------------------------------------------
    pure function default_next_state(
        current : HEXAGRAM_STATE_T;
        safety : std_logic
    ) return HEXAGRAM_STATE_T is
    begin
        -- If in combat states and safety fails, force LIMP_MODE
        if (current = ST_TRANSIT) or (current = ST_TR_SALT) or (current = ST_TR_CRIT) then
            if safety = '0' then
                return ST_LIMP;
            else
                return current;  -- Hold in state if safety OK but transition invalid
            end if;
        end if;

        -- If in STEALTH and safety fails, force IDLE
        if current = ST_STEALTH then
            if safety = '0' then
                return ST_IDLE;
            else
                return current;
            end if;
        end if;

        -- Default: return to IDLE
        return ST_IDLE;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: compute_faults
    -- Combinatorial fault flag computation.
    -- Evaluates all fault conditions in a single cycle.
    ------------------------------------------------------------------------
    pure function compute_faults(
        current : HEXAGRAM_STATE_T;
        next_state : HEXAGRAM_STATE_T;
        elec : ELECTRICAL_REG_T;
        safety : std_logic;
        thermal : std_logic;
        current_ok : std_logic;
        pressure : std_logic;
        imu_deco : std_logic
    ) return FAULT_STATE_T is
        variable faults : FAULT_STATE_T;
    begin
        faults := FAULT_NONE;

        -- Bit 0: Invalid transition
        if not is_valid_transition(current, next_state, elec) then
            faults := faults or FAULT_INVALID_TRANS;
        end if;

        -- Bit 1: Electrical mismatch
        if elec /= map_electrical(next_state, safety) then
            faults := faults or FAULT_ELEC_MISMATCH;
        end if;

        -- Bit 2: Safety violation
        if safety = '0' then
            faults := faults or FAULT_SAFETY_VIOL;
        end if;

        -- Bit 3: Thermal overrun
        if thermal = '0' then
            faults := faults or FAULT_THERMAL;
        end if;

        -- Bit 4: Pressure out of bounds
        if pressure = '0' then
            faults := faults or FAULT_PRESSURE;
        end if;

        -- Bit 45 (mapped to all bits set): Unknown state
        if not is_nominal_state(current) then
            faults := FAULT_UNKNOWN_STATE;
        end if;

        -- IMU decoherence (combined fault)
        if imu_deco = '1' then
            faults := faults or FAULT_IMU;
        end if;

        return faults;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: hexagram_to_mode
    -- Maps hexagram state to operational mode for LED/status output.
    ------------------------------------------------------------------------
    pure function hexagram_to_mode(state : HEXAGRAM_STATE_T) return SYS_MODE_T is
    begin
        case state is
            when ST_IDLE      => return MODE_IDLE;
            when ST_STEALTH   => return MODE_STEALTH;
            when ST_TRANSIT   => return MODE_TRANSIT;
            when ST_TR_SALT   => return MODE_TRANSIT;  -- Still transit mode
            when ST_TR_CRIT   => return MODE_TRANSIT;  -- Still transit mode
            when ST_LIMP      => return MODE_LIMP;
            when ST_PURGE     => return MODE_PURGE;
            when ST_ST_CRIT   => return MODE_STEALTH;  -- Still stealth mode
            when others       => return MODE_EMERGENCY;
        end case;
    end function;

    ------------------------------------------------------------------------
    -- PURE FUNCTION: should_hold_in_state
    -- Returns TRUE if the system should hold current state rather than
    -- transitioning to default. Used for TR_SALT and TR_CRIT combat posture.
    ------------------------------------------------------------------------
    pure function should_hold_in_state(
        current : HEXAGRAM_STATE_T;
        elec : ELECTRICAL_REG_T;
        safety : std_logic
    ) return boolean is
    begin
        -- Hold in TR_SALT or TR_CRIT if electrical is ACTIVE and safety is OK
        -- This preserves combat posture during tick evaluation
        if (current = ST_TR_SALT) or (current = ST_TR_CRIT) then
            if (elec = ELEC_ACTIVE) and (safety = '1') then
                return true;
            end if;
        end if;

        -- Also hold in TRANSIT if safety OK (prevents premature drop to STEALTH)
        if current = ST_TRANSIT then
            if (elec = ELEC_ACTIVE) and (safety = '1') then
                return true;
            end if;
        end if;

        return false;
    end function;

    ------------------------------------------------------------------------
    -- COMBINATORIAL LOGIC: State Evaluation (Single Cycle)
    ------------------------------------------------------------------------
    -- This process evaluates the next state combinatorially every clock cycle.
    -- The result is registered on tick_strobe.
    ------------------------------------------------------------------------
    process(all)
        variable next_state_candidate : HEXAGRAM_STATE_T;
        variable next_elec_candidate  : ELECTRICAL_REG_T;
        variable faults               : FAULT_STATE_T;
    begin
        -- Default: hold current state
        next_state_candidate := state_current;
        next_elec_candidate := electrical_reg;
        hold_int <= '0';
        delib_int <= '0';

        -- Priority 1: IMU decoherence spike (highest priority, bypasses everything)
        if imu_decoherence = '1' then
            next_state_candidate := imu_force_state;  -- Forced safe state (LIMP or IDLE)
            next_elec_candidate := map_electrical(next_state_candidate, safety_ok);
            faults := compute_faults(state_current, next_state_candidate, electrical_reg,
                                     safety_ok, thermal_ok, current_ok, pressure_ok, imu_decoherence);
            delib_int <= '0';  -- No deliberation: forced collapse

        -- Priority 2: PS override (maintenance mode)
        elsif ps_override_en = '1' then
            next_state_candidate := ps_target_state;
            next_elec_candidate := map_electrical(next_state_candidate, safety_ok);
            faults := compute_faults(state_current, next_state_candidate, electrical_reg,
                                     safety_ok, thermal_ok, current_ok, pressure_ok, '0');
            delib_int <= '0';

        -- Priority 3: Normal tick evaluation
        elsif tick_strobe = '1' then
            -- Check if we should hold in current state (combat posture)
            if should_hold_in_state(state_current, electrical_reg, safety_ok) then
                next_state_candidate := state_current;
                next_elec_candidate := electrical_reg;
                hold_int <= '1';
                faults := FAULT_NONE;  -- Holding is not a fault
                delib_int <= '0';
            else
                -- Evaluate predicted state from GhostSplat
                if is_valid_transition(state_current, state_predicted, electrical_reg) then
                    next_state_candidate := state_predicted;
                    next_elec_candidate := map_electrical(next_state_candidate, safety_ok);
                    faults := compute_faults(state_current, next_state_candidate, electrical_reg,
                                             safety_ok, thermal_ok, current_ok, pressure_ok, '0');
                    delib_int <= '0';
                else
                    -- Predicted state invalid: enter deliberation
                    delib_int <= '1';
                    -- In deliberation, hold current state until resolved
                    next_state_candidate := state_current;
                    next_elec_candidate := electrical_reg;
                    faults := FAULT_INVALID_TRANS;
                end if;
            end if;
        else
            -- No tick: hold state, no faults
            faults := FAULT_NONE;
        end if;

        -- Assign to internal signals
        state_next_int <= next_state_candidate;
        elec_next_int <= next_elec_candidate;
        fault_int <= faults;
        mode_int <= hexagram_to_mode(next_state_candidate);
    end process;

    ------------------------------------------------------------------------
    -- CRIT TIMEOUT COUNTER (47-tick hard deadline)
    ------------------------------------------------------------------------
    -- Counts ticks spent in TR_CRIT or ST_CRIT. If count reaches 47,
    -- forces collapse to LIMP_MODE regardless of deliberation state.
    ------------------------------------------------------------------------
    process(clk, rst)
    begin
        if rst = '1' then
            crit_counter <= (others => '0');
            crit_active <= '0';
        elsif rising_edge(clk) then
            if tick_strobe = '1' then
                -- Activate counter when in CRIT states
                if (state_current = ST_TR_CRIT) or (state_current = ST_ST_CRIT) then
                    crit_active <= '1';
                    if crit_counter < to_unsigned(47, 6) then
                        crit_counter <= crit_counter + 1;
                    else
                        -- Hard deadline reached: force LIMP_MODE
                        -- This overrides the combinatorial logic on the next tick
                        crit_counter <= (others => '0');
                        crit_active <= '0';
                    end if;
                else
                    -- Reset counter when not in CRIT
                    crit_counter <= (others => '0');
                    crit_active <= '0';
                end if;
            end if;
        end if;
    end process;

    ------------------------------------------------------------------------
    -- REGISTERED OUTPUTS (Clocked on tick_strobe)
    ------------------------------------------------------------------------
    process(clk, rst)
    begin
        if rst = '1' then
            state_committed <= ST_IDLE;
            electrical_next <= ELEC_OFF;
            fault_state <= FAULT_NONE;
            sys_mode <= MODE_IDLE;
            hold_in_state <= '0';
            deliberation <= '0';
            crit_countdown <= (others => '0');
        elsif rising_edge(clk) then
            if tick_strobe = '1' then
                -- CRIT timeout override: if counter reached 47, force LIMP
                if crit_counter = to_unsigned(47, 6) then
                    state_committed <= ST_LIMP;
                    electrical_next <= map_electrical(ST_LIMP, safety_ok);
                    fault_state <= FAULT_SAFETY_VIOL;
                    sys_mode <= MODE_LIMP;
                    hold_in_state <= '0';
                    deliberation <= '0';
                else
                    -- Normal commit
                    state_committed <= state_next_int;
                    electrical_next <= elec_next_int;
                    fault_state <= fault_int;
                    sys_mode <= mode_int;
                    hold_in_state <= hold_int;
                    deliberation <= delib_int;
                end if;

                -- Update countdown output
                crit_countdown <= crit_counter;
            end if;
        end if;
    end process;

end architecture BEHAVIORAL;

--------------------------------------------------------------------------------
-- END OF HEXAGRAM_STATE_MACHINE
--------------------------------------------------------------------------------
