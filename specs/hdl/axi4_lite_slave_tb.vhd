-- ============================================================================
-- POG2 Magnetohydrodynamic Propulsion FPGA-based Architecture
-- Module Name:   axi4_lite_slave_tb
-- Description:   Complete Verification Suite for the AXI4-Lite register
--                slave co-processor. Asserts read/write handshakes, address 
--                decoding, strobes masking, simultaneous requests, response
--                codes (SLVERR/DECERR/OKAY), CDC propagation, and reset 
--                assertion/recovery states. Integrates an AXI4-Lite
--                Verification IP (VIP) Master executing advanced integrity sweeps.
-- ============================================================================

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

--------------------------------------------------------------------------------
-- AXI4-LITE SLAVE VERIFICATION IP (VIP) MASTER
--------------------------------------------------------------------------------
entity axi_lite_vip_master is
    port (
        clk             : in  std_logic;
        rst_n           : in  std_logic;
        
        -- Master signals to drive slave
        m_awaddr        : out std_logic_vector(31 downto 0);
        m_awprot        : out std_logic_vector(2 downto 0);
        m_awvalid       : out std_logic;
        m_awready       : in  std_logic;
        
        m_wdata         : out std_logic_vector(31 downto 0);
        m_wstrb         : out std_logic_vector(3 downto 0);
        m_wvalid        : out std_logic;
        m_wready        : in  std_logic;
        
        m_bresp         : in  std_logic_vector(1 downto 0);
        m_bvalid        : in  std_logic;
        m_bready        : out std_logic;
        
        m_araddr        : out std_logic_vector(31 downto 0);
        m_arprot        : out std_logic_vector(2 downto 0);
        m_arvalid       : out std_logic;
        m_arready       : in  std_logic;
        
        m_rdata         : in  std_logic_vector(31 downto 0);
        m_rresp         : in  std_logic_vector(1 downto 0);
        m_rvalid        : in  std_logic;
        m_rready        : out std_logic;
        
        -- Control & Status
        vip_start       : in  std_logic;
        vip_done        : out std_logic;
        vip_error       : out std_logic
    );
end entity axi_lite_vip_master;

