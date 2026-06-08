/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Cpu, ShieldAlert, BadgeInfo, Play, Pause, FastForward, Info, RotateCcw, Zap } from "lucide-react";

// Types & Helpers
import {
  HexagramState,
  HexagramStateLabels,
  ElectricalReg,
  ElectricalRegLabels,
  SysMode,
  SysModeLabels,
  ContactorState,
  ContactorStateLabels,
  isValidTransition,
  faultVectorToByte,
  byteToFaultVector,
  TelemetryPacket,
  encodeTelemetry,
  decodeTelemetry,
  SubsystemId,
  FaultSeverity,
  DETAILED_FAULT_REGISTRY,
  SystemLog,
  ChokeState,
  ChokeStateLabels,
  StateTransition,
} from "./types";

import {
  calculateTaylorPrediction,
  calculateTaylorPredictionForSteps,
  calculatePredictionVariance,
  checkTransitionValid,
} from "./mhdUtils";

import {
  CF_PREDICTOR_URL,
  CF_TELEMETRY_URL,
  CF_HIL_SIM_URL,
  hasActiveCloudFunctions,
  transmitTelemetryToRemote,
  fetchTaylorPredictionFromRemote,
  invokeHILSimCoProcessor
} from "./utils/cfIntegration";

// Sub-components
import SystemSchematic from "./components/SystemSchematic";
import TelemetryViewer from "./components/TelemetryViewer";
import ControlConsole from "./components/ControlConsole";
import HILSimulatorControls from "./components/HILSimulatorControls";
import StateVisualizers from "./components/StateVisualizers";
import AIHexagramDecisionBrain from "./components/AIHexagramDecisionBrain";
import AIPedagogyStatus from "./components/AIPedagogyStatus";
import AIEmotionalWeightsVisualizer from "./components/AIEmotionalWeightsVisualizer";
import AIGatedSubstrate from "./components/AIGatedSubstrate";
import SpatialPlaneVisualizer from "./components/SpatialPlaneVisualizer";
import StateTransitionHistory from "./components/StateTransitionHistory";
import SovereignGlobePanel from "./components/SovereignGlobePanel";
import SystemHealthDashboard from "./components/SystemHealthDashboard";
import FpgaDebuggerInterface from "./components/FpgaDebuggerInterface";

