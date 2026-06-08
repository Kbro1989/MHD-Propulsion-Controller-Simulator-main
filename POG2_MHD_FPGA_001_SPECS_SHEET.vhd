-- ============================================================================
-- POG2-MHD-FPGA-001 Specifications Sheet
-- Rev 1.1 | 2026-06-06 | Emotional-Thermal Substrate Mapping
-- ============================================================================
-- This document maps the software affective substrate (EmotionalPool,
-- MetaCognitionEngine, GhostLimb, 36 Hexagram Evaluations) to hardware
-- thermal states, registers, and VHDL code snippets.
-- ============================================================================

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- ============================================================================
-- SECTION 1: EMOTIONAL ↔ THERMAL TYPE DEFINITIONS
-- ============================================================================

package EmotionalThermalTypes is

    -- Software EmotionalState mapped to hardware thermal response
    type emotional_state_t is (
        FOCUSED,      -- All segments nominal, system ready
        ANXIOUS,      -- Segment approaching threshold
        CHAOS,        -- OldMixed yao state detected
        PANIC,        -- Thermal CRIT, limp mode engaged
        RESOLVED,     -- STEALTH_IDLE, minimal signature
        REFLECTIVE,   -- GhostSplat confidence evaluation
        OBSERVANT     -- Watchdog/fault log active (GhostLimb)
    );

    -- Thermal evaluation corresponding to 36 hexagram emotional evaluations
    type thermal_eval_t is record
        threshold   : unsigned(15 downto 0);  -- Temperature in 0.0625 K LSB
        response    : emotional_state_t;
        yao_pattern : std_logic_vector(5 downto 0);  -- Matching yao state
    end record;

    -- "Soul" — thermal personality profile (mirrors VoiceLimb personality)
    type thermal_personality_t is record
        vibe_mode        : std_logic_vector(7 downto 0);   -- 0x20 register
        thermal_variance : unsigned(15 downto 0);        -- 0x24 register
        personality_card : std_logic_vector(15 downto 0);   -- 0x28 register
        threshold_scale  : unsigned(15 downto 0);          -- 0x18 register
    end record;

    -- GhostLimb hardware equivalent — silent witness / backup consciousness
    type ghost_limb_state_t is record
        watchdog_counter : unsigned(31 downto 0);
        fault_log_ptr    : unsigned(7 downto 0);
        last_heartbeat   : unsigned(31 downto 0);
        anomaly_detected : std_logic;
    end record;

    -- 36 thermal evaluations (6 segments × 6 threshold bands)
    type thermal_eval_array_t is array(0 to 35) of thermal_eval_t;

    -- Constants for thermal thresholds (from POG2-MHD-PROP-001 physical spec)
    constant T_SALT_START  : unsigned(15 downto 0) := x"07D0";  -- 305 K
    constant T_SALT_RESET  : unsigned(15 downto 0) := x"0700";  -- 280 K
    constant T_CRIT_LIMIT : unsigned(15 downto 0) := x"0800";  -- 320 K
    constant T_DARK_IRON  : unsigned(15 downto 0) := x"0000";  -- Uninitialized

    -- Vibe mode constants (mirrors software personality archetypes)
    constant VIBE_CLINICAL    : std_logic_vector(7 downto 0) := x"00";
    constant VIBE_AGITATED    : std_logic_vector(7 downto 0) := x"01";
    constant VIBE_STEALTH     : std_logic_vector(7 downto 0) := x"02";
    constant VIBE_TRANSIT     : std_logic_vector(7 downto 0) := x"03";
    constant VIBE_LIMP        : std_logic_vector(7 downto 0) := x"04";
    constant VIBE_CRIT        : std_logic_vector(7 downto 0) := x"05";
    constant VIBE_PURGE       : std_logic_vector(7 downto 0) := x"06";
    constant VIBE_DARK_IRON   : std_logic_vector(7 downto 0) := x"07";

end package EmotionalThermalTypes;

-- ============================================================================
-- SECTION 2: 36 THERMAL EVALUATIONS (Hexagram Emotional Mapping)
-- ============================================================================
-- Each evaluation maps a thermal condition to an emotional response.
-- These mirror the 36 hexagram evaluations in software's EmotionalPool.
-- ============================================================================

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use work.EmotionalThermalTypes.all;

