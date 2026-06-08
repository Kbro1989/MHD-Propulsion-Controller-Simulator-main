--------------------------------------------------------------------------------
-- POG2-MHD-FPGA-001.vhd
-- Advanced Magnetohydrodynamic Propulsion Module — Top-Level RTL Skeleton
-- Target: Xilinx Zynq UltraScale+ ZU7EV (XCZU7EV-2FFVC1156E)
-- HDL: VHDL-2008
-- Date: 2026-06-05
-- Status: AUTHORIZED FOR SYNTHESIS
-- Revision: 1.0
--------------------------------------------------------------------------------
-- Architecture: PS (ARM Cortex-A53/R5F) + PL (FPGA Fabric)
-- PS Role: CNSManager host (Python/C++), telemetry logging, D1 event sourcing
-- PL Role: 640 ms deterministic tick, real-time control, safety-critical I/O
-- Communication: AXI4-Lite (PS master, PL slave)
--------------------------------------------------------------------------------

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;
use IEEE.MATH_REAL.ALL;

--------------------------------------------------------------------------------
-- PACKAGE: POG2_MHD_TYPES
-- Shared type definitions for the MHD propulsion system
--------------------------------------------------------------------------------
package POG2_MHD_TYPES is

    -- Clock and timing constants
    constant CLK_FREQ_MHZ      : integer := 250;           -- 250 MHz system clock
    constant CLK_PERIOD_NS     : real    := 4.0;           -- 4.0 ns period
    constant TICK_PERIOD_MS    : integer := 640;           -- 640 ms metabolic tick
    constant TICK_CYCLES       : integer := 160000;       -- 640 ms / 4 ns = 160,000 cycles

    -- State space dimensions
    constant HEXAGRAM_STATES   : integer := 64;           -- 2^6 yao lines
    constant YAO_LINES         : integer := 6;             -- 6 binary control lines
    constant ELECTRICAL_STATES : integer := 4;             -- OFF, ARMED, ACTIVE, SHED
    constant ELECTRICAL_BITS     : integer := 2;             -- 2-bit register

    -- Fixed-point arithmetic (Q16.16 format)
    constant Q_INT_BITS        : integer := 16;            -- Integer part
    constant Q_FRAC_BITS       : integer := 16;            -- Fractional part
    constant Q_TOTAL_BITS      : integer := 32;            -- Total width
    subtype Q16_16_T is signed(Q_TOTAL_BITS-1 downto 0);
    constant Q16_16_ONE        : Q16_16_T := to_signed(65536, Q_TOTAL_BITS);  -- 1.0 in Q16.16

    -- GhostSplat predictor constants
    constant GHOSTSPLAT_HORIZON_TICKS : integer := 3;       -- 3-tick prediction window
    constant GHOSTSPLAT_HORIZON_MS    : integer := 1920;    -- 1.92 seconds
    constant HBAR_EFF_Q16_16          : Q16_16_T := to_signed(1153433600, Q_TOTAL_BITS);  -- 17,600.0 * 65536
    constant TAYLOR_ADAPTIVE_THRESH   : Q16_16_T := to_signed(3277, Q_TOTAL_BITS);       -- 0.05 in Q16.16
    constant MAX_TAYLOR_ORDER         : integer := 5;        -- Maximum expansion order

    -- I/O channel counts
    constant CONTACTOR_CHANNELS       : integer := 10;       -- 5 segments × 2 poles (L/R)
    constant CHOKE_CHANNELS          : integer := 5;         -- 1 per chordwise segment
    constant TEMP_CHANNELS           : integer := 16;        -- 4×4 electrode grid + bus bar
    constant PRESSURE_CHANNELS       : integer := 4;       -- Plenum + salt bellows
    constant CURRENT_CHANNELS         : integer := 2;         -- Bus current + bus voltage
    constant IMU_AXES                 : integer := 6;         -- 3× accel + 3× gyro

    -- Electrical register states (2-bit encoding)
    subtype ELECTRICAL_REG_T is unsigned(1 downto 0);
    constant ELEC_OFF   : ELECTRICAL_REG_T := "00";
    constant ELEC_ARMED : ELECTRICAL_REG_T := "01";
    constant ELEC_ACTIVE: ELECTRICAL_REG_T := "10";
    constant ELEC_SHED  : ELECTRICAL_REG_T := "11";

    -- Hexagram state vector (6-bit yao)
    subtype HEXAGRAM_STATE_T is unsigned(5 downto 0);

    -- Fault state encoding (8-bit, 46 fault/recovery states + 18 nominal)
    subtype FAULT_STATE_T is unsigned(7 downto 0);
    constant FAULT_NONE : FAULT_STATE_T := x"00";

    -- Sensor data types (24-bit ADC raw, scaled to Q16.16)
    subtype SENSOR_RAW_T is signed(23 downto 0);
    subtype SENSOR_SCALED_T is Q16_16_T;

    -- Contactor state machine states
    type CONTACTOR_STATE_T is (CT_CLOSED, CT_OPENING, CT_OPEN, CT_CLOSING, CT_FAULT);

    -- Choke driver states
    type CHOKE_STATE_T is (CH_IDLE, CH_TRACKING, CH_LOCKED, CH_FAULT);

    -- System-wide operational mode
    type SYS_MODE_T is (MODE_IDLE, MODE_STEALTH, MODE_TRANSIT, MODE_LIMP, MODE_PURGE, MODE_EMERGENCY);

    -- Sparse matrix entry for state transition (CSR format)
    type CSR_ENTRY_T is record
        col_idx   : unsigned(5 downto 0);    -- Column index (0-63)
        weight    : unsigned(15 downto 0);     -- 16-bit fixed-point probability (0.0 to 1.0)
    end record;

    -- Array types
    type SENSOR_ARRAY_T is array (0 to 15) of SENSOR_SCALED_T;
    type PRESSURE_ARRAY_T is array (0 to 3) of SENSOR_SCALED_T;
    type CURRENT_ARRAY_T is array (0 to 1) of SENSOR_SCALED_T;
    type IMU_ARRAY_T is array (0 to 5) of SENSOR_SCALED_T;
    type CONTACTOR_STATE_ARRAY_T is array (0 to 9) of CONTACTOR_STATE_T;
    type CHOKE_STATE_ARRAY_T is array (0 to 4) of CHOKE_STATE_T;

    -- AXI4-Lite interface constants
    constant AXI_ADDR_WIDTH : integer := 16;   -- 64 KB address space
    constant AXI_DATA_WIDTH : integer := 32;   -- 32-bit data bus

