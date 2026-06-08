# POG2-MHD-FPGA-001 Memory & Pedagogy Integration Map

## 1. Software Memory Hierarchy → FPGA Register Hierarchy

```
POG2 Software Memory                          FPGA Hardware Registers
─────────────────────                         ───────────────────────
memory/pedagogy/                              Hexagram Property ROM (64 × 32b)
├── verified_entities.jsonl                   ├── thermal_variance[64]
├── combat_profiles/                          ├── crit_timeout_ticks[64]
└── semantic_names/                           ├── limb_shed_pattern[64]
                                              └── boot_profile[64]

memory/learning/                              GHOSTSPLAT_FIELD (0x80-0x98)
├── sovereign-learning.db                     ├── segment_heat[5] (uint16)
├── vector_db_index/                          ├── segment_trend[5] (int8)
└── training_snapshots/                       └── saturation_mask (uint8)

memory/consolidation/                         TELEMETRY_SEQ (0xA0) + FAULT_LOG (0xBC)
├── compressed_states/                        ├── sequence counter (uint32)
├── emotional_weights/                        └── FIFO fault history (uint32)
└── vibe_mutations/

generations/                                  BOOT_PHASE (0x2C) + TICK_COUNT (0x34)
├── storyboard/                               ├── phase enum (uint8)
├── voice/                                    └── tick counter (uint32)
└── video/

src/limbs/metaphysical/                       STATUS (0x08) + CONTROL (0x0C)
├── GhostLimb.ts                              ├── INIT_DONE, GHOSTSPLAT_READY
├── RelicLimb.ts                              ├── THERMAL_CRIT, BUS_FAULT
└── QuantumLimb.ts                            └── EMERGENCY_OPEN, EMERGENCY_LIMP
```

## 2. Pedagogy Corpus → Hexagram Property ROM

### 2.1 Entity-to-Hexagram Mapping

| Entity Type | Example | Hexagram ID | Thermal Variance | Vibe Mode | Shed Pattern |
|-------------|---------|-------------|------------------|-----------|--------------|
| Boss (high HP) | General Graardor | 1 (Creative) | 0.8 (aggressive) | AGITATED | Minimal shed |
| Boss (mechanic) | Vorago | 23 (Splitting) | 0.5 (balanced) | TRANSIT | Checkerboard |
| Slayer mob | Abyssal demon | 52 (Keeping Still) | 0.2 (conservative) | SERENE | Aggressive shed |
| Wilderness boss | Chaos Elemental | 64 (Before Completion) | 1.0 (chaotic) | SPOOKY | Full shed |
| Quest NPC | Wise Old Man | 2 (Receptive) | 0.3 (cautious) | CLINICAL | Gradual shed |

### 2.2 Combat Profile → Thermal Profile Translation

```typescript
// Software: Combat profile
const profile = {
  entity: "General Graardor",
  combatLevel: 624,
  maxHit: 60,
  attackSpeed: 4, // ticks
  weaknesses: ["range", "mage"],
  verified: true
};

// FPGA: Thermal profile (auto-generated from combat profile)
const thermalProfile = {
  hexagramId: 1,              // Creative = aggressive
  thermalVariance: 0.8,       // High aggression = high variance
  critTimeoutTicks: 47,       // 30.1 s at 640 ms
  limbShedPattern: 0x0000,    // Minimal shed (boss = don't retreat)
  bootProfile: "fast",        // Aggressive ramp
  chokePhaseOffset: [0, 72, 144, 216, 288], // Standard 5-phase
  vibeMode: "AGITATED"        // High adrenaline mapping
};
```

### 2.3 ROM Programming Interface