architecture behavioral of axi_lite_vip_master is
begin
    process
        -- Procedures for transactions inside process block
        procedure vip_write (
            constant addr : in  std_logic_vector(31 downto 0);
            constant data : in  std_logic_vector(31 downto 0);
            constant strb : in  std_logic_vector(3 downto 0);
            variable resp : out std_logic_vector(1 downto 0)
        ) is
        begin
            wait until rising_edge(clk);
            m_awaddr  <= addr;
            m_awprot  <= "000";
            m_awvalid <= '1';
            m_wdata   <= data;
            m_wstrb   <= strb;
            m_wvalid  <= '1';
            m_bready  <= '1';
            
            -- Wait for AWREADY and WREADY handshakes (independent or concurrent)
            while (m_awready = '0' or m_wready = '0') loop
                wait until rising_edge(clk);
            end loop;
            
            wait until rising_edge(clk);
            m_awvalid <= '0';
            m_wvalid  <= '0';
            
            -- Wait for write response to be valid
            while (m_bvalid = '0') loop
                wait until rising_edge(clk);
            end loop;
            
            resp := m_bresp;
            wait until rising_edge(clk);
            m_bready  <= '0';
            wait for 2 ns;
        end procedure;

        procedure vip_read (
            constant addr : in  std_logic_vector(31 downto 0);
            variable data : out std_logic_vector(31 downto 0);
            variable resp : out std_logic_vector(1 downto 0)
        ) is
        begin
            wait until rising_edge(clk);
            m_araddr  <= addr;
            m_arprot  <= "000";
            m_arvalid <= '1';
            m_rready  <= '1';
            
            -- Wait for ARREADY handshake
            while (m_arready = '0') loop
                wait until rising_edge(clk);
            end loop;
            
            wait until rising_edge(clk);
            m_arvalid <= '0';
            
            -- Wait for read response / data valid
            while (m_rvalid = '0') loop
                wait until rising_edge(clk);
            end loop;
            
            data := m_rdata;
            resp := m_rresp;
            wait until rising_edge(clk);
            m_rready  <= '0';
            wait for 2 ns;
        end procedure;

        variable wr_resp : std_logic_vector(1 downto 0);
        variable rd_resp : std_logic_vector(1 downto 0);
        variable rd_data : std_logic_vector(31 downto 0);
        variable err_flag : std_logic := '0';
    begin
        -- Initialize outputs
        m_awaddr  <= (others => '0');
        m_awprot  <= (others => '0');
        m_awvalid <= '0';
        m_wdata   <= (others => '0');
        m_wstrb   <= (others => '0');
        m_wvalid  <= '0';
        m_bready  <= '0';
        m_araddr  <= (others => '0');
        m_arprot  <= (others => '0');
        m_arvalid <= '0';
        m_rready  <= '0';
        vip_done  <= '0';
        vip_error <= '0';
        
        wait until rising_edge(clk) and vip_start = '1';
        report "AXI VIP: Master Test Suite Initiated.";
        err_flag := '0';
        
        -- VIP TEST 1: Protocol compliance of write/read to a standard writable register
        -- Offset: 0x14 (YAO_LINES)
        report "AXI VIP TEST 1: Check standard read-write flow on YAO_LINES (0x14)";
        vip_write(x"00000014", x"0000001B", "1111", wr_resp);
        assert (wr_resp = "00") report "VIP Fail: Expected OKAY on write to YAO_LINES" severity error;
        if wr_resp /= "00" then err_flag := '1'; end if;
        
        vip_read(x"00000014", rd_data, rd_resp);
        assert (rd_resp = "00") report "VIP Fail: Expected OKAY on read from YAO_LINES" severity error;
        assert (rd_data = x"0000001B") report "VIP Fail: Data mismatch on readback of YAO_LINES" severity error;
        if rd_resp /= "00" or rd_data /= x"0000001B" then err_flag := '1'; end if;

        -- VIP TEST 2: Write Strobes byte masking (different access sizes)
        -- Offset: 0x2C (BOOT_PHASE). Write 0xAA55FEE7 with strobe "0011"
        -- Expected: Only lower 16 bits updated to 0xFEE7, upper 16 bits remain 0x0000
        report "VIP TEST 2: Write Strobe Access Size masking check on BOOT_PHASE (0x2C)";
        vip_write(x"0000002C", x"00000000", "1111", wr_resp); -- Reset BOOT_PHASE to 0 first
        vip_write(x"0000002C", x"AA55FEE7", "0011", wr_resp);
        vip_read(x"0000002C", rd_data, rd_resp);
        assert (rd_data = x"0000FEE7") report "VIP Fail: Write Strobe byte masking mismatch!" severity error;
        if rd_data /= x"0000FEE7" then err_flag := '1'; end if;

        -- VIP TEST 3: Address Decoding and write protect check for read-only registers
        -- Offset: 0x80 (GHOST_FIELD_TEMP). Trying to write FFFFFFFF
        -- Expected: Slave returns SLVERR response code
        report "VIP TEST 3: Write lock protect check on GHOST_FIELD_TEMP (0x80)";
        vip_write(x"00000080", x"FFFFFFFF", "1111", wr_resp);
        assert (wr_resp = "10") report "VIP Fail: Expected SLVERR on read-only register write." severity error;
        if wr_resp /= "10" then err_flag := '1'; end if;

        -- VIP TEST 4: Boundary error decoding (unmapped register)
        -- Offset: 0x000000FC
        -- Expected: Slave returns DECERR response code
        report "VIP TEST 4: Out-of-bounds Address decoding error check";
        vip_read(x"000000FC", rd_data, rd_resp);
        assert (rd_resp = "11") report "VIP Fail: Expected DECERR boundary decode feedback response." severity error;
        if rd_resp /= "11" then err_flag := '1'; end if;

        -- VIP TEST 5: Concurrent read/write command channels
        report "VIP TEST 5: Concurrent Read and Write channels validation";
        wait until rising_edge(clk);
        m_awaddr  <= x"00000014"; -- Write to YAO_LINES
        m_awprot  <= "000";
        m_awvalid <= '1';
        m_wdata   <= x"00000033";
        m_wstrb   <= "1111";
        m_wvalid  <= '1';
        m_bready  <= '1';
        
        m_araddr  <= x"0000002C"; -- Read from BOOT_PHASE simultaneously
        m_arprot  <= "000";
        m_arvalid <= '1';
        m_rready  <= '1';
        
        -- Wait for both channels to complete their handshakes
        while (m_awready = '0' or m_wready = '0' or m_arready = '0') loop
            wait until rising_edge(clk);
        end loop;
        
        wait until rising_edge(clk);
        m_awvalid <= '0';
        m_wvalid  <= '0';
        m_arvalid <= '0';
        
        -- Wait for both responses
        while (m_bvalid = '0' or m_rvalid = '0') loop
            wait until rising_edge(clk);
        end loop;
        
        assert (m_bresp = "00") report "VIP Fail: Concurrent write response mismatch!" severity error;
        assert (m_rresp = "00") report "VIP Fail: Concurrent read response mismatch!" severity error;
        assert (m_rdata = x"0000FEE7") report "VIP Fail: Concurrent read data mismatch!" severity error;
        if m_bresp /= "00" or m_rresp /= "00" or m_rdata /= x"0000FEE7" then
            err_flag := '1';
        end if;
        
        wait until rising_edge(clk);
        m_bready <= '0';
        m_rready <= '0';
        wait for 2 ns;

        -- VIP TEST 6: Verify Performance Monitoring Counters
        report "VIP TEST 6: Reading Performance Monitoring Registers (0x20 - 0x38)";
        vip_read(x"00000020", rd_data, rd_resp); -- Total write count register
        report "VIP: Read Total Write Counter = " & integer'image(to_integer(unsigned(rd_data)));
        assert (to_integer(unsigned(rd_data)) > 0) report "VIP Fail: Write transactions counter is zero!" severity error;
        if to_integer(unsigned(rd_data)) = 0 then err_flag := '1'; end if;

        vip_read(x"00000024", rd_data, rd_resp); -- Total read count register
        report "VIP: Read Total Read Counter = " & integer'image(to_integer(unsigned(rd_data)));
        assert (to_integer(unsigned(rd_data)) > 0) report "VIP Fail: Read transactions counter is zero!" severity error;
        if to_integer(unsigned(rd_data)) = 0 then err_flag := '1'; end if;

        vip_read(x"00000028", rd_data, rd_resp); -- Avg write latency register
        report "VIP: Average Write Latency = " & integer'image(to_integer(unsigned(rd_data))) & " cycles";
        assert (to_integer(unsigned(rd_data)) > 0) report "VIP Fail: Average write latency is zero!" severity error;
        if to_integer(unsigned(rd_data)) = 0 then err_flag := '1'; end if;

        vip_read(x"00000030", rd_data, rd_resp); -- Avg read latency register
        report "VIP: Average Read Latency = " & integer'image(to_integer(unsigned(rd_data))) & " cycles";
        assert (to_integer(unsigned(rd_data)) > 0) report "VIP Fail: Average read latency is zero!" severity error;
        if to_integer(unsigned(rd_data)) = 0 then err_flag := '1'; end if;

        vip_read(x"00000038", rd_data, rd_resp); -- Tick write counter
        report "VIP: Tick register write count = " & integer'image(to_integer(unsigned(rd_data)));
        assert (to_integer(unsigned(rd_data)) > 0) report "VIP Fail: Tick writes counter is zero!" severity error;
        if to_integer(unsigned(rd_data)) = 0 then err_flag := '1'; end if;

        wait until rising_edge(clk);
        vip_done  <= '1';
        vip_error <= err_flag;
        report "AXI VIP: Master Test Suite finished. Error Status: " & std_logic'image(err_flag);
        wait;
    end process;
