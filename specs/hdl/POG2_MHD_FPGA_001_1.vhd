library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

--============================================================================
-- POG2-MHD-FPGA-001 Rev 1.0
-- Advanced Magnetohydrodynamic Propulsion Control Substrate
-- Target: Xilinx Zynq UltraScale+ ZU7EV
-- Language: VHDL-2008
-- Tick: 640 ms (250 MHz clock domain)
-- HexagramManager: 64 states x 6 yao lines
-- Electrical Register: 4 states (OFF/ARMED/ACTIVE/SHED)
--============================================================================

package POG2_MHD_TYPES is
    -- -------------------------------------------------------------------------
    -- Clock & Timing Constants
    -- -------------------------------------------------------------------------
    constant CLK_FREQ_HZ        : integer := 250_000_000;
    constant TICK_PERIOD_MS     : integer := 640;
    -- 250 MHz x 0.640 s = 160,000,000 cycles
    constant TICK_CYCLES        : integer := 160_000_000;
    constant SUBTICK_PHASES     : integer := 16;
    constant SUBTICK_CYCLES     : integer := TICK_CYCLES / SUBTICK_PHASES; -- 10,000,000

    -- -------------------------------------------------------------------------
    -- Hexagram & State Space Constants
    -- -------------------------------------------------------------------------
    constant HEXAGRAM_STATES    : integer := 64;
    constant YAO_LINES          : integer := 6;
    constant ELEC_STATES        : integer := 4;
    constant FAULT_STATES       : integer := 46;
    constant NOMINAL_STATES     : integer := 18;

    -- -------------------------------------------------------------------------
    -- Fixed-Point Q16.16 Typedefs
    -- Range: +/- 65535.999985, Resolution: 1.5259e-5
    -- -------------------------------------------------------------------------
    subtype Q16_16_T is signed(31 downto 0);
    constant Q16_16_ZERO      : Q16_16_T := to_signed(0, 32);
    constant Q16_16_ONE       : Q16_16_T := to_signed(65536, 32);
    constant Q16_16_HALF      : Q16_16_T := to_signed(32768, 32);

    -- -------------------------------------------------------------------------
    -- Sensor & Actuator Channel Counts
    -- -------------------------------------------------------------------------
    constant N_CONTACTORS       : integer := 10;   -- 5 segments x 2 poles
    constant N_CHOKES           : integer := 5;    -- 5 segment membranes
    constant N_TEMP             : integer := 16;   -- electrode grid + bus bar
    constant N_PRESSURE         : integer := 4;    -- plenum + salt bellows
    constant N_CURRENT_VOLT     : integer := 2;    -- bus current + bus voltage
    constant N_SIC_GATES        : integer := 5;    -- 5 segment half-bridges

    -- -------------------------------------------------------------------------
    -- Choke & Acoustic Constants
    -- -------------------------------------------------------------------------
    constant CHOKE_PWM_FREQ_HZ  : integer := 6_500;
    constant CHOKE_PWM_PERIOD   : integer := CLK_FREQ_HZ / CHOKE_PWM_FREQ_HZ; -- ~38,462

    -- -------------------------------------------------------------------------
    -- Thermal & Safety Thresholds (Q16.16 physical units)
    -- -------------------------------------------------------------------------
    constant T_CRIT_LIMIT_K     : Q16_16_T := to_signed(320 * 65536, 32);   -- 320 K
    constant T_SALT_START_K     : Q16_16_T := to_signed(305 * 65536, 32);   -- 305 K
    constant T_SALT_RESET_K     : Q16_16_T := to_signed(280 * 65536, 32);   -- 280 K
    constant P_PLENUM_TARGET    : Q16_16_T := to_signed(1.3 * 65536, 32);  -- 1.3 atm
    constant P_PLENUM_TOLERANCE : Q16_16_T := to_signed(0.05 * 65536, 32); -- +/- 0.05 atm
    constant I_BUS_MAX_A        : Q16_16_T := to_signed(2000 * 65536, 32);-- 2,000 A hard limit
    constant I_NOMINAL_A        : Q16_16_T := to_signed(1880 * 65536, 32);-- 1,880 A nominal

    -- -------------------------------------------------------------------------
    -- Hexagram State Encodings (6-bit yao vectors)
    -- -------------------------------------------------------------------------
    subtype HEXAGRAM_T is unsigned(5 downto 0);
    constant HEX_IDLE           : HEXAGRAM_T := "000000"; -- 0
    constant HEX_STEALTH        : HEXAGRAM_T := "110100"; -- 52
    constant HEX_TRANSIT        : HEXAGRAM_T := "111000"; -- 56
    constant HEX_TR_SALT        : HEXAGRAM_T := "111010"; -- 58
    constant HEX_TR_CRIT        : HEXAGRAM_T := "111011"; -- 59
    constant HEX_LIMP_MODE      : HEXAGRAM_T := "111001"; -- 57
    constant HEX_PURGE          : HEXAGRAM_T := "001001"; -- 9

    -- -------------------------------------------------------------------------
    -- Electrical State Encoding
    -- -------------------------------------------------------------------------
    subtype ELECTRICAL_REG_T is unsigned(1 downto 0);
    constant ELEC_OFF           : ELECTRICAL_REG_T := "00";
    constant ELEC_ARMED         : ELECTRICAL_REG_T := "01";
    constant ELEC_ACTIVE        : ELECTRICAL_REG_T := "10";
    constant ELEC_SHED          : ELECTRICAL_REG_T := "11";

    -- -------------------------------------------------------------------------
    -- Array Types
    -- -------------------------------------------------------------------------
    type TEMP_ARRAY_T           is array (0 to N_TEMP-1) of unsigned(15 downto 0);
    type PRESSURE_ARRAY_T       is array (0 to N_PRESSURE-1) of unsigned(15 downto 0);
    type CV_ARRAY_T             is array (0 to N_CURRENT_VOLT-1) of unsigned(15 downto 0);
    type CONTACTOR_CMD_T        is array (0 to N_CONTACTORS-1) of std_logic;
    type CONTACTOR_FB_T         is array (0 to N_CONTACTORS-1) of std_logic;
    type CHOKE_PWM_T            is array (0 to N_CHOKES-1) of std_logic;
    type SIC_GATE_T             is array (0 to N_SIC_GATES-1) of std_logic;

    -- -------------------------------------------------------------------------
    -- AXI4-Lite Constants
    -- -------------------------------------------------------------------------
    constant AXI_ADDR_WIDTH     : integer := 16;
    constant AXI_DATA_WIDTH     : integer := 32;
    constant AXI_STRB_WIDTH     : integer := AXI_DATA_WIDTH / 8;

    -- AXI Response Codes
    constant AXI_RESP_OKAY      : std_logic_vector(1 downto 0) := "00";
    constant AXI_RESP_SLVERR    : std_logic_vector(1 downto 0) := "10";

    -- Register Map Offsets (16-bit word addressable)
    constant REG_HEXAGRAM_STATE : std_logic_vector(15 downto 0) := x"0000";
    constant REG_ELEC_STATE     : std_logic_vector(15 downto 0) := x"0004";
    constant REG_FAULT_FLAGS    : std_logic_vector(15 downto 0) := x"0008";
    constant REG_TEMP_THRESH    : std_logic_vector(15 downto 0) := x"000C";
    constant REG_CRIT_TIMEOUT   : std_logic_vector(15 downto 0) := x"0010";
    constant REG_GHOST_ORDER    : std_logic_vector(15 downto 0) := x"0014";
    constant REG_PRED_TEMP      : std_logic_vector(15 downto 0) := x"0018";
    constant REG_DECOHERENCE    : std_logic_vector(15 downto 0) := x"001C";
    constant REG_CONTACTOR_MAP  : std_logic_vector(15 downto 0) := x"0020";
    constant REG_CHOKE_PHASE    : std_logic_vector(15 downto 0) := x"0024";
    constant REG_SAFETY_STATUS  : std_logic_vector(15 downto 0) := x"0028";
    constant REG_TELEM_RATE     : std_logic_vector(15 downto 0) := x"002C";
    constant REG_BOOT_SEQ       : std_logic_vector(15 downto 0) := x"0030";
    constant REG_IMU_STATUS     : std_logic_vector(15 downto 0) := x"0034";
    constant REG_VERSION        : std_logic_vector(15 downto 0) := x"00FC";

    constant FPGA_VERSION       : std_logic_vector(31 downto 0) := x"01000000"; -- Rev 1.0.0

