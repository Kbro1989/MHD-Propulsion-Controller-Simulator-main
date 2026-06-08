/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// MHD PROPULSION SYSTEM TYPE DEFINITIONS (POG2-MHD-PROP-001)
// ============================================================================

// 600ms canonical metabolic tick cycle at 250MHz PL clock
export const TICK_PERIOD_MS = 600;
export const PL_CLOCK_FREQ_HZ = 250_000_000;
export const TICK_CYCLES = 150_000_000; // 150M cycles at 250MHz = 600ms

// Fixed-Point Helpers for Q16.16 Representation
export type Q16_16_T = number; // Represented as standard number in float / int equivalent in JS

export function toQ16_16(value: number): number {
  return Math.round(value * 65536);
}

export function fromQ16_16(qVal: number): number {
  return qVal / 65536;
}

// 6-bit Yao state definitions (HEXAGRAM_STATE_T)
export enum HexagramState {
  IDLE = 0,         // "000000"
  PURGE = 9,        // "001001"
  STEALTH = 52,     // "110100"
  ST_CRIT = 55,     // "110111"
  TRANSIT = 56,     // "111000"
  LIMP_MODE = 57,   // "111001"
  TR_SALT = 58,     // "111010"
  TR_CRIT = 59,     // "111011"
}

export const HexagramStateLabels: Record<HexagramState, string> = {
  [HexagramState.IDLE]: "IDLE (000000)",
  [HexagramState.PURGE]: "PURGE (001001)",
  [HexagramState.STEALTH]: "STEALTH (110100)",
  [HexagramState.ST_CRIT]: "ST_CRIT (110111)",
  [HexagramState.TRANSIT]: "TRANSIT (111000)",
  [HexagramState.LIMP_MODE]: "LIMP_MODE (111001)",
  [HexagramState.TR_SALT]: "TR_SALT (111010)",
  [HexagramState.TR_CRIT]: "TR_CRIT (111011)",
};

// 2-bit Electrical Regulation State (ELECTRICAL_REG_T)
export enum ElectricalReg {
  ELEC_OFF = 0,     // "00"
  ELEC_ARMED = 1,   // "01"
  ELEC_ACTIVE = 2,  // "10"
  ELEC_SHED = 3,    // "11"
}

export const ElectricalRegLabels: Record<ElectricalReg, string> = {
  [ElectricalReg.ELEC_OFF]: "OFF (00)",
  [ElectricalReg.ELEC_ARMED]: "ARMED (01)",
  [ElectricalReg.ELEC_ACTIVE]: "ACTIVE (10)",
  [ElectricalReg.ELEC_SHED]: "SHED (11)",
};

// Operational modes mapped to system mode (SYS_MODE_T)
export enum SysMode {
  MODE_IDLE = 0,
  MODE_STEALTH = 1,
  MODE_TRANSIT = 2,
  MODE_LIMP = 3,
  MODE_PURGE = 4,
  MODE_EMERGENCY = 5,
}

export const SysModeLabels: Record<SysMode, string> = {
  [SysMode.MODE_IDLE]: "SYS_IDLE",
  [SysMode.MODE_STEALTH]: "SYS_STEALTH",
  [SysMode.MODE_TRANSIT]: "SYS_TRANSIT",
  [SysMode.MODE_LIMP]: "SYS_LIMP",
  [SysMode.MODE_PURGE]: "SYS_PURGE",
  [SysMode.MODE_EMERGENCY]: "SYS_EMERGENCY",
};

// Contactor State (CONTACTOR_STATE_T)
export enum ContactorState {
  CT_OPEN = 0,
  CT_CLOSING = 1,
  CT_CLOSED = 2,
  CT_OPENING = 3,
  CT_FAULT = 4,
}

export const ContactorStateLabels: Record<ContactorState, string> = {
  [ContactorState.CT_OPEN]: "OPEN",
  [ContactorState.CT_CLOSING]: "CLOSING",
  [ContactorState.CT_CLOSED]: "CLOSED",
  [ContactorState.CT_OPENING]: "OPENING",
  [ContactorState.CT_FAULT]: "FAULT",
};

