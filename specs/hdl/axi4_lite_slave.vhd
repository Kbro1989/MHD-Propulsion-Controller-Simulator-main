library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use work.POG2_MHD_TYPES.all;

--============================================================================
-- AXI4_LITE_SLAVE
-- Register interface between ARM PS (Zynq UltraScale+) and POG2-MHD PL
-- Address width: 16 bits (word-addressable)
-- Data width: 32 bits
-- Register map: 16 registers (0x0000 to 0x003C) + version (0x00FC)
-- Response: OKAY (00) for valid addresses, SLVERR (10) for invalid
--============================================================================

entity AXI4_LITE_SLAVE is
    port (
        aclk            : in  std_logic;
        aresetn         : in  std_logic;
        -- Write Address Channel
        awaddr          : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
        awvalid         : in  std_logic;
        awready         : out std_logic;
        -- Write Data Channel
        wdata           : in  std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
        wstrb           : in  std_logic_vector(AXI_STRB_WIDTH-1 downto 0);
        wvalid          : in  std_logic;
        wready          : out std_logic;
        -- Write Response Channel
        bresp           : out std_logic_vector(1 downto 0);
        bvalid          : out std_logic;
        bready          : in  std_logic;
        -- Read Address Channel
        araddr          : in  std_logic_vector(AXI_ADDR_WIDTH-1 downto 0);
        arvalid         : in  std_logic;
        arready         : out std_logic;
        -- Read Data Channel
        rdata           : out std_logic_vector(AXI_DATA_WIDTH-1 downto 0);
        rresp           : out std_logic_vector(1 downto 0);
        rvalid          : out std_logic;
        rready          : in  std_logic;
        -- Register Write Interface (to POG2-MHD modules)
        reg_hex_state   : out HEXAGRAM_T;
        reg_elec_state  : out ELECTRICAL_REG_T;
        reg_fault_mask  : out std_logic_vector(FAULT_STATES-1 downto 0);
        reg_temp_thresh : out Q16_16_T;
        reg_crit_timeout: out unsigned(15 downto 0);
        reg_telem_rate  : out unsigned(15 downto 0);
        reg_safety_override : out std_logic;
        -- Register Read Interface (from POG2-MHD modules)
        reg_read_hex    : in  HEXAGRAM_T;
        reg_read_elec   : in  ELECTRICAL_REG_T;
        reg_read_fault  : in  std_logic_vector(FAULT_STATES-1 downto 0);
        reg_read_temp   : in  Q16_16_T;
        reg_read_pred   : in  Q16_16_T;
        reg_read_decoh  : in  Q16_16_T;
        reg_read_safety : in  std_logic_vector(7 downto 0);
        reg_read_version: in  std_logic_vector(31 downto 0)
    );
end entity AXI4_LITE_SLAVE;