entity ThermalEvaluationEngine is
    port (
        clk             : in  std_logic;
        reset           : in  std_logic;
        segment_temps   : in  array(0 to 4) of unsigned(15 downto 0);
        yao_lines       : in  std_logic_vector(5 downto 0);
        vibe_mode       : in  std_logic_vector(7 downto 0);
        -- Output: current emotional/thermal state
        current_state   : out emotional_state_t;
        evaluation_id   : out unsigned(5 downto 0);  -- 0-35
        confidence      : out unsigned(7 downto 0)   -- 0-255
    );
end entity;

architecture behavioral of ThermalEvaluationEngine is

    -- 36 thermal evaluations matching software emotional evaluations
    constant THERMAL_EVALUATIONS : thermal_eval_array_t := (
        -- YoungYang band (0-5): All segments nominal, ascending heat
        0  => (threshold => x"07D0", response => FOCUSED,    yao_pattern => "111111"), -- 305 K
        1  => (threshold => x"07E6", response => FOCUSED,    yao_pattern => "111111"), -- 308 K
        2  => (threshold => x"07F8", response => ANXIOUS,    yao_pattern => "111110"), -- 311 K
        3  => (threshold => x"0800", response => ANXIOUS,    yao_pattern => "111100"), -- 320 K (T_CRIT)
        4  => (threshold => x"0814", response => CHAOS,      yao_pattern => "110011"), -- 325 K
        5  => (threshold => x"0828", response => PANIC,      yao_pattern => "101010"), -- 330 K

        -- YoungYin band (6-11): Odd segments elevated
        6  => (threshold => x"07D0", response => FOCUSED,    yao_pattern => "101010"),
        7  => (threshold => x"07E0", response => REFLECTIVE, yao_pattern => "101011"),
        8  => (threshold => x"07F0", response => ANXIOUS,    yao_pattern => "101001"),
        9  => (threshold => x"0800", response => CHAOS,      yao_pattern => "100001"),
        10 => (threshold => x"0810", response => PANIC,      yao_pattern => "100000"),
        11 => (threshold => x"0820", response => OBSERVANT,  yao_pattern => "000000"),

        -- OldYang band (12-17): Even segments elevated, stable decay
        12 => (threshold => x"07D0", response => RESOLVED,   yao_pattern => "010101"),
        13 => (threshold => x"07E0", response => REFLECTIVE, yao_pattern => "010111"),
        14 => (threshold => x"07F0", response => ANXIOUS,    yao_pattern => "010110"),
        15 => (threshold => x"0800", response => REFLECTIVE, yao_pattern => "010100"),
        16 => (threshold => x"0810", response => RESOLVED,   yao_pattern => "010000"),
        17 => (threshold => x"0820", response => FOCUSED,     yao_pattern => "000000"),

        -- OldYin band (18-23): All segments decaying, chaotic
        18 => (threshold => x"07C0", response => CHAOS,      yao_pattern => "000000"), -- 304 K
        19 => (threshold => x"07A0", response => CHAOS,      yao_pattern => "000001"), -- 296 K
        20 => (threshold => x"0780", response => PANIC,      yao_pattern => "000011"), -- 288 K
        21 => (threshold => x"0760", response => PANIC,      yao_pattern => "000111"), -- 280 K (T_SALT_RESET)
        22 => (threshold => x"0740", response => OBSERVANT,  yao_pattern => "001111"), -- 272 K
        23 => (threshold => x"0720", response => OBSERVANT,  yao_pattern => "011111"), -- 264 K

        -- YoungMixed band (24-29): Transition patterns, uncertain
        24 => (threshold => x"07D0", response => REFLECTIVE, yao_pattern => "111000"),
        25 => (threshold => x"07E0", response => ANXIOUS,    yao_pattern => "110100"),
        26 => (threshold => x"07F0", response => CHAOS,      yao_pattern => "110010"),
        27 => (threshold => x"0800", response => CHAOS,      yao_pattern => "101100"),
        28 => (threshold => x"0810", response => PANIC,      yao_pattern => "100110"),
        29 => (threshold => x"0820", response => OBSERVANT,  yao_pattern => "100011"),

        -- OldMixed band (30-35): Chaotic transitions, blocked actions
        30 => (threshold => x"07D0", response => CHAOS,      yao_pattern => "000111"),
        31 => (threshold => x"07E0", response => CHAOS,      yao_pattern => "001011"),
        32 => (threshold => x"07F0", response => CHAOS,      yao_pattern => "010011"),
        33 => (threshold => x"0800", response => CHAOS,      yao_pattern => "010110"),
        34 => (threshold => x"0810", response => PANIC,      yao_pattern => "011010"),
        35 => (threshold => x"0820", response => OBSERVANT,  yao_pattern => "011100")
    );

    signal current_eval : unsigned(5 downto 0) := (others => '0');
    signal max_temp   : unsigned(15 downto 0);
    signal avg_temp   : unsigned(15 downto 0);