// Choke State (CHOKE_STATE_T)
export enum ChokeState {
  CH_IDLE = 0,
  CH_TRACKING = 1,
  CH_RESONANT = 2,
  CH_FAULT = 3,
}

export const ChokeStateLabels: Record<ChokeState, string> = {
  [ChokeState.CH_IDLE]: "IDLE",
  [ChokeState.CH_TRACKING]: "TRACKING",
  [ChokeState.CH_RESONANT]: "RESONANT",
  [ChokeState.CH_FAULT]: "FAULT",
};

// Valid sparsley populated transition matrix (28 valid state pathways)
export interface TransitionRule {
  from: HexagramState;
  to: HexagramState;
  emergency?: boolean;
}

export const VALID_TRANSITIONS: TransitionRule[] = [
  { from: HexagramState.IDLE, to: HexagramState.STEALTH },
  { from: HexagramState.STEALTH, to: HexagramState.TRANSIT },
  { from: HexagramState.TRANSIT, to: HexagramState.TR_SALT },
  { from: HexagramState.TR_SALT, to: HexagramState.TR_CRIT },
  { from: HexagramState.TR_CRIT, to: HexagramState.LIMP_MODE },
  { from: HexagramState.STEALTH, to: HexagramState.ST_CRIT },
  { from: HexagramState.ST_CRIT, to: HexagramState.LIMP_MODE },
  { from: HexagramState.TRANSIT, to: HexagramState.LIMP_MODE },
  { from: HexagramState.TR_SALT, to: HexagramState.LIMP_MODE },
  { from: HexagramState.IDLE, to: HexagramState.PURGE },
  { from: HexagramState.PURGE, to: HexagramState.IDLE },
  { from: HexagramState.LIMP_MODE, to: HexagramState.IDLE },
  { from: HexagramState.LIMP_MODE, to: HexagramState.STEALTH },
  { from: HexagramState.LIMP_MODE, to: HexagramState.TRANSIT },
  // Self loops
  { from: HexagramState.IDLE, to: HexagramState.IDLE },
  { from: HexagramState.STEALTH, to: HexagramState.STEALTH },
  { from: HexagramState.TRANSIT, to: HexagramState.TRANSIT },
  { from: HexagramState.TR_SALT, to: HexagramState.TR_SALT },
  { from: HexagramState.TR_CRIT, to: HexagramState.TR_CRIT },
  { from: HexagramState.ST_CRIT, to: HexagramState.ST_CRIT },
  { from: HexagramState.LIMP_MODE, to: HexagramState.LIMP_MODE },
  { from: HexagramState.PURGE, to: HexagramState.PURGE },
  // Reverse nominal pathways
  { from: HexagramState.STEALTH, to: HexagramState.IDLE },
  { from: HexagramState.TRANSIT, to: HexagramState.STEALTH },
  { from: HexagramState.TR_SALT, to: HexagramState.TRANSIT },
  { from: HexagramState.TR_CRIT, to: HexagramState.TR_SALT },
  { from: HexagramState.ST_CRIT, to: HexagramState.STEALTH },
  // Emergency direct jump
  { from: HexagramState.IDLE, to: HexagramState.TRANSIT, emergency: true },
];

export function isValidTransition(from: HexagramState, to: HexagramState): boolean {
  return VALID_TRANSITIONS.some((rule) => rule.from === from && rule.to === to);
}