end package POG2_MHD_TYPES;

--============================================================================
-- Top-Level Entity
--============================================================================
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use work.POG2_MHD_TYPES.all;

entity POG2_MHD_FPGA_001 is
    port (
        -- -------------------------------------------------------------------
        -- Global Clock & Reset (Active Low)
        -- -------------------------------------------------------------------
        clk_250m            : in  std_logic;
        reset_n             : in  std_logic;

        -- -------------------------------------------------------------------
        -- IMU Interface (6-Axis, I2C + Hardware Interrupt)
        -- -------------------------------------------------------------------
        imu_irq             : in  std_logic;
        imu_scl             : inout std_logic;
        imu_sda             : inout std_logic;

        -- -------------------------------------------------------------------
        -- Sensor Acquisition SPI (Time-Division Multiplexed)
        -- 16x Temp (RTD/TC) + 4x Pressure + 2x Current/Voltage
        -- -------------------------------------------------------------------
        sensor_spi_clk      : out std_logic;
        sensor_spi_mosi     : out std_logic;
        sensor_spi_miso     : in  std_logic;
        sensor_spi_cs_n     : out std_logic_vector(3 downto 0);

        -- -------------------------------------------------------------------
        -- Contactor Drive & Feedback (10 channels, 5 segments x 2 poles)
        -- 5kV DC / 1,880 A rated, arc-suppressed sequencing
        -- -------------------------------------------------------------------
        contactor_cmd       : out std_logic_vector(N_CONTACTORS-1 downto 0);
        contactor_fb        : in  std_logic_vector(N_CONTACTORS-1 downto 0);
        contactor_precharge : out std_logic_vector(N_CONTACTORS-1 downto 0);

        -- -------------------------------------------------------------------
        -- Choke Membrane Drivers (5 channels, 6.5 kHz resonant PWM)
        -- Phase-shifted to prevent acoustic beating
        -- -------------------------------------------------------------------
        choke_pwm           : out std_logic_vector(N_CHOKES-1 downto 0);
        choke_sync          : out std_logic_vector(N_CHOKES-1 downto 0);

        -- -------------------------------------------------------------------
        -- SiC MOSFET Half-Bridge Gate Drives (5 segments)
        -- -------------------------------------------------------------------
        sic_gate_h          : out std_logic_vector(N_SIC_GATES-1 downto 0);
        sic_gate_l          : out std_logic_vector(N_SIC_GATES-1 downto 0);
        sic_fault_n         : in  std_logic_vector(N_SIC_GATES-1 downto 0);

        -- -------------------------------------------------------------------
        -- Telemetry UART (115200 baud, 8-N-1)
        -- 64-bit packet: hexagram + electrical + fault + temp + pressure
        -- -------------------------------------------------------------------
        telemetry_tx        : out std_logic;
        telemetry_rx        : in  std_logic;

        -- -------------------------------------------------------------------
        -- AXI4-Lite Slave Interface (ARM PS <-> PL Register Map)
        -- Address Width: 16-bit, Data Width: 32-bit
        -- -------------------------------------------------------------------
        s_axi_aclk          : in  std_logic;
        s_axi_aresetn       : in  std_logic;
        -- Write Address Channel
        s_axi_awaddr        : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
        s_axi_awvalid       : in  std_logic;
        s_axi_awready       : out std_logic;
        -- Write Data Channel
        s_axi_wdata         : in  std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
        s_axi_wstrb         : in  std_logic_vector(AXI_STRB_WIDTH-1 downto 0);
        s_axi_wvalid        : in  std_logic;
        s_axi_wready        : out std_logic;
        -- Write Response Channel
        s_axi_bresp         : out std_logic_vector(1 downto 0);
        s_axi_bvalid        : out std_logic;
        s_axi_bready        : in  std_logic;
        -- Read Address Channel
        s_axi_araddr        : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
        s_axi_arvalid       : in  std_logic;
        s_axi_arready       : out std_logic;
        -- Read Data Channel
        s_axi_rdata         : out std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
        s_axi_rresp         : out std_logic_vector(1 downto 0);
        s_axi_rvalid        : out std_logic;
        s_axi_rready        : in  std_logic
    );