begin

    -- Compute max and average segment temperature
    process(segment_temps)
        variable temp_sum : unsigned(17 downto 0);
        variable temp_max : unsigned(15 downto 0);
    begin
        temp_sum := (others => '0');
        temp_max := (others => '0');
        for i in 0 to 4 loop
            temp_sum := temp_sum + resize(segment_temps(i), 18);
            if segment_temps(i) > temp_max then
                temp_max := segment_temps(i);
            end if;
        end loop;
        max_temp <= temp_max;
        avg_temp <= resize(temp_sum / 5, 16);
    end process;

    -- Evaluate thermal state against 36 evaluations
    process(clk, reset)
        variable best_match : unsigned(5 downto 0);
        variable best_conf  : unsigned(7 downto 0);
        variable temp_diff  : unsigned(15 downto 0);
    begin
        if reset = '1' then
            current_eval <= (others => '0');
            current_state <= FOCUSED;
            confidence <= x"FF";
        elsif rising_edge(clk) then
            best_match := (others => '0');
            best_conf := (others => '0');

            for i in 0 to 35 loop
                -- Match yao pattern first
                if yao_lines = THERMAL_EVALUATIONS(i).yao_pattern then
                    -- Then check temperature proximity
                    if max_temp >= THERMAL_EVALUATIONS(i).threshold then
                        temp_diff := max_temp - THERMAL_EVALUATIONS(i).threshold;
                        -- Confidence inversely proportional to distance from threshold
                        if temp_diff < x"0100" then  -- Within 4 K
                            best_match := to_unsigned(i, 6);
                            best_conf := x"FF" - resize(temp_diff(7 downto 0), 8);
                        end if;
                    end if;
                end if;
            end loop;

            current_eval <= best_match;
            evaluation_id <= best_match;
            confidence <= best_conf;
            current_state <= THERMAL_EVALUATIONS(to_integer(best_match)).response;
        end if;
    end process;

end architecture behavioral;

-- ============================================================================
-- SECTION 3: GHOSTLIMB HARDWARE — Silent Witness / Backup Consciousness
-- ============================================================================
-- Mirrors software GhostLimb.ts: "Failover consciousness, monitoring"
-- ============================================================================

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity GhostLimbHardware is
    port (
        clk                  : in  std_logic;
        reset                : in  std_logic;
        -- Inputs from main state machines
        state_machine_alive  : in  std_logic;  -- Heartbeat from HexagramSM
        thermal_anomaly      : in  std_logic;  -- From GhostSplat predictor
        contactor_fault      : in  std_logic;  -- From ContactorSequencer
        choke_fault          : in  std_logic;  -- From ChokeDriver
        sensor_fault         : in  std_logic;  -- From SensorAcquisition
        -- Configuration
        watchdog_timeout     : in  unsigned(31 downto 0);  -- 480 ticks default
        -- Outputs: silent witness, only acts on catastrophe
        watchdog_bark        : out std_logic;  -- Forces GLOBAL_RESET
        fault_log_entry      : out std_logic_vector(31 downto 0);
        fault_log_valid      : out std_logic;
        ghost_status         : out std_logic_vector(7 downto 0)  -- Health report
    );