// 8-bit Fault Vector bitfields
export type FaultVector = {
  invalidTransition: boolean;    // Bit 0: Invalid state machine pathway proposed
  electricalMismatch: boolean;   // Bit 1: Active electrical regulator mismatch
  thermalLimitExceeded: boolean; // Bit 2: Bus cooling temperature over safety limit
  safetyInterlockTripped: boolean;// Bit 3: Symmetry + checkerboard or snubber pre-charge failure
  knockAuthenticationFail: boolean;// Bit 4: Challenge-response knock key mismatch
  chokeFrequencyOutOfLock: boolean;// Bit 5: Resonant choke feedback frequency failure
  gateDriverDesaturation: boolean;// Bit 6: SiC MOSFET gate driver desaturation detected
  criticalTimeoutExceeded: boolean;// Bit 7: Active in CRIT state for longer than 47 metabolic ticks
};

export function faultVectorToByte(faults: FaultVector): number {
  let byte = 0;
  if (faults.invalidTransition)    byte |= (1 << 0);
  if (faults.electricalMismatch)   byte |= (1 << 1);
  if (faults.thermalLimitExceeded) byte |= (1 << 2);
  if (faults.safetyInterlockTripped)byte |= (1 << 3);
  if (faults.knockAuthenticationFail)byte |= (1 << 4);
  if (faults.chokeFrequencyOutOfLock)byte |= (1 << 5);
  if (faults.gateDriverDesaturation)byte |= (1 << 6);
  if (faults.criticalTimeoutExceeded)byte |= (1 << 7);
  return byte;
}

export function byteToFaultVector(byte: number): FaultVector {
  return {
    invalidTransition: (byte & (1 << 0)) !== 0,
    electricalMismatch: (byte & (1 << 1)) !== 0,
    thermalLimitExceeded: (byte & (1 << 2)) !== 0,
    safetyInterlockTripped: (byte & (1 << 3)) !== 0,
    knockAuthenticationFail: (byte & (1 << 4)) !== 0,
    chokeFrequencyOutOfLock: (byte & (1 << 5)) !== 0,
    gateDriverDesaturation: (byte & (1 << 6)) !== 0,
    criticalTimeoutExceeded: (byte & (1 << 7)) !== 0,
  };
}

export function calculateCRC8(dataBytes: number[]): number {
  let crc = 0x00;
  for (const byte of dataBytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x80) !== 0) {
        crc = ((crc << 1) ^ 0x07) & 0xFF;
      } else {
        crc = (crc << 1) & 0xFF;
      }
    }
  }
  return crc;
}

export function getTelemetryCRC8(word56: bigint): number {
  const bytes: number[] = [];
  for (let i = 6; i >= 0; i--) {
    bytes.push(Number((word56 >> BigInt(i * 8)) & 0xFFn));
  }
  return calculateCRC8(bytes);
}

// 64-bit Telemetry Packet representation and encoder
export interface TelemetryPacket {
  rawValueHex: string;          // Full 64-bit hexadecimal (e.g. "FFFF00DEADBEEF01")
  hexagramState: HexagramState;  // 6 bits
  electricalReg: ElectricalReg;  // 2 bits
  faultByte: number;            // 8 bits
  predictedTempRaw: number;     // 16 bits (GhostSplat fractional lower 16-bit representation)
  pressPlenumRaw: number;       // 16 bits
  currBusRaw: number;           // 16 bits
  taylorOrder: number;          // 3 bits (value 2-5)
  highVariance: boolean;        // 1 bit
  padding: number;              // 8 bits
  crcValid?: boolean;           // Has valid CRC-8 check
  expectedCrc?: number;         // Calculated expected CRC
  decodedCrc?: number;          // Transmitted CRC
}

/**
 * Encodes telemetry fields into an exact 64-bit hexadecimal word string with CRC-8.
 */
