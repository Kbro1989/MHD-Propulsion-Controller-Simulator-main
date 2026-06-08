// POG2_MHD_TYPES_SV.svh
// SystemVerilog equivalent of POG2_MHD_TYPES.vhd
// Used to workaround SV/VHDL import incompatibility in testbench

`ifndef POG2_MHD_TYPES_SV_H
`define POG2_MHD_TYPES_SV_H

package POG2_MHD_TYPES_SV;

    // Clock and timing constants
    parameter int CLK_FREQ_MHZ      = 250;
    parameter real CLK_PERIOD_NS    = 4.0;
    parameter int TICK_PERIOD_MS    = 600;
    parameter int TICK_CYCLES       = 150000000;

    // State space dimensions
    parameter int HEXAGRAM_STATES   = 64;
    parameter int YAO_LINES         = 6;

    // Electrical register states
    typedef enum bit [1:0] {
        ELEC_OFF    = 2'b00,
        ELEC_ARMED  = 2'b01,
        ELEC_ACTIVE = 2'b10,
        ELEC_SHED   = 2'b11
    } electrical_reg_t;

    // Contactor state machine states
    typedef enum bit [2:0] {
        CT_CLOSED, CT_OPENING, CT_OPEN, CT_CLOSING, CT_FAULT
    } contactor_state_t;

    // System-wide operational mode
    typedef enum bit [2:0] {
        MODE_IDLE, MODE_STEALTH, MODE_TRANSIT, MODE_LIMP, MODE_PURGE, MODE_EMERGENCY
    } sys_mode_t;

endpackage

`endif // POG2_MHD_TYPES_SV_H
