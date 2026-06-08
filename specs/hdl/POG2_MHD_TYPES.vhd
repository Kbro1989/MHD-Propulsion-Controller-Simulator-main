-------------------------------------------------------------------------------
-- POG2-MHD-PROP-001 Rev 1.0
-- POG2_MHD_TYPES.vhd
-- Shared type definitions for the MHD propulsion system
-- FIXED: 600 ms canonical tick (was 640 ms RSC contamination)
-------------------------------------------------------------------------------
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

package POG2_MHD_TYPES is

    -- Clock and timing constants
    constant CLK_FREQ_MHZ      : integer := 250;           -- 250 MHz system clock
    constant CLK_PERIOD_NS     : real    := 4.0;           -- 4.0 ns period
    constant TICK_PERIOD_MS    : integer := 600;           -- FIXED: 600 ms metabolic tick (matches POG2)
    constant TICK_CYCLES       : integer := 150000000;    -- FIXED: 600 ms / 4 ns = 150,000,000 cycles
    constant SUBTICK_PHASES    : integer := 16;            -- 16 sub-tick phases per tick
    constant SUBTICK_CYCLES    : integer := 9375000;      -- 150,000,000 / 16 = 9,375,000 cycles per phase

    -- State space dimensions
    constant HEXAGRAM_STATES   : integer := 64;           -- 2^6 yao lines
    constant YAO_LINES         : integer := 6;             -- 6 binary control lines
    constant ELECTRICAL_STATES : integer := 4;             -- OFF, ARMED, ACTIVE, SHED
    constant ELECTRICAL_BITS   : integer := 2;             -- 2-bit register

    -- Fixed-point arithmetic (Q16.16 format)
    constant Q_INT_BITS        : integer := 16;            -- Integer part
    constant Q_FRAC_BITS       : integer := 16;            -- Fractional part
    constant Q_TOTAL_BITS      : integer := 32;            -- Total width
    subtype Q16_16_T is signed(Q_TOTAL_BITS-1 downto 0);
    constant Q16_16_ONE        : Q16_16_T := to_signed(65536, Q_TOTAL_BITS);  -- 1.0 in Q16.16

    -- GhostSplat predictor constants
    constant GHOSTSPLAT_HORIZON_TICKS : integer := 3;       -- 3-tick prediction window
    constant GHOSTSPLAT_HORIZON_MS    : integer := 1800;    -- FIXED: 1.80 seconds (3 × 600ms)
    constant HBAR_EFF_Q16_16          : Q16_16_T := to_signed(1153433600, Q_TOTAL_BITS);  -- 17,600.0 * 65536
    constant TAYLOR_ADAPTIVE_THRESH   : Q16_16_T := to_signed(3277, Q_TOTAL_BITS);       -- 0.05 in Q16.16
    constant MAX_TAYLOR_ORDER         : integer := 5;        -- Maximum expansion order
    constant MIN_TAYLOR_ORDER         : integer := 2;        -- Minimum expansion order

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

    -- Knock-lock constants
    constant KNOCK_NONCE_WIDTH : integer := 64;  -- 64-bit nonce for replay protection

end package POG2_MHD_TYPES;

package body POG2_MHD_TYPES is
end package body;
