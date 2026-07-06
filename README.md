# POG2 MHD-FPGA-001 — Propulsion Controller

> VHDL · SystemVerilog · TypeScript · Vite · Cloudflare

MHD magnetohydrodynamic propulsion controller targeting Zynq UltraScale+ ZU7EV.
Full FPGA HDL design + TypeScript/Vite web simulation frontend.

## VHDL Modules

| Module | Purpose |
|---|---|
| `HEXAGRAM_STATE_MACHINE.vhd` | 64-state I Ching power state sequencer |
| `GHOSTSPLAT_PREDICTOR.vhd` | 300ms predictive state estimator |
| `CONTACTOR_SEQUENCER.vhd` | High-voltage contactor interlock |
| `CHOKE_DRIVER.vhd` | MHD choke coil driver |
| `AXI4_LITE_SLAVE.vhd` | AXI4-Lite register interface |
| `SENSOR_ACQUISITION.vhd` | Multi-channel ADC interface |
| `TELEMETRY_ENCODER.vhd` | Real-time telemetry stream |
| `POG2_MHD_FPGA_001.vhd` | Top-level integration |
| `POG2_MHD_FPGA_001_TB.sv` | SystemVerilog testbench |

## Documentation

`POG2-MHD-FPGA-001-UNIFIED-SPEC.md` · `POG2_MHD_FPGA_001_REGISTER_MAP.md` ·
`POG2_MHD_FPGA_001_MEMORY_MAP.md` · `POG2_MHD_FPGA_001_STATE_TAXONOMY.md` ·
`LUNA_SUCCESS.md`

## Web Simulation Layer

`server.ts` (Cloudflare Worker) · `src/` (TypeScript sim) · `vite.config.ts` · `wrangler.jsonc`

**Target**: Zynq UltraScale+ ZU7EV · AXI4-Lite slave interface
