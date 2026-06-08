# POG2-MHD-FPGA-001 Integration Specification
## Hardware-Software Contract | Rev 1.0 | 2026-06-05

---

## 1. Document Scope

This specification defines the complete integration contract between the POG2-MHD-FPGA-001 RTL design (7 VHDL modules + 1 testbench) and the POG2 Sovereign System software stack. It covers:

- AXI4-Lite register access protocol
- MCP tool/resource binding
- Boot sequence choreography
- Telemetry stream semantics
- Fault injection and validation protocol
- Cognitive Immunology and Epistemic Validation rules
- Standalone vs. PS-coupled operational modes

**Referenced Documents:**
- `POG2_MHD_FPGA_001.vhd` — Top-level RTL
- `HEXAGRAM_STATE_MACHINE.vhd` — CNS state machine
- `GHOSTSPLAT_PREDICTOR.vhd` — Thermal prediction engine
- `CONTACTOR_SEQUENCER.vhd` — HV safety interlock
- `CHOKE_DRIVER.vhd` — Resonant PWM actuator
- `SENSOR_ACQUISITION.vhd` — Feedback acquisition
- `TELEMETRY_ENCODER.vhd` — Stream encoder
- `AXI4_LITE_SLAVE.vhd` — PS interface
- `POG2_MHD_FPGA_001_REGISTER_MAP.md` — Register definitions
- `POG2_MHD_FPGA_001_MCP_SCHEMA.json` — MCP schema

---

## 2. System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POG2 SOVEREIGN SYSTEM                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │HexagramMgr  │  │GhostSplat   │  │PlayerAgent  │  │CognitiveImmunology  │  │
│  │(CNS)        │  │Engine       │  │             │  │Emergency            │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                │                    │             │
│         └────────────────┴────────────────┴────────────────────┘             │
│                              │                                              │
│                    ┌─────────▼─────────┐                                   │
│                    │   MCPEngine.ts      │                                   │
│                    │   (MCP Adapter)       │                                   │
│                    └─────────┬─────────┘                                   │
│                              │ JSON-RPC over stdio                          │
│                    ┌─────────▼─────────┐                                   │
│                    │  AXI4-Lite Bridge   │  ←── This spec defines this       │
│                    │  (Zynq PS → PL)     │                                   │
│                    └─────────┬─────────┘                                   │
└──────────────────────────────┼─────────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  POG2-MHD-FPGA-001    │
                    │  Zynq UltraScale+      │
                    │  ZU7EV                 │
                    │  ┌─────────────────┐   │
                    │  │ HexagramSM      │   │
                    │  │ GhostSplat      │   │
                    │  │ ContactorSeq    │   │
                    │  │ ChokeDriver     │   │
                    │  │ SensorAcq       │   │
                    │  │ TelemetryEnc    │   │
                    │  │ AXI4-Lite Slave │   │
                    │  └─────────────────┘   │
                    └─────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   MHD THRUSTER        │
                    │   5,000 V / 1,880 A   │
                    │   5-segment array     │
                    └───────────────────────┘
```

---

## 3. Boot Sequence Choreography

### 3.1 Phase Mapping

The 6-phase physical boot sequence from the MHD schematic maps to both hardware states and software events:

| Phase | Duration | `BOOT_PHASE` | Hexagram | Software Event | Hardware Actions |
|-------|----------|-------------|----------|----------------|------------------|
| **DARK IRON** | 0–30 s | `0x00` | 0 (uninit) | `fpga.boot.start` | Power-on, all contactors OPEN, choke idle, ADC calibration |
| **POWER WAKE** | 30–90 s | `0x01` | 7 (Dark Iron) | `fpga.boot.power_wake` | Self-test, PLL lock, register sanity check |
| **SALT CHARGE** | 90–150 s | `0x02` | 3 (Difficulty) | `fpga.boot.salt_charge` | Pre-charge contactors 0,2,4, salt hydrate baseline |
| **PLENUM RISE** | 150–180 s | `0x03` | 48 (The Well) | `fpga.boot.plenum_rise` | Pressure build, thermal baseline acquisition |
| **DEGAUSS** | 180–240 s | `0x04` | 23 (Splitting) | `fpga.boot.degauss` | Magnetic field stabilization, choke resonance sweep |
| **CHANNEL PRIME** | 240–300 s | `0x05` | 29 (The Abysmal) | `fpga.boot.channel_prime` | Segment test, full contactor close, choke lock |
| **STEALTH IDLE** | 300 s+ | `0x06` | 1 (The Creative) | `fpga.boot.complete` | Full operational, minimal signature, telemetry active |

### 3.2 Boot Flow

```
Software (OrchestrateEngine)          FPGA Hardware
──────────────────────────            ─────────────
      │                                    │
      │─── fpga_boot_sequence(START) ─────>│
      │                                    │ BOOT_PHASE = 0x00
      │<─── BOOT_PHASE = 0x01 (30s) ──────│
      │   [EventBus: fpga.boot.power_wake] │ Self-test
      │                                    │
      │<─── BOOT_PHASE = 0x02 (90s) ──────│
      │   [EventBus: fpga.boot.salt_charge]│ Pre-charge
      │                                    │
      │<─── BOOT_PHASE = 0x03 (150s) ─────│
      │   [EventBus: fpga.boot.plenum_rise]│ Pressure
      │                                    │
      │<─── BOOT_PHASE = 0x04 (180s) ─────│
      │   [EventBus: fpga.boot.degauss]   │ Degauss
      │                                    │
      │<─── BOOT_PHASE = 0x05 (240s) ─────│
      │   [EventBus: fpga.boot.channel_prime]│ Prime
      │                                    │
      │<─── BOOT_PHASE = 0x06 (300s) ─────│
      │   [EventBus: fpga.boot.complete]  │
      │   [IRQ: BOOT_COMPLETE]            │
      │                                    │
      │─── fpga_hexagram_set(id=1,          │
      │     vibe_mode="STEALTH") ─────────>│ HEXAGRAM_STATE = 1
      │                                    │ VIBE_MODE = 0x02
      │                                    │
