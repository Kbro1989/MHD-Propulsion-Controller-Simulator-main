# POG2-MHD-FPGA-001 CDC and DSP Optimization Strategy Spec
**Rev 1.0.0 — Clock Domain Crossing & Math Acceleration Architecture Guide**

---

This document establishes the official hardware guidelines for Clock Domain Crossing (CDC) mechanics and Arithmetic-to-DSP mapping optimizations implemented within the POG2-MHD-FPGA-001 design.

---

## Part 1: Clock Domain Crossing (CDC) Strategy

The POG2 design operates across two main unsynchronized clock domains:
1. **AXI4-Lite interconnect Domain (`clk_axi` @ 100 MHz)**: Handles registers access, performance counters, and debug control.
2. **Programmable Logic Core Domain (`clk` @ 250 MHz)**: Executes real-time DPLL carrier tuning, physical contactor sequencer state-machines, and Taylor Series thermal trend forecasting.

Due to the independent clock frequencies, transferring control signals and multi-bit data buses between these domains without proper synchronization will result in metastability, timing setup/hold violations, and data incoherency.

### 1.1 Single-Bit Control Signal CDC (Two-Flop Synchronizer)
For single-bit control markers (such as enable pulses, resets, or slow-changing bypass flags like `is_hw_accelerated`), a standard **Two-Flop Synchronizer** is mandatory. This prevents metastability from propagating to down-stream logic.

*   **VHDL Implementation Requirement**: Synchronizer flops must have attributes `ASYNC_REG = "TRUE"` to instruct placement tools to group the flip-flops into a single slice. This minimizes interconnect delay, maximizing MTBF (Mean Time Between Failures).

```vhdl
-- ============================================================================
-- Single-Bit Two-Flop Synchronizer VHDL Example
-- ============================================================================
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity CDC_SingleBit_Synchronizer is
    generic (
        INIT : std_logic := '0'
    );
    port (
        dest_clk   : in  std_logic;
        src_sig    : in  std_logic;
        dest_sig   : out std_logic
    );
end entity;

architecture rtl of CDC_SingleBit_Synchronizer is
    signal sync_reg0 : std_logic := INIT;
    signal sync_reg1 : std_logic := INIT;
    
    -- Vivado synthesis attribute forcing close physical placement of flops
    attribute ASYNC_REG : string;
    attribute ASYNC_REG of sync_reg0 : signal is "TRUE";
    attribute ASYNC_REG of sync_reg1 : signal is "TRUE";
    
    -- Prevent optimization from merging these registers
    attribute shreg_extract : string;
    attribute shreg_extract of sync_reg0 : signal is "no";
    attribute shreg_extract of sync_reg1 : signal is "no";
begin
    process(dest_clk)
    begin
        if rising_edge(dest_clk) then
            sync_reg0 <= src_sig;
            sync_reg1 <= sync_reg0;
        end if;
    end process;
    
    dest_sig <= sync_reg1;
end architecture;
```

---

### 1.2 Multi-Bit Data Bus CDC (Request-Acknowledge Handshake Protocol)
For multi-bit wider structures (such as updating threshold targets or reporting prediction metrics), transitioning individual bits through separate synchronizers is strictly forbidden due to bit-deskewing (data incoherency). 
A stateful hazard-free **Request-Acknowledge Handshake protocol** must be utilized.

#### Architectural Handshake Sequence
1.  **Source Domain (`clk_axi`)** places valid multi-bit data on the bus and asserts `src_req <= '1'`.
2.  **Destination Domain (`clk`)** synchronizes `src_req` through a two-flop synchronizer. Upon observing `dest_req = '1'`, it latches the stable data bus and drives `dest_ack <= '1'`.
3.  **Source Domain (`clk_axi`)** synchronizes `dest_ack` via a two-flop synchronizer. Upon observing `src_ack = '1'`, it drops its request (`src_req <= '0'`) and is free to change the data bus.
4.  **Destination Domain (`clk`)** drops `dest_ack` once `dest_req` drops back to `'0'`.