end package POG2_MHD_TYPES;

--------------------------------------------------------------------------------
-- END PACKAGE
--------------------------------------------------------------------------------

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;
use work.POG2_MHD_TYPES.ALL;

--------------------------------------------------------------------------------
-- ENTITY: POG2_MHD_FPGA_TOP
-- Top-level module for the MHD propulsion control system
--------------------------------------------------------------------------------
entity POG2_MHD_FPGA_TOP is
    port (
        ------------------------------------------------------------------------
        -- Clock and Reset
        ------------------------------------------------------------------------
        sys_clk         : in  std_logic;                    -- 250 MHz system clock
        sys_rst_n       : in  std_logic;                    -- Active-low async reset

        ------------------------------------------------------------------------
        -- IMU Interrupt (Highest Priority)
        ------------------------------------------------------------------------
        imu_irq         : in  std_logic;                    -- Maneuver detection interrupt
        imu_data_valid  : in  std_logic;                    -- IMU data ready strobe
        imu_accel_x     : in  signed(15 downto 0);         -- X-axis acceleration (mg)
        imu_accel_y     : in  signed(15 downto 0);         -- Y-axis acceleration (mg)
        imu_accel_z     : in  signed(15 downto 0);         -- Z-axis acceleration (mg)
        imu_gyro_x      : in  signed(15 downto 0);         -- X-axis gyro (mdps)
        imu_gyro_y      : in  signed(15 downto 0);         -- Y-axis gyro (mdps)
        imu_gyro_z      : in  signed(15 downto 0);         -- Z-axis gyro (mdps)

        ------------------------------------------------------------------------
        -- Sensor Acquisition (SPI Interface to ADCs)
        ------------------------------------------------------------------------
        -- Temperature: 16 channels via ADS124S08 (24-bit, 1 kSPS)
        temp_spi_sclk   : out std_logic;
        temp_spi_mosi   : out std_logic;
        temp_spi_miso   : in  std_logic;
        temp_spi_cs_n   : out std_logic_vector(3 downto 0);  -- 4 ADC chips (4 ch each)
        temp_drdy_n     : in  std_logic_vector(3 downto 0);  -- Data ready from each ADC

        -- Pressure: 4 channels via strain gauge amplifiers
        press_spi_sclk  : out std_logic;
        press_spi_mosi  : out std_logic;
        press_spi_miso  : in  std_logic;
        press_spi_cs_n  : out std_logic_vector(3 downto 0);

        -- Current/Voltage: 2 channels via Hall sensors (ACS758 + isolated ADC)
        curr_spi_sclk   : out std_logic;
        curr_spi_mosi   : out std_logic;
        curr_spi_miso   : in  std_logic;
        curr_spi_cs_n   : out std_logic_vector(1 downto 0);

        ------------------------------------------------------------------------
        -- Contactor Drive (10 Channels: 5 segments × 2 poles)
        ------------------------------------------------------------------------
        -- Each contactor has: main coil drive, auxiliary feedback, pre-charge control
        ct_coil_drive   : out std_logic_vector(9 downto 0);   -- Contactor coil energize
        ct_aux_feedback : in  std_logic_vector(9 downto 0);   -- Auxiliary contact status
        ct_precharge    : out std_logic_vector(9 downto 0);   -- Snubber pre-charge enable
        ct_fault_n      : in  std_logic_vector(9 downto 0);   -- Contactor fault (active low)

        ------------------------------------------------------------------------
        -- Choke Membrane Drive (5 Channels: 6.5 kHz Resonant PWM)
        ------------------------------------------------------------------------
        -- Each channel: H-bridge PWM A/B, charge amplifier feedback
        choke_pwm_a     : out std_logic_vector(4 downto 0);  -- H-bridge leg A
        choke_pwm_b     : out std_logic_vector(4 downto 0);  -- H-bridge leg B
        choke_fb        : in  signed(11 downto 0);             -- Charge amplifier feedback (shared ADC)

        ------------------------------------------------------------------------
        -- SiC MOSFET Gate Drive (5 segments × 19 parallel MOSFETs)
        ------------------------------------------------------------------------
        -- Gate drive signals (optically isolated, 8.2 ms ramp)
        sic_gate_pwm    : out std_logic_vector(4 downto 0);    -- PWM per segment
        sic_desat_n     : in  std_logic_vector(4 downto 0);    -- Desaturation fault (active low)
        sic_temp        : in  signed(11 downto 0);             -- MOSFET junction temp

        ------------------------------------------------------------------------
        -- Telemetry UART (to CNSManager host on ARM)
        ------------------------------------------------------------------------
        telemetry_tx    : out std_logic;                       -- UART TX to PS
        telemetry_rx    : in  std_logic;                       -- UART RX from PS
        telemetry_rts   : out std_logic;                       -- Request to send
        telemetry_cts   : in  std_logic;                       -- Clear to send

        ------------------------------------------------------------------------
        -- AXI4-Lite Interface (PS Master, PL Slave)
        ------------------------------------------------------------------------
        -- Clock and reset from PS
        axi_aclk        : in  std_logic;                       -- 100 MHz AXI clock
        axi_aresetn     : in  std_logic;                       -- Active-low reset

        -- Write address channel
        axi_awaddr      : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
        axi_awprot      : in  std_logic_vector(2 downto 0);
        axi_awvalid     : in  std_logic;
        axi_awready     : out std_logic;

        -- Write data channel
        axi_wdata       : in  std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
        axi_wstrb       : in  std_logic_vector(3 downto 0);
        axi_wvalid      : in  std_logic;
        axi_wready      : out std_logic;

        -- Write response channel
        axi_bresp       : out std_logic_vector(1 downto 0);
        axi_bvalid      : out std_logic;
        axi_bready      : in  std_logic;

        -- Read address channel
        axi_araddr      : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
        axi_arprot      : in  std_logic_vector(2 downto 0);
        axi_arvalid     : in  std_logic;
        axi_arready     : out std_logic;

        -- Read data channel
        axi_rdata       : out std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
        axi_rresp       : out std_logic_vector(1 downto 0);
        axi_rvalid      : out std_logic;
        axi_rready      : in  std_logic;

        ------------------------------------------------------------------------
        -- Status LEDs (Debug/Bring-up)
        ------------------------------------------------------------------------
        led_tick        : out std_logic;                       -- 640 ms tick heartbeat
        led_mode        : out std_logic_vector(2 downto 0);    -- Current mode (5 states)
        led_fault       : out std_logic;                       -- Fault indicator
        led_imu_irq     : out std_logic                        -- IMU interrupt active
    );