export function encodeTelemetry(packet: Omit<TelemetryPacket, "rawValueHex" | "crcValid" | "expectedCrc" | "decodedCrc">, forceCrcError: boolean = false): string {
  // Let's do standard packing into BigInt to represent 64 bits precisely:
  let word = 0n;
  
  // Pack fields consecutively
  // 1. hexagramState: 6 bits [63..58]
  word |= BigInt(packet.hexagramState & 0x3F) << 58n;
  
  // 2. electricalReg: 2 bits [57..56]
  word |= BigInt(packet.electricalReg & 0x03) << 56n;
  
  // 3. faultByte: 8 bits [55..48]
  word |= BigInt(packet.faultByte & 0xFF) << 48n;
  
  // 4. predictedTempRaw (lower 12 bits of fractional Q16.16) [47..36]
  word |= BigInt(packet.predictedTempRaw & 0xFFF) << 36n;
  
  // 5. pressPlenumRaw (lower 12 bits) [35..24]
  word |= BigInt(packet.pressPlenumRaw & 0xFFF) << 24n;
  
  // 6. currBusRaw (lower 12 bits) [23..12]
  word |= BigInt(packet.currBusRaw & 0xFFF) << 12n;
  
  // 7. taylorOrder: 3 bits [11..9]
  word |= BigInt(packet.taylorOrder & 0x07) << 9n;
  
  // 8. highVariance: 1 bit [8]
  word |= BigInt(packet.highVariance ? 1 : 0) << 8n;
  
  // Compute CRC-8 checksum of first 56 bits
  const word56 = word >> 8n;
  let computedCrc = getTelemetryCRC8(word56);
  if (forceCrcError) {
    computedCrc = (computedCrc ^ 0xAA) & 0xFF; // Invert or corrupt heavily
  }

  // 9. CRC byte [7..0] (occupies original padding region)
  word |= BigInt(computedCrc);

  return word.toString(16).toUpperCase().padStart(16, "0");
}

export function decodeTelemetry(hexStr: string): TelemetryPacket {
  let str = hexStr.replace(/^0x/i, "");
  if (str.length < 16) {
    str = str.padEnd(16, "0");
  }
  const word = BigInt("0x" + str);

  const hexagramState = Number((word >> 58n) & 0x3Fn) as HexagramState;
  const electricalReg = Number((word >> 56n) & 0x03n) as ElectricalReg;
  const faultByte = Number((word >> 48n) & 0xFFn);
  const predictedTempRaw = Number((word >> 36n) & 0xFFFn);
  const pressPlenumRaw = Number((word >> 24n) & 0xFFFn);
  const currBusRaw = Number((word >> 12n) & 0xFFFn);
  const taylorOrder = Number((word >> 9n) & 0x07n);
  const highVariance = Number((word >> 8n) & 0x01n) === 1;
  const decodedCrc = Number(word & 0xFFn);

  const word56 = word >> 8n;
  const expectedCrc = getTelemetryCRC8(word56);
  const crcValid = decodedCrc === expectedCrc;

  return {
    rawValueHex: hexStr,
    hexagramState,
    electricalReg,
    faultByte,
    predictedTempRaw,
    pressPlenumRaw,
    currBusRaw,
    taylorOrder,
    highVariance,
    padding: decodedCrc,
    crcValid,
    expectedCrc,
    decodedCrc,
  };
}

// ============================================================================
// ENHANCED SUBSYSTEM FAULT CODES & STRATEGIC MITIGATION MAPS
// ============================================================================

export enum SubsystemId {
  THERMAL = "THERMAL",
  ELECTRICAL = "ELECTRICAL",
  VENTILATION = "VENTILATION",
  INTERLOCK_SEQUENCE = "INTERLOCK_SEQUENCE",
  SECURE_LOCK = "SECURE_LOCK",
  CDC_CLOCKING = "CDC_CLOCKING",
}

export enum FaultSeverity {
  OK = "OK",
  WARNING = "WARNING",          // Triggers graceful degradation
  CRITICAL = "CRITICAL",        // Triggers safe shutdown sequence (automatic mitigation)
  FATAL = "FATAL",              // Immediate hardware disconnect with console locks
}

export interface DetailedFaultDef {
  code: string;                 // e.g. "T-01"
  subsystem: SubsystemId;
  severity: FaultSeverity;
  label: string;
  description: string;
  mitigation: string;           // Strategic action taken on detection
}

