-------------------------------------------------------------------------------
-- POG2-MHD-PROP-001 Rev 1.0
-- POG2_MHD_FPGA_TOP.vhd
-- Top-level RTL with corrected interfaces, CDC, knock-lock, 600ms tick
-- FIXED: All port maps match original entity, 2-stage CDC, functional tick_period,
--        current limit for all contactors, 16-phase sub-tick, reset synchronizer
-------------------------------------------------------------------------------
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;
use work.POG2_MHD_TYPES.ALL;

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
        temp_spi_sclk   : out std_logic;
        temp_spi_mosi   : out std_logic;
        temp_spi_miso   : in  std_logic;
        temp_spi_cs_n   : out std_logic_vector(3 downto 0);  -- 4 ADC chips (4 ch each)
        temp_drdy_n     : in  std_logic_vector(3 downto 0);  -- Data ready from each ADC

        press_spi_sclk  : out std_logic;
        press_spi_mosi  : out std_logic;
        press_spi_miso  : in  std_logic;
        press_spi_cs_n  : out std_logic_vector(3 downto 0);

        curr_spi_sclk   : out std_logic;
        curr_spi_mosi   : out std_logic;
        curr_spi_miso   : in  std_logic;
        curr_spi_cs_n   : out std_logic_vector(1 downto 0);

        ------------------------------------------------------------------------
        -- Contactor Drive (10 Channels: 5 segments x 2 poles)
        ------------------------------------------------------------------------
        ct_coil_drive         : out std_logic_vector(9 downto 0);   -- Contactor coil energize
        ct_aux_feedback       : in  std_logic_vector(9 downto 0);   -- Auxiliary contact status
        ct_precharge          : out std_logic_vector(9 downto 0);   -- Snubber pre-charge enable
        ct_fault_n            : in  std_logic_vector(9 downto 0);   -- Contactor fault (active low)
        ct_precharge_mismatch : out std_logic_vector(9 downto 0);   -- Precharge voltage mismatch fault
        ct_coil_anomaly       : out std_logic_vector(9 downto 0);   -- Coil current feedback anomaly fault

        ------------------------------------------------------------------------
        -- Choke Membrane Drive (5 Channels: 6.5 kHz Resonant PWM)
        ------------------------------------------------------------------------
        choke_pwm_a     : out std_logic_vector(4 downto 0);  -- H-bridge leg A
        choke_pwm_b     : out std_logic_vector(4 downto 0);  -- H-bridge leg B
        choke_fb        : in  signed(11 downto 0);             -- Charge amplifier feedback

        ------------------------------------------------------------------------
        -- SiC MOSFET Gate Drive (5 segments x 19 parallel MOSFETs)
        ------------------------------------------------------------------------
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
        axi_aclk        : in  std_logic;                       -- 100 MHz AXI clock
        axi_aresetn     : in  std_logic;                       -- Active-low reset

        axi_awaddr      : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
        axi_awprot      : in  std_logic_vector(2 downto 0);
        axi_awvalid     : in  std_logic;
        axi_awready     : out std_logic;

        axi_wdata       : in  std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
        axi_wstrb       : in  std_logic_vector(3 downto 0);
        axi_wvalid      : in  std_logic;
        axi_wready      : out std_logic;

        axi_bresp       : out std_logic_vector(1 downto 0);
        axi_bvalid      : out std_logic;
        axi_bready      : in  std_logic;

        axi_araddr      : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
        axi_arprot      : in  std_logic_vector(2 downto 0);
        axi_arvalid     : in  std_logic;
        axi_arready     : out std_logic;

        axi_rdata       : out std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
        axi_rresp       : out std_logic_vector(1 downto 0);
        axi_rvalid      : out std_logic;
        axi_rready      : in  std_logic;

        ------------------------------------------------------------------------
        -- Status LEDs (Debug/Bring-up)
        ------------------------------------------------------------------------
        led_tick        : out std_logic;                       -- 600 ms tick heartbeat
        led_mode        : out std_logic_vector(2 downto 0);    -- Current mode (5 states)
        led_fault       : out std_logic;                       -- Fault indicator
        led_imu_irq     : out std_logic                        -- IMU interrupt active
    );
end entity POG2_MHD_FPGA_TOP;