architecture rtl of AXI4_LITE_SLAVE is

    -- -----------------------------------------------------------------------
    -- AXI State Machine
    -- -----------------------------------------------------------------------
    type AXI_STATE_T is (ST_IDLE, ST_AW_WAIT, ST_W_WAIT, ST_B_RESP,
                         ST_AR_WAIT, ST_R_RESP);
    signal axi_state        : AXI_STATE_T := ST_IDLE;

    -- -----------------------------------------------------------------------
    -- Internal Registers (shadow copies for readback)
    -- -----------------------------------------------------------------------
    signal shadow_hex       : HEXAGRAM_T := HEX_IDLE;
    signal shadow_elec      : ELECTRICAL_REG_T := ELEC_OFF;
    signal shadow_fault_mask: std_logic_vector(FAULT_STATES-1 downto 0) := (others => '0');
    signal shadow_temp_thresh : Q16_16_T := T_SALT_START_K;
    signal shadow_crit_timeout : unsigned(15 downto 0) := to_unsigned(47, 16);
    signal shadow_telem_rate : unsigned(15 downto 0) := to_unsigned(11520, 16);
    signal shadow_safety_override : std_logic := '0';

    -- -----------------------------------------------------------------------
    -- Transaction Latches
    -- -----------------------------------------------------------------------
    signal latched_awaddr : std_logic_vector(AXI_ADDR_WIDTH-1 downto 0) := (others => '0');
    signal latched_wdata  : std_logic_vector(AXI_DATA_WIDTH-1 downto 0) := (others => '0');
    signal latched_wstrb  : std_logic_vector(AXI_STRB_WIDTH-1 downto 0) := (others => '0');
    signal latched_araddr : std_logic_vector(AXI_ADDR_WIDTH-1 downto 0) := (others => '0');

    -- -----------------------------------------------------------------------
    -- Response signals
    -- -----------------------------------------------------------------------
    signal bresp_reg      : std_logic_vector(1 downto 0) := AXI_RESP_OKAY;
    signal rresp_reg      : std_logic_vector(1 downto 0) := AXI_RESP_OKAY;
    signal rdata_reg      : std_logic_vector(AXI_DATA_WIDTH-1 downto 0) := (others => '0');

    -- -----------------------------------------------------------------------
    -- Address decode function
    -- Returns register index 0-15 for valid addresses, 16 for invalid
    -- -----------------------------------------------------------------------
    pure function addr_decode(addr : std_logic_vector(15 downto 0)) return integer is
    begin
        case addr is
            when REG_HEXAGRAM_STATE => return 0;
            when REG_ELEC_STATE     => return 1;
            when REG_FAULT_FLAGS    => return 2;
            when REG_TEMP_THRESH    => return 3;
            when REG_CRIT_TIMEOUT   => return 4;
            when REG_GHOST_ORDER    => return 5;
            when REG_PRED_TEMP      => return 6;
            when REG_DECOHERENCE    => return 7;
            when REG_CONTACTOR_MAP  => return 8;
            when REG_CHOKE_PHASE    => return 9;
            when REG_SAFETY_STATUS  => return 10;
            when REG_TELEM_RATE     => return 11;
            when REG_BOOT_SEQ       => return 12;
            when REG_IMU_STATUS     => return 13;
            when x"0010"            => return 14;  -- Reserved
            when x"0014"            => return 15;  -- Reserved
            when REG_VERSION        => return 16;  -- Read-only version
            when others             => return 17;  -- Invalid
        end case;
    end function addr_decode;

    -- -----------------------------------------------------------------------
    -- Write strobe mask function
    -- Applies byte-wise write enable from wstrb
    -- -----------------------------------------------------------------------
    pure function apply_wstrb(
        old_val : std_logic_vector(31 downto 0);
        new_val : std_logic_vector(31 downto 0);
        strb    : std_logic_vector(3 downto 0)
    ) return std_logic_vector is
        variable result : std_logic_vector(31 downto 0);
    begin
        for i in 0 to 3 loop
            if strb(i) = '1' then
                result(i*8+7 downto i*8) := new_val(i*8+7 downto i*8);
            else
                result(i*8+7 downto i*8) := old_val(i*8+7 downto i*8);
            end if;
        end loop;
        return result;
    end function apply_wstrb;