```vhdl
-- Hexagram Property ROM (synthesized as distributed LUT ROM)
type hexagram_property_t is record
    thermal_variance    : unsigned(7 downto 0);   -- 8.8 fixed, 0x80 = 0.5
    crit_timeout        : unsigned(15 downto 0);  -- ticks
    shed_pattern        : std_logic_vector(9 downto 0); -- contactor mask
    boot_profile        : unsigned(2 downto 0);   -- 0=fast, 1=slow, 2=cautious, 3=minimal, 4=diagnostic, 5=recovery
    choke_phase_preset  : unsigned(15 downto 0); -- phase offset base
    vibe_mode_default   : unsigned(3 downto 0);   -- 0=clinical, 1=agitated, ...
end record;

type hexagram_rom_t is array (0 to 63) of hexagram_property_t;

constant HEXAGRAM_ROM : hexagram_rom_t := (
    0  => (thermal_variance => x"80", crit_timeout => x"002F", shed_pattern => "0000000000", boot_profile => "001", choke_phase_preset => x"0000", vibe_mode_default => x"0"), -- uninit
    1  => (thermal_variance => x"CC", crit_timeout => x"0028", shed_pattern => "0000000000", boot_profile => "000", choke_phase_preset => x"0000", vibe_mode_default => x"1"), -- Creative (aggressive)
    2  => (thermal_variance => x"4C", crit_timeout => x"0038", shed_pattern => "1111111111", boot_profile => "001", choke_phase_preset => x"0000", vibe_mode_default => x"0"), -- Receptive (conservative)
    -- ... 62 more entries populated from pedagogy corpus
    23 => (thermal_variance => x"80", crit_timeout => x"0030", shed_pattern => "1100110011", boot_profile => "010", choke_phase_preset => x"0000", vibe_mode_default => x"3"), -- Splitting (cautious)
    52 => (thermal_variance => x"33", crit_timeout => x"0040", shed_pattern => "1111111111", boot_profile => "011", choke_phase_preset => x"0000", vibe_mode_default => x"5"), -- Keeping Still (minimal)
    64 => (thermal_variance => x"FF", crit_timeout => x"0020", shed_pattern => "1111111111", boot_profile => "100", choke_phase_preset => x"0000", vibe_mode_default => x"6"), -- Before Completion (diagnostic)
    others => (thermal_variance => x"80", crit_timeout => x"002F", shed_pattern => "1100110011", boot_profile => "001", choke_phase_preset => x"0000", vibe_mode_default => x"0")
);
```

## 3. Event Sourcing: Software → FPGA

### 3.1 TrainingCollector → TELEMETRY_SEQ

| Software Event | FPGA Register | Mapping |
|----------------|---------------|---------|
| `combat_rotation` event | TELEMETRY_SEQ increment | Each ability use = one telemetry packet |
| `adrenaline_change` | SEGx_HEAT delta | Adrenaline ↑ = thermal load ↑ |
| `entity_death` | CONTACTOR_FAULT bit set | Kill = segment shed (fault simulation) |
| `ability_cooldown` | CHOKE_DUTY ramp | Cooldown = duty cycle reduction |
| `hexagram_transition` | COGNITIVE_PULSE | State change = broadcast pulse |

### 3.2 D1 Audit Trail → FAULT_LOG

```sql
-- Software: D1 structured audit
CREATE TABLE fpga_events (
    id INTEGER PRIMARY KEY,
    timestamp INTEGER,      -- CanonicalClock tick
    event_type TEXT,        -- 'thermal_crit', 'contactor_open', 'hexagram_change'
    hexagram_id INTEGER,
    yao_lines INTEGER,
    segment_mask INTEGER,   -- Which segments affected
    confidence REAL,        -- GhostSplat confidence
    raw_payload BLOB        -- Full telemetry packet
);

-- FPGA: FAULT_LOG register (32-bit FIFO, 16 entries deep)
-- Each write pushes: {fault_code(8), hexagram_id(8), yao_lines(6), reserved(10)}
```

### 3.3 KV Delta → TELEMETRY_BURST