end entity;

architecture behavioral of GhostLimbHardware is

    signal heartbeat_counter : unsigned(31 downto 0);
    signal fault_history     : array(0 to 15) of std_logic_vector(31 downto 0);
    signal fault_ptr         : unsigned(3 downto 0);
    signal last_alive        : std_logic;
    signal anomaly_latched   : std_logic;

    -- Ghost status encoding
    constant GHOST_HEALTHY    : std_logic_vector(7 downto 0) := x"01";
    constant GHOST_WATCHING   : std_logic_vector(7 downto 0) := x"02";
    constant GHOST_ANXIOUS    : std_logic_vector(7 downto 0) := x"04";
    constant GHOST_BARKING    : std_logic_vector(7 downto 0) := x"08";

begin

    -- Watchdog: count ticks since last heartbeat
    process(clk, reset)
    begin
        if reset = '1' then
            heartbeat_counter <= (others => '0');
            last_alive <= '0';
            watchdog_bark <= '0';
        elsif rising_edge(clk) then
            last_alive <= state_machine_alive;

            if state_machine_alive = '1' and last_alive = '0' then
                -- Heartbeat detected, reset counter
                heartbeat_counter <= (others => '0');
                watchdog_bark <= '0';
            else
                heartbeat_counter <= heartbeat_counter + 1;
                if heartbeat_counter >= watchdog_timeout then
                    -- Timeout! Bark!
                    watchdog_bark <= '1';
                end if;
            end if;
        end if;
    end process;

    -- Fault log: circular buffer of last 16 faults
    process(clk, reset)
        variable fault_code : std_logic_vector(11 downto 0);
        variable timestamp  : std_logic_vector(15 downto 0);
    begin
        if reset = '1' then
            fault_ptr <= (others => '0');
            anomaly_latched <= '0';
            fault_log_valid <= '0';
        elsif rising_edge(clk) then
            fault_log_valid <= '0';

            -- Latch any fault condition
            if thermal_anomaly = '1' or contactor_fault = '1' or
               choke_fault = '1' or sensor_fault = '1' then
                anomaly_latched <= '1';

                -- Encode fault: {timestamp:16, code:12, source:4}
                timestamp := std_logic_vector(heartbeat_counter(15 downto 0));
                fault_code := (others => '0');
                if thermal_anomaly then fault_code(0) := '1'; end if;
                if contactor_fault then fault_code(1) := '1'; end if;
                if choke_fault then fault_code(2) := '1'; end if;
                if sensor_fault then fault_code(3) := '1'; end if;

                fault_history(to_integer(fault_ptr)) <= timestamp & fault_code & x"0";
                fault_ptr <= fault_ptr + 1;
                fault_log_entry <= timestamp & fault_code & x"0";
                fault_log_valid <= '1';
            end if;
        end if;
    end process;

    -- Ghost status: emotional state of the silent witness
    process(heartbeat_counter, anomaly_latched, watchdog_bark)
    begin
        if watchdog_bark = '1' then
            ghost_status <= GHOST_BARKING;
        elsif anomaly_latched = '1' then
            ghost_status <= GHOST_ANXIOUS;
        elsif heartbeat_counter > watchdog_timeout / 2 then
            ghost_status <= GHOST_WATCHING;
        else
            ghost_status <= GHOST_HEALTHY;
        end if;
    end process;

end architecture behavioral;

-- ============================================================================
-- SECTION 4: META-COGNITION ENGINE — Confidence Evaluation
-- ============================================================================
-- Mirrors software MetaCognitionEngine.ts: "I think about the way I feel"
-- ============================================================================

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity MetaCognitionHardware is
    port (
        clk              : in  std_logic;
        reset            : in  std_logic;
        -- Inputs from predictor and state machine
        ghostsplat_conf  : in  unsigned(7 downto 0);   -- 0-255
        prediction_horiz : in  unsigned(3 downto 0);  -- 1-10 ticks
        thermal_variance : in  unsigned(15 downto 0);  -- 0.0-1.0 fixed point
        vibe_mode        : in  std_logic_vector(7 downto 0);
        -- Outputs: self-reflection results
        self_confidence  : out unsigned(7 downto 0);   -- 70% gate = 178
        should_execute   : out std_logic;              -- Pass/fail
        reflection_state : out std_logic_vector(3 downto 0)
    );
