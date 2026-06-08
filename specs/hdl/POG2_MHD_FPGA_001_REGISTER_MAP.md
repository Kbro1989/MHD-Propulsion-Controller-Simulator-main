# POG2-MHD-FPGA-001 Register Map
## AXI4-Lite Address Space | Rev 1.0 | 2026-06-05

---

### 1. Overview

| Property | Value |
|----------|-------|
| Base Address | `0x43C0_0000` |
| Address Range | `0x43C0_0000` – `0x43C0_00FF` (256 bytes, 64 registers) |
| Register Width | 32-bit |
| Alignment | 4-byte |
| Protocol | AXI4-Lite (single-beat, no bursts) |
| Clock Domain | `aclk` @ 250 MHz |
| Reset | Active-high `aresetn` (synchronous) |

**Access Types:**
- `RO` — Read-only (hardware updates, software observes)
- `RW` — Read-write (software commands, hardware acts)
- `RC` — Read-clears (status flags, read to acknowledge)
- `WO` — Write-only (command pulse, write any value to trigger)

---

### 2. Register Summary

| Offset | Name | Access | Reset Value | Description |
|--------|------|--------|-------------|-------------|
| `0x00` | `ID` | RO | `0x504F4732` | Magic: "POG2" |
| `0x04` | `REV` | RO | `0x0001_0000` | Revision 1.0.0 |
| `0x08` | `STATUS` | RO | `0x0000_0000` | Global status flags |
| `0x0C` | `CONTROL` | RW | `0x0000_0000` | Global control |
| `0x10` | `HEXAGRAM_STATE` | RO | `0x0000_0000` | Current 6-bit hexagram ID |
| `0x14` | `YAO_LINES` | RW | `0x0000_0000` | 6 yao line states (override) |
| `0x18` | `YAO_THRESHOLDS` | RO | `0x0000_0000` | Current scaled thresholds |
| `0x1C` | `COGNITIVE_PULSE` | RC | `0x0000_0000` | State-change event flags |
| `0x20` | `VIBE_MODE` | RW | `0x0000_0000` | Personality archetype |
| `0x24` | `THERMAL_VARIANCE` | RW | `0x0000_8000` | 0.0–1.0 fixed-point (0.5 default) |
| `0x28` | `PERSONALITY_CARD` | RW | `0x0000_0000` | Pinned archetype ID |
| `0x2C` | `BOOT_PHASE` | RO | `0x0000_0000` | Current boot sequence phase |
| `0x30` | `BOOT_CONTROL` | WO | `0x0000_0000` | Boot sequence trigger |
| `0x34` | `CRIT_TIMEOUT` | RW | `0x0000_002F` | 47 ticks (0x2F) default |
| `0x38` | `GHOSTSPLAT_HORIZON` | RW | `0x0000_0003` | 3 ticks default |
| `0x3C` | `TICK_DURATION_MS` | RW | `0x0000_0280` | 640 ms (0x280) default |
| `0x40` | `CONTACTOR_TARGET` | RW | `0x0000_0000` | 10-bit target pattern |
| `0x44` | `CONTACTOR_STATUS` | RO | `0x0000_0000` | 10× 3-bit state feedback |
| `0x48` | `CONTACTOR_FAULT` | RC | `0x0000_0000` | Arc/weld fault flags |
| `0x4C` | `CHOKE_DUTY` | RW | `0x0000_0000` | 5× 12-bit duty cycles |
| `0x50` | `CHOKE_PHASE` | RW | `0x0000_0000` | 5× 8-bit phase offsets |
| `0x54` | `CHOKE_FREQUENCY` | RW | `0x0000_1964` | 6.5 kHz (0x1964) default |
| `0x58` | `SENSOR_ADC_0` | RO | `0x0000_0000` | Segment 0 thermal ADC |
| `0x5C` | `SENSOR_ADC_1` | RO | `0x0000_0000` | Segment 1 thermal ADC |
| `0x60` | `SENSOR_ADC_2` | RO | `0x0000_0000` | Segment 2 thermal ADC |
| `0x64` | `SENSOR_ADC_3` | RO | `0x0000_0000` | Segment 3 thermal ADC |
| `0x68` | `SENSOR_ADC_4` | RO | `0x0000_0000` | Segment 4 thermal ADC |
| `0x6C` | `SENSOR_BUS_V` | RO | `0x0000_0000` | Bus voltage ADC (scaled) |
| `0x70` | `SENSOR_BUS_I` | RO | `0x0000_0000` | Bus current ADC (scaled) |
| `0x74` | `SENSOR_PLENUM_P` | RO | `0x0000_0000` | Plenum pressure ADC |
| `0x78` | `SENSOR_SALT_H` | RO | `0x0000_0000` | Salt hydration ADC |
| `0x7C` | `SENSOR_FAULT` | RC | `0x0000_0000` | Sensor fault flags |
| `0x80` | `GHOSTSPLAT_FIELD_0` | RO | `0x0000_0000` | Segment 0 predicted heat |
| `0x84` | `GHOSTSPLAT_FIELD_1` | RO | `0x0000_0000` | Segment 1 predicted heat |
| `0x88` | `GHOSTSPLAT_FIELD_2` | RO | `0x0000_0000` | Segment 2 predicted heat |
| `0x8C` | `GHOSTSPLAT_FIELD_3` | RO | `0x0000_0000` | Segment 3 predicted heat |
| `0x90` | `GHOSTSPLAT_FIELD_4` | RO | `0x0000_0000` | Segment 4 predicted heat |
| `0x94` | `GHOSTSPLAT_TREND` | RO | `0x0000_0000` | 5× 6-bit trend vectors |
| `0x98` | `GHOSTSPLAT_SAT` | RO | `0x0000_0000` | Saturation mask |
| `0x9C` | `GHOSTSPLAT_HORIZON_REG` | RO | `0x0000_0000` | Current prediction horizon |
| `0xA0` | `TELEMETRY_SEQ` | RO | `0x0000_0000` | Telemetry sequence counter |
| `0xA4` | `TELEMETRY_RATE` | RW | `0x0000_0001` | Packets per tick |
| `0xA8` | `TELEMETRY_CONFIG` | RW | `0x0000_0000` | Telemetry channel mask |
| `0xAC` | `TELEMETRY_PAYLOAD` | RO | `0x0000_0000` | Last packet CRC |
| `0xB0` | `SAFETY_OK` | RO | `0x0000_0000` | HexagramSM safety interlock |
| `0xB4` | `LIMP_MODE` | RW | `0x0000_0000` | Checkerboard shed pattern |
| `0xB8` | `FAULT_INJECT` | WO | `0x0000_0000` | Fault injection trigger |
| `0xBC` | `FAULT_LOG` | RC | `0x0000_0000` | Fault history (FIFO) |
| `0xC0` | `STANDALONE_MODE` | RW | `0x0000_0001` | 1 = autonomous, 0 = PS-coupled |
| `0xC4` | `STANDALONE_PROFILE` | RW | `0x0000_0001` | Hexagram ID for standalone boot |
| `0xC8` | `STANDALONE_TIMEOUT` | RW | `0x0000_01E0` | 480 ticks (307.2 s) default |
| `0xCC` | `INTERRUPT_MASK` | RW | `0x0000_0000` | IRQ enable mask |
| `0xD0` | `INTERRUPT_STATUS` | RC | `0x0000_0000` | IRQ pending flags |
| `0xD4` | `INTERRUPT_CLEAR` | WO | `0x0000_0000` | IRQ force-clear |
| `0xD8` | `DEBUG_PROBE_0` | RO | `0x0000_0000` | Internal probe (HexagramSM) |
| `0xDC` | `DEBUG_PROBE_1` | RO | `0x0000_0000` | Internal probe (GhostSplat) |
| `0xE0` | `DEBUG_PROBE_2` | RO | `0x0000_0000` | Internal probe (Contactor) |
| `0xE4` | `DEBUG_PROBE_3` | RO | `0x0000_0000` | Internal probe (Choke) |
| `0xE8` | `SCRATCH_0` | RW | `0x0000_0000` | General-purpose scratch |
| `0xEC` | `SCRATCH_1` | RW | `0x0000_0000` | General-purpose scratch |
| `0xF0` | `SCRATCH_2` | RW | `0x0000_0000` | General-purpose scratch |
| `0xF4` | `SCRATCH_3` | RW | `0x0000_0000` | General-purpose scratch |
| `0xF8` | `RESERVED` | — | `0x0000_0000` | Reserved |
| `0xFC` | `RESERVED` | — | `0x0000_0000` | Reserved |

