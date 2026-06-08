library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use work.POG2_MHD_TYPES.all;

--============================================================================
-- TELEMETRY_ENCODER
-- Assembles 64-bit packets from system state and transmits via UART
-- Baud rate: 115200 (configurable via AXI register)
-- Format: 8-N-1
-- Packet structure (64 bits):
--   [63:58] = hexagram_state (6 bits)
--   [57:56] = electrical_reg (2 bits)
--   [55:10] = fault_flags (46 bits)
--   [9:4]   = taylor_order (3 bits) + prediction_valid (1 bit) + reserved (2 bits)
--   [3:0]   = 4-bit CRC (XOR-based)
-- Transmission time: 64 bits * (1 start + 8 data + 1 stop) / 115200 = 5.56 ms
--============================================================================

entity TELEMETRY_ENCODER is
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
end entity TELEMETRY_ENCODER;

architecture rtl of TELEMETRY_ENCODER is

    -- -----------------------------------------------------------------------
    -- UART Timing (115200 baud @ 250 MHz)
    -- -----------------------------------------------------------------------
    constant BAUD_DIV       : integer := 2170;  -- 250,000,000 / 115,200 ≈ 2170.14
    constant BAUD_DIV_HALF  : integer := 1085;  -- Half-bit for sampling

    -- -----------------------------------------------------------------------
    -- Packet Assembly Registers
    -- -----------------------------------------------------------------------
    signal packet_reg       : std_logic_vector(63 downto 0) := (others => '0');
    signal tx_shift_reg     : std_logic_vector(9 downto 0) := (others => '1');
    signal bit_counter      : unsigned(6 downto 0) := (others => '0');
    signal byte_counter     : unsigned(3 downto 0) := (others => '0');
    signal baud_counter     : unsigned(11 downto 0) := (others => '0');
    signal tx_active        : std_logic := '0';
    signal tx_done_reg      : std_logic := '0';

    -- -----------------------------------------------------------------------
    -- TX State Machine
    -- -----------------------------------------------------------------------
    type TX_STATE_T is (ST_IDLE, ST_START, ST_DATA, ST_STOP, ST_GAP);
    signal tx_state         : TX_STATE_T := ST_IDLE;

    -- -----------------------------------------------------------------------
    -- CRC-4 Calculation (XOR-based, not polynomial — lightweight)
    -- Computes XOR of all 4-bit nibbles in the packet
    -- -----------------------------------------------------------------------
    pure function crc4(data : std_logic_vector(59 downto 0)) return std_logic_vector is
        variable result : std_logic_vector(3 downto 0) := (others => '0');
        variable nibble : std_logic_vector(3 downto 0);
    begin
        for i in 0 to 14 loop
            nibble := data(i*4+3 downto i*4);
            result := result xor nibble;
        end loop;
        return result;
    end function crc4;

    -- -----------------------------------------------------------------------
    -- Packet Builder
    -- Assembles 64-bit packet from system state
    -- -----------------------------------------------------------------------
    pure function build_packet(
        hex     : HEXAGRAM_T;
        elec    : ELECTRICAL_REG_T;
        faults  : std_logic_vector(FAULT_STATES-1 downto 0);
        taylor  : unsigned(2 downto 0);
        pred_valid : std_logic
    ) return std_logic_vector is
        variable pkt : std_logic_vector(63 downto 0);
        variable status : std_logic_vector(5 downto 0);
    begin
        -- [63:58] Hexagram state
        pkt(63 downto 58) := std_logic_vector(hex);
        -- [57:56] Electrical register
        pkt(57 downto 56) := std_logic_vector(elec);
        -- [55:10] Fault flags (46 bits)
        pkt(55 downto 10) := faults;
        -- [9:4] Status: taylor_order(2:0) + prediction_valid + reserved(1:0)
        status := std_logic_vector(taylor) & pred_valid & "00";
        pkt(9 downto 4) := status;
        -- [3:0] CRC-4 of upper 60 bits
        pkt(3 downto 0) := crc4(pkt(63 downto 4));
        return pkt;
    end function build_packet;