export const DETAILED_FAULT_REGISTRY: DetailedFaultDef[] = [
  {
    code: "T-01",
    subsystem: SubsystemId.THERMAL,
    severity: FaultSeverity.WARNING,
    label: "Electrode Array Thermal Wear warning",
    description: "ADC Electrode Channel 0 Temp exceeds pre-derating safety reference (310K).",
    mitigation: "GRACEFUL DEGRADATION: Restrict maximum permitted Bus Current to 1500A dynamically.",
  },
  {
    code: "T-02",
    subsystem: SubsystemId.THERMAL,
    severity: FaultSeverity.CRITICAL,
    label: "Electrode Overheat Critical Limit",
    description: "Electrode monitoring exceeds structural silicon damage limits limit (320K).",
    mitigation: "SAFE SHUTDOWN: Cut all Coil Drives immediately; force transition system back to LIMP_MODE.",
  },
  {
    code: "E-01",
    subsystem: SubsystemId.ELECTRICAL,
    severity: FaultSeverity.WARNING,
    label: "Bus Line Overcurrent Transient",
    description: "Bus Current spike approaching absolute safety thresholds (>1950A).",
    mitigation: "GRACEFUL DEGRADATION: Set H-bridge PWM duty cycles down by 25% to restrict inductive loads.",
  }
  ,
  {
    code: "E-02",
    subsystem: SubsystemId.ELECTRICAL,
    severity: FaultSeverity.CRITICAL,
    label: "Active Rectifier Command Mismatch",
    description: "High-power coil regulator active without correct Hexagram sequence logic.",
    mitigation: "SAFE SHUTDOWN: Force electrical state mapping to ELEC_OFF asynchronously.",
  },
  {
    code: "M-01",
    subsystem: SubsystemId.VENTILATION,
    severity: FaultSeverity.WARNING,
    label: "Plenum Chamber Underpressure Warning",
    description: "Co-simulator plenum feedback falls below standard bounds (<1.25 atm).",
    mitigation: "GRACEFUL DEGRADATION: Degrade high-frequency Choke resonant driving target range limits.",
  },
  {
    code: "M-02",
    subsystem: SubsystemId.VENTILATION,
    severity: FaultSeverity.CRITICAL,
    label: "Plenum Chamber Overpressure Catastrophe",
    description: "Chamber pressure exceeds gasket design limits (>1.35 atm) while system operates.",
    mitigation: "SAFE SHUTDOWN: Open dual exhaust vent solonoids, open high-power relays to drop induction.",
  },
  {
    code: "S-01",
    subsystem: SubsystemId.INTERLOCK_SEQUENCE,
    severity: FaultSeverity.CRITICAL,
    label: "Contactor Complementary Symmetry Trip",
    description: "Relay pairs CT0/CT9 or CT1/CT8 are in mismatched positions, indicating coil delay failures.",
    mitigation: "SAFE SHUTDOWN: Inston-off interlock interrupter activated, releasing asynchronous spring disconnect.",
  },
  {
    code: "S-02",
    subsystem: SubsystemId.INTERLOCK_SEQUENCE,
    severity: FaultSeverity.WARNING,
    label: "MOSFET Gate Driver Desaturation",
    description: "Specific relay segment (e.g. CT2 or CT6) feedback mask low, indicating desaturation transient.",
    mitigation: "GRACEFUL DEGRADATION: Shed faulty channel segment; divert current to healthy redundant relays.",
  },
  {
    code: "K-01",
    subsystem: SubsystemId.SECURE_LOCK,
    severity: FaultSeverity.WARNING,
    label: "Challenge-Response Authenticator Fail",
    description: "AXI4 transition signature verification mismatch or lock-out key invalid.",
    mitigation: "SECURE WARNING: Impose an automatic 5-tick console login lock replay timeout.",
  },
  {
    code: "K-02",
    subsystem: SubsystemId.SECURE_LOCK,
    severity: FaultSeverity.WARNING,
    label: "Challenge Dynamic Nonce Stale Replay",
    description: "Duplicate signature double-word authentication request using an outdated challenge nonce.",
    mitigation: "SECURE LOCKOUT: Revoke token credentials, generate a fresh secure challenge prime nonce.",
  },
  {
    code: "C-01",
    subsystem: SubsystemId.CDC_CLOCKING,
    severity: FaultSeverity.WARNING,
    label: "FPGA Fabric Timing Worst Negative Slack (WNS)",
    description: "Worst Negative Slack timing checks under limits (<0.08 ns) due to heat dissipation.",
    mitigation: "GRACEFUL DEGRADATION: Lower dynamic core PL frequency clock down to 200.00 MHz.",
  },
  {
    code: "X-01",
    subsystem: SubsystemId.CDC_CLOCKING,
    severity: FaultSeverity.CRITICAL,
    label: "Critical State Metastability Timeout",
    description: "System remained in transient CRIT state blocks for longer than 47 consecutive ticks.",
    mitigation: "SAFE SHUTDOWN: Immediate hard reset triggered, falling into secure LIMP_MODE safe harbor.",
  },
  {
    code: "A-01",
    subsystem: SubsystemId.SECURE_LOCK,
    severity: FaultSeverity.CRITICAL,
    label: "AXI Transaction Address Decoding DECERR",
    description: "AXI4-Lite register write attempted on unmapped physical address 0x43C0DEAD.",
    mitigation: "SAFE SHUTDOWN: Intercept invalid transaction on interconnect; force safe transition to LIMP_MODE.",
  },
  {
    code: "A-02",
    subsystem: SubsystemId.SECURE_LOCK,
    severity: FaultSeverity.WARNING,
    label: "AXI Register Write Readback SLVERR",
    description: "AXI4-Lite register readback mismatched write contents at register address 0x43C0009C.",
    mitigation: "GRACEFUL DEGRADATION: Mark memory controller cell as suspicious; use shadow registers instead.",
  },
  {
    code: "C-02",
    subsystem: SubsystemId.CDC_CLOCKING,
    severity: FaultSeverity.WARNING,
    label: "CDC Handshaking Flag Sync Loss",
    description: "Multi-stage Gray-code synchronizer detected CDC handshaking glitch on domain boundaries.",
    mitigation: "GRACEFUL DEGRADATION: Freeze handshaking register line; initiate slow parity-recheck cycle (100 ms).",
  },
  {
    code: "C-03",
    subsystem: SubsystemId.CDC_CLOCKING,
    severity: FaultSeverity.CRITICAL,
    label: "Asynchronous Clock Crossing Drift Limit",
    description: "FPGA Programmable Logic (PL) clock phase drifted beyond allowable skew bounds of Processor System (PS).",
    mitigation: "SAFE SHUTDOWN: Cut clock distribution network to coil drivers; trigger immediate hard reset.",
  },
  {
    code: "T-03",
    subsystem: SubsystemId.THERMAL,
    severity: FaultSeverity.CRITICAL,
    label: "Thermal Acceleration Rate Exceeded",
    description: "Electrode temperature rate of change (dT/dt) exceeded safe thermal acceleration limit (>4.5 K/s).",
    mitigation: "SAFE SHUTDOWN: Engage full auxiliary exhaust nitrogen dump; isolate power rails.",
  },
  {
    code: "T-04",
    subsystem: SubsystemId.THERMAL,
    severity: FaultSeverity.WARNING,
    label: "ADC Dual-Channel Divergence Fault",
    description: "Primary and secondary ADC channels show temperature readings mismatch (>15 Kelvin divergence).",
    mitigation: "GRACEFUL DEGRADATION: Discard erratic channel; fallback to primary sensor thermocouple reference.",
  }
];