```typescript
// Software: KV delta with 24h TTL
await kv.put(`fpga:delta:${tick}`, compressedTelemetry, { expirationTtl: 86400 });

// FPGA: Telemetry burst mode (100 Hz during emergency)
// Each packet = 72 bytes → 7.2 KB/s burst rate
// KV stores compressed delta (LZ4) → ~200 bytes per tick
```

## 4. Compression Pipeline: Full Stack → YaoState Model

### 4.1 Compression Stages

```
Stage 1: Raw Ingestion
├── Gameplay logs (millions of ticks)
├── Thermal telemetry (per-tick packets)
├── Combat rotations (ability sequences)
└── Hexagram evaluations (state transitions)
    ↓
Stage 2: Epistemic Validation
├── Directional enforcement (EXECUTION → CAUSAL → INTERPRETATION)
├── Truth reconciliation (SHA-256 causality ledger)
└── Chaos constraint (OldMixed blocks)
    ↓
Stage 3: Feature Extraction
├── YaoState vector (6 bits)
├── Thermal variance (8-bit fixed)
├── Emotional weight (8-bit fixed)
├── Hexagram ID (6 bits)
└── Confidence (8 bits)
    ↓
Stage 4: Model Training (Ollama)
├── Input: YaoState + thermal + emotional + hexagram
├── Hidden: Ternary routing (729 → 64 paths)
├── Output: Next YaoState + confidence + action ID
└── Loss: Cross-entropy on state transitions
    ↓
Stage 5: Model Deployment
├── Weights: 2-4 GB (pog2-yaostate)
├── Runtime: Ollama local / edge / phone
├── Interface: Hexagram interpreter API
└── Fallback: FPGA ROM defaults (standalone mode)
```

### 4.2 YaoState Model → FPGA ROM Programming

```typescript
// After training, compress model into ROM-compatible format
const yaostateWeights = await ollama.export('pog2-yaostate');

// Extract hexagram personality vectors
const personalityVectors = yaostateWeights.extractLayer('hexagram_embedding');

// Program FPGA ROM via AXI4-Lite
for (let id = 1; id <= 64; id++) {
    const vec = personalityVectors[id];
    await fpga.writeRegister(0x100 + (id * 8), vec.thermalVariance);    // thermal_variance
    await fpga.writeRegister(0x100 + (id * 8) + 2, vec.critTimeout);     // crit_timeout
    await fpga.writeRegister(0x100 + (id * 8) + 4, vec.shedPattern);      // shed_pattern
    await fpga.writeRegister(0x100 + (id * 8) + 6, vec.bootProfile);      // boot_profile
}
```

## 5. Memory Layout: AXI4-Lite Address Space

### 5.1 Register Regions

| Base | Size | Region | Contents |
|------|------|--------|----------|
| 0x43C0_0000 | 0x100 | Control/Status | ID, VERSION, STATUS, CONTROL, HEXAGRAM_STATE, YAO_LINES, YAO_THRESHOLDS |
| 0x43C0_0100 | 0x100 | Personality | VIBE_MODE, THERMAL_VARIANCE, PERSONALITY_CARD, BOOT_PHASE, TICK_DURATION_MS |
| 0x43C0_0200 | 0x100 | Actuation | CONTACTOR_STATUS, CONTACTOR_FAULT, CONTACTOR_TARGET, LIMP_MODE |
| 0x43C0_0300 | 0x100 | Choke Driver | CHOKE_DUTY[5], CHOKE_PHASE[5], CHOKE_FREQ, CHOKE_TOLERANCE |
| 0x43C0_0400 | 0x100 | Thermal Field | SEGx_HEAT[5], SEGx_TREND[5], GHOSTSPLAT_CONF, GHOSTSPLAT_HORIZON, GHOSTSPLAT_SAT |
| 0x43C0_0500 | 0x100 | Telemetry | TELEMETRY_SEQ, TELEMETRY_RATE, TELEMETRY_CHAN_MASK, TELEMETRY_MAGIC |
| 0x43C0_0600 | 0x100 | Fault/Log | FAULT_CODE, FAULT_LOG, FAULT_COUNT, EMERGENCY_LOG |
| 0x43C0_0700 | 0x100 | Standalone | STANDALONE_MODE, STANDALONE_HEXAGRAM, STANDALONE_VIBE |
| 0x43C0_0800 | 0x200 | Hexagram ROM | 64 × 8-byte property entries (thermal_variance, crit_timeout, shed_pattern, boot_profile) |
| 0x43C0_0A00 | 0x600 | Reserved | Future expansion |