```vhdl
-- ============================================================================
-- Stateful CDC Handshake Synchronizer for Q16.16 Buses
-- ============================================================================
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity CDC_Bus_Handshake is
    generic (
        BUS_WIDTH : integer := 32
    );
    port (
        src_clk    : in  std_logic;
        src_rst    : in  std_logic;
        src_data   : in  std_logic_vector(BUS_WIDTH-1 downto 0);
        src_send   : in  std_logic;
        src_ready  : out std_logic;
        
        dest_clk   : in  std_logic;
        dest_rst   : in  std_logic;
        dest_data  : out std_logic_vector(BUS_WIDTH-1 downto 0);
        dest_valid : out std_logic
    );
end entity;

architecture rtl of CDC_Bus_Handshake is
    -- Handshake control signals
    signal src_req      : std_logic := '0';
    signal src_ack_sync : std_logic := '0';
    
    signal dest_req_sync : std_logic := '0';
    signal dest_ack      : std_logic := '0';
    
    -- Latching registers
    signal src_data_reg  : std_logic_vector(BUS_WIDTH-1 downto 0) := (others => '0');
    signal dest_data_reg : std_logic_vector(BUS_WIDTH-1 downto 0) := (others => '0');
    
    -- Instantiate single-bit synchronizers for req/ack lines
    component CDC_SingleBit_Synchronizer is
        generic ( INIT : std_logic := '0' );
        port (
            dest_clk   : in  std_logic;
            src_sig    : in  std_logic;
            dest_sig   : out std_logic
        );
    end component;
begin

    -- Instantiations
    SYNC_REQ: CDC_SingleBit_Synchronizer
        generic map ( INIT => '0' )
        port map ( dest_clk => dest_clk, src_sig => src_req, dest_sig => dest_req_sync );

    SYNC_ACK: CDC_SingleBit_Synchronizer
        generic map ( INIT => '0' )
        port map ( dest_clk => src_clk, src_sig => dest_ack, dest_sig => src_ack_sync );

    -- Source Domain FSM
    process(src_clk, src_rst)
    begin
        if src_rst = '1' then
            src_req      <= '0';
            src_ready    <= '1';
            src_data_reg <= (others => '0');
        elsif rising_edge(src_clk) then
            if src_req = '0' then
                if src_send = '1' then
                    src_data_reg <= src_data;
                    src_req      <= '1';
                    src_ready    <= '0';
                else
                    src_ready    <= '1';
                end if;
            else
                if src_ack_sync = '1' then
                    src_req <= '0';
                end if;
            end if;
        end if;
    end process;

    -- Destination Domain Latcher FSM
    process(dest_clk, dest_rst)
    begin
        if dest_rst = '1' then
            dest_ack      <= '0';
            dest_valid    <= '0';
            dest_data_reg <= (others => '0');
        elsif rising_edge(dest_clk) then
            dest_valid <= '0';
            if dest_req_sync = '1' then
                if dest_ack = '0' then
                    dest_data_reg <= src_data_reg; -- Stable during entire req high phase
                    dest_ack      <= '1';
                    dest_valid    <= '1';
                end if;
            else
                dest_ack <= '0';
            end if;
        end if;
    end process;

    dest_data <= dest_data_reg;
end architecture;
```

---

## Part 2: Math Optimizations & DSP Slice Mapping Guide

### 2.1 `GHOSTSPLAT_PREDICTOR.vhd` DSP Offloading Optimizations

#### The Issue
`GHOSTSPLAT_PREDICTOR` implements high-order Taylor polynomials. To calculate terms, the current design uses multiple multi-cycle `q16_divide` steps on non-power-of-two factorials:
```vhdl
term_tmp := q16_divide(term_tmp, factorial_q16(n));
```
Because generic non-power-of-two division translates to complex sequential division routing or massive generic LUT arrays, this structure drastically limits throughput, consumes substantial resource volume, and degrades the FMax boundary.

#### Resolution: Constant Factorial Reciprocal Multiplication
Because the factorials are compile-time constants ($1!$, $2!$, $3!$, $4!$, $5!$), we can pre-calculate their mathematical **multiplicative reciprocals** in Q16.16:

$$\text{Term}_n = \text{Term}_{\text{prev}} \times H_{\text{total}} \times DT \times \left(\frac{1}{n!}\right)$$

By using reciprocal values, all divisions are converted into single-clock multiplication pipelines! Multiplication is directly mapped to FPGA hardware DSP blocks like the **DSP48E1**.

| Term ($n$) | Factorial ($n!$) | Reciprocal Value ($\frac{1}{n!}$) | Hexadecimal (Q16.16) | Standard Decimal |
| :---: | :---: | :---: | :---: | :---: |
| 1st | 1 | 1.0 (free shift) | `0x00010000` | 1.0 |
| 2nd | 2 | 0.5 (free shift right 1) | `0x00008000` | 0.5 |
| 3rd | 6 | $\approx 0.1666667$ | `0x00002AAB` | 0.16667 |
| 4th | 24 | $\approx 0.0416667$ | `0x00000AAB` | 0.04167 |
| 5th | 120 | $\approx 0.0083333$ | `0x00000222` | 0.00833 |

#### Restructured VHDL Code Implementation
```vhdl
-- Optimization: replace q16_divide(val, factorial(3)) with:
-- constant RECIP_FACTORIAL_3_Q16 : Q16_16_T := to_signed(10923, 32); -- 1/6 represented in Q16.16
-- term_tmp := q16_multiply(term_mult_1, RECIP_FACTORIAL_3_Q16);

-- Pipelining multiplier block for DSP mapping
process(clk)
begin
    if rising_edge(clk) then
        -- Insert a pipeline step immediately after multiplication so that Vivado Synthesis 
        -- packs registers directly into the DSP48E1 MREG/PREG blocks, optimizing speeds to 250MHz+
        term_m_pipe <= q16_multiply(term_mult_1, h_total); 
    end if;
end process;
```

---

### 2.2 `CHOKE_DRIVER.vhd` DPLL Math Compression

#### The Issue
The digital phase lock loop (DPLL) frequency tracker contains the following calculation on line 126:
```vhdl
dsp_prod := unsigned(phase_inc_adjusted) * to_unsigned(3814, 16);
```
Where `phase_inc_adjusted` is declared as a 32-bit signed signal. 
A 32-bit x 16-bit multiplication exceeds the standard **18x25-bit multiplier** size of a single Xilinx 7 Series DSP48E1 slice. This causes Vivado to cascade two DSP48E1 slices together, increasing timing strain and dynamic current.

#### Resolution: Signal Dynamic Compression (Precision Truncation)
However, look closely at the boundary check on lines 115-119:
```vhdl
if phase_inc_adjusted > 113388 then
    phase_inc_adjusted := to_signed(113388, 32);
elsif phase_inc_adjusted < 109949 then
    phase_inc_adjusted := to_signed(109949, 32);
end if;
```
The scalar value of `phase_inc_adjusted` is guaranteed to be tightly bounded between **109,949** and **113,388**.
In binary, `113388` is `2#1_1011_1010_1110_1100#`, which is exactly **17 bits**. The upper 15 bits are completely unused!

#### Optimized Implementation
By casting the variable to a smaller 18-bit unsigned integer before performing the multiplication with `3814`, we fit the logic completely within a **single DSP slice**!

```vhdl
-- Optimized:
declare
    -- Dynamic range compression to fit 18-bit DSP48E1 Port Input natively
    variable phase_inc_compressed : unsigned(17 downto 0);
    variable dsp_prod_compressed  : unsigned(33 downto 0); -- 18-bit * 16-bit
begin
    phase_inc_compressed := unsigned(phase_inc_adjusted(17 downto 0));
    -- Fits seamlessly inside a single DSP48E1 (natively handles up to 18x25-bit)
    dsp_prod_compressed  := phase_inc_compressed * to_unsigned(3814, 16);
    freq_tmp            := to_integer(dsp_prod_compressed(33 downto 16));
    freq_reg            <= to_unsigned(freq_tmp, 16);
end;
```
This removes a whole physical DSP slice, decreases interconnect congestion, and boosts core performance.