---

### 3. Bit Field Definitions

#### `STATUS` (0x08)

| Bit | Name | Description |
|-----|------|-------------|
| 0 | `HEXAGRAM_READY` | HexagramSM initialized |
| 1 | `GHOSTSPLAT_READY` | Predictor initialized |
| 2 | `CONTACTOR_READY` | All contactors in OPEN |
| 3 | `CHOKE_READY` | PWM running at idle |
| 4 | `SENSOR_READY` | ADC calibration complete |
| 5 | `TELEMETRY_READY` | Encoder synchronized |
| 6 | `BOOT_COMPLETE` | All 6 boot phases done |
| 7 | `STANDALONE_ACTIVE` | Running in autonomous mode |
| 8 | `CRIT_ACTIVE` | CRIT timeout in progress |
| 9 | `LIMP_ACTIVE` | Limp mode engaged |
| 10 | `ARC_FAULT` | Any contactor in ARC_SUPPRESS |
| 11 | `THERMAL_FAULT` | Any segment > T_CRIT_LIMIT |
| 12 | `PRESSURE_FAULT` | Plenum pressure out of range |
| 13 | `SALT_FAULT` | Salt hydration out of range |
| 14 | `BUS_FAULT` | Overvoltage or overcurrent |
| 15 | `WATCHDOG_FAULT` | Internal watchdog expired |
| 31:16 | `RESERVED` | — |