// ============================================================================
// SYSTEM UART DEBUG PORT LOGGING SCHEMAS
// ============================================================================

export interface SystemLog {
  id: string;                  // Unique uuid/counter
  timestamp: string;           // Local time string
  tick: number;                // Metabolic tick index
  subsystem: SubsystemId | "SYSTEM";
  level: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  message: string;
  variableSnapshot: string;    // Snapshot of crucial physical variables at this point
}

// ============================================================================
// AI EMOTIONAL GENERATION AND PREDICTIVE HISTORIC STATE SNAPSHOTS
// ============================================================================

export enum EmotionalTone {
  QUIETUDE = "QUIETUDE",       // Dormant, cooling states (IDLE)
  SERENITY = "SERENITY",       // Safe, smooth flow (STEALTH)
  VIGILANCE = "VIGILANCE",     // Protective telemetry monitoring
  COURAGE = "COURAGE",         // Active displacement/propulsion (TRANSIT)
  DETERMINATION = "DETERMINATION", // Active cleaning & calibration (PURGE)
  TENSION = "TENSION",         // Mismatches or electrical limits warnings
  FEAR = "FEAR",               // Core emergency & critical safety limits
}

export interface EmotionalWeightProfile {
  weights: Record<EmotionalTone, number>; // Must sum conceptually to 1.0 (or 0-100%)
  voicePitchShift: number; // Percent shift for text-to-speech engine models (-50% to +50%)
  voiceTempoBias: number;  // Speaking rate coefficient (e.g. 0.5 to 2.0)
  visionHueTilt: number;   // Visual render color hue degrees shift (0 to 360)
  visionFrameRate: number; // Render engine camera sampling refresh limit (Hz)
}

