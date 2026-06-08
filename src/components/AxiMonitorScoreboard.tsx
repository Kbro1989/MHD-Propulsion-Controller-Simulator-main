/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Play, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Activity, 
  Terminal, 
  Cpu, 
  Search, 
  Sliders, 
  Zap, 
  SlidersHorizontal,
  Workflow,
  HelpCircle,
  FileCheck2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { HexagramState, ContactorState, ChokeState } from "../types";

// Type definitions for AXI Transactions
export interface AxiTransaction {
  id: string;
  type: "WRITE" | "READ";
  timestamp: string;
  cycle: number;
  
  // AXI Address Channel
  addr: string;       // e.g., "0x43C00010"
  offset: string;     // e.g., "0x10"
  
  // AXI Data Channel
  wdata?: string;     // e.g., "0x0000003F" (Write Data)
  rdata?: string;     // e.g., "0x00000012" (Read Data)
  wstrb?: string;     // e.g., "1111" (Write Strobe)
  
  // Handshakes & Signals State Snapshot
  signals: {
    awvalid: boolean;
    awready: boolean;
    wvalid: boolean;
    wready: boolean;
    bvalid: boolean;
    bready: boolean;
    arvalid: boolean;
    arready: boolean;
    rvalid: boolean;
    rready: boolean;
  };
  
  // Responses
  bresp?: "OKAY" | "EXOKAY" | "SLVERR" | "DECERR"; // "00", "01", "10", "11"
  rresp?: "OKAY" | "EXOKAY" | "SLVERR" | "DECERR"; 

  // Scoreboard Verification
  expectedValue?: string;
  actualValue?: string;
  expectedStatus?: "OKAY" | "SLVERR" | "DECERR";
  actualStatus?: "OKAY" | "SLVERR" | "DECERR";
  status: "PASS" | "FAIL" | "PENDING";
  debugLog: string;
}

// 20 Defined Target Registers for VIP Access
const VIP_REGISTERS = [
  { offset: "0x00", name: "ID", access: "RO", resetVal: "0x504F4732", desc: "Magic: 'POG2'" },
  { offset: "0x04", name: "REV", access: "RO", resetVal: "0x00010000", desc: "Revision 1.0.0" },
  { offset: "0x08", name: "STATUS", access: "RO", resetVal: "0x00000000", desc: "Global status flags" },
  { offset: "0x0C", name: "CONTROL", access: "RW", resetVal: "0x00000000", desc: "Global control" },
  { offset: "0x10", name: "HEXAGRAM_STATE", access: "RO", resetVal: "0x00000000", desc: "Current 6-bit hexagram ID" },
  { offset: "0x14", name: "YAO_LINES", access: "RW", resetVal: "0x00000000", desc: "6 yao line override states" },
  { offset: "0x18", name: "YAO_THRESHOLDS", access: "RO", resetVal: "0x00000000", desc: "Current scaled thresholds" },
  { offset: "0x1C", name: "COGNITIVE_PULSE", access: "RC", resetVal: "0x00000000", desc: "State-change event flags" },
  { offset: "0x20", name: "VIBE_MODE", access: "RW", resetVal: "0x00000000", desc: "Personality archetype" },
  { offset: "0x24", name: "THERMAL_VARIANCE", access: "RW", resetVal: "0x00008000", desc: "Thermal scale (unsigned 8.8)" },
  { offset: "0x34", name: "CRIT_TIMEOUT", access: "RW", resetVal: "0x0000002F", desc: "Max ticks in critical mode" },
  { offset: "0x38", name: "GHOSTSPLAT_HORIZON", access: "RW", resetVal: "0x00000003", desc: "Predictor time steps steps" },
  { offset: "0x3C", name: "TICK_DURATION_MS", access: "RW", resetVal: "0x00000280", desc: "Clock ticks cycle speed in ms" },
  { offset: "0x40", name: "CONTACTOR_TARGET", access: "RW", resetVal: "0x00000000", desc: "10-bit contactor target state" },
  { offset: "0x44", name: "CONTACTOR_STATUS", access: "RO", resetVal: "0x00000000", desc: "Contactor state machine feedback" },
  { offset: "0x48", name: "CONTACTOR_FAULT", access: "RC", resetVal: "0x00000000", desc: "Contactor arc or weld flags" },
  { offset: "0x54", name: "CHOKE_FREQUENCY", access: "RW", resetVal: "0x00001964", desc: "Choke resonant drive freq in Hz" },
  { offset: "0x58", name: "SENSOR_ADC_0", access: "RO", resetVal: "0x00000000", desc: "Segment 0 electrode temperature" },
  { offset: "0x70", name: "SENSOR_BUS_I", access: "RO", resetVal: "0x00000000", desc: "MHD primary current induction" },
  { offset: "0x74", name: "SENSOR_PLENUM_P", access: "RO", resetVal: "0x00000000", desc: "Vessel casing chamber compression" },
  { offset: "0xB8", name: "FAULT_INJECT", access: "WO", resetVal: "0x00000000", desc: "Axi fault injection pulse trigger" },
  { offset: "0xBC", name: "FAULT_LOG", access: "RC", resetVal: "0x00000000", desc: "Diagnostic event buffer (FIFO)" },
  { offset: "0xCC", name: "INTERRUPT_MASK", access: "RW", resetVal: "0x00000000", desc: "IRQ enable bitmask" },
  { offset: "0xE8", name: "SCRATCH_0", access: "RW", resetVal: "0x00000000", desc: "Internal developer scratchpad 0" }
];

interface AxiMonitorScoreboardProps {
  currentHexagram: HexagramState;
  chokeState: ChokeState;
  tickCounter: number;
  contactorStates: ContactorState[];
  avgElectrodeTemp: number;
  busCurrentI: number;
  plenumPressure: number;
  theme: "blueprint" | "dark";
  onAddLog: (subsystem: string, level: string, msg: string) => void;
  onDispatchAxiRegChange?: (offset: string, newValue: number) => void;
}

