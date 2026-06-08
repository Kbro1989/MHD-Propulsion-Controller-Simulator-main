library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use work.POG2_MHD_TYPES.all;

--============================================================================
-- SENSOR_ACQUISITION
-- Time-Division Multiplexed SPI Master for 22 sensor channels
-- 16x Temperature (RTD/thermocouple) + 4x Pressure + 2x Current/Voltage
-- ADC: 24-bit resolution, SPI mode 0 (CPOL=0, CPHA=0)
-- Sample rate: 1 kSPS per channel, 22 channels = 22 ksps total
-- Acquisition window: < 30 ms per subtick (budget: 200 ms I/O window)
-- Filter: 3-sample median filter per channel
--============================================================================

entity SENSOR_ACQUISITION is
    port (
        clk             : in  std_logic;
        reset_n         : in  std_logic;
        acquire_strobe  : in  std_logic;     -- Trigger from subtick generator
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
end entity SENSOR_ACQUISITION;

architecture rtl of SENSOR_ACQUISITION is

    -- -----------------------------------------------------------------------
    -- SPI Timing Constants (250 MHz clock)
    -- -----------------------------------------------------------------------
    constant SPI_DIV        : integer := 125;     -- 250 MHz / 125 = 2 MHz SPI clock
    constant SPI_SCK_CYCLES : integer := 24 * SPI_DIV; -- 24 bits * 125 = 3,000 cycles
    constant CS_SETUP_CYCLES: integer := 10;      -- 40 ns CS setup
    constant CS_HOLD_CYCLES : integer := 10;      -- 40 ns CS hold
    constant INTER_CS_GAP   : integer := 50;      -- 200 ns between conversions

    -- -----------------------------------------------------------------------
    -- Channel Mapping (22 channels across 4 SPI chip-selects)
    -- CS0: Temp 0-7   (8 channels)
    -- CS1: Temp 8-15  (8 channels)
    -- CS2: Pressure 0-3 + Current/Voltage 0-1 (6 channels)
    -- CS3: Spare / calibration
    -- -----------------------------------------------------------------------
    constant N_CHANNELS     : integer := 22;
    constant N_CS           : integer := 4;

    type CHANNEL_MAP_T is array (0 to N_CHANNELS-1) of integer range 0 to 3;
    constant CHANNEL_CS : CHANNEL_MAP_T := (
        0, 0, 0, 0, 0, 0, 0, 0,   -- Temp 0-7  → CS0
        1, 1, 1, 1, 1, 1, 1, 1,   -- Temp 8-15 → CS1
        2, 2, 2, 2,               -- Pressure 0-3 → CS2
        2, 2                      -- CV 0-1 → CS2
    );

    type CHANNEL_ADDR_T is array (0 to N_CHANNELS-1) of unsigned(2 downto 0);
    constant CHANNEL_ADDR : CHANNEL_ADDR_T := (
        "000", "001", "010", "011", "100", "101", "110", "111",  -- CS0
        "000", "001", "010", "011", "100", "101", "110", "111",  -- CS1
        "000", "001", "010", "011",                               -- CS2 pressure
        "100", "101"                                                -- CS2 CV
    );

    -- -----------------------------------------------------------------------
    -- Acquisition FSM
    -- -----------------------------------------------------------------------
    type ACQ_STATE_T is (
        ST_IDLE,
        ST_CS_SETUP,
        ST_TX_CMD,
        ST_WAIT_CONV,
        ST_RX_DATA,
        ST_CS_HOLD,
        ST_GAP,
        ST_FILTER,
        ST_DONE
    );

    -- -----------------------------------------------------------------------
    -- Internal Registers
    -- -----------------------------------------------------------------------
    signal acq_state        : ACQ_STATE_T := ST_IDLE;
    signal channel_idx      : unsigned(4 downto 0) := (others => '0');
    signal bit_counter      : unsigned(4 downto 0) := (others => '0');
    spi_div_counter        : unsigned(6 downto 0) := (others => '0');
    signal sck_reg          : std_logic := '0';
    signal cs_n_reg         : std_logic_vector(3 downto 0) := (others => '1');
    signal mosi_reg         : std_logic := '0';
    signal shift_reg        : std_logic_vector(23 downto 0) := (others => '0');
    signal cycle_counter    : unsigned(15 downto 0) := (others => '0');
    signal valid_reg        : std_logic := '0';

    -- Raw data buffers (before median filter)
    signal raw_temp         : TEMP_ARRAY_T := (others => (others => '0'));
    signal raw_pressure     : PRESSURE_ARRAY_T := (others => (others => '0'));
    signal raw_cv           : CV_ARRAY_T := (others => (others => '0'));

    -- Median filter shift registers (3 samples per channel)
    type MEDIAN_BUF_T is array (0 to 2) of unsigned(15 downto 0);
    type MEDIAN_ARRAY_T is array (0 to N_TEMP-1) of MEDIAN_BUF_T;
    signal median_buf       : MEDIAN_ARRAY_T := (others => (others => (others => '0')));
    signal median_ptr       : unsigned(1 downto 0) := (others => '0');

    -- -----------------------------------------------------------------------
    -- Median Filter Function (3-sample)
    -- Returns the middle value of three unsigned 16-bit samples
    -- -----------------------------------------------------------------------
    pure function median_3(a, b, c : unsigned(15 downto 0)) return unsigned is
    begin
        if a >= b then
            if b >= c then
                return b;           -- a >= b >= c
            elsif a >= c then
                return c;           -- a >= c >= b
            else
                return a;           -- c >= a >= b
            end if;
        else
            if a >= c then
                return a;           -- b >= a >= c
            elsif b >= c then
                return c;           -- b >= c >= a
            else
                return b;           -- c >= b >= a
            end if;
        end if;
    end function median_3;

    -- -----------------------------------------------------------------------
    -- SPI Command Builder
    -- Builds 24-bit ADC command: [7-bit config | 3-bit addr | 14-bit don't care]
    -- Config: 0x01 = single conversion, unipolar, normal mode
    -- -----------------------------------------------------------------------
    pure function build_cmd(addr : unsigned(2 downto 0)) return std_logic_vector is
        variable cmd : std_logic_vector(23 downto 0);
    begin
        cmd(23 downto 17) := "0000001";     -- Config: single conversion
        cmd(16 downto 14) := std_logic_vector(addr);  -- Channel address
        cmd(13 downto 0)  := (others => '0');         -- Don't care
        return cmd;
    end function build_cmd;

begin

    -- =====================================================================
    -- SPI Clock Generator (2 MHz = 250 MHz / 125)
    -- =====================================================================
    process(clk)
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                spi_div_counter <= (others => '0');
                sck_reg <= '0';
            else
                if acq_state = ST_TX_CMD or acq_state = ST_RX_DATA then
                    if spi_div_counter = to_unsigned(SPI_DIV - 1, 7) then
                        spi_div_counter <= (others => '0');
                        sck_reg <= not sck_reg;
                    else
                        spi_div_counter <= spi_div_counter + 1;
                    end if;
                else
                    spi_div_counter <= (others => '0');
                    sck_reg <= '0';
                end if;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- Acquisition State Machine
    -- =====================================================================
    process(clk)
        variable current_cs   : integer range 0 to 3;
        variable current_addr : unsigned(2 downto 0);
        variable cmd_word     : std_logic_vector(23 downto 0);
        variable sample_24bit : unsigned(23 downto 0);
        variable sample_16bit : unsigned(15 downto 0);
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                acq_state <= ST_IDLE;
                channel_idx <= (others => '0');
                bit_counter <= (others => '0');
                cs_n_reg <= (others => '1');
                mosi_reg <= '0';
                shift_reg <= (others => '0');
                cycle_counter <= (others => '0');
                valid_reg <= '0';
                median_ptr <= (others => '0');
            else
                case acq_state is
                    when ST_IDLE =>
                        valid_reg <= '0';
                        cs_n_reg <= (others => '1');
                        mosi_reg <= '0';
                        cycle_counter <= (others => '0');
                        if acquire_strobe = '1' then
                            acq_state <= ST_CS_SETUP;
                            channel_idx <= (others => '0');
                        end if;

                    when ST_CS_SETUP =>
                        cycle_counter <= cycle_counter + 1;
                        if cycle_counter = to_unsigned(CS_SETUP_CYCLES, 16) then
                            current_cs := CHANNEL_CS(to_integer(channel_idx));
                            current_addr := CHANNEL_ADDR(to_integer(channel_idx));
                            cmd_word := build_cmd(current_addr);
                            shift_reg <= cmd_word;
                            cs_n_reg <= (others => '1');
                            cs_n_reg(current_cs) <= '0';
                            bit_counter <= to_unsigned(23, 5);
                            acq_state <= ST_TX_CMD;
                            cycle_counter <= (others => '0');
                        end if;

                    when ST_TX_CMD =>
                        -- Shift out command on MOSI, MSB first
                        if sck_reg = '0' and spi_div_counter = 0 then
                            mosi_reg <= shift_reg(23);
                            shift_reg <= shift_reg(22 downto 0) & '0';
                            if bit_counter = 0 then
                                acq_state <= ST_WAIT_CONV;
                                cycle_counter <= (others => '0');
                            else
                                bit_counter <= bit_counter - 1;
                            end if;
                        end if;

                    when ST_WAIT_CONV =>
                        -- Wait for ADC conversion (typical 1 μs for 24-bit SAR)
                        cycle_counter <= cycle_counter + 1;
                        if cycle_counter = to_unsigned(250, 16) then  -- 1 μs @ 250 MHz
                            acq_state <= ST_RX_DATA;
                            bit_counter <= to_unsigned(23, 5);
                            shift_reg <= (others => '0');
                        end if;

                    when ST_RX_DATA =>
                        -- Shift in data on MISO, MSB first
                        if sck_reg = '1' and spi_div_counter = to_unsigned(SPI_DIV/2, 7) then
                            shift_reg <= shift_reg(22 downto 0) & spi_miso;
                            if bit_counter = 0 then
                                acq_state <= ST_CS_HOLD;
                                cycle_counter <= (others => '0');
                            else
                                bit_counter <= bit_counter - 1;
                            end if;
                        end if;

                    when ST_CS_HOLD =>
                        cycle_counter <= cycle_counter + 1;
                        if cycle_counter = to_unsigned(CS_HOLD_CYCLES, 16) then
                            cs_n_reg <= (others => '1');
                            acq_state <= ST_GAP;
                            cycle_counter <= (others => '0');
                        end if;

                    when ST_GAP =>
                        cycle_counter <= cycle_counter + 1;
                        if cycle_counter = to_unsigned(INTER_CS_GAP, 16) then
                            -- Store raw sample
                            sample_24bit := unsigned(shift_reg);
                            -- Scale 24-bit to 16-bit: drop lower 8 bits
                            sample_16bit := sample_24bit(23 downto 8);

                            -- Route to appropriate buffer
                            if channel_idx < 16 then
                                -- Temperature channels 0-15
                                raw_temp(to_integer(channel_idx)) <= sample_16bit;
                                -- Update median buffer
                                median_buf(to_integer(channel_idx))(to_integer(median_ptr)) <= sample_16bit;
                            elsif channel_idx < 20 then
                                -- Pressure channels 0-3
                                raw_pressure(to_integer(channel_idx - 16)) <= sample_16bit;
                            else
                                -- CV channels 0-1
                                raw_cv(to_integer(channel_idx - 20)) <= sample_16bit;
                            end if;

                            -- Next channel or done
                            if channel_idx = to_unsigned(N_CHANNELS - 1, 5) then
                                acq_state <= ST_FILTER;
                                median_ptr <= median_ptr + 1;
                            else
                                channel_idx <= channel_idx + 1;
                                acq_state <= ST_CS_SETUP;
                            end if;
                            cycle_counter <= (others => '0');
                        end if;

                    when ST_FILTER =>
                        -- Apply 3-sample median filter to all temperature channels
                        for i in 0 to N_TEMP-1 loop
                            temp_array(i) <= median_3(
                                median_buf(i)(0),
                                median_buf(i)(1),
                                median_buf(i)(2)
                            );
                        end loop;
                        -- Pressure and CV pass through unfiltered (lower noise)
                        pressure_array <= raw_pressure;
                        cv_array <= raw_cv;
                        valid_reg <= '1';
                        acq_state <= ST_DONE;

                    when ST_DONE =>
                        -- Hold valid for one cycle, then return to idle
                        valid_reg <= '0';
                        acq_state <= ST_IDLE;

                    when others =>
                        acq_state <= ST_IDLE;
                end case;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- Output Assignment
    -- =====================================================================
    spi_clk  <= sck_reg;
    spi_mosi <= mosi_reg;
    spi_cs_n <= cs_n_reg;
    data_valid <= valid_reg;
    acquisition_time <= cycle_counter;

end architecture rtl;

--============================================================================
-- End of SENSOR_ACQUISITION
--============================================================================