#### `CONTROL` (0x0C)

| Bit | Name | Description |
|-----|------|-------------|
| 0 | `HEXAGRAM_ENABLE` | Enable HexagramSM clock |
| 1 | `GHOSTSPLAT_ENABLE` | Enable predictor clock |
| 2 | `CONTACTOR_ENABLE` | Enable contactor sequencer |
| 3 | `CHOKE_ENABLE` | Enable PWM generator |
| 4 | `SENSOR_ENABLE` | Enable ADC acquisition |
| 5 | `TELEMETRY_ENABLE` | Enable telemetry encoder |
| 6 | `GLOBAL_RESET` | Assert global reset (self-clearing) |
| 7 | `BOOT_START` | Initiate boot sequence |
| 8 | `EMERGENCY_OPEN` | Force all contactors to OPEN |
| 9 | `EMERGENCY_LIMP` | Force limp mode (checkerboard) |
| 10 | `TELEMETRY_BURST` | Emit one telemetry burst |
| 31:11 | `RESERVED` | — |

#### `HEXAGRAM_STATE` (0x10)

| Bit | Description |
|-----|-------------|
| 5:0 | Hexagram ID (1–64, 0 = uninitialized) |
| 11:6 | Previous hexagram ID |
| 15:12 | Boot profile index |
| 31:16 | `RESERVED` |

#### `YAO_LINES` (0x14)

| Bit | Name | Description |
|-----|------|-------------|
| 0 | `YAO_1` | Line 1 (bottom) — 0 = yin, 1 = yang |
| 1 | `YAO_2` | Line 2 |
| 2 | `YAO_3` | Line 3 |
| 3 | `YAO_4` | Line 4 |
| 4 | `YAO_5` | Line 5 |
| 5 | `YAO_6` | Line 6 (top) |
| 6 | `OVERRIDE_EN` | 1 = software override active |
| 7 | `OVERRIDE_LOCK` | 1 = prevent further override until cleared |
| 15:8 | `RESERVED` |
| 31:16 | `THRESHOLD_SCALE` | 16-bit fixed-point scale factor (0.0–2.0) |