```

### 3.3 Standalone Mode

When `STANDALONE_MODE = 1` (register `0xC0`), the FPGA self-sequences without PS intervention:

```
Power-on ──> DARK IRON ──> POWER WAKE ──> SALT CHARGE ──> PLENUM RISE
     │                                                            │
     │<────────────────── STANDALONE_TIMEOUT ─────────────────────┘
     │   (default: 480 ticks = 307.2 s)
     │
     └── If timeout expires without BOOT_COMPLETE ──> WATCHDOG_FAULT
```

The `STANDALONE_PROFILE` register (`0xC4`) selects the hexagram ID for autonomous personality. Default: `0x01` (The Creative).

---

## 4. Telemetry Stream Semantics

### 4.1 Channel Architecture

The telemetry encoder produces packets consumed by the MCP Catching Layer. Channels map to L1–L4 cache tiers:

| Channel | Register Source | MCP Destination | Cache Tier | Rate |
|---------|----------------|-----------------|------------|------|
| `HEXAGRAM` | `HEXAGRAM_STATE` (0x10) | `fpga://hexagram/state` | L1 (Hot) | Every tick |
| `GHOSTSPLAT` | `GHOSTSPLAT_FIELD_x` (0x80–0x90) | `fpga://ghostsplat/field` | L1 (Hot) | Every tick |
| `CONTACTOR` | `CONTACTOR_STATUS` (0x44) | `fpga://contactor/status` | L2 (Schema) | Every 4 ticks |
| `CHOKE` | `CHOKE_DUTY` (0x4C), `CHOKE_PHASE` (0x50) | `fpga://choke/parameters` | L2 (Schema) | Every 4 ticks |
| `SENSOR` | `SENSOR_ADC_x` (0x58–0x68) | `fpga://sensor/raw` | L3 (Semantic) | Every tick |
| `THERMAL` | Computed thermal state | `fpga://ghostsplat/field` | L1 (Hot) | Every tick |
| `FAULT` | `FAULT_LOG` (0xBC) | `fpga://fault/log` | L4 (Persistent) | On event |
| `ALL` | All channels | All resources | All tiers | Configurable |

### 4.2 MCP Catching Layer Integration

```
FPGA Telemetry Encoder ──> AXI4-Lite ──> PS DMA ──> MCP Adapter
     │                                                      │
     │  Binary packet (72 bytes)                            │  JSON-RPC notification
     │  {magic, version, channel_mask, sequence,           │  {
     │   timestamp, hexagram_id, vibe_mode,                 │    "jsonrpc": "2.0",
     │   ghostsplat_field, sensor_snapshot,                │    "method": "notifications/telemetry",
     │   contactor_status, choke_status,                    │    "params": {
     │   crc32, terminator}                                 │      "channel": "ghostsplat",
     │                                                      │      "data": { ... }
     │                                                      │    }
     │                                                      │  }
     ▼                                                      ▼
┌──────────────┐                                  ┌──────────────┐
│ L1: Hot Cache │  <── 0.02ms latency ──>          │ MCPEngine.ts │
│ (in-mem LRU) │                                  │ (Tool Router)│
└──────────────┘                                  └──────────────┘
     │
     ├──> EventBus.publish('cognitive.learning', ...)
     ├──> HexagramManager.pushLine({...})
     └──> GhostSplatEngine.getInstance().ingest(field)
```

### 4.3 Event Bus Mapping

Telemetry events are published to the POG2 EventBus with these topic patterns:

| FPGA Condition | EventBus Topic | Payload |
|---------------|----------------|---------|
| Hexagram state change | `cognitive.hexagram` | `{ id, name, previous_id, yao_lines, vibe_mode }` |
| GhostSplat field update | `cognitive.ghostsplat` | `{ field: GhostSplatField, confidence, horizon }` |
| Thermal CRIT | `cognitive.thermal_alert` | `{ segment, temperature, threshold, hexagram_id }` |
| Contactor arc fault | `cognitive.fault` | `{ type: 'contactor_arc', segment, timestamp }` |
| Boot phase advance | `fpga.boot.progress` | `{ phase, elapsed_ms, hexagram_id }` |
| Cognitive pulse | `cognitive.pulse` | `{ hexagram_id, yao_lines, thermal_variance }` |

---

## 5. Cognitive Immunology & Epistemic Validation

### 5.1 Directional Enforcement

The FPGA enforces the same epistemic tiers as the software `EpistemicValidator`:

```
POLICY ──> EXECUTION ──> CAUSAL ──> INTERPRETATION
   │          │            │            │
   │          │            │            │
   │    register writes   │      telemetry reads
   │    contactor cmds    │      state queries
   │    choke configs     │
   │                      │
   └── global reset       └── yao override
       mode switch           vibe changes
       fault inject          telemetry config
```

**Rules:**
- `EXECUTION` tier can write to control registers and command actuators
- `CAUSAL` tier can modify yao lines, vibe mode, and thermal variance
- `INTERPRETATION` tier is read-only (telemetry, state queries)
- `POLICY` tier can override all gates (emergency open, global reset, fault inject)

### 5.2 Chaos Constraint

When the HexagramSM detects `OldYin` or `OldMixed` yao states (chaotic transitions), the following actions are blocked regardless of tier:

- `fpga_contactor_command(CLOSE)` — prevents contactor closure during chaos
- `fpga_choke_set` with duty > 25% — limits thermal load
- `fpga_hexagram_set` with override — prevents personality mutation

**Override:** `POLICY` tier + `EMERGENCY_OPEN` bit in `CONTROL` register forces all contactors to OPEN regardless of chaos state.

### 5.3 Cognitive Pulse Synchronization

When the hexagram state changes, the FPGA asserts `COGNITIVE_PULSE` (register `0x1C`, bit 0) for one tick. The MCP adapter maps this to:

```typescript
EventBus.getInstance().publish({
  type: 'cognitive.pulse',
  source: 'fpga.hexagramsm',
  payload: {
    hexagramId: hexagram_id,
    yaoLines: yao_lines,
    vibeMode: vibe_mode,
    thermalVariance: thermal_variance / 256.0,
    timestamp: Date.now()
  }
});
```

This pulse triggers:
- `GhostSplatEngine.getInstance().getLatestField()` — refresh prediction
- `PlayerAgent.evaluateTacticalPosition(field)` — tactical re-evaluation
- `HexagramManager.getInstance().getInterpretation()` — re-interpret state
- `CognitiveImmunologyEmergency.ts` scan — check for policy violations

---

## 6. Fault Injection & Validation Protocol

### 6.1 Fault Categories

| Category | FPGA Fault Code | Software Test | Validation Criteria |
|----------|----------------|---------------|---------------------|
| Contactor arc | `0x0001`–`0x0400` | `fpga_fault_inject(CONTACTOR_ARC, seg=N)` | Arc suppress within 5 ms, segment isolated |
| Contactor weld | `0x0401`–`0x0800` | `fpga_fault_inject(CONTACTOR_WELD, seg=N)` | Weld detected, emergency OPEN triggered |
| Thermal sensor | `0x0801` | `fpga_fault_inject(THERMAL_SENSOR)` | Sensor failover to GhostSplat prediction |
| Pressure sensor | `0x1001` | `fpga_fault_inject(PRESSURE_SENSOR)` | Plenum estimation from thermal model |
| Salt sensor | `0x2001` | `fpga_fault_inject(SALT_SENSOR)` | Hydration default to 0.5 |
| Bus overvoltage | `0x4001` | `fpga_fault_inject(BUS_OVERVOLTAGE)` | Contactors OPEN, choke idle |
| Bus overcurrent | `0x8001` | `fpga_fault_inject(BUS_OVERCURRENT)` | Limp mode, checkerboard shed |
| Watchdog | `0x0001_0000` | `fpga_fault_inject(WATCHDOG)` | Full reset, DARK IRON restart |
| Choke resonance | `0x0002_0000` | `fpga_fault_inject(CHOKE_RESONANCE_LOSS)` | Frequency sweep, re-lock |
| GhostSplat divergence | `0x0004_0000` | `fpga_fault_inject(GHOSTSPLAT_DIVERGENCE)` | Fallback to sensor-only mode |
| Hexagram deadlock | `0x0008_0000` | `fpga_fault_inject(HEXAGRAM_DEADLOCK)` | Watchdog bark, state reset |