begin

    -- =====================================================================
    -- Packet Assembly (on tick_strobe)
    -- =====================================================================
    process(clk)
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                packet_reg <= (others => '0');
            else
                if tick_strobe = '1' then
                    packet_reg <= build_packet(
                        hexagram_state,
                        electrical_reg,
                        fault_flags,
                        taylor_order,
                        '1'  -- prediction_valid (assumed true when tick fires)
                    );
                end if;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- UART Transmitter State Machine
    -- Transmits 8 bytes (64 bits) as 8 UART frames
    -- Each frame: 1 start bit (0) + 8 data bits + 1 stop bit (1)
    --=====================================================================
    process(clk)
        variable current_byte : std_logic_vector(7 downto 0);
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                tx_state <= ST_IDLE;
                tx_shift_reg <= (others => '1');
                bit_counter <= (others => '0');
                byte_counter <= (others => '0');
                baud_counter <= (others => '0');
                tx_active <= '0';
                tx_done_reg <= '0';
            else
                tx_done_reg <= '0';

                case tx_state is
                    when ST_IDLE =>
                        tx_shift_reg <= (others => '1');
                        tx_active <= '0';
                        if tick_strobe = '1' then
                            -- Start transmission of new packet
                            byte_counter <= (others => '0');
                            tx_state <= ST_START;
                            tx_active <= '1';
                        end if;

                    when ST_START =>
                        tx_active <= '1';
                        if baud_counter = to_unsigned(BAUD_DIV - 1, 12) then
                            baud_counter <= (others => '0');
                            -- Load next byte from packet_reg
                            case byte_counter is
                                when "0000" => current_byte := packet_reg(63 downto 56);
                                when "0001" => current_byte := packet_reg(55 downto 48);
                                when "0010" => current_byte := packet_reg(47 downto 40);
                                when "0011" => current_byte := packet_reg(39 downto 32);
                                when "0100" => current_byte := packet_reg(31 downto 24);
                                when "0101" => current_byte := packet_reg(23 downto 16);
                                when "0110" => current_byte := packet_reg(15 downto 8);
                                when "0111" => current_byte := packet_reg(7 downto 0);
                                when others => current_byte := (others => '0');
                            end case;
                            -- Load shift register: start bit + 8 data bits (LSB first) + stop bit
                            tx_shift_reg <= '1' & current_byte & '0';  -- stop & data & start
                            bit_counter <= to_unsigned(9, 7);  -- 10 bits total
                            tx_state <= ST_DATA;
                        else
                            baud_counter <= baud_counter + 1;
                        end if;

                    when ST_DATA =>
                        if baud_counter = to_unsigned(BAUD_DIV - 1, 12) then
                            baud_counter <= (others => '0');
                            -- Shift out LSB
                            tx_shift_reg <= '1' & tx_shift_reg(9 downto 1);
                            if bit_counter = 0 then
                                tx_state <= ST_STOP;
                            else
                                bit_counter <= bit_counter - 1;
                            end if;
                        else
                            baud_counter <= baud_counter + 1;
                        end if;

                    when ST_STOP =>
                        -- Ensure stop bit is held for full bit time
                        if baud_counter = to_unsigned(BAUD_DIV - 1, 12) then
                            baud_counter <= (others => '0');
                            if byte_counter = "0111" then
                                -- All 8 bytes sent
                                tx_done_reg <= '1';
                                tx_state <= ST_GAP;
                            else
                                byte_counter <= byte_counter + 1;
                                tx_state <= ST_START;
                            end if;
                        else
                            baud_counter <= baud_counter + 1;
                        end if;

                    when ST_GAP =>
                        -- Inter-packet gap: 1 bit time
                        if baud_counter = to_unsigned(BAUD_DIV - 1, 12) then
                            baud_counter <= (others => '0');
                            tx_state <= ST_IDLE;
                            tx_active <= '0';
                        else
                            baud_counter <= baud_counter + 1;
                        end if;

                    when others =>
                        tx_state <= ST_IDLE;
                end case;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- Output Assignment
    -- =====================================================================
    uart_tx <= tx_shift_reg(0) when tx_active = '1' else '1';
    packet_sent <= tx_done_reg;

end architecture rtl;

--============================================================================
-- End of TELEMETRY_ENCODER
--============================================================================