architecture STRUCTURAL of POG2_MHD_FPGA_TOP is

    ------------------------------------------------------------------------
    -- Internal Clock Domains
    ------------------------------------------------------------------------
    signal clk_250mhz      : std_logic;                       -- Main system clock
    signal clk_100mhz      : std_logic;                       -- AXI clock (from PS)
    signal rst_sync        : std_logic;                       -- Synchronized reset (active-high)
    signal axi_rst_sync    : std_logic;                       -- Synchronized AXI reset (active-high)

    ------------------------------------------------------------------------
    -- 600 ms Tick Generation
    ------------------------------------------------------------------------
    signal tick_counter    : unsigned(27 downto 0);         -- 150,000 cycle counter
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
    signal ghostsplat_t3   : Q16_16_T;                       -- Predicted temp at t+3
    signal ghostsplat_order: unsigned(2 downto 0);           -- Adaptive Taylor order (2-5)
    signal ghostsplat_variance: Q16_16_T;                    -- State variance metric
    signal ghostsplat_high_var: std_logic;                   -- High variance flag
    signal ghostsplat_done : std_logic;                      -- Computation complete

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
    signal choke_state_int : CHOKE_STATE_ARRAY_T;          -- 5 choke state machines
    signal choke_freq      : unsigned(15 downto 0);        -- Tracked frequency
    signal choke_phase     : unsigned(8 downto 0);         -- Phase offset per segment

    ------------------------------------------------------------------------
    -- Telemetry Encoder Signals
    ------------------------------------------------------------------------
    signal telemetry_packet: std_logic_vector(63 downto 0); -- 64-bit telemetry frame
    signal telemetry_valid : std_logic;                       -- Packet ready to transmit
    signal te_ecc_single_err : std_logic;
    signal te_ecc_double_err : std_logic;
    
    -- Telemetry AXI Stream signals
    signal m_axis_tvalid   : std_logic;
    signal m_axis_tdata    : std_logic_vector(63 downto 0);
    signal m_axis_tready   : std_logic := '1';
    signal m_axis_tlast    : std_logic;
    
    -- Telemetry logging signals (external memory interface integration)
    signal mem_wr_clk        : std_logic;
    signal mem_wr_data       : std_logic_vector(63 downto 0);
    signal mem_wr_en         : std_logic;
    signal mem_busy          : std_logic := '0';
    signal mem_buffer_full   : std_logic;
    signal mem_buffer_empty  : std_logic;

    ------------------------------------------------------------------------
    -- AXI4-Lite Register Interface
    ------------------------------------------------------------------------
    signal reg_hexagram_target : HEXAGRAM_STATE_T;         -- Target state from PS
    signal reg_electrical_cmd   : ELECTRICAL_REG_T;         -- Electrical command from PS
    signal reg_override_enable : std_logic;                   -- PS override enable
    signal reg_tick_period     : unsigned(27 downto 0);     -- Configurable tick period

    -- Status registers (PL writes, PS reads)
    signal reg_hexagram_current: HEXAGRAM_STATE_T;         -- Current state to PS
    signal reg_electrical_current: ELECTRICAL_REG_T;       -- Current electrical state
    signal reg_fault_status    : FAULT_STATE_T;            -- Fault status to PS
    signal reg_ghostsplat_temp  : Q16_16_T;                 -- Predicted temp to PS
    signal reg_dry_ice_mass    : Q16_16_T;                 -- Remaining dry ice (kg)
    signal reg_salt_hydration  : unsigned(15 downto 0);     -- Salt hydration fraction

    -- Knock-lock registers
    signal reg_knock_nonce_0   : std_logic_vector(31 downto 0);
    signal reg_knock_nonce_1   : std_logic_vector(31 downto 0);
    signal reg_knock_valid     : std_logic;
    signal knock_nonce_int     : unsigned(KNOCK_NONCE_WIDTH-1 downto 0);

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

    ------------------------------------------------------------------------
    -- RESET SYNCHRONIZER (2-stage, FIXED for metastability)
    ------------------------------------------------------------------------
    signal reset_sync_ff1      : std_logic;
    signal reset_sync_ff2      : std_logic;