export type HexagramEvaluationClassification = "COMMON" | "GOOD" | "BAD";

export interface PredictiveStateFrame {
  tick: number;
  timestamp: string;
  state: HexagramState;
  stateLabel: string;
  activeFaults: string[];
  classification: HexagramEvaluationClassification;
  emotionalWeights: EmotionalWeightProfile;
  operatorNotes: string;
}

export interface SavedStatePayload {
  version: string;
  id: string;
  timestamp: string;
  label: string;
  frames: PredictiveStateFrame[];
}

// Initial Emotional weights definitions for I Ching Hexagram state training matrices
export const DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES: Record<HexagramState, EmotionalWeightProfile> = {
  [HexagramState.IDLE]: {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.8,
      [EmotionalTone.SERENITY]: 0.2,
      [EmotionalTone.VIGILANCE]: 0.0,
      [EmotionalTone.COURAGE]: 0.0,
      [EmotionalTone.DETERMINATION]: 0.0,
      [EmotionalTone.TENSION]: 0.0,
      [EmotionalTone.FEAR]: 0.0,
    },
    voicePitchShift: -5.0, // Low resting frequency
    voiceTempoBias: 0.8,   // Slower, calming vocal structure
    visionHueTilt: 210,    // Calming deep blue
    visionFrameRate: 15,   // Idle low-frequency monitoring
  },
  [HexagramState.PURGE]: {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.1,
      [EmotionalTone.SERENITY]: 0.1,
      [EmotionalTone.VIGILANCE]: 0.2,
      [EmotionalTone.COURAGE]: 0.1,
      [EmotionalTone.DETERMINATION]: 0.5,
      [EmotionalTone.TENSION]: 0.0,
      [EmotionalTone.FEAR]: 0.0,
    },
    voicePitchShift: 5.0,
    voiceTempoBias: 1.1,
    visionHueTilt: 35,     // Active orange calibration
    visionFrameRate: 30,
  },
  [HexagramState.STEALTH]: {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.3,
      [EmotionalTone.SERENITY]: 0.5,
      [EmotionalTone.VIGILANCE]: 0.2,
      [EmotionalTone.COURAGE]: 0.0,
      [EmotionalTone.DETERMINATION]: 0.0,
      [EmotionalTone.TENSION]: 0.0,
      [EmotionalTone.FEAR]: 0.0,
    },
    voicePitchShift: -10.0, // Low, quiet hushed tone
    voiceTempoBias: 0.75, // Slow whisper speech pace
    visionHueTilt: 150,    // Cryptic forest emerald green
    visionFrameRate: 24,
  },
  [HexagramState.ST_CRIT]: {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.0,
      [EmotionalTone.SERENITY]: 0.1,
      [EmotionalTone.VIGILANCE]: 0.4,
      [EmotionalTone.COURAGE]: 0.0,
      [EmotionalTone.DETERMINATION]: 0.2,
      [EmotionalTone.TENSION]: 0.3,
      [EmotionalTone.FEAR]: 0.0,
    },
    voicePitchShift: 15.0, // Rising vocal tension
    voiceTempoBias: 1.2,
    visionHueTilt: 75,     // Alert yellowish-green lime
    visionFrameRate: 60,   // High sampling
  },
  [HexagramState.TRANSIT]: {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.0,
      [EmotionalTone.SERENITY]: 0.4,
      [EmotionalTone.VIGILANCE]: 0.1,
      [EmotionalTone.COURAGE]: 0.5,
      [EmotionalTone.DETERMINATION]: 0.0,
      [EmotionalTone.TENSION]: 0.0,
      [EmotionalTone.FEAR]: 0.0,
    },
    voicePitchShift: 10.0, // Confident bright accentuation
    voiceTempoBias: 1.3,   // Energetic fast tempo representation
    visionHueTilt: 195,    // Electrifying neon cyan
    visionFrameRate: 60,
  },
  [HexagramState.LIMP_MODE]: {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.4,
      [EmotionalTone.SERENITY]: 0.3,
      [EmotionalTone.VIGILANCE]: 0.2,
      [EmotionalTone.COURAGE]: 0.0,
      [EmotionalTone.DETERMINATION]: 0.0,
      [EmotionalTone.TENSION]: 0.1,
      [EmotionalTone.FEAR]: 0.0,
    },
    voicePitchShift: -15.0, // Subdued, cautious
    voiceTempoBias: 0.85,
    visionHueTilt: 280,    // Shield purple safe space
    visionFrameRate: 30,
  },
  [HexagramState.TR_SALT]: {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.0,
      [EmotionalTone.SERENITY]: 0.2,
      [EmotionalTone.VIGILANCE]: 0.3,
      [EmotionalTone.COURAGE]: 0.4,
      [EmotionalTone.DETERMINATION]: 0.1,
      [EmotionalTone.TENSION]: 0.0,
      [EmotionalTone.FEAR]: 0.0,
    },
    voicePitchShift: 12.0,
    voiceTempoBias: 1.25,
    visionHueTilt: 160,    // Deep aquamarine
    visionFrameRate: 60,
  },
  [HexagramState.TR_CRIT]: {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.0,
      [EmotionalTone.SERENITY]: 0.0,
      [EmotionalTone.VIGILANCE]: 0.3,
      [EmotionalTone.COURAGE]: 0.1,
      [EmotionalTone.DETERMINATION]: 0.0,
      [EmotionalTone.TENSION]: 0.2,
      [EmotionalTone.FEAR]: 0.4,
    },
    voicePitchShift: 25.0,  // Strained high pitch
    voiceTempoBias: 1.6,    // Hyper-rapid synthetic vocal stress responses
    visionHueTilt: 0,      // Pure warnings blood crimson
    visionFrameRate: 120,   // Maximum alert processing loops
  },
};

export interface StateTransition {
  id: string;
  timestamp: string;
  tick: number;
  fromState: HexagramState;
  toState: HexagramState;
  trigger: string;
  method: "AUTOMATED_AI" | "MANUAL_COMMIT" | "SECURE_OVERRIDE_KNOCK" | "IMU_DECOHERENCE_SPIKE" | "TIMEOUT_EXCEEDED" | "CRITICAL_FAULT_SHUTDOWN" | "INITIALIZATION" | "RESET";
  snapshot: {
    temp: number;
    pressure: number;
    current: number;
    faults: string[];
  };
}