export default function AxiMonitorScoreboard({
  currentHexagram,
  chokeState,
  tickCounter,
  contactorStates,
  avgElectrodeTemp,
  busCurrentI,
  plenumPressure,
  theme,
  onAddLog,
  onDispatchAxiRegChange
}: AxiMonitorScoreboardProps) {

  // ==========================================================================
  // HARDWARE REGISTER VALUES SIMULATOR (VIP SIDE)
  // ==========================================================================
  const [internalRegValues, setInternalRegValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    VIP_REGISTERS.forEach(reg => {
      initial[reg.offset] = parseInt(reg.resetVal, 16);
    });
    return initial;
  });

  // Sync internal registers dynamically with the primary simulation parameters
  useEffect(() => {
    setInternalRegValues(prev => ({
      ...prev,
      "0x08": ((currentHexagram > 0 ? 1 : 0) | (chokeState > 0 ? 8 : 0) | (tickCounter > 0 ? 128 : 0)),
      "0x10": currentHexagram,
      "0x44": contactorStates.reduce((acc, current, idx) => acc | (current << (idx * 3)), 0),
      "0x58": Math.round(avgElectrodeTemp * 16),
      "0x70": Math.round(busCurrentI * 10),
      "0x74": Math.round(plenumPressure * 100),
    }));
  }, [currentHexagram, chokeState, tickCounter, contactorStates, avgElectrodeTemp, busCurrentI, plenumPressure]);

  // ==========================================================================
  // TRANSACTION MONITOR & WAVE STATE
  // ==========================================================================
  const [transactions, setTransactions] = useState<AxiTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<AxiTransaction | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "WRITE" | "READ">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PASS" | "FAIL">("ALL");
  const [currentSimTime, setCurrentSimTime] = useState(0); // simulation clock cycles

  // Verification VIP Runner States
  const [vipRunning, setVipRunning] = useState(false);
  const [vipProgress, setVipProgress] = useState(0); // 0 - 100%
  const [vipResultSummary, setVipResultSummary] = useState<{
    total: number;
    pass: number;
    fail: number;
    suiteName: string;
  } | null>(null);

  // Injected Protocol Stress Settings for simulating edge cases
  const [axiReadyDelayCycles, setAxiReadyDelayCycles] = useState<number>(1); // clock latency before AWREADY/WREADY
  const [driftInterferenceFrequency, setDriftInterferenceFrequency] = useState<number>(0); // timing jitter noise injection (0 = off)
  const [strobeFilterCompliance, setStrobeFilterCompliance] = useState<boolean>(true); // strobe rules check enable
  const [protocolViolationRate, setProtocolViolationRate] = useState<number>(0); // % probability of artificial handshake violation

  // Timing Wave Snapshot structure (Axi signals clock cycles)
  const [waveSnapshot, setWaveSnapshot] = useState<Array<{
    cycle: number;
    aclk: number;
    aresetn: number;
    awaddr: string;
    awvalid: number;
    awready: number;
    wdata: string;
    wvalid: number;
    wready: number;
    bvalid: number;
    bready: number;
    araddr: string;
    arvalid: number;
    arready: number;
    rdata: string;
    rvalid: number;
    rready: number;
  }>>([]);

  // Log summary
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [transactions]);

  // Generate Wave Snaps for visual representation
  const triggerWaveUpdate = (tx: AxiTransaction) => {
    const cycleCount = 8;
    const waves = [];
    const isWrite = tx.type === "WRITE";

    for (let i = 0; i < cycleCount; i++) {
      let awv = 0, awr = 0, wv = 0, wr = 0, bv = 0, br = 0;
      let arv = 0, arr = 0, rv = 0, rr = 0;

      if (isWrite) {
        // AWVALID assert in cycle 1-3
        if (i >= 1 && i <= 3) awv = 1;
        // AWREADY delay based on slider
        if (i >= (1 + axiReadyDelayCycles) && i <= 3) awr = 1;
        // WVALID assert in cycle 2-4
        if (i >= 2 && i <= 4) wv = 1;
        // WREADY acknowledge
        if (i >= (2 + axiReadyDelayCycles) && i <= 4) wr = 1;
        // BRESP check BVALID at cycle 5-6
        if (i >= 5 && i <= 6) { bv = 1; br = 1; }
      } else {
        // ARVALID assert in cycle 1-3
        if (i >= 1 && i <= 3) arv = 1;
        // ARREADY delay
        if (i >= (1 + axiReadyDelayCycles) && i <= 3) arr = 1;
        // RVALID assert in cycle 4-6
        if (i >= 4 && i <= 6) { rv = 1; rr = 1; }
      }

      waves.push({
        cycle: tx.cycle + i,
        aclk: i % 2 === 0 ? 0 : 1,
        aresetn: 1,
        awaddr: isWrite && i >= 1 && i <= 3 ? tx.offset : "0x00",
        awvalid: awv,
        awready: awr,
        wdata: isWrite && i >= 2 && i <= 4 ? (tx.wdata || "0x0") : "0x00000000",
        wvalid: wv,
        wready: wr,
        bvalid: bv,
        bready: br,
        araddr: !isWrite && i >= 1 && i <= 3 ? tx.offset : "0x00",
        arvalid: arv,
        arready: arr,
        rdata: !isWrite && i >= 4 && i <= 6 ? (tx.rdata || "0x0") : "0x00000000",
        rvalid: rv,
        rready: rr
      });
    }
    setWaveSnapshot(waves);
  };

  // Select first transaction on load or change
  useEffect(() => {
    if (transactions.length > 0 && !selectedTx) {
      setSelectedTx(transactions[transactions.length - 1]);
      triggerWaveUpdate(transactions[transactions.length - 1]);
    }
  }, [transactions]);

  // ==========================================================================
  // DISPATCH SINGLE AXI MASTER TRANSACTION (Manual Read / Write)
  // ==========================================================================
  const dispatchAxiTransaction = (
    type: "WRITE" | "READ",
    offset: string,
    wdataHex: string = "0x00000000",
    customStrobe: string = "1111"
  ): AxiTransaction => {
    const cycle = currentSimTime + Math.floor(Math.random() * 5) + 3;
    setCurrentSimTime(cycle + 8);

    const normalOffset = "0x" + offset.replace(/^0x/i, "").toUpperCase().padStart(2, "0");
    const fullAddr = `0x43C0${normalOffset.replace("0x", "").padStart(4, "0")}`;

    const reg = VIP_REGISTERS.find(r => r.offset === normalOffset);

    let bresp: "OKAY" | "SLVERR" | "DECERR" = "OKAY";
    let rresp: "OKAY" | "SLVERR" | "DECERR" = "OKAY";
    let expectedVal = "0x00000000";
    let actualVal = "0x00000000";
    let status: "PASS" | "FAIL" = "PASS";
    let debug = "";

    // Artificial Protocol Violation Generator based on settings
    const isViolation = Math.random() * 100 < protocolViolationRate;

    if (type === "WRITE") {
      const parsedVal = parseInt(wdataHex.replace(/^0x/i, ""), 16) || 0;
      
      if (!reg) {
        bresp = "DECERR"; // Unmapped offset decode error
        debug = `DECERR: Specified register offset ${normalOffset} does not exist in AXI register boundaries. Interconnect returned DECERR high.`;
        if (!isViolation && bresp === "DECERR") status = "PASS"; // Correctly detected unmapped error
      } else if (reg.access === "RO") {
        bresp = "SLVERR"; // Writing RO gives Slave Error
        debug = `SLVERR: Target register '${reg.name}' is read-only. Slave slave logic rejected command write.`;
        if (!isViolation && bresp === "SLVERR") status = "PASS";
      } else {
        // Successful RW write
        const currentStored = internalRegValues[normalOffset] || 0;
        let finalValue = parsedVal;

        // Masking checks for strobe logic
        if (customStrobe !== "1111" && strobeFilterCompliance) {
          let mask = 0x00000000;
          if (customStrobe[0] === "1") mask |= 0xFF000000;
          if (customStrobe[1] === "1") mask |= 0x00FF0000;
          if (customStrobe[2] === "1") mask |= 0x0000FF00;
          if (customStrobe[3] === "1") mask |= 0x000000FF;

          finalValue = (parsedVal & mask) | (currentStored & ~mask);
          debug = `OKAY: Strobe Mask Applied [wstrb: ${customStrobe}]. Original: 0x${currentStored.toString(16).toUpperCase()}, Input: 0x${parsedVal.toString(16).toUpperCase()} ➔ Latched: 0x${finalValue.toString(16).toUpperCase()}`;
        } else {
          debug = `OKAY: Nominal Write. Val: 0x${parsedVal.toString(16).toUpperCase()}`;
        }

        // Apply register change to simulation if callback exists
        if (onDispatchAxiRegChange) {
          onDispatchAxiRegChange(normalOffset, finalValue);
        }

        setInternalRegValues(prev => ({
          ...prev,
          [normalOffset]: finalValue
        }));

        bresp = "OKAY";
        expectedVal = "0x" + finalValue.toString(16).toUpperCase().padStart(8, "0");
        actualVal = "0x" + finalValue.toString(16).toUpperCase().padStart(8, "0");
      }

      if (isViolation) {
        bresp = "OKAY"; // Masked protocol breach (e.g. should have SLVERR but returned OKAY)
        status = "FAIL";
        debug = `PROTOCOL VIOLATION FAIL: Slave failed to signal SLVERR response when executing a write cycle on raw RO offset ${normalOffset}.`;
      }

    } else {
      // READ Channel Check
      if (!reg) {
        rresp = "DECERR";
        actualVal = "0xFFFFFFFF";
        expectedVal = "0x00000000";
        debug = `DECERR: Attempted read access to unmapped boundary address ${normalOffset}. Slave output bus drifted to float 0xFFFFFFFF and returned decode error status.`;
        if (!isViolation) status = "PASS";
      } else {
        const storedValue = internalRegValues[normalOffset] || 0;
        expectedVal = "0x" + storedValue.toString(16).toUpperCase().padStart(8, "0");
        actualVal = "0x" + storedValue.toString(16).toUpperCase().padStart(8, "0");
        rresp = "OKAY";
        debug = `OKAY: Read Register back-end match '${reg.name}'. Read returned value: ${actualVal}. Description: ${reg.desc}`;
      }

      if (isViolation) {
        actualVal = "0x" + (Math.floor(Math.random() * 0x10000000)).toString(16).toUpperCase();
        status = "FAIL";
        rresp = "OKAY";
        debug = `SCOREBOARD DESYNC MISMATCH FAIL: Read returned corrupted value ${actualVal}, whereas expectation calculated in Master scoreboard model was ${expectedVal}. CDC Sync glitch detected.`;
      }
    }

    // Capture standard handshakes
    const txSignals = {
      awvalid: type === "WRITE",
      awready: type === "WRITE",
      wvalid: type === "WRITE",
      wready: type === "WRITE",
      bvalid: type === "WRITE",
      bready: type === "WRITE",
      arvalid: type === "READ",
      arready: type === "READ",
      rvalid: type === "READ",
      rready: type === "READ"
    };

    const newTx: AxiTransaction = {
      id: "TX_" + Math.random().toString(36).substr(2, 5).toUpperCase(),
      type,
      timestamp: new Date().toISOString().substring(11, 19) + "." + Math.floor(Math.random() * 100),
      cycle,
      addr: fullAddr,
      offset: normalOffset,
      wdata: type === "WRITE" ? wdataHex : undefined,
      rdata: type === "READ" ? actualVal : undefined,
      wstrb: type === "WRITE" ? customStrobe : undefined,
      signals: txSignals,
      bresp: type === "WRITE" ? bresp : undefined,
      rresp: type === "READ" ? rresp : undefined,
      expectedValue: expectedVal,
      actualValue: actualVal,
      expectedStatus: type === "WRITE" ? (reg ? (reg.access === "RO" ? "SLVERR" : "OKAY") : "DECERR") : (reg ? "OKAY" : "DECERR"),
      actualStatus: type === "WRITE" ? bresp : rresp,
      status,
      debugLog: debug
    };

    setTransactions(prev => [...prev, newTx]);
    onAddLog(
      "AXI_INTERCONNECT_VIP", 
      status === "PASS" ? "SUCCESS" : "CRITICAL", 
      `AXI Monitor captured: ${type} ${normalOffset} (${reg?.name || "UNMAPPED"}) ➔ ${status} | Resp: ${type === "WRITE" ? bresp : rresp}`
    );

    return newTx;
  };

  // ==========================================================================
  // AXI VERIFICATION IP (VIP) ROOT TEST SUITES
  // ==========================================================================
  const runVipTestSuite = async (suite: "NOMINAL_20" | "STROBE_CORNER" | "ERROR_INJECT" | "CDC_TIMING") => {
    if (vipRunning) return;
    setVipRunning(true);
    setVipProgress(5);
    setVipResultSummary(null);

    const testTxHistory: AxiTransaction[] = [];
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    if (suite === "NOMINAL_20") {
      // 1. Scan and verify register operations across all 20 defined system registers
      onAddLog("AXI_VERIF_VIP", "INFO", "Initializing VIP Test Suite: 20 System Registers Coverage Scan...");
      
      const targets = VIP_REGISTERS.slice(0, 20);
      let passedCount = 0;

      for (let i = 0; i < targets.length; i++) {
        const reg = targets[i];
        setVipProgress(Math.floor(((i + 1) / targets.length) * 100));

        // 1. Nominal Read
        onAddLog("AXI_VERIF_VIP", "INFO", `[VIP Suite] Testing RO/RW baseline scan index ${i+1}/20: Read ${reg.name}`);
        const txRead = dispatchAxiTransaction("READ", reg.offset);
        testTxHistory.push(txRead);
        if (txRead.status === "PASS") passedCount++;
        await sleep(150);

        // 2. Test Write on RW or inspect error response on RO
        if (reg.access === "RW" || reg.access === "WO") {
          onAddLog("AXI_VERIF_VIP", "INFO", `[VIP Suite] Exercising RW write-check on '${reg.name}' (${reg.offset})`);
          const testVal = reg.offset === "0x54" ? "0x00001000" : "0x000000AA"; // Safe PWM Frequency rate or general marker
          const txWrite = dispatchAxiTransaction("WRITE", reg.offset, testVal);
          testTxHistory.push(txWrite);
          if (txWrite.status === "PASS") passedCount++;
          await sleep(150);
          
          // Verify modify register value read-back
          if (reg.access === "RW") {
            const txReadBack = dispatchAxiTransaction("READ", reg.offset);
            testTxHistory.push(txReadBack);
            if (txReadBack.status === "PASS" && txReadBack.actualValue === testVal) {
              passedCount++;
            } else {
              onAddLog("AXI_VERIF_VIP", "WARNING", `[VIP Scoreboard Mismatch] RW Readback failed expected value matched read: expected ${testVal}, got ${txReadBack.actualValue}`);
            }
            await sleep(100);
          }
        } else {
          // If RO, execute RO compliance check (should reject write with SLVERR)
          onAddLog("AXI_VERIF_VIP", "INFO", `[VIP Suite] Exercising RO boundary lock on '${reg.name}'`);
          const txWriteRO = dispatchAxiTransaction("WRITE", reg.offset, "0xFFFFFFFF");
          testTxHistory.push(txWriteRO);
          if (txWriteRO.status === "PASS") passedCount++;
          await sleep(100);
        }
      }

      setVipResultSummary({
        total: testTxHistory.length,
        pass: testTxHistory.filter(t => t.status === "PASS").length,
        fail: testTxHistory.filter(t => t.status === "FAIL").length,
        suiteName: "Nominal 20 Core Registers Full Coverage Scan"
      });

    } else if (suite === "STROBE_CORNER") {
      // 2. Corner cases: multi-byte strobe masking
      onAddLog("AXI_VERIF_VIP", "INFO", "Initializing VIP Test Suite: Write strobe (WSTRB) corner-cases validation...");
      
      const scratchRegs = ["0xE8"]; // SCRATCH_0
      let cycle = 1;

      // Reset scratchpad first
      dispatchAxiTransaction("WRITE", "0xE8", "0x00000000");
      await sleep(150);

      // Test byte configurations via WSTRB
      const testCases = [
        { val: "0xBEEF0000", strb: "1100", expected: "0xBEEF0000", comment: "Upper half-word write" },
        { val: "0x0000BEEF", strb: "0011", expected: "0xBEEFBEEF", comment: "Lower half-word write (cumulative)" },
        { val: "0xAA55AA55", strb: "0110", expected: "0xBE55AABF", comment: "Middle bytes selective masking write" },
        { val: "0x12345678", strb: "0000", expected: "0xBE55AABF", comment: "Zero strobe write (value must remain unchanged)" },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        setVipProgress(Math.floor(((i + 1) / testCases.length) * 100));
        
        onAddLog("AXI_VERIF_VIP", "INFO", `[VIP Suite] Strobe tc #${i+1}: Writing ${tc.val} with strobe [WSTRB=${tc.strb}]`);
        const tx = dispatchAxiTransaction("WRITE", "0xE8", tc.val, tc.strb);
        testTxHistory.push(tx);
        await sleep(200);

        const rd = dispatchAxiTransaction("READ", "0xE8");
        testTxHistory.push(rd);
        await sleep(150);
      }

      setVipResultSummary({
        total: testTxHistory.length,
        pass: testTxHistory.filter(t => t.status === "PASS").length,
        fail: testTxHistory.filter(t => t.status === "FAIL").length,
        suiteName: "Write Strobe (WSTRB) Corner Masking Compliance Suite"
      });

    } else if (suite === "ERROR_INJECT") {
      // 3. Error code assertions: SLVERR & DECERR injection
      onAddLog("AXI_VERIF_VIP", "INFO", "Initializing VIP Test Suite: Address Decode and Protection Error (SLVERR/DECERR) verification...");

      const actions = [
        // 1. Read unmapped location
        { type: "READ" as const, offset: "0xFC", data: "0x00000000", desc: "Read unmapped address bounds" },
        // 2. Write unmapped location
        { type: "WRITE" as const, offset: "0x100", data: "0xCAFEBABE", desc: "Write unmapped address bounds" },
        // 3. Write RO ID Register
        { type: "WRITE" as const, offset: "0x00", data: "0xFFFFFFFF", desc: "RO Protection Violation (ID)" },
        // 4. Write RO STATUS Register
        { type: "WRITE" as const, offset: "0x08", data: "0x000D3ADB", desc: "RO Protection Violation (STATUS)" },
      ];

      for (let i = 0; i < actions.length; i++) {
        const act = actions[i];
        setVipProgress(Math.floor(((i + 1) / actions.length) * 100));

        onAddLog("AXI_VERIF_VIP", "INFO", `[VIP Suite] Testing ${act.desc} on ${act.offset}`);
        const tx = dispatchAxiTransaction(act.type, act.offset, act.data);
        testTxHistory.push(tx);
        await sleep(200);
      }

      setVipResultSummary({
        total: testTxHistory.length,
        pass: testTxHistory.filter(t => t.status === "PASS").length,
        fail: testTxHistory.filter(t => t.status === "FAIL").length,
        suiteName: "Protocol Protection Violation & Error Ingestion Suite"
      });

    } else if (suite === "CDC_TIMING") {
      // 4. CDC Desynchronization / Handshake clock-drift test
      onAddLog("AXI_VERIF_VIP", "INFO", "Initializing VIP Test Suite: Clock Domain Crossing (CDC) Jitter and Clock Drift timing analysis...");
      
      // We alter settings slightly during this test to stress simulated register reading, mimicking AXI metastability
      onAddLog("AXI_VERIF_VIP", "WARNING", "Applying artificial clock domain timing jitter: CDC Desync stress is active");
      
      const originalViolaRatio = protocolViolationRate;
      setProtocolViolationRate(20); // Inject 20% protocol hazard frequency for tracking
      await sleep(150);

      const timingTests = [
        { type: "READ" as const, offset: "0x58", desc: "Fast-sampled Thermal Segment clock scan" },
        { type: "READ" as const, offset: "0x70", desc: "High-speed Induction Current clock scan" },
        { type: "READ" as const, offset: "0x74", desc: "Reactor Compression Pressure clock scan" },
        { type: "WRITE" as const, offset: "0xE8", val: "0x12344321", desc: "Metastability recovery check (WRITE)" },
        { type: "READ" as const, offset: "0xE8", desc: "Metastability recovery check (READ)" },
      ];

      for (let i = 0; i < timingTests.length; i++) {
        const tt = timingTests[i];
        setVipProgress(Math.floor(((i + 1) / timingTests.length) * 100));
        
        onAddLog("AXI_VERIF_VIP", "INFO", `[VIP Suite] exercising ${tt.desc}`);
        const tx = dispatchAxiTransaction(tt.type, tt.offset, (tt as any).val);
        testTxHistory.push(tx);
        await sleep(250);
      }

      // Restore protocol violation rate
      setProtocolViolationRate(originalViolaRatio);

      setVipResultSummary({
        total: testTxHistory.length,
        pass: testTxHistory.filter(t => t.status === "PASS").length,
        fail: testTxHistory.filter(t => t.status === "FAIL").length,
        suiteName: "AXI Sub-clock CDC Jitter Timing Analysis"
      });
    }

    setVipRunning(false);
  };

  // ==========================================================================
  // SEARCH / FILTER SUB-CALCULATIONS
  // ==========================================================================
  const filteredTxs = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.offset.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.addr.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.debugLog.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === "ALL" || t.type === filterType;
      const matchesStatus = filterStatus === "ALL" || t.status === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [transactions, searchQuery, filterType, filterStatus]);

  return (
    <div className={`border p-5 rounded-lg flex flex-col justify-between relative overflow-hidden font-mono ${
      theme === "blueprint" 
        ? "bg-slate-950 border-sky-800 text-sky-200" 
        : "bg-slate-950/95 border-slate-800 text-slate-350"
    }`} id="axi-monitor-scoreboard-subsystem-wrapper">
      
      {/* Dynamic Ribbon Indicators */}
      <div className={`absolute top-0 right-0 p-1 bg-cyan-950 border-b border-l text-[8px] font-bold uppercase tracking-widest z-10 ${
        theme === "blueprint" ? "border-sky-700 text-cyan-400" : "border-slate-800 text-cyan-450"
      }`}>
        AXI4-Lite VIP Verification Suite
      </div>

      <div className="flex items-center gap-2 mb-4 border-b border-slate-900 pb-3 justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold font-mono tracking-wider text-slate-200">
            AXI4-LITE SLAVE VERIFICATION VIP & LIVE SCOREBOARD
          </h3>
        </div>
        
        {/* Verification Stats Summary */}
        <div className="flex gap-4 text-[8px]">
          <span className="text-slate-500">
            TOTAL CLOCK CYCLES: <strong className="text-slate-200">{currentSimTime}</strong>
          </span>
          <span className="text-emerald-500">
            PASSED COMPLIANT: <strong className="font-bold underline">{transactions.filter(t => t.status === "PASS").length}</strong>
          </span>
          <span className="text-red-400 font-bold">
            PROTOCOL FAILS: <strong>{transactions.filter(t => t.status === "FAIL").length}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 leading-normal">
        
        {/* ====================================================================
            LEFT PANEL (xl:col-span-4): VIP EXECUTOR & STIMULI CONTROLS
            ==================================================================== */}
        <div className="xl:col-span-4 bg-slate-900/35 border border-slate-900 p-4 rounded-md flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                AXI Verification IP (VIP) Master Stimulus
              </span>
            </div>
            
            <p className="text-[8.5px] text-slate-500 mb-3.5 leading-relaxed font-mono">
              The AXI VIP generates standard high-speed cycles, stressing write Strobes, injection errors (SLVERR/DECERR) and clock synchronizers, confirming exact compliance of the 20 main register assets.
            </p>

            {/* Testsuite runners */}
            <div className="space-y-2 mb-4">
              <span className="text-[8.5px] text-slate-400 block font-bold">SELECT ACTIVE VIP TEST SUITE:</span>
              
              <button 
                disabled={vipRunning}
                onClick={() => runVipTestSuite("NOMINAL_20")}
                className={`w-full py-1.5 px-3 rounded text-[8.5px] border font-bold text-left flex items-center justify-between transition cursor-pointer ${
                  vipRunning 
                    ? "bg-slate-950 border-slate-900 text-slate-600" 
                    : "bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border-blue-900 text-sky-400 hover:border-sky-600 hover:text-white"
                }`}
              >
                <span>1. Nominal 20 Registers Core Scan</span>
                <Play className="w-2.5 h-2.5" />
              </button>

              <button 
                disabled={vipRunning}
                onClick={() => runVipTestSuite("STROBE_CORNER")}
                className={`w-full py-1.5 px-3 rounded text-[8.5px] border font-bold text-left flex items-center justify-between transition cursor-pointer ${
                  vipRunning 
                    ? "bg-slate-950 border-slate-900 text-slate-600" 
                    : "bg-gradient-to-r from-teal-950/30 to-emerald-950/30 border-emerald-900/40 text-emerald-400 hover:border-emerald-600 hover:text-white"
                }`}
              >
                <span>2. Write Strobe Corner-case Masking</span>
                <Play className="w-2.5 h-2.5" />
              </button>

              <button 
                disabled={vipRunning}
                onClick={() => runVipTestSuite("ERROR_INJECT")}
                className={`w-full py-1.5 px-3 rounded text-[8.5px] border font-bold text-left flex items-center justify-between transition cursor-pointer ${
                  vipRunning 
                    ? "bg-slate-950 border-slate-900 text-slate-600" 
                    : "bg-gradient-to-r from-amber-955/20 to-red-955/15 border-red-950/40 text-red-400 hover:border-red-600 hover:text-white"
                }`}
              >
                <span>3. Protection SLVERR/DECERR Boundary Ingest</span>
                <Play className="w-2.5 h-2.5" />
              </button>

              <button 
                disabled={vipRunning}
                onClick={() => runVipTestSuite("CDC_TIMING")}
                className={`w-full py-1.5 px-3 rounded text-[8.5px] border font-bold text-left flex items-center justify-between transition cursor-pointer ${
                  vipRunning 
                    ? "bg-slate-950 border-slate-900 text-slate-600" 
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                <span>4. Metastability CDC Clock Sync Stress</span>
                <Play className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Live Progress Bar */}
            {vipRunning && (
              <div className="mb-4 bg-slate-950 p-2 border border-slate-900 rounded">
                <div className="flex justify-between items-center text-[8px] mb-1">
                  <span className="text-cyan-400 font-bold animate-pulse">VIP ENGINE EXECUTING CYCLES...</span>
                  <span>{vipProgress}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1 relative overflow-hidden">
                  <div className="bg-cyan-500 h-1 rounded-full text-[1px] transition-all duration-150" style={{ width: `${vipProgress}%` }}></div>
                </div>
              </div>
            )}

            {/* Test suite results card */}
            {vipResultSummary && (
              <div className="mb-4 p-3 border border-slate-900 bg-slate-955 rounded relative text-[8px]">
                <span className="text-[7.5px] uppercase text-slate-500 font-semibold block mb-1">TEST RESULTS:</span>
                <div className="text-[9.5px] font-bold text-slate-200 mb-2 truncate">
                  {vipResultSummary.suiteName}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center p-1.5 bg-slate-950/40 rounded border border-slate-900">
                  <div>
                    <span className="text-[6.5px] text-slate-500 block">CYCLES RUN</span>
                    <strong className="text-slate-350">{vipResultSummary.total}</strong>
                  </div>
                  <div>
                    <span className="text-[6.5px] text-emerald-400 block">PASS CASE</span>
                    <strong className="text-emerald-500">{vipResultSummary.pass}</strong>
                  </div>
                  <div>
                    <span className="text-[6.5px] text-red-400 block">FAIL PROTO</span>
                    <strong className={`${vipResultSummary.fail > 0 ? 'text-red-500 animate-pulse font-extrabold' : 'text-slate-400'}`}>
                      {vipResultSummary.fail}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Timing Hazard Configuration Sliders */}
          <div className="border-t border-slate-900 pt-3.5 space-y-2.5 text-[8.5px]">
            <span className="text-slate-400 font-bold flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
              Configure VIP Protocol Constraints
            </span>

            {/* Slider 1: AWREADY acknowledgment clock cycles delay */}
            <div>
              <div className="flex justify-between items-center text-[8px] text-slate-500 mb-1">
                <span>Handshake Delay (AWREADY/WREADY):</span>
                <strong className="text-cyan-400">{axiReadyDelayCycles} clock cyc</strong>
              </div>
              <input 
                type="range"
                min="0"
                max="4"
                value={axiReadyDelayCycles}
                onChange={(e) => setAxiReadyDelayCycles(Number(e.target.value))}
                className="w-full accent-cyan-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Slider 2: Synthesize timing violations probability */}
            <div>
              <div className="flex justify-between items-center text-[8px] text-slate-500 mb-1">
                <span>Inject Violation Probability (Glitch Rate):</span>
                <strong className={`${protocolViolationRate > 0 ? "text-red-400 border-red-500/20" : "text-slate-450"}`}>
                  {protocolViolationRate}%
                </strong>
              </div>
              <input 
                type="range"
                min="0"
                max="50"
                value={protocolViolationRate}
                step="5"
                onChange={(e) => setProtocolViolationRate(Number(e.target.value))}
                className="w-full accent-cyan-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[6.5px] text-slate-550 block mt-0.5 leading-tight">
                Simulates state corruption or clock drift on VHDL synchronization barriers.
              </span>
            </div>

            {/* Checklist Toggle for write strobe compliance */}
            <div className="flex items-center justify-between pt-1 font-mono text-[8px]">
              <span className="text-slate-550">ENFORCE WSTRB STRUCT COMPLIANCE:</span>
              <button 
                onClick={() => setStrobeFilterCompliance(!strobeFilterCompliance)}
                className={`px-1.5 py-0.5 border rounded cursor-pointer font-bold transition text-[7.5px] ${strobeFilterCompliance ? 'bg-sky-955 text-sky-400 border-sky-850' : 'bg-slate-900 text-slate-500 border-slate-800'}`}
              >
                {strobeFilterCompliance ? "COMPLIANCE_ON" : "BYPASSED"}
              </button>
            </div>
          </div>
        </div>

        {/* ====================================================================
            MIDDLE PANEL (xl:col-span-4): SCOREBOARD TRANSACTION COMPARATOR
            ==================================================================== */}
        <div className="xl:col-span-4 bg-slate-900/35 border border-slate-900 p-4 rounded-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
                AXI Scoreboard Active Verification
              </span>
              <button 
                onClick={() => setTransactions([])}
                className="text-[7.5px] px-1 border border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300 rounded transition font-mono uppercase"
              >
                Reset Queue
              </button>
            </div>

            <p className="text-[8.5px] text-slate-550 mb-3.5 leading-relaxed font-mono">
              The Scoreboard sniffs the captured signals and compares read/write values + boundary response statuses on cycle completion, identifying any clock jitter.
            </p>

            {/* Filter Group */}
            <div className="flex gap-1 mb-3">
              <input 
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-900 text-slate-300 px-2 py-0.8 placeholder-slate-700 text-[8px] focus:outline-none rounded font-mono"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-[8px] text-slate-600 hover:text-slate-400 px-1 font-bold font-mono">✕</button>
              )}
            </div>

            <div className="flex gap-1.5 mb-3">
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-slate-950 text-slate-400 border border-slate-900 rounded font-mono text-[8px] px-1 py-0.5 focus:outline-none flex-1"
              >
                <option value="ALL">ALL TYPES</option>
                <option value="WRITE">WRITE ONLY</option>
                <option value="READ">READ ONLY</option>
              </select>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-slate-950 text-slate-400 border border-slate-900 rounded font-mono text-[8px] px-1 py-0.5 focus:outline-none flex-1"
              >
                <option value="ALL">ALL STATUS</option>
                <option value="PASS">PASSED ONLY</option>
                <option value="FAIL">FAILED ONLY</option>
              </select>
            </div>

            {/* Live Sniffed Stream */}
            <div className="border border-slate-900 rounded bg-slate-950 max-h-[178px] overflow-y-auto font-mono text-[7.5px] tracking-tight">
              {filteredTxs.length === 0 ? (
                <div className="p-4 text-center text-slate-600 font-mono">No active AXI packets. Trigger a test or write manually.</div>
              ) : (
                <div className="divide-y divide-slate-900">
                  {filteredTxs.map((tx) => {
                    const isSelected = selectedTx?.id === tx.id;
                    const r = VIP_REGISTERS.find(v => v.offset === tx.offset);
                    return (
                      <div 
                        key={tx.id}
                        onClick={() => {
                          setSelectedTx(tx);
                          triggerWaveUpdate(tx);
                        }}
                        className={`p-2 transition cursor-pointer flex items-center justify-between ${
                          isSelected ? "bg-cyan-950/20 text-cyan-200" : "hover:bg-slate-900/50 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                          <span className={`px-1 text-[6.5px] rounded ${tx.type === "WRITE" ? "bg-amber-955 text-amber-400" : "bg-cyan-955 text-cyan-400"}`}>
                            {tx.type}
                          </span>
                          <span className="text-slate-600">[{tx.id}]</span>
                          <strong className="text-slate-300 font-bold">{tx.offset}</strong>
                          <span className="text-slate-500 font-normal truncate max-w-[65px]">({r?.name || "UNMAPPED"})</span>
                        </div>

                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-655 font-semibold text-[7px]" title="cycle">{tx.cycle} cyc</span>
                          <span className="text-slate-655 font-semibold" title="timestamp">{tx.timestamp}</span>
                          <span className={`px-1 rounded font-bold text-[7px] ${tx.status === "PASS" ? "text-emerald-505 bg-emerald-955/20 border border-emerald-900/30" : "text-red-405 bg-red-955/20 border border-red-900/30 font-extrabold animate-pulse"}`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Manual Bus Injector Console */}
          <div className="border-t border-slate-900 pt-3 text-[8.5px] font-mono space-y-2">
            <span className="text-slate-500 font-bold uppercase tracking-wider block">Manual Interconnect Injection (Diagnostic Port)</span>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[7.5px] text-slate-605 block">Offset:</label>
                <input 
                  id="axi-manual-offset"
                  type="text" 
                  defaultValue="0xCC" 
                  placeholder="0xE8"
                  className="w-full bg-slate-950 border border-slate-900 text-slate-200 px-1 py-0.5 rounded font-mono text-[8px] focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[7.5px] text-slate-605 block">Write Data (Hex / 32-bit):</label>
                <input 
                  id="axi-manual-data"
                  type="text" 
                  defaultValue="0x000000FF" 
                  placeholder="0xAA55AA55"
                  className="w-full bg-slate-950 border border-slate-900 text-slate-200 px-1 py-0.5 rounded font-mono text-[8px] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-1">
              <button 
                onClick={() => {
                  const offsetEl = document.getElementById("axi-manual-offset") as HTMLInputElement;
                  dispatchAxiTransaction("READ", offsetEl?.value || "0x00");
                }}
                className="flex-1 py-1 hover:bg-cyan-900 bg-cyan-955 text-cyan-400 border border-cyan-850 cursor-pointer font-bold rounded text-center transition"
              >
                Incorporate READ
              </button>
              <button 
                onClick={() => {
                  const offsetEl = document.getElementById("axi-manual-offset") as HTMLInputElement;
                  const dataEl = document.getElementById("axi-manual-data") as HTMLInputElement;
                  dispatchAxiTransaction("WRITE", offsetEl?.value || "0x00", dataEl?.value || "0x00");
                }}
                className="flex-1 py-1 hover:bg-amber-900/60 bg-amber-955 text-amber-400 border border-amber-900/40 cursor-pointer font-bold rounded text-center transition"
              >
                Incorporate WRITE
              </button>
            </div>
          </div>
        </div>

        {/* ====================================================================
            RIGHT PANEL (xl:col-span-4): COMPREHENSIVE TIMING ANALYZER & AUDIT DETAILED LOGS
            ==================================================================== */}
        <div className="xl:col-span-4 bg-slate-900/35 border border-slate-900 p-4 rounded-md flex flex-col justify-between">
          <div className="h-full flex flex-col justify-between space-y-4">
            
            {/* Live compliance checker scorecard sheet */}
            {selectedTx ? (
              <div className="space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                  <span className="text-[9.5px] text-slate-350 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                    Transaction Audit: Match Check
                  </span>
                  <span className={`px-1.5 rounded text-[7.5px] font-bold border ${selectedTx.status === "PASS" ? "bg-emerald-955/65 text-emerald-400 border-emerald-900" : "bg-red-955/65 text-red-400 border-red-900/50 animate-pulse"}`}>
                    {selectedTx.status === "PASS" ? "COMPLIANT MATCH" : "PROTOCOL BREACH"}
                  </span>
                </div>

                <div className="bg-slate-950 p-2 border border-slate-900 rounded font-mono text-[8px] space-y-2 leading-relaxed">
                  <div className="grid grid-cols-2 gap-2 text-slate-450 border-b border-slate-900 pb-1.5 mb-1.5">
                    <div>
                      <span className="text-[7px] text-slate-550 block uppercase">Captured ID</span>
                      <strong className="text-cyan-400 font-bold">{selectedTx.id}</strong>
                    </div>
                    <div>
                      <span className="text-[7px] text-slate-550 block uppercase">Offset Address</span>
                      <strong className="text-slate-100 font-bold">{selectedTx.addr}</strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-550">Expected Value:</span>
                      <strong className="text-slate-350 font-semibold">{selectedTx.expectedValue || "N/A"}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-950 pb-1">
                      <span className="text-slate-550">Captured Value:</span>
                      <strong className={selectedTx.status === "PASS" ? "text-emerald-400" : "text-red-550 font-black animate-pulse"}>
                        {selectedTx.actualValue || "N/A"}
                      </strong>
                    </div>

                    <div className="flex justify-between mt-1">
                      <span className="text-slate-550">Expected status (BRESP/RRESP):</span>
                      <strong className="text-slate-450 font-semibold">{selectedTx.expectedStatus || "OKAY"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-550">Captured status:</span>
                      <strong className={`font-semibold ${selectedTx.actualStatus === "OKAY" ? "text-cyan-405" : "text-amber-505"}`}>
                        {selectedTx.actualStatus || "OKAY"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Scoreboard detailed audit description */}
                <div className="p-2 border border-slate-850 bg-slate-955 rounded text-[8px] font-mono leading-relaxed max-h-[85px] overflow-y-auto select-text select-all">
                  <span className="text-slate-550 block text-[7.5px] uppercase font-bold mb-0.5 tracking-wide select-none">Scoreboard Checker logs:</span>
                  <div className="text-slate-350 font-mono select-text">
                    {selectedTx.debugLog}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-600 font-mono text-[8px] text-center p-8 border border-dashed border-slate-900 rounded">
                Select a captured transaction in the central stream analyzer to review detailed scoreboard diagnostics.
              </div>
            )}

            {/* Micro Logic Analyzer Timing Waves (VHDL timing diagram visualization!) */}
            <div className="border border-slate-950 bg-slate-955 rounded p-2 text-[7px] font-mono leading-none flex-1 flex flex-col justify-between max-h-[160px] overflow-hidden select-none">
              <span className="block text-[7.5px] font-bold text-slate-550 uppercase tracking-widest border-b border-slate-900 pb-1 mb-1 font-mono">
                AXI4-Lite Cycle-by-Cycle Bus Waves Snapshot
              </span>
              
              {waveSnapshot.length > 0 ? (
                <div className="space-y-1.5 font-mono select-none">
                  {/* Wave Group: aclk */}
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-[6.5px] text-slate-500 font-semibold truncate uppercase" title="aclk">ACLK:</span>
                    <div className="flex-1 flex font-mono select-none">
                      {waveSnapshot.map((w, idx) => (
                        <div 
                          key={idx} 
                          className={`flex-1 h-2 text-[5px] text-center border-t border-b border-slate-900 relative ${
                            w.aclk === 1 ? 'border-sky-505 bg-sky-955/25' : 'bg-slate-950/45 font-mono'
                          }`}
                        >
                          <span className="text-[4.5px] text-slate-700 absolute inset-0 flex items-center justify-center font-mono select-none">
                            {w.aclk === 1 ? "▲" : "▼"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Wave Group: Address validation (AWVALID / ARVALID) */}
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-[6.5px] text-slate-500 font-semibold truncate uppercase" title="ADDR_VAL">VALID:</span>
                    <div className="flex-1 flex font-mono select-none">
                      {waveSnapshot.map((w, idx) => {
                        const val = w.awvalid === 1 || w.arvalid === 1;
                        return (
                          <div 
                            key={idx} 
                            className={`flex-1 h-2 border-t border-b border-slate-900 transition-all ${
                              val ? 'bg-amber-955/30 border-amber-605' : 'bg-slate-950/20'
                            }`}
                          ></div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wave Group: Address acceptance ready (AWREADY / ARREADY) */}
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-[6.5px] text-slate-500 font-semibold truncate uppercase" title="ADDR_RDY">READY:</span>
                    <div className="flex-1 flex font-mono select-none">
                      {waveSnapshot.map((w, idx) => {
                        const rdy = w.awready === 1 || w.arready === 1;
                        return (
                          <div 
                            key={idx} 
                            className={`flex-1 h-2 border-t border-b border-slate-900 transition-all ${
                              rdy ? 'bg-emerald-955/35 border-emerald-605' : 'bg-slate-950/20'
                            }`}
                          ></div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wave Group: Write Data valid / Read Data valid channels */}
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-[6.5px] text-slate-500 font-semibold truncate uppercase" title="DATA_BUS">D_VAL:</span>
                    <div className="flex-1 flex font-mono select-none">
                      {waveSnapshot.map((w, idx) => {
                        const bus = w.wvalid === 1 || w.rvalid === 1;
                        return (
                          <div 
                            key={idx} 
                            className={`flex-1 h-2 border-t border-b border-slate-900 transition-all ${
                              bus ? 'bg-indigo-950/60 border-indigo-501' : 'bg-slate-950/20'
                            }`}
                          ></div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between text-[5.5px] text-slate-600 border-t border-slate-900/60 pt-1 leading-none font-mono">
                    <span>CYCLES SNAP:</span>
                    <div className="flex-1 flex justify-between px-2 font-mono">
                      {waveSnapshot.map((w, idx) => (
                        <span key={idx}>{w.cycle}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-655 text-[6.5px] text-center p-4">No timing snapshots parsed. Run an interactive bus transaction.</div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