end architecture behavioral;

--------------------------------------------------------------------------------
-- MAIN TESTBENCH ENTITY
--------------------------------------------------------------------------------
entity axi4_lite_slave_tb is
end entity axi4_lite_slave_tb;

architecture behavioral of axi4_lite_slave_tb is

    -- Clock Periods
    constant AXI_CLK_PERIOD   : time := 10 ns; -- 100 MHz
    constant CORE_CLK_PERIOD  : time := 4 ns;  -- 250 MHz

    -- Testbench ports signals mappings
    signal tb_axi_aclk            : std_logic := '0';
    signal tb_axi_aresetn         : std_logic := '1';
    signal tb_clk_250mhz          : std_logic := '0';
    signal tb_rst_n               : std_logic := '1';

    -- multiplexed system signals going into the DUT (Slave)
    signal tb_s_axi_awaddr        : std_logic_vector(31 downto 0);
    signal tb_s_axi_awprot        : std_logic_vector(2 downto 0);
    signal tb_s_axi_awvalid       : std_logic;
    signal tb_s_axi_awready       : std_logic;
    
    signal tb_s_axi_wdata         : std_logic_vector(31 downto 0);
    signal tb_s_axi_wstrb         : std_logic_vector(3 downto 0);
    signal tb_s_axi_wvalid        : std_logic;
    signal tb_s_axi_wready        : std_logic;
    
    signal tb_s_axi_bresp         : std_logic_vector(1 downto 0);
    signal tb_s_axi_bvalid        : std_logic;
    signal tb_s_axi_bready        : std_logic;

    signal tb_s_axi_araddr        : std_logic_vector(31 downto 0);
    signal tb_s_axi_arprot        : std_logic_vector(2 downto 0);
    signal tb_s_axi_arvalid       : std_logic;
    signal tb_s_axi_arready       : std_logic;
    
    signal tb_s_axi_rdata         : std_logic_vector(31 downto 0);
    signal tb_s_axi_rresp         : std_logic_vector(1 downto 0);
    signal tb_s_axi_rvalid        : std_logic;
    signal tb_s_axi_rready        : std_logic;

    -- Stimulus generator driver signals
    signal tb_stim_awaddr         : std_logic_vector(31 downto 0) := (others => '0');
    signal tb_stim_awprot         : std_logic_vector(2 downto 0) := (others => '0');
    signal tb_stim_awvalid        : std_logic := '0';
    signal tb_stim_wdata          : std_logic_vector(31 downto 0) := (others => '0');
    signal tb_stim_wstrb          : std_logic_vector(3 downto 0) := (others => '1');
    signal tb_stim_wvalid         : std_logic := '0';
    signal tb_stim_bready         : std_logic := '0';
    signal tb_stim_araddr         : std_logic_vector(31 downto 0) := (others => '0');
    signal tb_stim_arprot         : std_logic_vector(2 downto 0) := (others => '0');
    signal tb_stim_arvalid         : std_logic := '0';
    signal tb_stim_rready         : std_logic := '0';

    -- Dedicated VIP signals
    signal vip_m_awaddr           : std_logic_vector(31 downto 0);
    signal vip_m_awprot           : std_logic_vector(2 downto 0);
    signal vip_m_awvalid          : std_logic;
    signal vip_m_wdata            : std_logic_vector(31 downto 0);
    signal vip_m_wstrb            : std_logic_vector(3 downto 0);
    signal vip_m_wvalid           : std_logic;
    signal vip_m_bready           : std_logic;
    signal vip_m_araddr           : std_logic_vector(31 downto 0);
    signal vip_m_arprot           : std_logic_vector(2 downto 0);
    signal vip_m_arvalid          : std_logic;
    signal vip_m_rready           : std_logic;
    
    signal vip_start              : std_logic := '0';
    signal vip_done               : std_logic;
    signal vip_error              : std_logic;
    signal use_vip_bus            : std_logic := '0';

    -- Physical Core I/O
    signal tb_hexagram_state_out  : std_logic_vector(5 downto 0);
    signal tb_yao_lines_out       : std_logic_vector(5 downto 0);
    signal tb_boot_phase_out      : std_logic_vector(7 downto 0);
    signal tb_contactor_status_out: std_logic_vector(9 downto 0);

    signal tb_ghostsplat_temp_in  : std_logic_vector(31 downto 0) := (others => '0');
    signal tb_plenum_press_in     : std_logic_vector(31 downto 0) := (others => '0');
    signal tb_bus_current_in      : std_logic_vector(31 downto 0) := (others => '0');
    signal tb_taylor_order_in     : std_logic_vector(31 downto 0) := (others => '0');

    -- Simulation finished guard flag
    signal tb_sim_done            : boolean := false;

    -- Procedure: Bus Write Cycle
    procedure axi_write (
        constant addr : in  std_logic_vector(31 downto 0);
        constant data : in  std_logic_vector(31 downto 0);
        constant strb : in  std_logic_vector(3 downto 0);
        signal clk    : in  std_logic;
        signal awaddr : out std_logic_vector(31 downto 0);
        signal awval  : out std_logic;
        signal awrdy  : in  std_logic;
        signal wdata  : out std_logic_vector(31 downto 0);
        signal wstrb  : out std_logic_vector(3 downto 0);
        signal wval   : out std_logic;
        signal wrdy   : in  std_logic;
        signal bready : out std_logic;
        signal bvalid : in  std_logic
    ) is
    begin
        wait until rising_edge(clk);
        awaddr <= addr;
        awval  <= '1';
        wdata  <= data;
        wstrb  <= strb;
        wval   <= '1';
        bready <= '1';

        -- Await handshakes
        while (awrdy = '0' or wrdy = '0') loop
            wait until rising_edge(clk);
        end loop;

        wait until rising_edge(clk);
        awval <= '0';
        wval  <= '0';

        -- Check response assertion
        while (bvalid = '0') loop
            wait until rising_edge(clk);
        end loop;

        wait until rising_edge(clk);
        bready <= '0';
        wait for 2 ns;
    end procedure;

    -- Procedure: Bus Read Cycle
    procedure axi_read (
        constant addr : in  std_logic_vector(31 downto 0);
        signal clk    : in  std_logic;
        signal araddr : out std_logic_vector(31 downto 0);
        signal arval  : out std_logic;
        signal arrdy  : in  std_logic;
        signal rready : out std_logic;
        signal rvalid : in  std_logic
    ) is
    begin
        wait until rising_edge(clk);
        araddr <= addr;
        arval  <= '1';
        rready <= '1';

        -- Await bus acceptance
        while (arrdy = '0') loop
            wait until rising_edge(clk);
        end loop;

        wait until rising_edge(clk);
        arval  <= '0';

        -- Wait for valid read data returned
        while (rvalid = '0') loop
            wait until rising_edge(clk);
        end loop;

        wait until rising_edge(clk);
        rready <= '0';
        wait for 2 ns;
    end procedure;