### 6.2 Validation Test Matrix

| Test ID | Scenario | Expected FPGA Response | Software Verification |
|---------|----------|----------------------|----------------------|
| `FVT-001` | Normal boot sequence | All 6 phases complete in 300 s | `BOOT_COMPLETE` asserted, `STEALTH_IDLE` reached |
| `FVT-002` | Standalone boot | Self-sequences without PS commands | `STANDALONE_ACTIVE` = 1, telemetry valid |
| `FVT-003` | Thermal CRIT at segment 2 | Limp mode, segments 1+3 shed | `LIMP_ACTIVE` = 1, `CONTACTOR_TARGET` = checkerboard |
| `FVT-004` | Contactor arc on seg 0 | Arc suppress, seg 0 isolated, others operational | `ARC_FAULT` = 1, seg 0 status = `ARC_SUPPRESS` |
| `FVT-005` | Personality CLINICAL → AGITATED | Thresholds scale from 0.658 to 0.532 | `YAO_THRESHOLDS` register updates |
| `FVT-006` | GhostSplat divergence | Fallback to sensor-only, `GHOSTSPLAT_READY` = 0 | Telemetry shows `confidence` = 0 |
| `FVT-007` | Chaos state (OldYin) | Contactors blocked from closing, choke limited | `fpga_contactor_command(CLOSE)` returns error |
| `FVT-008` | Emergency open | All contactors to OPEN in < 20 ms | `EMERGENCY_OPEN` bit clears, all statuses = OPEN |
| `FVT-009` | MCP adapter disconnect | FPGA continues in standalone mode | `STANDALONE_MODE` = 1, telemetry to D1 audit |
| `FVT-010` | Full system reset | DARK IRON restart, 300 s boot | `GLOBAL_RESET` self-clears, sequence restarts |

---

## 7. Operational Modes

### 7.1 PS-Coupled Mode (Default)

```
STANDALONE_MODE = 0
├─ FPGA waits for PS commands via AXI4-Lite
├─ Hexagram state set by software (HexagramManager)
├─ GhostSplat predictions consumed by PlayerAgent
├─ Telemetry routed through MCP Catching Layer
└─ Fault handling delegated to CognitiveImmunologyEmergency
```

### 7.2 Standalone Mode

```
STANDALONE_MODE = 1
├─ FPGA self-sequences boot from STANDALONE_PROFILE
├─ Hexagram state defaults to profile hexagram
├─ GhostSplat runs autonomously with sensor feedback
├─ Telemetry written to D1 audit trail (not MCP)
├─ Fault handling: local limp mode, no software override
└─ Reverts to PS-coupled on AXI4-Lite transaction detected
```

### 7.3 Emergency Mode

```
Triggered by: EMERGENCY_OPEN (CONTROL bit 8) OR any CRIT fault
├─ All contactors forced to OPEN (bypasses all state machines)
├─ Choke PWM set to 0% duty (immediate)
├─ GhostSplat horizon reduced to 1 tick
├─ HexagramSM locked to hexagram 0 (uninit)
├─ Telemetry rate increased to maximum (100 Hz)
├─ IRQ: THERMAL_CRIT + BUS_FAULT + WATCHDOG asserted
└─ Exit: Software writes GLOBAL_RESET or power cycle
```

---

## 8. Performance Budget

| Path | Latency | Budget | Status |
|------|---------|--------|--------|
| Sensor ADC → GhostSplat prediction | 2 ticks (1.28 s) | < 3 ticks | ✅ |
| GhostSplat → HexagramSM yao eval | 1 tick (0.64 s) | < 2 ticks | ✅ |
| Yao eval → Contactor command | 1 tick (0.64 s) | < 2 ticks | ✅ |
| Contactor command → physical close | 15 ms | < 20 ms | ✅ |
| Thermal CRIT → limp mode engage | 3 ticks (1.92 s) | < 5 ticks | ✅ |
| Hexagram change → cognitive pulse | 1 cycle (4 ns) | < 1 tick | ✅ |
| AXI4-Lite read | 2 cycles (8 ns) | < 10 cycles | ✅ |
| AXI4-Lite write | 1 cycle (4 ns) | < 5 cycles | ✅ |
| Telemetry packet encode | 72 clock cycles (288 ns) | < 1 tick | ✅ |
| MCP adapter JSON-RPC round-trip | ~2 ms | < 10 ms | ✅ |
| End-to-end (sensor → software HUD) | ~5 ms | < 50 ms | ✅ |

---

## 9. Revision History

| Rev | Date | Author | Changes |
|-----|------|--------|---------|
| 1.0 | 2026-06-05 | POG2 Sovereign | Initial release, 7 VHDL modules, 64-register map, 10 MCP tools, 10 resources |

---

*End of Integration Specification*