begin

    -- =====================================================================
    -- AXI State Machine
    -- =====================================================================
    process(aclk)
        variable reg_idx : integer range 0 to 17;
        variable write_val : std_logic_vector(31 downto 0);
    begin
        if rising_edge(aclk) then
            if aresetn = '0' then
                axi_state <= ST_IDLE;
                awready <= '0';
                wready <= '0';
                bvalid <= '0';
                arready <= '0';
                rvalid <= '0';
                bresp_reg <= AXI_RESP_OKAY;
                rresp_reg <= AXI_RESP_OKAY;
                rdata_reg <= (others => '0');
                shadow_hex <= HEX_IDLE;
                shadow_elec <= ELEC_OFF;
                shadow_fault_mask <= (others => '0');
                shadow_temp_thresh <= T_SALT_START_K;
                shadow_crit_timeout <= to_unsigned(47, 16);
                shadow_telem_rate <= to_unsigned(11520, 16);
                shadow_safety_override <= '0';
            else
                case axi_state is
                    when ST_IDLE =>
                        awready <= '0';
                        wready <= '0';
                        bvalid <= '0';
                        arready <= '0';
                        rvalid <= '0';

                        -- Priority: read over write (simpler arbitration)
                        if arvalid = '1' then
                            latched_araddr <= araddr;
                            axi_state <= ST_AR_WAIT;
                        elsif awvalid = '1' then
                            latched_awaddr <= awaddr;
                            awready <= '1';
                            axi_state <= ST_AW_WAIT;
                        end if;

                    when ST_AW_WAIT =>
                        awready <= '0';
                        if wvalid = '1' then
                            latched_wdata <= wdata;
                            latched_wstrb <= wstrb;
                            wready <= '1';
                            axi_state <= ST_W_WAIT;
                        end if;

                    when ST_W_WAIT =>
                        wready <= '0';
                        -- Decode address and perform write
                        reg_idx := addr_decode(latched_awaddr);
                        write_val := apply_wstrb(
                            std_logic_vector(to_unsigned(0, 32)),  -- old_val placeholder
                            latched_wdata,
                            latched_wstrb
                        );

                        if reg_idx = 17 then
                            bresp_reg <= AXI_RESP_SLVERR;
                        else
                            bresp_reg <= AXI_RESP_OKAY;
                            -- Update shadow registers
                            case reg_idx is
                                when 0 =>  -- Hexagram state
                                    shadow_hex <= unsigned(write_val(5 downto 0));
                                when 1 =>  -- Electrical state
                                    shadow_elec <= unsigned(write_val(1 downto 0));
                                when 2 =>  -- Fault mask
                                    shadow_fault_mask <= write_val(FAULT_STATES-1 downto 0);
                                when 3 =>  -- Temp threshold
                                    shadow_temp_thresh <= signed(write_val);
                                when 4 =>  -- CRIT timeout
                                    shadow_crit_timeout <= unsigned(write_val(15 downto 0));
                                when 5 =>  -- GhostSplat order (read-only, ignore write)
                                    null;
                                when 11 => -- Telemetry rate
                                    shadow_telem_rate <= unsigned(write_val(15 downto 0));
                                when 12 => -- Safety override
                                    shadow_safety_override <= write_val(0);
                                when others =>
                                    null;
                            end case;
                        end if;
                        bvalid <= '1';
                        axi_state <= ST_B_RESP;

                    when ST_B_RESP =>
                        if bready = '1' then
                            bvalid <= '0';
                            axi_state <= ST_IDLE;
                        end if;

                    when ST_AR_WAIT =>
                        -- Decode address and perform read
                        reg_idx := addr_decode(latched_araddr);
                        arready <= '1';

                        if reg_idx = 17 then
                            rresp_reg <= AXI_RESP_SLVERR;
                            rdata_reg <= (others => '0');
                        else
                            rresp_reg <= AXI_RESP_OKAY;
                            case reg_idx is
                                when 0 =>  -- Hexagram state
                                    rdata_reg <= "00000000000000000000000000" & std_logic_vector(reg_read_hex);
                                when 1 =>  -- Electrical state
                                    rdata_reg <= "000000000000000000000000000000" & std_logic_vector(reg_read_elec);
                                when 2 =>  -- Fault flags
                                    rdata_reg <= "000000000000000000" & reg_read_fault;
                                when 3 =>  -- Temp threshold (shadow)
                                    rdata_reg <= std_logic_vector(shadow_temp_thresh);
                                when 4 =>  -- CRIT timeout (shadow)
                                    rdata_reg <= "0000000000000000" & std_logic_vector(shadow_crit_timeout);
                                when 5 =>  -- GhostSplat order (read-only)
                                    rdata_reg <= (others => '0');  -- Placeholder
                                when 6 =>  -- Predicted temp
                                    rdata_reg <= std_logic_vector(reg_read_pred);
                                when 7 =>  -- Decoherence rate
                                    rdata_reg <= std_logic_vector(reg_read_decoh);
                                when 10 => -- Safety status
                                    rdata_reg <= "000000000000000000000000" & reg_read_safety;
                                when 11 => -- Telemetry rate (shadow)
                                    rdata_reg <= "0000000000000000" & std_logic_vector(shadow_telem_rate);
                                when 12 => -- Safety override (shadow)
                                    rdata_reg <= "0000000000000000000000000000000" & shadow_safety_override;
                                when 16 => -- Version (read-only)
                                    rdata_reg <= reg_read_version;
                                when others =>
                                    rdata_reg <= (others => '0');
                            end case;
                        end if;
                        rvalid <= '1';
                        axi_state <= ST_R_RESP;

                    when ST_R_RESP =>
                        arready <= '0';
                        if rready = '1' then
                            rvalid <= '0';
                            axi_state <= ST_IDLE;
                        end if;

                    when others =>
                        axi_state <= ST_IDLE;
                end case;
            end if;
        end if;
    end process;

    -- =====================================================================
    -- Output Assignment
    -- =====================================================================
    bresp <= bresp_reg;
    rresp <= rresp_reg;
    rdata <= rdata_reg;

    -- Register write outputs (to POG2-MHD modules)
    reg_hex_state <= shadow_hex;
    reg_elec_state <= shadow_elec;
    reg_fault_mask <= shadow_fault_mask;
    reg_temp_thresh <= shadow_temp_thresh;
    reg_crit_timeout <= shadow_crit_timeout;
    reg_telem_rate <= shadow_telem_rate;
    reg_safety_override <= shadow_safety_override;

end architecture rtl;

--============================================================================
-- End of AXI4_LITE_SLAVE
--============================================================================