**Note:** When `OVERRIDE_EN = 1`, the HexagramSM uses the software-provided yao lines instead of evaluating thermal thresholds. `OVERRIDE_LOCK` prevents accidental override during critical operations.

#### `VIBE_MODE` (0x20)

| Value | Archetype | thermal_variance | Behavior |
|-------|-----------|------------------|----------|
| `0x00` | `CLINICAL` | 0.2 | Conservative thresholds, slow transitions |
| `0x01` | `AGITATED` | 0.8 | Aggressive thresholds, fast transitions |
| `0x02` | `STEALTH` | 0.1 | Minimal signature, ultra-conservative |
| `0x03` | `TRANSIT` | 0.5 | Default, balanced |
| `0x04` | `LIMP` | 0.3 | Degraded, checkerboard preference |
| `0x05` | `CRIT` | 1.0 | Emergency override, max thermal headroom |
| `0x06` | `PURGE` | 0.0 | All systems idle, zero consumption |
| `0x07` | `DARK_IRON` | 0.0 | Cold boot, no thermal load |
| `0x08`–`0xFF` | `CUSTOM` | — | User-defined via `THERMAL_VARIANCE` |

#### `THERMAL_VARIANCE` (0x24)

- Format: 16-bit unsigned fixed-point, 8.8 (8 integer, 8 fractional)
- Range: `0x0000` (0.0) to `0x0100` (1.0)
- Default: `0x0080` (0.5)
- Formula: `threshold = 0.7 − (variance × 0.21)`
- Example: `0x0033` = 0.2 → threshold = 0.658

#### `CONTACTOR_TARGET` (0x40)

| Bit | Description |
|-----|-------------|
| 9:0 | Target pattern: 1 = close, 0 = open (one bit per contactor) |
| 19:10 | `RESERVED` |
| 23:20 | Shed pattern for limp mode (4-bit) |
| 31:24 | `RESERVED` |

#### `CONTACTOR_STATUS` (0x44)

Each contactor occupies 3 bits:

| Value | State |
|-------|-------|
| `000` | `OPEN` |
| `001` | `PRECHARGE` |
| `010` | `CLOSING` |
| `011` | `CLOSED` |
| `100` | `OPENING` |
| `101` | `ARC_SUPPRESS` |
| `110` | `WELD_DETECTED` |
| `111` | `FAULT` |

Contactor 0 = bits 2:0, contactor 1 = bits 5:3, ..., contactor 9 = bits 29:27.

#### `CONTACTOR_FAULT` (0x48)

| Bit | Description |
|-----|-------------|
| 9:0 | Arc suppress flag per contactor |
| 19:10 | Welded contactor flag |
| 29:20 | Open timeout flag |
| 30 | Any arc fault (aggregate) |
| 31 | Any weld fault (aggregate) |

#### `CHOKE_DUTY` (0x4C)

| Bit | Description |
|-----|-------------|
| 11:0 | Channel 0 duty cycle (0–4095 = 0–100%) |
| 23:12 | Channel 1 duty cycle |
| 31:24 | `RESERVED` |

Channels 2–4 are in `CHOKE_DUTY+1` (0x50) at same bit layout.

#### `CHOKE_PHASE` (0x50)

| Bit | Description |
|-----|-------------|
| 7:0 | Channel 0 phase offset (0–255, maps to 0–2π) |
| 15:8 | Channel 1 phase offset |
| 23:16 | Channel 2 phase offset |
| 31:24 | Channel 3 phase offset |

Channel 4 phase is in `CHOKE_PHASE+1` (0x54) bits 7:0.

#### `SENSOR_ADC_x` (0x58–0x68)

- Format: 12-bit unsigned ADC value, bits 11:0
- Scaling: 1 LSB = 0.0625 K (range: 0–256 K above absolute zero)
- Example: `0x1B00` = 6912 → 432 K (158.85 °C)
- Bits 31:12: `RESERVED`