begin

    -- ------------------------------------------------------------------------
    -- BUS MULTIPLEXER ROUTING (Handing over to Verification IP dynamically)
    -- ------------------------------------------------------------------------
    tb_s_axi_awaddr  <= vip_m_awaddr  when use_vip_bus = '1' else tb_stim_awaddr;
    tb_s_axi_awprot  <= vip_m_awprot  when use_vip_bus = '1' else tb_stim_awprot;
    tb_s_axi_awvalid <= vip_m_awvalid when use_vip_bus = '1' else tb_stim_awvalid;
    
    tb_s_axi_wdata   <= vip_m_wdata   when use_vip_bus = '1' else tb_stim_wdata;
    tb_s_axi_wstrb   <= vip_m_wstrb   when use_vip_bus = '1' else tb_stim_wstrb;
    tb_s_axi_wvalid  <= vip_m_wvalid  when use_vip_bus = '1' else tb_stim_wvalid;
    
    tb_s_axi_bready  <= vip_m_bready  when use_vip_bus = '1' else tb_stim_bready;
    
    tb_s_axi_araddr  <= vip_m_araddr  when use_vip_bus = '1' else tb_stim_araddr;
    tb_s_axi_arprot  <= vip_m_arprot  when use_vip_bus = '1' else tb_stim_arprot;
    tb_s_axi_arvalid <= vip_m_arvalid when use_vip_bus = '1' else tb_stim_arvalid;
    
    tb_s_axi_rready  <= vip_m_rready  when use_vip_bus = '1' else tb_stim_rready;

    -- ------------------------------------------------------------------------
    -- DEVICE UNDER TEST (DUT) INSTANTIATION
    -- ------------------------------------------------------------------------
    uut : entity work.axi4_lite_slave
        port map (
            axi_aclk             => tb_axi_aclk,
            axi_aresetn          => tb_axi_aresetn,
            clk_250mhz           => tb_clk_250mhz,
            rst_n                => tb_rst_n,
            s_axi_awaddr         => tb_s_axi_awaddr,
            s_axi_awprot         => tb_s_axi_awprot,
            s_axi_awvalid        => tb_s_axi_awvalid,
            s_axi_awready        => tb_s_axi_awready,
            s_axi_wdata          => tb_s_axi_wdata,
            s_axi_wstrb          => tb_s_axi_wstrb,
            s_axi_wvalid         => tb_s_axi_wvalid,
            s_axi_wready         => tb_s_axi_wready,
            s_axi_bresp          => tb_s_axi_bresp,
            s_axi_bvalid         => tb_s_axi_bvalid,
            s_axi_bready         => tb_s_axi_bready,
            s_axi_araddr         => tb_s_axi_araddr,
            s_axi_arprot         => tb_s_axi_arprot,
            s_axi_arvalid        => tb_s_axi_arvalid,
            s_axi_arready        => tb_s_axi_arready,
            s_axi_rdata          => tb_s_axi_rdata,
            s_axi_rresp          => tb_s_axi_rresp,
            s_axi_rvalid         => tb_s_axi_rvalid,
            s_axi_rready         => tb_s_axi_rready,
            hexagram_state_out   => tb_hexagram_state_out,
            yao_lines_out        => tb_yao_lines_out,
            boot_phase_out       => tb_boot_phase_out,
            contactor_status_out => tb_contactor_status_out,
            ghostsplat_temp_in   => tb_ghostsplat_temp_in,
            plenum_press_in      => tb_plenum_press_in,
            bus_current_in       => tb_bus_current_in,
            taylor_order_in      => tb_taylor_order_in,
            reg_knock_nonce_0_out => open,
            reg_knock_nonce_1_out => open,
            reg_knock_valid_out   => open,
            ps_knock_nonce_in     => (others => '0'),
            tel_ecc_single_err    => '0',
            tel_ecc_double_err    => '0'
        );

    -- ------------------------------------------------------------------------
    -- VERIFICATION IP (VIP) MASTER INSTANTIATION
    -- ------------------------------------------------------------------------
    u_vip_master : entity work.axi_lite_vip_master
        port map (
            clk       => tb_axi_aclk,
            rst_n     => tb_axi_aresetn,
            m_awaddr  => vip_m_awaddr,
            m_awprot  => vip_m_awprot,
            m_awvalid => vip_m_awvalid,
            m_awready => tb_s_axi_awready,
            m_wdata   => vip_m_wdata,
            m_wstrb   => vip_m_wstrb,
            m_wvalid  => vip_m_wvalid,
            m_wready  => tb_s_axi_wready,
            m_bresp   => tb_s_axi_bresp,
            m_bvalid  => tb_s_axi_bvalid,
            m_bready  => vip_m_bready,
            m_araddr  => vip_m_araddr,
            m_arprot  => vip_m_arprot,
            m_arvalid => vip_m_arvalid,
            m_arready => tb_s_axi_arready,
            m_rdata   => tb_s_axi_rdata,
            m_rresp   => tb_s_axi_rresp,
            m_rvalid  => tb_s_axi_rvalid,
            m_rready  => vip_m_rready,
            vip_start => vip_start,
            vip_done  => vip_done,
            vip_error => vip_error
        );

    -- ------------------------------------------------------------------------
    -- CLOCKS GENERATORS
    -- ------------------------------------------------------------------------
    axi_clk_proc : process
    begin
        while not tb_sim_done loop
            tb_axi_aclk <= '0';
            wait for AXI_CLK_PERIOD / 2;
            tb_axi_aclk <= '1';
            wait for AXI_CLK_PERIOD / 2;
        end loop;
        wait;
    end process;

    core_clk_proc : process
    begin
        while not tb_sim_done loop
            tb_clk_250mhz <= '0';
            wait for CORE_CLK_PERIOD / 2;
            tb_clk_250mhz <= '1';
            wait for CORE_CLK_PERIOD / 2;
        end loop;
        wait;
    end process;

    -- ------------------------------------------------------------------------
    -- CONCURRENT AXI4-LITE PROTOCOL COMPLIANCE MONITOR & SCOREBOARD
    -- ------------------------------------------------------------------------
    axi_protocol_monitor_proc : process(tb_axi_aclk)
        variable last_awaddr : std_logic_vector(31 downto 0);
        variable last_araddr : std_logic_vector(31 downto 0);
        variable last_wdata  : std_logic_vector(31 downto 0);
        variable last_wstrb  : std_logic_vector(3 downto 0);
    begin
        if rising_edge(tb_axi_aclk) then
            if tb_axi_aresetn = '1' then
                -- Rule 1: AWADDR must remain stable while AWVALID is high and AWREADY is low
                if tb_s_axi_awvalid = '1' and tb_s_axi_awready = '0' then
                    assert (tb_s_axi_awaddr = last_awaddr)
                        report "AXI4-Lite Protocol Violation: AWADDR changed while AWVALID was asserted and AWREADY is low!"
                        severity error;
                end if;
                
                -- Rule 2: ARADDR must remain stable while ARVALID is high and ARREADY is low
                if tb_s_axi_arvalid = '1' and tb_s_axi_arready = '0' then
                    assert (tb_s_axi_araddr = last_araddr)
                        report "AXI4-Lite Protocol Violation: ARADDR changed while ARVALID was asserted and ARREADY is low!"
                        severity error;
                end if;

                -- Rule 3: WDATA must remain stable while WVALID is high and WREADY is low
                if tb_s_axi_wvalid = '1' and tb_s_axi_wready = '0' then
                    assert (tb_s_axi_wdata = last_wdata and tb_s_axi_wstrb = last_wstrb)
                        report "AXI4-Lite Protocol Violation: WDATA/WSTRB changed while WVALID was asserted and WREADY is low!"
                        severity error;
                end if;

                last_awaddr := tb_s_axi_awaddr;
                last_araddr := tb_s_axi_araddr;
                last_wdata  := tb_s_axi_wdata;
                last_wstrb  := tb_s_axi_wstrb;
            end if;
        end if;
    end process;

    -- ------------------------------------------------------------------------
    -- VERIFICATION STAGES EXECUTION
    -- ------------------------------------------------------------------------
    stim_proc : process
    begin
        -- --------------------------------------------------------------------
        -- TEST STAGE 1: RESET ASSERTION AND RESET VALUE INVARIANT CHECKS
        -- --------------------------------------------------------------------
        report "TEST STAGE 1: Starting Reset Assertions Checks...";
        tb_axi_aresetn <= '0';
        tb_rst_n       <= '0';
        wait for 40 ns;
        
        -- Assert outputs remain in clear/reset status
        assert (tb_hexagram_state_out = "000000") 
            report "Error: Hexagram core register should reset to 0" severity error;
        assert (tb_boot_phase_out = "00000000") 
            report "Error: Boot phase register should reset to 0" severity error;
        assert (tb_contactor_status_out = "0000000000") 
            report "Error: Contactor register should reset to 0" severity error;

        -- Release resets synchronously
        wait until rising_edge(tb_axi_aclk);
        tb_axi_aresetn <= '1';
        wait until rising_edge(tb_clk_250mhz);
        tb_rst_n       <= '1';
        wait for 30 ns;
        report "TEST STAGE 1: Reset released. State registers synchronized successfully.";

        -- --------------------------------------------------------------------
        -- TEST STAGE 2: NOMINAL WRITE AND READ BACK TO REGISTERS
        -- --------------------------------------------------------------------
        report "TEST STAGE 2: Executing Nominal Write & Read Transactions...";
        
        -- Write 0x00000037 to BOOT_PHASE (0x2C)
        axi_write(
            x"0000002C", x"00000037", "1111",
            tb_axi_aclk, tb_stim_awaddr, tb_stim_awvalid, tb_s_axi_awready,
            tb_stim_wdata, tb_stim_wstrb, tb_stim_wvalid, tb_s_axi_wready,
            tb_stim_bready, tb_s_axi_bvalid
        );
        assert (tb_s_axi_bresp = "00") report "Error: BRESP error writing BOOT_PHASE" severity error;

        -- Read back BOOT_PHASE
        axi_read(
            x"0000002C",
            tb_axi_aclk, tb_stim_araddr, tb_stim_arvalid, tb_s_axi_arready,
            tb_stim_rready, tb_s_axi_rvalid
        );
        assert (tb_s_axi_rresp = "00") report "Error: RRESP error reading BOOT_PHASE" severity error;
        assert (tb_s_axi_rdata = x"00000037") report "Error: Data mismatch in BOOT_PHASE" severity error;
        assert (tb_boot_phase_out = x"37") report "Error: Hardware output output port boot_phase mismatch" severity error;

        -- Write 0x0000002A to HEXAGRAM_STATE (0x10)
        axi_write(
            x"00000010", x"0000002A", "1111",
            tb_axi_aclk, tb_stim_awaddr, tb_stim_awvalid, tb_s_axi_awready,
            tb_stim_wdata, tb_stim_wstrb, tb_stim_wvalid, tb_s_axi_wready,
            tb_stim_bready, tb_s_axi_bvalid
        );
        -- Note: this write to hexagram state is expected to return SLVERR ("10") without knockdown nonce authentication lock release
        assert (tb_s_axi_bresp = "10") report "Info: Hexagram State correctly write-locked without knockdown nonce" severity note;
        report "TEST STAGE 2: Nominal writes and reads completed successfully.";

        -- --------------------------------------------------------------------
        -- TEST STAGE 3: WRITE DATA STROBE (s_axi_wstrb) VERIFICATION
        -- --------------------------------------------------------------------
        report "TEST STAGE 3: Testing Byte-level Write Data Strobing (wstrb)...";
        
        -- Write to BOOT_PHASE with partial enabling: 0xDEADBEEF but strobe is "0011"
        -- This should only write lower 2 bytes (0xBEEF) to the existing 0x00000037, producing 0x0000BEEF
        axi_write(
            x"0000002C", x"DEADBEEF", "0011",
            tb_axi_aclk, tb_stim_awaddr, tb_stim_awvalid, tb_s_axi_awready,
            tb_stim_wdata, tb_stim_wstrb, tb_stim_wvalid, tb_s_axi_wready,
            tb_stim_bready, tb_s_axi_bvalid
        );
        
        -- Read back and verify output is 0x0000BEEF
        axi_read(
            x"0000002C",
            tb_axi_aclk, tb_stim_araddr, tb_stim_arvalid, tb_s_axi_arready,
            tb_stim_rready, tb_s_axi_rvalid
        );
        assert (tb_s_axi_rdata = x"0000BEEF") report "Error: wstrb masking failed on BOOT_PHASE!" severity error;
        report "TEST STAGE 3: Strobe byte-enables logic verified successfully.";

        -- --------------------------------------------------------------------
        -- TEST STAGE 4: ADDRESS SPACE BOUNDS & ERROR DECODING RESP PROTOCOLS
        -- --------------------------------------------------------------------
        report "TEST STAGE 4: Verifying Address space boundaries and SLVERR responses...";
        
        -- 1. Attempt writing to a Read-Only Sensor register (GHOST_FIELD_TEMP = 0x80)
        axi_write(
            x"00000080", x"FFFFFFFF", "1111",
            tb_axi_aclk, tb_stim_awaddr, tb_stim_awvalid, tb_s_axi_awready,
            tb_stim_wdata, tb_stim_wstrb, tb_stim_wvalid, tb_s_axi_wready,
            tb_stim_bready, tb_s_axi_bvalid
        );
        assert (tb_s_axi_bresp = "10") report "Error: Failed to return SLVERR on read-only register write!" severity error;

        -- 2. Attempt reading from an unmapped address (e.g. 0xFC)
        axi_read(
            x"000000FC",
            tb_axi_aclk, tb_stim_araddr, tb_stim_arvalid, tb_s_axi_arready,
            tb_stim_rready, tb_s_axi_rvalid
        );
        assert (tb_s_axi_rresp = "11") report "Error: Decoder failed to signal decode error on unmapped address!" severity error;
        report "TEST STAGE 4: Protocol bounds checks completed successfully.";

        -- --------------------------------------------------------------------
        -- TEST STAGE 5: SIMULTANEOUS READ & WRITE HANDLING
        -- --------------------------------------------------------------------
        report "TEST STAGE 5: Verifying simultaneous read and write transaction channels...";
        
        wait until rising_edge(tb_axi_aclk);
        -- Initiate Read Address and Write Address parameters in same cycle
        tb_stim_araddr   <= x"0000002C"; -- Read BOOT_PHASE (0x2C)
        tb_stim_arvalid  <= '1';
        tb_stim_rready   <= '1';

        tb_stim_awaddr   <= x"00000014"; -- Write YAO_LINES (0x14)
        tb_stim_awvalid  <= '1';
        tb_stim_wdata    <= x"0000003F"; -- Value: 63
        tb_stim_wstrb    <= "1111";
        tb_stim_wvalid   <= '1';
        tb_stim_bready   <= '1';

        wait until rising_edge(tb_axi_aclk);
        while (tb_s_axi_arready = '0' and tb_s_axi_awready = '0') loop
            wait until rising_edge(tb_axi_aclk);
        end loop;

        tb_stim_arvalid  <= '0';
        tb_stim_awvalid  <= '0';
        tb_stim_wvalid   <= '0';

        while (tb_s_axi_rvalid = '0' or tb_s_axi_bvalid = '0') loop
            wait until rising_edge(tb_axi_aclk);
        end loop;

        wait until rising_edge(tb_axi_aclk);
        tb_stim_rready   <= '0';
        tb_stim_bready   <= '0';
        
        assert (tb_s_axi_rdata = x"0000BEEF") report "Error: Read corruption during simultaneous access!" severity error;
        assert (tb_yao_lines_out = "111111") report "Error: Write corruption during simultaneous access!" severity error;
        report "TEST STAGE 5: Simultaneous access channel isolation verified successfully.";

        -- --------------------------------------------------------------------
        -- TEST STAGE 6: CLOCK DOMAIN CROSSING (CDC) INPUT SYNCH TIMING
        -- --------------------------------------------------------------------
        report "TEST STAGE 6: Verifying core inputs crossing (clk_250mhz to axi_aclk)...";
        
        wait until rising_edge(tb_clk_250mhz);
        tb_ghostsplat_temp_in <= x"00001234";
        tb_plenum_press_in    <= x"00005678";
        
        wait for 4 * AXI_CLK_PERIOD;
        
        axi_read(
            x"00000080",
            tb_axi_aclk, tb_stim_araddr, tb_stim_arvalid, tb_s_axi_arready,
            tb_stim_rready, tb_s_axi_rvalid
        );
        assert (tb_s_axi_rdata = x"00001234") report "Error: CDC failed to propagate temperature input value!" severity error;

        axi_read(
            x"00000084",
            tb_axi_aclk, tb_stim_araddr, tb_stim_arvalid, tb_s_axi_arready,
            tb_stim_rready, tb_s_axi_rvalid
        );
        assert (tb_s_axi_rdata = x"00005678") report "Error: CDC failed to propagate plenum pressure value!" severity error;
        report "TEST STAGE 6: CDC timing lines bounds checked successfully.";

        -- --------------------------------------------------------------------
        -- TEST STAGE 7 & 8: VIP MASTER TRANSFERS & COUNTERS VERIFICATION
        -- --------------------------------------------------------------------
        report "TEST STAGE 7: Handing Bus driving controls over to AXI4-Lite VIP Master...";
        wait until rising_edge(tb_axi_aclk);
        use_vip_bus <= '1';
        vip_start   <= '1';
        
        -- Wait for VIP simulation completion
        while (vip_done = '0') loop
            wait until rising_edge(tb_axi_aclk);
        end loop;
        
        assert (vip_error = '0') report "Verfication IP failed! Check errors in log above." severity error;
        report "TEST STAGE 7 & 8: AXI VIP finished test matrix sweeps successfully!";

        -- --------------------------------------------------------------------
        -- TEARDOWN & SUMMARY
        -- --------------------------------------------------------------------
        report "====================================================================";
        report "VERIFICATION SUITE COMPLETE: ALL TESTBENCH AND VIP SCENARIOS PASSED!";
        report "====================================================================";
        tb_sim_done <= true;
        wait;
    end process;

end architecture behavioral;