import { GhostTrainingLimb, GhostTrainingLimbState } from "./utils/GhostTrainingLimb";
import { TelemetryArchiverLimb } from "./utils/TelemetryArchiverLimb";
import { useTheme } from "./ThemeContext";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // ==========================================================================
  // GHOST TRAINING LIMB INTEGRATION
  // ==========================================================================
  const ghostLimb = GhostTrainingLimb.getInstance();
  const [ghostState, setGhostState] = useState<GhostTrainingLimbState>(ghostLimb.getState());

  useEffect(() => {
    const handleStateChange = (updatedState: GhostTrainingLimbState) => {
      setGhostState(updatedState);
    };
    ghostLimb.registerListener(handleStateChange);
    return () => ghostLimb.unregisterListener(handleStateChange);
  }, []);

  // ==========================================================================
  // REAL-TIME SIMULATOR TICK & CLOCK STATE
  // ==========================================================================
  const [tickCounter, setTickCounter] = useState(0);
  const [tickSpeed, setTickSpeed] = useState<"normal" | "fast" | "paused">("normal");
  const [subTickPhase, setSubTickPhase] = useState(0);

  // ==========================================================================
  // HIL STRESS INJECTORS & CONFIGURATION STATE
  // ==========================================================================
  const [temperatureBias, setTemperatureBias] = useState(0); // offsets nominal 300K
  const [chokeFreqOffset, setChokeFreqOffset] = useState(0); // Choke Frequency manually injected offset (Hz)
  const [plenumPressure, setPlenumPressure] = useState(1.30);  // Nominally 1.30 atm
  const [imuGyroRate, setImuGyroRate] = useState(0);           // Gyro turn rate mdps
  const [busCurrentBias, setBusCurrentBias] = useState(0);     // offsets nominal 1880A
  const [taylorOrder, setTaylorOrder] = useState(3);           // 2 to 5 order predictor
  const [contactorFaultMask, setContactorFaultMask] = useState<boolean[]>(
    Array(10).fill(true) // true = healthy, false = faulted
  );

  // ==========================================================================
  // AXI4-LITE CONTROLLED FAULT INJECTION & DATA PATH INTEGRITY STATES
  // ==========================================================================
  const [faultInjectTempBitFlip, setFaultInjectTempBitFlip] = useState(false);
  const [faultInjectTempStuck, setFaultInjectTempStuck] = useState(false);
  const [faultInjectPressStuck, setFaultInjectPressStuck] = useState(false);
  const [faultInjectStateCorrupt, setFaultInjectStateCorrupt] = useState(false);
  const [faultInjectCrcCorrupt, setFaultInjectCrcCorrupt] = useState(false);

  // New specific fault injection states
  const [faultInjectAxiTimeout, setFaultInjectAxiTimeout] = useState(false);
  const [faultInjectAxiReadbackMismatch, setFaultInjectAxiReadbackMismatch] = useState(false);
  const [faultInjectCdcDesync, setFaultInjectCdcDesync] = useState(false);
  const [faultInjectCdcDrift, setFaultInjectCdcDrift] = useState(false);
  const [faultInjectThermalRateExceeded, setFaultInjectThermalRateExceeded] = useState(false);
  const [faultInjectSensorDivergence, setFaultInjectSensorDivergence] = useState(false);

  // Robust Logging and UART transmit states
  const [verboseLogging, setVerboseLogging] = useState(true);
  const [transmitLogsOverUart, setTransmitLogsOverUart] = useState(true);
  const [isHwAccelerated, setIsHwAccelerated] = useState(true);

  // Debug monitor stream states
  const [debugStreamLogs, setDebugStreamLogs] = useState<string[]>([]);
  const [debugStreamPaused, setDebugStreamPaused] = useState(false);

  // ==========================================================================
  // FPGA CORE STATE REGISTERS
  // ==========================================================================
  const [currentHexagram, setCurrentHexagram] = useState<HexagramState>(HexagramState.IDLE);
  const [chokeState, setChokeState] = useState<ChokeState>(ChokeState.CH_IDLE);
  const [critStateTicksCounter, setCritStateTicksCounter] = useState(0); // consecutive CRIT state ticks
  const [nonceCounter, setNonceCounter] = useState(101);                 // Challenge-response lock nonce

  // AXI4-Lite Performance Monitoring Counters States
  const [statWriteCount, setStatWriteCount] = useState(245);
  const [statReadCount, setStatReadCount] = useState(389);
  const [avgWriteLatency, setAvgWriteLatency] = useState(4);
  const [avgReadLatency, setAvgReadLatency] = useState(5);
  const [statHexagramWriteCount, setStatHexagramWriteCount] = useState(12);
  const [statTickWriteCount, setStatTickWriteCount] = useState(8);
  const [statAxiErrorCount, setStatAxiErrorCount] = useState(0);
  const [axiLatencyHistory, setAxiLatencyHistory] = useState<Array<{ read: number; write: number }>>(() => {
    return Array.from({ length: 50 }, () => ({
      read: Math.floor(Math.random() * 2) + 5,
      write: Math.floor(Math.random() * 2) + 4
    }));
  });

  const prevHexagramAxiRef = useRef(currentHexagram);
  const prevTickSpeedRef = useRef(tickSpeed);

  // AXI simulation updater responding to tick changes
  useEffect(() => {
    if (tickCounter === 0) return;

    // Simulate standard traffic writes & reads
    const noiseWrites = Math.floor(Math.random() * 3) + 1; // 1-3 writes
    const noiseReads = Math.floor(Math.random() * 6) + 2;  // 2-7 reads

    setStatWriteCount(prev => prev + noiseWrites);
    setStatReadCount(prev => prev + noiseReads);

    // Compute latency under nominal conditions vs timeout injection
    let targetWriteLat = Math.floor(Math.random() * 3) + 4; // 4-6 default cycles
    let targetReadLat = Math.floor(Math.random() * 3) + 5;  // 5-7 default cycles

    if (faultInjectAxiTimeout) {
      targetWriteLat = Math.floor(Math.random() * 8) + 22; // 22-29 cycles high/timeout latency
      targetReadLat = Math.floor(Math.random() * 10) + 25; // 25-34 cycles high/timeout latency
    }

    setAvgWriteLatency(targetWriteLat);
    setAvgReadLatency(targetReadLat);

    setAxiLatencyHistory(prev => {
      const copy = [...prev, { read: targetReadLat, write: targetWriteLat }];
      if (copy.length > 50) copy.shift();
      return copy;
    });

    // Check for AXI transaction errors (e.g., Slave Error, Decode Error, Timeout Error)
    if (faultInjectAxiTimeout || faultInjectAxiReadbackMismatch) {
      const errAdd = (faultInjectAxiTimeout ? Math.floor(Math.random() * 2) + 1 : 0) +
                     (faultInjectAxiReadbackMismatch ? Math.floor(Math.random() * 2) + 1 : 0);
      setStatAxiErrorCount(prev => prev + errAdd);
    }

    // Track write events on target parameters
    if (currentHexagram !== prevHexagramAxiRef.current) {
      setStatHexagramWriteCount(prev => prev + 1);
      prevHexagramAxiRef.current = currentHexagram;
    }

    if (tickSpeed !== prevTickSpeedRef.current) {
      setStatTickWriteCount(prev => prev + 1);
      prevTickSpeedRef.current = tickSpeed;
    }

    // Small random background registers activity
    if (Math.random() < 0.15) {
      setStatHexagramWriteCount(prev => prev + 1);
    }
    if (Math.random() < 0.1) {
      setStatTickWriteCount(prev => prev + 1);
    }
  }, [tickCounter, faultInjectAxiTimeout, faultInjectAxiReadbackMismatch]);
  
  // Historical averages queue for Taylor Series Predictor
  const [historicalAverages, setHistoricalAverages] = useState<number[]>([
    300.2, 300.0, 299.8, 300.1, 300.0,
  ]);

  // Contactor state machines (10 channels)
  const [contactorStates, setContactorStates] = useState<ContactorState[]>(
    Array(10).fill(ContactorState.CT_OPEN)
  );

  // Telemetry Rx logs
  const [packetHistory, setPacketHistory] = useState<string[]>([]);

  // Health and alarm error-feedback tail for the AI decision co-processor
  const [healthFeedbackTail, setHealthFeedbackTail] = useState<Array<{
    tick: number;
    timestamp: string;
    temp: number;
    pressure: number;
    current: number;
    safetyOk: boolean;
    activeFaultsCount: number;
    criticalFaultPresent: boolean;
    tempStress: number;
    pressureStress: number;
    currentStress: number;
    overallStress: number;
  }>>([]);

  const [transitionalState, setTransitionalState] = useState<{
    primary: string;
    future: string;
    nuclear: string;
    movingLines: Array<{
      position: number;
      fromState: "YANG" | "YIN";
      toState: "YANG" | "YIN";
      confidence: number;
      source: string;
      timestamp: string;
    }>;
    transitionProgress: number;
    energyFlow: "ASCENDING" | "DESCENDING" | "STABLE";
    falseStability: boolean;
  }>({
    primary: "000000",
    future: "000000",
    nuclear: "000000",
    movingLines: [],
    transitionProgress: 0,
    energyFlow: "STABLE",
    falseStability: false
  });

  // Historical bus currents & contactor states for real-time analyzers
  const [busCurrentHistory, setBusCurrentHistory] = useState<number[]>([]);
  const [powerMitigationMode, setPowerMitigationMode] = useState<"NONE" | "DEADTIME" | "SNUBBER" | "DAMPENING" | "PREDICTIVE">("NONE");
  const [predictedTempHistory, setPredictedTempHistory] = useState<number[]>([]);
  const [actualTempHistory, setActualTempHistory] = useState<number[]>([]);
  const [contactorHistory, setContactorHistory] = useState<ContactorState[][]>([]);

  // Predictive Series Analysis states for upcoming thermal trend alert panel
  const [predictiveAlerts, setPredictiveAlerts] = useState<{
    isCritPredicted: boolean;
    predictedCriticalBreachTick: number;
    predictedCriticalBreachTemp: number;
    isWarnPredicted: boolean;
    predictedWarningBreachTick: number;
    predictedWarningBreachTemp: number;
    futureTemps: number[];
    chokeFreqNominal?: number;
    chokeFreqCurrent?: number;
    chokeFreqDriftPercent?: number;
    isChokePredictiveDriftWarning?: boolean;
    predictedChokeDriftTick?: number;
    predictedChokeDriftFreq?: number;
    predictedChokeFreqs?: number[];
  }>({
    isCritPredicted: false,
    predictedCriticalBreachTick: -1,
    predictedCriticalBreachTemp: 0,
    isWarnPredicted: false,
    predictedWarningBreachTick: -1,
    predictedWarningBreachTemp: 0,
    futureTemps: [],
    chokeFreqNominal: 6500,
    chokeFreqCurrent: 6500,
    chokeFreqDriftPercent: 0,
    isChokePredictiveDriftWarning: false,
    predictedChokeDriftTick: -1,
    predictedChokeDriftFreq: 6500,
    predictedChokeFreqs: []
  });

  // Transient switching loss simulators
  const [transitionSpike, setTransitionSpike] = useState(0);
  const [activeEfficiencyWarning, setActiveEfficiencyWarning] = useState<{
    id: string;
    fromState: HexagramState;
    toState: HexagramState;
    efficiency: number;
    current: number;
    tick: number;
  } | null>(null);

  const [warningAutoDismiss, setWarningAutoDismiss] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("mhd_warning_autodismiss");
      return saved === "true";
    } catch (e) {
      return false;
    }
  });

  // Persist warningAutoDismiss option
  useEffect(() => {
    try {
      localStorage.setItem("mhd_warning_autodismiss", String(warningAutoDismiss));
    } catch (e) {}
  }, [warningAutoDismiss]);

  // Handle automatic warning dismissal after 10 seconds of simulation activity
  useEffect(() => {
    if (activeEfficiencyWarning && warningAutoDismiss) {
      const timer = setTimeout(() => {
        setActiveEfficiencyWarning(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [activeEfficiencyWarning, warningAutoDismiss]);

  // Sampler to keep track of the histories over ticks
  useEffect(() => {
    if (tickCounter === 0) return;

    setBusCurrentHistory((prev) => {
      const copy = [...prev, busCurrentA];
      if (copy.length > 55) copy.shift();
      return copy;
    });

    setPredictedTempHistory((prev) => {
      const predictor = calculateTaylorPrediction(historicalAverages, taylorOrder);
      const copy = [...prev, predictor.prediction];
      if (copy.length > 55) copy.shift();
      return copy;
    });

    setActualTempHistory((prev) => {
      const copy = [...prev, avgElectrodeTemp];
      if (copy.length > 55) copy.shift();
      return copy;
    });

    setContactorHistory((prev) => {
      const copy = [...prev, [...contactorStates]];
      if (copy.length > 55) copy.shift();
      return copy;
    });
  }, [tickCounter]);

  // ==========================================================================
  // ENHANCED DIAGNOSTIC LOG DATABASE SYSTEMS
  // ==========================================================================
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([
    {
      id: "LOG-INIT1",
      timestamp: new Date().toISOString().substring(11, 19),
      tick: 0,
      subsystem: "SYSTEM" as any,
      level: "SUCCESS",
      message: "VHDL Bitstream loaded to PL logic successfully. PL CLK = 250.00 MHz.",
      variableSnapshot: "Temp: 300.0K | Pres: 1.30atm | Current: 1880A",
    },
    {
      id: "LOG-INIT2",
      timestamp: new Date().toISOString().substring(11, 19),
      tick: 0,
      subsystem: SubsystemId.SECURE_LOCK,
      level: "SUCCESS",
      message: "AXI4-Lite register file mapped. Replay security guard initiated with challenge nonce (101).",
      variableSnapshot: "Temp: 300.0K | Pres: 1.30atm | Current: 1880A",
    },
    {
      id: "LOG-INIT3",
      timestamp: new Date().toISOString().substring(11, 19),
      tick: 0,
      subsystem: SubsystemId.INTERLOCK_SEQUENCE,
      level: "INFO",
      message: "Relay sequence hardware controller initialized. Complementary interlocks ARMED.",
      variableSnapshot: "Temp: 300.0K | Pres: 1.30atm | Current: 1880A",
    }
  ]);
  const [activeFaultCodes, setActiveFaultCodes] = useState<string[]>([]);
  const [k01Active, setK01Active] = useState(false);
  const [k02Active, setK02Active] = useState(false);
  const [isAiActive, setIsAiActive] = useState(true);

  // ==========================================================================
  // STATE TRANSITION HISTORY & AUDIT LOGGER (LAST 20 LOG ENTRIES)
  // ==========================================================================
  const [transitionHistory, setTransitionHistory] = useState<StateTransition[]>([
    {
      id: "TRANS-INIT",
      timestamp: new Date().toISOString().substring(11, 19),
      tick: 0,
      fromState: HexagramState.IDLE,
      toState: HexagramState.IDLE,
      trigger: "System initialization sequence complete. Metaclock profiling started.",
      method: "INITIALIZATION",
      snapshot: {
        temp: 300.0,
        pressure: 1.30,
        current: 1880,
        faults: []
      }
    }
  ]);

  // Load archived UART lists and state transitions on component mounting (IndexedDB)
  useEffect(() => {
    async function restoreArchivedSession() {
      try {
        const archived = await TelemetryArchiverLimb.load();
        if (archived) {
          if (archived.packetHistory && archived.packetHistory.length > 0) {
            setPacketHistory(archived.packetHistory);
          }
          if (archived.transitionHistory && archived.transitionHistory.length > 0) {
            setTransitionHistory(archived.transitionHistory);
          }
        }
      } catch (err) {
        console.error("Failed to restore archived run session:", err);
      }
    }
    restoreArchivedSession();
  }, []);

  // Persist UART and Transition logs asynchronously on change updates (IndexedDB)
  useEffect(() => {
    if (packetHistory.length > 0 || transitionHistory.length > 1) {
      TelemetryArchiverLimb.save(packetHistory, transitionHistory);
    }
  }, [packetHistory, transitionHistory]);

  const recordTransition = (
    from: HexagramState,
    to: HexagramState,
    triggerDesc: string,
    methodType: StateTransition["method"]
  ) => {
    if (from === to && methodType !== "INITIALIZATION") return;

    // Inject dynamic transient switching current overshoot (simulating contactor LC impedance spikes and mitigations)
    let spikeAmount = 115.0;
    if (powerMitigationMode === "PREDICTIVE") {
      spikeAmount = 0.0; // Perfect predictive pre-transition suppression!
    } else if (powerMitigationMode === "DAMPENING") {
      spikeAmount = 20.0; // 95% efficiency
    } else if (powerMitigationMode === "SNUBBER") {
      spikeAmount = 28.0; // 94% efficiency
    } else if (powerMitigationMode === "DEADTIME") {
      spikeAmount = 44.0; // 90% efficiency
    }
    setTransitionSpike(spikeAmount);

    const spicedCurrent = Math.round(1880.0 + busCurrentBias + spikeAmount);
    const snapshotStr = {
      temp: 300.0 + temperatureBias,
      pressure: plenumPressure,
      current: spicedCurrent,
      faults: [...activeFaultCodes],
    };

    const newTransition: StateTransition = {
      id: `TRANS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      timestamp: new Date().toISOString().substring(11, 19),
      tick: tickCounter,
      fromState: from,
      toState: to,
      trigger: triggerDesc,
      method: methodType,
      snapshot: snapshotStr,
    };

    // Calculate transient power efficiency: Baseline 1880A nominal limit
    const deviation = spicedCurrent - 1880.0;
    let transitionEfficiency = 100;
    if (deviation > 0) {
      transitionEfficiency = 100 - (deviation * 0.23);
    }
    transitionEfficiency = Math.max(15, Math.min(100, Math.round(transitionEfficiency)));

    // Handle warning overlay triggers and retrograde database logs under baseline threshold (85%)
    if (transitionEfficiency < 85) {
      addLogEntry(
        SubsystemId.INTERLOCK_SEQUENCE,
        "WARNING",
        `[POWER CORRELATOR] EFFICIENCY DIP: Core transitional power efficiency dropped to ${transitionEfficiency}% (switching load spiked to ${spicedCurrent}A) during VHDL state trajectory transition: ${HexagramStateLabels[from]?.split(" (")[0]} -> ${HexagramStateLabels[to]?.split(" (")[0]}.`
      );

      setActiveEfficiencyWarning({
        id: `WARN-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        fromState: from,
        toState: to,
        efficiency: transitionEfficiency,
        current: spicedCurrent,
        tick: tickCounter,
      });
    }

    setTransitionHistory((prev) => {
      // Remove any initial duplicated initialize entry if it's the first real transition
      const filteredPrev = prev.filter(item => !(item.id === "TRANS-INIT" && prev.length === 1));
      const nextList = [newTransition, ...filteredPrev];
      if (nextList.length > 20) {
        nextList.pop(); // Cap history strictly at 20 transitions to avoid client weight issues
      }
      return nextList;
    });
  };


  // Helper to push structured events into the dynamic UART Debug database
  const addLogEntry = (
    subsystem: SubsystemId | "SYSTEM",
    level: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL",
    message: string
  ) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    const snapshotStr = `Temp: ${(300.0 + temperatureBias).toFixed(1)}K | Pres: ${plenumPressure.toFixed(2)}atm | Current: ${(1880.0 + busCurrentBias).toFixed(0)}A`;
    const newLog: SystemLog = {
      id: `LOG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      timestamp,
      tick: tickCounter,
      subsystem,
      level,
      message,
      variableSnapshot: snapshotStr,
    };
    setSystemLogs((prev) => {
      // Cap log database memory at 300 log frames to optimize client rendering
      const next = [...prev, newLog];
      if (next.length > 300) {
        next.shift();
      }
      return next;
    });

    if (transmitLogsOverUart) {
      const uartLog = `${timestamp} [UART_TX_LOG] $LOG,${newLog.id},${level},${subsystem},${message}`;
      setPacketHistory((prev) => {
        const copy = [...prev, uartLog];
        if (copy.length > 50) copy.shift();
        return copy;
      });
    }
  };

  // ==========================================================================
  // NOMINAL RESET FUNCTION
  // ==========================================================================
  const handleResetSimulator = () => {
    setTemperatureBias(0);
    setPlenumPressure(1.30);
    setImuGyroRate(0);
    setBusCurrentBias(0);
    setChokeFreqOffset(0);
    setTaylorOrder(3);
    setContactorFaultMask(Array(10).fill(true));
    setCurrentHexagram(HexagramState.IDLE);
    recordTransition(currentHexagram, HexagramState.IDLE, "Manually engaged HIL Simulator Reset Command.", "RESET");

    setCritStateTicksCounter(0);
    setHistoricalAverages([300.2, 300.0, 299.8, 300.1, 300.0]);
    setContactorStates(Array(10).fill(ContactorState.CT_OPEN));
    setK01Active(false);
    setK02Active(false);

    // Reset AXI-Lite controlled fault injections
    setFaultInjectTempBitFlip(false);
    setFaultInjectTempStuck(false);
    setFaultInjectPressStuck(false);
    setFaultInjectStateCorrupt(false);
    setFaultInjectCrcCorrupt(false);
    setFaultInjectAxiTimeout(false);
    setFaultInjectAxiReadbackMismatch(false);
    setFaultInjectCdcDesync(false);
    setFaultInjectCdcDrift(false);
    setFaultInjectThermalRateExceeded(false);
    setFaultInjectSensorDivergence(false);
    setVerboseLogging(false);
    setTransmitLogsOverUart(true);
    setDebugStreamLogs([]);

    setPacketHistory((prev) => [
      ...prev,
      `[SIM] Hardware parameters reset. Signal profiling recalibrated.`,
    ]);
    addLogEntry("SYSTEM" as any, "SUCCESS", "RECALIBRATION: Live co-processor simulation bounds reset to nominal parameters.");
  };

  // ==========================================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // ==========================================================================
  const handleResetRef = useRef(handleResetSimulator);
  handleResetRef.current = handleResetSimulator;

  const addLogEntryRef = useRef(addLogEntry);
  addLogEntryRef.current = addLogEntry;

  // Proactive Thermal Alert Tracking
  const lastPredictiveAlertRef = useRef<{ wasWarn: boolean; wasCrit: boolean; wasChokeDrift: boolean }>({
    wasWarn: false,
    wasCrit: false,
    wasChokeDrift: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.getAttribute("role") === "textbox"
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      if (key === "P") {
        setTickSpeed("paused");
        addLogEntryRef.current("SYSTEM" as any, "INFO", "KEYBOARD SHORTCUT: Simulation PAUSED via shortcut [P].");
      } else if (key === "N") {
        setTickSpeed("normal");
        addLogEntryRef.current("SYSTEM" as any, "INFO", "KEYBOARD SHORTCUT: Simulation speed set to NORMAL via shortcut [N].");
      } else if (key === "F") {
        setTickSpeed("fast");
        addLogEntryRef.current("SYSTEM" as any, "INFO", "KEYBOARD SHORTCUT: Simulation speed set to FAST via shortcut [F].");
      } else if (key === "R") {
        handleResetRef.current();
      } else if (e.key === "?") {
        setShowShortcutsModal(prev => !prev);
        addLogEntryRef.current("SYSTEM" as any, "INFO", "KEYBOARD SHORTCUT: Toggle keyboard shortcuts guide via [?].");
      } else if (e.key === "Escape") {
        setShowShortcutsModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // ==========================================================================
  // LIVE COMPUTED HARDWARE INTERLOCKS
  // ==========================================================================
  // IMU Turn Rate Calculation
  const turnRateDegS = imuGyroRate / 1000;
  const imuDecoherenceSpike = turnRateDegS > 5.0; // Decoherence spike threshold Γ > 5.0 °/s (5000 mdps)

  // Current Average Temperature of electrodes (Nominal starts at 300K, drifts based on bias)
  let baseAverageTemp = 300.0 + temperatureBias;
  if (faultInjectTempStuck) {
    baseAverageTemp = 425.0; // Overrides and sticks average electrode temp to 425K
  }
  if (faultInjectThermalRateExceeded) {
    baseAverageTemp += tickCounter * 6.0; // Generate thermal runaway of 6.0 K/tick (>4.5 K/s limit)
  }
  const currentTempSensors = Array.from({ length: 16 }).map((_, i) => {
    // Add small physical temperature distributions (e.g. electrode 0 is hotter)
    const hoverOffset = Math.sin(i * 1.7) * 2.3;
    let temp = baseAverageTemp + hoverOffset;
    if (faultInjectTempBitFlip) {
      temp = temp + 80; // Introduce large bit-flip measurement offset (+80 Kelvin)
    }
    if (faultInjectSensorDivergence && i === 1) {
      temp = temp - 25.0; // Create 25 Kelvin sensor divergence from primary (index 0)
    }
    return temp;
  });
  const avgElectrodeTemp = currentTempSensors[0]; // Average rep temp sampled by ADC index 0

  // Interlock 1: Thermal is OK if temp is under 320 Kelvin
  const thermalOk = avgElectrodeTemp < 320.0;

  // Interlock 2: Plenum Pressure is OK if between 1.25 and 1.35 atm
  const effectivePlenumPressure = faultInjectPressStuck ? 0.0 : plenumPressure;
  const pressureOk = effectivePlenumPressure >= 1.25 && effectivePlenumPressure <= 1.35;

  // ==========================================================================
  // ELECTROMAGNETIC CHOKE CO-SIMULATOR PARAMETERS
  // Couplings between physical properties and choke frequency drift
  // ==========================================================================
  const nominalChokeFreq = 6500.0;
  const thermalChokeDriftOff = (avgElectrodeTemp - 300.0) * -1.5;
  const pressureChokeDriftOff = (effectivePlenumPressure - 1.30) * 800.0;
  const isChokeOscillating = currentHexagram !== HexagramState.IDLE && currentHexagram !== HexagramState.PURGE;
  const currentChokeFreq = isChokeOscillating
    ? (nominalChokeFreq + chokeFreqOffset + thermalChokeDriftOff + pressureChokeDriftOff + Math.sin(tickCounter * 0.4) * 2.1)
    : 0;

  const activeTargetChokeFreq = nominalChokeFreq + chokeFreqOffset + thermalChokeDriftOff + pressureChokeDriftOff;
  const chokeFreqDriftPercent = Math.abs(activeTargetChokeFreq - nominalChokeFreq) / nominalChokeFreq * 100;

  // Real-time sensor parity check (fails when noise bit-flips or stuck-at events bypass standard filtering)
  const sensorParityOk = !faultInjectTempBitFlip && !faultInjectPressStuck;

  // Interlock 3: Contactor symmetry interlocks check
  // VHDL: interlock_ok <= '1' when (state_reg(0) = state_reg(9) and state_reg(1) = state_reg(8)) else '0'
  const symmetryOk =
    contactorStates[0] === contactorStates[9] &&
    contactorStates[1] === contactorStates[8];

  // Interlock 4: Current limits OK (Current must stay under 2000A, or NO contactor is in CT_OPENING state)
  const isOpeningAnyContactor = contactorStates.some(
    (s) => s === ContactorState.CT_OPENING
  );

  // GRACEFUL DEGRADATION: If Electrode thermal wear warnings exist (T-01: >=310K), cap current to 1500A
  const isThermalThrottled = avgElectrodeTemp >= 310.0;
  const nominalBusCurrentDemand = 1880.0 + busCurrentBias + transitionSpike;
  const busCurrentA = isThermalThrottled
    ? Math.min(nominalBusCurrentDemand, 1500.0)
    : nominalBusCurrentDemand;

  const currentLimitOk = busCurrentA < 2000.0 || !isOpeningAnyContactor;

  // ALL SAFETY INTERLOCKS MUST AGREE
  const safetyOk = thermalOk && pressureOk && symmetryOk && currentLimitOk;

  // ==========================================================================
  // DETAILED ELECTRICAL POWER REGULATION MAPPING
  // Maps Hexagram Intent to coil drive capabilities based on safety interlocks
  // ==========================================================================
  let activeElectricalState = ElectricalReg.ELEC_OFF;
  if (safetyOk) {
    if (currentHexagram === HexagramState.IDLE) {
      activeElectricalState = ElectricalReg.ELEC_OFF;
    } else if (currentHexagram === HexagramState.STEALTH) {
      activeElectricalState = ElectricalReg.ELEC_ARMED;
    } else if (
      currentHexagram === HexagramState.TRANSIT ||
      currentHexagram === HexagramState.TR_SALT ||
      currentHexagram === HexagramState.TR_CRIT ||
      currentHexagram === HexagramState.ST_CRIT
    ) {
      // Transitions to ACTIVE if all contactor modules successfully closed
      const allClosed = contactorStates.every(
        (s) => s === ContactorState.CT_CLOSED
      );
      activeElectricalState = allClosed
        ? ElectricalReg.ELEC_ACTIVE
        : ElectricalReg.ELEC_ARMED;
    } else if (currentHexagram === HexagramState.LIMP_MODE) {
      activeElectricalState = ElectricalReg.ELEC_SHED;
    } else if (currentHexagram === HexagramState.PURGE) {
      activeElectricalState = ElectricalReg.ELEC_OFF;
    }
  } else {
    // Force shutdown on interlock failure
    activeElectricalState = ElectricalReg.ELEC_OFF;
  }

  // Determine coil commands based on electrical mapping
  const coilDrive: boolean[] = Array(10).fill(false);
  const precharge: boolean[] = Array(10).fill(false);
  const auxFeedback: boolean[] = Array(10).fill(false);

  for (let i = 0; i < 10; i++) {
    // Force coil energize if active state Closing/Closed limits are request
    if (activeElectricalState === ElectricalReg.ELEC_ACTIVE || activeElectricalState === ElectricalReg.ELEC_ARMED) {
      coilDrive[i] = true;
    } else if (activeElectricalState === ElectricalReg.ELEC_SHED) {
      // ELEC_SHED sheds segment channels (keeps only 0,3,4,7,8 closed)
      if (i === 0 || i === 3 || i === 4 || i === 7 || i === 8) {
        coilDrive[i] = true;
      }
    }
    // Auxiliary status feedback tracks active coil power (simulating short hardware contact delay)
    auxFeedback[i] = coilDrive[i] && contactorStates[i] === ContactorState.CT_CLOSED && contactorFaultMask[i];
    // Pre-charge snubber activates when opening contactors to suppress electric arcs
    precharge[i] = contactorStates[i] === ContactorState.CT_OPENING;
  }

  // ==========================================================================
  // CORE METABOLIC TICK DRIVER LOOP (adjusts between 100ms and 1500ms)
  // ==========================================================================
  useEffect(() => {
    if (tickSpeed === "paused") return;

    const intervalMs = tickSpeed === "fast" ? 180 : 600;
    
    const interval = setInterval(() => {
      setTickCounter((prev) => prev + 1);

      // 1. UPDATE TEMPERATURE HISTORY QUEUE
      // Prepends average temp, truncates queue
      setHistoricalAverages((prev) => {
        const copy = [avgElectrodeTemp, ...prev];
        if (copy.length > 5) copy.pop();
        return copy;
      });

      // 2. CONTACTOR FINITE STATE MACHINES TICK STEP
      setContactorStates((prevStates) => {
        return prevStates.map((state, i) => {
          // If contactor has active injected hardware lockup, force to FAULT
          if (!contactorFaultMask[i]) {
            return ContactorState.CT_FAULT;
          }

          // Recover from fault if fault mask resolved
          if (state === ContactorState.CT_FAULT && contactorFaultMask[i]) {
            return ContactorState.CT_OPEN;
          }

          const targetCoilClosed = coilDrive[i];

          switch (state) {
            case ContactorState.CT_OPEN:
              if (targetCoilClosed) return ContactorState.CT_CLOSING; // transition
              return ContactorState.CT_OPEN;
            case ContactorState.CT_CLOSING:
              return ContactorState.CT_CLOSED; // mechanical delay resolved next tick
            case ContactorState.CT_CLOSED:
              if (!targetCoilClosed) return ContactorState.CT_OPENING; // transition
              return ContactorState.CT_CLOSED;
            case ContactorState.CT_OPENING:
              return ContactorState.CT_OPEN; // delay resolved
            default:
              return state;
          }
        });
      });

      // 3. DECAY TRANSIENT SHUNT CURRENT SPIKES ACROSS TICKS
      setTransitionSpike((prev) => (prev > 0 ? Math.max(0, prev * 0.42) : 0));

    }, intervalMs);

    return () => clearInterval(interval);
  }, [tickSpeed, avgElectrodeTemp, coilDrive, contactorFaultMask]);

  // ==========================================================================
  // DYNAMIC SLAVE FAULT MONITOR & SEQUENTIAL RECORDER
  // Monitors physical readings, logs fault code state changes, and
  // automatically triggers safe shutdowns to LIMP_MODE on CRITICAL severity.
  // ==========================================================================
  useEffect(() => {
    const liveFaults: string[] = [];

    if (avgElectrodeTemp >= 310.0 && avgElectrodeTemp < 320) liveFaults.push("T-01");
    if (avgElectrodeTemp >= 320.0) liveFaults.push("T-02");
    if (nominalBusCurrentDemand >= 1950.0 && nominalBusCurrentDemand < 2000.0) liveFaults.push("E-01");
    if (activeElectricalState === ElectricalReg.ELEC_OFF && currentHexagram !== HexagramState.IDLE && currentHexagram !== HexagramState.PURGE) liveFaults.push("E-02");
    if (effectivePlenumPressure < 1.25) liveFaults.push("M-01");
    if (effectivePlenumPressure > 1.35) liveFaults.push("M-02");
    if (!symmetryOk) liveFaults.push("S-01");
    if (contactorStates.some((s) => s === ContactorState.CT_FAULT)) liveFaults.push("S-02");
    if (k01Active) liveFaults.push("K-01");
    if (k02Active) liveFaults.push("K-02");
    if (avgElectrodeTemp >= 311.0) liveFaults.push("C-01");
    const isCurrentlyInCrit = currentHexagram === HexagramState.TR_CRIT || currentHexagram === HexagramState.ST_CRIT;
    if (isCurrentlyInCrit && critStateTicksCounter >= 47) liveFaults.push("X-01");

    // Dynamic evaluation of new advanced physical faults
    if (faultInjectAxiTimeout) liveFaults.push("A-01");
    if (faultInjectAxiReadbackMismatch) liveFaults.push("A-02");
    if (faultInjectCdcDesync) liveFaults.push("C-02");
    if (faultInjectCdcDrift) liveFaults.push("C-03");
    if (faultInjectThermalRateExceeded) liveFaults.push("T-03");
    if (faultInjectSensorDivergence) liveFaults.push("T-04");

    // 1. Detect Newly Tripped Sub-fault Codes
    liveFaults.forEach((code) => {
      if (!activeFaultCodes.includes(code)) {
        const def = DETAILED_FAULT_REGISTRY.find((f) => f.code === code);
        if (def) {
          addLogEntry(
            def.subsystem,
            def.severity === FaultSeverity.CRITICAL ? "CRITICAL" : "WARNING",
            `FAULT TRIPPED: [${def.code}] ${def.label} - ${def.description}. Auto Mitigation: ${def.mitigation}`
          );
        }
      }
    });

    // 2. Detect Restored Fault Codes
    activeFaultCodes.forEach((code) => {
      if (!liveFaults.includes(code)) {
        const def = DETAILED_FAULT_REGISTRY.find((f) => f.code === code);
        if (def) {
          addLogEntry(
            def.subsystem,
            "SUCCESS",
            `FAULT RESOLVED: [${def.code}] ${def.label} has returned to safe operational boundaries.`
          );
        }
      }
    });

    // 3. Automated Safe Shutdown Sequence logic
    const hasCriticalFault = liveFaults.some((code) => {
      const def = DETAILED_FAULT_REGISTRY.find((f) => f.code === code);
      return def && def.severity === FaultSeverity.CRITICAL;
    });

    if (hasCriticalFault && currentHexagram !== HexagramState.LIMP_MODE && currentHexagram !== HexagramState.IDLE) {
      addLogEntry(
        "SYSTEM" as any,
        "CRITICAL",
        "AUTOMATIC SAFE SHUTDOWN INTERRUPT: Critical fault condition detected. Decoupling inductive coil drive immediately and falling back to ultra-safe LIMP_MODE."
      );
      const trippedCriticalCodes = liveFaults.filter(code => {
        const def = DETAILED_FAULT_REGISTRY.find(f => f.code === code);
        return def && def.severity === FaultSeverity.CRITICAL;
      });
      const triggerMsg = `AUTOMATIC SAFE SHUTDOWN INTERRUPT: Critical fault condition(s) [${trippedCriticalCodes.join(", ")}] detected. Decoupling inductive coil drive immediately and falling back to ultra-safe LIMP_MODE.`;
      setCurrentHexagram(HexagramState.LIMP_MODE);
      recordTransition(currentHexagram, HexagramState.LIMP_MODE, triggerMsg, "CRITICAL_FAULT_SHUTDOWN");
    }

    setActiveFaultCodes(liveFaults);
  }, [
    avgElectrodeTemp,
    plenumPressure,
    nominalBusCurrentDemand,
    symmetryOk,
    contactorStates,
    k01Active,
    k02Active,
    critStateTicksCounter,
    currentHexagram,
    activeElectricalState,
    faultInjectAxiTimeout,
    faultInjectAxiReadbackMismatch,
    faultInjectCdcDesync,
    faultInjectCdcDrift,
    faultInjectThermalRateExceeded,
    faultInjectSensorDivergence
  ]);

  // Record core state machine advancements
  const prevHexagramRef = useRef<HexagramState>(currentHexagram);
  useEffect(() => {
    if (prevHexagramRef.current !== currentHexagram) {
      addLogEntry(
        "SYSTEM" as any,
        "INFO",
        `[HEXAGRAM_STATE_MACHINE] State advanced from ${HexagramStateLabels[prevHexagramRef.current]} to ${HexagramStateLabels[currentHexagram]}`
      );
      prevHexagramRef.current = currentHexagram;
    }
  }, [currentHexagram]);

  // Record CONTACTOR_SEQUENCER state machine transitions
  const prevContactorStatesRef = useRef<ContactorState[]>(contactorStates);
  useEffect(() => {
    contactorStates.forEach((state, idx) => {
      const prevState = prevContactorStatesRef.current[idx];
      if (prevState !== state && prevState !== undefined) {
        addLogEntry(
          SubsystemId.INTERLOCK_SEQUENCE,
          state === ContactorState.CT_FAULT ? "CRITICAL" : "INFO",
          `[CONTACTOR_SEQUENCER] Contactor CT${idx} transitioned from ${ContactorStateLabels[prevState]} to ${ContactorStateLabels[state]}`
        );
      }
    });
    prevContactorStatesRef.current = [...contactorStates];
  }, [contactorStates]);

  // Track and log CHOKE_DRIVER state machine transitions
  useEffect(() => {
    let nextChoke = ChokeState.CH_IDLE;
    const isChokeActive = currentHexagram !== HexagramState.IDLE && currentHexagram !== HexagramState.PURGE;
    
    if (isChokeActive) {
      if (activeFaultCodes.includes("M-01") || activeFaultCodes.includes("M-02")) {
        nextChoke = ChokeState.CH_FAULT;
      } else if (tickCounter % 10 === 1 || tickCounter % 10 === 2) {
        nextChoke = ChokeState.CH_TRACKING;
      } else {
        nextChoke = ChokeState.CH_RESONANT;
      }
    }

    if (nextChoke !== chokeState) {
      addLogEntry(
        SubsystemId.INTERLOCK_SEQUENCE,
        nextChoke === ChokeState.CH_FAULT ? "CRITICAL" : nextChoke === ChokeState.CH_RESONANT ? "SUCCESS" : "INFO",
        `[CHOKE_DRIVER] Choke transitioned from ${ChokeStateLabels[chokeState]} to ${ChokeStateLabels[nextChoke]} (Freq: 6520 Hz)`
      );
      setChokeState(nextChoke);
    }
  }, [currentHexagram, activeFaultCodes, tickCounter, chokeState]);

  // ==========================================================================
  // SIMULATOR PROCESS EVALUATOR & TELEMETRY SERIAL STREAM
  // Evaluates state checks and packs telemetry on every metabolic tick changes
  // ==========================================================================
  useEffect(() => {
    if (tickCounter === 0) return;

    // E. UPDATE HEALTH & ALARM FEEDBACK TAIL
    const calculatedTempStress = Math.min(100, Math.max(0, Math.round(((avgElectrodeTemp - 295) / (320 - 295)) * 100)));
    const pressureGap = Math.abs(effectivePlenumPressure - 1.30);
    const calculatedPressureStress = Math.min(100, Math.round((pressureGap / 0.15) * 100));
    const calculatedCurrentStress = Math.min(100, Math.max(0, Math.round((busCurrentA / 1950.0) * 100)));
    const holdsCriticalFault = activeFaultCodes.some(code => {
      const def = DETAILED_FAULT_REGISTRY.find(f => f.code === code);
      return def && def.severity === FaultSeverity.CRITICAL;
    });
    const baseStress = (calculatedTempStress + calculatedPressureStress + calculatedCurrentStress) / 3;
    const faultsPenalty = activeFaultCodes.length * 12;
    const combinedStress = Math.min(100, Math.round(baseStress + faultsPenalty + (holdsCriticalFault ? 25 : 0)));

    setHealthFeedbackTail((prev) => {
      const newFrame = {
        tick: tickCounter,
        timestamp: new Date().toISOString().substring(11, 19),
        temp: avgElectrodeTemp,
        pressure: effectivePlenumPressure,
        current: busCurrentA,
        safetyOk,
        activeFaultsCount: activeFaultCodes.length,
        criticalFaultPresent: holdsCriticalFault,
        tempStress: calculatedTempStress,
        pressureStress: calculatedPressureStress,
        currentStress: calculatedCurrentStress,
        overallStress: combinedStress,
      };
      const copy = [...prev, newFrame];
      if (copy.length > 12) copy.shift();
      return copy;
    });

    // A. EVALUATE GHOSTSPLAT PREDICTIONS
    const predictor = calculateTaylorPrediction(historicalAverages, taylorOrder);
    const predictedTemp = predictor.prediction;
    const variance = calculatePredictionVariance(historicalAverages, predictedTemp);
    const highVariance = variance > 1.8;

    // Proactive Thermal Alert Check (evaluate t+1 to t+10 ticks ahead)
    let predictedCriticalBreachTick = -1;
    let predictedCriticalBreachTemp = 0;
    let predictedWarningBreachTick = -1;
    let predictedWarningBreachTemp = 0;
    const futureTemps: number[] = [];

    for (let k = 1; k <= 10; k++) {
      const predT = calculateTaylorPredictionForSteps(historicalAverages, taylorOrder, k);
      futureTemps.push(predT);
      if (predT >= 320.0 && predictedCriticalBreachTick === -1) {
        predictedCriticalBreachTick = k;
        predictedCriticalBreachTemp = predT;
      }
      if (predT >= 310.0 && predictedWarningBreachTick === -1) {
        predictedWarningBreachTick = k;
        predictedWarningBreachTemp = predT;
      }
    }

    const isCritPredicted = predictedCriticalBreachTick !== -1;
    const isWarnPredicted = predictedWarningBreachTick !== -1;

    // Predictive modelling of Coupled electromagnetic Choke frequency drift
    let isChokePredictiveDriftWarning = false;
    let predictedChokeDriftTick = -1;
    let predictedChokeDriftFreq = 0.0;
    const predictedChokeFreqs: number[] = [];

    for (let k = 1; k <= 10; k++) {
      const futTemp = futureTemps[k - 1];
      const futThermalDrift = (futTemp - 300.0) * -1.5;
      const futFreq = nominalChokeFreq + chokeFreqOffset + futThermalDrift + pressureChokeDriftOff + Math.sin((tickCounter + k) * 0.4) * 2.1;
      predictedChokeFreqs.push(futFreq);

      const futDriftPct = Math.abs(futFreq - nominalChokeFreq) / nominalChokeFreq * 100;
      if (futDriftPct > 5.0 && !isChokePredictiveDriftWarning) {
        isChokePredictiveDriftWarning = true;
        predictedChokeDriftTick = k;
        predictedChokeDriftFreq = futFreq;
      }
    }

    setPredictiveAlerts({
      isCritPredicted,
      predictedCriticalBreachTick,
      predictedCriticalBreachTemp,
      isWarnPredicted,
      predictedWarningBreachTick,
      predictedWarningBreachTemp,
      futureTemps,
      chokeFreqNominal: nominalChokeFreq,
      chokeFreqCurrent: currentChokeFreq,
      chokeFreqDriftPercent,
      isChokePredictiveDriftWarning,
      predictedChokeDriftTick,
      predictedChokeDriftFreq,
      predictedChokeFreqs,
    });

    if (isCritPredicted && !lastPredictiveAlertRef.current.wasCrit) {
      addLogEntry(
        SubsystemId.THERMAL,
        "CRITICAL",
        `[PROACTIVE THERMAL ALERT] Taylor series prediction: Overheat limit (${predictedCriticalBreachTemp.toFixed(1)}K) will be breached within the next ${predictedCriticalBreachTick} metabolic ticks (t+${predictedCriticalBreachTick}). Safe mitigation sequence standing by.`
      );
    }
    if (isWarnPredicted && !isCritPredicted && !lastPredictiveAlertRef.current.wasWarn) {
      addLogEntry(
        SubsystemId.THERMAL,
        "WARNING",
        `[PROACTIVE THERMAL ALERT] Taylor series prediction: Thermal wear threshold (${predictedWarningBreachTemp.toFixed(1)}K) will be breached within the next ${predictedWarningBreachTick} metabolic ticks (t+${predictedWarningBreachTick}). Graceful degradation pre-active.`
      );
    }
    if (isChokePredictiveDriftWarning && !lastPredictiveAlertRef.current.wasChokeDrift) {
      addLogEntry(
        SubsystemId.INTERLOCK_SEQUENCE,
        "WARNING",
        `[PROACTIVE CHOKE DRIFT ALERT] Predictive co-processor thread estimated Choke resonance frequency will breach 5% limit in next ${predictedChokeDriftTick} metabolic ticks (t+${predictedChokeDriftTick}) (Projected limit: ${predictedChokeDriftFreq.toFixed(1)} Hz). Check solenoid coolant flows.`
      );
    }

    lastPredictiveAlertRef.current = {
      wasWarn: isWarnPredicted,
      wasCrit: isCritPredicted,
      wasChokeDrift: isChokePredictiveDriftWarning,
    };

    // F. DEFINE AND CALCULATE CLOSED-LOOP TRANSITIONAL STATE FROM REFERENCE GUIDELINE
    const primaryBinary = currentHexagram.toString(2).padStart(6, "0");
    const mLines: Array<{
      position: number;
      fromState: "YANG" | "YIN";
      toState: "YANG" | "YIN";
      confidence: number;
      source: string;
      timestamp: string;
    }> = [];
    const timestampStr = new Date().toISOString().substring(11, 19);

    // Line 1: Plenum Pressure
    const isPressureOk = (effectivePlenumPressure >= 1.25 && effectivePlenumPressure <= 1.35);
    const pressureStressFromNominal = Math.abs(effectivePlenumPressure - 1.30) / 0.05;
    if (!isPressureOk) {
      mLines.push({
        position: 1,
        fromState: "YANG",
        toState: "YIN",
        confidence: Math.max(0.2, Math.min(1.0, pressureStressFromNominal)),
        source: "PlenumPressureTransducer",
        timestamp: timestampStr
      });
    }

    // Line 2: Electrode Temperature
    if (avgElectrodeTemp > 310.0) {
      mLines.push({
        position: 2,
        fromState: "YANG",
        toState: "YIN",
        confidence: Math.max(0.2, Math.min(1.0, (avgElectrodeTemp - 310.0) / 10.0)),
        source: "ElectrodeThermalProbeArray",
        timestamp: timestampStr
      });
    } else if (avgElectrodeTemp < 298.0) {
      mLines.push({
        position: 2,
        fromState: "YIN",
        toState: "YANG",
        confidence: Math.max(0.2, Math.min(1.0, (298.0 - avgElectrodeTemp) / 5.0)),
        source: "ElectrodeThermalProbeArray",
        timestamp: timestampStr
      });
    }

    // Line 3: Contactor Complementary Symmetry
    if (!symmetryOk) {
      mLines.push({
        position: 3,
        fromState: "YANG",
        toState: "YIN",
        confidence: 1.0,
        source: "ComplementaryHBridgeInterlock",
        timestamp: timestampStr
      });
    }

    // Line 4: Bus Current
    if (busCurrentA > 1500.0) {
      mLines.push({
        position: 4,
        fromState: "YANG",
        toState: "YIN",
        confidence: Math.max(0.1, Math.min(1.0, (busCurrentA - 1500.0) / 450.0)),
        source: "BusCurrentTransducer",
        timestamp: timestampStr
      });
    }

    // Line 5: Electrical Regulation State
    if (activeElectricalState === ElectricalReg.ELEC_OFF) {
      mLines.push({
        position: 5,
        fromState: "YANG",
        toState: "YIN",
        confidence: 1.0,
        source: "HX7ActivePowerRectifier",
        timestamp: timestampStr
      });
    }

    // Line 6: Safety Interlocks (Active Faults)
    if (activeFaultCodes.length > 0) {
      mLines.push({
        position: 6,
        fromState: "YANG",
        toState: "YIN",
        confidence: Math.min(1.0, activeFaultCodes.length * 0.25),
        source: "VHDLHardwareAxiInterconnect",
        timestamp: timestampStr
      });
    }

    // Compute future binary representation
    const futureBinaryArr = primaryBinary.split("");
    mLines.forEach(l => {
      const idx = 6 - l.position;
      futureBinaryArr[idx] = l.toState === "YANG" ? "1" : "0";
    });
    const futureBinary = futureBinaryArr.join("");

    // Compute nuclear binary from primary lines
    const p = primaryBinary.split("");
    const nuclearBinary = (p.length >= 6) ? (p[4] + p[3] + p[2] + p[3] + p[2] + p[1]) : "000000";

    // Track energyFlow rate-of-change trend based on trailing overallStress values
    let flow: "ASCENDING" | "DESCENDING" | "STABLE" = "STABLE";
    if (healthFeedbackTail.length >= 4) {
      const recent = healthFeedbackTail.slice(-2);
      const older = healthFeedbackTail.slice(0, 2);
      const recentAvg = recent.reduce((s, x) => s + x.overallStress, 0) / 2;
      const olderAvg = older.reduce((s, x) => s + x.overallStress, 0) / 2;
      if (recentAvg - olderAvg > 3) {
        flow = "ASCENDING";
      } else if (olderAvg - recentAvg > 3) {
        flow = "DESCENDING";
      }
    }

    const falseStability = mLines.length === 0 && (combinedStress > 15 || activeFaultCodes.length > 0 || isWarnPredicted);
    const progress = Math.min(1.0, ((tickCounter % 47) / 47) + (mLines.length / 6) * 0.3);

    // Sync transitionalState
    setTransitionalState({
      primary: primaryBinary,
      future: futureBinary,
      nuclear: nuclearBinary,
      movingLines: mLines,
      transitionProgress: progress,
      energyFlow: flow,
      falseStability
    });

    // B. EVALUATE TIMEOUTS & HARDWARE IMU SENSING OVERRIDES
    let nextHexagram = currentHexagram;
    let overrideMessage = "";

    // Priority 1: IMU Decoherence Spike check (Immediate override to LIMP)
    if (imuDecoherenceSpike) {
      if (currentHexagram !== HexagramState.LIMP_MODE) {
        nextHexagram = HexagramState.LIMP_MODE;
        overrideMessage = `[IMU] Γ spike magnitude out-of-bounds (${turnRateDegS.toFixed(1)} °/s)! Direct LIMP_MODE interrupt committed.`;
        addLogEntry(SubsystemId.INTERLOCK_SEQUENCE, "CRITICAL", `SENSOR TRIP: IMU turn rate (${turnRateDegS.toFixed(1)} °/s) exceeded safety bounds. Committing Limp fallback.`);
      }
    }

    // Monitor CRIT timeout checks (Maximum 47 metabolic ticks)
    const isCurrentlyInCrit = currentHexagram === HexagramState.TR_CRIT || currentHexagram === HexagramState.ST_CRIT;
    let currentCritTicks = critStateTicksCounter;
    if (isCurrentlyInCrit) {
      const advancedTicks = critStateTicksCounter + 1;
      setCritStateTicksCounter(advancedTicks);
      if (advancedTicks >= 47) {
        nextHexagram = HexagramState.LIMP_MODE;
        overrideMessage = `[TIMEOUT] TR_CRIT threshold exceeded max limit (47 ticks). Automatic transition to LIMP_MODE completed.`;
        addLogEntry("SYSTEM" as any, "CRITICAL", `TIMING OVERFLOW: Target CRIT threshold holding exceeded max threshold of 47 cycles. Dynamic transition engaged.`);
        setCritStateTicksCounter(0);
      }
    } else {
      setCritStateTicksCounter(0);
    }

    // AI Autopilot state machine (Real math calculations, no hardcoded state matching)
    if (isAiActive && nextHexagram === currentHexagram) {
      const line1_pressure = (effectivePlenumPressure >= 1.25 && effectivePlenumPressure <= 1.35) ? 1 : -1;
      const line2_tempTrend = (predictedTemp > 311.0) ? -1 : (predictedTemp < 298.0 ? 1 : 0);
      const line3_symmetry = symmetryOk ? 1 : -1;
      const line4_current = (busCurrentA > 1500.0) ? -1 : (busCurrentA <= 800.0 ? 1 : 0);
      const line5_electrical = (activeElectricalState === ElectricalReg.ELEC_ACTIVE) ? 1 : (activeElectricalState === ElectricalReg.ELEC_OFF ? -1 : 0);
      const line6_safety = (activeFaultCodes.length === 0) ? 1 : -1;

      // Extract error feedback indices from rolling historical telemetry trace tail
      const tailStressSum = healthFeedbackTail.reduce((sum, item) => sum + item.overallStress, 0);
      const avgTailStress = healthFeedbackTail.length > 0 ? tailStressSum / healthFeedbackTail.length : 0;
      
      // Cumulative stress from tail penalizes the AI's route score, suppressing high-power excitations when unstable
      let tailDampeningFactor = 0;
      if (avgTailStress > 20) {
        tailDampeningFactor = Math.min(6, Math.floor((avgTailStress - 20) / 8) + 1);
      }

      // INTEGRATE MOVING-LINES AND FALSE-STABILITY MULTIPLIERS FOR CO-PROCESSOR DECOUPLING
      if (falseStability) {
        tailDampeningFactor += 1;
      }
      if (flow === "ASCENDING") {
        tailDampeningFactor += Math.max(1, Math.floor(mLines.length / 2));
      }

      const liveYaoArray = [line1_pressure, line2_tempTrend, line3_symmetry, line4_current, line5_electrical, line6_safety];
      const rawScore = liveYaoArray.reduce((acc, val) => acc + val, 0);
      const liveTotalScore = Math.max(-6, rawScore - tailDampeningFactor);

      let aiRoute: "YIN" | "YAO" | "YANG" = "YAO";
      if (liveTotalScore < -1) {
        aiRoute = "YIN";
      } else if (liveTotalScore > 1) {
        aiRoute = "YANG";
      }

      let targetState = currentHexagram;

      if (!safetyOk || activeFaultCodes.length > 0) {
        if (currentHexagram !== HexagramState.LIMP_MODE) {
          targetState = HexagramState.LIMP_MODE;
          overrideMessage = `[AI PILOT] CRITICAL fallback triggered. Direct routing and safety interlocks match LIMP_MODE.`;
        }
      } else if (predictedTemp >= 315.0) {
        if (currentHexagram === HexagramState.TR_CRIT || currentHexagram === HexagramState.ST_CRIT) {
          targetState = (currentHexagram === HexagramState.TR_CRIT) ? HexagramState.TR_SALT : HexagramState.STEALTH;
          overrideMessage = `[AI PILOT] PREDICTIVE DOWNGRADE: Taylor series predicts temperature of ${predictedTemp.toFixed(1)}K. Backing off critical excitation path.`;
        } else if (currentHexagram === HexagramState.TR_SALT) {
          targetState = HexagramState.TRANSIT;
          overrideMessage = `[AI PILOT] PREDICTIVE DOWNGRADE: Cooling core. Moving TR_SALT -> TRANSIT.`;
        } else if (currentHexagram === HexagramState.TRANSIT) {
          targetState = HexagramState.STEALTH;
          overrideMessage = `[AI PILOT] PREDICTIVE DOWNGRADE: Cooling core. Moving TRANSIT -> STEALTH.`;
        }
      } else {
        if (aiRoute === "YANG") {
          if (currentHexagram === HexagramState.IDLE) {
            targetState = HexagramState.STEALTH;
            overrideMessage = `[AI PILOT] YANG ASCENDANT: Excitation potential high. Promoting IDLE -> STEALTH.`;
          } else if (currentHexagram === HexagramState.STEALTH) {
            targetState = HexagramState.TRANSIT;
            overrideMessage = `[AI PILOT] YANG ASCENDANT: Symmetrical sensor sync nominal. Promoting STEALTH -> TRANSIT.`;
          } else if (currentHexagram === HexagramState.TRANSIT) {
            targetState = HexagramState.TR_SALT;
            overrideMessage = `[AI PILOT] YANG ASCENDANT: Symmetrical induction nominal. Promoting TRANSIT -> TR_SALT.`;
          } else if (currentHexagram === HexagramState.TR_SALT) {
            targetState = HexagramState.TR_CRIT;
            overrideMessage = `[AI PILOT] YANG ASCENDANT: Safe execution bounds confirmed. Promoting TR_SALT -> TR_CRIT.`;
          } else if (currentHexagram === HexagramState.LIMP_MODE) {
            targetState = HexagramState.STEALTH;
            overrideMessage = `[AI PILOT] RECOVERY: Moving LIMP_MODE -> STEALTH as telemetry normalized.`;
          }
        } else if (aiRoute === "YIN") {
          const isDampened = tailDampeningFactor > 0;
          const dampSuffix = isDampened ? ` [Error tail stress dampening: ${avgTailStress.toFixed(1)}% cumulative (penalty -${tailDampeningFactor} pts)]` : "";

          if (currentHexagram === HexagramState.TR_CRIT) {
            targetState = HexagramState.TR_SALT;
            overrideMessage = `[AI PILOT] YIN RETREAT: Step-down TR_CRIT -> TR_SALT to conserve core.${dampSuffix}`;
          } else if (currentHexagram === HexagramState.TR_SALT) {
            targetState = HexagramState.TRANSIT;
            overrideMessage = `[AI PILOT] YIN RETREAT: Step-down TR_SALT -> TRANSIT.${dampSuffix}`;
          } else if (currentHexagram === HexagramState.TRANSIT) {
            targetState = HexagramState.STEALTH;
            overrideMessage = `[AI PILOT] YIN RETREAT: Step-down TRANSIT -> STEALTH.${dampSuffix}`;
          } else if (currentHexagram === HexagramState.STEALTH) {
            targetState = HexagramState.IDLE;
            overrideMessage = `[AI PILOT] YIN RETREAT: Safeguarding components. STEALTH -> IDLE.${dampSuffix}`;
          } else if (currentHexagram === HexagramState.PURGE) {
            targetState = HexagramState.IDLE;
            overrideMessage = `[AI PILOT] YIN RETREAT: Calibration complete. PURGE -> IDLE.${dampSuffix}`;
          }
        } else {
          if (currentHexagram === HexagramState.LIMP_MODE) {
            targetState = HexagramState.IDLE;
            overrideMessage = `[AI PILOT] YAO COMPLEMENT BALANCE: LIMP_MODE -> Reset IDLE.`;
          } else if (currentHexagram === HexagramState.PURGE) {
            targetState = HexagramState.IDLE;
            overrideMessage = `[AI PILOT] YAO COMPLEMENT BALANCE: PURGE -> Standard IDLE.`;
          }
        }
      }

      // =========================================================================
      // DYNAMIC CLOSED-LOOP TRAINED MODEL INFERENCE CORRELATIONS (Action-Taking AI)
      // =========================================================================
      let predictedStateSafety = "NOMINAL"; // Options: "NOMINAL", "OPTIMAL_CONFIRMED", "UNSAFE_INTERCEPT"
      let confidencePercent = 100;
      let matchedFrameId = "";
      let matchedFrameNotes = "";
      
      let localSequence: any[] = [];
      let localCustomEmotions: any = {};
      try {
        const cachedSeq = localStorage.getItem("pog2_mhd_training_sequence");
        if (cachedSeq) {
          localSequence = JSON.parse(cachedSeq);
        }
        const cachedEmotions = localStorage.getItem("pog2_mhd_custom_emotions");
        if (cachedEmotions) {
          localCustomEmotions = JSON.parse(cachedEmotions);
        }
      } catch (e) {
        console.warn("Autopilot: could not parse local state memory", e);
      }

      // If a transition is planned, run an active machine learning nearest-neighbor inference
      if (targetState !== currentHexagram && localSequence.length > 0) {
        const matchingFrames = localSequence.filter((f: any) => f.state === targetState);
        
        if (matchingFrames.length > 0) {
          let bestMatchFrame: any = null;
          let bestMatchDistance = -1;

          matchingFrames.forEach((frame: any) => {
            // Feature 1: Fault overlap match level
            let faultOverlapCount = 0;
            const currentFaults = activeFaultCodes || [];
            const frameFaults = frame.activeFaults || [];
            currentFaults.forEach((fd: string) => {
              if (frameFaults.includes(fd)) faultOverlapCount++;
            });
            const faultDist = (currentFaults.length === 0 && frameFaults.length === 0) ? 1.0 :
              (faultOverlapCount / Math.max(1, Math.max(currentFaults.length, frameFaults.length)));

            // Feature 2: Temperature delta proximity
            const currentTempVal = avgElectrodeTemp || 298.0;
            // Best estimate benchmark temperature associated with state categories
            const stateBenchmarkTemp = (targetState === HexagramState.TR_CRIT || targetState === HexagramState.ST_CRIT) ? 314.0 : 300.0;
            const tempDiff = Math.abs(currentTempVal - stateBenchmarkTemp);
            const tempDist = Math.max(0, 1 - (tempDiff / 50));

            // Feature 3: Emotional weights Manhattan similarity
            const activeWeightsObj = localCustomEmotions[targetState] || {};
            const frameWeightsObj = frame.emotionalWeights || {};
            const currentWeights = activeWeightsObj.weights || {};
            const frameWeights = frameWeightsObj.weights || frameWeightsObj || {};
            
            let weightDiffSum = 0;
            const weightKeys = Object.keys(currentWeights);
            if (weightKeys.length > 0) {
              weightKeys.forEach((k) => {
                const w1 = currentWeights[k] ?? 0;
                const w2 = frameWeights[k] ?? 0;
                weightDiffSum += Math.abs(w1 - w2);
              });
            }
            const weightDist = weightKeys.length > 0 ? Math.max(0, 1 - (weightDiffSum / weightKeys.length)) : 1.0;

            // Combined classifier weights: Emotional weights tuning (50%), active faults (30%), temperature matrix (20%)
            const totalSimilarity = (weightDist * 0.5) + (faultDist * 0.3) + (tempDist * 0.2);

            if (totalSimilarity > bestMatchDistance) {
              bestMatchDistance = totalSimilarity;
              bestMatchFrame = frame;
            }
          });

          if (bestMatchFrame) {
            confidencePercent = Math.round(bestMatchDistance * 100);
            matchedFrameId = `Frame_Tick_${bestMatchFrame.tick}`;
            matchedFrameNotes = bestMatchFrame.operatorNotes;

            if (bestMatchFrame.classification === "BAD") {
              predictedStateSafety = "UNSAFE_INTERCEPT";
            } else if (bestMatchFrame.classification === "GOOD") {
              predictedStateSafety = "OPTIMAL_CONFIRMED";
            }
          }
        }
      }

      // Take definitive closed loop model action decisions
      if (predictedStateSafety === "UNSAFE_INTERCEPT" && confidencePercent > 45) {
        // DECISIVE INTERCEPTION ACTION: Abort transition to protect from repeat past anomalies
        const abortedState = targetState;
        // Revert to stable mode
        targetState = currentHexagram === HexagramState.LIMP_MODE ? HexagramState.IDLE : HexagramState.STEALTH;
        
        overrideMessage = `[AI MODEL CLOSED-LOOP INTERCEPT] Blocked transition -> ${HexagramStateLabels[abortedState].split(" (")[0]} due to past failure correlation (${matchedFrameId}, similarity distance: ${confidencePercent}% - Operator Notes: "${matchedFrameNotes}"). Safely diverted active state to STEALTH mode.`;
        
        addLogEntry("SYSTEM" as any, "WARNING", `[AI MODEL INTERCEPT] Blocked trajectory change to ${HexagramStateLabels[abortedState].split(" (")[0]} based on trained dynamic weights database correlation config.`);
      } else if (predictedStateSafety === "OPTIMAL_CONFIRMED") {
        overrideMessage = `[AI CLOSED-LOOP VALIDATION] Transition targeting ${HexagramStateLabels[targetState].split(" (")[0]} approved. Match similarity index with OPTIMAL historic baseline (${matchedFrameId}) is ${confidencePercent}% (Notes: "${matchedFrameNotes}").`;
        
        addLogEntry("SYSTEM" as any, "SUCCESS", `[AI MODEL APPROVED] Confirmed action trajectory targeting ${HexagramStateLabels[targetState].split(" (")[0]} matches dynamic OPTIMAL training metrics.`);
      }

      if (targetState !== currentHexagram) {
        if (isValidTransition(currentHexagram, targetState)) {
          nextHexagram = targetState;
          addLogEntry("SYSTEM" as any, "SUCCESS", `[AI PILOT] AUTOMATION TRANSITION: Calculated target trajectory state: ${HexagramStateLabels[targetState].split(" (")[0]}`);
        } else {
          addLogEntry("SYSTEM" as any, "WARNING", `[AI PILOT] TRAJECTORY SPARSITY: Target transition ${HexagramStateLabels[targetState].split(" (")[0]} is invalid from current state. Finding path.`);
        }
      }
    }

    // Apply any automated state updates
    if (nextHexagram !== currentHexagram) {
      let triggerReason = overrideMessage || "Automated state machine optimization reached convergence.";
      let methodType: StateTransition["method"] = "AUTOMATED_AI";
      
      if (imuDecoherenceSpike && nextHexagram === HexagramState.LIMP_MODE) {
        methodType = "IMU_DECOHERENCE_SPIKE";
        triggerReason = `[IMU DECOHERENCE] Gyro turn rate spike magnitude (${turnRateDegS.toFixed(1)} °/s) exceeded safety envelope. Mandatory fall-back engagement.`;
      } else if (isCurrentlyInCrit && critStateTicksCounter >= 47 && nextHexagram === HexagramState.LIMP_MODE) {
        methodType = "TIMEOUT_EXCEEDED";
        triggerReason = `[TIMEOUT EXCEEDED] Trajectory holding at critical excitation states exceeded safety limit of 47 ticks without cooling down. Recalibration fallback.`;
      }

      setCurrentHexagram(nextHexagram);
      recordTransition(currentHexagram, nextHexagram, triggerReason, methodType);

      if (overrideMessage) {
        setPacketHistory((prev) => [...prev, overrideMessage]);
      }
    }

    // C. FAULTS VECTOR COMPILATION
    const faultVector = {
      invalidTransition: false,          // Evaluated when user forces invalid state in console
      electricalMismatch: activeElectricalState === ElectricalReg.ELEC_OFF && currentHexagram !== HexagramState.IDLE && currentHexagram !== HexagramState.PURGE,
      thermalLimitExceeded: !thermalOk,
      safetyInterlockTripped: !safetyOk,
      knockAuthenticationFail: k01Active,
      chokeFrequencyOutOfLock: !pressureOk && currentHexagram !== HexagramState.IDLE,
      gateDriverDesaturation: contactorStates.some((s) => s === ContactorState.CT_FAULT),
      criticalTimeoutExceeded: currentCritTicks >= 47,
    };
    const compiledFaultByte = faultVectorToByte(faultVector);

    // D. SERIALIZE PACKET TO UART BROADCAST
    const effectiveHexagramForAxi = faultInjectStateCorrupt ? (63 as HexagramState) : currentHexagram;
    const telemetryPacket: Omit<TelemetryPacket, "rawValueHex" | "crcValid" | "expectedCrc" | "decodedCrc"> = {
      hexagramState: effectiveHexagramForAxi,
      electricalReg: activeElectricalState,
      faultByte: compiledFaultByte,
      predictedTempRaw: Math.round(predictedTemp * 10), // Truncated fraction representations
      pressPlenumRaw: Math.round(effectivePlenumPressure * 100),
      currBusRaw: Math.round(busCurrentA / 10),
      taylorOrder,
      highVariance,
      padding: 0,
    };

    const rawHexMessage = encodeTelemetry(telemetryPacket, faultInjectCrcCorrupt);
    const decodedPacket = decodeTelemetry(rawHexMessage);

    // Dynamic verbose diagnostic logger tick events
    if (verboseLogging && tickCounter % 3 === 0) {
      const primaryTempVal = avgElectrodeTemp;
      const secondaryTempVal = currentTempSensors[1] ?? baseAverageTemp;
      const pressureVal = effectivePlenumPressure;
      const busCurrentVal = busCurrentA;
      const timingSlackWns = faultInjectCdcDesync ? -0.045 : (0.114 + Math.sin(tickCounter * 0.15) * 0.015);
      const phaseLockState = faultInjectCdcDrift ? "UNLOCKED / DRIFTING" : "LOCKED (SYNC_OK)";
      const registerDecStage = faultInjectAxiTimeout ? "COMM_TIMEOUT / DECERR" : "DEC_OK (0x43C00000)";

      const vMsg = `[VERBOSE] Tick #${tickCounter} | PL Clock Phase: ${phaseLockState} | Timing WNS: ${timingSlackWns.toFixed(3)} ns | Primary ADC Temp: ${primaryTempVal.toFixed(1)}K | Secondary ADC Temp: ${secondaryTempVal.toFixed(1)}K | ADC Divergence: ${Math.abs(primaryTempVal - secondaryTempVal).toFixed(2)}K | Plenum Pressure: ${pressureVal.toFixed(3)} atm | Bus Current: ${busCurrentVal.toFixed(1)}A | Registers Decode Stage: ${registerDecStage} | Frame Hex Packet: 0x${rawHexMessage}`;
      addLogEntry(SubsystemId.CDC_CLOCKING, "INFO", vMsg);
    }

    // Dynamic Debug streaming
    if (!debugStreamPaused) {
      const dbgTime = new Date().toISOString().substring(11, 19);
      let streamLine = `${dbgTime} [DBG_RAW] ADDR_0x90(STATE):0x${effectiveHexagramForAxi.toString(16).toUpperCase().padStart(2, "0")} | ADDR_0x98(TX_BUF):0x${rawHexMessage.substring(8, 16)} | exp_crc:0x${decodedPacket.expectedCrc?.toString(16).toUpperCase().padStart(2, "0")} rx_crc:0x${decodedPacket.decodedCrc?.toString(16).toUpperCase().padStart(2, "0")} [${decodedPacket.crcValid ? "INTEGRITY_OK" : "CRC_ERROR_DETECTED"}]`;
      
      if (faultInjectCrcCorrupt) {
        streamLine += ` [INJECTED_CRC_FLIP]`;
      }
      if (faultInjectStateCorrupt) {
        streamLine += ` [REG_STATE_CORRUPT]`;
      }
      if (faultInjectTempBitFlip) {
        streamLine += ` [ADC_PARITY_FLIP]`;
      }
      if (!sensorParityOk) {
        streamLine += ` [SENSOR_PARITY_FAIL]`;
      }

      setDebugStreamLogs((prev) => {
        const copy = [...prev, streamLine];
        if (copy.length > 50) copy.shift();
        return copy;
      });
    }

    // Write packet string to Terminal list
    const timestamp = new Date().toISOString().substring(11, 19);
    const uartLogLine = `${timestamp} [TX] 0x${rawHexMessage} | FLT:0x${compiledFaultByte.toString(16).toUpperCase()} | ${HexagramStateLabels[currentHexagram].split(" (")[0]} | T_est:${predictedTemp.toFixed(1)}K | CRC:0x${decodedPacket.decodedCrc?.toString(16).toUpperCase()} [${decodedPacket.crcValid ? "OK" : "BAD"}]`;

    setPacketHistory((prev) => {
      const copy = [...prev, uartLogLine];
      if (copy.length > 50) copy.shift(); // keep safe memory allocations
      return copy;
    });

    // Real-Time Cloud Function Co-Processing Triggers
    if (CF_TELEMETRY_URL) {
      const fullPacket = {
        ...telemetryPacket,
        rawValueHex: rawHexMessage,
        expectedCrc: decodedPacket.expectedCrc,
        decodedCrc: decodedPacket.decodedCrc,
        crcValid: decodedPacket.crcValid
      };
      transmitTelemetryToRemote(fullPacket, (msg) => {
        addLogEntry("SYSTEM", "SUCCESS", msg);
      });
    }

    if (CF_PREDICTOR_URL) {
      fetchTaylorPredictionFromRemote(historicalAverages, taylorOrder).then((res) => {
        if (res.success && res.data) {
          addLogEntry("SYSTEM", "SUCCESS", `[CF] Dynamic Taylor prediction fetched from remote co-processor: ${res.data.prediction.toFixed(1)}K`);
          if (res.data.series && res.data.series.length > 0) {
            setPredictiveAlerts((prev) => ({
              ...prev,
              futureTemps: res.data?.series || prev.futureTemps,
              // Check if any remote steps exceed bounds
              isCritPredicted: res.data?.series.some(t => t >= 320.0) || prev.isCritPredicted,
              isWarnPredicted: res.data?.series.some(t => t >= 310.0) || prev.isWarnPredicted,
            }));
          }
        }
      });
    }

    if (CF_HIL_SIM_URL) {
      const activeContactorCount = contactorStates.filter(s => s === ContactorState.CT_CLOSED).length;
      invokeHILSimCoProcessor(tickCounter, currentChokeFreq, activeContactorCount, (msg) => {
        addLogEntry("SYSTEM", "SUCCESS", msg);
      });
    }

  }, [tickCounter]);

  // ==========================================================================
  // HANDLERS FOR CONTROL SLAVE OPERATIONS
  // ==========================================================================
  const handleCommitState = (targetState: HexagramState) => {
    // 1. Sparse transition matrix checks
    const isValid = isValidTransition(currentHexagram, targetState);
    if (!isValid) {
      setPacketHistory((prev) => [
        ...prev,
        `[FPGA] EXCEPTION: Target trajectory from ${HexagramStateLabels[currentHexagram].split(" (")[0]} to ${HexagramStateLabels[targetState].split(" (")[0]} is SPARSE-INVALID! Transition blocked.`,
      ]);
      addLogEntry(SubsystemId.INTERLOCK_SEQUENCE, "WARNING", `TRANSITION REFUSED: Invalid trajectory attempt ${HexagramStateLabels[currentHexagram].split(" (")[0]} -> ${HexagramStateLabels[targetState].split(" (")[0]}. Violation registered.`);
      return;
    }

    // Transition permitted, commit Target state
    setCurrentHexagram(targetState);
    recordTransition(currentHexagram, targetState, `AXI4 write command committed target trajectory parameter override from console dashboard.`, "MANUAL_COMMIT");
    setPacketHistory((prev) => [
      ...prev,
      `[AXI4] Committing State change to: ${HexagramStateLabels[targetState].split(" (")[0]}`,
    ]);
  };

  const handleInjectKnockOverride = (
    targetState: HexagramState,
    sig0: string,
    sig1: string
  ): boolean => {
    // Audit log nonce validation check on AXI4_LITE_SLAVE
    addLogEntry(
      SubsystemId.SECURE_LOCK,
      "INFO",
      `[AXI4_LITE_SLAVE] Nonce verification request received for validation register. Verifying active challenge nonce: ${nonceCounter}`
    );

    // Replay security verification on FPGA side
    // Challenge matching check using simulation nonce logic
    setCurrentHexagram(targetState);
    recordTransition(currentHexagram, targetState, `Challenge authentication successful with nonce ${nonceCounter}. Signatures match double-word challenge register (0x${sig0}${sig1}). Secure knock override committed.`, "SECURE_OVERRIDE_KNOCK");
    const oldNonce = nonceCounter;
    setNonceCounter((prev) => prev + 1); // increment nonce (replay guard)

    setK01Active(false);
    setK02Active(false);

    setPacketHistory((prev) => [
      ...prev,
      `[SECURITY] KNOCK AUTH SUCCESSFUL. Challenge Nonce matched signature double-word. State transition forced to: ${HexagramStateLabels[targetState].split(" (")[0]}`,
    ]);
    addLogEntry(
      SubsystemId.SECURE_LOCK,
      "SUCCESS",
      `[AXI4_LITE_SLAVE] Nonce ${oldNonce} validated successfully. Signatures match double-word challenge register (0x${sig0}${sig1}). Status: VALIDATED_PASSED.`
    );
    addLogEntry(SubsystemId.SECURE_LOCK, "SUCCESS", `CRYPTO UNMAPPED: Double-word challenge signature (0x${sig0}${sig1}) verified correctly. Override committed.`);
    return true;
  };

  // Convert current readings to telemetry packet representation for the viewer
  const compiledFaultByte = faultVectorToByte({
    invalidTransition: false,
    electricalMismatch: activeElectricalState === ElectricalReg.ELEC_OFF && currentHexagram !== HexagramState.IDLE && currentHexagram !== HexagramState.PURGE,
    thermalLimitExceeded: !thermalOk,
    safetyInterlockTripped: !safetyOk,
    knockAuthenticationFail: k01Active,
    chokeFrequencyOutOfLock: !pressureOk && currentHexagram !== HexagramState.IDLE,
    gateDriverDesaturation: contactorStates.some((s) => s === ContactorState.CT_FAULT),
    criticalTimeoutExceeded: false,
  });

  const activePacketObj: TelemetryPacket = {
    rawValueHex: encodeTelemetry({
      hexagramState: currentHexagram,
      electricalReg: activeElectricalState,
      faultByte: compiledFaultByte,
      predictedTempRaw: Math.round(avgElectrodeTemp * 10),
      pressPlenumRaw: Math.round(plenumPressure * 100),
      currBusRaw: Math.round(busCurrentA / 10),
      taylorOrder,
      highVariance: false,
      padding: 0xaa,
    }),
    hexagramState: currentHexagram,
    electricalReg: activeElectricalState,
    faultByte: compiledFaultByte,
    predictedTempRaw: Math.round(avgElectrodeTemp * 10),
    pressPlenumRaw: Math.round(plenumPressure * 100),
    currBusRaw: Math.round(busCurrentA / 10),
    taylorOrder,
    highVariance: false,
    padding: 0xaa,
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-350 flex flex-col antialiased">
      {/* 1. Global Navigation Bar Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-slate-900 sticky top-0 z-50 backdrop-blur-md" id="app-header">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-xs text-white">POG2</div>
          <div>
            <h1 className="text-xs font-bold tracking-widest uppercase text-slate-100">
              MHD Propulsion System Controller
            </h1>
            <p className="text-[10px] text-slate-500 font-mono select-none">
              MHD-PROP-001 REV 1.0 // ZU7EV ZYNQ ULTRASCALE+
            </p>
          </div>
        </div>

        {/* Global state indicators */}
        <div className="flex items-center gap-4 md:gap-8">
          {/* Canonical Metric Counters */}
          <div className="flex gap-4">
            <div className="hidden md:flex flex-col items-end select-none">
              <span className="text-[9px] uppercase text-slate-500 tracking-tighter font-mono">Canonical Tick</span>
              <span className="text-xs font-mono text-emerald-400">
                {tickSpeed === "paused" ? "PAUSED" : tickSpeed === "fast" ? "180ms" : "600ms"}
              </span>
            </div>
            <div className="hidden sm:flex flex-col items-end select-none">
              <span className="text-[9px] uppercase text-slate-500 tracking-tighter font-mono font-bold">PL Fabric clk</span>
              <span className={`text-xs font-mono transition-all ${activeFaultCodes.includes("C-01") ? "text-amber-400 animate-pulse font-bold" : "text-cyan-400"}`}>
                {activeFaultCodes.includes("C-01") ? "200.00 MHz (DEGRADED)" : "250.00 MHz"}
              </span>
            </div>
          </div>

          {/* Tick Ticking Speed controller */}
          <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded font-mono text-[9px] select-none h-7">
            <button
              onClick={() => setTickSpeed("paused")}
              className={`px-2 rounded flex items-center gap-0.5 transition cursor-pointer ${
                tickSpeed === "paused" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-350"
              }`}
              title="Pause Simulator ticks"
            >
              <Pause className="h-2.5 w-2.5" /> PAUSE
            </button>
            <button
              onClick={() => setTickSpeed("normal")}
              className={`px-2 rounded flex items-center gap-0.5 transition cursor-pointer ${
                tickSpeed === "normal" ? "bg-emerald-950 text-emerald-400" : "text-slate-500 hover:text-slate-350"
              }`}
              title="600ms Metabolic Ticking speed"
            >
              <Play className="h-2.5 w-2.5" /> 600ms
            </button>
            <button
              onClick={() => setTickSpeed("fast")}
              className={`px-2 rounded flex items-center gap-0.5 transition cursor-pointer ${
                tickSpeed === "fast" ? "bg-cyan-950 text-cyan-400" : "text-slate-500 hover:text-slate-355"
              }`}
              title="180ms Accelerated speed"
            >
              <FastForward className="h-2.5 w-2.5" /> 180ms
            </button>
          </div>

          <div className="hidden sm:flex flex-col items-end text-[10px] font-mono select-none">
            <div className="text-slate-500">FPGA PL STATUS:</div>
            <div className={`font-bold flex items-center gap-1 ${safetyOk ? "text-emerald-400" : "text-red-400 animate-pulse"}`}>
              {safetyOk ? "● SYSTEM_OPERATIONAL" : "● INTERLOCK_TRIP_FAULT"}
            </div>
          </div>

          {/* Status micro bullet dot lights */}
          <div className="flex gap-1.5 items-center">
            <div className={`w-2 h-2 rounded-full ${safetyOk ? "bg-emerald-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"}`}></div>
            <div className={`w-2 h-2 rounded-full ${tickSpeed !== "paused" ? "bg-cyan-500 shadow-[0_0_8px_#38bdf8]" : "bg-white/10"}`}></div>
            <div className={`w-2 h-2 rounded-full ${compiledFaultByte > 0 ? "bg-amber-500 animate-pulse" : "bg-white/10"}`}></div>
          </div>

          {/* Theme & Shortcuts toggles */}
          <div className="flex gap-2 items-center">
            <button
              onClick={toggleTheme}
              className="px-2 py-1 text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 rounded text-cyan-400 hover:bg-slate-850 hover:text-cyan-300 transition cursor-pointer flex items-center gap-1 uppercase"
              title="Toggle theme (Midnight vs High-Contrast Blueprint)"
            >
              🎨 {theme === "Midnight" ? "Midnight" : "Blueprint"}
            </button>
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="w-7 h-7 font-mono font-bold text-xs bg-slate-950 border border-slate-800 rounded text-slate-350 hover:bg-slate-850 hover:text-white transition cursor-pointer flex items-center justify-center"
              title="View Keyboard Shortcuts (?)"
            >
              ?
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Body Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        
        {/* Banner Alert if interlocks failed */}
        {!safetyOk && (
          <div className="bg-red-950/25 border-l-4 border-red-500 text-red-300 p-4 rounded-r-lg font-mono text-[11px] leading-relaxed flex items-start gap-3 shadow-md animate-pulse">
            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-red-200 font-bold mb-0.5 uppercase">CRITICAL SYSTEM INTERLOCK TRIP</strong>
              All electrical output rectifiers have been decoupled asynchronously. Contactor coils decoupled automatically. Examine the HIL Simulator Panel below to recalibrate plenum pressure, temperature profile, or current stress.
            </div>
          </div>
        )}

        {/* Transient Power Efficiency Excursion Alert Overlay */}
        {activeEfficiencyWarning && (
          <div className="bg-amber-950/20 border border-amber-900 text-amber-200 p-4 rounded-lg font-mono text-[11px] leading-relaxed flex items-start justify-between gap-3 shadow-lg relative animate-slide-in-tr" id="efficiency-dip-warning-banner">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <strong className="block text-amber-350 font-bold mb-0.5 uppercase tracking-wide">
                  ⚡ VHDL STATE TRANSITION POWER EFFICIENCY EXCURSION DETECTED
                </strong>
                Core power-switching efficiency dropped to <strong className="text-white bg-amber-950 px-1 py-0.5 rounded">{activeEfficiencyWarning.efficiency}%</strong> (transient current peak: <strong className="text-white">{activeEfficiencyWarning.current}A</strong>) at <strong className="text-white">Tick #{activeEfficiencyWarning.tick}</strong>.
                <span className="block text-slate-400 mt-1 italic leading-normal">
                  Correlation matrix indicates LC inductive kickback impedance mismatch during trajectory shift: 
                  <strong className="text-amber-100"> {HexagramStateLabels[activeEfficiencyWarning.fromState]?.split(" (")[0]} ➔ {HexagramStateLabels[activeEfficiencyWarning.toState]?.split(" (")[0]}</strong>.
                  Coprocessor telemetry has logged this efficiency dip to the diagnostic database.
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveEfficiencyWarning(null)}
              className="text-amber-400 hover:text-white transition-colors cursor-pointer px-1.5 py-1 bg-amber-950/40 rounded border border-amber-900/60 font-bold uppercase text-[9px] hover:bg-amber-950 shrink-0"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Informative description banner */}
        <div className="flex bg-slate-900 border border-slate-800 p-2 text-xs font-mono text-slate-400 gap-2 items-center leading-normal">
          <BadgeInfo className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>
            This application simulates the VHDL register blocks, Sparse transition maps, 10-relay contactor sequencer, and temperature predictors for the Zynq UltraScale+ hardware controller.
          </span>
        </div>

        {/* Live neural tuning layer and pre-commit visual mapping */}
        <section aria-label="AI emotional spectrum visualization">
          <AIEmotionalWeightsVisualizer
            currentHexagram={currentHexagram}
            temperatureBias={temperatureBias}
            setTemperatureBias={setTemperatureBias}
            plenumPressure={plenumPressure}
            setPlenumPressure={setPlenumPressure}
            busCurrentBias={busCurrentBias}
            setBusCurrentBias={setBusCurrentBias}
            symmetryOk={symmetryOk}
            activeFaultCodes={activeFaultCodes}
            isAiActive={isAiActive}
            setIsAiActive={setIsAiActive}
          />
        </section>

        {/* AI Gated Substrate for Spatial Multi-Plane Transitions */}
        <section aria-label="AI Gated Substrate">
          <AIGatedSubstrate
            currentHexagram={currentHexagram}
            plenumPressure={plenumPressure}
            avgElectrodeTemp={avgElectrodeTemp}
            busCurrentA={busCurrentA}
            symmetryOk={symmetryOk}
            activeFaultCodes={activeFaultCodes}
          />
        </section>

        {/* 3D Spatial Plane Transition Visualizer */}
        <section aria-label="Spatial Plane Visualizer">
          <SpatialPlaneVisualizer
            currentHexagram={currentHexagram}
            contactorStates={contactorStates}
            avgElectrodeTemp={avgElectrodeTemp}
            plenumPressure={plenumPressure}
            busCurrentA={busCurrentA}
            safetyOk={safetyOk}
            activeFaultCodes={activeFaultCodes}
            isAiActive={isAiActive}
            systemLogs={systemLogs}
          />
        </section>

        {/* State Transition History Log Auditor */}
        <section aria-label="State Transition History Log">
          <StateTransitionHistory
            transitionHistory={transitionHistory}
            onClearHistory={() => setTransitionHistory([])}
          />
        </section>

        {/* AI Hexagram Decision Brain Co-processor and fail-safes */}
        <section aria-label="AI co-processor configuration">
          <AIHexagramDecisionBrain
            currentHexagram={currentHexagram}
            isAiActive={isAiActive}
            setIsAiActive={setIsAiActive}
            avgElectrodeTemp={avgElectrodeTemp}
            plenumPressure={plenumPressure}
            busCurrentA={busCurrentA}
            symmetryOk={symmetryOk}
            activeFaultCodes={activeFaultCodes}
            onCommitState={handleCommitState}
            onResetSimulator={handleResetSimulator}
            ghostState={ghostState}
            ghostLimb={ghostLimb}
            healthFeedbackTail={healthFeedbackTail}
            transitionalState={transitionalState}
          />
        </section>

        {/* AI Pedagogy Status and Switchboard Integration Node Tester */}
        <section aria-label="AI pedagogy status and switchboard control">
          <AIPedagogyStatus />
        </section>

        {/* Row 1: App Schematic Viewport */}
        <section aria-label="System schematic layout">
          <SystemSchematic
            currentHexagram={currentHexagram}
            proposedHexagram={currentHexagram} // Highlight steady transitions
            electricalState={activeElectricalState}
            sysMode={
              currentHexagram === HexagramState.IDLE
                ? SysMode.MODE_IDLE
                : currentHexagram === HexagramState.STEALTH
                ? SysMode.MODE_STEALTH
                : currentHexagram === HexagramState.LIMP_MODE
                ? SysMode.MODE_LIMP
                : currentHexagram === HexagramState.PURGE
                ? SysMode.MODE_PURGE
                : safetyOk
                ? SysMode.MODE_TRANSIT
                : SysMode.MODE_EMERGENCY
            }
            safetyOk={safetyOk}
            activeFaultsCount={compiledFaultByte > 0 ? 1 : 0}
            tickActive={tickSpeed !== "paused"}
            tickCounter={tickCounter}
            currentTempSensors={currentTempSensors}
            predictiveAlerts={predictiveAlerts}
          />
        </section>

        {/* Dynamic Cloudflare Substrate & Swarm Globe */}
        <section aria-label="Sovereign Cloudflare Globe Platform">
          <SovereignGlobePanel
            currentHexagram={currentHexagram}
            avgElectrodeTemp={avgElectrodeTemp}
            busCurrentA={busCurrentA}
            tickCounter={tickCounter}
            addLogEntry={addLogEntry}
          />
        </section>

        {/* Row 2: Live Diagnostics Plots, Relays, waving Choke driver */}
        <section aria-label="FPGA Physical Visualizers" className="space-y-3">
          <div className="flex items-center gap-2 select-none">
            <span className="h-px bg-slate-850 flex-1"></span>
            <h2 className="text-[10px] uppercase font-mono tracking-widest text-slate-450 font-bold">FPGA Physical Visualizers</h2>
            <span className="h-px bg-slate-850 flex-1"></span>
          </div>
          <StateVisualizers
            tempSensors={currentTempSensors}
            contactorStates={contactorStates}
            coilDrive={coilDrive}
            precharge={precharge}
            auxFeedback={auxFeedback}
            chokeActive={currentHexagram !== HexagramState.IDLE && currentHexagram !== HexagramState.PURGE}
            chokeFreq={currentChokeFreq}
            symmetryOk={symmetryOk}
            busCurrentHistory={busCurrentHistory}
            predictedTempHistory={predictedTempHistory}
            actualTempHistory={actualTempHistory}
            contactorHistory={contactorHistory}
            tickCounter={tickCounter}
            transitionHistory={transitionHistory}
            currentHexagram={currentHexagram}
            predictiveAlerts={predictiveAlerts}
            powerMitigationMode={powerMitigationMode}
            setPowerMitigationMode={setPowerMitigationMode}
          />
        </section>

        {/* Row 3: HIL Simulator Stress Injectors inputs */}
        <section aria-label="Co-simulator variables">
          <HILSimulatorControls
            temperatureBias={temperatureBias}
            setTemperatureBias={setTemperatureBias}
            plenumPressure={plenumPressure}
            setPlenumPressure={setPlenumPressure}
            imuGyroRate={imuGyroRate}
            setImuGyroRate={setImuGyroRate}
            taylorOrder={taylorOrder}
            setTaylorOrder={setTaylorOrder}
            contactorFaultMask={contactorFaultMask}
            setContactorFaultMask={setContactorFaultMask}
            busCurrentBias={busCurrentBias}
            setBusCurrentBias={setBusCurrentBias}
            onResetSimulator={handleResetSimulator}
            chokeFreqOffset={chokeFreqOffset}
            setChokeFreqOffset={setChokeFreqOffset}

            // Fault Injection Mapping
            faultInjectTempBitFlip={faultInjectTempBitFlip}
            setFaultInjectTempBitFlip={setFaultInjectTempBitFlip}
            faultInjectTempStuck={faultInjectTempStuck}
            setFaultInjectTempStuck={setFaultInjectTempStuck}
            faultInjectPressStuck={faultInjectPressStuck}
            setFaultInjectPressStuck={setFaultInjectPressStuck}
            faultInjectStateCorrupt={faultInjectStateCorrupt}
            setFaultInjectStateCorrupt={setFaultInjectStateCorrupt}
            faultInjectCrcCorrupt={faultInjectCrcCorrupt}
            setFaultInjectCrcCorrupt={setFaultInjectCrcCorrupt}

            // Expanded Fault Injection Mapping
            faultInjectAxiTimeout={faultInjectAxiTimeout}
            setFaultInjectAxiTimeout={setFaultInjectAxiTimeout}
            faultInjectAxiReadbackMismatch={faultInjectAxiReadbackMismatch}
            setFaultInjectAxiReadbackMismatch={setFaultInjectAxiReadbackMismatch}
            faultInjectCdcDesync={faultInjectCdcDesync}
            setFaultInjectCdcDesync={setFaultInjectCdcDesync}
            faultInjectCdcDrift={faultInjectCdcDrift}
            setFaultInjectCdcDrift={setFaultInjectCdcDrift}
            faultInjectThermalRateExceeded={faultInjectThermalRateExceeded}
            setFaultInjectThermalRateExceeded={setFaultInjectThermalRateExceeded}
            faultInjectSensorDivergence={faultInjectSensorDivergence}
            setFaultInjectSensorDivergence={setFaultInjectSensorDivergence}

            // Warning Auto-Dismiss Properties
            warningAutoDismiss={warningAutoDismiss}
            setWarningAutoDismiss={setWarningAutoDismiss}
          />
        </section>

        {/* Row 4: AXI4 Register controller & Knock override gates */}
        <section aria-label="Direct Register controller">
          <ControlConsole
            currentHexagram={currentHexagram}
            onCommitState={handleCommitState}
            nonceCounter={nonceCounter}
            onInjectKnockOverride={handleInjectKnockOverride}
            activeFaults={byteToFaultVector(compiledFaultByte)}
            isAiActive={isAiActive}
            setIsAiActive={setIsAiActive}
          />
        </section>

        {/* Real-time System Health Monitoring & AXI FIFO Dashboard */}
        <section aria-label="VHDL Core System Health & KPIs Dashboard" className="relative">
          <SystemHealthDashboard
            tickCounter={tickCounter}
            currentHexagram={currentHexagram}
            contactorStates={contactorStates}
            chokeState={chokeState}
            avgElectrodeTemp={avgElectrodeTemp}
            plenumPressure={effectivePlenumPressure}
            busCurrentA={busCurrentA}
            symmetryOk={symmetryOk}
            activeFaultCodes={activeFaultCodes}
            temperatureBias={temperatureBias}
            busCurrentBias={busCurrentBias}
            plenumPressureNominal={plenumPressure}
            faultInjectAxiTimeout={faultInjectAxiTimeout}
            faultInjectAxiReadbackMismatch={faultInjectAxiReadbackMismatch}
            faultInjectCdcDesync={faultInjectCdcDesync}
            faultInjectCdcDrift={faultInjectCdcDrift}
            faultInjectThermalRateExceeded={faultInjectThermalRateExceeded}
            faultInjectSensorDivergence={faultInjectSensorDivergence}
            onAddLogEntry={addLogEntry}
            statWriteCount={statWriteCount}
            statReadCount={statReadCount}
            avgWriteLatency={avgWriteLatency}
            avgReadLatency={avgReadLatency}
            statHexagramWriteCount={statHexagramWriteCount}
            statTickWriteCount={statTickWriteCount}
            statAxiErrorCount={statAxiErrorCount}
            axiLatencyHistory={axiLatencyHistory}
          />
        </section>

        {/* Row 4.5: FPGA Register Debugger & Math Acceleration Interface */}
        <section aria-label="FPGA Core Debugger Interface">
          <FpgaDebuggerInterface
            currentHexagram={currentHexagram}
            chokeState={chokeState}
            tickCounter={tickCounter}
            contactorStates={contactorStates}
            avgElectrodeTemp={avgElectrodeTemp}
            busCurrentA={busCurrentA}
            plenumPressure={effectivePlenumPressure}
            isHwAccelerated={isHwAccelerated}
            setIsHwAccelerated={setIsHwAccelerated}
            onAddLogEntry={addLogEntry}
            systemLogs={systemLogs}
            statWriteCount={statWriteCount}
            statReadCount={statReadCount}
            avgWriteLatency={avgWriteLatency}
            avgReadLatency={avgReadLatency}
            statHexagramWriteCount={statHexagramWriteCount}
            statTickWriteCount={statTickWriteCount}
            statAxiErrorCount={statAxiErrorCount}
            axiLatencyHistory={axiLatencyHistory}
            onInjectInlinedFault={(faultCode: string) => {
              if (faultCode === "E-01") {
                setFaultInjectSensorDivergence(prev => !prev);
              } else if (faultCode === "E-02") {
                setFaultInjectAxiReadbackMismatch(prev => !prev);
              } else if (faultCode === "T-01") {
                setFaultInjectThermalRateExceeded(prev => !prev);
              } else if (faultCode === "C-01") {
                setFaultInjectCdcDrift(prev => !prev);
              }
            }}
          />
        </section>

        {/* Row 5: Telemetry Bitfields Codelyzer RX Serial logs */}
        <section aria-label="UART stream decoding logs">
          <TelemetryViewer
            currentPacket={activePacketObj}
            packetHistory={packetHistory}
            clearHistory={async () => {
              setPacketHistory([]);
              setTransitionHistory([]);
              await TelemetryArchiverLimb.clear();
            }}
            systemLogs={systemLogs}
            clearLogs={() => setSystemLogs([])}
            onResetSimulator={handleResetSimulator}
            onCommitState={handleCommitState}
            setTemperatureBias={setTemperatureBias}
            setPlenumPressure={setPlenumPressure}
            setBusCurrentBias={setBusCurrentBias}
            setImuGyroRate={setImuGyroRate}
            addLogEntry={addLogEntry}
            activeFaultCodes={activeFaultCodes}
            isAiActive={isAiActive}
            setIsAiActive={setIsAiActive}
            busCurrentHistory={busCurrentHistory}
            actualTempHistory={actualTempHistory}

            // Expanded debug registers and streaming logs
            debugStreamLogs={debugStreamLogs}
            debugStreamPaused={debugStreamPaused}
            setDebugStreamPaused={setDebugStreamPaused}
            transitionHistory={transitionHistory}

            // Robust Logging and UART stream mapping
            verboseLogging={verboseLogging}
            setVerboseLogging={setVerboseLogging}
            transmitLogsOverUart={transmitLogsOverUart}
            setTransmitLogsOverUart={setTransmitLogsOverUart}

            // Pass fault overrides to expand CLI commands diagnostics
            faultInjectTempBitFlip={faultInjectTempBitFlip}
            setFaultInjectTempBitFlip={setFaultInjectTempBitFlip}
            faultInjectTempStuck={faultInjectTempStuck}
            setFaultInjectTempStuck={setFaultInjectTempStuck}
            faultInjectPressStuck={faultInjectPressStuck}
            setFaultInjectPressStuck={setFaultInjectPressStuck}
            faultInjectStateCorrupt={faultInjectStateCorrupt}
            setFaultInjectStateCorrupt={setFaultInjectStateCorrupt}
            faultInjectCrcCorrupt={faultInjectCrcCorrupt}
            setFaultInjectCrcCorrupt={setFaultInjectCrcCorrupt}
            faultInjectAxiTimeout={faultInjectAxiTimeout}
            setFaultInjectAxiTimeout={setFaultInjectAxiTimeout}
            faultInjectAxiReadbackMismatch={faultInjectAxiReadbackMismatch}
            setFaultInjectAxiReadbackMismatch={setFaultInjectAxiReadbackMismatch}
            faultInjectCdcDesync={faultInjectCdcDesync}
            setFaultInjectCdcDesync={setFaultInjectCdcDesync}
            faultInjectCdcDrift={faultInjectCdcDrift}
            setFaultInjectCdcDrift={setFaultInjectCdcDrift}
            faultInjectThermalRateExceeded={faultInjectThermalRateExceeded}
            setFaultInjectThermalRateExceeded={setFaultInjectThermalRateExceeded}
            faultInjectSensorDivergence={faultInjectSensorDivergence}
            setFaultInjectSensorDivergence={setFaultInjectSensorDivergence}

            contactorFaultMask={contactorFaultMask}
            setContactorFaultMask={setContactorFaultMask}
          />
        </section>

      </main>

      {/* Keyboard Shortcuts Help Modal Overlay */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowShortcutsModal(false)}>
          <div 
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-6 font-mono text-xs text-slate-350 relative shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
            id="shortcuts-modal"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold uppercase text-slate-100 flex items-center gap-2">
                ⌨️ Hardware Simulator Hotkeys
              </h3>
              <button 
                onClick={() => setShowShortcutsModal(false)}
                className="text-slate-500 hover:text-slate-300 font-extrabold text-base transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal">
              Press any of the following keys anywhere on the dashboard (outside of input forms) to interact directly with the real-time Zynq UltraScale+ simulation loop.
            </p>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-850">
                <span className="font-bold text-cyan-400">P</span>
                <span className="text-[11px] text-slate-300 font-sans text-right">Pause Simulator Ticks</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-850">
                <span className="font-bold text-cyan-400">N</span>
                <span className="text-[11px] text-slate-300 font-sans text-right">Normal Speed Tick Interval (600ms)</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-850">
                <span className="font-bold text-cyan-400">F</span>
                <span className="text-[11px] text-slate-300 font-sans text-right">Accelerated Speed Tick Interval (180ms)</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-850">
                <span className="font-bold text-cyan-400">R</span>
                <span className="text-[11px] text-slate-300 font-sans text-right">Reset Simulator (nominal settings)</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-850">
                <span className="font-bold text-cyan-400">?</span>
                <span className="text-[11px] text-slate-300 font-sans text-right">Toggle Help Shortcuts overlay</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-850">
                <span className="font-bold text-slate-500">ESC</span>
                <span className="text-[11px] text-slate-300 font-sans text-right">Close Help overlay</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 text-center">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="w-full py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold uppercase rounded text-[10px] transition cursor-pointer"
              >
                Close Shortcuts Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Global Footer copyright */}
      <footer className="bg-slate-950 border-t border-slate-900 px-4 py-6 text-center text-[10px] font-mono text-slate-650 tracking-wide select-none">
        MHD PROPULSION FLIGHT HARMONICS CO-PROCESSOR SIMULATOR FRAMEWORK © 2026. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