#### `SENSOR_BUS_V` (0x6C)

- Format: 16-bit unsigned, 1 LSB = 0.1 V
- Range: 0–6553.5 V
- Nominal: `0x1388` = 5000 V

#### `SENSOR_BUS_I` (0x70)

- Format: 16-bit unsigned, 1 LSB = 0.1 A
- Range: 0–6553.5 A
- Nominal: `0x0758` = 1880 A

#### `GHOSTSPLAT_FIELD_x` (0x80–0x90)

- Format: 16-bit signed fixed-point, 8.8 (°C)
- Predicted temperature at horizon ticks in the future
- Example: `0x0140` = 1.25 × 256 = 320 K

#### `GHOSTSPLAT_TREND` (0x94)

| Bit | Description |
|-----|-------------|
| 5:0 | Segment 0 trend (signed 6-bit, °C/tick) |
| 11:6 | Segment 1 trend |
| 17:12 | Segment 2 trend |
| 23:18 | Segment 3 trend |
| 29:24 | Segment 4 trend |
| 31:30 | `RESERVED` |

#### `GHOSTSPLAT_SAT` (0x98)

| Bit | Description |
|-----|-------------|
| 4:0 | Saturation mask per segment (1 = clamped) |
| 31:5 | `RESERVED` |

#### `INTERRUPT_MASK` (0xCC) / `INTERRUPT_STATUS` (0xD0)

| Bit | Name | Source |
|-----|------|--------|
| 0 | `IRQ_HEXAGRAM_CHANGE` | HexagramSM state transition |
| 1 | `IRQ_GHOSTSPLAT_UPDATE` | Predictor new field ready |
| 2 | `IRQ_CONTACTOR_DONE` | All contactors match target |
| 3 | `IRQ_CONTACTOR_FAULT` | Arc or weld detected |
| 4 | `IRQ_THERMAL_CRIT` | Segment > T_CRIT_LIMIT |
| 5 | `IRQ_PRESSURE_CRIT` | Plenum out of range |
| 6 | `IRQ_SALT_CRIT` | Salt hydration fault |
| 7 | `IRQ_BUS_FAULT` | Overcurrent/overvoltage |
| 8 | `IRQ_BOOT_COMPLETE` | Boot sequence finished |
| 9 | `IRQ_TELEMETRY_READY` | Telemetry packet emitted |
| 10 | `IRQ_WATCHDOG` | Watchdog bark |
| 11 | `IRQ_STANDALONE_TIMEOUT` | Autonomous mode timeout |
| 31:12 | `RESERVED` | — |

#### `STANDALONE_MODE` (0xC0)

| Value | Mode |
|-------|------|
| 0 | `PS_COUPLED` — FPGA waits for PS commands |
| 1 | `AUTONOMOUS` — FPGA self-sequences using `STANDALONE_PROFILE` |

---

### 4. Boot Sequence Register Mapping

The 6-phase boot from the physical schematic maps to register transitions:

| Phase | Time | `BOOT_PHASE` Value | `HEXAGRAM_STATE` | Actions |
|-------|------|-------------------|------------------|---------|
| DARK IRON | 0 s | `0x00` | 0 (uninit) | Power-on, all contactors OPEN, choke idle |
| POWER WAKE | 30 s | `0x01` | 7 (Dark Iron) | Sensor calibration, self-test |
| SALT CHARGE | 90 s | `0x02` | 3 (Difficulty) | Pre-charge contactors, salt hydrate check |
| PLENUM RISE | 150 s | `0x03` | 48 (The Well) | Pressure build, thermal baseline |
| DEGAUSS | 180 s | `0x04` | 23 (Splitting) | Magnetic field stabilization |
| CHANNEL PRIME | 240 s | `0x05` | 29 (The Abysmal) | Choke resonance lock, segment test |
| STEALTH IDLE | 240 s+ | `0x06` | 1 (The Creative) | Full operational, minimal signature |