### 5.2 Alignment and Access Rules

- 32-bit registers: word-aligned (offset % 4 == 0)
- 16-bit registers: halfword-aligned (offset % 2 == 0)
- 8-bit registers: byte-aligned (any offset)
- Read-only registers: write attempts return SLVERR
- Write-only registers: read attempts return SLVERR
- Self-clearing bits: read returns current value, write 1 to set, auto-clears next cycle

## 6. Cross-Layer Synchronization

### 6.1 Clock Domains

| Domain | Frequency | Source | Purpose |
|--------|-----------|--------|---------|
| AXI4-Lite | 250 MHz | Zynq PS FCLK | Register access |
| Control FSM | 250 MHz | PLL | HexagramSM, ContactorSeq, ChokeDriver |
| Sensor ADC | 1 MHz | PLL / 250 | Oversampling for noise reduction |
| Telemetry | 10-100 Hz | Tick divider | Packet generation |
| CanonicalClock | 1.5625 Hz (640 ms) | TICK_DURATION_MS | Metabolic tick |
| Watchdog | 0.033 Hz (30 s) | WATCHDOG_TIMEOUT | Safety timeout |

### 6.2 Metabolic Tick Synchronization

```
CanonicalClock (software) → TICK_DURATION_MS (0x3C) → FPGA tick generator
     │
     ├── 640 ms (RSC mode) → tick_gen divides 250 MHz by 156,250,000
     ├── 600 ms (RS3 mode) → tick_gen divides 250 MHz by 150,000,000
     └── writable → software can adjust for drift

FPGA tick → HexagramSM evaluation → GhostSplat prediction → ContactorSeq update
     │
     └── COGNITIVE_PULSE output → all limbs synchronized on tick edge
```

### 6.3 Watchdog Synchronization

```
Software: PulseMonitor pet → WATCHDOG_CTRL bit 1 (PET)
FPGA: Hardware timer counts ticks since last PET
If count > WATCHDOG_TIMEOUT (47 ticks = 30.1 s):
    → WATCHDOG bit set in STATUS
    → EMERGENCY_OPEN asserted
    → All contactors forced OPEN
    → HexagramSM reset to 0 (uninit)
    → GhostSplat confidence forced to 0
    → IRQ asserted to PS
```

## 7. Deployment Checklist: Memory & Pedagogy

- [ ] Pedagogy corpus (229k entities) mapped to 64 hexagram profiles
- [ ] Hexagram Property ROM synthesized with verified entity data
- [ ] Thermal variance defaults calibrated against combat aggression metrics
- [ ] Boot profiles matched to quest complexity / NPC behavior patterns
- [ ] Event sourcing bridge: TrainingCollector → TELEMETRY_SEQ verified
- [ ] D1 audit schema created for fpga_events table
- [ ] KV delta compression (LZ4) tested at 100 Hz burst rate
- [ ] YaoState model trained on 26-year gameplay + thermal data
- [ ] Model weights exported to FPGA ROM programming format
- [ ] AXI4-Lite ROM programming interface tested (0x0800-0x09FF)
- [ ] Cross-layer clock synchronization verified (250 MHz → 640 ms)
- [ ] Watchdog timeout calibrated for 30 s safety margin
- [ ] Standalone mode defaults loaded from YaoState model
- [ ] Emergency fallback: ROM defaults → hardware-safe personality