end entity POG2_MHD_FPGA_TOP;

--------------------------------------------------------------------------------
-- ARCHITECTURE: STRUCTURAL
-- Component instantiation with internal signal routing
--------------------------------------------------------------------------------
architecture STRUCTURAL of POG2_MHD_FPGA_TOP is

    ------------------------------------------------------------------------
    -- Internal Clock Domains
    ------------------------------------------------------------------------
    signal clk_250mhz      : std_logic;                       -- Main system clock
    signal clk_100mhz      : std_logic;                       -- AXI clock (from PS)
    signal clk_6p5khz      : std_logic;                       -- Choke PWM reference
    signal rst_sync        : std_logic;                       -- Synchronized reset
    signal axi_rst_sync    : std_logic;                       -- Synchronized AXI reset

    ------------------------------------------------------------------------
    -- 640 ms Tick Generation
    ------------------------------------------------------------------------
    signal tick_counter    : unsigned(23 downto 0);         -- 160,000 cycle counter
    signal tick_strobe     : std_logic;                       -- Single-cycle tick pulse
    signal tick_phase      : unsigned(3 downto 0);          -- Sub-tick phase (0-15)

    ------------------------------------------------------------------------
    -- Hexagram State Machine Signals
    ------------------------------------------------------------------------
    signal hexagram_state  : HEXAGRAM_STATE_T;              -- Current 6-bit yao state
    signal hexagram_next   : HEXAGRAM_STATE_T;              -- Next state (from predictor)
    signal electrical_reg  : ELECTRICAL_REG_T;              -- 2-bit electrical capability
    signal fault_state     : FAULT_STATE_T;                -- 8-bit fault encoding
    signal sys_mode        : SYS_MODE_T;                    -- Operational mode

    ------------------------------------------------------------------------
    -- GhostSplat Predictor Signals
    ------------------------------------------------------------------------
    signal ghostsplat_t0   : Q16_16_T;                       -- Predicted temp at t+0
    signal ghostsplat_t3   : Q16_16_T;                       -- Predicted temp at t+3
    signal ghostsplat_order: unsigned(2 downto 0);           -- Adaptive Taylor order (2-5)
    signal ghostsplat_variance: Q16_16_T;                    -- State variance metric
    signal ghostsplat_high_var: std_logic;                   -- High variance flag (deliberation)

    ------------------------------------------------------------------------
    -- Sensor Acquisition Signals
    ------------------------------------------------------------------------
    signal temp_data       : SENSOR_ARRAY_T;                -- 16 temperature channels (K)
    signal press_data      : PRESSURE_ARRAY_T;              -- 4 pressure channels (atm)
    signal curr_data       : CURRENT_ARRAY_T;              -- 2 current/voltage channels
    signal imu_data        : IMU_ARRAY_T;                   -- 6 IMU channels
    signal sensor_valid    : std_logic;                       -- All sensors valid

    ------------------------------------------------------------------------
    -- Contactor Sequencer Signals
    ------------------------------------------------------------------------
    signal ct_state        : CONTACTOR_STATE_ARRAY_T;      -- 10 contactor state machines
    signal ct_cmd_open     : std_logic_vector(9 downto 0);  -- Command to open
    signal ct_cmd_close    : std_logic_vector(9 downto 0);  -- Command to close
    signal ct_ready        : std_logic_vector(9 downto 0);  -- Contactor ready for next cmd
    signal ct_interlock_ok : std_logic;                       -- Symmetry + checkerboard OK

    ------------------------------------------------------------------------
    -- Choke Driver Signals
    ------------------------------------------------------------------------
    signal choke_state     : CHOKE_STATE_ARRAY_T;          -- 5 choke state machines
    signal choke_freq      : unsigned(15 downto 0);        -- Tracked frequency (0.1 Hz resolution)
    signal choke_phase     : unsigned(8 downto 0);         -- Phase offset per segment (0-360°)
    signal choke_duty      : unsigned(7 downto 0);         -- PWM duty cycle (0-255)

    ------------------------------------------------------------------------
    -- Telemetry Encoder Signals
    ------------------------------------------------------------------------
    signal telemetry_packet: std_logic_vector(63 downto 0); -- 64-bit telemetry frame
    signal telemetry_valid : std_logic;                       -- Packet ready to transmit

    ------------------------------------------------------------------------
    -- AXI4-Lite Register Interface
    ------------------------------------------------------------------------
    -- Control registers (PS writes, PL reads)
    signal reg_hexagram_target : HEXAGRAM_STATE_T;         -- Target state from PS
    signal reg_electrical_cmd   : ELECTRICAL_REG_T;         -- Electrical command from PS
    signal reg_override_enable : std_logic;                   -- PS override enable
    signal reg_tick_period     : unsigned(23 downto 0);     -- Configurable tick period

    -- Status registers (PL writes, PS reads)
    signal reg_hexagram_current: HEXAGRAM_STATE_T;         -- Current state to PS
    signal reg_electrical_current: ELECTRICAL_REG_T;       -- Current electrical state
    signal reg_fault_status    : FAULT_STATE_T;            -- Fault status to PS
    signal reg_ghostsplat_temp  : Q16_16_T;                 -- Predicted temp to PS
    signal reg_dry_ice_mass    : Q16_16_T;                 -- Remaining dry ice (kg)
    signal reg_salt_hydration  : unsigned(15 downto 0);     -- Salt hydration fraction (0-65535)

    -- AXI slave interface signals
    signal axi_awaddr_reg      : std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
    signal axi_araddr_reg      : std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
    signal axi_wdata_reg       : std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
    signal axi_rdata_reg       : std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
    signal axi_write_en        : std_logic;
    signal axi_read_en         : std_logic;

    ------------------------------------------------------------------------
    -- IMU Interrupt Handling
    ------------------------------------------------------------------------
    signal imu_irq_sync        : std_logic;                   -- Synchronized interrupt
    signal imu_irq_pending     : std_logic;                   -- Latched interrupt
    signal imu_turn_rate       : Q16_16_T;                   -- Computed turn rate (deg/s)
    signal imu_decoherence_spike: std_logic;                 -- Γ > 0.5 s⁻¹ flag

    ------------------------------------------------------------------------
    -- Safety Interlocks (Combinatorial, < 1 clock cycle)
    ------------------------------------------------------------------------
    signal thermal_limit_ok    : std_logic;                   -- T_bus < 320 K
    signal current_limit_ok    : std_logic;                   -- I_bus < 2,000 A during opening
    signal pressure_limit_ok   : std_logic;                   -- Plenum 1.3 ± 0.05 atm
    signal safety_ok           : std_logic;                   -- AND of all interlocks