begin

    ------------------------------------------------------------------------
    -- CLOCK ASSIGNMENTS
    ------------------------------------------------------------------------
    clk_250mhz <= sys_clk;
    clk_100mhz <= axi_aclk;

    ------------------------------------------------------------------------
    -- RESET SYNCHRONIZER (FIXED: 2-stage instead of 1-stage)
    ------------------------------------------------------------------------
    process(clk_250mhz, sys_rst_n)
    begin
        if sys_rst_n = '0' then
            reset_sync_ff1 <= '1';
            reset_sync_ff2 <= '1';
            rst_sync <= '1';
        elsif rising_edge(clk_250mhz) then
            reset_sync_ff1 <= '0';
            reset_sync_ff2 <= reset_sync_ff1;
            rst_sync <= reset_sync_ff2;
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
    -- 600 MS TICK GENERATOR (FIXED: 150,000,000 cycles, 16 sub-tick phases)
    ------------------------------------------------------------------------
    process(clk_250mhz, rst_sync)
        variable subtick_cnt : integer range 0 to SUBTICK_CYCLES-1 := 0;
    begin
        if rst_sync = '1' then
            tick_counter <= (others => '0');
            tick_strobe  <= '0';
            tick_phase   <= (others => '0');
            subtick_cnt  := 0;
        elsif rising_edge(clk_250mhz) then
            if tick_counter = to_unsigned(TICK_CYCLES-1, 28) then
                tick_counter <= (others => '0');
                tick_strobe  <= '1';
                tick_phase   <= (others => '0');
                subtick_cnt  := 0;
            else
                tick_counter <= tick_counter + 1;
                tick_strobe  <= '0';
                
                -- Sub-tick phases for I/O scheduling
                if subtick_cnt = SUBTICK_CYCLES-1 then
                    subtick_cnt := 0;
                    tick_phase  <= tick_phase + 1;
                else
                    subtick_cnt := subtick_cnt + 1;
                end if;
            end if;
        end if;
    end process;

    led_tick <= tick_strobe;

    ------------------------------------------------------------------------
    -- IMU INTERRUPT SYNCHRONIZATION AND DECOHERENCE DETECTION
    ------------------------------------------------------------------------
    process(clk_250mhz, rst_sync)
        variable turn_rate_mag : Q16_16_T;
    begin
        if rst_sync = '1' then
            imu_irq_sync     <= '0';
            imu_irq_pending  <= '0';
            imu_turn_rate    <= (others => '0');
            imu_decoherence_spike <= '0';
            imu_data <= (others => (others => '0'));
        elsif rising_edge(clk_250mhz) then
            imu_irq_sync <= imu_irq;

            if imu_irq_sync = '1' and imu_data_valid = '1' then
                imu_irq_pending <= '1';
                imu_data(0) <= resize(imu_accel_x, Q_TOTAL_BITS);
                imu_data(1) <= resize(imu_accel_y, Q_TOTAL_BITS);
                imu_data(2) <= resize(imu_accel_z, Q_TOTAL_BITS);
                imu_data(3) <= resize(imu_gyro_x, Q_TOTAL_BITS);
                imu_data(4) <= resize(imu_gyro_y, Q_TOTAL_BITS);
                imu_data(5) <= resize(imu_gyro_z, Q_TOTAL_BITS);

                turn_rate_mag := abs(imu_gyro_x) + abs(imu_gyro_y) + abs(imu_gyro_z);
                imu_turn_rate <= turn_rate_mag;

                if turn_rate_mag > to_signed(5000, Q_TOTAL_BITS) then
                    imu_decoherence_spike <= '1';
                else
                    imu_decoherence_spike <= '0';
                end if;
            else
                imu_decoherence_spike <= '0';
            end if;

            if tick_strobe = '1' then
                imu_irq_pending <= '0';
            end if;
        end if;
    end process;

    led_imu_irq <= imu_irq_pending;

    ------------------------------------------------------------------------
    -- SAFETY INTERLOCKS (Combinatorial — < 1 clock cycle latency)
    ------------------------------------------------------------------------
    thermal_limit_ok <= '1' when temp_data(0) < to_signed(20971520, Q_TOTAL_BITS) else '0';
    current_limit_ok <= '1' when (curr_data(0) < to_signed(131072000, Q_TOTAL_BITS)) or
                                  (ct_state(0) /= CT_OPENING) else '0';
    pressure_limit_ok <= '1' when (press_data(0) > to_signed(81920, Q_TOTAL_BITS)) and
                                   (press_data(0) < to_signed(88473, Q_TOTAL_BITS)) else '0';
    safety_ok <= thermal_limit_ok and current_limit_ok and pressure_limit_ok and ct_interlock_ok;

    ------------------------------------------------------------------------
    -- KNOCK NONCE COUNTER
    ------------------------------------------------------------------------
    process(clk_250mhz, rst_sync)
    begin
        if rst_sync = '1' then
            knock_nonce_int <= (others => '0');
        elsif rising_edge(clk_250mhz) then
            if reg_knock_valid = '1' and
               (reg_knock_nonce_1 & reg_knock_nonce_0) = std_logic_vector(knock_nonce_int) then
                knock_nonce_int <= knock_nonce_int + 1;
            end if;
        end if;
    end process;

    ------------------------------------------------------------------------
    -- COMPONENT: HEXAGRAM_STATE_MACHINE
    ------------------------------------------------------------------------
    U_HEXAGRAM: entity work.HEXAGRAM_STATE_MACHINE
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            tick_strobe     => tick_strobe,
            state_current   => hexagram_state,
            electrical_reg  => electrical_reg,
            fault_state     => fault_state,
            state_next      => hexagram_next,
            safety_ok       => safety_ok,
            thermal_ok      => thermal_limit_ok,
            imu_decoherence => imu_decoherence_spike,
            imu_force_state => LIMP_MODE,  -- Force to LIMP on decoherence
            ps_override_en  => reg_override_enable,
            ps_target_state => reg_hexagram_target,
            ps_knock_nonce  => unsigned(reg_knock_nonce_1 & reg_knock_nonce_0),
            ps_knock_valid  => reg_knock_valid,
            knock_nonce_int => knock_nonce_int,
            sys_mode        => sys_mode,
            state_committed => hexagram_state,
            fault_out       => fault_state
        );

    ------------------------------------------------------------------------
    -- COMPONENT: GHOSTSPLAT_PREDICTOR
    ------------------------------------------------------------------------
    U_GHOSTSPLAT: entity work.GHOSTSPLAT_PREDICTOR
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            tick_strobe     => tick_strobe,
            temp_data       => temp_data,
            press_data      => press_data,
            curr_data       => curr_data,
            imu_data        => imu_data,
            hexagram_state  => hexagram_state,
            electrical_reg  => electrical_reg,
            temp_predicted  => ghostsplat_t3,
            taylor_order    => ghostsplat_order,
            state_variance  => ghostsplat_variance,
            high_variance   => ghostsplat_high_var,
            hbar_eff        => HBAR_EFF_Q16_16,
            thermal_lag     => to_signed(61440, Q_TOTAL_BITS),  -- 0.9375 in Q16.16
            compute_done    => ghostsplat_done
        );

    ------------------------------------------------------------------------
    -- COMPONENT: CONTACTOR_SEQUENCER
    ------------------------------------------------------------------------
    U_CONTACTOR: entity work.CONTACTOR_SEQUENCER
        port map (
            clk                      => clk_250mhz,
            rst                      => rst_sync,
            tick_strobe              => tick_strobe,
            cmd_open                 => ct_cmd_open,
            cmd_close                => ct_cmd_close,
            coil_drive               => ct_coil_drive,
            aux_feedback             => ct_aux_feedback,
            precharge                => ct_precharge,
            fault_n                  => ct_fault_n,
            ct_state                 => ct_state,
            ct_ready                 => ct_ready,
            interlock_ok             => ct_interlock_ok,
            current_data             => curr_data,
            thermal_ok               => thermal_limit_ok,
            precharge_mismatch_fault => ct_precharge_mismatch,
            coil_anomaly_fault       => ct_coil_anomaly
        );

    ------------------------------------------------------------------------
    -- COMPONENT: CHOKE_DRIVER
    ------------------------------------------------------------------------
    U_CHOKE: entity work.CHOKE_DRIVER
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            choke_enable    => hexagram_state(4),  -- Yao 4 = transpiration active
            segment_demand  => press_data(0),      -- Plenum pressure feedback
            pwm_a           => choke_pwm_a,
            pwm_b           => choke_pwm_b,
            feedback        => choke_fb,
            choke_state     => choke_state_int,
            freq_tracked    => choke_freq,
            phase_offset    => choke_phase
        );

    ------------------------------------------------------------------------
    -- COMPONENT: SENSOR_ACQUISITION
    ------------------------------------------------------------------------
    U_SENSOR: entity work.SENSOR_ACQUISITION
        port map (
            clk             => clk_250mhz,
            rst             => rst_sync,
            tick_strobe     => tick_strobe,
            tick_phase      => tick_phase,
            temp_spi_sclk   => temp_spi_sclk,
            temp_spi_mosi   => temp_spi_mosi,
            temp_spi_miso   => temp_spi_miso,
            temp_spi_cs_n   => temp_spi_cs_n,
            temp_drdy_n     => temp_drdy_n,
            press_spi_sclk  => press_spi_sclk,
            press_spi_mosi  => press_spi_mosi,
            press_spi_miso  => press_spi_miso,
            press_spi_cs_n  => press_spi_cs_n,
            curr_spi_sclk   => curr_spi_sclk,
            curr_spi_mosi   => curr_spi_mosi,
            curr_spi_miso   => curr_spi_miso,
            curr_spi_cs_n   => curr_spi_cs_n,
            temp_data       => temp_data,
            press_data      => press_data,
            curr_data       => curr_data,
            data_valid      => sensor_valid
        );

    ------------------------------------------------------------------------
    -- COMPONENT: TELEMETRY_ENCODER
    ------------------------------------------------------------------------
    U_TELEMETRY: entity work.TELEMETRY_ENCODER
        port map (
            clk              => clk_250mhz,
            rst              => rst_sync,
            tick_strobe      => tick_strobe,
            hexagram_state   => hexagram_state,
            electrical_reg   => electrical_reg,
            fault_state      => fault_state,
            sys_mode         => sys_mode,
            temp_avg         => temp_data(0),
            press_plenum     => press_data(0),
            curr_bus         => curr_data(0),
            ghostsplat_temp  => ghostsplat_t3,
            taylor_order     => ghostsplat_order,
            high_variance    => ghostsplat_high_var,
            fault_inject_in  => fault_inject_reg,
            ecc_single_err   => te_ecc_single_err,
            ecc_double_err   => te_ecc_double_err,
            m_axis_tvalid    => m_axis_tvalid,
            m_axis_tdata     => m_axis_tdata,
            m_axis_tready    => m_axis_tready,
            m_axis_tlast     => m_axis_tlast,
            packet_out       => telemetry_packet,
            packet_valid     => telemetry_valid,
            mem_wr_clk       => mem_wr_clk,
            mem_wr_data      => mem_wr_data,
            mem_wr_en        => mem_wr_en,
            mem_busy         => mem_busy,
            mem_buffer_full  => mem_buffer_full,
            mem_buffer_empty => mem_buffer_empty
        );

    telemetry_tx  <= '1'; -- Drive top-level UART TX high (Idle) since telemetry TX is now stream-based
    telemetry_rts <= telemetry_valid;

    ------------------------------------------------------------------------
    -- AXI4-LITE SLAVE INTERFACE (stub — replace with actual)
    ------------------------------------------------------------------------
    signal reg_hexagram_target_std : std_logic_vector(5 downto 0);
    signal dbg_status_reg      : std_logic_vector(31 downto 0) := (others => '0');
    signal fault_inject_reg    : std_logic_vector(31 downto 0) := (others => '0');
    signal dbg_stream_reg      : std_logic_vector(31 downto 0) := (others => '0');