Writing to `BOOT_CONTROL` (0x30) triggers phase advance. Reading `BOOT_PHASE` shows current phase.

---

### 5. Personality-Driven Threshold Scaling

The `YAO_THRESHOLDS` register (0x18) reflects the **scaled** thermal thresholds based on current `VIBE_MODE` and `THERMAL_VARIANCE`:

```
base_threshold = 320 K (T_CRIT_LIMIT)
variance = THERMAL_VARIANCE / 256.0
scale = 0.7 - (variance * 0.21)
scaled_threshold = base_threshold * scale
```

| VIBE_MODE | variance | scale | 320 K × scale |
|-----------|----------|-------|---------------|
| CLINICAL | 0.2 | 0.658 | 210.6 K |
| AGITATED | 0.8 | 0.532 | 170.2 K |
| STEALTH | 0.1 | 0.679 | 217.3 K |
| TRANSIT | 0.5 | 0.595 | 190.4 K |
| LIMP | 0.3 | 0.637 | 203.8 K |
| CRIT | 1.0 | 0.490 | 156.8 K |
| PURGE | 0.0 | 0.700 | 224.0 K |
| DARK_IRON | 0.0 | 0.700 | 224.0 K |

**Note:** These are the yao-line evaluation thresholds, not the absolute thermal limits. The hardware still enforces 320 K as a hard limit regardless of personality.

---

### 6. Fault Injection Protocol

Writing to `FAULT_INJECT` (0xB8) triggers simulated faults for test:

| Write Value | Effect |
|-------------|--------|
| `0x0000_0001` | Force contactor 0 arc fault |
| `0x0000_0002` | Force contactor 1 arc fault |
| ... | ... |
| `0x0000_0400` | Force contactor 10 arc fault |
| `0x0000_0800` | Force thermal sensor fault |
| `0x0000_1000` | Force pressure sensor fault |
| `0x0000_2000` | Force salt sensor fault |
| `0x0000_4000` | Force bus overvoltage |
| `0x0000_8000` | Force bus overcurrent |
| `0x0001_0000` | Force watchdog timeout |
| `0x0002_0000` | Force choke resonance loss |
| `0x0004_0000` | Force GhostSplat divergence |
| `0x0008_0000` | Force HexagramSM deadlock |
| `0x8000_0000` | Clear all injected faults |

Reading `FAULT_LOG` (0xBC) returns a 32-bit FIFO entry: `{ timestamp: 16, fault_code: 12, injected: 1, cleared: 1 }`. Read until `0x0000_0000` (empty).

---

### 7. AXI4-Lite Transaction Rules

- **Read latency:** 2 cycles (register → pipeline → AXI4-Lite RDATA)
- **Write latency:** 1 cycle (AWVALID/AWREADY → register update)
- **Write strobes:** Supported (WSTRB masks byte-wise updates)
- **Error responses:** `SLVERR` on access to reserved offsets or write to RO registers
- **Exclusive access:** Not supported (AXI4-Lite has no exclusive transactions)
- **Burst:** Single-beat only (ARLEN/AWLEN = 0)

---

### 8. MCP Register Access Mapping

The MCP adapter translates JSON-RPC calls to AXI4-Lite reads/writes:

```json
{
  "tools": [{
    "name": "fpga_register_read",
    "description": "Read FPGA AXI4-Lite register",
    "parameters": {
      "offset": { "type": "string", "pattern": "^0x[0-9A-Fa-f]{2}$" },
      "count": { "type": "integer", "minimum": 1, "maximum": 16 }
    }
  }, {
    "name": "fpga_register_write",
    "description": "Write FPGA AXI4-Lite register",
    "parameters": {
      "offset": { "type": "string", "pattern": "^0x[0-9A-Fa-f]{2}$" },
      "value": { "type": "string", "pattern": "^0x[0-9A-Fa-f]{8}$" },
      "mask": { "type": "string", "pattern": "^0x[0-9A-Fa-f]{8}$", "default": "0xFFFFFFFF" }
    }
  }]
}
```

---

*End of Register Map*