end entity;

architecture behavioral of MetaCognitionHardware is

    -- Reflection states
    constant REFLECT_IDLE     : std_logic_vector(3 downto 0) := x"0";
    constant REFLECT_EVAL     : std_logic_vector(3 downto 0) := x"1";
    constant REFLECT_PASS     : std_logic_vector(3 downto 0) := x"2";
    constant REFLECT_FAIL     : std_logic_vector(3 downto 0) := x"3";
    constant REFLECT_RETRY    : std_logic_vector(3 downto 0) := x"4";
    constant REFLECT_ABORT    : std_logic_vector(3 downto 0) := x"5";

    -- 70% pass gate threshold (0.7 * 255 = 178.5)
    constant PASS_THRESHOLD : unsigned(7 downto 0) := x"B3";  -- 179

    signal retry_count : unsigned(1 downto 0);
    signal reflect_reg : std_logic_vector(3 downto 0);

begin

    process(clk, reset)
        variable scaled_conf : unsigned(15 downto 0);
    begin
        if reset = '1' then
            self_confidence <= (others => '0');
            should_execute <= '0';
            reflect_reg <= REFLECT_IDLE;
            retry_count <= (others => '0');
        elsif rising_edge(clk) then
            case reflect_reg is
                when REFLECT_IDLE =>
                    reflect_reg <= REFLECT_EVAL;

                when REFLECT_EVAL =>
                    -- Scale confidence by thermal variance and vibe mode
                    -- Formula: conf = ghostsplat_conf * (1.0 - thermal_variance/256) * vibe_factor
                    scaled_conf := resize(ghostsplat_conf * (x"0100" - thermal_variance), 16);

                    -- Vibe mode adjustment
                    case vibe_mode is
                        when VIBE_CLINICAL  => scaled_conf := shift_right(scaled_conf, 1);  -- Conservative
                        when VIBE_AGITATED  => scaled_conf := scaled_conf;                   -- Aggressive
                        when VIBE_STEALTH   => scaled_conf := shift_right(scaled_conf, 2); -- Ultra-conservative
                        when VIBE_CRIT      => scaled_conf := x"FFFF";                      -- Emergency
                        when others         => scaled_conf := scaled_conf;
                    end case;

                    self_confidence <= resize(scaled_conf(15 downto 8), 8);

                    if resize(scaled_conf(15 downto 8), 8) >= PASS_THRESHOLD then
                        reflect_reg <= REFLECT_PASS;
                        should_execute <= '1';
                    elsif retry_count < 3 then
                        reflect_reg <= REFLECT_RETRY;
                        retry_count <= retry_count + 1;
                    else
                        reflect_reg <= REFLECT_FAIL;
                        should_execute <= '0';
                    end if;

                when REFLECT_RETRY =>
                    -- Wait one tick, then re-evaluate
                    reflect_reg <= REFLECT_EVAL;

                when REFLECT_PASS | REFLECT_FAIL | REFLECT_ABORT =>
                    -- Terminal states, hold until reset
                    reflect_reg <= reflect_reg;

                when others =>
                    reflect_reg <= REFLECT_IDLE;
            end case;
        end if;
    end process;

    reflection_state <= reflect_reg;

end architecture behavioral;

-- ============================================================================
-- SECTION 5: EMOTIONAL MODULATION — Thermal Response Weighting
-- ============================================================================
-- Mirrors software EmotionalPool: emotions trigger weighted responses
-- ============================================================================

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use work.EmotionalThermalTypes.all;

entity EmotionalModulator is
    port (
        clk              : in  std_logic;
        reset            : in  std_logic;
        emotional_state  : in  emotional_state_t;
        base_threshold   : in  unsigned(15 downto 0);  -- 320 K default
        -- Modulated outputs
        scaled_threshold : out unsigned(15 downto 0);
        choke_limit      : out unsigned(11 downto 0);  -- Max duty cycle
        contactor_delay  : out unsigned(23 downto 0);  -- Timing adjustment
        telemetry_rate   : out unsigned(7 downto 0)    -- Hz
    );