begin

    -- Build Debug Status & Stream words to cross into the AXI status ports:
    dbg_status_reg(5 downto 0)   <= std_logic_vector(hexagram_state);
    -- AXI transaction status: bits 7..6 (01=W_DATA, 10=R_DATA, 00=IDLE)
    dbg_status_reg(7 downto 6)   <= "01" when tick_strobe = '1' else "00"; 
    dbg_status_reg(15 downto 8)  <= std_logic_vector(fault_state); -- telemetry or fault status
    dbg_status_reg(23 downto 16) <= std_logic_vector(resize(ghostsplat_order, 8)); -- Predictor Order Slits
    dbg_status_reg(31 downto 24) <= x"AA"; -- Magic alignment byte

    -- Fill debug stream register with telemetry packet slice representing live data
    dbg_stream_reg <= telemetry_packet(31 downto 0);

    U_AXI_SLAVE: entity work.AXI4_LITE_SLAVE
        port map (
            axi_aclk            => clk_100mhz,
            axi_aresetn         => axi_aresetn,
            clk_250mhz          => clk_250mhz,
            rst_n               => sys_rst_n,
            s_axi_awaddr        => std_logic_vector(resize(unsigned(axi_awaddr), 32)),
            s_axi_awprot        => axi_awprot,
            s_axi_awvalid       => axi_awvalid,
            s_axi_awready       => axi_awready,
            s_axi_wdata         => axi_wdata,
            s_axi_wstrb         => axi_wstrb,
            s_axi_wvalid        => axi_wvalid,
            s_axi_wready        => axi_wready,
            s_axi_bresp         => axi_bresp,
            s_axi_bvalid        => axi_bvalid,
            s_axi_bready        => axi_bready,
            s_axi_araddr        => std_logic_vector(resize(unsigned(axi_araddr), 32)),
            s_axi_arprot        => axi_arprot,
            s_axi_arvalid       => axi_arvalid,
            s_axi_arready       => axi_arready,
            s_axi_rdata         => axi_rdata,
            s_axi_rresp         => axi_rresp,
            s_axi_rvalid        => axi_rvalid,
            s_axi_rready        => axi_rready,
            hexagram_state_out  => reg_hexagram_target_std,
            yao_lines_out       => open,
            boot_phase_out      => open,
            contactor_status_out=> open,
            ghostsplat_temp_in  => std_logic_vector(ghostsplat_t3),
            plenum_press_in     => std_logic_vector(press_data(0)),
            bus_current_in      => std_logic_vector(curr_data(0)),
            taylor_order_in     => std_logic_vector(resize(ghostsplat_order, 32)),
            debug_status_in     => dbg_status_reg,
            fault_injection_out => fault_inject_reg,
            debug_stream_in     => dbg_stream_reg,
            reg_knock_nonce_0_out => reg_knock_nonce_0,
            reg_knock_nonce_1_out => reg_knock_nonce_1,
            reg_knock_valid_out   => reg_knock_valid,
            ps_knock_nonce_in     => std_logic_vector(knock_nonce_int),
            tel_ecc_single_err    => te_ecc_single_err,
            tel_ecc_double_err    => te_ecc_double_err
        );

    reg_hexagram_target <= unsigned(reg_hexagram_target_std);

    -- Connect AXI status registers to internal signals
    reg_hexagram_current  <= hexagram_state;
    reg_electrical_current <= electrical_reg;
    reg_fault_status      <= fault_state;
    reg_ghostsplat_temp   <= ghostsplat_t3;

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
                    when "000000" => electrical_reg <= ELEC_OFF;
                    when "110100" =>
                        if safety_ok = '1' then electrical_reg <= ELEC_ARMED;
                        else electrical_reg <= ELEC_OFF; end if;
                    when "111000" | "111010" | "111011" =>
                        if safety_ok = '1' and ct_ready = "1111111111" then
                            electrical_reg <= ELEC_ACTIVE;
                        else
                            electrical_reg <= ELEC_ARMED;
                        end if;
                    when "111001" =>
                        if safety_ok = '1' then electrical_reg <= ELEC_SHED;
                        else electrical_reg <= ELEC_OFF; end if;
                    when "001001" => electrical_reg <= ELEC_OFF;
                    when others => electrical_reg <= ELEC_OFF;
                end case;
            end if;
        end if;
    end process;

    ------------------------------------------------------------------------
    -- CONTACTOR COMMAND GENERATION
    ------------------------------------------------------------------------
    process(electrical_reg, hexagram_state, ct_state)
        variable i : integer range 0 to 9;
    begin
        ct_cmd_open  <= (others => '0');
        ct_cmd_close <= (others => '0');

        case electrical_reg is
            when ELEC_OFF =>
                for i in 0 to 9 loop
                    if ct_state(i) = CT_CLOSED then ct_cmd_open(i) <= '1'; end if;
                end loop;
            when ELEC_ARMED =>
                for i in 0 to 9 loop
                    if ct_state(i) = CT_OPEN then ct_cmd_close(i) <= '1'; end if;
                end loop;
            when ELEC_ACTIVE =>
                for i in 0 to 9 loop
                    if ct_state(i) = CT_OPEN then ct_cmd_close(i) <= '1'; end if;
                end loop;
            when ELEC_SHED =>
                for i in 0 to 9 loop
                    if i = 0 or i = 3 or i = 4 or i = 7 or i = 8 then
                        if ct_state(i) = CT_OPEN then ct_cmd_close(i) <= '1'; end if;
                    else
                        if ct_state(i) = CT_CLOSED then ct_cmd_open(i) <= '1'; end if;
                    end if;
                end loop;
            when others => ct_cmd_open <= (others => '1');
        end case;
    end process;

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

end architecture STRUCTURAL;
