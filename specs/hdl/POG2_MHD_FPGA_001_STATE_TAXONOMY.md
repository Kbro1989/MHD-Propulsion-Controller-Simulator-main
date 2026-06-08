# POG2-MHD-FPGA-001 State Taxonomy Addendum (Rev 1.1)

## 1. Architectural Directive

All modules interfacing with the POG2-MHD-FPGA-001 must treat the following four state domains as **mutually exclusive**. Logic gate evaluation and signal routing must reference these by their explicit register offsets. Any attempt to cross-reference (e.g., using a `BOOT_PHASE` value in a `CONTACTOR` logic gate) shall be flagged as a compilation error by the `skills.sh` validation layer.

## 2. State Classification Schema

| Domain | Register Offset | Data Type | Constraint Level | Purpose |
|--------|-----------------|-----------|------------------|---------|
| **System Lifecycle** | `0x2C` | `BOOT_PHASE` | Global | Tracks boot-sequence progress. |
| **Physical Machine** | `0x44` | `CONTACTOR_STATUS` | Per-Channel | Physical hardware state machines. |
| **Cognitive State** | `0x10`+`0x14` | `HEXAGRAM`+`YAO` | Epistemic | Personality/predictive model alignment. |
| **Thermal Field** | `0x80-0x98` | `GHOSTSPLAT` | Analytic | Environmental telemetry/heat saturation. |

## 3. State Definitions

### A. System Lifecycle (`BOOT_PHASE` @ `0x2C`)

* `0x00` **DARK_IRON**: Initial power-on, non-responsive.
* `0x01` **POWER_WAKE**: Power rails stable.
* `0x02` **SALT_CHARGE**: Electrolyte saturation check.
* `0x03` **PLENUM_RISE**: Pressure build-up to operating baseline.
* `0x04` **DEGAUSS**: Magnetic memory wipe.
* `0x05` **CHANNEL_PRIME**: FPGA logic verification.
* `0x06` **STEALTH_IDLE**: Terminal operational state, awaiting `PlayerAgent` commands.

### B. Physical Machine (`CONTACTOR_STATUS` @ `0x44`)

* `000` **OPEN**: Default safe state.
* `001` **PRECHARGE**: Capacitive ramp-up phase.
* `010` **CLOSING**: Transitioning to circuit completion.
* `011` **CLOSED**: Fully energized.
* `100` **OPENING**: Transitioning to circuit break.
* `101` **ARC_SUPPRESS**: Inductive kickback mitigation in progress.
* `110` **WELD_DETECTED**: Hardware error, contactor stuck.
* `111` **FAULT**: General hardware trip.

### C. Cognitive State (`HEXAGRAM_STATE` @ `0x10` + `YAO_LINES` @ `0x14`)

* **Hexagram ID**: `1-64` (Standard I Ching mapping), `0` (Uninitialized/Null).
* **Yao Lines (6 bits)**: Defines logical stability (`YoungYang` through `OldMixed`).
* **Vibe Mode (0x00-0x08)**: Personality archetype (Defines heuristic weightings in `GhostSplat`).

### D. Thermal State (`GHOSTSPLAT_FIELD` @ `0x80-0x98`)

* **Segment Heat**: 5x 16-bit registers (Real-time temperature telemetry).
* **Segment Trend**: 5x 6-bit registers (Delta-over-time vectors).
* **Saturation Mask**: 5-bit register (Binary warning flags per segment).

## 4. Directional Enforcement by Epistemic Tier

| Tier | Read Domains | Write Domains | Forbidden Operations |
|------|-------------|---------------|---------------------|
| **EXECUTION** | BOOT_PHASE, CONTACTOR_STATUS, CHOKE_DUTY, SENSOR_ADC | CONTACTOR_TARGET, CHOKE_DUTY, CONTROL | Write HEXAGRAM_STATE, YAO_LINES, GHOSTSPLAT_FIELD |
| **CAUSAL** | All domains | HEXAGRAM_STATE, YAO_LINES, VIBE_MODE, THERMAL_VARIANCE | Write CONTACTOR_TARGET, EMERGENCY_OPEN, CHOKE_DUTY |
| **INTERPRETATION** | All domains | None (read-only) | Any write operation |
| **POLICY** | All domains | All domains | None |

## 5. Enforcement Rule for `skills.sh`

```typescript
function validateStateReference(ref: RegisterReference, context: DeploymentContext): ValidationResult {
  const domain = getDomainForRegister(ref.offset);
  const allowedDomains = getAllowedDomainsForContext(context.epistemicTier);

  if (!allowedDomains.includes(domain)) {
    return {
      valid: false,
      error: `State domain ${domain} not allowed in ${context.epistemicTier} tier`,
      rule: 'DIRECTIONAL_ENFORCEMENT',
      severity: 'DEPLOYMENT_BLOCK'
    };
  }

  return { valid: true };
}
```

**Primary rule:** `IF (Reference_Register != Assigned_Domain_Register) THEN REJECT_DEPLOYMENT;`

**Secondary rule:** `IF (Write_Operation AND Tier_Forbidden) THEN REJECT_DEPLOYMENT;`

## 6. Semantic Drift Prevention

The following conflations are **explicitly prohibited** and will fail `skills.sh validate`:

| Prohibited Conflation | Correct Reference | Rationale |
|----------------------|-------------------|-----------|
| `STEALTH_IDLE` as machine state | `BOOT_PHASE = 0x06` | STEALTH_IDLE is a lifecycle terminal, not a contactor state |
| `CONTACTOR_STATUS = 0x06` as boot phase | `BOOT_PHASE = 0x06` | 0x06 in CONTACTOR_STATUS is WELD_DETECTED, not STEALTH_IDLE |
| `HEXAGRAM_STATE` as thermal threshold | `GHOSTSPLAT_FIELD` | Hexagram is cognitive, not thermal |
| `YAO_LINES` as contactor command | `CONTACTOR_TARGET` | Yao is evaluative, not actuative |
| `GHOSTSPLAT_SAT` as emotional state | `EmotionalPool` (software) | Saturation is thermal, not affective |

## 7. Machine-Verifiable Checksum

```
TAXONOMY_HASH = SHA-256(concat(
  BOOT_PHASE states (0x00-0x06),
  CONTACTOR_STATUS states (000-111),
  HEXAGRAM_STATE range (0-64),
  YAO_LINES format (6-bit + 2 override bits),
  GHOSTSPLAT_FIELD layout (5×16 + 5×8 + 8 + 8),
  Directional enforcement matrix (4 tiers × 4 domains)
))
```

Expected: `TAXONOMY_HASH` is computed at build time and embedded in `POG2_MHD_FPGA_001.vhd` as a generic constant for runtime verification.