end entity POG2_MHD_FPGA_001;

--============================================================================
-- Structural Architecture
--============================================================================
architecture structural of POG2_MHD_FPGA_001 is

    -- -----------------------------------------------------------------------
    -- Component Declarations (Sub-Modules — to be implemented separately)
    -- -----------------------------------------------------------------------
    component HEXAGRAM_STATE_MACHINE is
        port (
            clk             : in  std_logic;
            reset_n         : in  std_logic;
            tick_strobe     : in  std_logic;
            electrical_reg  : in  ELECTRICAL_REG_T;
            safety_ok       : in  std_logic;
            hexagram_state  : out HEXAGRAM_T;
            fault_flags     : out std_logic_vector(FAULT_STATES-1 downto 0);
            state_valid     : out std_logic
        );
    end component HEXAGRAM_STATE_MACHINE;

    component GHOSTSPLAT_PREDICTOR is
        port (
            clk             : in  std_logic;
            reset_n         : in  std_logic;
            tick_strobe     : in  std_logic;
            hexagram_state  : in  HEXAGRAM_T;
            electrical_reg  : in  ELECTRICAL_REG_T;
            temp_array      : in  TEMP_ARRAY_T;
            pressure_array  : in  PRESSURE_ARRAY_T;
            cv_array        : in  CV_ARRAY_T;
            predicted_temp  : out Q16_16_T;
            taylor_order    : out unsigned(2 downto 0);
            prediction_valid: out std_logic;
            decoherence_rate: out Q16_16_T
        );
    end component GHOSTSPLAT_PREDICTOR;

    component CONTACTOR_SEQUENCER is
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
    end component CONTACTOR_SEQUENCER;

    component CHOKE_DRIVER is
        port (
            clk             : in  std_logic;
            reset_n         : in  std_logic;
            choke_enable    : in  std_logic_vector(N_CHOKES-1 downto 0);
            choke_pwm       : out std_logic_vector(N_CHOKES-1 downto 0);
            choke_sync      : out std_logic_vector(N_CHOKES-1 downto 0);
            pwm_locked      : out std_logic
        );
    end component CHOKE_DRIVER;

    component SENSOR_ACQUISITION is
        port (
            clk             : in  std_logic;
            reset_n         : in  std_logic;
            acquire_strobe  : in  std_logic;
            spi_clk         : out std_logic;
            spi_mosi        : out std_logic;
            spi_miso        : in  std_logic;
            spi_cs_n        : out std_logic_vector(3 downto 0);
            temp_array      : out TEMP_ARRAY_T;
            pressure_array  : out PRESSURE_ARRAY_T;
            cv_array        : out CV_ARRAY_T;
            data_valid      : out std_logic;
            acquisition_time: out unsigned(15 downto 0)
        );
    end component SENSOR_ACQUISITION;

    component TELEMETRY_ENCODER is
        port (
            clk             : in  std_logic;
            reset_n         : in  std_logic;
            tick_strobe     : in  std_logic;
            hexagram_state  : in  HEXAGRAM_T;
            electrical_reg  : in  ELECTRICAL_REG_T;
            fault_flags     : in  std_logic_vector(FAULT_STATES-1 downto 0);
            temp_array      : in  TEMP_ARRAY_T;
            pressure_array  : in  PRESSURE_ARRAY_T;
            predicted_temp  : in  Q16_16_T;
            taylor_order    : in  unsigned(2 downto 0);
            uart_tx         : out std_logic;
            packet_sent     : out std_logic
        );
    end component TELEMETRY_ENCODER;

    component AXI4_LITE_SLAVE is
        port (
            aclk            : in  std_logic;
            aresetn         : in  std_logic;
            awaddr          : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
            awvalid         : in  std_logic;
            awready         : out std_logic;
            wdata           : in  std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
            wstrb           : in  std_logic_vector(AXI_STRB_WIDTH-1 downto 0);
            wvalid          : in  std_logic;
            wready          : out std_logic;
            bresp           : out std_logic_vector(1 downto 0);
            bvalid          : out std_logic;
            bready          : in  std_logic;
            araddr          : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
            arvalid         : in  std_logic;
            arready         : out std_logic;
            rdata           : out std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
            rresp           : out std_logic_vector(1 downto 0);
            rvalid          : out std_logic;
            rready          : in  std_logic;
            -- Register Interface
            reg_hex_state   : out HEXAGRAM_T;
            reg_elec_state  : out ELECTRICAL_REG_T;
            reg_fault_mask  : out std_logic_vector(FAULT_STATES-1 downto 0);
            reg_temp_thresh : out Q16_16_T;
            reg_crit_timeout: out unsigned(15 downto 0);
            reg_telem_rate  : out unsigned(15 downto 0);
            reg_safety_override : out std_logic;
            reg_read_hex    : in  HEXAGRAM_T;
            reg_read_elec   : in  ELECTRICAL_REG_T;
            reg_read_fault  : in  std_logic_vector(FAULT_STATES-1 downto 0);
            reg_read_temp   : in  Q16_16_T;
            reg_read_pred   : in  Q16_16_T;
            reg_read_decoh  : in  Q16_16_T;
            reg_read_safety : in  std_logic_vector(7 downto 0);
            reg_read_version: in  std_logic_vector(31 downto 0)
        );
    end component AXI4_LITE_SLAVE;

    -- -----------------------------------------------------------------------
    -- Internal Signals
    -- -----------------------------------------------------------------------
    signal tick_counter     : unsigned(31 downto 0) := (others => '0');
    signal tick_strobe      : std_logic := '0';
    signal subtick_phase    : unsigned(3 downto 0) := (others => '0');
    signal subtick_strobe   : std_logic := '0';

    -- Synchronized reset
    signal reset_sync       : std_logic := '0';

    -- IMU Interrupt Handling
    signal imu_irq_sync     : std_logic := '0';
    signal imu_irq_latched  : std_logic := '0';
    signal imu_irq_clear    : std_logic := '0';
    signal decoherence_spike: std_logic := '0';

    -- Hexagram & Electrical State
    signal hexagram_state   : HEXAGRAM_T := HEX_IDLE;
    signal hexagram_next    : HEXAGRAM_T := HEX_IDLE;
    signal electrical_reg   : ELECTRICAL_REG_T := ELEC_OFF;
    signal electrical_next  : ELECTRICAL_REG_T := ELEC_OFF;
    signal fault_flags      : std_logic_vector(FAULT_STATES-1 downto 0) := (others => '0');

    -- Safety Interlocks
    signal safety_thermal   : std_logic := '0';
    signal safety_current   : std_logic := '0';
    signal safety_pressure  : std_logic := '0';
    signal safety_sic       : std_logic := '0';
    signal safety_ok        : std_logic := '0';
    signal safety_status    : std_logic_vector(7 downto 0) := (others => '0');

    -- Sensor Data
    signal temp_array       : TEMP_ARRAY_T := (others => (others => '0'));
    signal pressure_array   : PRESSURE_ARRAY_T := (others => (others => '0'));
    signal cv_array         : CV_ARRAY_T := (others => (others => '0'));
    signal sensor_valid     : std_logic := '0';

    -- GhostSplat Prediction
    signal predicted_temp   : Q16_16_T := Q16_16_ZERO;
    signal taylor_order     : unsigned(2 downto 0) := (others => '0');
    signal prediction_valid : std_logic := '0';
    signal decoherence_rate : Q16_16_T := Q16_16_ZERO;

    -- Contactor Sequencing
    signal contactor_cmd_int    : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');
    signal contactor_pre_int    : std_logic_vector(N_CONTACTORS-1 downto 0) := (others => '0');
    signal sequence_done      : std_logic := '0';
    signal arc_fault          : std_logic := '0';

    -- Choke Control
    signal choke_enable       : std_logic_vector(N_CHOKES-1 downto 0) := (others => '0');
    signal pwm_locked         : std_logic := '0';

    -- Telemetry
    signal packet_sent        : std_logic := '0';

    -- AXI Register Interface
    signal reg_hex_state_wr   : HEXAGRAM_T := HEX_IDLE;
    signal reg_elec_state_wr  : ELECTRICAL_REG_T := ELEC_OFF;
    signal reg_fault_mask     : std_logic_vector(FAULT_STATES-1 downto 0) := (others => '0');
    signal reg_temp_thresh    : Q16_16_T := T_SALT_START_K;
    signal reg_crit_timeout   : unsigned(15 downto 0) := to_unsigned(47, 16);
    signal reg_telem_rate     : unsigned(15 downto 0) := to_unsigned(11520, 16); -- 115200 / 10
    signal reg_safety_override: std_logic := '0';

    -- Boot Sequence State Machine
    type BOOT_STATE_T is (BOOT_DARK_IRON, BOOT_POWER_WAKE, BOOT_SALT_CHARGE,
                          BOOT_PLENUM_RISE, BOOT_DEGAUSS, BOOT_CHANNEL_PRIME,
                          BOOT_STEALTH_IDLE);
    signal boot_state         : BOOT_STATE_T := BOOT_DARK_IRON;
    signal boot_counter       : unsigned(31 downto 0) := (others => '0');
    signal boot_complete      : std_logic := '0';
    constant BOOT_DARK_IRON_CYCLES  : integer := 1;       -- 0s (immediate)
    constant BOOT_POWER_WAKE_CYCLES : integer := 47;       -- 30 ms @ 640ms tick? No, subtick based
    -- Boot timing managed in subtick phases; see process below

    -- CRIT Timeout Counter
    signal crit_tick_counter  : unsigned(7 downto 0) := (others => '0');
    signal crit_timeout_reached : std_logic := '0';

    -- Electrical Register Constraint Matrix (Intent -> Capability)
    -- Pure combinational mapping with safety override
    pure function map_electrical(
        hex       : HEXAGRAM_T;
        safety_ok : std_logic;
        override  : std_logic
    ) return ELECTRICAL_REG_T is
        variable result : ELECTRICAL_REG_T;
    begin
        if override = '1' then
            -- Safety override: force OFF regardless of intent
            return ELEC_OFF;
        end if;

        case hex is
            when HEX_IDLE       => result := ELEC_OFF;
            when HEX_PURGE      => result := ELEC_OFF;
            when HEX_STEALTH    => result := ELEC_ARMED;
            when HEX_TRANSIT    =>
                if safety_ok = '1' then
                    result := ELEC_ACTIVE;
                else
                    result := ELEC_SHED;
                end if;
            when HEX_TR_SALT    =>
                if safety_ok = '1' then
                    result := ELEC_ACTIVE;
                else
                    result := ELEC_SHED;
                end if;
            when HEX_TR_CRIT    =>
                if safety_ok = '1' then
                    result := ELEC_ACTIVE;
                else
                    result := ELEC_SHED;
                end if;
            when HEX_LIMP_MODE  => result := ELEC_SHED;
            when others         => result := ELEC_OFF;
        end case;
        return result;
    end function map_electrical;

    -- Checkerboard pattern generator for LIMP_MODE
    pure function checkerboard_shed(
        hex : HEXAGRAM_T;
        elec : ELECTRICAL_REG_T
    ) return std_logic_vector is
        variable mask : std_logic_vector(N_CONTACTORS-1 downto 0);
    begin
        if elec = ELEC_SHED and hex = HEX_LIMP_MODE then
            -- Segments 2 and 4 shed (0-indexed: segments 1 and 3)
            -- 5 segments x 2 poles = 10 contactors
            -- Segment 0 (poles 0,1): ON
            -- Segment 1 (poles 2,3): OFF (shed)
            -- Segment 2 (poles 4,5): ON
            -- Segment 3 (poles 6,7): OFF (shed)
            -- Segment 4 (poles 8,9): ON
            mask := "1100110011";
        else
            mask := (others => '1');
        end if;
        return mask;
    end function checkerboard_shed;