begin

    ------------------------------------------------------------------------
    -- CLOCK AND RESET SYNCHRONIZATION
    ------------------------------------------------------------------------
    -- sys_clk is 250 MHz from external oscillator
    -- axi_aclk is 100 MHz from PS FCLK_CLK0
    clk_250mhz <= sys_clk;
    clk_100mhz <= axi_aclk;

    -- Synchronized reset (async assert, sync deassert)
    process(clk_250mhz, sys_rst_n)
    begin
        if sys_rst_n = '0' then
            rst_sync <= '1';
        elsif rising_edge(clk_250mhz) then
            rst_sync <= '0';
        end if;
    end process;

    process(clk_100mhz, axi_aresetn)
    begin
        if axi_aresetn = '0' then
            axi_rst_sync <= '1';
        elsif rising_edge(clk_100mhz) then
            axi_rst_sync <= '0';
        end if;
    end process;

    ------------------------------------------------------------------------
    -- 640 MS TICK GENERATOR
    ------------------------------------------------------------------------
    -- 250 MHz / 160,000 = 1.5625 kHz = 640 ms period
    process(clk_250mhz, rst_sync)
    begin
        if rst_sync = '1' then
            tick_counter <= (others => '0');
            tick_strobe  <= '0';
            tick_phase   <= (others => '0');
        elsif rising_edge(clk_250mhz) then
            if tick_counter = to_unsigned(TICK_CYCLES-1, 24) then
                tick_counter <= (others => '0');
                tick_strobe  <= '1';
                tick_phase   <= (others => '0');
            else
                tick_counter <= tick_counter + 1;
                tick_strobe  <= '0';
                -- Sub-tick phases for I/O scheduling
                if tick_counter = to_unsigned(TICK_CYCLES/16, 24) then
                    tick_phase <= tick_phase + 1;
                end if;
            end if;
        end if;
    end process;

    -- Tick heartbeat LED
    led_tick <= tick_strobe;

    ------------------------------------------------------------------------
    -- IMU INTERRUPT SYNCHRONIZATION AND DECOHERENCE DETECTION
    ------------------------------------------------------------------------
    -- IMU IRQ is asynchronous to 250 MHz clock — synchronize and latch
    process(clk_250mhz, rst_sync)
        variable turn_rate_mag : Q16_16_T;
    begin
        if rst_sync = '1' then
            imu_irq_sync     <= '0';
            imu_irq_pending  <= '0';
            imu_turn_rate    <= (others => '0');
            imu_decoherence_spike <= '0';
        elsif rising_edge(clk_250mhz) then
            -- Synchronize async interrupt
            imu_irq_sync <= imu_irq;

            if imu_irq_sync = '1' and imu_data_valid = '1' then
                imu_irq_pending <= '1';
                -- Compute turn rate magnitude from gyro data
                -- turn_rate = sqrt(gyro_x² + gyro_y² + gyro_z²) in deg/s
                -- Simplified: use max absolute value for speed
                turn_rate_mag := abs(imu_gyro_x) + abs(imu_gyro_y) + abs(imu_gyro_z);
                imu_turn_rate <= turn_rate_mag;

                -- Decoherence spike: turn rate > 5 deg/s triggers Γ > 0.5 s⁻¹
                -- Threshold: 5 deg/s = 5,000 mdps ≈ 5000 in Q16.16 (scaled)
                if turn_rate_mag > to_signed(5000, Q_TOTAL_BITS) then
                    imu_decoherence_spike <= '1';
                else
                    imu_decoherence_spike <= '0';
                end if;
            else
                imu_decoherence_spike <= '0';
            end if;

            -- Clear pending when handled by state machine
            if tick_strobe = '1' then
                imu_irq_pending <= '0';
            end if;
        end if;
    end process;

    led_imu_irq <= imu_irq_pending;

    ------------------------------------------------------------------------
    -- SAFETY INTERLOCKS (Combinatorial — < 1 clock cycle latency)
    ------------------------------------------------------------------------
    -- Thermal: T_bus < 320 K (320.0 in Q16.16 = 20,971,520)
    thermal_limit_ok <= '1' when temp_data(0) < to_signed(20971520, Q_TOTAL_BITS) else '0';

    -- Current: I_bus < 2,000 A during contactor opening (2,000 in Q16.16 = 131,072,000)
    -- Only checked during OPENING state
    current_limit_ok <= '1' when (curr_data(0) < to_signed(131072000, Q_TOTAL_BITS)) or 
                                  (ct_state(0) /= CT_OPENING) else '0';

    -- Pressure: Plenum 1.3 ± 0.05 atm (1.25 = 81,920, 1.35 = 88,473 in Q16.16)
    pressure_limit_ok <= '1' when (press_data(0) > to_signed(81920, Q_TOTAL_BITS)) and
                                   (press_data(0) < to_signed(88473, Q_TOTAL_BITS)) else '0';

    -- Master safety OK
    safety_ok <= thermal_limit_ok and current_limit_ok and pressure_limit_ok and ct_interlock_ok;

    ------------------------------------------------------------------------
    -- COMPONENT: HEXAGRAM_STATE_MACHINE
    -- 64-state intent matrix with CSR sparse encoding and constraint masking
    ------------------------------------------------------------------------
    U_HEXAGRAM: entity work.HEXAGRAM_STATE_MACHINE
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            tick_strobe     => tick_strobe,

            -- Current state
            state_current   => hexagram_state,
            electrical_reg  => electrical_reg,
            fault_state     => fault_state,

            -- Next state from predictor
            state_next      => hexagram_next,

            -- Safety interlocks
            safety_ok       => safety_ok,
            thermal_ok      => thermal_limit_ok,

            -- IMU override
            imu_decoherence => imu_decoherence_spike,
            imu_force_state => hexagram_next,  -- Forced safe state when Γ spikes

            -- PS override (AXI register)
            ps_override_en  => reg_override_enable,
            ps_target_state => reg_hexagram_target,

            -- Output
            sys_mode        => sys_mode,
            state_committed => hexagram_state,
            fault_out       => fault_state
        );

    ------------------------------------------------------------------------
    -- COMPONENT: GHOSTSPLAT_PREDICTOR
    -- Adaptive-order Taylor expansion with Q16.16 arithmetic
    ------------------------------------------------------------------------
    U_GHOSTSPLAT: entity work.GHOSTSPLAT_PREDICTOR
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            tick_strobe     => tick_strobe,

            -- Sensor inputs
            temp_data       => temp_data,
            press_data      => press_data,
            curr_data       => curr_data,
            imu_data        => imu_data,

            -- Current state
            hexagram_state  => hexagram_state,
            electrical_reg  => electrical_reg,

            -- Prediction outputs
            temp_predicted  => ghostsplat_t3,
            taylor_order    => ghostsplat_order,
            state_variance  => ghostsplat_variance,
            high_variance   => ghostsplat_high_var,

            -- Hamiltonian constants (pre-loaded)
            hbar_eff        => HBAR_EFF_Q16_16,
            thermal_lag     => to_signed(61440, Q_TOTAL_BITS),  -- 0.9375 in Q16.16

            -- Computation complete
            compute_done    => open  -- Handled by tick_strobe timing
        );

    ------------------------------------------------------------------------
    -- COMPONENT: CONTACTOR_SEQUENCER
    -- 10-channel interlocked state machine with arc suppression
    ------------------------------------------------------------------------
    U_CONTACTOR: entity work.CONTACTOR_SEQUENCER
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            tick_strobe     => tick_strobe,

            -- Command interface from hexagram state machine
            cmd_open        => ct_cmd_open,
            cmd_close       => ct_cmd_close,

            -- Physical I/O
            coil_drive      => ct_coil_drive,
            aux_feedback    => ct_aux_feedback,
            precharge       => ct_precharge,
            fault_n         => ct_fault_n,

            -- State outputs
            ct_state        => ct_state,
            ct_ready        => ct_ready,
            interlock_ok    => ct_interlock_ok,

            -- Safety
            current_data    => curr_data,
            thermal_ok      => thermal_limit_ok
        );

    ------------------------------------------------------------------------
    -- COMPONENT: CHOKE_DRIVER
    -- 5-channel 6.5 kHz resonant PWM with phase-locked loop
    ------------------------------------------------------------------------
    U_CHOKE: entity work.CHOKE_DRIVER
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,

            -- Command from hexagram state machine
            choke_enable    => hexagram_state(4),  -- Yao 4 = transpiration active
            segment_demand  => press_data(0),      -- Plenum pressure feedback

            -- Physical I/O
            pwm_a           => choke_pwm_a,
            pwm_b           => choke_pwm_b,
            feedback        => choke_fb,

            -- State outputs
            choke_state     => choke_state,
            freq_tracked    => choke_freq,
            phase_offset    => choke_phase,
            duty_cycle      => choke_duty
        );

    ------------------------------------------------------------------------
    -- COMPONENT: SENSOR_ACQUISITION
    -- Time-division multiplexed acquisition: 16 temp + 4 pressure + 2 current
    ------------------------------------------------------------------------
    U_SENSOR: entity work.SENSOR_ACQUISITION
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            tick_strobe     => tick_strobe,
            tick_phase      => tick_phase,

            -- Temperature SPI
            temp_spi_sclk   => temp_spi_sclk,
            temp_spi_mosi   => temp_spi_mosi,
            temp_spi_miso   => temp_spi_miso,
            temp_spi_cs_n   => temp_spi_cs_n,
            temp_drdy_n     => temp_drdy_n,

            -- Pressure SPI
            press_spi_sclk  => press_spi_sclk,
            press_spi_mosi  => press_spi_mosi,
            press_spi_miso  => press_spi_miso,
            press_spi_cs_n  => press_spi_cs_n,

            -- Current SPI
            curr_spi_sclk   => curr_spi_sclk,
            curr_spi_mosi   => curr_spi_mosi,
            curr_spi_miso   => curr_spi_miso,
            curr_spi_cs_n   => curr_spi_cs_n,

            -- Scaled outputs
            temp_data       => temp_data,
            press_data      => press_data,
            curr_data       => curr_data,
            data_valid      => sensor_valid
        );

    ------------------------------------------------------------------------
    -- COMPONENT: TELEMETRY_ENCODER
    -- 64-bit packet: hexagram state + electrical reg + fault + sensors
    ------------------------------------------------------------------------
    U_TELEMETRY: entity work.TELEMETRY_ENCODER
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            tick_strobe     => tick_strobe,

            -- Data inputs
            hexagram_state  => hexagram_state,
            electrical_reg  => electrical_reg,
            fault_state     => fault_state,
            sys_mode        => sys_mode,

            -- Sensor summary
            temp_avg        => temp_data(0),    -- Simplified: channel 0 representative
            press_plenum    => press_data(0),
            curr_bus        => curr_data(0),

            -- Predictor status
            ghostsplat_temp => ghostsplat_t3,
            taylor_order    => ghostsplat_order,
            high_variance   => ghostsplat_high_var,

            -- Packet output
            uart_tx         => telemetry_tx,
            uart_rx         => telemetry_rx,
            packet_out      => telemetry_packet,
            packet_valid    => telemetry_valid
        );

    ------------------------------------------------------------------------
    -- AXI4-LITE SLAVE INTERFACE
    ------------------------------------------------------------------------
    -- Register map (16-bit address space):
    -- 0x0000: Control (R/W) — bit 0: override enable, bits 7-2: target yao state
    -- 0x0004: Electrical command (R/W) — bits 1-0: electrical register
    -- 0x0008: Tick period (R/W) — 24-bit configurable tick period
    -- 0x0010: Status (R) — current hexagram state
    -- 0x0014: Electrical status (R) — current electrical register
    -- 0x0018: Fault status (R) — 8-bit fault encoding
    -- 0x001C: Predicted temp (R) — Q16.16 predicted temperature
    -- 0x0020: Dry ice mass (R) — Q16.16 remaining kg
    -- 0x0024: Salt hydration (R) — 16-bit fraction 0-65535
    -- 0x0030: IMU turn rate (R) — Q16.16 deg/s
    -- 0x0034: GhostSplat variance (R) — Q16.16 state variance
    -- 0x0040: Contactor states (R) — 10 × 3-bit state encoding
    -- 0x0044: Choke states (R) — 5 × 2-bit state encoding

    U_AXI_SLAVE: entity work.AXI4_LITE_SLAVE
        port map (
            -- Clock and reset
            axi_aclk        => clk_100mhz,
            axi_aresetn     => axi_aresetn,

            -- Write address
            axi_awaddr      => axi_awaddr,
            axi_awprot      => axi_awprot,
            axi_awvalid     => axi_awvalid,
            axi_awready     => axi_awready,

            -- Write data
            axi_wdata       => axi_wdata,
            axi_wstrb       => axi_wstrb,
            axi_wvalid      => axi_wvalid,
            axi_wready      => axi_wready,

            -- Write response
            axi_bresp       => axi_bresp,
            axi_bvalid      => axi_bvalid,
            axi_bready      => axi_bready,

            -- Read address
            axi_araddr      => axi_araddr,
            axi_arprot      => axi_arprot,
            axi_arvalid     => axi_arvalid,
            axi_arready     => axi_arready,

            -- Read data
            axi_rdata       => axi_rdata,
            axi_rresp       => axi_rresp,
            axi_rvalid      => axi_rvalid,
            axi_rready      => axi_rready,

            -- Register interface (PL side)
            reg_hexagram_target => reg_hexagram_target,
            reg_electrical_cmd   => reg_electrical_cmd,
            reg_override_enable  => reg_override_enable,
            reg_tick_period      => reg_tick_period,

            reg_hexagram_current => reg_hexagram_current,
            reg_electrical_current => reg_electrical_current,
            reg_fault_status     => reg_fault_status,
            reg_ghostsplat_temp  => reg_ghostsplat_temp,
            reg_dry_ice_mass     => reg_dry_ice_mass,
            reg_salt_hydration   => reg_salt_hydration
        );

    -- Connect AXI status registers to internal signals
    reg_hexagram_current  <= hexagram_state;
    reg_electrical_current <= electrical_reg;
    reg_fault_status      <= fault_state;
    reg_ghostsplat_temp   <= ghostsplat_t3;
    -- Dry ice mass and salt hydration are computed by the thermal management logic
    -- (not shown in this skeleton, would be added in thermal_cns_manager.vhd)

    ------------------------------------------------------------------------
    -- MODE LED ENCODING
    ------------------------------------------------------------------------
    process(sys_mode)
    begin
        case sys_mode is
            when MODE_IDLE     => led_mode <= "000";
            when MODE_STEALTH  => led_mode <= "001";
            when MODE_TRANSIT  => led_mode <= "010";
            when MODE_LIMP     => led_mode <= "011";
            when MODE_PURGE    => led_mode <= "100";
            when MODE_EMERGENCY=> led_mode <= "111";
            when others        => led_mode <= "111";
        end case;
    end process;

    led_fault <= '1' when fault_state /= FAULT_NONE else '0';

    ------------------------------------------------------------------------
    -- ELECTRICAL REGISTER STATE MACHINE
    -- Maps hexagram intent to electrical capability with interlocks
    ------------------------------------------------------------------------
    process(clk_250mhz, rst_sync)
    begin
        if rst_sync = '1' then
            electrical_reg <= ELEC_OFF;
        elsif rising_edge(clk_250mhz) then
            if tick_strobe = '1' then
                case hexagram_state is
                    -- IDLE: Electrical must be OFF
                    when "000000" =>
                        electrical_reg <= ELEC_OFF;

                    -- STEALTH: Electrical ARMED (ready but not conducting)
                    when "110100" =>
                        if safety_ok = '1' then
                            electrical_reg <= ELEC_ARMED;
                        else
                            electrical_reg <= ELEC_OFF;
                        end if;

                    -- TRANSIT, TR_SALT, TR_CRIT: Electrical ACTIVE
                    when "111000" | "111010" | "111011" =>
                        if safety_ok = '1' and ct_ready = "1111111111" then
                            electrical_reg <= ELEC_ACTIVE;
                        else
                            electrical_reg <= ELEC_ARMED;
                        end if;

                    -- LIMP_MODE: Electrical SHED
                    when "111001" =>
                        if safety_ok = '1' then
                            electrical_reg <= ELEC_SHED;
                        else
                            electrical_reg <= ELEC_OFF;
                        end if;

                    -- PURGE: Electrical OFF (channel flooded)
                    when "001001" =>
                        electrical_reg <= ELEC_OFF;

                    -- Default: Safe state
                    when others =>
                        electrical_reg <= ELEC_OFF;
                end case;
            end if;
        end if;
    end process;

    ------------------------------------------------------------------------
    -- CONTACTOR COMMAND GENERATION
    -- Maps electrical register to contactor open/close commands
    ------------------------------------------------------------------------
    process(electrical_reg, hexagram_state, ct_state)
        variable i : integer range 0 to 9;
    begin
        -- Default: no commands
        ct_cmd_open  <= (others => '0');
        ct_cmd_close <= (others => '0');

        case electrical_reg is
            when ELEC_OFF =>
                -- Open all contactors
                for i in 0 to 9 loop
                    if ct_state(i) = CT_CLOSED then
                        ct_cmd_open(i) <= '1';
                    end if;
                end loop;

            when ELEC_ARMED =>
                -- Close all contactors but no current
                for i in 0 to 9 loop
                    if ct_state(i) = CT_OPEN then
                        ct_cmd_close(i) <= '1';
                    end if;
                end loop;

            when ELEC_ACTIVE =>
                -- Close all contactors (full current)
                for i in 0 to 9 loop
                    if ct_state(i) = CT_OPEN then
                        ct_cmd_close(i) <= '1';
                    end if;
                end loop;

            when ELEC_SHED =>
                -- Checkerboard pattern: close 5, open 5
                -- Pattern A: 1L, 2R, 3L, 4R, 5L active (indices 0,3,4,7,8)
                for i in 0 to 9 loop
                    if i = 0 or i = 3 or i = 4 or i = 7 or i = 8 then
                        if ct_state(i) = CT_OPEN then
                            ct_cmd_close(i) <= '1';
                        end if;
                    else
                        if ct_state(i) = CT_CLOSED then
                            ct_cmd_open(i) <= '1';
                        end if;
                    end if;
                end loop;

            when others =>
                ct_cmd_open <= (others => '1');
        end case;
    end process;

end architecture STRUCTURAL;

--------------------------------------------------------------------------------
-- END OF TOP-LEVEL ENTITY
--------------------------------------------------------------------------------