end entity;

architecture behavioral of EmotionalModulator is
begin

    process(emotional_state, base_threshold)
    begin
        case emotional_state is
            when FOCUSED =>
                scaled_threshold <= base_threshold;           -- 320 K
                choke_limit <= x"FFF";                         -- 100%
                contactor_delay <= x"000F4240";                 -- 15 ms normal
                telemetry_rate <= x"01";                        -- 1 Hz

            when ANXIOUS =>
                scaled_threshold <= base_threshold - x"0028";   -- 318 K
                choke_limit <= x"CCC";                         -- 80%
                contactor_delay <= x"000C3500";                 -- 12 ms faster
                telemetry_rate <= x"04";                        -- 4 Hz

            when CHAOS =>
                scaled_threshold <= base_threshold - x"0050";   -- 316 K
                choke_limit <= x"666";                         -- 40% (chaos limit)
                contactor_delay <= x"00186A00";                 -- 20 ms slower (safety)
                telemetry_rate <= x"0A";                        -- 10 Hz

            when PANIC =>
                scaled_threshold <= base_threshold - x"00A0";   -- 312 K
                choke_limit <= x"000";                         -- 0% (emergency stop)
                contactor_delay <= x"00000000";                 -- Immediate
                telemetry_rate <= x"64";                        -- 100 Hz max

            when RESOLVED =>
                scaled_threshold <= base_threshold + x"0028";   -- 322 K
                choke_limit <= x"999";                         -- 60% (stealth)
                contactor_delay <= x"000F4240";                 -- 15 ms normal
                telemetry_rate <= x"01";                        -- 1 Hz minimal

            when REFLECTIVE =>
                scaled_threshold <= base_threshold;           -- 320 K
                choke_limit <= x"B33";                         -- 70%
                contactor_delay <= x"000F4240";                 -- 15 ms
                telemetry_rate <= x"02";                        -- 2 Hz

            when OBSERVANT =>
                scaled_threshold <= base_threshold;           -- 320 K
                choke_limit <= x"FFF";                         -- 100% (watching)
                contactor_delay <= x"000F4240";                 -- 15 ms
                telemetry_rate <= x"14";                        -- 20 Hz (diagnostic)

            when others =>
                scaled_threshold <= base_threshold;
                choke_limit <= x"FFF";
                contactor_delay <= x"000F4240";
                telemetry_rate <= x"01";
        end case;
    end process;

end architecture behavioral;

-- ============================================================================
-- SECTION 6: REGISTER MAP — Emotional-Thermal Mapping
-- ============================================================================
-- Maps software emotional states to hardware register addresses
-- ============================================================================

-- | Register | Offset | Emotional Mapping | Thermal Mapping |
-- |----------|--------|-------------------|-----------------|
-- | EMOTIONAL_STATE | 0x100 | current emotional_state_t | Derived from thermal eval |
-- | EVALUATION_ID | 0x104 | 36 hexagram eval index | 0-35 thermal eval |
-- | CONFIDENCE | 0x108 | GhostSplat confidence | MetaCognition output |
-- | RETRY_COUNT | 0x10C | Retry logic counter | 0-3 attempts |
-- | GHOST_STATUS | 0x110 | GhostLimb health | Watchdog status |
-- | FAULT_LOG_HEAD | 0x114 | Fault history pointer | Circular buffer ptr |
-- | FAULT_LOG_0 | 0x118 | Fault entry 0 | {timestamp, code, source} |
-- | ... | ... | ... | ... |
-- | FAULT_LOG_15 | 0x154 | Fault entry 15 | Last 16 faults |
-- | THERMAL_VARIANCE | 0x24 | Personality thermal variance | 0.0-1.0 fixed |
-- | VIBE_MODE | 0x20 | Personality archetype | 0x00-0x08 |

-- ============================================================================
-- END OF SPECIFICATIONS SHEET
-- ============================================================================