begin

    -- =====================================================================
    -- Reset Synchronizer (250 MHz domain)
    -- =====================================================================
    process(clk_250m)
        variable rst_pipe : std_logic_vector(2 downto 0) := "000";
    begin
        if rising_edge(clk_250m) then
            rst_pipe := rst_pipe(1 downto 0) & reset_n;
            reset_sync <= rst_pipe(2);
        end if;
    end process;

    -- =====================================================================
    -- 640 ms Tick Generator with 16 Sub-Tick Phases
    -- =====================================================================
    process(clk_250m)
    begin
        if rising_edge(clk_250m) then
            if reset_sync = '0' then
                tick_counter <= (others => '0');
                tick_strobe <= '0';
                subtick_phase <= (others => '0');
                subtick_strobe <= '0';
            else
                tick_strobe <= '0';
                subtick_strobe <= '0';

                if tick_counter = to_unsigned(TICK_CYCLES - 1, 32) then
                    tick_counter <= (others => '0');
                    tick_strobe <= '1';
                    subtick_phase <= (others => '0');
                else
                    tick_counter <= tick_counter + 1;
                    -- Sub-tick strobe every SUBTICK_CYCLES
                    if (tick_counter mod SUBTICK_CYCLES) = (SUBTICK_CYCLES - 1) then
                        subtick_strobe <= '1';
                        subtick_phase <= subtick_phase + 1;
                    end if;
                end if;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- IMU Interrupt Synchronizer & Decoherence Spike Detection
    -- Hardware latency < 1 us (2-3 clock cycles at 250 MHz)
    -- =====================================================================
    process(clk_250m)
        variable irq_pipe : std_logic_vector(2 downto 0) := "000";
        variable irq_edge : std_logic := '0';
    begin
        if rising_edge(clk_250m) then
            if reset_sync = '0' then
                irq_pipe := "000";
                imu_irq_sync <= '0';
                imu_irq_latched <= '0';
                decoherence_spike <= '0';
            else
                irq_pipe := irq_pipe(1 downto 0) & imu_irq;
                irq_edge := irq_pipe(1) and not irq_pipe(2);
                imu_irq_sync <= irq_pipe(2);

                if irq_edge = '1' then
                    imu_irq_latched <= '1';
                    -- Detect high-G maneuver: immediate decoherence spike
                    -- Forces GhostSplat to truncate horizon and commit to LIMP
                    decoherence_spike <= '1';
                end if;

                if imu_irq_clear = '1' then
                    imu_irq_latched <= '0';
                    decoherence_spike <= '0';
                end if;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- Safety Interlocks (Combinatorial, Hard Real-Time)
    -- Thermal: Bus bar < 320 K (T_CRIT_LIMIT)
    -- Current: < 2,000 A (I_BUS_MAX)
    -- Pressure: 1.3 +/- 0.05 atm
    -- SiC: No fault asserted (sic_fault_n all high)
    -- =====================================================================
    process(temp_array, cv_array, pressure_array, sic_fault_n, reg_safety_override)
        variable temp_max     : unsigned(15 downto 0);
        variable pressure_avg : unsigned(17 downto 0);
        variable current_val  : unsigned(15 downto 0);
    begin
        -- Thermal: max over 16 channels
        temp_max := (others => '0');
        for i in 0 to N_TEMP-1 loop
            if temp_array(i) > temp_max then
                temp_max := temp_array(i);
            end if;
        end loop;
        -- Compare to 320 K (scaled to ADC counts; assume 0.01 K/LSB => 32000)
        if temp_max > to_unsigned(32000, 16) then
            safety_thermal <= '0';  -- FAIL
        else
            safety_thermal <= '1';  -- OK
        end if;

        -- Current: bus current on channel 0
        current_val := cv_array(0);
        if current_val > to_unsigned(20000, 16) then  -- 2000 A @ 0.1 A/LSB
            safety_current <= '0';  -- FAIL
        else
            safety_current <= '1';  -- OK
        end if;

        -- Pressure: average of 4 channels, compare to 1.3 atm
        pressure_avg := resize(pressure_array(0), 18) + resize(pressure_array(1), 18)
                      + resize(pressure_array(2), 18) + resize(pressure_array(3), 18);
        -- 1.3 atm +/- 0.05 => 1.25 to 1.35. Assume 0.001 atm/LSB => 1300 +/- 50
        if pressure_avg > to_unsigned(4 * 1250, 18) and
           pressure_avg < to_unsigned(4 * 1350, 18) then
            safety_pressure <= '1';  -- OK
        else
            safety_pressure <= '0';  -- FAIL
        end if;

        -- SiC Gate Drive Faults (active low)
        if sic_fault_n = (sic_fault_n'range => '1') then
            safety_sic <= '1';
        else
            safety_sic <= '0';
        end if;

        -- Aggregate (override wins)
        if reg_safety_override = '1' then
            safety_ok <= '1';
        else
            safety_ok <= safety_thermal and safety_current and safety_pressure and safety_sic;
        end if;

        -- Status vector for telemetry/AXI
        safety_status <= safety_thermal & safety_current & safety_pressure & safety_sic
                       & safety_ok & arc_fault & crit_timeout_reached & boot_complete;
    end process;

    -- =====================================================================
    -- Boot Sequence State Machine (Phase-Mapped to Sub-Ticks)
    -- =====================================================================
    process(clk_250m)
    begin
        if rising_edge(clk_250m) then
            if reset_sync = '0' then
                boot_state <= BOOT_DARK_IRON;
                boot_counter <= (others => '0');
                boot_complete <= '0';
            else
                case boot_state is
                    when BOOT_DARK_IRON =>
                        -- Phase 0: 0 ms. All contactors open, dark start.
                        if subtick_strobe = '1' and subtick_phase = 0 then
                            boot_state <= BOOT_POWER_WAKE;
                        end if;

                    when BOOT_POWER_WAKE =>
                        -- Phase 1-2: 0-80 ms. Gate drives enabled, bus pre-charge.
                        if subtick_strobe = '1' and subtick_phase = 2 then
                            boot_state <= BOOT_SALT_CHARGE;
                        end if;

                    when BOOT_SALT_CHARGE =>
                        -- Phase 3-5: 80-240 ms. Salt hydrate bellows pre-charge.
                        if subtick_strobe = '1' and subtick_phase = 5 then
                            boot_state <= BOOT_PLENUM_RISE;
                        end if;

                    when BOOT_PLENUM_RISE =>
                        -- Phase 6-9: 240-480 ms. Dry ice plenum pressurization.
                        if subtick_strobe = '1' and subtick_phase = 9 then
                            boot_state <= BOOT_DEGAUSS;
                        end if;

                    when BOOT_DEGAUSS =>
                        -- Phase 10-12: 480-640 ms. 60 Hz decaying AC through degauss coils.
                        if subtick_strobe = '1' and subtick_phase = 12 then
                            boot_state <= BOOT_CHANNEL_PRIME;
                        end if;

                    when BOOT_CHANNEL_PRIME =>
                        -- Phase 13-14: 640-800 ms. 100V/10A continuity check, 15% choke.
                        if subtick_strobe = '1' and subtick_phase = 14 then
                            boot_state <= BOOT_STEALTH_IDLE;
                        end if;

                    when BOOT_STEALTH_IDLE =>
                        -- Phase 15: 800-960 ms. Armed, ready for STEALTH.
                        boot_complete <= '1';
                        -- Hold state until reset

                    when others =>
                        boot_state <= BOOT_DARK_IRON;
                end case;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- CRIT Timeout Counter (47 ticks = 30.1 s hard deadline)
    -- =====================================================================
    process(clk_250m)
    begin
        if rising_edge(clk_250m) then
            if reset_sync = '0' then
                crit_tick_counter <= (others => '0');
                crit_timeout_reached <= '0';
            else
                if tick_strobe = '1' then
                    if hexagram_state = HEX_TR_CRIT then
                        if crit_tick_counter = reg_crit_timeout then
                            crit_timeout_reached <= '1';
                        else
                            crit_tick_counter <= crit_tick_counter + 1;
                        end if;
                    else
                        crit_tick_counter <= (others => '0');
                        crit_timeout_reached <= '0';
                    end if;
                end if;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- Electrical Register FSM
    -- Maps hexagram intent -> electrical capability via constraint matrix
    -- =====================================================================
    process(clk_250m)
        variable shed_mask : std_logic_vector(N_CONTACTORS-1 downto 0);
    begin
        if rising_edge(clk_250m) then
            if reset_sync = '0' then
                electrical_reg <= ELEC_OFF;
                hexagram_state <= HEX_IDLE;
            else
                if tick_strobe = '1' then
                    -- GhostSplat deliberation window: hold superposition
                    -- If decoherence spike, force collapse to LIMP
                    if decoherence_spike = '1' or crit_timeout_reached = '1' then
                        hexagram_state <= HEX_LIMP_MODE;
                        electrical_reg <= ELEC_SHED;
                    else
                        -- Normal commit: evaluate next state from HexagramManager
                        -- (In full implementation, hexagram_next comes from HEXAGRAM_STATE_MACHINE)
                        hexagram_state <= hexagram_next;
                        electrical_reg <= electrical_next;
                    end if;
                end if;
            end if;
        end if;
    end process;

    -- Combinational next-state logic (constraint matrix)
    hexagram_next <= hexagram_state when prediction_valid = '0' else
                     reg_hex_state_wr when reg_safety_override = '1' else
                     HEX_LIMP_MODE when crit_timeout_reached = '1' else
                     HEX_IDLE;  -- Default fallback, overridden by sub-module

    electrical_next <= map_electrical(hexagram_next, safety_ok, reg_safety_override);

    -- =====================================================================
    -- Choke Enable Logic
    -- Enabled during STEALTH, TRANSIT, TR_SALT, TR_CRIT
    -- Disabled during IDLE, PURGE, LIMP_MODE (reduced to 3 segments in LIMP)
    -- =====================================================================
    process(hexagram_state, electrical_reg)
        variable enable_vec : std_logic_vector(N_CHOKES-1 downto 0);
    begin
        case hexagram_state is
            when HEX_STEALTH | HEX_TRANSIT | HEX_TR_SALT | HEX_TR_CRIT =>
                enable_vec := (others => '1');
            when HEX_LIMP_MODE =>
                -- Checkerboard: segments 0,2,4 active; 1,3 shed
                enable_vec := "10101";
            when others =>
                enable_vec := (others => '0');
        end case;
        choke_enable <= enable_vec;
    end process;

    -- =====================================================================
    -- SiC Gate Drive Logic (5 half-bridges)
    -- High-side ON only when electrical_reg = ACTIVE and safety_ok
    -- Low-side ON for freewheeling during PWM off-time
    -- All OFF during OFF, ARMED, or SHED (contactors handle shedding)
    -- =====================================================================
    process(electrical_reg, safety_ok, hexagram_state, boot_state)
        variable gate_h_vec : std_logic_vector(N_SIC_GATES-1 downto 0);
        variable gate_l_vec : std_logic_vector(N_SIC_GATES-1 downto 0);
    begin
        if boot_state /= BOOT_STEALTH_IDLE then
            gate_h_vec := (others => '0');
            gate_l_vec := (others => '0');
        elsif electrical_reg = ELEC_ACTIVE and safety_ok = '1' then
            gate_h_vec := (others => '1');
            gate_l_vec := (others => '0');
        elsif electrical_reg = ELEC_SHED then
            -- LIMP mode: checkerboard pattern matches contactors
            gate_h_vec := "10101";
            gate_l_vec := not gate_h_vec;
        else
            gate_h_vec := (others => '0');
            gate_l_vec := (others => '0');
        end if;
        sic_gate_h <= gate_h_vec;
        sic_gate_l <= gate_l_vec;
    end process;

    -- =====================================================================
    -- Sub-Module Instantiations
    -- =====================================================================

    -- 1. Hexagram State Machine (64-state CSR sparse matrix + constraint masking)
    u_hexagram : HEXAGRAM_STATE_MACHINE
        port map (
            clk             => clk_250m,
            reset_n         => reset_sync,
            tick_strobe     => tick_strobe,
            electrical_reg  => electrical_reg,
            safety_ok       => safety_ok,
            hexagram_state  => hexagram_next,  -- Feedback loop for deliberation
            fault_flags     => fault_flags,
            state_valid     => open
        );

    -- 2. GhostSplat Predictor (Adaptive Taylor expansion, Q16.16, 1.92 s horizon)
    u_ghostsplat : GHOSTSPLAT_PREDICTOR
        port map (
            clk             => clk_250m,
            reset_n         => reset_sync,
            tick_strobe     => tick_strobe,
            hexagram_state  => hexagram_state,
            electrical_reg  => electrical_reg,
            temp_array      => temp_array,
            pressure_array  => pressure_array,
            cv_array        => cv_array,
            predicted_temp  => predicted_temp,
            taylor_order    => taylor_order,
            prediction_valid=> prediction_valid,
            decoherence_rate=> decoherence_rate
        );

    -- 3. Contactor Sequencer (10 ch, 6-state arc suppression, 80 ms budget)
    u_contactor : CONTACTOR_SEQUENCER
        port map (
            clk             => clk_250m,
            reset_n         => reset_sync,
            tick_strobe     => tick_strobe,
            electrical_cmd  => electrical_reg,
            hexagram_state  => hexagram_state,
            safety_ok       => safety_ok,
            contactor_cmd   => contactor_cmd_int,
            contactor_pre   => contactor_pre_int,
            contactor_fb    => contactor_fb,
            sequence_done   => sequence_done,
            arc_fault       => arc_fault
        );

    -- Apply checkerboard mask for LIMP_MODE
    contactor_cmd <= contactor_cmd_int and checkerboard_shed(hexagram_state, electrical_reg);
    contactor_precharge <= contactor_pre_int;

    -- 4. Choke Driver (5 ch, 6.5 kHz PLL, phase-shifted PWM)
    u_choke : CHOKE_DRIVER
        port map (
            clk             => clk_250m,
            reset_n         => reset_sync,
            choke_enable    => choke_enable,
            choke_pwm       => choke_pwm,
            choke_sync      => choke_sync,
            pwm_locked      => pwm_locked
        );

    -- 5. Sensor Acquisition (TDM SPI, 24-bit ADC, median filter)
    u_sensor : SENSOR_ACQUISITION
        port map (
            clk             => clk_250m,
            reset_n         => reset_sync,
            acquire_strobe  => subtick_strobe,
            spi_clk         => sensor_spi_clk,
            spi_mosi        => sensor_spi_mosi,
            spi_miso        => sensor_spi_miso,
            spi_cs_n        => sensor_spi_cs_n,
            temp_array      => temp_array,
            pressure_array  => pressure_array,
            cv_array        => cv_array,
            data_valid      => sensor_valid,
            acquisition_time=> open
        );

    -- 6. Telemetry Encoder (64-bit packet, UART 115200)
    u_telemetry : TELEMETRY_ENCODER
        port map (
            clk             => clk_250m,
            reset_n         => reset_sync,
            tick_strobe     => tick_strobe,
            hexagram_state  => hexagram_state,
            electrical_reg  => electrical_reg,
            fault_flags     => fault_flags,
            temp_array      => temp_array,
            pressure_array  => pressure_array,
            predicted_temp  => predicted_temp,
            taylor_order    => taylor_order,
            uart_tx         => telemetry_tx,
            packet_sent     => packet_sent
        );

    -- 7. AXI4-Lite Slave (Register decode, R/W state machine)
    u_axi_slave : AXI4_LITE_SLAVE
        port map (
            aclk            => s_axi_aclk,
            aresetn         => s_axi_aresetn,
            awaddr          => s_axi_awaddr,
            awvalid         => s_axi_awvalid,
            awready         => s_axi_awready,
            wdata           => s_axi_wdata,
            wstrb           => s_axi_wstrb,
            wvalid          => s_axi_wvalid,
            wready          => s_axi_wready,
            bresp           => s_axi_bresp,
            bvalid          => s_axi_bvalid,
            bready          => s_axi_bready,
            araddr          => s_axi_araddr,
            arvalid         => s_axi_arvalid,
            arready         => s_axi_arready,
            rdata           => s_axi_rdata,
            rresp           => s_axi_rresp,
            rvalid          => s_axi_rvalid,
            rready          => s_axi_rready,
            -- Register Write Interface
            reg_hex_state   => reg_hex_state_wr,
            reg_elec_state  => reg_elec_state_wr,
            reg_fault_mask  => reg_fault_mask,
            reg_temp_thresh => reg_temp_thresh,
            reg_crit_timeout=> reg_crit_timeout,
            reg_telem_rate  => reg_telem_rate,
            reg_safety_override => reg_safety_override,
            -- Register Read Interface
            reg_read_hex    => hexagram_state,
            reg_read_elec   => electrical_reg,
            reg_read_fault  => fault_flags,
            reg_read_temp   => predicted_temp,
            reg_read_pred   => predicted_temp,
            reg_read_decoh  => decoherence_rate,
            reg_read_safety => safety_status,
            reg_read_version=> FPGA_VERSION
        );

    -- Unused IMU I2C (placeholder for future expansion)
    imu_scl <= 'Z';
    imu_sda <= 'Z';

    -- Unused telemetry RX (placeholder)
    -- telemetry_rx is input only

end architecture structural;

--============================================================================
-- End of POG2-MHD-FPGA-001 Rev 1.0
--============================================================================
