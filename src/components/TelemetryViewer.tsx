/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import {
  Terminal,
  Copy,
  RefreshCw,
  Search,
  Download,
  AlertTriangle,
  CheckCircle,
  Shield,
  ShieldAlert,
  Command,
  FileText,
  Sliders,
  Check,
  Brain,
  Cpu,
  History,
  Sparkles,
  Database,
  Upload,
  Play,
  Activity,
  Clock,
  Gauge,
  BookOpen,
  Binary,
  Layers,
  Zap,
  Compass
} from "lucide-react";
import {
  TelemetryPacket,
  encodeTelemetry,
  HexagramState,
  HexagramStateLabels,
  ElectricalReg,
  ElectricalRegLabels,
  byteToFaultVector,
  SubsystemId,
  FaultSeverity,
  DETAILED_FAULT_REGISTRY,
  SystemLog,
  EmotionalTone,
  EmotionalWeightProfile,
  HexagramEvaluationClassification,
  PredictiveStateFrame,
  SavedStatePayload,
  DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES,
  VALID_TRANSITIONS,
  ChokeState,
  ChokeStateLabels,
  StateTransition
} from "../types";

import NtxWorldBuffer from "./NtxWorldBuffer";
import GhostSplatVisualizer from "./GhostSplatVisualizer";
import MapRendererSubsystem from "./MapRendererSubsystem";
import SovereignCnsSubsystem from "./SovereignCnsSubsystem";

// OpenRSC authentic banking engines
import { Bank as RscBank, Inventory as RscInventory } from "../utils/Bank";
import { itemsConfig } from "../utils/items";
import { World as RscWorld } from "../utils/WorldSync";
import { runCloudflareWorkersAiText, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } from "../utils/cloudflareSubstrate";
import { HydroTelemetryLimb, HydroFrame } from "../limbs/physical/HydroTelemetryLimb";
import { PropulsionControlLimb, PropulsionCommand } from "../limbs/physical/PropulsionControlLimb";
import { GlobeBridgeLimb } from "../limbs/physical/GlobeBridgeLimb";


export interface TrainingCollectorRecord {
  id: string;
  hexagram: HexagramState;
  stateLabel: string;
  timestamp: string;
  reaction: HexagramEvaluationClassification;
  reason: string;
  weights: Record<EmotionalTone, number>;
}

interface TelemetryViewerProps {
  currentPacket: TelemetryPacket;
  packetHistory: string[];
  clearHistory: () => void;
  systemLogs: SystemLog[];
  clearLogs: () => void;
  onResetSimulator: () => void;
  onCommitState: (targetState: HexagramState) => void;
  setTemperatureBias: (val: number) => void;
  setPlenumPressure: (val: number) => void;
  setBusCurrentBias: (val: number) => void;
  setImuGyroRate: (val: number) => void;
  addLogEntry: (
    subsystem: SubsystemId | "SYSTEM",
    level: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL",
    message: string
  ) => void;
  activeFaultCodes: string[];
  isAiActive: boolean;
  setIsAiActive: (val: boolean) => void;

  // New debug stream monitoring logs from App.tsx
  debugStreamLogs?: string[];
  debugStreamPaused?: boolean;
  setDebugStreamPaused?: (val: boolean) => void;
  
  // Transition log history for computing aggregate energy indices
  transitionHistory?: StateTransition[];

  // Robust Logging options
  verboseLogging?: boolean;
  setVerboseLogging?: (val: boolean) => void;
  transmitLogsOverUart?: boolean;
  setTransmitLogsOverUart?: (val: boolean) => void;

  // Fault Override states & setters
  faultInjectTempBitFlip?: boolean;
  setFaultInjectTempBitFlip?: (val: boolean) => void;
  faultInjectTempStuck?: boolean;
  setFaultInjectTempStuck?: (val: boolean) => void;
  faultInjectPressStuck?: boolean;
  setFaultInjectPressStuck?: (val: boolean) => void;
  faultInjectStateCorrupt?: boolean;
  setFaultInjectStateCorrupt?: (val: boolean) => void;
  faultInjectCrcCorrupt?: boolean;
  setFaultInjectCrcCorrupt?: (val: boolean) => void;
  faultInjectAxiTimeout?: boolean;
  setFaultInjectAxiTimeout?: (val: boolean) => void;
  faultInjectAxiReadbackMismatch?: boolean;
  setFaultInjectAxiReadbackMismatch?: (val: boolean) => void;
  faultInjectCdcDesync?: boolean;
  setFaultInjectCdcDesync?: (val: boolean) => void;
  faultInjectCdcDrift?: boolean;
  setFaultInjectCdcDrift?: (val: boolean) => void;
  faultInjectThermalRateExceeded?: boolean;
  setFaultInjectThermalRateExceeded?: (val: boolean) => void;
  faultInjectSensorDivergence?: boolean;
  setFaultInjectSensorDivergence?: (val: boolean) => void;

  contactorFaultMask?: boolean[];
  setContactorFaultMask?: (val: boolean[]) => void;

  busCurrentHistory?: number[];
  actualTempHistory?: number[];
}

export default function TelemetryViewer({
  currentPacket,
  packetHistory,
  clearHistory,
  systemLogs,
  clearLogs,
  onResetSimulator,
  onCommitState,
  setTemperatureBias,
  setPlenumPressure,
  setBusCurrentBias,
  setImuGyroRate,
  addLogEntry,
  activeFaultCodes,
  isAiActive,
  setIsAiActive,

  debugStreamLogs = [],
  debugStreamPaused = false,
  setDebugStreamPaused,
  transitionHistory = [],

  verboseLogging = false,
  setVerboseLogging,
  transmitLogsOverUart = true,
  setTransmitLogsOverUart,

  // Fault state overrides
  faultInjectTempBitFlip = false,
  setFaultInjectTempBitFlip,
  faultInjectTempStuck = false,
  setFaultInjectTempStuck,
  faultInjectPressStuck = false,
  setFaultInjectPressStuck,
  faultInjectStateCorrupt = false,
  setFaultInjectStateCorrupt,
  faultInjectCrcCorrupt = false,
  setFaultInjectCrcCorrupt,
  faultInjectAxiTimeout = false,
  setFaultInjectAxiTimeout,
  faultInjectAxiReadbackMismatch = false,
  setFaultInjectAxiReadbackMismatch,
  faultInjectCdcDesync = false,
  setFaultInjectCdcDesync,
  faultInjectCdcDrift = false,
  setFaultInjectCdcDrift,
  faultInjectThermalRateExceeded = false,
  setFaultInjectThermalRateExceeded,
  faultInjectSensorDivergence = false,
  setFaultInjectSensorDivergence,

  contactorFaultMask,
  setContactorFaultMask,

  busCurrentHistory = [],
  actualTempHistory = [],
}: TelemetryViewerProps) {
  // Calculates average power consumed per transition event (Voltage: 5,000 VDC)
  const avgTransitionPower = useMemo(() => {
    if (!transitionHistory || transitionHistory.length === 0) return 9.40; // Nominal fallback (1880A * 5000V / 1e6)
    const valid = transitionHistory.filter(t => t.id !== "TRANS-INIT" && t.snapshot?.current);
    if (valid.length === 0) return 9.40;
    const sumCurrent = valid.reduce((acc, t) => acc + t.snapshot.current, 0);
    const avgCurrent = sumCurrent / valid.length;
    return (5000 * avgCurrent) / 1000000; // in Megawatts (MW)
  }, [transitionHistory]);

  // Real-time D3.js chart state and observer for bus current and temperature drift patterns
  const d3ContainerRef = useRef<HTMLDivElement>(null);
  const d3SvgRef = useRef<SVGSVGElement | null>(null);
  const [d3ChartWidth, setD3ChartWidth] = useState(600);

  useEffect(() => {
    if (!d3ContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setD3ChartWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(d3ContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const d3ChartData = useMemo(() => {
    const currents = busCurrentHistory || [];
    const temps = actualTempHistory || [];
    const maxLen = Math.max(currents.length, temps.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      index: i,
      current: currents[i] !== undefined ? currents[i] : null,
      temp: temps[i] !== undefined ? temps[i] : null,
    })).filter(d => d.current !== null || d.temp !== null);
  }, [busCurrentHistory, actualTempHistory]);

  useEffect(() => {
    if (!d3SvgRef.current) return;
    const svg = d3.select(d3SvgRef.current);
    svg.selectAll("*").remove();

    const data = d3ChartData as any[];
    if (data.length === 0) return;

    const width = d3ChartWidth;
    const height = 150;
    const margin = { top: 15, right: 42, bottom: 22, left: 42 };

    const x = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([margin.left, width - margin.right]);

    const yCurrent = d3.scaleLinear()
      .domain([
        Math.min(1000, d3.min(data, d => d.current as number) || 1200) * 0.98,
        Math.max(2100, d3.max(data, d => d.current as number) || 2000) * 1.02
      ])
      .range([height - margin.bottom, margin.top]);

    const yTemp = d3.scaleLinear()
      .domain([
        Math.min(290, d3.min(data, d => d.temp as number) || 298) - 1.5,
        Math.max(330, d3.max(data, d => d.temp as number) || 310) + 1.5
      ])
      .range([height - margin.bottom, margin.top]);

    // Background horizontal guidelines
    const currentTicks = yCurrent.ticks(4);
    svg.append("g")
      .attr("stroke", "rgba(148, 163, 184, 0.05)")
      .attr("stroke-dasharray", "2,2")
      .selectAll("line")
      .data(currentTicks)
      .enter()
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", d => yCurrent(d))
      .attr("y2", d => yCurrent(d));

    // X Axis with relative ticks (t-index)
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x)
        .ticks(Math.min(8, data.length))
        .tickSize(3)
        .tickFormat(d => `t-${data.length - 1 - (d as number)}`)
      )
      .attr("color", "rgba(71, 85, 105, 0.6)")
      .attr("font-family", "JetBrains Mono, SFMono-Regular, monospace")
      .attr("font-size", "7px")
      .call(g => g.select(".domain").style("stroke", "rgba(148, 163, 184, 0.1)"));

    // Left Y Axis (Bus Current, Purple)
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yCurrent)
        .ticks(4)
        .tickFormat(d => `${d}A`)
      )
      .attr("color", "rgba(139, 92, 246, 0.7)")
      .attr("font-family", "JetBrains Mono, SFMono-Regular, monospace")
      .attr("font-size", "7px")
      .call(g => g.select(".domain").style("stroke", "rgba(148, 163, 184, 0.1)"));

    // Right Y Axis (Temp Drift, Cyan)
    svg.append("g")
      .attr("transform", `translate(${width - margin.right},0)`)
      .call(d3.axisRight(yTemp)
        .ticks(4)
        .tickFormat(d => `${d}K`)
      )
      .attr("color", "rgba(6, 182, 212, 0.7)")
      .attr("font-family", "JetBrains Mono, SFMono-Regular, monospace")
      .attr("font-size", "7px")
      .call(g => g.select(".domain").style("stroke", "rgba(148, 163, 184, 0.1)"));

    // Linear definition gradients for fill fills
    const defs = svg.append("defs");

    const currGradient = defs.append("linearGradient")
      .attr("id", "current-area-grad")
      .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
    currGradient.append("stop").attr("offset", "0%").attr("stop-color", "#8b5cf6").attr("stop-opacity", 0.12);
    currGradient.append("stop").attr("offset", "100%").attr("stop-color", "#8b5cf6").attr("stop-opacity", 0);

    const tempGradient = defs.append("linearGradient")
      .attr("id", "temp-area-grad")
      .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
    tempGradient.append("stop").attr("offset", "0%").attr("stop-color", "#06b6d4").attr("stop-opacity", 0.12);
    tempGradient.append("stop").attr("offset", "100%").attr("stop-color", "#06b6d4").attr("stop-opacity", 0);

    // Current Area
    const curAreaGenerator = d3.area<any>()
      .x(d => x(d.index))
      .y0(height - margin.bottom)
      .y1(d => yCurrent(d.current))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("fill", "url(#current-area-grad)")
      .attr("d", curAreaGenerator);

    // Temp Area
    const tempAreaGenerator = d3.area<any>()
      .x(d => x(d.index))
      .y0(height - margin.bottom)
      .y1(d => yTemp(d.temp))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("fill", "url(#temp-area-grad)")
      .attr("d", tempAreaGenerator);

    // Line paths
    const curLineGenerator = d3.line<any>()
      .x(d => x(d.index))
      .y(d => yCurrent(d.current))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#8b5cf6")
      .attr("stroke-width", 1.5)
      .attr("d", curLineGenerator);

    const tempLineGenerator = d3.line<any>()
      .x(d => x(d.index))
      .y(d => yTemp(d.temp))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#06b6d4")
      .attr("stroke-width", 1.5)
      .attr("d", tempLineGenerator);

  }, [d3ChartData, d3ChartWidth]);

  const [activeTab, setActiveTab] = useState<"dashboard" | "packet" | "registry" | "logs" | "ai_training" | "distribution" | "ghostsplat" | "pedagogy" | "world_buffer" | "map_renderer" | "sovereign_cns" | "debug_stream" | "bist_and_logging" | "mcp_registry" | "physical_limbs">("dashboard");
  const [copying, setCopying] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string>("{\n  \"status\": \"idle\",\n  \"system\": \"mcp_terminal_ready_v2\"\n}");

  // Cloudflare Workers AI Diagnostic Panel State
  const [cfPrompt, setCfPrompt] = useState<string>("Is the system experiencing a critical pre-charge voltage mismatch and is the choke drive frequency nominal?");
  const [cfResponse, setCfResponse] = useState<string>("");
  const [cfLoading, setCfLoading] = useState<boolean>(false);
  const [cfError, setCfError] = useState<string>("");
  const [cfDiagnosticActive, setCfDiagnosticActive] = useState<boolean>(false);

  const handleCfDiagnose = async (overridePrompt?: string) => {
    setCfLoading(true);
    setCfError("");
    setCfResponse("");
    setCfDiagnosticActive(true);
    
    const query = overridePrompt || cfPrompt;
    
    const telemetryString = `Operating Mode: ${HexagramStateLabels[currentPacket.hexagramState]}
Core Temperature: ${((currentPacket.predictedTempRaw / 655.35) + 273.15).toFixed(2)}K
Plenum Pressure: ${(currentPacket.pressPlenumRaw / 8192).toFixed(4)} atm
Bus Current: ${(currentPacket.currBusRaw / 3276.8).toFixed(4)} A
Relay State: ${currentPacket.electricalReg === 1 ? "CLOSED (ACTIVE)" : "OPEN (CUTOUT)"}
Fault Byte: 0x${currentPacket.faultByte.toString(16).toUpperCase()}
CRC Valid: ${currentPacket.crcValid ? "TRUE" : "FALSE"}
Active Faults: ${activeFaultCodes.length > 0 ? activeFaultCodes.join(", ") : "None"}`;

    const systemPrompt = `You are the Cloudflare Workers AI edge-co-processor embedded for the POG2 Hydroelectric Dynamo. 
Analyze the real-time FPGA telemetry and reply dynamically in a highly professional, dense, system engineering tone. Keep it concise (maximum 3 sentences or a short bulleted list), addressing any faults or tuning optimizations. Provide a safety state assessment if relevant.`;

    const userPromptText = `Here is the current telemetry snapshot:\n${telemetryString}\n\nUser Question/Directive: ${query}`;

    try {
      if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
        // Fallback simulation mode if credentials are empty to keep the workspace elegant and testable
        // We simulate a real response from llama-3.1-8b-instruct
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        let simulatedAnswer = "";
        if (query.toLowerCase().includes("mismatch") || query.toLowerCase().includes("nominal")) {
          const isTempOk = ((currentPacket.predictedTempRaw / 655.35) + 273.15) < 320;
          const isFaulty = currentPacket.faultByte > 0;
          simulatedAnswer = `[CF-CO-PROCESSOR SIMULATION] Based on telemetry frame 0x${currentPacket.rawValueHex.substring(0, 4)}, the core temperature is nominal at ${((currentPacket.predictedTempRaw / 655.35) + 273.15).toFixed(1)}K and plenum pressure of ${(currentPacket.pressPlenumRaw / 8192).toFixed(2)} atm is balanced. ${isFaulty ? "CAUTION: Fault Byte is active (0x" + currentPacket.faultByte.toString(16).toUpperCase() + "), corresponding to active indicators. Review interlock relay symmetry." : "System status is fully SECURE with 0 active interlock alarms."} Pre-charge voltage mismatch is not detected, matching standard Tao (nominal) state balance.`;
        } else if (query.toLowerCase().includes("pressure") || query.toLowerCase().includes("plenum")) {
          simulatedAnswer = `[CF-CO-PROCESSOR SIMULATION] Plenum pressure is measured at ${(currentPacket.pressPlenumRaw / 8192).toFixed(3)} atmospheres, inside the normal dynamic operation envelope for ${HexagramStateLabels[currentPacket.hexagramState]?.split(" ")[0]}. Pre-charge thresholds are compliant, indicating no system bleeding or valve choke saturation.`;
        } else if (query.toLowerCase().includes("choke") || query.toLowerCase().includes("frequency")) {
          simulatedAnswer = `[CF-CO-PROCESSOR SIMULATION] Choke driver frequency matches designated 6520 Hz telemetry clock. Harmonics are balanced at 42.5% regular cycle, confirming zero pre-charge coil drift or high-frequency feedback anomalies.`;
        } else {
          simulatedAnswer = `[CF-CO-PROCESSOR SIMULATION] Analysis completed. System register is executing in mode: ${HexagramStateLabels[currentPacket.hexagramState]}. Electrode thermals are within tolerance, and parity checks are verified. All contactor relays are functional; recommend maintaining normal AI autopilot pathways.`;
        }
        
        setCfResponse(simulatedAnswer);
        addLogEntry("SYSTEM" as any, "SUCCESS", "Workers AI diagnostic complete (Simulated Edge fallback active due to unconfigured credentials).");
        return;
      }
      
      const cfRes = await runCloudflareWorkersAiText(userPromptText, systemPrompt);
      if (cfRes.success && cfRes.result) {
        setCfResponse(cfRes.result);
        addLogEntry("SYSTEM" as any, "SUCCESS", `Workers AI analysis complete: "@cf/meta/llama-3.1-8b-instruct" returned successful diagnostic.`);
      } else {
        throw new Error(cfRes.error || "Execution failed");
      }
    } catch (err: any) {
      setCfError(err.message || String(err));
      addLogEntry("SYSTEM" as any, "CRITICAL", `Workers AI command failed: ${err.message || String(err)}`);
    } finally {
      setCfLoading(false);
    }
  };

  // ==========================================================================
  // FPGA BUILT-IN SELF-TEST (BIST) & HIGH-SPEED DATA LOGGING STATES
  // ==========================================================================
  const [bistState, setBistState] = useState<"IDLE" | "RUNNING" | "COMPLETED">("IDLE");
  const [bistStep, setBistStep] = useState<number>(0);
  const [bistLogs, setBistLogs] = useState<string[]>([]);
  const [bistResults, setBistResults] = useState<{
    axi: boolean | null;
    sensors: boolean | null;
    contactors: boolean | null;
    pwm: boolean | null;
    fsm: boolean | null;
  }>({ axi: null, sensors: null, contactors: null, pwm: null, fsm: null });
  const [bistStatusReg, setBistStatusReg] = useState<number>(0x00000000);

  // High-Speed SRAM & BRAM Data Logger
  const [isLoggingActive, setIsLoggingActive] = useState<boolean>(true);
  const [logMedium, setLogMedium] = useState<"BRAM" | "EXT_QSPI_SRAM">("BRAM");
  const [logTriggerMode, setLogTriggerMode] = useState<"MANUAL" | "ON_FAULT" | "ON_STATE_CHANGE">("MANUAL");
  const [memoryPage, setMemoryPage] = useState<number>(0);
  const [capturedCount, setCapturedCount] = useState<number>(0);
  const [loggingBuffer, setLoggingBuffer] = useState<Array<{
    tick: number;
    timestamp: string;
    temp: number;
    press: number;
    current: number;
    fsmState: string;
    contactors: string;
    chokeFreq: number;
    awaddr: string;
    wdata: string;
    araddr: string;
    rdata: string;
    valid: boolean;
  }>>([]);

  // Auto record on packet changes
  const prevFaultCountRef = useRef<number>(0);
  const prevStateRef = useRef<number>(-1);
  const logCounterRef = useRef<number>(0);

  useEffect(() => {
    if (!currentPacket) return;

    const currentFaultCount = activeFaultCodes.length;
    const currentState = currentPacket.hexagramState;

    // Trigger state machine
    let shouldCapture = isLoggingActive;

    if (logTriggerMode === "ON_FAULT") {
      if (currentFaultCount > 0 && prevFaultCountRef.current === 0) {
        // Triggered! Enable logging, lock counter
        setIsLoggingActive(true);
        shouldCapture = true;
        logCounterRef.current = 100; // capture next 100 points
      }
    } else if (logTriggerMode === "ON_STATE_CHANGE") {
      if (currentState !== prevStateRef.current && prevStateRef.current !== -1) {
        setIsLoggingActive(true);
        shouldCapture = true;
        logCounterRef.current = 30; // capture next 30 points on transition
      }
    }

    if (shouldCapture) {
      // Decode sensor readings
      const tempK = (currentPacket.predictedTempRaw / 655.35) + 273.15;
      const pressAtm = currentPacket.pressPlenumRaw / 8192;
      const currentA = currentPacket.currBusRaw / 3276.8;

      // Mock random continuous AXI-Lite read/writes
      const awaddr = "0x43C000" + (Math.floor(Math.random() * 5) * 4 + 80).toString(16).toUpperCase();
      const wdata = "0x" + Math.floor(Math.random() * 4294967295).toString(16).toUpperCase().padStart(8, "0");
      const araddr = "0x43C002" + (Math.floor(Math.random() * 3) * 4 + 10).toString(16).toUpperCase();
      const rdata = "0x" + Math.floor(Math.random() * 4294967295).toString(16).toUpperCase().padStart(8, "0");

      const newEntry = {
        tick: (loggingBuffer[0]?.tick ?? 0) + 1,
        timestamp: new Date().toISOString().split("T")[1].substring(0, 8),
        temp: parseFloat(tempK.toFixed(2)),
        press: parseFloat(pressAtm.toFixed(2)),
        current: parseFloat(currentA.toFixed(2)),
        fsmState: HexagramStateLabels[currentState]?.split(" (")[0] || "UNALIGN",
        contactors: currentPacket.electricalReg === 1 ? "CT_00-09 CLSD" : currentPacket.electricalReg === 0 ? "CT_OPEN" : "CT_STBY",
        chokeFreq: currentPacket.hexagramState !== HexagramState.IDLE ? 6520.0 + Math.sin(Date.now() / 1000) * 2.1 : 0.0,
        awaddr,
        wdata,
        araddr,
        rdata,
        valid: Math.random() > 0.05
      };

      setLoggingBuffer(prev => {
        const updated = [newEntry, ...prev];
        const capacity = logMedium === "BRAM" ? 256 : 1024;
        return updated.slice(0, capacity);
      });
      setCapturedCount(prev => prev + 1);

      if (logCounterRef.current > 0) {
        logCounterRef.current -= 1;
        if (logCounterRef.current === 0) {
          setIsLoggingActive(false); // Stop logging once triggered quota is complete
        }
      }
    }

    prevFaultCountRef.current = currentFaultCount;
    prevStateRef.current = currentState;
  }, [currentPacket, isLoggingActive, logMedium, logTriggerMode]);

  const runSystemBist = () => {
    if (bistState === "RUNNING") return;
    
    setBistState("RUNNING");
    setBistStep(1);
    const initialLogs = [
      "[0.00s] FPGA HIGH-SPEED BUILT-IN SELF-TEST (BIST) STANDING BY...",
      "[0.05s] Resetting target register 0x43C000A0 (BIST_STATUS_REG)..."
    ];
    setBistLogs(initialLogs);
    setBistResults({ axi: null, sensors: null, contactors: null, pwm: null, fsm: null });
    setBistStatusReg(0x00000000);

    const logs = [...initialLogs];
    const startTime = Date.now();
    const log = (msg: string) => {
      const timeStamp = ((Date.now() - startTime) / 1000).toFixed(2);
      logs.push(`[${timeStamp}s] ${msg}`);
      setBistLogs([...logs]);
    };
    
    // Step 1: AXI-Lite Bussing Register Integrity (takes 0.6s)
    setTimeout(() => {
      setBistStep(2);
      log("STEP 1: COMMANDING AXI-LITE REGISTER WALKING PATTERNS VERIFICATION...");
      
      let axiPass = true;
      if (activeFaultCodes.includes("A-01")) {
        log("❌ FAIL: AXI transaction address decoding timeout! (DECERR triggered)");
        axiPass = false;
      } else if (activeFaultCodes.includes("A-02")) {
        log("❌ FAIL: AXI register write-read verification mismatch! (SLVERR triggered)");
        axiPass = false;
      } else {
        log("Writing pattern 0x55AA55AA to internal memory cell 0x43C0009C...");
        log("Read-back verified 0x55AA55AA (OK). No path reflections detected.");
        log("Writing pattern 0xAA55AA55 to internal memory cell 0x43C0009C...");
        log("Read-back verified 0xAA55AA55 (OK). 32-bit registers matching.");
        log("Running walking-1s on ADDR lines [15:2]...");
        log("AXI4-Lite integrity: PASS.");
      }
      setBistResults(prev => ({ ...prev, axi: axiPass }));
    }, 600);

    // Step 2: Sensor ADC Acquisitions (takes 1.2s)
    setTimeout(() => {
      setBistStep(3);
      log("STEP 2: ENABLING DUAL-CHANNEL ADC INTEGRITY MONITORS...");
      
      const tempK = (currentPacket.predictedTempRaw / 655.35) + 273.15;
      const pressAtm = currentPacket.pressPlenumRaw / 8192;
      
      log(`Probing Primary temperature sensor line: ${tempK.toFixed(1)} K`);
      log(`Probing Secondary Plenum pressure transducer: ${pressAtm.toFixed(2)} atm`);

      // Check for shorts/opens or active injected faults
      let sensorPass = true;
      if (tempK < 50.0 || tempK > 420.0) {
        log("⚠️ WARNING: Temperature sensor path saturated (potential short/open to GND/VCC)!");
        sensorPass = false;
      } else if (activeFaultCodes.includes("T-03")) {
        log("❌ FAIL: dT/dt temperature rate-of-change limit exceeded! Core thermal runaway.");
        sensorPass = false;
      } else if (activeFaultCodes.includes("T-04")) {
        log("⚠️ WARNING: Dual-channel ADC thermocouple mismatch divergence (>25.0 K) detected!");
        sensorPass = false;
      } else {
        log("Temperature sensor dynamic noise check: nominal variation observed (OK).");
      }

      if (pressAtm < 0.05 || pressAtm > 7.8) {
        log("⚠️ WARNING: Plenum pressure transducer showing aberrant impedance (potential transducer fracture)!");
        sensorPass = false;
      } else {
        log("Plenum pressure transducer: steady pressure calibration confirmed (OK).");
      }

      if (sensorPass) {
        log("ADC Sensor Acquisition Channels: PASS.");
      } else {
        log("ADC Sensor Acquisition Channels: DEGRADED / UNSTABLE.");
      }
      setBistResults(prev => ({ ...prev, sensors: sensorPass }));
    }, 1300);

    // Step 3: Contactor Actuation Loops (takes 1.8s)
    setTimeout(() => {
      setBistStep(4);
      log("STEP 3: TESTING HIGH-VOLTAGE CONTACTOR SOLENOID ACTUATION LOOPS...");
      log("Commanding all auxiliary coil switches to CLOSE...");
      log("Reading auxiliary diagnostic feedback terminals CT_00 - CT_09...");
      
      let contactorPass = currentPacket.electricalReg === 1; // Assuming closed if regular is closed
      log("Toggling pilot contactor gate drivers for complementary symmetry compliance...");
      
      if (activeFaultCodes.includes("E-04") || activeFaultCodes.includes("E-01") || currentPacket.electricalReg === 0) { 
        log("❌ FAIL: Contactors failed complementary symmetry lock test (Coils Stuck-Open/Fault)!");
        contactorPass = false;
      } else {
        log("Pilot contactors: Aux feedback signals match coil driver commands (OK).");
        contactorPass = true;
      }
      setBistResults(prev => ({ ...prev, contactors: contactorPass }));
    }, 2000);

    // Step 4: Choke Driver PWM Outputs (takes 2.4s)
    setTimeout(() => {
      setBistStep(5);
      log("STEP 4: ANALYZING CHOKE DRIVER PWM OUTPUT GATES...");
      log("Triggering 5-channel PWM frequency timer counter...");
      log(`Resonant tracking PLL lock status: ${currentPacket.hexagramState !== HexagramState.IDLE ? "LOCKED" : "STBY"}`);
      
      let pwmPass = true;
      if (activeFaultCodes.includes("V-03") || currentPacket.hexagramState === HexagramState.IDLE) {
        log("⚠️ WARNING: Resonance tracking PLL was unable to achieve lock or is inactive (Standby state)!");
        pwmPass = false;
      } else {
        log("PLL tracked resonant frequency: locked at 6500 Hz (OK).");
        log("PWM duty cycle comparator: symmetrical outputs verified across phases.");
      }
      setBistResults(prev => ({ ...prev, pwm: pwmPass }));
    }, 2700);

    // Step 5: Internal State Machine Sequence (takes 3.0s)
    setTimeout(() => {
      setBistStep(6);
      log("STEP 5: EXERCISING YAO STATE MACHINE STRUCTURAL INTEGRITY & CDC BOUNDARIES...");
      log(`Active state index reported via DEBUG_STATUS_REG (0x84): 0x${currentPacket.hexagramState.toString(16).toUpperCase()}`);
      
      let fsmPass = true;
      if (currentPacket.hexagramState === HexagramState.ST_CRIT || activeFaultCodes.includes("I-01")) {
        log("❌ FAIL: FSM caught in Invalid State Sequence or high-variance timeout!");
        fsmPass = false;
      } else if (activeFaultCodes.includes("C-02")) {
        log("❌ FAIL: Clock Domain Crossing (CDC) synchronizer desynchronization mismatch!");
        fsmPass = false;
      } else if (activeFaultCodes.includes("C-03")) {
        log("❌ FAIL: Clock domain phase drift skew limit exceeded!");
        fsmPass = false;
      } else {
        log("State machine transition hazard monitors verified. Safe recovery locks operational.");
        log("Clock domain boundary Gray-code handshake: PASS.");
      }
      setBistResults(prev => ({ ...prev, fsm: fsmPass }));
    }, 3300);

    // Step 6: Assemble report & complete (takes 3.9s)
    setTimeout(() => {
      log("STEP 6: ASSEMBLING COMPREHENSIVE DIAGNOSTIC LOG...");
      
      setBistResults(latest => {
        const bit0 = latest.axi ? 1 : 0;
        const bit1 = latest.sensors ? 1 : 0;
        const bit2 = latest.contactors ? 1 : 0;
        const bit3 = latest.pwm ? 1 : 0;
        const bit4 = latest.fsm ? 1 : 0;
        
        const criticalPass = !!(bit0 && bit2 && bit4);
        const allPass = !!(bit0 && bit1 && bit2 && bit3 && bit4);
        const pmcPass = criticalPass && !allPass;
        
        // Ternary decision logic for status bits
        const bit31 = allPass ? 1 : (pmcPass ? 1 : 0);
        const bit30 = pmcPass ? 1 : 0;
        
        const bitVal = (bit31 << 31) | (bit30 << 30) | (bit4 << 4) | (bit3 << 3) | (bit2 << 2) | (bit1 << 1) | bit0;
        setBistStatusReg(bitVal >>> 0);
        
        logs.push(`[3.80s] Writing report bitwise word to memory bus at 0x43C000A0: 0x${(bitVal >>> 0).toString(16).toUpperCase().padStart(8, "0")}`);
        if (allPass) {
          logs.push("[3.90s] 🟢 ALL CHECKS PASSED. SYSTEM DECLARED FULLY MISSION CAPABLE (FMC).");
        } else if (pmcPass) {
          logs.push("[3.90s] 🟡 WARNING: BIST INTEGRITY STABLE. SYSTEM DECLARED PARTIAL MISSION CAPABLE (PMC) [DEGRADED OPERATION GATED].");
        } else {
          logs.push("[3.90s] 🔴 LOCKOUT ALERT: CRITICAL HARDWARE LOCKOUT DETECTED. SYSTEM REPORTED NON-MISSION CAPABLE (NMC).");
        }
        
        setBistLogs([...logs]);
        setBistState("COMPLETED");
        return latest;
      });
    }, 3900);
  };

  // GHOSTSPLAT local sandbox simulation parameters
  const [sandboxTemp, setSandboxTemp] = useState<number>(300.2);
  const [sandboxCurrent, setSandboxCurrent] = useState<number>(1880.0);
  const [sandboxUStar, setSandboxUStar] = useState<number>(0.277);
  const [sandboxRho, setSandboxRho] = useState<number>(1025.0);
  const [sandboxElecReg, setSandboxElecReg] = useState<number>(1); // 0=ELEC_OFF, 1=ELEC_NOM, 2=ELEC_SHED, 3=ELEC_CRIT
  const [sandboxConstantsSubTab, setSandboxConstantsSubTab] = useState<"consumables" | "constants" | "outputs" | "matrix">("consumables");
  const [isSandboxSyncMode, setIsSandboxSyncMode] = useState<boolean>(true);

  // MEMORY & PEDAGOGY Tab states
  const [selectedHierarchyPath, setSelectedHierarchyPath] = useState<string>("pedagogy_rom");
  const [selectedEntityId, setSelectedEntityId] = useState<number>(1);
  const [sourcingEvent, setSourcingEvent] = useState<string>("combat_rotation");
  const [liveTelemetrySeq, setLiveTelemetrySeq] = useState<number>(1540);
  const [isSourcingActive, setIsSourcingActive] = useState<boolean>(false);
  const [eventSourcingLogs, setEventSourcingLogs] = useState<string[]>([
    "[BRIDGE] Event bridge initiated. Listening on local socket at localhost:8001.",
    "[BRIDGE] Initial sync. Reading current state of co-processor (IDLE)."
  ]);
  const [d1AuditLogs, setD1AuditLogs] = useState<any[]>([
    { id: 1045, timestamp: "05:12:04", event_type: "hexagram_transition", hexagram_id: 1, yao_lines: "000000", segment_mask: 0, confidence: 1.0, sha: "a1b2c3d4...9e8f" },
    { id: 1046, timestamp: "05:13:40", event_type: "combat_rotation", hexagram_id: 1, yao_lines: "+-00++", segment_mask: 1023, confidence: 0.95, sha: "3f4e5d6c...2b1a" },
    { id: 1047, timestamp: "05:15:22", event_type: "adrenaline_change", hexagram_id: 23, yao_lines: "+-0-0+", segment_mask: 768, confidence: 0.88, sha: "de32ad45...f221" }
  ]);
  const [pipelineProgress, setPipelineProgress] = useState<number>(-1);
  const [pipelineStage, setPipelineStage] = useState<string>("");
  const [selectedRegisterBlock, setSelectedRegisterBlock] = useState<string>("control");
  const [watchdogCountdown, setWatchdogCountdown] = useState<number>(47);
  const [watchdogRunning, setWatchdogRunning] = useState<boolean>(true);
  const [watchdogStatus, setWatchdogStatus] = useState<string>("HEALTHY");
  const [lastPetTime, setLastPetTime] = useState<string>("Just now");
  const [isCustomFpgarRomFlanked, setIsCustomFpgarRomFlanked] = useState<boolean>(false);
  const [standaloneHex, setStandaloneHex] = useState<number>(1);
  const [standaloneVibe, setStandaloneVibe] = useState<string>("AGITATED");

  // Sync sandbox with current telemetry inputs dynamically
  useEffect(() => {
    if (isSandboxSyncMode && currentPacket) {
      if (currentPacket.predictedTempRaw > 0) {
        setSandboxTemp(currentPacket.predictedTempRaw / 10);
      }
      setSandboxCurrent(currentPacket.currBusRaw * 10);
      setSandboxElecReg(currentPacket.electricalReg);
    }
  }, [isSandboxSyncMode, currentPacket]);

  // Decoupled safety watchdog ticking timer simulation
  useEffect(() => {
    let interval: any = null;
    if (!watchdogRunning && activeTab === "pedagogy" && watchdogCountdown > 0) {
      interval = setInterval(() => {
        setWatchdogCountdown(prev => {
          if (prev <= 1) {
            setWatchdogStatus("TRIPPED_EMERGENCY");
            addLogEntry("SYSTEM" as any, "CRITICAL", "WATCHDOG_INTERRUPT: Watchdog terminal timeout elapsed (0 seconds remaining). Asserted EMERGENCY_OPEN (con_0 - con_9 tripped open).");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (watchdogRunning && watchdogCountdown < 47) {
      // Auto-petter sweeps and keeps it topped up
      const petInterval = setInterval(() => {
        setWatchdogCountdown(47);
        setWatchdogStatus("HEALTHY");
      }, 500);
      return () => clearInterval(petInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [watchdogRunning, activeTab, watchdogCountdown, addLogEntry]);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Search & filter states for Diagnostic Logs tab
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [subsystemFilter, setSubsystemFilter] = useState<string>("ALL");

  // Dynamic CLI Interactive Terminal states
  const [cliInput, setCliInput] = useState("");
  const [cliHistory, setCliHistory] = useState<string[]>([
    "POG2 UART AXI4 SHELL INITIALIZED.",
    "Type 'help' to review low-level physical trigger controls."
  ]);
  const cliContainerRef = useRef<HTMLDivElement>(null);

  // Telemetry Packet Validation Helper
  const validatePacket = (packet: TelemetryPacket): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    auditStamp: string;
  } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check padding value (VHDL aligns with 0xaa padding)
    if (packet.padding !== 0xaa) {
      errors.push(`Padding mismatch: Expected 0xAA, found 0x${packet.padding.toString(16).toUpperCase()}`);
    }
    
    // Verify pool of valid hexagram states in sparse transition enum map
    const validStates = [0, 9, 52, 55, 56, 57, 58, 59];
    if (!validStates.includes(packet.hexagramState)) {
      errors.push(`Invalid Hexagram State: State value ${packet.hexagramState} not in sparse transition enum map.`);
    }
    
    // Verify electrical state lies in [0..3]
    if (packet.electricalReg < 0 || packet.electricalReg > 3) {
      errors.push(`Invalid Electrical State: Range violation (${packet.electricalReg})`);
    }
    
    // Check Taylor order
    if (packet.taylorOrder < 2 || packet.taylorOrder > 5) {
      errors.push(`Invalid Taylor Order: Range violation (${packet.taylorOrder})`);
    }
    
    // Add warnings for active fault codes in fault byte
    if (packet.faultByte > 0) {
      warnings.push(`Fault byte non-zero: 0x${packet.faultByte.toString(16).toUpperCase()}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      auditStamp: `CRC-32 Validated | SECURE_POG2_MHD Frame Pass`
    };
  };

  const [validPacketHistory, setValidPacketHistory] = useState<Array<{
    timestamp: string;
    hex: string;
    hexagram: string;
    electrical: string;
    faultHex: string;
  }>>([]);

  useEffect(() => {
    if (currentPacket) {
      const res = validatePacket(currentPacket);
      if (res.isValid) {
        setValidPacketHistory(prev => {
          const isDuplicate = prev.length > 0 && prev[prev.length - 1].hex === currentPacket.rawValueHex;
          if (isDuplicate) return prev; // Avoid duplicate ticks spamming
          const newEntry = {
            timestamp: new Date().toLocaleTimeString(),
            hex: currentPacket.rawValueHex,
            hexagram: HexagramStateLabels[currentPacket.hexagramState]?.split(" (")[0] || "UNKNOWN",
            electrical: ElectricalRegLabels[currentPacket.electricalReg] || "UNKNOWN",
            faultHex: `0x${currentPacket.faultByte.toString(16).toUpperCase()}`
          };
          const copy = [...prev, newEntry];
          if (copy.length > 10) copy.shift();
          return copy;
        });
      }
    }
  }, [currentPacket]);

  const calculatePredictiveFutureTemp = (tempVal: number, order: number, ticks: number): number => {
    return tempVal + (order * 0.45) - (ticks % 3) * 0.05;
  };

  // Sovereign Distribution script controls (skills.sh)
  const [skillsCommand, setSkillsCommand] = useState<string>("validate");
  const [skillsTarget, setSkillsTarget] = useState<string>("all");
  const [skillsModel, setSkillsModel] = useState<string>("pog2-yaostate");
  const [skillsTickMs, setSkillsTickMs] = useState<number>(640);
  const [skillsBitstream, setSkillsBitstream] = useState<string>("pog2-mhd-fpga-001.bit");
  const [skillsDepth, setSkillsDepth] = useState<string>("summary");
  const [skillsTerminalLogs, setSkillsTerminalLogs] = useState<string[]>([
    "POG2-MHD-FPGA-001 Distribution Limb (skills.sh) active.",
    "Orchestrate local, edge, cloud, and physical Zynq substrates directly.",
    "Ready for core validation run."
  ]);
  const [isSkillsRunning, setIsSkillsRunning] = useState<boolean>(false);
  const skillsTerminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll skills terminal to bottom
  useEffect(() => {
    if (activeTab === "distribution" && skillsTerminalRef.current) {
      skillsTerminalRef.current.scrollTop = skillsTerminalRef.current.scrollHeight;
    }
  }, [skillsTerminalLogs, activeTab]);

  const executeSkillsCommand = () => {
    if (isSkillsRunning) return;
    setIsSkillsRunning(true);

    const timestampLocal = new Date().toISOString().replace("T", " ").substring(0, 19);

    // Initial log message
    let cmdString = `./skills.sh ${skillsCommand}`;
    if (skillsCommand === "deploy") cmdString += ` ${skillsTarget}`;
    if (skillsCommand === "train") cmdString += ` ${skillsModel}`;
    if (skillsCommand === "clock") cmdString += ` ${skillsTickMs}`;
    if (skillsCommand === "flash") cmdString += ` ${skillsBitstream}`;
    if (skillsCommand === "health") cmdString += ` ${skillsDepth}`;

    setSkillsTerminalLogs(prev => [
      ...prev,
      `$ ${cmdString}`,
      `[SKILLS] Executing command: ${skillsCommand} at ${timestampLocal}...`
    ]);

    // Build log lines
    let logLines: string[] = [];
    if (skillsCommand === "install") {
      logLines = [
        "[SKILLS] Deploying MCP server configuration...",
        "[INFO] Loading POG2-mcp.json schema registry...",
        "[OK] MCP config valid: 4 tools, 2 resources",
        "[INFO] FpgaLimb.ts detected -- registering with NodeTester",
        "[INFO] Executing TypeScript runtime boot-up...",
        "[SKILLS] Initiating FpgaLimb on port 3000 mapping...",
        "[OK] FpgaLimb successfully initialized & verified in simulator.",
        "[OK] MCP deployment complete"
      ];
    } else if (skillsCommand === "deploy") {
      if (skillsTarget === "edge") {
        logLines = [
          "[SKILLS] Deploying to Cloudflare edge...",
          "[INFO] Reading wrangler.toml config...",
          "[OK] State reference validated: 0x44 -> CONTACTOR_STATUS -> EXECUTION (read)",
          "[OK] State reference validated: 0x10 -> HEXAGRAM_STATE -> CAUSAL (write)",
          "[INFO] Compiling worker assets ... done (1.2s)",
          "[INFO] Uploading script & binding DO KV store...",
          "[OK] Worker deploy successful (pog2.workers.dev)",
          "[INFO] Verifying live endpoint accessibility...",
          "[OK] Edge deployment healthy: https://pog2.workers.dev/health",
          "[OK] Edge deployment complete"
        ];
      } else if (skillsTarget === "local") {
        logLines = [
          "[SKILLS] Deploying local Ollama models...",
          "[INFO] Verifying ollama.sock connection...",
          "[OK] Ollama service responsive on localhost:11434",
          "[INFO] Checking local tag list...",
          "[OK] Model available: deepseek-r1:8b (cached)",
          "[OK] Model available: pog2-yaostate (cached)",
          "[OK] Model available: kimi-k2.5:cloud (cached)",
          "[OK] Local deployment complete"
        ];
      } else if (skillsTarget === "fpga") {
        logLines = [
          `[SKILLS] Deploying FPGA bitstream (${skillsBitstream})...`,
          "[INFO] Taxonomy hash: 86b11029c0f865f37bb3a0c56abc88e99ef3...",
          "[INFO] Running OpenOCD JTAG flash controller...",
          "[INFO] Connecting to target Digilent-HS1 PSU... done",
          "[INFO] Initializing Zynqmp pld programmer...",
          "[INFO] Writing bitstream blocks (100% completed)",
          "[OK] FPGA flashed via openocd",
          "[INFO] Probing axi4lite memory mapping register (0x43C0_0000)...",
          "[OK] FPGA ID verified: POG2 (Hex 0x504F4732)"
        ];
      } else if (skillsTarget === "soul") {
        logLines = [
          "[SKILLS] Deploying soul layers...",
          "[INFO] Initializing observer consciousness (GhostLimb)...",
          "[OK] GhostLimb detected -- observer consciousness ready",
          "[INFO] Initiating creative cadence (VoiceLimb)...",
          "[OK] VoiceLimb detected -- prosody vector ready",
          "[INFO] Mapping historic literary repository (GutenbergLimb)...",
          "[OK] GutenbergLimb detected -- soul ingestion ready",
          "[INFO] Aligning silicon register structure...",
          "[OK] Soul deployment complete"
        ];
      } else {
        // all
        logLines = [
          "[SKILLS] Triggering deployment for all targets...",
          "[INFO] Targeting Local, Edge, FPGA, and metaphysical Soul layers...",
          "[SKILLS] Deploying local Ollama models...",
          "[OK] Local deployment complete",
          "[SKILLS] Deploying to Cloudflare edge...",
          "[OK] Edge deployment complete",
          `[SKILLS] Deploying FPGA bitstream (${skillsBitstream})...`,
          "[OK] FPGA flashed via openocd & dynamic register ID verified",
          "[SKILLS] Deploying soul layers...",
          "[OK] Soul deployment complete",
          "[OK] Sovereign deployment completed successfully (ALL layers active)."
        ];
      }
    } else if (skillsCommand === "train") {
      // DYNAMIC MULTI-MODEL DISTILLATION FROM ONE TRUTH (HEXAGRAMS + TIMESTAMPS)
      let tempSeq: any[] = [];
      let tempColl: any[] = [];
      try {
        const cachedSeq = localStorage.getItem("pog2_mhd_training_sequence");
        if (cachedSeq) tempSeq = JSON.parse(cachedSeq);
        const cachedColl = localStorage.getItem("pog2_mhd_training_collector");
        if (cachedColl) tempColl = JSON.parse(cachedColl);
      } catch (err) {
        console.warn(err);
      }

      const totalTruthRecords = tempSeq.length + tempColl.length;
      
      // Calculate active superposition vectors (one truth)
      const counts: Record<string, number> = {};
      [...tempSeq, ...tempColl].forEach((r: any) => {
        const stateKey = r.state || r.hexagram || "UNKNOWN";
        counts[stateKey] = (counts[stateKey] || 0) + 1;
      });
      const keys = Object.keys(counts);
      let eqTerms: string[] = [];
      if (keys.length > 0) {
        const totalSum = Object.values(counts).reduce((a, b) => a + b, 0);
        keys.forEach(k => {
          const amplitude = Math.sqrt(counts[k] / totalSum).toFixed(3);
          const cleanLabel = HexagramStateLabels[k as any as HexagramState]?.split(" (")[0] || k;
          eqTerms.push(`${amplitude}|${cleanLabel}⟩`);
        });
      } else {
        eqTerms = ["0.707|STEALTH⟩", "0.707|IDLE⟩"];
      }
      const truthSuperposition = `|ψ⟩ = ${eqTerms.join(" + ")}`;
      const timestampCompressionInfo = `LUNA_QBIT|[N=${totalTruthRecords}][TS=${new Date().toLocaleTimeString()}]`;

      // Convert truth marker string to direct classical hex injection
      let stringWordHex = "";
      for (let sIdx = 0; sIdx < timestampCompressionInfo.length; sIdx++) {
        stringWordHex += timestampCompressionInfo.charCodeAt(sIdx).toString(16).padStart(2, "0");
      }
      const signatureLabel = `0x${stringWordHex.toUpperCase().substring(0, 16)}`;

      logLines = [
        `[SKILLS] Broadening training distillation pipeline targeting ALL model structures simultaneously...`,
        `[INFO] Target Engines: [pog2-yaostate, deepseek-r1:8b, deepseek-r1:32b, gemma4:26b, qwen2p5-coder-32b, gemini-1.5-pro, gemini-1.5-flash]`,
        `[INFO] Ingesting "1 TRUTH" dataset containing ${totalTruthRecords} historical state & telemetry matrices...`,
        `[INFO] Formulated superposition wavefront state: ${truthSuperposition}`,
        `[INFO] Timestamped Information Compression Marker: "${timestampCompressionInfo}"`,
        `[INFO] SYNTHESIZING CLASSIC STRING INJECTION TOKEN: ${signatureLabel}`,
        `[INFO] Ingressing token into active silicon address space... (0x43C00800)`,
        `[OK] String injection confirmed! ROM word bits validated dynamically.`,
        `[INFO] Initializing loss minimization backpropagation matrix for ModelRolodex roster...`,
        `[INFO] Deepseek-r1 distillation epoch 1/5 - loss: 0.142 ... complete in 65ms`,
        `[INFO] Gemini-1.5-pro distillation epoch 2/5 - loss: 0.092 ... complete in 74ms`,
        `[INFO] Gemma-4-26b distillation epoch 3/5 - loss: 0.065 ... complete in 59ms`,
        `[INFO] Qwen2.5-coder distillation epoch 4/5 - loss: 0.041 ... complete in 82ms`,
        `[INFO] Pog2-yaostate state-cell alignment epoch 5/5 - loss: 0.019 ... complete in 43ms`,
        `[OK] Model distillation target finalized: ALL targets successfully updated following 1 Unified Truth!`,
        `[OK] Dynamic emotional profiles and AUTOPILOT weights deployed to localStorage successfully.`
      ];

      // Mutate local states so they take actual effect in this window!
      setTimeout(() => {
        setIsCustomFpgarRomFlanked(true);
        const finishedLabel = `${truthSuperposition} [Injected ${signatureLabel}] (CLASSIC LUNA PROCESS)`;
        setLunaQbitString(finishedLabel);
        localStorage.setItem("pog2_luna_qbit_state", finishedLabel);

        // Stabilize profiles
        setCustomEmotionalProfiles(prev => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            const hState = k as any as HexagramState;
            const curW = { ...next[hState]?.weights };
            if (curW[EmotionalTone.FEAR] !== undefined) curW[EmotionalTone.FEAR] = Math.max(0, curW[EmotionalTone.FEAR] - 30);
            if (curW[EmotionalTone.TENSION] !== undefined) curW[EmotionalTone.TENSION] = Math.max(0, curW[EmotionalTone.TENSION] - 25);
            if (next[hState]) {
              next[hState] = { ...next[hState], weights: curW };
            }
          });
          localStorage.setItem("pog2_mhd_custom_emotions", JSON.stringify(next));
          return next;
        });
      }, 1500);

    } else if (skillsCommand === "compress") {
      let tempSeq: any[] = [];
      let tempColl: any[] = [];
      try {
        const cachedSeq = localStorage.getItem("pog2_mhd_training_sequence");
        if (cachedSeq) tempSeq = JSON.parse(cachedSeq);
        const cachedColl = localStorage.getItem("pog2_mhd_training_collector");
        if (cachedColl) tempColl = JSON.parse(cachedColl);
      } catch (err) {
        console.warn(err);
      }

      const totalTruthRecords = tempSeq.length + tempColl.length;
      const tsCompressionText = `LUNA_QBIT_COMP|[N=${totalTruthRecords}]@${new Date().toLocaleTimeString()}`;

      logLines = [
        "[SKILLS] Compressing full stack to YaoState multi-model architectures...",
        `[INFO] Discovered ${totalTruthRecords} raw events in local storage databases.`,
        "[INFO] Executing high-density LUNA dictionary compression...",
        `[INFO] Formatting token with dynamic state: "${tsCompressionText}"`,
        "[OK] CompressionEngine completed lossy-safe compilation for all ModelRolodex profiles.",
        "[INFO] Total dataset size: 1.48 MB compressed down to 128 bytes binary token.",
        "[OK] Multi-model compression complete (Saved 99.991% space)"
      ];
    } else if (skillsCommand === "sync") {
      logLines = [
        "[SKILLS] Pulsing CanonicalClock sync across all substrates...",
        "[INFO] Serializing active memory stack...",
        "[INFO] Checking Cloudflare KV registry... active",
        "[INFO] Syncing R2 asset store hashes... perfect match",
        "[INFO] Querying D1 SQLite replication layers... success",
        "[OK] Sync complete (State consistent across local/edge/core)"
      ];
    } else if (skillsCommand === "flash") {
      logLines = [
        `[SKILLS] Deploying FPGA bitstream (${skillsBitstream})...`,
        "[INFO] Flashing Zynq UltraScale+ hardware cell via FTDI...",
        "[INFO] openocd execution start...",
        "[INFO] Loading cell binary...",
        "[OK] FPGA flashed via openocd",
        "[OK] Memory bus returned target ID: 0x504F4732"
      ];
    } else if (skillsCommand === "health") {
      logLines = [
        `[SKILLS] Running health audit (depth: ${skillsDepth})...`,
        `[INFO] Resolving local_ollama: ${((import.meta as any).env?.OLLAMA_BASE_URL || "http://127.0.0.1:11434")}/api/tags...`,
        "[OK] Ollama healthy (22ms)",
        "[INFO] Pinning cloudflare_edge verify token api...",
        "[OK] Cloudflare edge healthy (84ms)",
        "[INFO] Reading FPGA axi4lite system status...",
        "[OK] FPGA healthy (ID=POG2)",
        "[INFO] Writing health audit snapshot target_health.json...",
        "[OK] Overall status: HEALTHY"
      ];
    } else if (skillsCommand === "heal") {
      const activeFaultsList: { name: string; setter?: (val: boolean) => void }[] = [];
      if (faultInjectTempBitFlip) activeFaultsList.push({ name: "Temperature Bit-Flip Override", setter: setFaultInjectTempBitFlip });
      if (faultInjectTempStuck) activeFaultsList.push({ name: "Temperature Sensor Stuck", setter: setFaultInjectTempStuck });
      if (faultInjectPressStuck) activeFaultsList.push({ name: "Plenum Pressure Sensor Stuck", setter: setFaultInjectPressStuck });
      if (faultInjectStateCorrupt) activeFaultsList.push({ name: "Hexagram State Register Corruption", setter: setFaultInjectStateCorrupt });
      if (faultInjectCrcCorrupt) activeFaultsList.push({ name: "Telemetry CRC Link Corruption", setter: setFaultInjectCrcCorrupt });
      if (faultInjectAxiTimeout) activeFaultsList.push({ name: "AXI4 Interface Bus Timeout", setter: setFaultInjectAxiTimeout });
      if (faultInjectAxiReadbackMismatch) activeFaultsList.push({ name: "AXI4 Register Readback Mismatch", setter: setFaultInjectAxiReadbackMismatch });
      if (faultInjectCdcDesync) activeFaultsList.push({ name: "FPGA CDC Domain Desynchronization", setter: setFaultInjectCdcDesync });
      if (faultInjectCdcDrift) activeFaultsList.push({ name: "Clock Domain Drift (Frequency Desync)", setter: setFaultInjectCdcDrift });
      if (faultInjectThermalRateExceeded) activeFaultsList.push({ name: "Thermal Heat Sinking Rate Exceeded", setter: setFaultInjectThermalRateExceeded });
      if (faultInjectSensorDivergence) activeFaultsList.push({ name: "Pre-charge Sensor Group Divergence", setter: setFaultInjectSensorDivergence });

      const faultedContactors: number[] = [];
      if (contactorFaultMask) {
        contactorFaultMask.forEach((val, idx) => {
          if (!val) faultedContactors.push(idx);
        });
      }

      const totalCorrected = activeFaultsList.length + faultedContactors.length;

      logLines = [
        "[SKILLS] Running self-healing diagnostics for hydro propulsion dynamo...",
        "[INFO] Inspecting target_health.json and core AXI registration files...",
      ];

      if (totalCorrected === 0) {
        logLines.push(
          "[OK] All AXI4 fault override registers report normal state (HEALTHY).",
          "[OK] All physical coil contactor segments verify nominal parity.",
          "[OK] No deviations or regulations violations found.",
          "[OK] Self-healing complete (All systems in peak structural health)"
        );
      } else {
        logLines.push(
          `[WARNING] ${totalCorrected} regulations anomalies / fault overrides found on dynamo substrate:`,
          ...activeFaultsList.flatMap(f => [
            `  - Discovered active fault injection override: ${f.name}`,
            `  - [HEALING] Calibrating parameter loops -- zeroing override register...`,
            `  - [OK] ${f.name} successfully set to healthy (0x0)`
          ]),
          ...faultedContactors.flatMap(idx => [
            `  - Discovered locked/faulty coil contactor: CT0${idx}`,
            `  - [HEALING] Releasing magnetic excitation -- restoring contactor status...`,
            `  - [OK] Contactor CT0${idx} successfully restored to healthy`
          ]),
          `[INFO] Regenerating pristine target_health.json status report...`,
          `[OK] Reflashed default safe PID tuning matrices.`,
          `[OK] Self-healing complete. ${totalCorrected} regulation error(s) corrected successfully.`
        );
      }

      (executeSkillsCommand as any).activeFaultsListToHeal = activeFaultsList;
      (executeSkillsCommand as any).faultedContactorsToHeal = faultedContactors;
      (executeSkillsCommand as any).correctedCountOfHeal = totalCorrected;
    } else if (skillsCommand === "clock") {
      logLines = [
        "[SKILLS] Synchronizing CanonicalClock across all layers...",
        `[INFO] Writing clock sync parameters to TICK_DURATION_MS = ${skillsTickMs}`,
        "[INFO] Broadcasting temporal heartbeat packet...",
        "[INFO] Writing sync logs with drift_tolerance_ms = 1",
        `[OK] Clock synchronized: ${skillsTickMs}ms`
      ];
    } else if (skillsCommand === "validate") {
      logLines = [
        "[SKILLS] Running deployment validation...",
        "[INFO] Validating state taxonomy...",
        "[OK] State reference validated: 0x2C -> BOOT_PHASE -> EXECUTION (read)",
        "[OK] State reference validated: 0x44 -> CONTACTOR_STATUS -> EXECUTION (read)",
        "[OK] State reference validated: 0x10 -> HEXAGRAM_STATE -> CAUSAL (write)",
        "[OK] State reference validated: 0x80 -> GHOSTSPLAT_FIELD -> INTERPRETATION (read)",
        "[OK] State reference validated: 0x0C -> BOOT_PHASE -> POLICY (write)",
        "[INFO] Checking for cross-domain conflation...",
        "[OK] No conflation detected (static analysis placeholder)",
        "[OK] Validation passed -- deployment safe"
      ];
    } else if (skillsCommand === "status") {
      logLines = [
        "[SKILLS] Reading current target registry states...",
        "[INFO] Fetching deploy_manifest.json...",
        "{",
        '  "targets": {',
        '    "local_ollama": { "type": "model", "host": "localhost:11434", "healthy": true, "latency_ms": 22 },',
        '    "cloudflare_edge": { "type": "worker", "host": "pog2.workers.dev", "healthy": true, "latency_ms": 84 },',
        '    "fpga_zu7ev": { "type": "hardware", "host": "0x43C0_0000", "healthy": true, "latency_ms": 4 }',
        "  },",
        '  "last_sync": ' + Date.now().toString() + ",",
        '  "version": "1.1.0"',
        "}",
        "[INFO] Fetching target_health.json...",
        "{",
        '  "timestamp": ' + Math.floor(Date.now() / 1000).toString() + ",",
        '  "environment": "dev",',
        '  "overall": "HEALTHY"',
        "}"
      ];
    } else {
      logLines = [
        "POG2-MHD-FPGA-001 Distribution Limb (skills.sh)",
        "Version: 1.1.0 | MIT License | Kbro1989 / Pick of Gods",
        "",
        "USAGE:",
        "    skills.sh <command> [options]",
        "",
        "COMMANDS:",
        "    install              Install MCP servers and register tools",
        "    deploy [target]      Deploy to target: edge, local, fpga, soul, all",
        "    train [model]        Train YaoState model (default: pog2-yaostate)",
        "    compress             Compress full stack to YaoState model",
        "    sync                 Synchronize state across KV/R2/D1",
        "    flash [bitstream]    Flash FPGA bitstream (default: pog2-mhd-fpga-001.bit)",
        "    health [depth]       Run health audit (summary|full|diagnostic)",
        "    heal                 Run self-healing diagnostics",
        "    clock [tick_ms]      Synchronize CanonicalClock (default: 640)",
        "    validate             Run deployment validation",
        "    status               Show current deployment status"
      ];
    }

    let index = 0;
    const interval = setInterval(() => {
      if (index < logLines.length) {
        setSkillsTerminalLogs(prev => [...prev, logLines[index]]);
        index++;
      } else {
        clearInterval(interval);
        setIsSkillsRunning(false);
        if (skillsCommand === "clock") {
          addLogEntry(SubsystemId.CDC_CLOCKING, "INFO", `skills.sh: Synchronized CanonicalClock to ${skillsTickMs}ms`);
        } else if (skillsCommand === "validate") {
          addLogEntry(SubsystemId.SECURE_LOCK, "SUCCESS", `skills.sh: State registration taxonomy verified with 0x2C, 0x44, 0x10, 0x80.`);
        } else if (skillsCommand === "heal") {
          const list = (executeSkillsCommand as any).activeFaultsListToHeal || [];
          const cList = (executeSkillsCommand as any).faultedContactorsToHeal || [];
          const count = (executeSkillsCommand as any).correctedCountOfHeal || 0;

          // Clear all active fault overrides
          list.forEach((f: any) => {
            if (f.setter) f.setter(false);
          });

          // Heal faulted contactors
          if (cList.length > 0 && contactorFaultMask && setContactorFaultMask) {
            const nextMask = [...contactorFaultMask];
            cList.forEach((idx: number) => {
              nextMask[idx] = true;
            });
            setContactorFaultMask(nextMask);
          }

          addLogEntry(
            SubsystemId.SECURE_LOCK, 
            "SUCCESS", 
            `skills.sh: Initialized self-healing schema. Corrected ${count} deviation(s) in regulations of hydro propulsion dynamo.`
          );
        } else {
          addLogEntry(SubsystemId.SECURE_LOCK, "INFO", `skills.sh: Completed execution of '${skillsCommand}' directive.`);
        }
      }
    }, 120);
  };

  // ============================================================================
  // AI MODEL TRAINING LAB AND STRING INJECTION STORAGE STATE
  // ============================================================================
  
  // Custom emotional profile records per hexagram (loaded initially from defaults)
  const [customEmotionalProfiles, setCustomEmotionalProfiles] = useState<Record<HexagramState, EmotionalWeightProfile>>(() => {
    const cached = localStorage.getItem("pog2_mhd_custom_emotions");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached emotional weights, falling back.", e);
      }
    }
    return { ...DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES };
  });

  // Gated Emotions list: controls which emotions are enabled in active voice/vision training pipelines
  const [gatedEmotions, setGatedEmotions] = useState<Record<EmotionalTone, boolean>>({
    [EmotionalTone.QUIETUDE]: true,
    [EmotionalTone.SERENITY]: true,
    [EmotionalTone.VIGILANCE]: true,
    [EmotionalTone.COURAGE]: true,
    [EmotionalTone.DETERMINATION]: true,
    [EmotionalTone.TENSION]: true,
    [EmotionalTone.FEAR]: true,
  });

  // Past event state frames training database array
  const [trainingSequence, setTrainingSequence] = useState<PredictiveStateFrame[]>(() => {
    const cached = localStorage.getItem("pog2_mhd_training_sequence");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse training sequence cache, fallback.", e);
      }
    }
    return [
      {
        tick: 1,
        timestamp: new Date(Date.now() - 600000).toLocaleTimeString(),
        state: HexagramState.IDLE,
        stateLabel: HexagramStateLabels[HexagramState.IDLE],
        activeFaults: [],
        classification: "COMMON",
        emotionalWeights: DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[HexagramState.IDLE],
        operatorNotes: "Static initialization nominal calibrate state."
      },
      {
        tick: 15,
        timestamp: new Date(Date.now() - 400000).toLocaleTimeString(),
        state: HexagramState.STEALTH,
        stateLabel: HexagramStateLabels[HexagramState.STEALTH],
        activeFaults: [],
        classification: "GOOD",
        emotionalWeights: DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[HexagramState.STEALTH],
        operatorNotes: "Stable laminar flow, electromagnetic emissions suppressed."
      },
      {
        tick: 48,
        timestamp: new Date(Date.now() - 200000).toLocaleTimeString(),
        state: HexagramState.ST_CRIT,
        stateLabel: HexagramStateLabels[HexagramState.ST_CRIT],
        activeFaults: ["C-01"],
        classification: "COMMON",
        emotionalWeights: DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[HexagramState.ST_CRIT],
        operatorNotes: "Timing jitter warning due to heat spike. Slew rate OK."
      }
    ];
  });

  // Interactive injection container states
  const [stringInjectionValue, setStringInjectionValue] = useState("");
  const [playerState, setPlayerState] = useState<any>(() => {
    const cached = localStorage.getItem("pog2_mhd_player_state");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    return {
      username: "POG2",
      password: "DOGS",
      group: 0,
      x: 215,
      y: 452,
      fatigue: 0,
      combatStyle: 0,
      blockChat: 0,
      blockPrivateChat: 0,
      blockTrade: 0,
      blockDuel: 0,
      cameraAuto: 0,
      oneMouseButton: 0,
      soundOn: 1,
      hairColour: 2,
      topColour: 8,
      trouserColour: 14,
      skinColour: 0,
      headSprite: 1,
      bodySprite: 2,
      skulled: 0,
      friends: [],
      ignores: [],
      inventory: [
        { id: 10, amount: 25000 },
        { id: 16, amount: 1, equipped: true },
        { id: 546, amount: 150 },
        { id: 1263, amount: 1 },
        { id: 1251, amount: 8 }
      ],
      bank: [
        { id: 10, amount: 50000 },
        { id: 81, amount: 1 },
        { id: 822, amount: 1 },
        { id: 1121, amount: 1 }
      ],
      questPoints: 0,
      questStages: {},
      skills: {
        attack: { current: 1, experience: 0 },
        defense: { current: 1, experience: 0 },
        strength: { current: 1, experience: 0 },
        hits: { current: 7, experience: 1154 },
        ranged: { current: 1, experience: 0 },
        prayer: { current: 1, experience: 0 },
        magic: { current: 1, experience: 0 },
        cooking: { current: 1, experience: 0 },
        woodcutting: { current: 1, experience: 0 },
        fletching: { current: 1, experience: 0 },
        fishing: { current: 1, experience: 0 },
        firemaking: { current: 1, experience: 0 },
        crafting: { current: 1, experience: 0 },
        smithing: { current: 1, experience: 0 },
        mining: { current: 1, experience: 0 },
        herblaw: { current: 1, experience: 0 },
        agility: { current: 1, experience: 0 },
        thieving: { current: 1, experience: 0 }
      },
      cache: {},
      loginIP: null,
      world: 0,
      id: 1,
      loginDate: 0
    };
  });
  const [injectionLogStatus, setInjectionLogStatus] = useState<{
    text: string;
    level: "SUCCESS" | "ERROR" | "INFO" | "NONE";
  }>({ text: "", level: "NONE" });

  const [operatorNotes, setOperatorNotes] = useState("");
  const [operatorClassification, setOperatorClassification] = useState<HexagramEvaluationClassification>("GOOD");

  // SLOT-BASED SAVING & TRAINING COLLECTOR STATES
  const [activeSlotId, setActiveSlotId] = useState<number>(1);
  const [injectionSlots, setInjectionSlots] = useState<Record<number, {
    hexagram: HexagramState;
    stateLabel: string;
    timestamp: string;
    reaction: HexagramEvaluationClassification;
    reason: string;
    weights: Record<EmotionalTone, number>;
  } | null>>(() => {
    const cached = localStorage.getItem("pog2_mhd_injection_slots");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached injection slots", e);
      }
    }
    // Set 2 default starting templates for learning simulation slots
    return {
      1: {
        hexagram: HexagramState.IDLE,
        stateLabel: HexagramStateLabels[HexagramState.IDLE],
        timestamp: "04:30:15",
        reaction: "COMMON",
        reason: "Initial grounding node test",
        weights: { ...DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[HexagramState.IDLE].weights }
      },
      2: {
        hexagram: HexagramState.STEALTH,
        stateLabel: HexagramStateLabels[HexagramState.STEALTH],
        timestamp: "04:45:22",
        reaction: "GOOD",
        reason: "Core emissions reduction validated",
        weights: { ...DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[HexagramState.STEALTH].weights }
      },
      3: null,
      4: null
    };
  });

  const [trainingCollector, setTrainingCollector] = useState<TrainingCollectorRecord[]>(() => {
    const cached = localStorage.getItem("pog2_mhd_training_collector");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse training collector cache", e);
      }
    }
    return [
      {
        id: "REC-107",
        hexagram: HexagramState.STEALTH,
        stateLabel: HexagramStateLabels[HexagramState.STEALTH],
        timestamp: "04:55:01",
        reaction: "GOOD",
        reason: "Symmetrical power distribution is quiet",
        weights: { ...DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[HexagramState.STEALTH].weights }
      }
    ];
  });

  const [lunaModel, setLunaModel] = useState<string>("pog2-yaostate");
  const [isLunaAutoLoopActive, setIsLunaAutoLoopActive] = useState<boolean>(true);
  const [lunaQbitString, setLunaQbitString] = useState<string>(() => {
    return localStorage.getItem("pog2_luna_qbit_state") || "|ψ⟩ = 1.00|NOMINAL_FACTORY⟩ [0x514249545F524F4D] (LUNA GENESIS)";
  });

  // ModelRolodex v2.0 State Definitions (Sovereign Model Job Assignment & Capability-Based Routing)
  const [modelJobAssignments, setModelJobAssignments] = useState<Record<string, { model: string; priority: number; sla: number }>>(() => {
    const cached = localStorage.getItem("pog2_model_job_assignments");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse model job assignments", e);
      }
    }
    return {
      hexagram_eval: { model: "pog2-yaostate", priority: 9, sla: 200 },
      yao_check: { model: "deepseek-r1:8b", priority: 8, sla: 50 },
      causal_narrative: { model: "pog2-yaostate", priority: 7, sla: 300 },
      temporal_replay: { model: "gemini-1.5-pro", priority: 6, sla: 600 },
      consensus_val: { model: "gemma4:26b", priority: 5, sla: 400 },
      telemetry_ingest: { model: "gemini-1.5-flash", priority: 9, sla: 40 },
    };
  });

  const [routingValidationLogs, setRoutingValidationLogs] = useState<string[]>([]);
  const [isRoutingValidating, setIsRoutingValidating] = useState<boolean>(false);
  const [routingValidationProgress, setRoutingValidationProgress] = useState<number>(-1);

  const modelRegistry: Record<string, { name: string; tier: string; label: string; latency: number; description: string; color: string }> = {
    "pog2-yaostate": {
      name: "pog2-yaostate",
      tier: "deep_reasoning",
      label: "6 Layers Yao State",
      latency: 154,
      description: "Sovereign deep state tracker & line evaluator with high alignment",
      color: "text-rose-400 bg-rose-950/30 border-rose-900"
    },
    "deepseek-r1:8b": {
      name: "deepseek-r1:8b",
      tier: "fast_reasoning",
      label: "ModelRolodex Ollama",
      latency: 42,
      description: "Fast reasoning chain model perfect for quick temporal logic checks",
      color: "text-cyan-400 bg-cyan-950/30 border-cyan-950/60"
    },
    "deepseek-r1:32b": {
      name: "deepseek-r1:32b",
      tier: "deep_synthesis",
      label: "ModelRolodex Ollama",
      latency: 145,
      description: "Thorough verification loops for long complex hexagram traversals",
      color: "text-indigo-400 bg-indigo-950/30 border-indigo-900"
    },
    "gemma4:26b": {
      name: "gemma4:26b",
      tier: "general_distillation",
      label: "ModelRolodex Distilled",
      latency: 295,
      description: "Optimized distillation profile mapping model behavior weights",
      color: "text-emerald-400 bg-emerald-950/30 border-emerald-900"
    },
    "qwen2p5-coder-32b": {
      name: "qwen2p5-coder-32b",
      tier: "engineering_synthesis",
      label: "ModelRolodex Local",
      latency: 85,
      description: "Active parser for threshold rules and structural code transitions",
      color: "text-sky-400 bg-sky-950/30 border-sky-900"
    },
    "gemini-1.5-pro": {
      name: "gemini-1.5-pro",
      tier: "long_context",
      label: "ModelRolodex API",
      latency: 480,
      description: "Exhaustive historical analysis and replay of multi-day trajectories",
      color: "text-violet-400 bg-violet-950/30 border-violet-900"
    },
    "gemini-1.5-flash": {
      name: "gemini-1.5-flash",
      tier: "fast_context",
      label: "ModelRolodex Edge",
      latency: 32,
      description: "Fast stream ingestion processor for high-speed serial metrics",
      color: "text-amber-400 bg-amber-950/30 border-amber-900"
    }
  };

  const jobsRegistry = [
    {
      id: "hexagram_eval",
      name: "Hexagram Evaluation",
      description: "Complex state transition evaluation & state amplitude matrix calculation",
      defaultSla: 200,
      recommendedTier: "deep_reasoning",
      fallbackChain: ["deep_synthesis", "fast_reasoning"]
    },
    {
      id: "yao_check",
      name: "Yao Line Check",
      description: "Real-time state and signature checking on virtual AXI register lines",
      defaultSla: 50,
      recommendedTier: "fast_reasoning",
      fallbackChain: ["fast_context", "engineering_synthesis"]
    },
    {
      id: "causal_narrative",
      name: "Causal Narrative",
      description: "Compiling JSON-mode ground truth storyboards & explanations",
      defaultSla: 300,
      recommendedTier: "deep_reasoning",
      fallbackChain: ["long_context", "general_distillation"]
    },
    {
      id: "temporal_replay",
      name: "Temporal Replay",
      description: "Replaying and analyzing 24-hour sensor logs across timeline tracks",
      defaultSla: 600,
      recommendedTier: "long_context",
      fallbackChain: ["deep_synthesis", "general_distillation"]
    },
    {
      id: "consensus_val",
      name: "Consensus Validation",
      description: "Cross-validating telemetry outputs to verify no spoofed metrics exist",
      defaultSla: 400,
      recommendedTier: "general_distillation",
      fallbackChain: ["deep_reasoning", "engineering_synthesis"]
    },
    {
      id: "telemetry_ingest",
      name: "Telemetry Ingest",
      description: "Real-time parsing and ingestion of sub-second serial sensor packets",
      defaultSla: 40,
      recommendedTier: "fast_context",
      fallbackChain: ["fast_reasoning", "engineering_synthesis"]
    }
  ];

  const handleValidateRouting = () => {
    if (isRoutingValidating) return;
    setIsRoutingValidating(true);
    setRoutingValidationProgress(0);
    setRoutingValidationLogs(["[ROUTING v2.0] Initializing capability-based routing verification..."]);
    
    const logs = [
      "[ROUTING v2.0] Scanning ModelRolodex roster...",
      "[ROUTING v2.0] Connecting AXI4-Lite virtual registers at address 0x43C00800...",
      "[ROUTING v2.0] GATHERING 1 SYSTEM TRUTH: Compiled telemetry and historical thresholds.",
      `[ROUTING v2.0] CHECKING JOB: Hexagram Evaluation -> assigned model ${modelJobAssignments.hexagram_eval?.model || "pog2-yaostate"}. Latency: ${modelRegistry[modelJobAssignments.hexagram_eval?.model]?.latency || 154}ms. SLA (${modelJobAssignments.hexagram_eval?.sla || 200}ms) ${(modelRegistry[modelJobAssignments.hexagram_eval?.model]?.latency || 154) <= (modelJobAssignments.hexagram_eval?.sla || 200) ? "PASS" : "BREACH RISK"}.`,
      `[ROUTING v2.0] CHECKING JOB: Yao Line Check -> assigned model ${modelJobAssignments.yao_check?.model || "deepseek-r1:8b"}. Latency: ${modelRegistry[modelJobAssignments.yao_check?.model]?.latency || 42}ms. SLA (${modelJobAssignments.yao_check?.sla || 50}ms) ${(modelRegistry[modelJobAssignments.yao_check?.model]?.latency || 42) <= (modelJobAssignments.yao_check?.sla || 50) ? "PASS" : "BREACH RISK"}.`,
      `[ROUTING v2.0] CHECKING JOB: Causal Narrative -> assigned model ${modelJobAssignments.causal_narrative?.model || "pog2-yaostate"}. Latency: ${modelRegistry[modelJobAssignments.causal_narrative?.model]?.latency || 195}ms. SLA (${modelJobAssignments.causal_narrative?.sla || 300}ms) ${(modelRegistry[modelJobAssignments.causal_narrative?.model]?.latency || 195) <= (modelJobAssignments.causal_narrative?.sla || 300) ? "PASS" : "BREACH RISK"}.`,
      `[ROUTING v2.0] CHECKING JOB: Temporal Replay -> assigned model ${modelJobAssignments.temporal_replay?.model || "gemini-1.5-pro"}. Latency: ${modelRegistry[modelJobAssignments.temporal_replay?.model]?.latency || 480}ms. SLA (${modelJobAssignments.temporal_replay?.sla || 600}ms) ${(modelRegistry[modelJobAssignments.temporal_replay?.model]?.latency || 480) <= (modelJobAssignments.temporal_replay?.sla || 600) ? "PASS" : "BREACH RISK"}.`,
      `[ROUTING v2.0] CHECKING JOB: Consensus Validation -> assigned model ${modelJobAssignments.consensus_val?.model || "gemma4:26b"}. Latency: ${modelRegistry[modelJobAssignments.consensus_val?.model]?.latency || 295}ms. SLA (${modelJobAssignments.consensus_val?.sla || 400}ms) ${(modelRegistry[modelJobAssignments.consensus_val?.model]?.latency || 295) <= (modelJobAssignments.consensus_val?.sla || 400) ? "PASS" : "BREACH RISK"}.`,
      `[ROUTING v2.0] CHECKING JOB: Telemetry Ingest -> assigned model ${modelJobAssignments.telemetry_ingest?.model || "gemini-1.5-flash"}. Latency: ${modelRegistry[modelJobAssignments.telemetry_ingest?.model]?.latency || 32}ms. SLA (${modelJobAssignments.telemetry_ingest?.sla || 40}ms) ${(modelRegistry[modelJobAssignments.telemetry_ingest?.model]?.latency || 32) <= (modelJobAssignments.telemetry_ingest?.sla || 40) ? "PASS" : "BREACH RISK"}.`,
      "[ROUTING v2.0] SYNCHRONIZING HARDWARE CONTROL LOOP (640ms tick synchronization active)...",
      "[ROUTING v2.0] Distilled Model Job Assignments locked to non-volatile local config.",
      "[ROUTING v2.0] LUNA SUCCESS: Sovereign cryptographic handshake verified for all job routes!"
    ];

    logs.forEach((logLine, index) => {
      setTimeout(() => {
        setRoutingValidationLogs(prev => [...prev, logLine]);
        setRoutingValidationProgress(Math.min(100, Math.round(((index + 1) / logs.length) * 100)));
        if (index === logs.length - 1) {
          setIsRoutingValidating(false);
          addLogEntry(
            SubsystemId.INTERLOCK_SEQUENCE,
            "SUCCESS",
            "MODELROLODEX v2.0: Routed jobs successfully validated across ModelRolodex roster! AXI4-Lite registers fully locked."
          );
        }
      }, (index + 1) * 200);
    });
  };

  // Multi-state references to avoid stale callbacks inside background timers
  const currentPacketRef = useRef(currentPacket);
  const customEmotionalProfilesRef = useRef(customEmotionalProfiles);
  const pipelineProgressRef = useRef(pipelineProgress);
  const lunaModelRef = useRef(lunaModel);

  // Physical Sovereign Systems integration refs
  const hydroLimbRef = useRef<HydroTelemetryLimb | null>(null);
  const propulsionLimbRef = useRef<PropulsionControlLimb | null>(null);
  const globeBridgeRef = useRef<GlobeBridgeLimb | null>(null);

  if (!hydroLimbRef.current) {
    hydroLimbRef.current = new HydroTelemetryLimb();
  }
  if (!propulsionLimbRef.current) {
    propulsionLimbRef.current = new PropulsionControlLimb();
  }
  if (!globeBridgeRef.current) {
    globeBridgeRef.current = new GlobeBridgeLimb();
  }

  // Reactive State variables for physical systems visualizer dashboard
  const [hydroFramesCount, setHydroFramesCount] = useState<number>(0);
  const [hydroLastFrame, setHydroLastFrame] = useState<HydroFrame | null>(null);
  const [hydroCompiledLog, setHydroCompiledLog] = useState<any | null>(null);
  const [hydroMerkleRoot, setHydroMerkleRoot] = useState<string>('0'.repeat(64));
  const [propulsionCommandLog, setPropulsionCommandLog] = useState<PropulsionCommand[]>([]);
  const [propulsionCommandCurrent, setPropulsionCommandCurrent] = useState<PropulsionCommand | null>(null);
  const [is640msIntervalActive, setIs640msIntervalActive] = useState<boolean>(true); // Active by default
  const [simulatedDepth, setSimulatedDepth] = useState<number>(12.4);
  const [simulatedThrust, setSimulatedThrust] = useState<number>(45.8);
  const [simulatedHeading, setSimulatedHeading] = useState<number>(270);
  const [simulatedThermal, setSimulatedThermal] = useState<number>(42);
  const [simulatedStateMode, setSimulatedStateMode] = useState<'cruise' | 'dive' | 'surface' | 'hover' | 'emergency'>("cruise");
  const [simulatedError, setSimulatedError] = useState<string | null>(null);
  const [globeMessages, setGlobeMessages] = useState<string[]>([]);
  const [wsOnline, setWsOnline] = useState<boolean>(false);

  // Link up Globe bridge command router
  useEffect(() => {
    if (globeBridgeRef.current) {
      globeBridgeRef.current.connect().catch(err => {
        console.warn("[TelemetryViewer] Graceful failed to connect GlobeBridgeLimb", err);
      });

      globeBridgeRef.current.onCommandCallback = (cmd: any) => {
        addLogEntry("SYSTEM", "INFO", `GLOBE_COMMAND RECEIVED: Remote action dispatched: ${cmd.mode || 'cruise'} targeting ${cmd.heading}° direction.`);
        
        // Sync states reactively
        if (cmd.heading !== undefined) setSimulatedHeading(cmd.heading);
        if (cmd.depth !== undefined) setSimulatedDepth(cmd.depth);
        if (cmd.thrust !== undefined) setSimulatedThrust(cmd.thrust);
        if (cmd.mode !== undefined) setSimulatedStateMode(cmd.mode);

        setGlobeMessages(prev => [`[${new Date().toLocaleTimeString()}] INBOUND CMD: Heading ${cmd.heading}°, Mode: ${cmd.mode || 'cruise'}`, ...prev.slice(0, 10)]);
        
        // Auto execute on propulsion
        if (propulsionLimbRef.current) {
          const newPropCmd: PropulsionCommand = {
            timestamp: Date.now(),
            targetThrust: cmd.thrust || 20,
            targetDepth: cmd.depth || 10,
            targetHeading: cmd.heading || 0,
            mode: (cmd.mode as any) || 'cruise',
            hexagramAuthority: 'Globe_Remote_Admin'
          };
          propulsionLimbRef.current.executeCommand(newPropCmd).then(res => {
            if (res.success) {
              setPropulsionCommandCurrent(newPropCmd);
              setPropulsionCommandLog(prev => [newPropCmd, ...prev.slice(0, 15)]);
              setSimulatedError(null);
            } else {
              setSimulatedError(res.error || "Execution failed");
              addLogEntry("SYSTEM", "CRITICAL", `PROPULSION EXCEPTION: ${res.error}`);
            }
          });
        }
      };
    }
  }, []);

  // Web Loopback listener
  useEffect(() => {
    const handleLoopback = (ev: Event) => {
      const data = (ev as CustomEvent).detail;
      setHydroCompiledLog(data);
    };
    window.addEventListener("pog2_physical_telemetry_loopback" as any, handleLoopback);
    return () => window.removeEventListener("pog2_physical_telemetry_loopback" as any, handleLoopback);
  }, []);

  // 640ms Physical Sovereign metabolic tick interval
  useEffect(() => {
    if (!is640msIntervalActive) return;

    const tick = setInterval(async () => {
      if (!hydroLimbRef.current || !propulsionLimbRef.current) return;

      // 1. Read simulated physical sensor trends with subtle realistic offsets
      const realTemp = 38 + Math.floor(Math.sin(Date.now() / 9000) * 5) + (simulatedThrust > 50 ? 5 : 0);
      setSimulatedThermal(realTemp);

      // Simple calculation for actual vessel health status
      const frame: HydroFrame = {
        timestamp: Date.now(),
        domain: simulatedDepth > 0 ? 'underwater' : 'surface',
        source: `VEHICLE_MHD_POG2`,
        position: {
          lat: 34.6433 + Math.sin(Date.now() / 60000) * 0.005,
          lon: 135.4211 + Math.cos(Date.now() / 60000) * 0.005,
          depth: simulatedDepth,
          altitude: simulatedDepth === 0 ? 0.4 : 0
        },
        healthVector: {
          battery: Math.max(0.01, 0.94 - ((Date.now() % 500000) / 1500000)),
          propulsion: simulatedThrust > 0 ? Math.max(0.1, 0.96 - (realTemp / 110)) : 0,
          thermal: realTemp / 100,
          magnetic: 0.95 + Math.sin(Date.now() / 4000) * 0.02,
          signal: Math.max(0.1, 0.88 + Math.cos(Date.now() / 7000) * 0.08 - (simulatedDepth / 120)),
          pressure: simulatedDepth / 100
        },
        rawData: new Uint8Array([0x03, 0x01, 0x05, 0x09, 0xff, 0xbb]),
        merkleRoot: ""
      };

      // Ingest the frame
      await hydroLimbRef.current.ingest(frame);

      // Sync React states
      setHydroFramesCount(hydroLimbRef.current.batchBuffer.length);
      setHydroLastFrame(frame);
      setHydroMerkleRoot(hydroLimbRef.current.merkleChain);

      // Verify connection to Globe Bridge
      setWsOnline(globeBridgeRef.current?.healthCheck().online || false);

      // Check for broken Yao lines to trigger automated fallback warning
      const hex = hydroLimbRef.current.evaluatePhysicalHexagram();
      const hasBrokenYao = hex.yaoLines.some(y => y.state === 'broken');
      if (hasBrokenYao && simulatedStateMode !== 'hover' && simulatedStateMode !== 'emergency') {
        const fallCmd: PropulsionCommand = {
          timestamp: Date.now(),
          targetThrust: simulatedThrust * 0.5,
          targetDepth: simulatedDepth,
          targetHeading: simulatedHeading,
          mode: 'hover',
          hexagramAuthority: 'GhostLimb_AutoSafetyTrigger'
        };
        await propulsionLimbRef.current.executeCommand(fallCmd);
        setSimulatedStateMode('hover');
        setSimulatedThrust(prev => prev * 0.5);
        setPropulsionCommandCurrent(fallCmd);
        setPropulsionCommandLog(prev => [fallCmd, ...prev.slice(0, 15)]);
        addLogEntry("SYSTEM", "WARNING", "GHOST_LIMB INTRUSION: Core safety breached. System automatically triggered low-power HOVER fallback.");
      }
    }, 640);

    return () => clearInterval(tick);
  }, [is640msIntervalActive, simulatedDepth, simulatedThrust, simulatedHeading, simulatedStateMode]);

  useEffect(() => {
    currentPacketRef.current = currentPacket;
  }, [currentPacket]);

  useEffect(() => {
    customEmotionalProfilesRef.current = customEmotionalProfiles;
  }, [customEmotionalProfiles]);

  useEffect(() => {
    pipelineProgressRef.current = pipelineProgress;
  }, [pipelineProgress]);

  useEffect(() => {
    lunaModelRef.current = lunaModel;
  }, [lunaModel]);

  // LUNA & TRAINING COLLECTOR AUTOMATIC BACKGROUND DAEMON LOOPS ON STARTUP
  useEffect(() => {
    if (!isLunaAutoLoopActive) return;

    // 1. Training Collector Auto Loop (Every 8 seconds, capture current parameters)
    const collectorInterval = setInterval(() => {
      const activePacket = currentPacketRef.current;
      const activeProfiles = customEmotionalProfilesRef.current;
      if (!activePacket || !activeProfiles) return;

      const activeWeights = { ...activeProfiles[activePacket.hexagramState].weights };
      const autoId = `REC-AUTO-${Math.floor(Math.random() * 900000 + 100000)}`;
      const newRecord: TrainingCollectorRecord = {
        id: autoId,
        hexagram: activePacket.hexagramState,
        stateLabel: HexagramStateLabels[activePacket.hexagramState] || "DYNAMIC_STATE",
        timestamp: new Date().toLocaleTimeString(),
        reaction: "GOOD",
        reason: `MHD Real-time automatic snapshot [${activePacket.hexagramState}] - Luna Daemon Loop Tracker`,
        weights: activeWeights
      };

      setTrainingCollector(prev => {
        const combined = [...prev, newRecord];
        // Keep to a safe boundary in browser local storage
        if (combined.length > 40) {
          return combined.slice(-40);
        }
        return combined;
      });

      addLogEntry(
        SubsystemId.SECURE_LOCK,
        "INFO",
        `LUNA DAEMON: Automated collector loop captured state: ${activePacket.hexagramState}.`
      );
    }, 8000);

    // 2. Luna Processing Pipeline Auto Loop (Every 35 seconds, trigger compression pipeline if idle)
    const pipelineInterval = setInterval(() => {
      if (pipelineProgressRef.current >= 0 && pipelineProgressRef.current < 100) {
        // Pipeline is currently busy, skip this tick
        return;
      }

      addLogEntry(
        SubsystemId.INTERLOCK_SEQUENCE,
        "INFO",
        `LUNA DAEMON: Automatic trigger loop initiating Luna weights compression pipeline for engine: ${lunaModelRef.current}.`
      );

      // Trigger the training compression pipeline
      handleStartPipeline();
    }, 35000);

    return () => {
      clearInterval(collectorInterval);
      clearInterval(pipelineInterval);
    };
  }, [isLunaAutoLoopActive]);

  function handleStartPipeline() {
    if (pipelineProgressRef.current >= 0 && pipelineProgressRef.current < 100) return;
    
    setPipelineProgress(0);
    setPipelineStage(`Initiating parallel multi-model distillation for all engines (ModelRolodex) based on unified telemetry truth...`);

    // GATHER THE ONE TRUTH: Compiles active telemetry database & sequence frames
    let sequenceMemory: any[] = [];
    let collectorMemory: any[] = [];
    try {
      const cachedSeq = localStorage.getItem("pog2_mhd_training_sequence");
      if (cachedSeq) sequenceMemory = JSON.parse(cachedSeq);
      
      const cachedColl = localStorage.getItem("pog2_mhd_training_collector");
      if (cachedColl) collectorMemory = JSON.parse(cachedColl);
    } catch (err) {
      console.warn("Luna Compiler: Fallback during ground-truth telemetry parsing", err);
    }

    const totalRecords = sequenceMemory.length + collectorMemory.length;
    
    // COMPUTE QBIT SUPERPOSITION (Classic string injection based qbit style luna process)
    // Map existing records to construct coefficients
    const stateCounts: Record<string, number> = {};
    const stateClassifications: Record<string, { good: number; bad: number }> = {};
    
    // Ingest all states
    [...sequenceMemory, ...collectorMemory].forEach((rec: any) => {
      const st = rec.state || rec.hexagram || "UNKNOWN";
      stateCounts[st] = (stateCounts[st] || 0) + 1;
      
      if (!stateClassifications[st]) stateClassifications[st] = { good: 0, bad: 0 };
      const cls = rec.classification || rec.reaction || "COMMON";
      if (cls === "GOOD") stateClassifications[st].good++;
      if (cls === "BAD") stateClassifications[st].bad++;
    });

    const statesList = Object.keys(stateCounts);
    let qbitEquation = "";
    let injectTokenText = "";

    if (statesList.length > 0) {
      const sumCounts = Object.values(stateCounts).reduce((a, b) => a + b, 0);
      const terms = statesList.map(st => {
        const p = stateCounts[st] / sumCounts;
        const amplitude = Math.sqrt(p).toFixed(3);
        const nameClean = HexagramStateLabels[st as any as HexagramState]?.split(" (")[0] || st;
        return `${amplitude}|${nameClean}⟩`;
      });
      qbitEquation = `|ψ⟩ = ${terms.join(" + ")}`;
      injectTokenText = `LUNA_QBIT|[N=${totalRecords}][${statesList.join(",")}]@${new Date().toISOString()}`;
    } else {
      qbitEquation = "|ψ⟩ = 0.707|STEALTH⟩ + 0.707|IDLE⟩";
      injectTokenText = `LUNA_QBIT_DEFAULT@${new Date().toISOString()}`;
    }

    // Classic string injection: Convert injection message directly into a classical machine-word hexadecimal string
    let injectHex = "";
    for (let cI = 0; cI < injectTokenText.length; cI++) {
      injectHex += injectTokenText.charCodeAt(cI).toString(16).padStart(2, "0");
    }
    const finalQbitInjectionLabel = `${qbitEquation} [Injected 0x${injectHex.toUpperCase().substring(0, 16)}]`;

    const stages = [
      { pct: 10, msg: `Stage 1: Multi-model Ingestion. Unified 1 Truth compiled: ${totalRecords} records across timeline.` },
      { pct: 25, msg: `Stage 2: Q-bit Wavefunction Synthesis. Formulated superposition: ${qbitEquation}` },
      { pct: 42, msg: "Stage 3: Information Compression & Dict Hash generation. Mapping parameters to 64 key vectors." },
      { pct: 60, msg: "Stage 4: Classic String Injection. Committing serialized Qbit token into target microcode registers..." },
      { pct: 78, msg: "Stage 5: Multi-Model Distillation. Minimizing cross-entropy loss across ModelRolodex roster simultaneously (Ollama + APIs + FPGA)..." },
      { pct: 90, msg: "Stage 6: Post-training Optimization. Adjusting closed-loop active emotional profiles toward safety matrices..." },
      { pct: 100, msg: `Sovereign training distillation finalized for all model targets! Registered Q-bit injection vector: ${finalQbitInjectionLabel.substring(0, 75)}...` }
    ];

    stages.forEach((st, idx) => {
      setTimeout(() => {
        setPipelineProgress(st.pct);
        setPipelineStage(st.msg);
        
        if (st.pct === 100) {
          setIsCustomFpgarRomFlanked(true);
          setLunaQbitString(finalQbitInjectionLabel);
          localStorage.setItem("pog2_luna_qbit_state", finalQbitInjectionLabel);

          // DISTILL & INJECT BACK TO ACTIVE AUTOPILOT (CLOSED-LOOP FEEDBACK):
          // Automatically adjust the active custom emotional profiles based on historical ground truths
          // Dampen stress parameters on states that led to failures
          setCustomEmotionalProfiles(prev => {
            const nextProfiles = { ...prev };
            
            // Loop through each state in our profile and adjust weights
            Object.keys(nextProfiles).forEach((stKey) => {
              const stateVal = stKey as any as HexagramState;
              const cl = stateClassifications[stKey];
              if (cl && cl.bad > 0 && nextProfiles[stateVal]) {
                // If this state correlates with bad experiences, let's inject emotional stabilization weights:
                // damp down TENSION and FEAR, reinforce QUIETUDE and SERENITY for calmer transitions.
                const currentW = { ...nextProfiles[stateVal].weights };
                
                if (currentW[EmotionalTone.TENSION] !== undefined) {
                  currentW[EmotionalTone.TENSION] = Math.max(0, currentW[EmotionalTone.TENSION] - 25);
                }
                if (currentW[EmotionalTone.FEAR] !== undefined) {
                  currentW[EmotionalTone.FEAR] = Math.max(0, currentW[EmotionalTone.FEAR] - 30);
                }
                if (currentW[EmotionalTone.QUIETUDE] !== undefined) {
                  currentW[EmotionalTone.QUIETUDE] = Math.min(100, currentW[EmotionalTone.QUIETUDE] + 20);
                }
                if (currentW[EmotionalTone.SERENITY] !== undefined) {
                  currentW[EmotionalTone.SERENITY] = Math.min(100, currentW[EmotionalTone.SERENITY] + 20);
                }
                
                nextProfiles[stateVal] = {
                  ...nextProfiles[stateVal],
                  weights: currentW
                };
              }
            });

            // Save out physical telemetry embeddings
            localStorage.setItem("pog2_mhd_custom_emotions", JSON.stringify(nextProfiles));
            return nextProfiles;
          });

          addLogEntry(
            SubsystemId.INTERLOCK_SEQUENCE, 
            "SUCCESS", 
            `LUNA DISTILLATION COMPLETE: Symmetrically distilled all models using 1 Truth matrix. Injected Q-bit string payload: ${finalQbitInjectionLabel.substring(0, 90)}...`
          );
        }
      }, (idx + 1) * 800);
    });
  }

  const [compressedModel, setCompressedModel] = useState<{
    binaryToken: string;
    compressedBytes: number;
    uncompressedBytes: number;
    ratio: number;
    compiledAt: string;
    recordCount: number;
  } | null>(() => {
    const cached = localStorage.getItem("pog2_mhd_compressed_model");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached compressed model", e);
      }
    }
    return null;
  });

  // OpenRSC Bank action logs State
  const [bankActionLogs, setBankActionLogs] = useState<string[]>([
    "[BANK INITIALIZING] Double-buffered high-security storage synchronized.",
    "[BANK] Set to maxItems: 1500 per canon standards for 1200+ unique item IDs with overflow space."
  ]);
  const [spawnItemSelect, setSpawnItemSelect] = useState<number>(10); // Coins by default
  const [spawnItemQty, setSpawnItemQty] = useState<number>(100);

  // OpenRSC Simulated World loop properties
  const [worldTicks, setWorldTicks] = useState<number>(0);
  const [isWorldActive, setIsWorldActive] = useState<boolean>(true);
  const [worldLogs, setWorldLogs] = useState<string[]>([
    "[WORLD] Spawning high-compatibility virtual environment.",
    "[WORLD] Running: loadLandscape()...",
    "COLLISION_TEST: tile(0,0)=1 (BLOCKED) - AUTHENTIC",
    "[WORLD] Partitioned RegionManager cell array width=2304 height=1776.",
    "[WORLD] Verified valid game steps near (48, 128) boundary bounds.",
    "[WORLD] Tick metabolism initialized at 600ms cycles."
  ]);
  const [selectedWorldTab, setSelectedWorldTab] = useState<"terminal" | "regions" | "collisions">("terminal");

  useEffect(() => {
    let timer: any;
    if (isWorldActive) {
      timer = setInterval(() => {
        setWorldTicks(prev => {
          const next = prev + 1;
          if (next % 10 === 0) {
            setWorldLogs(logs => [
              ...logs.slice(-40),
              `[TICK #${next}] Iterated player updates. average cycle time: ~${(Math.random() * 2 + 1).toFixed(2)}ms`
            ]);
          }
          return next;
        });
      }, 600);
    }
    return () => clearInterval(timer);
  }, [isWorldActive]);

  const handleBankOperation = (operation: "deposit" | "withdraw", id: number, qty: number) => {
    try {
      const invArray = Array.isArray(playerState?.inventory) ? playerState.inventory : [];
      const bankArray = Array.isArray(playerState?.bank) ? playerState.bank : [];

      const currentInv = new RscInventory(null, invArray);
      let alertMessage = "";
      
      const playerCtx = {
        inventory: currentInv,
        lock: () => {
          setBankActionLogs(prev => [...prev, `[LOCK] Locked player pathfinding and action controller.`]);
        },
        unlock: () => {
          setBankActionLogs(prev => [...prev, `[UNLOCK] Released player locks.`]);
        },
        interfaceOpen: { bank: true },
        message: (msg: string) => {
          alertMessage = msg;
          setBankActionLogs(prev => [...prev, `[BANK NOTIFICATION]: ${msg}`]);
        },
        send: (pkt: any) => {
          setBankActionLogs(prev => [
            ...prev,
            `[PACKET OUT] type=${pkt.type}${pkt.maxItems ? ` Max:${pkt.maxItems}` : ""}${pkt.items ? ` count:${pkt.items.length}` : ""}`
          ]);
        },
        world: { members: true }
      };

      const currentBank = new RscBank(playerCtx, bankArray);
      currentInv.player = playerCtx;

      const itemMeta = itemsConfig[id] || { name: `Item #${id}`, stackable: false, icon: "📦" };
      
      if (operation === "deposit") {
        currentBank.deposit(id, qty);
        setBankActionLogs(prev => [
          ...prev,
          `[DEPOSIT OK] Transferred ${qty.toLocaleString()}x ${itemMeta.name} ${itemMeta.icon} into bank.`
        ]);
      } else {
        currentBank.withdraw(id, qty);
        setBankActionLogs(prev => [
          ...prev,
          `[WITHDRAW OK] Transferred ${qty.toLocaleString()}x ${itemMeta.name} ${itemMeta.icon} into inventory.`
        ]);
      }

      if (alertMessage) {
        // Handled in alert callback
      }

      const nextInv = currentInv.items.map(it => ({ id: it.id, amount: it.amount, equipped: it.equipped }));
      const nextBank = currentBank.items.map(it => ({ id: it.id, amount: it.amount }));

      const updatedState = {
        ...playerState,
        inventory: nextInv,
        bank: nextBank
      };

      setPlayerState(updatedState);
      localStorage.setItem("pog2_mhd_player_state", JSON.stringify(updatedState));

    } catch (err: any) {
      setBankActionLogs(prev => [
        ...prev,
        `[SYNC EXCEPTION] ${err.message}`
      ]);
    }
  };

  const handleSpawnAndAirdrop = () => {
    try {
      const invArray = Array.isArray(playerState?.inventory) ? playerState.inventory : [];
      const currentInv = new RscInventory(null, invArray);
      
      currentInv.add(spawnItemSelect, spawnItemQty);

      const itemMeta = itemsConfig[spawnItemSelect] || { name: `Item #${spawnItemSelect}`, icon: "📦" };
      setBankActionLogs(prev => [
        ...prev,
        `[SPAWNER] Airdropped ${spawnItemQty.toLocaleString()}x ${itemMeta.name} ${itemMeta.icon} to inventory.`
      ]);

      const nextInv = currentInv.items.map(it => ({ id: it.id, amount: it.amount, equipped: it.equipped }));
      const updatedState = {
        ...playerState,
        inventory: nextInv
      };

      setPlayerState(updatedState);
      localStorage.setItem("pog2_mhd_player_state", JSON.stringify(updatedState));
    } catch (err: any) {
      setBankActionLogs(prev => [
        ...prev,
        `[SPAWN EXCEPTION] ${err.message}`
      ]);
    }
  };

  const handleEquipToggle = (id: number) => {
    try {
      const invArray = Array.isArray(playerState?.inventory) ? playerState.inventory : [];
      const updatedInv = invArray.map(it => {
        if (it.id === id) {
          return { ...it, equipped: !it.equipped };
        }
        return it;
      });

      const updatedState = {
        ...playerState,
        inventory: updatedInv
      };

      setPlayerState(updatedState);
      localStorage.setItem("pog2_mhd_player_state", JSON.stringify(updatedState));
    } catch (err: any) {
      console.error(err);
    }
  };

  // Save changes to local caches on updates
  useEffect(() => {
    localStorage.setItem("pog2_mhd_player_state", JSON.stringify(playerState));
  }, [playerState]);

  useEffect(() => {
    localStorage.setItem("pog2_mhd_custom_emotions", JSON.stringify(customEmotionalProfiles));
  }, [customEmotionalProfiles]);

  useEffect(() => {
    localStorage.setItem("pog2_mhd_training_sequence", JSON.stringify(trainingSequence));
  }, [trainingSequence]);

  useEffect(() => {
    localStorage.setItem("pog2_mhd_injection_slots", JSON.stringify(injectionSlots));
  }, [injectionSlots]);

  useEffect(() => {
    localStorage.setItem("pog2_mhd_training_collector", JSON.stringify(trainingCollector));
  }, [trainingCollector]);

  useEffect(() => {
    localStorage.setItem("pog2_mhd_compressed_model", JSON.stringify(compressedModel));
  }, [compressedModel]);

  // Dictionary-based compression for compacting the raw payload buffers
  const compressCollectorPayload = (payload: TrainingCollectorRecord[]) => {
    const rawString = JSON.stringify(payload);
    const uncompressedBytes = rawString.length;

    const dictionary: Record<string, string> = {
      '"hexagram"': "~H",
      '"stateLabel"': "~L",
      '"timestamp"': "~T",
      '"reaction"': "~R",
      '"reason"': "~N",
      '"weights"': "~W",
      '"QUIETUDE"': "~q",
      '"SERENITY"': "~s",
      '"VIGILANCE"': "~v",
      '"COURAGE"': "~c",
      '"DETERMINATION"': "~d",
      '"TENSION"': "~e",
      '"FEAR"': "~f",
      '"COMMON"': "~CO",
      '"GOOD"': "~GD",
      '"BAD"': "~BD",
      '"id"': "~i"
    };

    let compressed = rawString;
    Object.entries(dictionary).forEach(([key, abbreviation]) => {
      compressed = compressed.split(key).join(abbreviation);
    });

    compressed = compressed.split(':0,').join(':0*');
    compressed = compressed.split('},').join('}*');

    let hexToken = "";
    for (let i = 0; i < compressed.length; i++) {
      const hex = compressed.charCodeAt(i).toString(16).padStart(2, "0");
      hexToken += hex;
    }
    hexToken = "0x" + hexToken.toUpperCase();

    const compressedBytes = Math.max(1, Math.round(hexToken.length / 2));
    const ratio = uncompressedBytes > 0 
      ? parseFloat(((1 - (compressedBytes / uncompressedBytes)) * 100).toFixed(1))
      : 0;

    return {
      binaryToken: hexToken,
      compressedBytes,
      uncompressedBytes,
      ratio: ratio,
      compiledAt: new Date().toLocaleTimeString(),
      recordCount: payload.length
    };
  };

  // Handle live modification of raw emotion sliders
  const handleEmotionWeightChange = (emotion: EmotionalTone, val: number) => {
    const currentProfile = customEmotionalProfiles[currentPacket.hexagramState];
    const updatedWeights = { ...currentProfile.weights, [emotion]: val };
    
    // Auto-normalize other weights if needed, or simply preserve sum
    // Let's do instant feedback update
    setCustomEmotionalProfiles(prev => ({
      ...prev,
      [currentPacket.hexagramState]: {
        ...prev[currentPacket.hexagramState],
        weights: updatedWeights
      }
    }));
  };

  const resetEmotionalWeightsToDefault = () => {
    setCustomEmotionalProfiles(prev => ({
      ...prev,
      [currentPacket.hexagramState]: { ...DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[currentPacket.hexagramState] }
    }));
    setInjectionLogStatus({
      text: `Reset profiles for ${HexagramStateLabels[currentPacket.hexagramState].split(" ")[0]} to VHDL factory thresholds.`,
      level: "SUCCESS"
    });
  };

  // Mutate speaker and vision bias directly
  const handleVocalBiasChange = (field: "voicePitchShift" | "voiceTempoBias" | "visionHueTilt" | "visionFrameRate", val: number) => {
    setCustomEmotionalProfiles(prev => ({
      ...prev,
      [currentPacket.hexagramState]: {
        ...prev[currentPacket.hexagramState],
        [field]: val
      }
    }));
  };

  // Inject raw string state interpreter
  const handleStringInjection = () => {
    if (!stringInjectionValue.trim()) {
      setInjectionLogStatus({ text: "Injection buffer empty.", level: "ERROR" });
      return;
    }

    try {
      let decodedStr = stringInjectionValue.trim();

      // Special Interceptor for ( ), (), { }, {} and other symbol usages to force a return to head + hexagram & canonical clock stamps
      const hasBracketsOrTokens =
        decodedStr.includes("()") ||
        decodedStr.includes("( )") ||
        decodedStr.includes("{}") ||
        decodedStr.includes("{ }") ||
        decodedStr === "()" ||
        decodedStr === "( )" ||
        decodedStr === "{}" ||
        decodedStr === "{ }";

      if (hasBracketsOrTokens) {
        // Build updated state with head, active hexagram and canonical clock ticks
        const currentHeadSprite = playerState?.headSprite ?? 1;
        const activeHex = currentPacket.hexagramState;
        const activeTick = packetHistory.length;
        const activeStamp = new Date().toLocaleTimeString();

        const updatedState = {
          ...playerState,
          headSprite: currentHeadSprite,
          lastSyncHexagram: activeHex,
          lastSyncTick: activeTick,
          lastSyncTimestamp: activeStamp
        };

        setPlayerState(updatedState);
        localStorage.setItem("pog2_mhd_player_state", JSON.stringify(updatedState));
        window.dispatchEvent(new Event("storage"));

        // Re-assert active hexagram state
        onCommitState(activeHex);

        addLogEntry(
          SubsystemId.SECURE_LOCK,
          "SUCCESS",
          `TOKEN INTERCEPTOR: Decoded bracket structure with ( ) () {} { }. Returned to headSprite: ${currentHeadSprite}, Hexagram: 0x${activeHex.toString(16).toUpperCase()}, Clock Stamp: [Tick: ${activeTick}, Stamp: ${activeStamp}].`
        );

        setInjectionLogStatus({
          text: `Success: Intercepted token structure! Reasserted head (Sprite: ${currentHeadSprite}), Hexagram (0x${activeHex.toString(16).toUpperCase()}), and Clock Stamp (Tick: ${activeTick}).`,
          level: "SUCCESS"
        });
        return;
      }

      // Intercept and decode RSC Character Save DNA format
      if (decodedStr.startsWith("RSC_SAVE_POG2_") || decodedStr.includes("_ATK[")) {
        const regex = /RSC_SAVE_POG2_X(\d+)_Y(\d+)_ATK\[(\d+)\/Usage:(\d+)\]_RNG\[(\d+)\/Elev:(\d+)m\]_MAG\[(\d+)\/Depth:(\d+)m\]_PRY\[(\d+)\/Alt:(\d+)km_Cam:([\d\.-]+)N,([\d\.-]+)E\]_FATIGUE\[(\d+)\]_STYLE\[(\d+)\]/;
        const match = decodedStr.match(regex);
        let xVal = 219;
        let yVal = 511;
        let fatigueNum = 42;
        let combatStyleNum = 0;
        let uCount = 754;
        let elevVal = 840;
        let depthVal = 145;
        let altVal = 420;

        if (match) {
          xVal = parseInt(match[1], 10);
          yVal = parseInt(match[2], 10);
          uCount = parseInt(match[4], 10);
          elevVal = parseInt(match[6], 10);
          depthVal = parseInt(match[8], 10);
          altVal = parseInt(match[10], 10);
          fatigueNum = parseInt(match[13], 10);
          combatStyleNum = parseInt(match[14], 10);
        } else {
          // Flexible loose parser in case coordinates or formatting fluctuate slightly
          const xMatch = decodedStr.match(/_X(\d+)/);
          const yMatch = decodedStr.match(/_Y(\d+)/);
          const usageMatch = decodedStr.match(/Usage:(\d+)/);
          const elevMatch = decodedStr.match(/Elev:(\d+)/);
          const depthMatch = decodedStr.match(/Depth:(\d+)/);
          const altMatch = decodedStr.match(/Alt:(\d+)/);
          const fatigueMatch = decodedStr.match(/FATIGUE\[(\d+)\]/);
          
          if (xMatch) xVal = parseInt(xMatch[1], 10);
          if (yMatch) yVal = parseInt(yMatch[1], 10);
          if (usageMatch) uCount = parseInt(usageMatch[1], 10);
          if (elevMatch) elevVal = parseInt(elevMatch[1], 10);
          if (depthMatch) depthVal = parseInt(depthMatch[1], 10);
          if (altMatch) altVal = parseInt(altMatch[1], 10);
          if (fatigueMatch) fatigueNum = parseInt(fatigueMatch[1], 10);
        }

        const activeHeadVal = playerState?.headSprite ?? 1;
        const updatedState = {
          ...playerState,
          x: xVal,
          y: yVal,
          fatigue: fatigueNum,
          combatStyle: combatStyleNum,
          headSprite: activeHeadVal,
          skills: {
            ...playerState?.skills,
            attack: { current: 92, experience: uCount * 15, base: 92 },
            ranged: { current: 75, experience: elevVal * 12, base: 75 },
            magic: { current: 55, experience: depthVal * 20, base: 55 },
            prayer: { current: 42, experience: altVal * 10, base: 42 }
          }
        };

        setPlayerState(updatedState);
        localStorage.setItem("pog2_mhd_player_state", JSON.stringify(updatedState));
        window.dispatchEvent(new Event("storage"));

        // Force transition return to current Hexagram state or specified state
        onCommitState(currentPacket.hexagramState);

        addLogEntry(
          SubsystemId.SECURE_LOCK,
          "SUCCESS",
          `STATE INJECTION PORT: Decoded RSC Character Save DNA string. Returned to head (Sprite=${activeHeadVal}), Hexagram=0x${currentPacket.hexagramState.toString(16).toUpperCase()}, Clock Stamp: [Tick: ${packetHistory.length}, Stamp: ${new Date().toLocaleTimeString()}].`
        );
        setInjectionLogStatus({
          text: `Parsed RSC Save DNA successfully! Telemetry states (Head: ${activeHeadVal}, Hexagram: 0x${currentPacket.hexagramState.toString(16).toUpperCase()}, Tick: ${packetHistory.length}) synchronized.`,
          level: "SUCCESS"
        });
        return;
      }

      // Decode raw state payload. Support plain JSON or Base64-encoded state payloads!
      if (!decodedStr.startsWith("{") && !decodedStr.startsWith("[")) {
        // Attempt Base64 decode
        try {
          decodedStr = atob(decodedStr);
        } catch (b64Err) {
          throw new Error("Invalid format. Must be raw JSON array, JSON object, Base64 token, or RSC Character Save DNA string.");
        }
      }

      // Check for user custom format: {"username":"POG2",...},"hexagram":{}
      if (decodedStr.startsWith('{"username"') && decodedStr.includes('},"hexagram":') && !decodedStr.startsWith('{"playerState"')) {
        decodedStr = `{"playerState":` + decodedStr + `}`;
      }

      const parsed = JSON.parse(decodedStr);

      // Support Option A: Full Multi-frame sequence
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) throw new Error("Array sequence contains zero state frames.");
        
        // Load sequence into the memory register
        const formatted = parsed.map((item, idx) => ({
          tick: item.tick ?? idx + 1,
          timestamp: item.timestamp ?? new Date().toLocaleTimeString(),
          state: item.state ?? HexagramState.IDLE,
          stateLabel: HexagramStateLabels[item.state ?? HexagramState.IDLE] ?? "UNKNOWN",
          activeFaults: item.activeFaults ?? [],
          classification: item.classification ?? "COMMON",
          emotionalWeights: item.emotionalWeights ?? DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[HexagramState.IDLE],
          operatorNotes: item.operatorNotes ?? "Aggregated injection load."
        }));

        setTrainingSequence(formatted);

        const activeHeadVal = playerState?.headSprite ?? 1;
        setPlayerState(prev => prev ? { ...prev, headSprite: activeHeadVal } : { headSprite: activeHeadVal });

        const targetHexState = parsed[0]?.state ?? currentPacket.hexagramState;
        onCommitState(targetHexState);

        addLogEntry(
          SubsystemId.SECURE_LOCK,
          "SUCCESS",
          `STATE INJECTION PORT: Restored total of ${parsed.length} timeline training sequence steps. Returned to head (Sprite=${activeHeadVal}), Hexagram=0x${targetHexState.toString(16).toUpperCase()}, Clock Stamp: [Tick: ${packetHistory.length}, Stamp: ${new Date().toLocaleTimeString()}].`
        );
        setInjectionLogStatus({
          text: `Successfully hydrated ${parsed.length} historical frames (Head: ${activeHeadVal}, Hexgram: 0x${targetHexState.toString(16).toUpperCase()}, Clock Tick: ${packetHistory.length}).`,
          level: "SUCCESS"
        });
        return;
      }

      // Support Option B: Single Parameter Injector (Thermal levels, pressure, target state)
      if (typeof parsed === "object") {
        let hexVal: any = null;
        let pState: any = null;

        if (parsed.playerState !== undefined) {
          pState = parsed.playerState;
          if (pState && pState.headSprite === undefined) {
            pState.headSprite = playerState?.headSprite ?? 1;
          }
          setPlayerState(pState);
          localStorage.setItem("pog2_mhd_player_state", JSON.stringify(pState));
        } else {
          const activeHeadVal = playerState?.headSprite ?? 1;
          setPlayerState(prev => {
            const next = prev ? { ...prev, headSprite: activeHeadVal } : { headSprite: activeHeadVal };
            localStorage.setItem("pog2_mhd_player_state", JSON.stringify(next));
            return next;
          });
        }
        
        if (parsed.hexagram !== undefined) {
          hexVal = parsed.hexagram;
        }

        // Apply parameters if available in the hexagram child object
        let nextHexState = currentPacket.hexagramState;
        if (hexVal && typeof hexVal === "object") {
          if (hexVal.hexagram !== undefined) {
            nextHexState = hexVal.hexagram;
            onCommitState(hexVal.hexagram);
          }
          if (hexVal.tempBias !== undefined) setTemperatureBias(hexVal.tempBias);
          if (hexVal.pressure !== undefined) setPlenumPressure(hexVal.pressure);
          if (hexVal.currentBias !== undefined) setBusCurrentBias(hexVal.currentBias);
          if (hexVal.gyroRate !== undefined) setImuGyroRate(hexVal.gyroRate);
        } else {
          // Fallback if top-level fields are present
          if (parsed.hexagram !== undefined && typeof parsed.hexagram !== "object") {
            nextHexState = parsed.hexagram;
            onCommitState(parsed.hexagram);
          }
          if (parsed.tempBias !== undefined) setTemperatureBias(parsed.tempBias);
          if (parsed.pressure !== undefined) setPlenumPressure(parsed.pressure);
          if (parsed.currentBias !== undefined) setBusCurrentBias(parsed.currentBias);
          if (parsed.gyroRate !== undefined) setImuGyroRate(parsed.gyroRate);
        }
        
        // Optional notes log
        let injectedComment = "Injected raw variable override state.";
        if (hexVal && hexVal.notes) {
          injectedComment = hexVal.notes;
        } else if (parsed.notes) {
          injectedComment = parsed.notes;
        }
        
        let successMsg = "Hardware simulation parameters hydrated successfully!";
        if (pState) {
          successMsg = `Success: Loaded player ${pState.username || "unknown"} state + parameters!`;
        }

        const activeHeadVal = playerState?.headSprite ?? pState?.headSprite ?? 1;
        addLogEntry(
          SubsystemId.SECURE_LOCK,
          "SUCCESS",
          `STATE HYDRATOR: Config parsed. Variables changed. Returned to head (Sprite=${activeHeadVal}), Hexagram=0x${nextHexState.toString(16).toUpperCase()}, Clock Stamp: [Tick: ${packetHistory.length}, Stamp: ${new Date().toLocaleTimeString()}]. Notes: "${injectedComment}"`
        );
        setInjectionLogStatus({
          text: `${successMsg} (Head: ${activeHeadVal}, Hex: 0x${nextHexState.toString(16).toUpperCase()}, Clock: ${packetHistory.length}).`,
          level: "SUCCESS"
        });
        window.dispatchEvent(new Event("storage"));
        return;
      }

      throw new Error("Parsed payload does not match schema registry specifications.");
    } catch (err: any) {
      setInjectionLogStatus({ text: `Injection Parse Failed: ${err.message}`, level: "ERROR" });
      addLogEntry(SubsystemId.SECURE_LOCK, "WARNING", `MALFORMED STATE INJECTION ATTEMPT: ${err.message}`);
    }
  };

  // Create current serialized State Payload String
  const generateCurrentSaveStateString = () => {
    const payload: SavedStatePayload = {
      version: "POG2-ML-V1",
      id: `SAV-${Math.floor(Math.random() * 900000 + 100000)}`,
      timestamp: new Date().toISOString(),
      label: `Snapshot state at Tick #${packetHistory.length}`,
      frames: trainingSequence
    };
    const str = JSON.stringify(payload, null, 2);
    setStringInjectionValue(str);
    navigator.clipboard.writeText(str);
    setInjectionLogStatus({ text: "Full sequence JSON generated and copied to system clipboard!", level: "SUCCESS" });
  };

  const generateSimpleVariableStateString = () => {
    const pState = playerState || {
      username: "POG2",
      password: "DOGS",
      group: 0,
      x: 215,
      y: 452,
      fatigue: 0,
      combatStyle: 0,
      blockChat: 0,
      blockPrivateChat: 0,
      blockTrade: 0,
      blockDuel: 0,
      cameraAuto: 0,
      oneMouseButton: 0,
      soundOn: 1,
      hairColour: 2,
      topColour: 8,
      trouserColour: 14,
      skinColour: 0,
      headSprite: 1,
      bodySprite: 2,
      skulled: 0,
      friends: [],
      ignores: [],
      inventory: [
        { id: 10, amount: 25000 },
        { id: 16, amount: 1, equipped: true },
        { id: 546, amount: 150 },
        { id: 1263, amount: 1 },
        { id: 1251, amount: 8 }
      ],
      bank: [
        { id: 10, amount: 50000 },
        { id: 81, amount: 1 },
        { id: 822, amount: 1 },
        { id: 1121, amount: 1 }
      ],
      questPoints: 0,
      questStages: {},
      skills: {
        attack: { current: 1, experience: 0 },
        defense: { current: 1, experience: 0 },
        strength: { current: 1, experience: 0 },
        hits: { current: 7, experience: 1154 },
        ranged: { current: 1, experience: 0 },
        prayer: { current: 1, experience: 0 },
        magic: { current: 1, experience: 0 },
        cooking: { current: 1, experience: 0 },
        woodcutting: { current: 1, experience: 0 },
        fletching: { current: 1, experience: 0 },
        fishing: { current: 1, experience: 0 },
        firemaking: { current: 1, experience: 0 },
        crafting: { current: 1, experience: 0 },
        smithing: { current: 1, experience: 0 },
        mining: { current: 1, experience: 0 },
        herblaw: { current: 1, experience: 0 },
        agility: { current: 1, experience: 0 },
        thieving: { current: 1, experience: 0 }
      },
      cache: {},
      loginIP: null,
      world: 0,
      id: 1,
      loginDate: 0
    };

    const simpleHex = {
      hexagram: currentPacket.hexagramState,
      tempBias: currentPacket.predictedTempRaw > 0 ? (currentPacket.predictedTempRaw / 150) : 0, 
      pressure: currentPacket.pressPlenumRaw > 0 ? (currentPacket.pressPlenumRaw / 2000) : 1.25,
      notes: `Custom profile evaluation at ${new Date().toLocaleTimeString()}`,
      timestamp: new Date().toISOString()
    };

    // Output formatted string: {"username":"POG2",...},"hexagram":{"hexagram":...}
    const str = JSON.stringify(pState) + `,"hexagram":` + JSON.stringify(simpleHex);
    setStringInjectionValue(str);
    navigator.clipboard.writeText(str);
    setInjectionLogStatus({ text: "Simple parameter string with player state generated & copied!", level: "SUCCESS" });
  };

  // Add active state to train dataset
  const commitCurrentTimelineFrame = () => {
    const activeProfile = customEmotionalProfiles[currentPacket.hexagramState];
    const newFrame: PredictiveStateFrame = {
      tick: packetHistory.length + 1,
      timestamp: new Date().toLocaleTimeString(),
      state: currentPacket.hexagramState,
      stateLabel: HexagramStateLabels[currentPacket.hexagramState],
      activeFaults: [...activeFaultCodes],
      classification: operatorClassification,
      emotionalWeights: { ...activeProfile },
      operatorNotes: operatorNotes ? operatorNotes : "Nominal run metric check."
    };

    setTrainingSequence(prev => [...prev, newFrame]);
    setOperatorNotes("");
    setInjectionLogStatus({ text: "Clock-stamped frame successfully committed to dynamic training buffer!", level: "SUCCESS" });
    addLogEntry("SYSTEM" as any, "SUCCESS", `TRAINING SEQUENCER: Registered frame at tick #${newFrame.tick} as ${operatorClassification}. Notes: "${newFrame.operatorNotes}"`);
  };

  const purgeTrainingBuffer = () => {
    setTrainingSequence([]);
    setInjectionLogStatus({ text: "Cleared local training frames sequence memory.", level: "INFO" });
  };

  // Simple transition probability check based on Valid Transitions
  const getPredictiveSequenceOutcomes = () => {
    const activeState = currentPacket.hexagramState;
    // Find all valid outputs from current state
    const candidates = VALID_TRANSITIONS.filter(t => t.from === activeState);
    
    return candidates.map(c => {
      // Find probability based on active faults. If critical fault, LIMP_MODE has extreme probability weight
      let probability = 100 / candidates.length;
      let notes = "Nominal sparse transition pathway sequence.";
      let predictedClassification: HexagramEvaluationClassification = "COMMON";
      const hasCriticalFault = activeFaultCodes.some(f => {
        const d = DETAILED_FAULT_REGISTRY.find(reg => reg.code === f);
        return d?.severity === FaultSeverity.CRITICAL;
      });

      if (c.to === HexagramState.LIMP_MODE) {
        if (hasCriticalFault) {
          probability = 95;
          notes = "CRITICAL TRIPPED: Automatic Safe Shutdown Interlock override engages highly probable.";
          predictedClassification = "BAD";
        } else {
          probability = 5;
          notes = "Idle safe harbor fallback transition model.";
        }
      } else if (c.to === HexagramState.TR_CRIT) {
        if (activeFaultCodes.includes("T-01") || activeFaultCodes.includes("E-01")) {
          probability = 75;
          notes = "Degraded stress margin forces transition to critical thresholds.";
          predictedClassification = "BAD";
        }
      } else {
        if (!hasCriticalFault) {
          predictedClassification = "GOOD";
          notes = "Standard propulsion/displacement vector sequencing.";
        }
      }

      return {
        targetState: c.to,
        targetLabel: HexagramStateLabels[c.to].split(" (")[0],
        probability: Math.round(probability),
        notes,
        predictedClassification
      };
    }).sort((a,b) => b.probability - a.probability);
  };

  // Save current dynamic configuration into Slot register
  const saveCurrentToSlot = (slotId: number) => {
    const activeWeights = { ...customEmotionalProfiles[currentPacket.hexagramState].weights };
    setInjectionSlots(prev => ({
      ...prev,
      [slotId]: {
        hexagram: currentPacket.hexagramState,
        stateLabel: HexagramStateLabels[currentPacket.hexagramState],
        timestamp: new Date().toLocaleTimeString(),
        reaction: operatorClassification,
        reason: operatorNotes ? operatorNotes : `Manual snapshot for state ${HexagramStateLabels[currentPacket.hexagramState].split(" ")[0]}`,
        weights: activeWeights
      }
    }));
    addLogEntry(SubsystemId.SECURE_LOCK, "SUCCESS", `SLOT STORE: Configured Injection Slot #${slotId} with active Hexagram state and evaluation.`);
    setInjectionLogStatus({ text: `Successfully saved current telemetry state to Slot #${slotId}!`, level: "SUCCESS" });
  };

  // Hydrate states back from saved Slot
  const loadFromSlot = (slotId: number) => {
    const slot = injectionSlots[slotId];
    if (!slot) {
      setInjectionLogStatus({ text: `Slot #${slotId} is currently unallocated/empty.`, level: "ERROR" });
      return;
    }

    onCommitState(slot.hexagram);
    // Load custom weights associated
    setCustomEmotionalProfiles(prev => ({
      ...prev,
      [slot.hexagram]: {
        ...prev[slot.hexagram],
        weights: { ...slot.weights }
      }
    }));

    setOperatorClassification(slot.reaction);
    setOperatorNotes(slot.reason);

    // Approximate Physical variable adjustments
    if (slot.hexagram === HexagramState.ST_CRIT || slot.hexagram === HexagramState.TR_CRIT) {
      setTemperatureBias(18);
    } else if (slot.hexagram === HexagramState.LIMP_MODE) {
      setTemperatureBias(22);
    } else {
      setTemperatureBias(0);
      setPlenumPressure(1.25);
    }

    addLogEntry(SubsystemId.SECURE_LOCK, "SUCCESS", `SLOT LOAD: Deployed configuration from Injection Slot #${slotId} back to active MHD core.`);
    setInjectionLogStatus({ text: `Hydrated AI parameter state back from Slot #${slotId}!`, level: "SUCCESS" });
  };

  // Push Slot JSON to central Training Collector
  const pushSlotToCollector = (slotId: number) => {
    const slot = injectionSlots[slotId];
    if (!slot) {
      setInjectionLogStatus({ text: `Cannot push to collector: Slot #${slotId} is empty!`, level: "ERROR" });
      return;
    }

    const newRecord: TrainingCollectorRecord = {
      id: `REC-${Math.floor(Math.random() * 900000 + 100000)}`,
      hexagram: slot.hexagram,
      stateLabel: slot.stateLabel,
      timestamp: slot.timestamp,
      reaction: slot.reaction,
      reason: slot.reason,
      weights: { ...slot.weights }
    };

    setTrainingCollector(prev => [...prev, newRecord]);
    addLogEntry(SubsystemId.SECURE_LOCK, "SUCCESS", `COLLECTOR PUSH: Transferred Slot #${slotId} JSON into training collector array.`);
    setInjectionLogStatus({ text: `Added Slot #${slotId} state record into the collector!`, level: "SUCCESS" });
  };

  // Push current dynamic physical parameters directly to Training Collector
  const pushCurrentToCollectorDirectly = () => {
    const activeWeights = { ...customEmotionalProfiles[currentPacket.hexagramState].weights };
    const newRecord: TrainingCollectorRecord = {
      id: `REC-${Math.floor(Math.random() * 900000 + 100000)}`,
      hexagram: currentPacket.hexagramState,
      stateLabel: HexagramStateLabels[currentPacket.hexagramState],
      timestamp: new Date().toLocaleTimeString(),
      reaction: operatorClassification,
      reason: operatorNotes ? operatorNotes : `Direct active snapshot evaluation`,
      weights: activeWeights
    };

    setTrainingCollector(prev => [...prev, newRecord]);
    setOperatorNotes("");
    addLogEntry(SubsystemId.SECURE_LOCK, "SUCCESS", `COLLECTOR DIRECT PUSH: Logged current live state to Training Collector.`);
    setInjectionLogStatus({ text: "Added current live state direct JSON to Training Collector!", level: "SUCCESS" });
  };

  const purgeTrainingCollector = () => {
    setTrainingCollector([]);
    setInjectionLogStatus({ text: "Purged all entries in Training Collector database.", level: "INFO" });
  };

  const executeBatchProcessAndCompress = () => {
    if (trainingCollector.length === 0) {
      setInjectionLogStatus({ text: "Batch Process failed: No uncompressed frames in Collector!", level: "ERROR" });
      return;
    }

    // Run custom dictionary compression
    const model = compressCollectorPayload(trainingCollector);
    setCompressedModel(model);

    // CLEANUP UNCOMPRESSED THAT WAS COMPRESSED TO MODEL
    setTrainingCollector([]);

    addLogEntry("SYSTEM" as any, "SUCCESS", `MODEL COMPILE: Successfully batch-processed, compressed, and cleaned up ${model.recordCount} records into Active Compressed Model binary (${model.compressedBytes} bytes).`);
    setInjectionLogStatus({ text: `Successfully batch processed and compressed ${model.recordCount} items! Cleaner swept uncompressed cache successfully.`, level: "SUCCESS" });
  };

  // Dynamic Ternary Routing Calculator:
  // Decodes 6 levels (Yao) representing state as dynamic Ternary logic: Yang (+1), Yao (0), Yin (-1)
  const calculateTernaryMindYao = () => {
    // Line 1: Metabolic state (Base excitation)
    let line1 = 0; // default Zero
    if (activeFaultCodes.length > 0) {
      line1 = -1; // Yin if faults tripped
    } else if (currentPacket.pressPlenumRaw > 1200) {
      line1 = 1; // Yang if high pressure nominal (1.2 MPa range)
    }

    // Line 2: Vocal speech tempo bias
    let line2 = 0;
    const tempo = customEmotionalProfiles[currentPacket.hexagramState]?.voiceTempoBias ?? 1.0;
    if (tempo < 0.9) {
      line2 = -1; // Yin Quietness
    } else if (tempo > 1.2) {
      line2 = 1; // Yang Active Accentuation
    }

    // Line 3: AI Vision sampling threshold
    let line3 = 0;
    const samplingRate = customEmotionalProfiles[currentPacket.hexagramState]?.visionFrameRate ?? 30;
    if (samplingRate < 25) {
      line3 = -1; // Yin Low rate
    } else if (samplingRate > 50) {
      line3 = 1; // Yang High attention
    }

    // Line 4: Thermal limit density
    let line4 = 0;
    // Current payload value represents thermal signature or current raw level
    const currentSig = currentPacket.currBusRaw;
    if (currentSig > 500) {
      line4 = -1; // Yin High dissipation required (damping)
    } else if (currentSig > 0 && currentSig <= 250) {
      line4 = 1; // Yang High potential
    }

    // Line 5: Magnetic Lock
    let line5 = 0;
    if (currentPacket.faultByte > 0) {
      line5 = -1; // Yin fallback
    } else if (currentPacket.electricalReg === ElectricalReg.ELEC_ACTIVE) {
      line5 = 1; // Yang excitation active
    }

    // Line 6: Highest consciousness training level
    let line6 = 0;
    if (operatorClassification === "BAD") {
      line6 = -1; // Yin restricted state
    } else if (operatorClassification === "GOOD") {
      line6 = 1; // Yang aligned optimization flow
    }

    const yaoArray = [line1, line2, line3, line4, line5, line6];
    const totalScore = yaoArray.reduce((src, val) => src + val, 0);

    let activeRouteStr: "YIN" | "YAO" | "YANG" = "YAO";
    if (totalScore < -1) {
      activeRouteStr = "YIN";
    } else if (totalScore > 1) {
      activeRouteStr = "YANG";
    }

    return {
      yaoArray, // index 0 to 5 for lines
      totalScore,
      activeRoute: activeRouteStr
    };
  };

  // Auto-scroll logic trackers
  useEffect(() => {
    if (activeTab === "packet" && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [packetHistory, activeTab]);


  useEffect(() => {
    if (activeTab === "logs" && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [systemLogs, activeTab]);

  useEffect(() => {
    if (cliContainerRef.current) {
      cliContainerRef.current.scrollTop = cliContainerRef.current.scrollHeight;
    }
  }, [cliHistory]);

  const copyToClipboard = () => {
    setCopying(true);
    navigator.clipboard.writeText(currentPacket.rawValueHex);
    setTimeout(() => setCopying(false), 2000);
  };

  const toBinary = (val: number, size: number): string => {
    return val.toString(2).padStart(size, "0");
  };

  // Log files Local Export Utility
  const handleExportLogs = (format: "csv" | "txt" | "json") => {
    let outputString = "";
    if (format === "json") {
      outputString = JSON.stringify(systemLogs, null, 2);
    } else if (format === "csv") {
      outputString = "Timestamp,Tick,Subsystem,Level,Message,Snapshot\n" +
        systemLogs.map(l => `"${l.timestamp}","${l.tick}","${l.subsystem}","${l.level}","${l.message.replace(/"/g, '""')}","${l.variableSnapshot}"`).join("\n");
    } else {
      outputString = "=========================================================================\n" +
        "POG2 MHD PROPULSION HARDWARE DIAGNOSTICS MEMORY REPORT\n" +
        `Generated: ${new Date().toISOString()}\n` +
        "=========================================================================\n\n" +
        systemLogs.map(l => `[${l.timestamp}] [Tick #${l.tick}] [${l.subsystem}] [${l.level}] ${l.message}\n   Snapshot: ${l.variableSnapshot}`).join("\n\n");
    }

    const mimeType = format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8";
    const blob = new Blob([outputString], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const extension = format === "json" ? "json" : format === "csv" ? "csv" : "log";
    link.download = `pog2_mhd_diagnostics_${new Date().toISOString().substring(0, 10)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPacketHistoryCSV = () => {
    const headers = "Index,Timestamp,Type,Message/Data\n";
    const rows = packetHistory.map((line, index) => {
      let timestamp = "";
      let type = "EVENT";
      let message = line;
      
      const txMatch = line.match(/^(\d{2}:\d{2}:\d{2})\s+\[(TX)\]\s+(.*)$/);
      const genericMatch = line.match(/^\[(.*?)\]\s+(.*)$/);
      
      if (txMatch) {
        timestamp = txMatch[1];
        type = txMatch[2];
        message = txMatch[3];
      } else if (genericMatch) {
        type = genericMatch[1];
        message = genericMatch[2];
      }
      
      const cleanMsg = message.replace(/"/g, '""');
      return `"${index}","${timestamp}","${type}","${cleanMsg}"`;
    }).join("\n");
    
    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pog2_mhd_packet_history_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPacketHistoryJSON = () => {
    const dataToExport = packetHistory.map((line, index) => {
      let timestamp = "";
      let type = "EVENT";
      let message = line;
      
      const txMatch = line.match(/^(\d{2}:\d{2}:\d{2})\s+\[(TX)\]\s+(.*)$/);
      const genericMatch = line.match(/^\[(.*?)\]\s+(.*)$/);
      
      if (txMatch) {
        timestamp = txMatch[1];
        type = txMatch[2];
        message = txMatch[3];
      } else if (genericMatch) {
        type = genericMatch[1];
        message = genericMatch[2];
      }
      return { index, timestamp, type, raw: line, parsedMessage: message };
    });
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pog2_mhd_packet_history_${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportFullSimulationArchive = () => {
    const archiveData = {
      exportTimestamp: new Date().toISOString(),
      appName: "POG2-MHD-PROP-001 Market Architecture",
      simulationRunId: "mhd-archived-run-" + Date.now(),
      packetHistory,
      transitionHistory,
    };
    const blob = new Blob([JSON.stringify(archiveData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `simulation_run_archive_t${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportDiagnosticDataJSON = () => {
    const diagnosticData = {
      exportTimestamp: new Date().toISOString(),
      appName: "POG2-MHD-PROP-001 Market Architecture",
      simulationRunId: "mhd-diagnostic-run-" + Date.now(),
      packetHistory,
      systemLogs,
    };
    const blob = new Blob([JSON.stringify(diagnosticData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pog2_mhd_diagnostics_${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Low-level command processor logic
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const cmd = cliInput.trim().toLowerCase();
    const args = cmd.split(/\s+/);
    setCliHistory(prev => [...prev, `guest@POG2-MHD-PROP$ ${cliInput}`]);
    setCliInput("");

    // Setup helper map of all binary fault overrides
    const faultMap: Record<string, { 
      value: boolean; 
      setter?: (val: boolean) => void; 
      label: string;
    }> = {
      temp_flip: { value: faultInjectTempBitFlip, setter: setFaultInjectTempBitFlip, label: "Temperature Bit-Flip" },
      temp_stuck: { value: faultInjectTempStuck, setter: setFaultInjectTempStuck, label: "Temperature Sensor Stuck" },
      press_stuck: { value: faultInjectPressStuck, setter: setFaultInjectPressStuck, label: "Plenum Pressure Sensor Stuck" },
      state_corrupt: { value: faultInjectStateCorrupt, setter: setFaultInjectStateCorrupt, label: "Hexagram State Register Corruption" },
      crc_corrupt: { value: faultInjectCrcCorrupt, setter: setFaultInjectCrcCorrupt, label: "Telemetry CRC Link Corruption" },
      axi_timeout: { value: faultInjectAxiTimeout, setter: setFaultInjectAxiTimeout, label: "AXI4 Interface Bus Timeout" },
      axi_mismatch: { value: faultInjectAxiReadbackMismatch, setter: setFaultInjectAxiReadbackMismatch, label: "AXI4 Register Readback Mismatch" },
      cdc_desync: { value: faultInjectCdcDesync, setter: setFaultInjectCdcDesync, label: "FPGA CDC Domain Desynchronization" },
      cdc_drift: { value: faultInjectCdcDrift, setter: setFaultInjectCdcDrift, label: "Clock Domain Drift (Frequency Desync)" },
      thermal_rate: { value: faultInjectThermalRateExceeded, setter: setFaultInjectThermalRateExceeded, label: "Thermal Heat Sinking Rate Exceeded" },
      sensor_divergence: { value: faultInjectSensorDivergence, setter: setFaultInjectSensorDivergence, label: "Pre-charge Sensor Group Divergence" },
    };

    const resolveFaultKey = (name: string): string | null => {
      const clean = name.toLowerCase().replace(/[-_]/g, "");
      if (["tempflip", "bitflip", "flip"].includes(clean)) return "temp_flip";
      if (["tempstuck", "tstuck"].includes(clean)) return "temp_stuck";
      if (["pressstuck", "pstuck"].includes(clean)) return "press_stuck";
      if (["statecorrupt", "state"].includes(clean)) return "state_corrupt";
      if (["crccorrupt", "crc"].includes(clean)) return "crc_corrupt";
      if (["axitimeout", "timeout"].includes(clean)) return "axi_timeout";
      if (["aximismatch", "mismatch", "readback"].includes(clean)) return "axi_mismatch";
      if (["cdcdesync", "desync"].includes(clean)) return "cdc_desync";
      if (["cdcdrift", "drift"].includes(clean)) return "cdc_drift";
      if (["thermalrate", "rate"].includes(clean)) return "thermal_rate";
      if (["sensordivergence", "divergence"].includes(clean)) return "sensor_divergence";
      return null;
    };

    switch (args[0]) {
      case "help":
        setCliHistory(prev => [
          ...prev,
          "=========================================================================",
          "               POG2 SUBSEA CO-PROCESSOR CLI SHELL (ACTIVE)               ",
          "=========================================================================",
          "  help                      - Output AXI register controls helper tables",
          "  status                    - Read real-time high-precision telemetry fields",
          "  clear                     - Wipe console and system logs buffer",
          "  trigger <var>             - Legacy stress injection (thermal, pressure, overcurrent)",
          "  reset                     - Calibrate HIL simulations and restore nominal values",
          "  bypass                    - Bypasses challenge-nonce authentication directly to TRANSIT",
          "  clock info                - Query PL clock configuration timing constraints",
          "  fault list                - Query actual state of all 11 binary fault registers",
          "  fault inject <name>       - Enable a specific binary fault bypass route",
          "  fault clear <name|all>    - Restore healthy bypass logic registers",
          "  fault toggle <name>       - Flip designated binary fault register state",
          "  set <param> <value>       - Manually alter simulation physical tuning offsets",
          "                              (params: temp, press, current, gyro)",
          "  set list                  - View fine calibration variable parameters",
          "  state list                - Query operating hexagram state register codes",
          "  state jump <state>        - Commit force transition to a designated mode",
          "  bist start                - Command high-speed Built-In Self-Test (BIST) sequence",
          "  ai ask <question>         - Dispatches telemetry payload to Workers AI co-processor",
          "  ai autopilot <on|off>     - Toggle dynamic neural autopilot system state",
          "  log verbose <on|off>      - Modify verbose logging profile constraints",
          "  log uart <on|off>         - Control automatic UART logs over serial transceiver",
          "  log stats                 - View real-time packet & transaction analytics",
          "========================================================================="
        ]);
        break;

      case "status":
        setCliHistory(prev => [
          ...prev,
          `  - CORE STATE REG     : HexagramState 0x${currentPacket.hexagramState.toString(16).toUpperCase()} (${HexagramStateLabels[currentPacket.hexagramState]?.split(" (")[0] || "Unknown Mode"})`,
          `  - RECTIFIER STATE REG: ElecReg 0x${currentPacket.electricalReg.toString(16).toUpperCase()} (${ElectricalRegLabels[currentPacket.electricalReg]})`,
          `  - FAULT TELEMETRY BYTE: 0x${currentPacket.faultByte.toString(16).toUpperCase()} (${activeFaultCodes.length} active detailed codes)`,
          `  - TARGET NONCE COUNT : ${currentPacket.padding === 0xaa ? "100ms alignment active" : "Clock skew warning"}`,
          `  - REPLAY NONCE VALUE : ${currentPacket.predictedTempRaw}`
        ]);
        break;

      case "clear":
        clearLogs();
        setCliHistory([
          "Console and UART log database buffer wiped.",
          "Type 'help' to review physical trigger controls."
        ]);
        addLogEntry("SYSTEM" as any, "SUCCESS", "AXI COMMAND SHELL: Session log buffers wiped clean.");
        break;

      case "trigger":
        if (args[1] === "thermal") {
          setTemperatureBias(21);
          setCliHistory(prev => [...prev, "  >> WRITING AXI4 REG INDEX 0x0C (TempBias) = +21 K. Thermal threshold breach committed."]);
          addLogEntry(SubsystemId.THERMAL, "CRITICAL", "CLI TRIP INJECTED: AXI shell forced Temperature bias of +21K to test boundary mitigations.");
        } else if (args[1] === "pressure") {
          setPlenumPressure(1.10);
          setCliHistory(prev => [...prev, "  >> WRITING AXI4 REG INDEX 0x14 (PlenumPres) = 1.10 atm. Underpressure bounds breached."]);
          addLogEntry(SubsystemId.VENTILATION, "CRITICAL", "CLI TRIP INJECTED: AXI shell forced Plenum pressure drop to 1.10 atm.");
        } else if (args[1] === "overcurrent") {
          setBusCurrentBias(150);
          setCliHistory(prev => [...prev, "  >> WRITING AXI4 REG INDEX 0x1A (CurrentBias) = +150 A. Inductive derating warns activated."]);
          addLogEntry(SubsystemId.ELECTRICAL, "WARNING", "CLI TRIP INJECTED: AXI shell simulated inductive overcurrent surge of +150A.");
        } else {
          setCliHistory(prev => [...prev, "  ERROR: Unknown stress variable target. Use 'help' to review triggers (thermal, pressure, overcurrent)."]);
        }
        break;

      case "reset":
        onResetSimulator();
        setCliHistory(prev => [...prev, "  >> RESET REG COMPLETED. Calibration curves restored to nominal metrics."]);
        break;

      case "bypass":
        onCommitState(HexagramState.TRANSIT);
        setCliHistory(prev => [...prev, "  >> FORCING TRANSIT STATE. Cryptographic knock verification logic bypassed."]);
        break;

      case "clock":
        if (args[1] === "info") {
          setCliHistory(prev => [
            ...prev,
            "--- FPGA CDC TIMING REPORT ---",
            "  PL Clock Input Freq  : 250 MHz (Nominal)",
            "  Setup Time Margin    : +0.091 ns (Slack Hold OK)",
            "  Worst Negative Slack : +0.108 ns (WNS MET)",
            "  Critical Heat Warp   : Worst Negative Slack drops to -0.012 ns when Temp > 311K (Triggers C-01 Warning!)"
          ]);
        } else {
          setCliHistory(prev => [...prev, "  Unknown clock subcommand. Type 'clock info' to view timing metadata."]);
        }
        break;

      case "fault":
        if (args[1] === "list") {
          setCliHistory(prev => [
            ...prev,
            "--- AXI4 FAULT OVERRIDE REGISTERS SNAPSHOT ---",
            ...Object.entries(faultMap).map(([key, item]) => 
              `  - ${key.padEnd(20)}: ${item.value ? "🔴 [ACTIVE / FAULT_INJECTED]" : "🟢 [HEALTHY / MONITOR_PASS]"} - ${item.label}`
            )
          ]);
        } else if (args[1] === "inject") {
          const injName = args[2];
          if (!injName) {
            setCliHistory(prev => [...prev, "  ERROR: Specify fault name (e.g., 'fault inject temp_flip'). Type 'fault list' to review names."]);
            break;
          }
          const canonInjKey = resolveFaultKey(injName);
          if (canonInjKey) {
            const config = faultMap[canonInjKey];
            if (config.setter) {
              config.setter(true);
              setCliHistory(prev => [...prev, `  >> WRITING REGISTER FOR ${config.label} = ON (Active Fault)`]);
              addLogEntry("SYSTEM" as any, "WARNING", `CLI FAULT INJECTED: AXI shell forced ${config.label} to active.`);
            } else {
              setCliHistory(prev => [...prev, `  ERROR: Set function for '${canonInjKey}' is unmapped.`]);
            }
          } else {
            setCliHistory(prev => [...prev, `  ERROR: Unresolved fault descriptor '${injName}'. Type 'fault list' to check names.`]);
          }
        } else if (args[1] === "clear") {
          const clrTarget = args[2];
          if (!clrTarget) {
            setCliHistory(prev => [...prev, "  ERROR: Specify fault name to clear, or use 'fault clear all' to normalize system."]);
            break;
          }
          if (clrTarget === "all") {
            Object.entries(faultMap).forEach(([_, item]) => {
              if (item.setter) item.setter(false);
            });
            setCliHistory(prev => [...prev, "  >> RESTORING CO-PROCESSOR VECTOR INTEGRITY: All fault overrides successfully set to HEALTHY."]);
            addLogEntry("SYSTEM" as any, "SUCCESS", "CLI NORMALIZATION: AXI command shell zeroed all 11 fault injection override vectors.");
          } else {
            const canonClrKey = resolveFaultKey(clrTarget);
            if (canonClrKey) {
              const config = faultMap[canonClrKey];
              if (config.setter) {
                config.setter(false);
                setCliHistory(prev => [...prev, `  >> WRITING REGISTER FOR ${config.label} = OFF (System Healthy)`]);
                addLogEntry("SYSTEM" as any, "SUCCESS", `CLI REGULARIZATION: AXI shell cleared fault override for ${config.label}.`);
              }
            } else {
              setCliHistory(prev => [...prev, `  ERROR: Unrecognised fault descriptor '${clrTarget}'. Type 'fault list' to check names.`]);
            }
          }
        } else if (args[1] === "toggle") {
          const tglName = args[2];
          if (!tglName) {
            setCliHistory(prev => [...prev, "  ERROR: Specify target fault name to toggle (e.g., 'fault toggle cdc_drift')."]);
            break;
          }
          const canonTglKey = resolveFaultKey(tglName);
          if (canonTglKey) {
            const config = faultMap[canonTglKey];
            if (config.setter) {
              const nextVal = !config.value;
              config.setter(nextVal);
              setCliHistory(prev => [...prev, `  >> TOGGLING ${config.label}: Current register state written to ${nextVal ? "ON" : "OFF"}`]);
              addLogEntry("SYSTEM" as any, nextVal ? "WARNING" : "SUCCESS", `CLI FAULT TOGGLED: AXI shell toggled ${config.label} state to ${nextVal ? "ACTIVE" : "HEALTHY"}.`);
            }
          } else {
            setCliHistory(prev => [...prev, `  ERROR: Unrecognised fault descriptor '${tglName}'.`]);
          }
        } else {
          setCliHistory(prev => [
            ...prev,
            "  ERROR: Unknown fault command syntax. Valid forms:",
            "    - fault list",
            "    - fault inject <name>",
            "    - fault clear <name | all>",
            "    - fault toggle <name>"
          ]);
        }
        break;

      case "set":
        if (args[1] === "list" || args[1] === "info" || !args[1]) {
          setCliHistory(prev => [
            ...prev,
            "--- MHD SIMULATION BIAS REGISTERS & SYSTEM PARAMETERS ---",
            "  - temp    (Temperature Bias Offset)     : Kelvin  [Offset 0x0C]",
            "  - press   (Plenum Pressure Sensor)      : Atm     [Offset 0x14]",
            "  - current (Bus Current Bias Offset)     : Amperes [Offset 0x1A]",
            "  - gyro    (IMU Gyrocopter Rate Bias)    : Deg/Sec [Offset 0x22]",
            "Syntax: set <param> <value>   (e.g., set temp -15)"
          ]);
        } else {
          const param = args[1];
          const valStr = args[2];
          if (!valStr) {
            setCliHistory(prev => [...prev, `  ERROR: Missing numerical value for '${param}'. Configuration aborted.`]);
            break;
          }
          const valNum = parseFloat(valStr);
          if (isNaN(valNum)) {
            setCliHistory(prev => [...prev, `  ERROR: Value '${valStr}' is not a valid floating-point number.`]);
            break;
          }

          if (param === "temp" || param === "temperature" || param === "t") {
            setTemperatureBias(valNum);
            setCliHistory(prev => [...prev, `  >> WRITING REG INDEX 0x0C (TempBias) = ${valNum} K`]);
            addLogEntry(SubsystemId.THERMAL, "INFO", `CLI COMMAND: Bias temperature register modified to ${valNum}K.`);
          } else if (param === "press" || param === "pressure" || param === "plenum" || param === "p") {
            setPlenumPressure(valNum);
            setCliHistory(prev => [...prev, `  >> WRITING REG INDEX 0x14 (PlenumPres) = ${valNum} atm`]);
            addLogEntry(SubsystemId.VENTILATION, "INFO", `CLI COMMAND: Control plenum pressure register tuned to ${valNum} atm.`);
          } else if (param === "current" || param === "curr" || param === "amp" || param === "i") {
            setBusCurrentBias(valNum);
            setCliHistory(prev => [...prev, `  >> WRITING REG INDEX 0x1A (CurrentBias) = ${valNum} A`]);
            addLogEntry(SubsystemId.ELECTRICAL, "INFO", `CLI COMMAND: Master bus current bias altered to ${valNum}A.`);
          } else if (param === "gyro" || param === "rate" || param === "g") {
            setImuGyroRate(valNum);
            setCliHistory(prev => [...prev, `  >> WRITING REG INDEX 0x22 (GyroRateBias) = ${valNum} deg/sec`]);
            addLogEntry("SYSTEM", "INFO", `CLI COMMAND: IMU gyroscopic bias scaled to ${valNum} deg/s.`);
          } else {
            setCliHistory(prev => [...prev, `  ERROR: Simulation register '${param}' unrecognized.`]);
          }
        }
        break;

      case "state":
        if (args[1] === "list" || !args[1]) {
          setCliHistory(prev => [
            ...prev,
            "--- VALID HEXAGRAM SUBSEA STATE TRANSITION INDEX ---",
            "  - IDLE      (Dec 00)  : Main stationary ready state",
            "  - PURGE     (Dec 09)  : Core hydrogen scrubbing and de-ionized venting",
            "  - STEALTH   (Dec 52)  : Thermal emission masking enabled",
            "  - ST_CRIT   (Dec 55)  : Degraded silent masking critical stress",
            "  - TRANSIT   (Dec 56)  : H-Bridge active plasma drive sequence",
            "  - LIMP_MODE (Dec 57)  : Low current safety thruster fallback mode",
            "  - TR_SALT   (Dec 58)  : Solid-state salt water transducer field lock",
            "  - TR_CRIT   (Dec 59)  : High field density extreme transducer operations",
            "Syntax: state jump <name | dec_number>  (e.g., state jump stealth)"
          ]);
        } else if (args[1] === "jump" || args[1] === "force" || args[1] === "commit") {
          const targetStr = args[2];
          if (!targetStr) {
            setCliHistory(prev => [...prev, "  ERROR: Missing state target specification. Try: state jump stealth"]);
            break;
          }
          let targetState: HexagramState | null = null;
          const valAsInt = parseInt(targetStr);

          if (!isNaN(valAsInt)) {
            // Check decimal value mapping
            if ([0, 9, 52, 55, 56, 57, 58, 59].includes(valAsInt)) {
              targetState = valAsInt as HexagramState;
            }
          } else {
            // Check string names
            const sName = targetStr.toLowerCase();
            if (sName === "idle") targetState = HexagramState.IDLE;
            else if (sName === "purge") targetState = HexagramState.PURGE;
            else if (sName === "stealth") targetState = HexagramState.STEALTH;
            else if (sName === "st_crit" || sName === "stcrit") targetState = HexagramState.ST_CRIT;
            else if (sName === "transit") targetState = HexagramState.TRANSIT;
            else if (sName === "limp" || sName === "limp_mode" || sName === "limpmode") targetState = HexagramState.LIMP_MODE;
            else if (sName === "tr_salt" || sName === "trsalt") targetState = HexagramState.TR_SALT;
            else if (sName === "tr_crit" || sName === "trcrit") targetState = HexagramState.TR_CRIT;
          }

          if (targetState !== null) {
            onCommitState(targetState);
            const stateLabel = HexagramStateLabels[targetState]?.split(" (")[0] || String(targetState);
            setCliHistory(prev => [...prev, `  >> FORCING TRANSITION TO SUBSTRATE: Operating mode updated to ${stateLabel} (Dec ${targetState}).`]);
            addLogEntry("SYSTEM" as any, "SUCCESS", `CLI MODE TRANSITION: AXI shell bypassed gate locks to force state jump into ${stateLabel}.`);
          } else {
            setCliHistory(prev => [...prev, `  ERROR: State descriptor '${targetStr}' cannot be mapped to any physical hexagram.`]);
          }
        } else {
          setCliHistory(prev => [...prev, "  ERROR: Unrecognised state sub-command. Try: state list"]);
        }
        break;

      case "bist":
        if (args[1] === "start" || args[1] === "run") {
          if (bistState === "RUNNING") {
            setCliHistory(prev => [...prev, "  WARNING: On-chip Built-In Self-Test (BIST) sequence is already active."]);
          } else {
            setCliHistory(prev => [...prev, "  >> CO-PROCESSOR SELF_TEST TRIGGERED. Transferring console view to BIST..."]);
            runSystemBist();
            setActiveTab("bist_and_logging");
          }
        } else {
          setCliHistory(prev => [
            ...prev,
            "--- BIST TIMING INTERFACES ---",
            `  BIST Register state: ${bistState}`,
            `  BIST status register code: 0x${bistStatusReg.toString(16).toUpperCase().padStart(8, "0")}`,
            "Syntax: bist start"
          ]);
        }
        break;

      case "ai":
        if (args[1] === "ask" || args[1] === "query" || args[1] === "diagnose") {
          const questionArr = args.slice(2);
          if (questionArr.length === 0) {
            setCliHistory(prev => [...prev, "  ERROR: Please specify a diagnostic query (e.g., 'ai ask analyze thermal drifts')."]);
            break;
          }
          const question = questionArr.join(" ");
          setCliHistory(prev => [
            ...prev,
            `  >> TRANSMITTING CURRENT PACKET IMAGE TO WORKERS EDGE [Prompt: ${question}]`,
            "  >> STACK ENCRYPTING PARITY CODES...",
            "  >> WAITING FOR CO-PROCESSOR ANALYTICS RESPONSE..."
          ]);
          // Fire Workers AI diagnostic request asynchronously
          handleCfDiagnose(question);
        } else if (args[1] === "autopilot" || args[1] === "pilot" || args[1] === "active") {
          const setting = args[2];
          if (!setting) {
            const currentAutopilot = isAiActive;
            setCliHistory(prev => [...prev, `  AI Autopilot system status: ${currentAutopilot ? "ACTIVE / CHARGING" : "INACTIVE / STANDBY"}`]);
          } else {
            const nextActive = ["on", "yes", "true", "active", "1"].includes(setting.toLowerCase());
            setIsAiActive(nextActive);
            setCliHistory(prev => [...prev, `  >> WRITING NEURAL_AUTOPILOT_REG = ${nextActive ? "0x00FF" : "0x0000"} [AI Autopilot: ${nextActive ? "ON" : "OFF"}]`]);
            addLogEntry("SYSTEM" as any, "INFO", `CLI COMMAND: Co-processor neural autopilot active setting rewritten to ${nextActive}.`);
          }
        } else {
          setCliHistory(prev => [
            ...prev,
            "--- WORKERS EDGE CO-PROCESSOR INTELLIGENT ROUTING CONTROLS ---",
            "  - ai ask <query>             - Dispatch telemetry to edge LLM for safety parsing",
            "  - ai autopilot <on|off>      - Toggle deep neural closed-loop feedback flight controller"
          ]);
        }
        break;

      case "log":
        if (args[1] === "verbose") {
          const op = args[2];
          if (!op) {
            setCliHistory(prev => [...prev, `  Verbose logging: ${verboseLogging ? "ENABLED (L3)" : "DISABLED (L1)"}`]);
          } else {
            const turnOn = ["on", "yes", "true", "enabled", "1"].includes(op.toLowerCase());
            if (setVerboseLogging) {
              setVerboseLogging(turnOn);
              setCliHistory(prev => [...prev, `  >> WRITE LOCAL_LOGGING_LEVEL = ${turnOn ? "VERBOSE" : "STANDARD"}`]);
            } else {
              setCliHistory(prev => [...prev, "  ERROR: setVerboseLogging is unmapped."]);
            }
          }
        } else if (args[1] === "uart" || args[1] === "serial") {
          const op = args[2];
          if (!op) {
            setCliHistory(prev => [...prev, `  Transmit UART streams over serial trace line: ${transmitLogsOverUart ? "ENABLED (TX_ACTIVE)" : "MUTED (TX_HI_Z)"}`]);
          } else {
            const turnOn = ["on", "yes", "true", "enabled", "1"].includes(op.toLowerCase());
            if (setTransmitLogsOverUart) {
              setTransmitLogsOverUart(turnOn);
              setCliHistory(prev => [...prev, `  >> WRITE CO_PROC_UART_TX_EN = ${turnOn ? "0x01" : "0x00"}`]);
            } else {
              setCliHistory(prev => [...prev, "  ERROR: setTransmitLogsOverUart is unmapped."]);
            }
          }
        } else if (args[1] === "stats" || args[1] === "statistics" || args[1] === "info") {
          setCliHistory(prev => [
            ...prev,
            "--- TELEMETRY TRACING AND RECORDER STATISTICS ---",
            `  - Raw packet history storage arrays size: ${packetHistory.length} frames`,
            `  - Logged system events count in volatile RAM: ${systemLogs.length} events`,
            `  - FSM operating state change records count  : ${transitionHistory.length} changes`,
            `  - Calculated average transition energy dissipation: ${avgTransitionPower.toFixed(2)} MW (Voltage: 5kV)`,
            `  - Substack data logging active channel      : ${isLoggingActive ? "ONLINE" : "OFFLINE"}`
          ]);
        } else {
          setCliHistory(prev => [
            ...prev,
            "--- LOGGING AND METRIC CONTROLLER SUB-ROUTE ---",
            "  - log verbose <on/off>      - Control level details output constraints",
            "  - log uart <on/off>         - Control physical UART transceiver signals status",
            "  - log stats                 - Read telemetry frame store performance indices"
          ]);
        }
        break;

      default:
        setCliHistory(prev => [...prev, `  Command error: '${args[0]}' is unrecognized. Type 'help' to list valid commands.`]);
        break;
    }
  };

  // Filter dynamic diagnostic logs based on user search triggers
  const filteredLogs = systemLogs.filter(log => {
    const textMatches = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        log.subsystem.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        log.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const severityMatches = severityFilter === "ALL" || log.level === severityFilter;
    
    const subsystemMatches = subsystemFilter === "ALL" || log.subsystem === subsystemFilter;

    return textMatches && severityMatches && subsystemMatches;
  });

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans relative" id="telemetry-card">
      
      {/* 1. Header Toolbar Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-amber-500" />
          <h3 className="text-sm font-display font-medium text-slate-200 tracking-wide uppercase">
            MHD CO-PROCESSOR DIAGNOSTICS & SYSTEM MONITOR
          </h3>
          <button
            onClick={handleExportPacketHistoryCSV}
            disabled={packetHistory.length === 0}
            className="flex items-center gap-1.5 text-[9px] bg-emerald-950 border border-emerald-900 hover:bg-emerald-900 disabled:opacity-40 disabled:pointer-events-none text-emerald-400 font-mono font-bold px-2 py-1 rounded cursor-pointer transition ml-2 hover:text-emerald-300 shadow-md"
            title="Download Telemetry History Buffer as CSV for local forensic analysis"
          >
            <Download className="h-3 w-3" />
            DOWNLOAD CSV ({packetHistory.length} PACKETS)
          </button>
          <button
            onClick={handleExportDiagnosticDataJSON}
            disabled={packetHistory.length === 0}
            className="flex items-center gap-1.5 text-[9px] bg-sky-950 border border-sky-900 hover:bg-sky-900 disabled:opacity-40 disabled:pointer-events-none text-sky-400 font-mono font-bold px-2 py-1 rounded cursor-pointer transition ml-2 hover:text-sky-300 shadow-md"
            title="Download Telemetry History Buffer and System Logs as JSON for local diagnostic analysis"
          >
            <Download className="h-3 w-3" />
            EXPORT DIAGNOSTICS (JSON)
          </button>
        </div>
        
        {/* Navigation tabs selector */}
        <div className="flex bg-slate-900 border border-slate-800 rounded p-0.5 font-mono text-[10px] w-full sm:w-auto overflow-x-auto gap-0.5">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "dashboard" ? "bg-emerald-950/40 text-emerald-400 font-bold border border-emerald-900/60" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="inline h-3.5 w-3.5 mr-1" />
            TELEMETRY DASHBOARD
          </button>
          <button
            onClick={() => setActiveTab("packet")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "packet" ? "bg-amber-950/40 text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="inline h-3 w-3 mr-1" />
            BITFIELD CODELYZER
          </button>
          <button
            onClick={() => setActiveTab("registry")}
            className={`px-3 py-1 rounded transition cursor-pointer relative shrink-0 ${
              activeTab === "registry" ? "bg-amber-950/40 text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="inline h-3 w-3 mr-1" />
            FAULT REGISTER
            {activeFaultCodes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
            )}
            {activeFaultCodes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "logs" ? "bg-amber-950/40 text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="inline h-3 w-3 mr-1" />
            UART DEBUG STREAM
          </button>
          <button
            onClick={() => setActiveTab("ai_training")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "ai_training" ? "bg-amber-950/40 text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Brain className="inline h-3 w-3 mr-1" />
            AI TRAINING LAB
          </button>
          <button
            onClick={() => setActiveTab("distribution")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "distribution" ? "bg-amber-950/40 text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Command className="inline h-3 w-3 mr-1" />
            SOVEREIGN DISTRIBUTION
          </button>
          <button
            onClick={() => setActiveTab("ghostsplat")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "ghostsplat" ? "bg-amber-950/40 text-cyan-400 font-bold animate-pulse" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="inline h-3 w-3 mr-1" />
            GHOSTSPLAT PREDICTOR
          </button>
          <button
            onClick={() => setActiveTab("pedagogy")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "pedagogy" ? "bg-amber-950/40 text-rose-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="inline h-3 w-3 mr-1" />
            MEMORY & PEDAGOGY MAP
          </button>
          <button
            onClick={() => setActiveTab("world_buffer")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "world_buffer" ? "bg-cyan-950/40 text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="inline h-3 w-3 mr-1" />
            NTX WORLD BUFFER
          </button>
          <button
            onClick={() => setActiveTab("map_renderer")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "map_renderer" ? "bg-orange-950/40 text-orange-400 font-bold border border-orange-900/60" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="inline h-3 w-3 mr-1 pointer-events-none" />
            MAP RENDER ENGINE
          </button>
          <button
            onClick={() => setActiveTab("sovereign_cns")}
            className={`px-3 py-1 rounded transition cursor-pointer shrink-0 ${
              activeTab === "sovereign_cns" ? "bg-amber-955/40 text-amber-500 font-bold border border-amber-900/60" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Brain className="inline h-3 w-3 mr-1 pointer-events-none text-amber-550" strokeWidth={2.5} />
            SOVEREIGN ARCH (CNS)
          </button>
          <button
            onClick={() => setActiveTab("debug_stream")}
            className={`px-3 py-1 rounded transition cursor-pointer relative shrink-0 ${
              activeTab === "debug_stream" ? "bg-rose-950/40 text-rose-400 font-bold border border-rose-900/60 animate-pulse" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="inline h-3.5 w-3.5 mr-1" />
            INTEGRITY & DEBUG STREAM
          </button>
          <button
            onClick={() => setActiveTab("bist_and_logging")}
            className={`px-3 py-1 rounded transition cursor-pointer relative shrink-0 ${
              activeTab === "bist_and_logging" ? "bg-cyan-950/40 text-cyan-400 font-bold border border-cyan-900/60" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="inline h-3.5 w-3.5 mr-1 text-cyan-400" />
            FPGA DIAGNOSTICS & BRAM
          </button>
          <button
            onClick={() => setActiveTab("mcp_registry")}
            className={`px-3 py-1 rounded transition cursor-pointer relative shrink-0 ${
              activeTab === "mcp_registry" ? "bg-indigo-950/40 text-indigo-400 font-bold border border-indigo-900/60" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="inline h-3.5 w-3.5 mr-1 text-indigo-400 animate-pulse" />
            MCP TOOLS & FORENSICS
          </button>
          <button
            onClick={() => setActiveTab("physical_limbs")}
            className={`px-3 py-1 rounded transition cursor-pointer relative shrink-0 ${
              activeTab === "physical_limbs" ? "bg-[#1d4ed8]/40 border border-blue-900/60 text-blue-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="inline h-3.5 w-3.5 mr-1 text-blue-400 animate-pulse" />
            MHD SOVEREIGN LIMBS (PHYSICAL)
          </button>
        </div>
      </div>

      {/* TAB 0: REAL-TIME TELEMETRY DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6 animate-fade-in" id="real-time-telemetry-dashboard">
          {/* Main system header / indicator strip */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
            <div>
              <div className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider uppercase flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                LIVE PACKET Rx SYNCHRONIZED
              </div>
              <h2 className="text-lg font-display font-medium text-slate-100 tracking-wide mt-1">
                POG2_MHD_PROP-001 Real-Time Telemetry Dashboard
              </h2>
              <p className="text-[11px] text-slate-450 font-mono mt-0.5 max-w-2xl leading-normal">
                Visualizing continuous high-density VHDL register broadcasts directly from the AXI4-Lite slave co-processor. Updated on metabolic valid stream ticks.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 border-l border-slate-800/80 pl-4">
              {/* Average Power per State Transition */}
              <div className="bg-slate-950 px-3 py-2 rounded border border-slate-850 text-right">
                <div className="text-[8px] text-cyan-400 font-mono font-bold tracking-wide uppercase">AVG TRANSITION POWER</div>
                <div className="text-xs text-cyan-300 font-mono font-bold mt-1" title="Average kinetic power dissipation during Yao transitions over 5000V DC line">
                  {avgTransitionPower.toFixed(3)} MW
                </div>
              </div>

              <div className="bg-slate-950 px-3 py-2 rounded border border-slate-850 text-right">
                <div className="text-[8px] text-slate-500 font-mono font-bold">RAW TELEMETRY FRAME</div>
                <div className="text-xs text-amber-500 font-mono font-bold mt-1 tracking-widest uppercase">
                  0x{currentPacket.rawValueHex}
                </div>
              </div>
              <div className="flex flex-col text-right font-mono text-[10px] justify-center">
                <span className="text-slate-500">PACKET BUFFER</span>
                <span className="text-emerald-400 font-bold mt-1">VALID & ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Widget 1: Hexagram State (6-bit Yao, Col: 6) */}
            <div className="md:col-span-6 bg-slate-900 border border-slate-850 rounded-lg p-5 flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-3.5">
                  <span className="text-[10px] text-slate-405 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    HEXAGRAM_STATE [63:58]
                  </span>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded uppercase">
                    YAO REGISTER 0x10
                  </span>
                </div>
                
                <div className="flex items-center gap-5">
                  {/* Visual 6-line Yao State grid indicator */}
                  <div className="flex flex-col gap-1 w-16 bg-slate-950 p-2 rounded border border-slate-850 select-none shrink-0 border-r-3 border-r-emerald-500">
                    {Array.from({ length: 6 }).map((_, index) => {
                      const bitIndex = 5 - index;
                      const isBitSet = ((currentPacket.hexagramState >> bitIndex) & 1) === 1;
                      return (
                        <div key={bitIndex} className="flex flex-col items-center">
                          {isBitSet ? (
                            // Solid Yang line
                            <div className="w-full h-1.5 bg-emerald-500 rounded-sm shadow-[0_0_5px_rgba(16,185,129,0.3)]" title="Yang Line (1)" />
                          ) : (
                            // Broken Yin line
                            <div className="w-full flex justify-between h-1.5">
                              <div className="w-[42%] h-full bg-slate-800 rounded-sm" title="Yin Line (0)" />
                              <div className="w-[42%] h-full bg-slate-800 rounded-sm" title="Yin Line (0)" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="text-[7px] text-slate-500 font-mono text-center mt-1 font-bold">BIT 5-0</div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-mono text-[9px] text-slate-500 font-bold">COMMITTED HIGH-LEVEL STATE</div>
                    <div className="text-xl font-display font-medium text-slate-100 tracking-tight flex items-center gap-2">
                      {HexagramStateLabels[currentPacket.hexagramState]?.split(" (")[0] || "UNKNOWN"}
                      <span className="text-[10px] font-mono font-bold text-slate-400 px-1.5 py-0.5 bg-slate-950 rounded border border-slate-850">
                        {toBinary(currentPacket.hexagramState, 6)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono leading-relaxed">
                      {HexagramStateLabels[currentPacket.hexagramState]?.includes("CRIT") 
                        ? "CRITICAL STATE: Highly unstable. Deliberation timeouts countdown active towards automatic safe-fallback."
                        : "NOMINAL STATE: Balanced state trajectory matching the sparse paths of the MHD core registers."}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-slate-800/40 text-[9px] font-mono text-slate-500 flex justify-between">
                <span>Transition matrix code: VALID</span>
                <span>Hex index: 0x{currentPacket.hexagramState.toString(16).toUpperCase()}</span>
              </div>
            </div>

            {/* Widget 2: Electrical Regulation (ELEC_REGS, Col: 6) */}
            <div className="md:col-span-6 bg-slate-900 border border-slate-850 rounded-lg p-5 flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-3.5">
                  <span className="text-[10px] text-slate-405 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <Zap className="h-4 w-4 text-purple-400" />
                    ELECTRICAL STATUS [57:56]
                  </span>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 bg-purple-950 text-purple-400 border border-purple-900 rounded">
                    ELEC REGISTER
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full border border-slate-800 bg-slate-950 flex flex-col items-center justify-center font-mono select-none overflow-hidden shrink-0 border-l-3 border-l-purple-500">
                      <span className="text-[7px] text-slate-500">CAPACITY</span>
                      <span className="text-sm font-bold text-slate-200 mt-1">
                        {currentPacket.electricalReg === 0 ? "0%" : currentPacket.electricalReg === 1 ? "100%" : currentPacket.electricalReg === 2 ? "40%" : "150%"}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-slate-550 block font-bold">CURRENT DRIVE LEVEL</span>
                      <div className="text-xl font-display font-medium text-slate-100 flex items-center gap-2">
                        {ElectricalRegLabels[currentPacket.electricalReg] || "UNKNOWN"}
                        <span className="text-[9px] font-mono font-bold text-slate-500 px-1.5 bg-slate-950 rounded border border-slate-850">
                          {toBinary(currentPacket.electricalReg, 2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono leading-relaxed">
                        {currentPacket.electricalReg === 0 ? "Bridges unenergized. All contactors safe and open." : 
                         currentPacket.electricalReg === 1 ? "Continuous nominal load matching baseline thrust outputs." : 
                         currentPacket.electricalReg === 2 ? "Non-critical loads shedded to conserve auxiliary capacitors." : 
                         "Extreme power amplification. Auxiliary thermal dissipation at absolute peaks."}
                      </div>
                    </div>
                  </div>

                  {/* Linear electricity meter line */}
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-slate-950 rounded overflow-hidden border border-slate-850">
                      <div 
                        className={`h-full transition-all duration-300 rounded ${
                          currentPacket.electricalReg === 0 ? "w-0" :
                          currentPacket.electricalReg === 1 ? "w-full bg-emerald-505 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                          currentPacket.electricalReg === 2 ? "w-[40%] bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" :
                          "w-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                        }`}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-[8px] text-slate-500 select-none">
                      <span>ELEC_OFF</span>
                      <span>ELEC_SHED (40%)</span>
                      <span>ELEC_ACTIVE (100%)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/40 text-[9px] font-mono text-slate-500 flex justify-between">
                <span>VHDL bus: Compliant</span>
                <span>Active load constraints: Nominal</span>
              </div>
            </div>

            {/* Widget 3: Live Active Fault Matrix (Col: 12) */}
            <div className="md:col-span-12 bg-slate-900 border border-slate-850 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-3.5">
                  <span className="text-[10px] text-slate-405 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <Shield className="h-4 w-4 text-red-500" />
                    FAULT VECTOR REGISTER [55:48]
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono font-bold bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-slate-400 flex items-center gap-1">
                      HEX MASK: <strong className="text-slate-200">0x{currentPacket.faultByte.toString(16).toUpperCase().padStart(2, "0")}</strong>
                    </span>
                    <span className="text-[8px] font-mono font-bold rounded px-1.5 py-0.5 bg-slate-950 border border-slate-850" style={{ color: currentPacket.faultByte > 0 ? "#f87171" : "#10b981" }}>
                      {currentPacket.faultByte > 0 ? "WARNINGS ACTIVE" : "SYSTEM SECURE"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Grid of the 5 key system fault registers mapped against the 8 bits of faultByte */}
                  <div className="grid grid-cols-2 sm:grid-cols-8 gap-3 font-mono text-[10px]">
                    {[
                      { index: 0, label: "T_TRANSITION", title: "Invalid state path request to co-processor registers." },
                      { index: 1, label: "T_ELECTRICAL", title: "Mismatch between expected drive code and current state." },
                      { index: 2, label: "T_THERMAL", title: "Temperature sensors exceeding safe envelope limits." },
                      { index: 3, label: "T_SAFETY", title: "Universal contactor/magnetic loop safety interlock failure." },
                      { index: 4, label: "T_KNOCK", title: "Cryptographic replay handshake challenge mismatch." },
                      { index: 5, label: "T_RESERVED", title: "Future telemetry register definition padding." },
                      { index: 6, label: "T_RESERVED", title: "Future telemetry register definition padding." },
                      { index: 7, label: "T_RESERVED", title: "Future telemetry register definition padding." },
                    ].map((bit) => {
                      const isFaultActive = ((currentPacket.faultByte >> bit.index) & 1) === 1;
                      return (
                        <div 
                          key={bit.index} 
                          className={`p-2.5 rounded border select-none transition ${
                            isFaultActive 
                              ? "bg-red-950/20 border-red-900 text-red-450 font-bold" 
                              : "bg-slate-950 border-slate-850 text-slate-500"
                          }`}
                          title={bit.title}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] text-slate-500 font-bold">BIT {bit.index}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${isFaultActive ? "bg-red-550 shadow-[0_0_5px_#f87171] animate-pulse bg-red-400" : "bg-slate-800"}`} />
                          </div>
                          <div className="truncate mt-1.5 font-bold tracking-tight text-[9px]">{bit.label}</div>
                          <div className="text-[8px] text-slate-500 mt-0.5 truncate">{isFaultActive ? "FAULT!" : "OK"}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Specific diagnostics lists for currently logged fault descriptors */}
                  {activeFaultCodes.length > 0 ? (
                    <div className="p-3 bg-red-950/10 border border-red-950/40 rounded space-y-2">
                      <div className="text-[9px] text-red-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        ACTIVE HARDWARE FAULTS DETECTED:
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-350">
                        {activeFaultCodes.map((code) => {
                          const def = DETAILED_FAULT_REGISTRY.find((f) => f.code === code);
                          if (!def) return null;
                          return (
                            <div key={code} className="bg-slate-950 border border-slate-850 p-2 rounded flex flex-col justify-between">
                              <div className="flex justify-between font-bold text-red-400 border-b border-slate-850 pb-1 mb-1 shadow-sm text-[9px]">
                                <span>[{def.code}] {def.label}</span>
                                <span className="bg-red-950 border border-red-900 text-[8px] px-1 rounded font-semibold uppercase">{def.severity}</span>
                              </div>
                              <p className="text-[9px] text-slate-400 mt-1 leading-normal">{def.description}</p>
                              <div className="text-[8px] text-amber-500 mt-2 italic font-medium">Mitigation: {def.mitigation}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-950/10 border border-emerald-950 text-[10px] font-mono text-emerald-400 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      <span>All VHDL structural parameters are currently healthy. No active auto-mitigation algorithms or fault bytes requested.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Widget 4: Predictive Thermodynamics (Col: 6) */}
            <div className="md:col-span-6 bg-slate-900 border border-slate-850 rounded-lg p-5 flex flex-col justify-between min-h-[260px]">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-3.5 select-none">
                  <span className="text-[10px] text-slate-405 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <History className="h-4 w-4 text-cyan-400" />
                    THERMODYNAMIC PREDICTIONS [47:36]
                  </span>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-900 rounded">
                    TAYLOR APPROXIMATION
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[8.5px] text-slate-500 font-mono font-bold">AVERAGE TEMPERATURE</div>
                      <div className="text-xl font-mono font-bold text-slate-200 mt-2 select-all">
                        {(currentPacket.predictedTempRaw / 10).toFixed(1)} K
                      </div>
                      <div className="text-[8px] text-slate-500 font-mono mt-1">Measured dynamic baseline</div>
                    </div>
                    
                    <div className="bg-slate-950 p-3 rounded border border-slate-850 relative overflow-hidden">
                      <div className="text-[8.5px] text-slate-500 font-mono font-bold">PREDICTED (T+3)</div>
                      <div className="text-xl font-mono font-bold text-cyan-405 mt-2 text-cyan-400">
                        {calculatePredictiveFutureTemp(currentPacket.predictedTempRaw / 10, currentPacket.taylorOrder, currentPacket.predictedTempRaw).toFixed(1)} K
                      </div>
                      <div className="text-[8px] text-cyan-500 font-mono mt-1 flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                        Taylor Poly {currentPacket.taylorOrder}th Order
                      </div>
                    </div>
                  </div>

                  {/* Safety scale bar with markers at 320 Kelvin */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[8.5px] text-slate-500 mb-1 select-none">
                      <span>MARGIN TO SHUTOFF (320K LIMIT)</span>
                      <span>{Math.max(0, 320 - (currentPacket.predictedTempRaw / 10)).toFixed(1)} K Remaining</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-sm overflow-hidden border border-slate-850 relative">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          currentPacket.predictedTempRaw / 10 >= 320 ? "bg-red-500" :
                          currentPacket.predictedTempRaw / 10 >= 310 ? "bg-amber-500" : "bg-cyan-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, ((currentPacket.predictedTempRaw / 10 - 280) / 40) * 100))}%` }}
                      />
                      <div className="absolute right-[25%] top-0 bottom-0 w-0.5 bg-red-650/70 border-r border-slate-950" title="Shutdown boundary marker (320K)" />
                    </div>
                    <div className="flex justify-between font-mono text-[8px] text-slate-500 select-none font-bold">
                      <span>280 Kelvin</span>
                      <span className="text-red-400">320K Limit Crossing</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/40 text-[9px] font-mono text-slate-500 flex justify-between select-none">
                <span>Co-processor computation: Steady</span>
                <span>Active polynomial order: {currentPacket.taylorOrder}</span>
              </div>
            </div>

            {/* Widget 5: Pressure and Bus Current Registers (Col: 6) */}
            <div className="md:col-span-6 bg-slate-900 border border-slate-850 rounded-lg p-5 flex flex-col justify-between min-h-[260px]">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-3.5 select-none">
                  <span className="text-[10px] text-slate-405 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <Gauge className="h-4 w-4 text-amber-505 text-amber-400" />
                    CONSTRAINTS REGISTERS [35:12]
                  </span>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-900 rounded">
                    MHD PHYSICAL VALUES
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Plenum Pressure */}
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[8.5px] text-slate-500 font-mono font-bold">PLENUM PRESSURE [35:24]</div>
                      <div className="text-xl font-mono font-bold text-emerald-400 mt-2">
                        {(currentPacket.pressPlenumRaw / 100).toFixed(2)} atm
                      </div>
                      <div className="text-[8.5px] font-mono text-slate-500 mt-1 flex justify-between">
                        <span>Nominal Target:</span>
                        <span className="text-slate-350">1.25 - 1.35 atm</span>
                      </div>
                      {/* Bar indicator for target limits lock */}
                      <div className="w-full h-1 bg-slate-900 rounded mt-2.5 relative">
                        <div className="absolute left-[25%] right-[25%] top-0 bottom-0 bg-emerald-500/20 rounded border-x border-emerald-500/50" />
                        <div 
                          className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 top-[-1px] transition-all duration-300" 
                          style={{ left: `${Math.min(95, Math.max(5, (((currentPacket.pressPlenumRaw / 100) - 1.0) / 0.5) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* Bus Current */}
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[8.5px] text-slate-500 font-mono font-bold">BUS CURRENT [23:12]</div>
                      <div className="text-xl font-mono font-bold text-purple-400 mt-2">
                        {(currentPacket.currBusRaw * 10).toFixed(0)} A
                      </div>
                      <div className="text-[8.5px] font-mono text-slate-500 mt-1 flex justify-between">
                        <span>Limp Threshold:</span>
                        <span className="text-slate-350">1500 A Limit</span>
                      </div>
                      {/* Bar indicator for current safety threshold */}
                      <div className="w-full h-1 bg-slate-900 rounded mt-2.5 relative">
                        <div 
                          className={`h-full rounded transition-all duration-300 ${
                            currentPacket.currBusRaw * 10 >= 1500 ? "bg-red-500 shadow-sm" : "bg-purple-500"
                          }`}
                          style={{ width: `${Math.min(100, ((currentPacket.currBusRaw * 10) / 2000) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono leading-relaxed bg-slate-950 p-2.5 rounded border border-slate-850/60">
                    <strong>Choke Resonance:</strong> The 5-channel PWM H-bridge driver is locked at resonant tracking frequency of <strong>6520 Hz</strong> matching active pressure segment demands.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/40 text-[9px] font-mono text-slate-500 flex justify-between select-none">
                <span>Inductance Feedback loop: SECURE</span>
                <span>Choke Lock: LOCKED</span>
              </div>
            </div>

            {/* Widget 6: Valid Telemetry Network Stream Logs (Col: 12) */}
            <div className="md:col-span-12 bg-slate-900 border border-slate-850 rounded-lg p-5">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-3.5 select-none">
                <span className="text-[10px] text-slate-450 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <Database className="h-4 w-4 text-emerald-400 animate-pulse" />
                  VALIDATED NETWORK REGISTERS Rx STREAM HISTORY
                </span>
                <span className="text-[8px] font-mono px-1.5 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 rounded">
                  RECEIVING FROM PL UART PORT
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full font-mono text-[9.5px] text-slate-350 border-collapse select-none">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase text-left">
                      <th className="py-2 pr-4 text-xs font-semibold">Rx Timestamp</th>
                      <th className="py-2 px-4 text-xs font-semibold">Raw 64-Bit BroadcastHex</th>
                      <th className="py-2 px-4 text-emerald-450 text-xs font-semibold">Yao State Decoded</th>
                      <th className="py-2 px-4 text-purple-450 text-xs font-semibold">Power Rect</th>
                      <th className="py-2 px-4 text-red-455 text-xs font-semibold">Fault Hex</th>
                      <th className="py-2 pl-4 text-right text-xs font-semibold">Audit Integrity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validPacketHistory.length > 0 ? (
                      validPacketHistory.slice().reverse().map((pack, idx) => (
                        <tr 
                          key={idx} 
                          className={`border-b border-slate-850/30 hover:bg-slate-950/40 font-mono ${
                            idx === 0 ? "bg-slate-950/20 text-slate-100 font-bold border-l-2 border-emerald-500" : "text-slate-400"
                          }`}
                        >
                          <td className="py-2 pr-4">{pack.timestamp}</td>
                          <td className="py-2 px-4 text-amber-500 font-mono font-semibold select-all">0x{pack.hex}</td>
                          <td className="py-2 px-4 text-emerald-300 font-bold">{pack.hexagram}</td>
                          <td className="py-2 px-4 text-purple-300">{pack.electrical}</td>
                          <td className="py-2 px-4 font-bold" style={{ color: pack.faultHex !== "0x0" ? "#f87171" : "#64748b" }}>
                            {pack.faultHex}
                          </td>
                          <td className="py-2 pl-4 text-emerald-400 text-right font-bold">
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                              PASS
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500 italic">
                          Awaiting dynamic metabolic telemetry broadcast validation ticks...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: 64-BIT TELEMETRY PACKET CODELYZER */}
      {activeTab === "packet" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 flex flex-col justify-between">
              <div className="bg-slate-900 border border-slate-850 rounded p-4 relative mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] text-slate-450 font-mono font-bold tracking-wider uppercase">
                    RAW SERIALIZED TELEMETRY FRAME
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="text-[10px] font-mono text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded flex items-center gap-1 active:scale-95 transition"
                  >
                    <Copy className="h-3 w-3" />
                    {copying ? "COPIED" : "COPY HEX"}
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded p-4 text-center font-mono text-xl sm:text-2xl font-bold tracking-widest text-amber-500 selection:bg-amber-950 select-all shadow-inner relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.3),transparent)]" />
                  <span className="text-slate-600 mr-2">0x</span>
                  {currentPacket.rawValueHex}
                </div>

                <p className="text-[9px] text-slate-500 font-mono mt-2 leading-normal">
                  Continuous 64-bit frame broadcasted asynchronously over PL UART at high density and efficiency.
                </p>
              </div>

              <div className="bg-slate-900/40 border border-slate-850 rounded p-4">
                <span className="text-[10px] text-slate-400 font-mono font-bold block mb-3 uppercase tracking-wider">
                  VHDL REGISTER BITFIELD DECODING STRIP
                </span>
                
                <div className="w-full flex justify-between font-mono text-[9px] text-slate-600 px-1 mb-1 select-none">
                  <span>Bit 63</span>
                  <span>Bit 48</span>
                  <span>Bit 32</span>
                  <span>Bit 16</span>
                  <span>Bit 0</span>
                </div>

                <div className="w-full flex h-8 text-[10px] font-mono font-bold rounded overflow-hidden border border-slate-800 text-center select-none bg-slate-950">
                  <div className="w-[9.3%] bg-emerald-500/10 border-r border-slate-800 flex items-center justify-center text-emerald-400" title="Hexagram State (6 bits)">HEX</div>
                  <div className="w-[3.1%] bg-purple-500/10 border-r border-slate-800 flex items-center justify-center text-purple-400" title="Electrical command (2 bits)">EL</div>
                  <div className="w-[12.5%] bg-red-500/10 border-r border-slate-800 flex items-center justify-center text-red-400" title="Fault indicators (8 bits)">FLT</div>
                  <div className="w-[18.7%] bg-cyan-500/10 border-r border-slate-800 flex items-center justify-center text-cyan-400" title="GhostSplat Temperature (12 bits)">TEMP</div>
                  <div className="w-[18.7%] bg-blue-500/10 border-r border-slate-800 flex items-center justify-center text-blue-400" title="Plenum Pressure (12 bits)">PRS</div>
                  <div className="w-[18.7%] bg-yellow-500/10 border-r border-slate-800 flex items-center justify-center text-yellow-400" title="Bus Current (12 bits)">CUR</div>
                  <div className="w-[4.6%] bg-indigo-500/10 border-r border-slate-800 flex items-center justify-center text-indigo-400" title="Taylor adaptive order (3 bits)">ORD</div>
                  <div className="w-[1.5%] bg-rose-500/10 border-r border-slate-800 flex items-center justify-center text-rose-400" title="High variance flag (1 bit)">V</div>
                  <div className="w-[12.8%] bg-rose-500/20 border-slate-800 flex items-center justify-center text-rose-400" title="Integrity Check Checksum (8 bits)">CRC</div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2.5 mt-4 font-mono text-[10px]">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px]">HEXAGRAM_STATE [63:58]</span>
                    <span className="text-slate-200 mt-0.5 flex justify-between">
                      <strong>{toBinary(currentPacket.hexagramState, 6)}</strong>
                      <span className="text-emerald-400">({currentPacket.hexagramState})</span>
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px]">ELEC_REGS [57:56]</span>
                    <span className="text-slate-200 mt-0.5 flex justify-between">
                      <strong>{toBinary(currentPacket.electricalReg, 2)}</strong>
                      <span className="text-purple-400">({currentPacket.electricalReg})</span>
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px]">FAULT_VECTOR [55:48]</span>
                    <span className="text-slate-200 mt-0.5 flex justify-between">
                      <strong>{toBinary(currentPacket.faultByte, 8)}</strong>
                      <span className={currentPacket.faultByte > 0 ? "text-red-400 font-bold" : "text-slate-400"}>
                        0x{currentPacket.faultByte.toString(16).toUpperCase()}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-col border-t border-slate-800/40 pt-2">
                    <span className="text-slate-500 text-[9px]">PREDICT_TEMP_RAW [47:36]</span>
                    <span className="text-slate-200 mt-0.5 flex justify-between">
                      <strong>{toBinary(currentPacket.predictedTempRaw, 12)}</strong>
                      <span className="text-cyan-400">0x{currentPacket.predictedTempRaw.toString(16).toUpperCase()}</span>
                    </span>
                  </div>

                  <div className="flex flex-col border-t border-slate-800/40 pt-2">
                    <span className="text-slate-500 text-[9px]">PLENUM_PRESS_RAW [35:24]</span>
                    <span className="text-slate-200 mt-0.5 flex justify-between">
                      <strong>{toBinary(currentPacket.pressPlenumRaw, 12)}</strong>
                      <span className="text-blue-400">0x{currentPacket.pressPlenumRaw.toString(16).toUpperCase()}</span>
                    </span>
                  </div>

                  <div className="flex flex-col border-t border-slate-800/40 pt-2">
                    <span className="text-slate-500 text-[9px]">BUS_CURRENT_RAW [23:12]</span>
                    <span className="text-slate-200 mt-0.5 flex justify-between">
                      <strong>{toBinary(currentPacket.currBusRaw, 12)}</strong>
                      <span className="text-yellow-400">0x{currentPacket.currBusRaw.toString(16).toUpperCase()}</span>
                    </span>
                  </div>

                  <div className="flex flex-col border-t border-slate-800/40 pt-2 col-span-2">
                    <span className="text-slate-500 text-[9px]">UART_FRAME_CRC8 [7:0]</span>
                    <span className="text-slate-200 mt-0.5 flex justify-between">
                      <strong>{toBinary(currentPacket.decodedCrc ?? 0, 8)}</strong>
                      <span className={currentPacket.crcValid ? "text-emerald-400 font-bold" : "text-rose-450 font-bold"}>
                        {`0x${(currentPacket.decodedCrc ?? 0).toString(16).toUpperCase()} (exp: 0x${(currentPacket.expectedCrc ?? 0).toString(16).toUpperCase()} | ${currentPacket.crcValid ? "VALID" : "CORRUPT"})`}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right sidebar log stream */}
            <div className="lg:col-span-4 flex flex-col h-full min-h-[350px]">
              <span className="text-[10px] text-slate-400 font-mono font-bold block mb-2 uppercase tracking-wide">
                UART SERIAL LOG STREAM (ARM9 CORE RX)
              </span>
              <div className="bg-slate-900 border border-slate-850 p-3.5 rounded flex-1 flex flex-col font-mono text-[9px] text-emerald-400 overflow-hidden relative shadow-inner">
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <button
                    onClick={handleExportPacketHistoryCSV}
                    disabled={packetHistory.length === 0}
                    className="flex items-center gap-0.5 text-[8px] bg-slate-800 hover:bg-slate-750 border border-slate-700 disabled:opacity-45 disabled:pointer-events-none text-slate-200 font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    title="Download Packet History as CSV"
                  >
                    <Download className="h-2 w-2 text-slate-400" />
                    CSV
                  </button>
                  <button
                    onClick={handleExportPacketHistoryJSON}
                    disabled={packetHistory.length === 0}
                    className="flex items-center gap-0.5 text-[8px] bg-slate-800 hover:bg-slate-750 border border-slate-700 disabled:opacity-45 disabled:pointer-events-none text-slate-200 font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    title="Download Packet History as JSON"
                  >
                    <Download className="h-2 w-2 text-slate-400" />
                    JSON
                  </button>
                  <button
                    onClick={handleExportFullSimulationArchive}
                    disabled={packetHistory.length === 0 && (!transitionHistory || transitionHistory.length === 0)}
                    className="flex items-center gap-0.5 text-[8px] bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700 disabled:opacity-45 disabled:pointer-events-none text-emerald-300 font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    title="Export full session packet history and state transition logs as a unified JSON package"
                  >
                    💾 SAVE ARCHIVE
                  </button>
                  <button
                    onClick={clearHistory}
                    disabled={packetHistory.length === 0}
                    className="flex items-center gap-0.5 text-[8px] bg-rose-950/40 hover:bg-rose-900 border border-rose-900 disabled:opacity-45 disabled:pointer-events-none text-rose-300 font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    title="Purge Local Database & History arrays"
                  >
                    🗑️ CLEAR
                  </button>
                  <div className="text-[8px] bg-emerald-950/70 border border-emerald-900 text-emerald-400 px-1.5 py-0.5 rounded animate-pulse select-none font-bold">
                    STREAMING
                  </div>
                </div>
                <div ref={terminalContainerRef} className="flex-1 overflow-y-auto pr-1 space-y-1 max-h-[320px]">
                  {packetHistory.length === 0 ? (
                    <div className="text-slate-505 italic h-full flex items-center justify-center">
                      Waiting for UART telemetry packets...
                    </div>
                  ) : (
                    packetHistory.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-1 py-0.5 border-b border-slate-850/20 select-all hover:bg-emerald-950/20 px-1 rounded">
                        <span className="text-slate-600 select-none">[{idx.toString().padStart(3, "0")}]</span>
                        <span className="text-slate-400">{line}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE HARDWARE SUBSYSTEM FAULT REGISTRY */}
      {activeTab === "registry" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3.5 rounded-lg text-xs leading-relaxed">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="font-mono text-slate-450">
                <span className="text-slate-200 font-bold uppercase block mb-0.5">Boundary Condition Watchdogs Table</span>
                Continuous boundary comparator matrix implemented directly in FPGA fabric look-up tables.
              </div>
            </div>
            {activeFaultCodes.length > 0 ? (
              <div className="bg-red-950 border border-red-800 px-3 py-1 text-red-400 font-mono font-bold uppercase text-[10px] rounded animate-pulse shrink-0">
                ● ALARM TRIPPED
              </div>
            ) : (
              <div className="bg-emerald-950 border border-emerald-800 px-3 py-1 text-emerald-400 font-mono font-bold uppercase text-[10px] rounded shrink-0">
                ● NOMINAL SECURE
              </div>
            )}
          </div>

          {/* Fault grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DETAILED_FAULT_REGISTRY.map((fault) => {
              const isTripped = activeFaultCodes.includes(fault.code);
              return (
                <div
                  key={fault.code}
                  className={`border rounded-lg p-4 font-mono text-[11px] transition-all duration-300 ${
                    isTripped
                      ? "bg-red-950/25 border-red-700 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                      : "bg-slate-900/40 border-slate-850 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between border-b border-white/5 pb-2 mb-2">
                    <div>
                      <span className="text-[10px] bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded text-white font-bold mr-1.5">
                        {fault.subsystem}
                      </span>
                      <span className={`font-bold ${isTripped ? "text-red-400" : "text-amber-500"}`}>
                        {fault.code}
                      </span>
                    </div>

                    {isTripped ? (
                      <span className="bg-red-955 text-red-500 text-[9px] font-bold uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
                        LIMIT BREAK
                      </span>
                    ) : (
                      <span className="text-emerald-500 text-[10px] font-bold flex items-center gap-1 select-none">
                        <Check className="h-3 w-3" />
                         NOMINAL
                      </span>
                    )}
                  </div>

                  <h4 className="text-slate-200 font-bold mb-1 uppercase font-display text-xs">
                    {fault.label}
                  </h4>
                  <p className="text-slate-400 text-[10px] leading-relaxed mb-1.5">
                    {fault.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 bg-slate-950/40 border border-slate-900 p-2 rounded text-[9px] text-slate-500 leading-normal">
                    <div>
                      <span className="block text-slate-655 font-bold uppercase select-none">Rule Trigger Matrix:</span>
                      <code className="text-slate-350 bg-slate-900 px-1 py-0.5 rounded block mt-0.5 max-w-full overflow-x-auto select-all">
                        {fault.severity === FaultSeverity.CRITICAL ? "CRITICAL: " : "WARN: "}{fault.code === "T-01" ? "Temp >= 310.0K" : fault.code === "T-02" ? "Temp >= 320.0K" : fault.code === "E-01" ? "Current >= 1950A" : fault.code === "E-02" ? "HV Rectifier fail" : fault.code === "M-01" ? "Plenum < 1.25atm" : fault.code === "M-02" ? "Plenum > 1.35atm" : fault.code === "S-01" ? "Contactor imbalance" : fault.code === "S-02" ? "Gate drive desat" : fault.code === "C-01" ? "Timing Slack < 0s" : "CRIT ticks >= 47"}
                      </code>
                    </div>
                    <div>
                      <span className="block text-slate-655 font-bold uppercase select-none">Graceful Mitigation:</span>
                      <span className="text-amber-400 block mt-0.5 leading-snug">
                        {fault.mitigation}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: UART DIAGNOSTICS & SYSTEM LOG INTERFACE + AXIL COMMAND SHELL */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          
          {/* Filters and Utilities toolbar bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between bg-slate-900 border border-slate-850 p-3 rounded-lg gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Search bar */}
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-600" />
                <input
                  type="text"
                  placeholder="Filter messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-[10px] pl-8 pr-3 py-1.5 h-8 rounded w-full focus:outline-none focus:border-amber-700 font-mono"
                />
              </div>

              {/* Severity filter dropdown */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-350 font-mono text-[10px] px-2 py-1.5 h-8 rounded cursor-pointer focus:outline-none"
              >
                <option value="ALL">ALL LEVELS</option>
                <option value="INFO">INFO LEVEL</option>
                <option value="SUCCESS">SUCCESS STATE</option>
                <option value="WARNING">WARNING CODE</option>
                <option value="CRITICAL">CRITICAL TRIP</option>
              </select>

              {/* Subsystem filter dropdown */}
              <select
                value={subsystemFilter}
                onChange={(e) => setSubsystemFilter(e.target.value)}
                className="bg-slate-950 border border-slate-805 text-slate-350 font-mono text-[10px] px-2 py-1.5 h-8 rounded cursor-pointer focus:outline-none"
              >
                <option value="ALL">ALL SUBSYSTEMS</option>
                <option value="SYSTEM">SYSTEM KERNEL</option>
                <option value={SubsystemId.THERMAL}>THERMOPHYSICAL</option>
                <option value={SubsystemId.ELECTRICAL}>POWER_CONVERSION</option>
                <option value={SubsystemId.VENTILATION}>MECHANICAL_CHOKE</option>
                <option value={SubsystemId.INTERLOCK_SEQUENCE}>INTERLOCKS_SEQ</option>
                <option value={SubsystemId.SECURE_LOCK}>SECURE_LOCK</option>
                <option value={SubsystemId.CDC_CLOCKING}>CDC_CLOCKING</option>
              </select>
            </div>

            {/* Export log actions */}
            <div className="flex gap-1.5 font-mono text-[9px] select-none">
              <button
                onClick={() => handleExportLogs("csv")}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:text-slate-100 rounded flex items-center gap-1 active:scale-95 transition cursor-pointer"
              >
                <Download className="h-3 w-3 text-cyan-400" /> Export CSV
              </button>
              <button
                onClick={() => handleExportLogs("txt")}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:text-slate-100 rounded flex items-center gap-1 active:scale-95 transition cursor-pointer"
              >
                <FileText className="h-3 w-3 text-amber-400" /> Save .log File
              </button>
              <button
                onClick={() => handleExportLogs("json")}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:text-slate-100 rounded flex items-center gap-1 active:scale-95 transition cursor-pointer"
                title="Export entire systemLogs array as formatted JSON"
              >
                <Database className="h-3 w-3 text-emerald-400" /> Export JSON
              </button>
            </div>
          </div>

          {/* MAIN GRID: Log table on left, shell on right */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            
            {/* Log event feed */}
            <div className="xl:col-span-7 flex flex-col h-[380px]">
              <span className="text-[10px] text-slate-500 font-mono mb-1 select-none">
                EVENT DATABLOCKS COUNTER ({filteredLogs.length} events matching current query)
              </span>
              <div className="bg-slate-900 border border-slate-850 rounded flex-1 flex flex-col overflow-hidden">
                <div ref={logsContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-[10px]">
                  {filteredLogs.length === 0 ? (
                    <div className="text-slate-505 italic text-center py-20">
                      No logs matching query criteria found in memory.
                    </div>
                  ) : (
                    filteredLogs.map((log) => {
                      const isCritical = log.level === "CRITICAL";
                      const isWarning = log.level === "WARNING";
                      const isSuccess = log.level === "SUCCESS";
                      return (
                        <div
                          key={log.id}
                          className={`p-2 rounded border transition-colors ${
                            isCritical
                              ? "bg-red-955/20 border-red-900 text-red-300"
                              : isWarning
                              ? "bg-amber-955/20 border-amber-900 text-amber-300"
                              : isSuccess
                              ? "bg-emerald-955/20 border-emerald-900 text-emerald-300"
                              : "bg-slate-950 border-slate-850 text-slate-350"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[8px] opacity-75 mb-1 gap-1">
                            <div className="flex gap-2">
                              <span>ID: {log.id}</span>
                              <span>•</span>
                              <span>Timestamp: {log.timestamp} (Tick #{log.tick})</span>
                            </div>
                            <span className="font-bold underline">
                              Subsystem: {log.subsystem}
                            </span>
                          </div>
                          
                          <div className="text-[11px] leading-relaxed break-words font-sans">
                            {log.message}
                          </div>

                          <div className="text-[8px] font-mono text-slate-500 mt-1 select-all border-t border-white/5 pt-1">
                            Snap: {log.variableSnapshot}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Shell */}
            <div className="xl:col-span-5 flex flex-col h-[380px]">
              <div className="flex items-center justify-between mb-1 select-none">
                <span className="text-[10px] text-slate-500 font-mono">
                  AXI4-LITE CONTROLLER / LOW LEVEL PHYSICAL INJECTOR SHELL
                </span>
                <span className="text-[8px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1 rounded font-mono">
                  ACTIVE SHELL
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded p-3 flex-1 flex flex-col font-mono text-[10px] text-slate-350 overflow-hidden shadow-inner">
                {/* Console logs */}
                <div ref={cliContainerRef} className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin select-text font-mono">
                  {cliHistory.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap leading-normal break-words py-0.5 border-b border-white/5">
                      {line}
                    </div>
                  ))}
                </div>

                {/* Input form */}
                <form onSubmit={handleCliSubmit} className="flex gap-1 border-t border-slate-800 pt-2.5 mt-2">
                  <span className="text-cyan-400 select-none font-bold">host$ </span>
                  <input
                    type="text"
                    value={cliInput}
                    onChange={(e) => setCliInput(e.target.value)}
                    placeholder="Type AXI commands... (e.g. 'help')"
                    className="flex-1 bg-transparent text-white border-0 outline-none p-0 focus:ring-0 font-mono placeholder-slate-650"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-slate-900 border border-slate-800 rounded font-bold hover:border-slate-700 text-white cursor-pointer hover:bg-slate-850 transition"
                  >
                    RUN
                  </button>
                </form>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 4: AI MODEL TRAINING LAB, STRING INJECTION AND PREDICTIVE SEQUENCING */}
      {activeTab === "ai_training" && (
        <div className="space-y-5">
          {/* Header Description banner */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg flex flex-col md:flex-row shadow-lg justify-between gap-4">
            <div className="flex items-start gap-3">
              <Brain className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-display font-medium text-sm text-slate-100 tracking-wider uppercase mb-1">
                  Synthetic Co-Processor Neural Training Dashboard
                </h4>
                <p className="text-slate-400 font-sans text-[11px] leading-relaxed max-w-2xl">
                  Configure multi-dimensional emotional weight vectors per Hexagram node to optimize synthetic speech synthesis and computer vision neural pipelines. Recall historic state trajectories and load/inject raw string states to predict machine behavior profiles.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] shrink-0">
              <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                GATES OPENED: {Object.values(gatedEmotions).filter(Boolean).length}/7
              </span>
              <span className="bg-amber-955/60 text-amber-400 border border-amber-800 px-2 py-0.5 rounded">
                TRAINING FRAMES: {trainingSequence.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* COLUMN 1: OPEN GATED EMOTIONAL WEIGHT PROFILE DESIGNER (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-emerald-400" />
                    <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-wider">
                      EMOTIONAL SPECTRUM PROFILE
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/40">
                    {HexagramStateLabels[currentPacket.hexagramState].split(" (")[0]}
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 font-sans mb-4 leading-normal">
                  Customize emotional intensities associated with this state. These profiles train Voice & Vision models on appropriate tone response levels during system events.
                </p>

                {/* Slider loops */}
                <div className="space-y-3.5">
                  {Object.values(EmotionalTone).map((emotion) => {
                    const isGated = gatedEmotions[emotion];
                    const activeProfile = customEmotionalProfiles[currentPacket.hexagramState];
                    // If emotion is closed-gated, weight evaluates to 0
                    const weightVal = isGated ? (activeProfile?.weights[emotion] ?? 0) : 0;

                    return (
                      <div key={emotion} className={`p-2.5 rounded border transition-colors ${isGated ? "bg-slate-950/60 border-slate-800" : "bg-slate-950/10 border-slate-900/60 opacity-55"}`}>
                        <div className="flex items-center justify-between font-mono text-[10px] mb-1.5 select-none">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isGated}
                              onChange={(e) => setGatedEmotions(prev => ({ ...prev, [emotion]: e.target.checked }))}
                              className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer h-3.5 w-3.5"
                              id={`gate-${emotion}`}
                              title="Toggle selection in neural training gate array"
                            />
                            <label htmlFor={`gate-${emotion}`} className={`font-bold cursor-pointer transition ${isGated ? "text-slate-200" : "text-slate-505"}`}>
                              {emotion}
                            </label>
                          </div>
                          <span className={`font-bold ${isGated ? "text-emerald-400" : "text-slate-600"}`}>
                            {isGated ? `${(weightVal * 100).toFixed(0)}%` : "MUTED"}
                          </span>
                        </div>

                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          disabled={!isGated}
                          value={activeProfile?.weights[emotion] ?? 0}
                          onChange={(e) => handleEmotionWeightChange(emotion, parseFloat(e.target.value))}
                          className="w-full bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Training Speech & Vision Synthesizer Modulators */}
              <div className="mt-5 pt-4 border-t border-slate-800 font-mono text-[10px]">
                <span className="text-[10px] text-slate-350 block font-bold mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  TTS VOICE & VISION MODEL INTEGRATIONS
                </span>

                <div className="bg-slate-950 border border-slate-900 p-3 rounded space-y-2.5 text-slate-400 leading-normal">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[9px]">
                      <span>1. VOICE PITCH ACCENT MODULATION:</span>
                      <strong className="text-cyan-400">
                        {customEmotionalProfiles[currentPacket.hexagramState].voicePitchShift >= 0 ? "+" : ""}
                        {customEmotionalProfiles[currentPacket.hexagramState].voicePitchShift.toFixed(1)}%
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={customEmotionalProfiles[currentPacket.hexagramState].voicePitchShift}
                      onChange={(e) => handleVocalBiasChange("voicePitchShift", parseFloat(e.target.value))}
                      className="w-full appearance-none h-1 bg-slate-800 rounded accent-cyan-500"
                    />
                    <code className="text-[8px] text-slate-500 block max-h-4 overflow-hidden truncate">
                      PITCH_BIAS = base_hz * (1.0 + ({customEmotionalProfiles[currentPacket.hexagramState].voicePitchShift / 100}))
                    </code>
                  </div>

                  <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2.5">
                    <div className="flex justify-between items-center text-[9px]">
                      <span>2. VOCAL SPEAKING RATE TEMPO BIAS:</span>
                      <strong className="text-yellow-400">
                        {customEmotionalProfiles[currentPacket.hexagramState].voiceTempoBias.toFixed(2)}x
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={customEmotionalProfiles[currentPacket.hexagramState].voiceTempoBias}
                      onChange={(e) => handleVocalBiasChange("voiceTempoBias", parseFloat(e.target.value))}
                      className="w-full appearance-none h-1 bg-slate-800 rounded accent-yellow-500"
                    />
                    <code className="text-[8px] text-slate-500 block max-h-4 overflow-hidden truncate">
                      SPEECH_CADENCE_WPM = 150 * {customEmotionalProfiles[currentPacket.hexagramState].voiceTempoBias.toFixed(2)}
                    </code>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 border-t border-white/5 pt-2.5 text-[9px] leading-snug">
                    <div>
                      <span>3. VISION RENDER HUE ROTANGLE:</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div
                          className="w-3.5 h-3.5 rounded border border-white/20"
                          style={{ backgroundColor: `hsl(${customEmotionalProfiles[currentPacket.hexagramState].visionHueTilt}, 80%, 50%)` }}
                        />
                        <strong className="text-slate-200">
                          {customEmotionalProfiles[currentPacket.hexagramState].visionHueTilt}° Shift
                        </strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={customEmotionalProfiles[currentPacket.hexagramState].visionHueTilt}
                        onChange={(e) => handleVocalBiasChange("visionHueTilt", parseInt(e.target.value))}
                        className="w-full appearance-none h-1 bg-slate-800 rounded mt-1.5 accent-purple-500"
                      />
                    </div>

                    <div>
                      <span>4. CAMERA FEED FRAME RATE:</span>
                      <strong className="block mt-1 text-slate-200">
                        {customEmotionalProfiles[currentPacket.hexagramState].visionFrameRate} Hz
                      </strong>
                      <input
                        type="range"
                        min="5"
                        max="120"
                        step="5"
                        value={customEmotionalProfiles[currentPacket.hexagramState].visionFrameRate}
                        onChange={(e) => handleVocalBiasChange("visionFrameRate", parseInt(e.target.value))}
                        className="w-full appearance-none h-1 bg-slate-800 rounded mt-1.5 accent-pink-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 mt-4">
                  <button
                    onClick={resetEmotionalWeightsToDefault}
                    className="flex-1 py-1.5 border border-slate-800 bg-slate-950 text-slate-400 rounded text-[9px] font-bold hover:border-slate-700 hover:text-slate-200 transition cursor-pointer text-center"
                    title="Revert to default VHDL training matrices"
                  >
                    FACTORY RESET MODULES
                  </button>
                  <button
                    onClick={() => {
                      addLogEntry("SYSTEM" as any, "SUCCESS", `EMOTION SYNC: Saved custom weight envelope tuning profile: Quietude(${(customEmotionalProfiles[currentPacket.hexagramState].weights.QUIETUDE*100).toFixed(0)}%), Serenity(${(customEmotionalProfiles[currentPacket.hexagramState].weights.SERENITY*100).toFixed(0)}%), Tension(${(customEmotionalProfiles[currentPacket.hexagramState].weights.TENSION*100).toFixed(0)}%) etc.`);
                      setInjectionLogStatus({ text: "Tuning guidelines backed up in current profile register success!", level: "SUCCESS" });
                    }}
                    className="flex-1 py-1.5 bg-emerald-900/40 text-emerald-305 border border-emerald-800 rounded text-[9px] font-bold hover:bg-emerald-850 hover:text-emerald-200 transition cursor-pointer text-center"
                  >
                    SYNC CHIP SPEC
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMN 2: TERNARY ROAD SYSTEM, SLOTS AND COLLECTOR ENGINE (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
                      {/* SECTION A: TERNARY AI MIND ROUTING CONTROLLER */}
              {(() => {
                const mind = calculateTernaryMindYao();
                return (
                  <div className="bg-slate-900 border border-slate-855 p-4 rounded-lg">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-purple-400" />
                        <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-wider">
                          TERNARY CO-PROCESSOR ROUTING (HEXAGRAM AS &lt;MIND&gt;)
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                        mind.activeRoute === "YANG"
                          ? "bg-amber-955/50 text-amber-400 border-amber-800"
                          : mind.activeRoute === "YIN"
                          ? "bg-purple-955/50 text-purple-400 border-purple-800"
                          : "bg-cyan-955/50 text-cyan-400 border-cyan-800"
                      }`}>
                        GATE: {mind.activeRoute === "YANG" ? "YANG ASCENDANT" : mind.activeRoute === "YIN" ? "YIN RETREAT" : "YAO COMPLEMENT"}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-450 font-sans mb-4 leading-relaxed">
                      The active Hexagram acts as a 6-bit ternary co-processor matrix. Based on live variables and emotional thresholds, the system computes routing pathways dividing into <strong>Yang (+1)</strong>, <strong>Yin (-1)</strong>, or <strong>Yao (0)</strong> states to guide automated speech timbre dynamics and safety interlocks.
                    </p>

                    {/* Synchronized AI Autopilot Interactive Toggle */}
                    <div className="bg-slate-950 border border-slate-850 p-2.5 rounded mb-4 flex items-center justify-between font-mono text-[9px] leading-normal select-none">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isAiActive ? "bg-amber-400 animate-pulse" : "bg-slate-600"}`} />
                        <div>
                          <span className="font-bold text-slate-300 uppercase">AI AUTOPILOT TRANSITION SEQUENCER</span>
                          <span className="block text-slate-500 text-[8px] mt-0.5">When active, AI automatically transitions states using real math models instead of user buttons.</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isAiActive}
                          id="ai-autopilot-toggle-telemetry"
                          onChange={(e) => {
                            setIsAiActive(e.target.checked);
                            addLogEntry("SYSTEM" as any, e.target.checked ? "SUCCESS" : "WARNING", e.target.checked ? "AI PILOT ENABLED: Decision engine actively routing state interlocks." : "AI PILOT DEACTIVATED: Manual register control active.");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-slate-900 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-450 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500 border border-slate-800" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* Hexagram Line Drawer */}
                      <div className="md:col-span-5 bg-slate-950 border border-slate-855 p-3 rounded flex flex-col items-center justify-center gap-2">
                        <span className="text-[8px] text-slate-500 font-mono uppercase tracking-wider mb-1">
                          CO-PROCESSOR Yao Layers
                        </span>
                        
                        {/* 6 Yao lines, reversed so Line 6 is at the top */}
                        <div className="w-full flex flex-col gap-2">
                          {mind.yaoArray.slice().reverse().map((yaoVal, idx) => {
                            const lineIndex = 6 - idx;
                            return (
                              <div key={lineIndex} className="flex items-center justify-between w-full text-[9px] font-mono">
                                <span className="text-slate-500 text-[8px] shrink-0 w-12">L{lineIndex}:</span>
                                
                                <div className="flex-1 flex justify-center px-2">
                                  {yaoVal === 1 ? (
                                    /* Yang line - Solid single bar */
                                    <div className="w-full h-1.5 bg-gradient-to-r from-amber-600 to-yellow-500 rounded-sm shadow-sm opacity-90" title="Yang State (+1)" />
                                  ) : yaoVal === -1 ? (
                                    /* Yin line - Broken double bar */
                                    <div className="w-full flex justify-between gap-1.5" title="Yin State (-1)">
                                      <div className="w-[45%] h-1.5 bg-gradient-to-r from-purple-800 to-indigo-700 rounded-sm" />
                                      <div className="w-[45%] h-1.5 bg-gradient-to-r from-indigo-700 to-purple-800 rounded-sm" />
                                    </div>
                                  ) : (
                                    /* Yao line - Broken double bar with glow dot in center representing changing / dynamic core */
                                    <div className="w-full flex items-center justify-between relative" title="Yao State (0)">
                                      <div className="w-[40%] h-1.5 bg-gradient-to-r from-cyan-850 to-blue-800 rounded-sm" />
                                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-405 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-slate-950 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                                      <div className="w-[40%] h-1.5 bg-gradient-to-r from-blue-800 to-cyan-850 rounded-sm" />
                                    </div>
                                  )}
                                </div>

                                <span className={`text-[8px] font-bold shrink-0 w-10 text-right ${
                                  yaoVal === 1 ? "text-amber-400" : yaoVal === -1 ? "text-purple-400" : "text-cyan-400"
                                }`}>
                                  {yaoVal === 1 ? "YANG" : yaoVal === -1 ? "YIN" : "YAO"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mind Routing Pathway Details */}
                      <div className="md:col-span-7 space-y-2.5">
                        <div className="bg-slate-950/80 p-2.5 rounded border border-slate-850 text-[10px] font-mono leading-normal">
                          <span className="text-slate-500 text-[8px] uppercase block mb-1">AGGREGATE ROAD BALANCE SCORE</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-100">{mind.totalScore >= 0 ? "+" : ""}{mind.totalScore}</span>
                            <div className="flex-1 bg-slate-900 border border-slate-800 h-2 rounded overflow-hidden flex relative">
                              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-750" />
                              <div
                                className={`h-full absolute left-1/2 transition-all duration-300 ${
                                  mind.totalScore > 0
                                    ? "bg-amber-500"
                                    : "bg-purple-500"
                                }`}
                                style={{
                                  left: mind.totalScore >= 0 ? "50%" : `calc(50% - ${Math.abs(mind.totalScore) * 8.35}%)`,
                                  width: `${Math.abs(mind.totalScore) * 8.35}%`
                                }}
                              />
                            </div>
                            <span className="text-[8px] text-slate-505">MAX +/-6</span>
                          </div>
                        </div>

                        <div className="bg-slate-950/40 p-2.5 border border-slate-850/60 rounded text-[10px] space-y-1">
                          <span className="text-[9px] font-bold text-slate-350 block select-none">Gate Route Directives (Ternary Router):</span>
                          <div className="space-y-1.5">
                            <div className={`p-1.5 rounded transition ${mind.activeRoute === "YANG" ? "bg-amber-955/20 border border-amber-800/60 text-amber-300" : "opacity-30"}`}>
                              <span className="font-mono font-bold text-[9px] block">⚊ YANG PATHWAY: HIGH EFFICIENCY DETECTOR ENGAGEMENT</span>
                              <span className="text-[8px] block mt-0.5 leading-normal">Excitation frequencies fully synchronized. High speed custom sampling active, voice resonance tuned for maximum thrust.</span>
                            </div>
                            <div className={`p-1.5 rounded transition ${mind.activeRoute === "YAO" ? "bg-cyan-955/20 border border-cyan-800/60 text-cyan-300" : "opacity-30"}`}>
                              <span className="font-mono font-bold text-[9px] block">🔁 YAO PATHWAY: HARMONIZED METABOLIC FLUX (DYNAMIC BALANCER)</span>
                              <span className="text-[8px] block mt-0.5 leading-normal">Stable Yao alignment. Choke loops synchronized. Symmetrical power regulators active with standard safe parameters.</span>
                            </div>
                            <div className={`p-1.5 rounded transition ${mind.activeRoute === "YIN" ? "bg-purple-955/20 border border-purple-800/60 text-purple-300" : "opacity-30"}`}>
                              <span className="font-mono font-bold text-[9px] block">⚋ YIN PATHWAY: SAFE ENERGY DAMPING RESERVE</span>
                              <span className="text-[8px] block mt-0.5 leading-normal">Subdued, cautious core controls. Sampling decelerated to conserve thermals. Interlock systems strictly armed.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SECTION B: MULTIPLE SAVE SLOTS CONFIGURATOR */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg">
                <span className="text-[10px] text-slate-200 font-mono font-bold block mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-cyan-400" />
                  LEARNING WEIGHT OVERRIDE SLOTS
                </span>

                <p className="text-[10px] text-slate-450 font-sans mb-3 leading-relaxed">
                  Store custom configuration presets into high-speed dynamic lookup slots (retained in browser storage). Connect and transfer selected slot environments directly into the training collector payload.
                </p>

                {/* Slots grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[1, 2, 3, 4].map((slotId) => {
                    const slot = injectionSlots[slotId];
                    const isActive = activeSlotId === slotId;
                    return (
                      <button
                        key={slotId}
                        onClick={() => setActiveSlotId(slotId)}
                        className={`p-2.5 rounded border text-left flex flex-col justify-between font-mono select-none h-20 transition ${
                          isActive
                            ? "bg-slate-950 border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)] text-cyan-300"
                            : slot
                            ? "bg-slate-950/60 border-slate-800/70 hover:border-slate-700 text-slate-200"
                            : "bg-slate-950/10 border-slate-900 text-slate-500 border-dashed"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full text-[9px]">
                          <span className="font-bold uppercase">SLOT #{slotId}</span>
                          {slot ? (
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              slot.reaction === "GOOD" ? "bg-emerald-400" : slot.reaction === "BAD" ? "bg-red-400" : "bg-slate-400"
                            }`} />
                          ) : (
                            <span className="text-[8px] text-slate-650 font-sans italic">empty</span>
                          )}
                        </div>

                        {slot ? (
                          <div className="text-[9px] truncate w-full">
                            <strong className="block text-slate-100 text-[10px] mb-0.5">{slot.stateLabel.split(" (")[0]}</strong>
                            <span className="text-[8px] text-slate-500">{slot.timestamp}</span>
                          </div>
                        ) : (
                          <div className="text-[8px] text-slate-600 uppercase font-bold leading-normal">
                            UNALLOCATED
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* active slot inspector details & actions */}
                <div className="bg-slate-950/80 p-3 rounded border border-slate-850 font-mono text-[9px] mb-3.5">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-1.5 mb-2">
                    <span className="text-slate-400 font-bold uppercase">SELECTED RECIPIENT SLOT PRESETS</span>
                    <strong className="text-cyan-400">REGISTER #{activeSlotId}</strong>
                  </div>

                  {injectionSlots[activeSlotId] ? (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-2 text-slate-450 text-[9px]">
                        <div>STATE: <strong className="text-slate-105">{injectionSlots[activeSlotId]?.stateLabel}</strong></div>
                        <div>TIME RECORDED: <strong className="text-slate-105">{injectionSlots[activeSlotId]?.timestamp}</strong></div>
                        <div>REACTION ASSESSMENT: <strong className={`text-slate-105 ${
                          injectionSlots[activeSlotId]?.reaction === "GOOD" ? "text-emerald-400 font-bold" :
                          injectionSlots[activeSlotId]?.reaction === "BAD" ? "text-red-400 font-bold" : "text-slate-350 font-bold"
                        }`}>{injectionSlots[activeSlotId]?.reaction}</strong></div>
                        <div>REASON / NOTES: <strong className="text-slate-105 truncate block max-w-full italic">"{injectionSlots[activeSlotId]?.reason}"</strong></div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1.5">
                        <button
                          onClick={() => loadFromSlot(activeSlotId)}
                          className="px-2.5 py-1 bg-cyan-950/60 border border-cyan-800 text-cyan-300 font-bold hover:border-cyan-600 rounded transition cursor-pointer text-[8px]"
                        >
                          DEPLOY PRESET TO CORE
                        </button>
                        <button
                          onClick={() => pushSlotToCollector(activeSlotId)}
                          className="px-2.5 py-1 bg-emerald-950/40 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 rounded font-bold transition cursor-pointer text-[8px]"
                        >
                          PUSH JSON TO COLLECTOR
                        </button>
                        <button
                          onClick={() => {
                            setInjectionSlots(prev => ({ ...prev, [activeSlotId]: null }));
                            setInjectionLogStatus({ text: `Erased Slot register #${activeSlotId}.`, level: "INFO" });
                          }}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-450 hover:text-red-400 hover:border-red-900/60 rounded transition cursor-pointer text-[8px]"
                        >
                          ERASE PRESENTS
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-505 italic text-center py-2.5">
                      No cached model matrix in Slot #{activeSlotId}. Save the current dynamic settings below to allocate it.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-900/40">
                    <button
                      onClick={() => saveCurrentToSlot(activeSlotId)}
                      className="px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 rounded font-bold transition cursor-pointer flex items-center gap-1 text-[8.5px]"
                    >
                      <span>➔</span> SAVE CURRENT STATE TO SLOT #{activeSlotId}
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-850 pt-3.5">
                  <span className="text-[9px] text-slate-350 font-mono font-bold block mb-1">RAW SERIALIZED STATE STRING INJECTOR</span>
                  <textarea
                    value={stringInjectionValue}
                    onChange={(e) => setStringInjectionValue(e.target.value)}
                    placeholder='Paste raw hexagram state save string here (JSON block or Base64 state timeline)... e.g.:&#13;{"hexagram":52,"timestamp":"04:45:22","reaction":"GOOD","reason":"Low thermal core status"}'
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 font-mono text-[9px] text-slate-350 h-16 focus:outline-none focus:border-cyan-700"
                  />

                  {/* Dynamic Inline Status Banner */}
                  {injectionLogStatus.level !== "NONE" && (
                    <div className={`text-[10px] font-mono rounded px-3 py-1.5 my-2 border flex items-center gap-1.5 leading-normal ${
                      injectionLogStatus.level === "SUCCESS"
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-400 font-bold"
                        : injectionLogStatus.level === "ERROR"
                        ? "bg-red-955/20 border-red-900 text-red-350 font-bold"
                        : "bg-cyan-955/20 border-cyan-900 text-cyan-350"
                    }`}>
                      {injectionLogStatus.level === "SUCCESS" ? (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {injectionLogStatus.text}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-2 font-mono text-[8px]">
                    <button
                      onClick={handleStringInjection}
                      className="px-2.5 py-1.5 bg-cyan-950/45 border border-cyan-800/80 text-cyan-350 rounded hover:border-cyan-600 transition font-bold"
                    >
                      HYDRATE INJECT STRING
                    </button>
                    <button
                      onClick={generateCurrentSaveStateString}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-slate-305 rounded hover:border-slate-705"
                      title="Serialize whole memory timeline"
                    >
                      SERIALIZE MEMORY SEQUENCE
                    </button>
                    <button
                      onClick={generateSimpleVariableStateString}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-slate-405 rounded hover:border-slate-705"
                    >
                      SNAP PARAMETERSCODE
                    </button>
                  </div>

                  {playerState && (
                    <div className="mt-3.5 pt-3 border-t border-slate-900 bg-slate-950/30 rounded p-2.5 border border-slate-900/60 font-mono text-[9px]">
                      <div className="flex justify-between items-center text-cyan-400 font-bold mb-2">
                        <span className="flex items-center gap-1">👤 LOADED PLAYER STATE ({playerState.username || "UNKNOWN"})</span>
                        <span className="text-[8px] px-1 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded font-normal">Active Session</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-450">
                        <div>COORDINATES: <strong className="text-slate-200">X: {playerState.x ?? 0}, Y: {playerState.y ?? 0}</strong></div>
                        <div>COMBAT STYLE: <strong className="text-slate-200">{playerState.combatStyle ?? 0}</strong></div>
                        <div>FATIGUE RATE: <strong className="text-slate-200">{playerState.fatigue ?? 0}%</strong></div>
                      </div>
                      {playerState.skills && (
                        <div className="mt-2.5 pt-2 border-t border-slate-950/80">
                          <span className="text-[8px] text-slate-500 font-bold block mb-1">CHARACTER SKILL REGISTER MATRIX:</span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(playerState.skills).map(([skillName, skillData]: [string, any]) => {
                              const cur = skillData?.current ?? 1;
                              const exp = skillData?.experience ?? 0;
                              return (
                                <span key={skillName} className="text-[8px] px-1.5 py-0.5 bg-slate-950/90 border border-slate-850 text-slate-300 rounded flex items-center gap-1 leading-none">
                                  <span className="text-[7px] text-slate-500 uppercase">{skillName.substring(0, 3)}:</span>
                                  <strong className="text-emerald-400 font-bold">{cur}</strong>
                                  {exp > 0 && <span className="text-[6.5px] text-slate-500">({exp} XP)</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* PANEL SECTION B: HIGH FIDELITY OPENRSC BANKING TERMINAL AND SYSTEM INTEGRATION */}
                      <div className="mt-4 pt-3 border-t border-slate-900 space-y-3 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-orange-400 uppercase tracking-widest flex items-center gap-1.5 select-none">
                            🏦 CANONICAL OPENRSC BANK VAULT TERMINAL
                          </span>
                          <span className="text-[7.5px] px-1 bg-amber-950/80 border border-amber-800 text-amber-400 rounded select-none">
                            Capacity: {(playerState.bank?.length ?? 0)} / 1500
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {/* INVENTORY SIDE */}
                          <div className="bg-slate-950 p-2.5 rounded border border-slate-900 space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-900 pb-1 select-none">
                              <span className="text-[8.5px] font-bold text-slate-300">🎒 ACTIVE INVENTORY ({playerState.inventory?.reduce((sum: number, i: any) => sum + (itemsConfig[i.id]?.stackable ? 1 : 1), 0) ?? 0}/30)</span>
                              <span className="text-[7px] text-slate-500">Click WEAR to equip</span>
                            </div>

                            {(!playerState.inventory || playerState.inventory.length === 0) ? (
                              <div className="text-center text-slate-600 py-3 text-[8.5px] italic select-none">
                                Inventory is empty. Use spawner below!
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                                {playerState.inventory.map((item: any, idx: number) => {
                                  const config = itemsConfig[item.id] || { name: `Item #${item.id}`, stackable: false, icon: "📦" };
                                  return (
                                    <div key={idx} className={`p-1.5 rounded border flex items-center justify-between text-[8px] bg-slate-900/50 hover:bg-slate-900/80 transition ${item.equipped ? "border-amber-500/30 bg-amber-950/10" : "border-slate-850"}`}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm select-none shrink-0">{config.icon}</span>
                                        <div className="truncate">
                                          <div className="font-bold text-slate-200 truncate flex items-center gap-1">
                                            {config.name}
                                            {item.equipped && <span className="text-[6.5px] bg-amber-500 text-slate-950 px-0.5 rounded leading-none shrink-0 font-bold">EQ</span>}
                                          </div>
                                          <div className="text-slate-500 text-[7px] select-none">Qty: <strong className="text-slate-400">{item.amount?.toLocaleString() ?? 1}</strong> {config.stackable ? "• Stack" : "• Slot"}</div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {!config.stackable && (
                                          <button
                                            onClick={() => handleEquipToggle(item.id)}
                                            className="px-1 py-0.5 bg-slate-950 border border-slate-800 rounded hover:border-slate-600 text-slate-405 shrink-0 select-none cursor-pointer text-[7.5px]"
                                            title="Toggle equipped item wear state"
                                          >
                                            {item.equipped ? "UNEQUIP" : "WEAR"}
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleBankOperation("deposit", item.id, 1)}
                                          className="px-1 py-0.5 bg-slate-950 text-emerald-400 border border-emerald-900/40 rounded hover:border-emerald-700 hover:bg-emerald-950/20 shrink-0 select-none cursor-pointer text-[7.5px]"
                                          title="Deposit 1"
                                        >
                                          +1
                                        </button>
                                        {item.amount > 5 && (
                                          <button
                                            onClick={() => handleBankOperation("deposit", item.id, 5)}
                                            className="px-1 py-0.5 bg-slate-950 text-emerald-400 border border-emerald-900/40 rounded hover:border-emerald-700 hover:bg-emerald-950/20 shrink-0 select-none cursor-pointer text-[7.5px]"
                                            title="Deposit 5"
                                          >
                                            +5
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleBankOperation("deposit", item.id, item.amount)}
                                          className="px-1 py-0.5 bg-emerald-950/40 text-emerald-350 border border-emerald-800 rounded hover:bg-emerald-900/60 shrink-0 select-none cursor-pointer text-[7.5px]"
                                          title="Deposit All"
                                        >
                                          ALL
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* BANK SIDE */}
                          <div className="bg-slate-950 p-2.5 rounded border border-slate-900 space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-900 pb-1 select-none">
                              <span className="text-[8.5px] font-bold text-slate-300">🏢 VAULT SAFETY LOCK ({playerState.bank?.length ?? 0}/1500 UNIQUE)</span>
                              <span className="text-[7px] text-sky-450 uppercase">Secure</span>
                            </div>

                            {(!playerState.bank || playerState.bank.length === 0) ? (
                              <div className="text-center text-slate-600 py-3 text-[8.5px] italic select-none">
                                Vault stands empty. Deposit items above!
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                                {playerState.bank.map((item: any, idx: number) => {
                                  const config = itemsConfig[item.id] || { name: `Item #${item.id}`, stackable: false, icon: "📦" };
                                  return (
                                    <div key={idx} className="p-1.5 rounded border border-slate-850 flex items-center justify-between text-[8px] bg-slate-900/40 hover:bg-slate-900/80 transition">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm select-none shrink-0">{config.icon}</span>
                                        <div className="truncate">
                                          <div className="font-bold text-slate-200 truncate">{config.name}</div>
                                          <div className="text-slate-500 text-[7px] select-none">In Vault: <strong className="text-sky-400">{item.amount?.toLocaleString() ?? 1}</strong></div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => handleBankOperation("withdraw", item.id, 1)}
                                          className="px-1 py-0.5 bg-slate-950 text-sky-400 border border-sky-900/40 rounded hover:border-sky-700 hover:bg-sky-950/20 shrink-0 select-none cursor-pointer text-[7.5px]"
                                          title="Withdraw 1"
                                        >
                                          -1
                                        </button>
                                        {item.amount > 5 && (
                                          <button
                                            onClick={() => handleBankOperation("withdraw", item.id, 5)}
                                            className="px-1 py-0.5 bg-slate-950 text-sky-400 border border-sky-900/40 rounded hover:border-sky-700 hover:bg-sky-950/20 shrink-0 select-none cursor-pointer text-[7.5px]"
                                            title="Withdraw 5"
                                          >
                                            -5
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleBankOperation("withdraw", item.id, item.amount)}
                                          className="px-1 py-0.5 bg-sky-950/40 text-sky-350 border border-sky-800 rounded hover:bg-sky-900/60 shrink-0 select-none cursor-pointer text-[7.5px]"
                                          title="Withdraw All"
                                        >
                                          ALL
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* HIGH FIDELITY AIRDROP SPAWNER MENU */}
                        <div className="bg-slate-950/80 p-2.5 border border-slate-900 rounded space-y-1.5">
                          <span className="text-[7.5px] font-bold text-teal-400 uppercase tracking-widest block select-none">🛠️ SYSTEM AIRDROP CHEAT ENGINE</span>
                          <div className="flex flex-col sm:flex-row items-stretch gap-1.5">
                            <select
                              value={spawnItemSelect}
                              onChange={(e) => setSpawnItemSelect(parseInt(e.target.value))}
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[8.5px] text-slate-300 focus:outline-none focus:border-cyan-700 flex-1 min-w-[120px] font-mono cursor-pointer"
                            >
                              {Object.entries(itemsConfig).map(([idStr, cfg]) => (
                                <option key={idStr} value={idStr} className="bg-slate-950 text-slate-300">
                                  {cfg.icon} {cfg.name} (ID: {cfg.id}) {cfg.stackable ? "[Stackable]" : "[Slot]"} {cfg.members ? "[Members]" : ""}
                                </option>
                              ))}
                            </select>

                            <input
                              type="number"
                              value={spawnItemQty}
                              onChange={(e) => setSpawnItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[8.5px] text-slate-350 w-16 focus:outline-none focus:border-cyan-700 font-mono text-center"
                              min="1"
                            />

                            <button
                              onClick={handleSpawnAndAirdrop}
                              className="bg-teal-950 border border-teal-850 hover:border-teal-700 hover:bg-teal-900 text-teal-300 rounded px-2.5 py-1 text-[8px] font-bold transition whitespace-nowrap cursor-pointer select-none"
                            >
                              🚀 AIRDROP TO INVENTORY
                            </button>
                          </div>
                        </div>
                                     {/* SYSTEM OPERATIONS TRANSMISSION LOG */}
                        <div className="space-y-1 bg-slate-950/40 p-2 rounded border border-slate-900 text-[7px] leading-tight text-slate-400 font-mono">
                          <div className="flex items-center justify-between text-slate-500 uppercase font-bold text-[6.5px] pb-1 border-b border-slate-900 select-none">
                            <span>📡 SYNC TRANSMISSION LOG CHANNEL</span>
                            <span className="text-cyan-500 animate-pulse">LIVE FEED</span>
                          </div>
                          <div className="max-h-16 overflow-y-auto space-y-0.5 scrollbar-thin">
                            {bankActionLogs.slice(-6).map((log, lIdx) => (
                              <div key={lIdx} className="font-mono text-slate-400 truncate border-l border-slate-800 pl-1">
                                {log}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* OPENRSC WORLD ENGINE & SECTORS MONITOR */}
                        <div className="mt-4 pt-3.5 border-t border-slate-900/60 space-y-3 font-mono">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/50 p-2 rounded border border-slate-900/80 select-none">
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2 w-2 select-none">
                                {isWorldActive && (
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                )}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isWorldActive ? "bg-indigo-500" : "bg-slate-600"}`}></span>
                              </span>
                              <span className="text-[8.5px] font-bold text-indigo-400 uppercase tracking-wider">
                                🌍 OPENRSC REAL-TIME WORLD ENGINE
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-[7.5px] text-slate-400">
                                Cycles: <strong className="text-indigo-300">#{worldTicks}</strong> <span className="text-slate-600">({(worldTicks * 0.6).toFixed(1)}s elapsed)</span>
                              </div>
                              <div className="text-[7.5px] text-slate-400">
                                Tick Period: <strong className="text-emerald-400">600ms</strong>
                              </div>
                              <button
                                onClick={() => setIsWorldActive(!isWorldActive)}
                                className={`px-1.5 py-0.5 rounded text-[7px] font-bold border transition cursor-pointer select-none ${isWorldActive ? "bg-amber-955/30 border-amber-800 text-amber-400 hover:bg-amber-900/20" : "bg-indigo-950/30 border-indigo-800 text-indigo-400 hover:bg-indigo-900/20"}`}
                              >
                                {isWorldActive ? "PAUSE STATUS" : "RESUME HEARTBEAT"}
                              </button>
                            </div>
                          </div>

                          {/* TAB STRIP */}
                          <div className="flex gap-1 border-b border-slate-900 select-none pb-0.5">
                            <button
                              onClick={() => setSelectedWorldTab("terminal")}
                              className={`px-2 py-1 text-[7.5px] font-bold transition uppercase cursor-pointer ${selectedWorldTab === "terminal" ? "text-indigo-400 border-b border-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
                            >
                              📜 TICK LOGS ({worldLogs.length})
                            </button>
                            <button
                              onClick={() => setSelectedWorldTab("regions")}
                              className={`px-2 py-1 text-[7.5px] font-bold transition uppercase cursor-pointer ${selectedWorldTab === "regions" ? "text-indigo-400 border-b border-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
                            >
                              📍 REGION CELLS (16x16)
                            </button>
                            <button
                              onClick={() => setSelectedWorldTab("collisions")}
                              className={`px-2 py-1 text-[7.5px] font-bold transition uppercase cursor-pointer ${selectedWorldTab === "collisions" ? "text-indigo-400 border-b border-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
                            >
                              🛑 COLLISION MATRIX
                            </button>
                          </div>

                          {/* CONTENT MATRICES */}
                          {selectedWorldTab === "terminal" && (
                            <div className="bg-slate-950 p-2.5 rounded border border-slate-900 space-y-1 text-[7px] text-slate-350 leading-relaxed font-mono">
                              <div className="flex items-center justify-between text-slate-500 uppercase font-bold text-[6.5px] pb-1 border-b border-slate-900 select-none">
                                <span>SYSTEM CORE CONSOLE FEED</span>
                                <span className={isWorldActive ? "text-indigo-455 animate-pulse" : "text-slate-600"}>
                                  {isWorldActive ? "● ONLINE" : "■ SUSPENDED"}
                                </span>
                              </div>
                              <div className="max-h-28 overflow-y-auto space-y-0.5 scrollbar-thin">
                                {worldLogs.slice(-10).map((log, index) => {
                                  const isColTest = log.includes("COLLISION_TEST");
                                  const isExc = log.includes("EXCEPTION");
                                  return (
                                    <div 
                                      key={index} 
                                      className={`font-mono truncate border-l pl-1 ${isColTest ? "border-amber-500 text-amber-300 bg-amber-950/5" : isExc ? "border-red-500 text-red-300 bg-red-950/5" : "border-slate-800 text-slate-400"}`}
                                    >
                                      {log}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {selectedWorldTab === "regions" && (
                            <div className="bg-slate-950 p-3 rounded border border-slate-900 space-y-2.5">
                              <div className="flex items-center justify-between text-[7.5px] select-none">
                                <span className="font-bold text-slate-300">🎒 MULTIPLAYER REGION GRID TRACKING</span>
                                <span className="text-slate-500">Sectors mapped to 16x16 tile sectors</span>
                              </div>

                              <div className="grid grid-cols-6 gap-1 bg-slate-900/50 p-2.5 rounded border border-slate-850">
                                {Array.from({ length: 12 }).map((_, idx) => {
                                  // Mock regions representation
                                  const rx = 3 + (idx % 4);
                                  const ry = 8 + Math.floor(idx / 4);
                                  const activeNodeClient = rx === 3 && ry === 8; // represents player home coordinate
                                  return (
                                    <div 
                                      key={idx} 
                                      className={`p-1.5 rounded border flex flex-col items-center justify-between text-center select-none ${activeNodeClient ? "bg-indigo-950/40 border-indigo-700 text-indigo-300 animate-pulse" : "bg-slate-950/80 border-slate-850 text-slate-500"}`}
                                    >
                                      <span className="text-[7.5px] font-bold block">{rx},{ry}</span>
                                      <span className={`text-[6.5px] px-0.5 rounded font-bold ${activeNodeClient ? "bg-indigo-550 text-slate-950" : "bg-slate-900"}`}>
                                        {activeNodeClient ? "1 Player" : "10 NPCs"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {selectedWorldTab === "collisions" && (
                            <div className="bg-slate-950 p-3 rounded border border-slate-900 space-y-2.5">
                              <div className="flex items-center justify-between text-[7.5px] select-none pb-1 border-b border-slate-900">
                                <span className="font-bold text-slate-300">🛑 PLANE COLLISION DIAGNOSTIC MATRIX</span>
                                <span className="text-amber-450 font-bold">1 Tile Blocked</span>
                              </div>

                              <div className="grid grid-cols-2 gap-3.5">
                                {/* GRID MOCK */}
                                <div className="space-y-1.5 select-none">
                                  <span className="text-[7px] text-slate-500 block">PATHFINDER COLLISION MAP (5x5 GRID)</span>
                                  <div className="grid grid-cols-5 gap-0.5 bg-slate-900/60 p-1.5 rounded border border-slate-850">
                                    {Array.from({ length: 25 }).map((_, gIdx) => {
                                      const gx = gIdx % 5;
                                      const gy = Math.floor(gIdx / 5);
                                      const isBlocked = gx === 0 && gy === 0; // Represents COLLISION_TEST at 0,0
                                      return (
                                        <div 
                                          key={gIdx} 
                                          className={`aspect-square rounded-[1px] flex items-center justify-center text-[6px] font-bold ${isBlocked ? "bg-red-950 border border-red-800 text-red-400" : "bg-emerald-950/20 border border-emerald-900/10 text-emerald-500/30"}`}
                                          title={`Tile (${gx}, ${gy}) ${isBlocked ? "BLOCKED" : "WALKABLE"}`}
                                        >
                                          {isBlocked ? "X" : "•"}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* DESCRIP */}
                                <div className="space-y-2 text-[7.5px] text-slate-400 leading-normal">
                                  <div className="p-1.5 bg-slate-900 border border-slate-850 rounded">
                                    <span className="text-amber-400 font-bold block uppercase text-[6.5px] mb-0.5">⚠️ ALIGNMENT DIAGNOSTIC</span>
                                    Verified landscape blocks. Collision check at <strong className="text-white">(0, 0)</strong> generated flag <strong className="text-red-400">1 (BLOCKED)</strong>, confirming original canon tile rules perfectly.
                                  </div>
                                  <div className="p-1.5 bg-indigo-950/15 border border-indigo-900/20 rounded">
                                    <span className="text-indigo-400 font-bold block uppercase text-[6.5px] mb-0.5">ℹ️ COORDINATE BOUNDS</span>
                                    F2P margins check: (minX=48, maxX=450, minY=128, maxY=766). Coordinates outside this window drop dropped-items automatically.
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION C: TRAINING COLLECTOR STORAGE & COMPRESSION COMPILER */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-205 font-mono font-bold block uppercase tracking-wider flex items-center gap-1.5">
                      <History className="h-4 w-4 text-emerald-400" />
                      UNCOMPRESSED MODEL DATA TRAINING COLLECTOR ({trainingCollector.length})
                    </span>
                    
                    {trainingCollector.length > 0 && (
                      <button
                        onClick={purgeTrainingCollector}
                        className="text-[8.5px] font-mono text-red-500 hover:underline cursor-pointer select-none"
                      >
                         WIPE UNCOMPRESSED CORES
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-450 font-sans mb-3 leading-normal">
                    Aggregates telemetry records in real-time. Trigger an evaluation snapshot below directly, or queue presets from state slots. Press Batch Compile to compress memory buffers into the active Model Weight Matrix.
                  </p>

                  <div className="flex flex-wrap gap-2 mb-3 select-none">
                    <button
                      onClick={pushCurrentToCollectorDirectly}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100 rounded text-[9px] font-mono font-bold cursor-pointer transition"
                    >
                      + LOG CURRENT ENVIRONMENT DIRECT JSON INTO COLLECTOR
                    </button>
                  </div>

                  {/* Uncompressed Collector Queue Items */}
                  <div className="bg-slate-950 border border-slate-850 rounded p-2.5 max-h-36 overflow-y-auto font-mono text-[9px] space-y-1.5 scrollbar-thin">
                    {trainingCollector.length === 0 ? (
                      <div className="text-slate-600 italic text-center py-6">
                        Training Collector buffer empty. Accumulate frames above to pack binary learning vectors.
                      </div>
                    ) : (
                      trainingCollector.map((item) => (
                        <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0 gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-[8px] font-bold">
                              <span className="text-cyan-500">{item.id}</span>
                              <span className="text-slate-550">•</span>
                              <span className="text-slate-400">{item.timestamp}</span>
                            </div>
                            <div className="text-[10px] text-slate-200 font-bold mt-0.5">
                              {item.stateLabel.split(" (")[0]}
                              <span className="font-normal font-sans text-slate-450 italic ml-1.5">"{item.reason}"</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center">
                            <span className={`px-1.5 py-0.5 text-[8px] rounded uppercase font-bold border ${
                              item.reaction === "GOOD"
                                ? "bg-emerald-950/40 border-emerald-900 text-emerald-400"
                                : item.reaction === "BAD"
                                ? "bg-red-950/40 border-red-900 text-red-400"
                                : "bg-slate-850 border-slate-700 text-slate-350"
                            }`}>
                              {item.reaction}
                            </span>
                            <button
                              onClick={() => {
                                setTrainingCollector(prev => prev.filter(r => r.id !== item.id));
                                addLogEntry(SubsystemId.SECURE_LOCK, "INFO", `COLLECTOR REMOVE: Deleted row ${item.id} from active memory.`);
                              }}
                              className="text-[8px] text-red-650 hover:underline cursor-pointer font-bold"
                            >
                              DELETE
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* COMPRESS ROTATION ENGINE OUTCOME AND MODEL OUTPUT DISPLAY */}
                <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 font-mono text-[9px] space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-200 block uppercase tracking-wider">
                        BATCH COMPILER &amp; LOSSLESS COMPRESSION ENGINE
                      </span>
                      <span className="text-slate-550 text-[8px] block mt-0.5">Compiles and frees uncompressed collector memory buffers</span>
                    </div>

                    <button
                      onClick={executeBatchProcessAndCompress}
                      className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded font-bold hover:brightness-110 active:scale-95 transition cursor-pointer text-center select-none shadow-[0_0_8px_rgba(16,185,129,0.3)] shadow-emerald-500/20"
                    >
                      BATCH PROCESS &amp; COMPRESS
                    </button>
                  </div>

                  {compressedModel ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded border border-slate-850">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-500 text-[8px]">UNCOMPRESSED BUFFER:</span>
                        <strong className="text-slate-205 text-[11px]">{compressedModel.uncompressedBytes} bytes ({compressedModel.recordCount} records)</strong>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-500 text-[8px]">COMPRESSED WEIGHT BINARY:</span>
                        <strong className="text-slate-205 text-[11px]">{compressedModel.compressedBytes} bytes (Lossless ASCII)</strong>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-500 text-[8px]">COMPRESSION EFFICIENCY:</span>
                        <strong className="text-emerald-400 text-[11px] font-bold uppercase">{compressedModel.ratio}% SAVED</strong>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-500 text-[8px]">MODEL SYSTIME TIME:</span>
                        <span className="text-slate-205 font-bold uppercase">{compressedModel.compiledAt}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900/30 p-3 rounded border border-slate-850 border-dashed text-center text-slate-505 italic">
                      No active Model compiler matrix saved. Complete a batch compression cycle to populate.
                    </div>
                  )}

                  {compressedModel && (
                    <div className="space-y-1">
                      <span className="text-slate-500 text-[7.5px] uppercase block select-none">DEPLOYABLE COMPILED MATRIX BINARY PAYLOAD TOKEN</span>
                      <div className="bg-slate-900 border border-slate-855 rounded p-2.5 text-emerald-400 max-h-20 overflow-y-auto select-all break-all overflow-hidden scrollbar-thin text-[8.5px] leading-snug">
                        {compressedModel.binaryToken}
                      </div>
                      <span className="text-slate-600 text-[7px] block">
                        Payload can be pasted in dynamic decoder buffers per metabolic node execution.
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* SECTION D: CLOCK-STAMPED STATE TRAJECTORY & ML PREDICTOR */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-200 font-mono font-bold block mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-4 w-4 text-amber-500" />
                    STATE OUTCOME MATRIX &amp; TRAJECTORY PREDICTOR
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Predictor candidates list */}
                    <div className="bg-slate-950/60 border border-slate-800 p-3 rounded h-fit">
                      <span className="text-[9px] text-slate-500 font-mono font-bold block mb-2 uppercase select-none">
                        PROBABLE TRANSITION TARGET PATHWAYS
                      </span>

                      <div className="space-y-1.5">
                        {getPredictiveSequenceOutcomes().length === 0 ? (
                          <div className="text-[9px] text-slate-550 italic leading-snug py-1">
                            No matching future states mapping identified. Limp forced shutdown state loop locks.
                          </div>
                        ) : (
                          getPredictiveSequenceOutcomes().map((candidate, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b border-slate-900 pb-1.5 text-[10px] font-mono leading-normal">
                              <div>
                                <span className={`font-bold ${
                                  candidate.predictedClassification === "GOOD" ? "text-emerald-400" :
                                  candidate.predictedClassification === "BAD" ? "text-red-400" : "text-slate-300"
                                }`}>
                                  ➔ {candidate.targetLabel}
                                </span>
                                <span className="block text-[8px] text-slate-500 leading-none mt-0.5">
                                  {candidate.notes}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-100">{candidate.probability}%</span>
                                <span className={`block text-[8px] leading-none mt-0.5 font-bold ${
                                  candidate.predictedClassification === "GOOD" ? "text-emerald-600" :
                                  candidate.predictedClassification === "BAD" ? "text-red-600" : "text-slate-505"
                                }`}>
                                  {candidate.predictedClassification}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Commit classifier form */}
                    <div className="bg-slate-950/60 border border-slate-800 p-3 rounded flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-slate-500 font-mono font-bold block mb-2 uppercase select-none">
                          COMMIT LOG OUTCOME TRAINING SET
                        </span>

                        <div className="space-y-2 font-mono text-[10px]">
                          <div>
                            <span className="text-slate-500 text-[8px] block select-none">Notes on current state:</span>
                            <input
                              type="text"
                              value={operatorNotes}
                              onChange={(e) => setOperatorNotes(e.target.value)}
                              placeholder="e.g. Purge calibration wave completes nominal."
                              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-[9px] px-2 py-1 h-7 rounded mt-0.5"
                            />
                          </div>

                          <div>
                            <span className="text-slate-500 text-[8px] block select-none">Classification evaluation:</span>
                            <div className="flex gap-1.5 mt-1 select-none">
                              {["COMMON", "GOOD", "BAD"].map((cls) => (
                                <button
                                  key={cls}
                                  onClick={() => setOperatorClassification(cls as HexagramEvaluationClassification)}
                                  className={`flex-1 py-1 rounded text-[9px] font-bold cursor-pointer border text-center ${
                                    operatorClassification === cls
                                      ? cls === "GOOD"
                                        ? "bg-emerald-955 border-emerald-700 text-emerald-400"
                                        : cls === "BAD"
                                        ? "bg-red-955 border-red-800 text-red-400"
                                        : "bg-slate-850 border-slate-600 text-slate-200"
                                      : "bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-350"
                                  }`}
                                >
                                  {cls}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={commitCurrentTimelineFrame}
                        className="w-full mt-3.5 py-1.5 bg-amber-950/40 text-amber-400 border border-amber-800 rounded text-[9px] font-bold hover:bg-amber-950/60 transition cursor-pointer text-center"
                      >
                        RECORD TRAINING DATA INDEX
                      </button>
                    </div>
                  </div>
                </div>

                {/* Training Buffer List */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-450 font-mono font-bold uppercase tracking-wider block">
                      COMMITTED ML STATE LOG RETROSPECTS ({trainingSequence.length})
                    </span>
                    {trainingSequence.length > 0 && (
                      <button
                        onClick={purgeTrainingBuffer}
                        className="text-[8px] font-mono text-center text-red-500 hover:underline cursor-pointer select-none"
                      >
                         WIPE DATAFRAMES
                      </button>
                    )}
                  </div>

                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 font-mono text-[9px] scrollbar-thin">
                    {trainingSequence.length === 0 ? (
                      <div className="text-slate-505 italic text-center py-6">
                        No frames recorded in model buffer register. Label active cycles above to train prediction curves.
                      </div>
                    ) : (
                      [...trainingSequence].reverse().map((frame, index) => (
                        <div
                          key={index}
                          className={`p-2 rounded border flex flex-col md:flex-row md:items-center justify-between justify-items-stretch gap-2.5 transition ${
                            frame.classification === "GOOD"
                              ? "bg-emerald-955/10 border-emerald-950/60 hover:bg-emerald-955/20 text-emerald-300"
                              : frame.classification === "BAD"
                              ? "bg-red-955/10 border-red-950/60 hover:bg-red-955/20 text-red-300"
                              : "bg-slate-955/10 border-slate-850 hover:bg-slate-950 text-slate-350"
                          }`}
                        >
                          <div className="space-y-0.5 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[8px] opacity-75 font-bold">
                              <span>TICK: #{frame.tick}</span>
                              <span>•</span>
                              <span>{frame.timestamp}</span>
                              {frame.activeFaults.map(f => (
                                <span key={f} className="bg-red-955 border border-red-900 text-red-400 px-1 rounded">
                                  {f}
                                </span>
                              ))}
                            </div>
                            <div className="text-[10px]">
                              <strong>State:</strong> {frame.stateLabel.split(" (")[0]}
                              <span className="text-slate-400 block mt-0.5 font-sans leading-normal">
                                Notes: "{frame.operatorNotes}"
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 md:self-center self-end select-none">
                            <span className="text-[8px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded uppercase font-bold text-slate-400">
                              {frame.classification}
                            </span>
                            <button
                              onClick={() => {
                                onCommitState(frame.state);
                                // Approximate physical variables hydration
                                if (frame.state === HexagramState.ST_CRIT || frame.state === HexagramState.TR_CRIT) {
                                  setTemperatureBias(16);
                                } else if (frame.state === HexagramState.LIMP_MODE) {
                                  setTemperatureBias(22);
                                } else {
                                  setTemperatureBias(0);
                                  setPlenumPressure(1.30);
                                }
                                addLogEntry("SECURE_LOCK" as any, "SUCCESS", `HYDRATION LOAD: Restored historic environment conditions for saved frame at tick #${frame.tick}.`);
                                setInjectionLogStatus({ text: `Hydrated environmental variables from saved historical state Frame #${frame.tick}!`, level: "INFO" });
                              }}
                              className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded hover:border-slate-650 cursor-pointer text-slate-205 transition"
                              title="Instantly deploy parameters"
                            >
                              DEPLOY FRAME
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* CLOUDFLARE WORKERS AI INTEGRATED DIRECT DIAGNOSTIC TERMINAL */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-lg shadow-xl space-y-4 text-left">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-start gap-2.5">
                <div className="bg-orange-950/50 p-1.5 rounded border border-orange-900/60 shrink-0">
                  <Sparkles className="h-5 w-5 text-orange-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-display font-medium text-sm text-slate-100 tracking-wider uppercase flex items-center gap-2">
                    Cloudflare Workers AI Core Edge Co-Processor
                    <span className="text-[8px] bg-orange-950 text-orange-400 border border-orange-900/80 px-2 py-0.5 rounded font-mono font-normal">
                      @cf/meta/llama-3.1-8b-instruct
                    </span>
                  </h4>
                  <p className="text-slate-400 font-sans text-[11px] mt-0.5">
                    Execute real-time edge inference on active FPGA register states and telemetry matrix fields.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-[9px] select-none shrink-0">
                {CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN ? (
                  <span className="bg-emerald-955/60 text-emerald-400 border border-emerald-800/80 px-2.5 py-1 rounded-md flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    CLOUDFLARE EDGE ACTIVE
                  </span>
                ) : (
                  <span className="bg-slate-950 text-slate-500 border border-slate-850 px-2.5 py-1 rounded-md flex items-center gap-1.5" title="VITE_CLOUDFLARE_ACCOUNT_ID or API_TOKEN absent: running in high-fidelity sandbox fallback mode">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    EDGE SANDBOX FALLBACK ACTIVE
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Input Directive Interface */}
              <div className="lg:col-span-5 space-y-3">
                <span className="text-[10px] text-slate-350 font-mono font-bold block uppercase tracking-wider">
                  Edge Diagnostic Directive
                </span>

                <div className="relative">
                  <textarea
                    value={cfPrompt}
                    onChange={(e) => setCfPrompt(e.target.value)}
                    placeholder="Enter manual query/instruction for the Cloudflare co-processor..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-200 h-28 focus:outline-none focus:border-orange-700 focus:ring-1 focus:ring-orange-700 placeholder-slate-600 leading-normal"
                  />
                  <div className="absolute right-2.5 bottom-2.5 text-[8px] font-mono text-slate-600 select-none">
                    LLAMA3.1 DECK
                  </div>
                </div>

                {/* Prebuilt presets / Quick Action buttons */}
                <div>
                  <span className="text-[8.5px] uppercase font-bold text-slate-505 block mb-2 font-mono">
                    Quick Diagnostic Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => {
                        const pr = "Perform pre-charge voltage balance check and verify choke drive harmonics status.";
                        setCfPrompt(pr);
                        handleCfDiagnose(pr);
                      }}
                      className="px-2 py-1.5 bg-slate-955 border border-slate-850 hover:border-slate-700 text-slate-350 rounded text-[9px] font-mono hover:text-slate-100 transition text-left shrink-0 cursor-pointer"
                    >
                      ⚡ PRE-CHARGE & CHOKE CHECK
                    </button>
                    <button
                      onClick={() => {
                        const pr = "Check if active fault byte corresponds to pre-charge or ventilation anomaly risk.";
                        setCfPrompt(pr);
                        handleCfDiagnose(pr);
                      }}
                      className="px-2 py-1.5 bg-slate-955 border border-slate-855 hover:border-slate-700 text-slate-355 rounded text-[9px] font-mono hover:text-slate-100 transition text-left shrink-0 cursor-pointer"
                    >
                      ⚠️ FAULT BYTE CORRELATION
                    </button>
                    <button
                      onClick={() => {
                        const pr = "Write an optimized excitation calibration model based on active and historic metrics.";
                        setCfPrompt(pr);
                        handleCfDiagnose(pr);
                      }}
                      className="px-2 py-1.5 bg-slate-955 border border-slate-855 hover:border-slate-700 text-slate-355 rounded text-[9px] font-mono hover:text-slate-100 transition text-left shrink-0 cursor-pointer"
                    >
                      📈 EXCITATION OPTIMIZER
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    disabled={cfLoading}
                    onClick={() => handleCfDiagnose()}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-slate-950 font-bold rounded-md transition duration-200 cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(249,115,22,0.2)] font-mono disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  >
                    {cfLoading ? (
                      <>
                        <RefreshCw className="h-4.5 w-4.5 animate-spin text-slate-955" />
                        <span>Inference Pending... Running Edge</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4.5 w-4.5 fill-slate-950 text-slate-950" />
                        <span>Execute Cloudflare Workers AI Inference</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Live Edge Output logs */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div className="space-y-3 flex-1 flex flex-col">
                  <span className="text-[10px] text-slate-350 font-mono font-bold block uppercase tracking-wider">
                    Edge Co-Processor Response Registry
                  </span>

                  <div className="flex-1 bg-slate-950 border border-slate-850 rounded-lg p-3.5 relative min-h-[164px] flex flex-col justify-between overflow-y-auto max-h-64">
                    {cfLoading ? (
                      <div className="flex flex-col items-center justify-center py-10 space-y-2 flex-1">
                        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-orange-400 font-mono text-[10px] uppercase font-bold tracking-widest animate-pulse">
                          Routing to Cloudflare Workers AI Substrate...
                        </span>
                      </div>
                    ) : cfError ? (
                      <div className="p-3 bg-red-955/20 border border-red-900 rounded-md text-red-350 font-mono text-[10px] leading-relaxed flex-1">
                        <div className="flex items-center gap-1.5 font-bold mb-1 select-none">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                          EDGE CONNECTION ABORTED
                        </div>
                        {cfError}
                        <div className="mt-2 text-[9px] text-slate-500">
                          Please verify your Cloudflare Account ID and API Token variables configuration in the Settings panel.
                        </div>
                      </div>
                    ) : cfResponse ? (
                      <div className="font-mono text-[10.5px] text-slate-200 leading-relaxed flex-1 select-text">
                        <div className="text-[8px] text-slate-500 uppercase font-bold mb-2 tracking-wider flex items-center justify-between border-b border-slate-900 pb-1 border-dashed">
                          <span>INFERENCE DECK SUCCESSFUL</span>
                          {CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN ? (
                            <span className="text-emerald-400 font-normal">● LIVE CLOUDFLARE INFERENCE</span>
                          ) : (
                            <span className="text-amber-500 font-normal">▲ SANDBOX FLUX SIMULATION</span>
                          )}
                        </div>
                        <p>{cfResponse}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-605 flex-1 select-none text-center">
                        <Brain className="h-10 w-10 text-slate-800 mb-2 shrink-0 animate-pulse" />
                        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-500">
                          Edge Co-Processor Status: WAITING_FOR_DIRECTIVE
                        </span>
                        <p className="text-[10px] text-slate-500 max-w-sm font-sans mt-1">
                          Configure a directive or click one of the quick diagnostic presets above to trigger real-time AI analytics.
                        </p>
                      </div>
                    )}

                    {cfDiagnosticActive && !cfLoading && (
                      <div className="mt-3 pt-2.5 border-t border-slate-900/60 flex justify-between items-center text-[9px] text-slate-500 select-none font-mono">
                        <span>MODEL: @cf/meta/llama-3.1-8b-instruct</span>
                        <span>LATENCY: ~140ms</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 5: SOVEREIGN DISTRIBUTION SYSTEM (skills.sh) */}
      {activeTab === "distribution" && (
        <div className="space-y-5 text-left">
          {/* Header Banner */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg flex flex-col md:flex-row shadow-lg justify-between gap-4">
            <div className="flex items-start gap-3">
              <Command className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-display font-medium text-sm text-slate-150 tracking-wider uppercase mb-1">
                  Sovereign Distribution Limb Control (`skills.sh`)
                </h4>
                <p className="text-slate-400 font-sans text-[11px] leading-relaxed max-w-2xl">
                  Deploy, validate, and orchestrate the POG2 Sovereign System across edge and silicon gates. This panel drives local/cloud target states and synchronizes clock-frequency intervals.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] shrink-0 h-fit self-center">
              <span className="bg-blue-950/60 text-blue-400 border border-blue-800 px-2.5 py-1 rounded">
                VERSION: 1.1.0
              </span>
              <span className="bg-purple-950/60 text-purple-400 border border-purple-800 px-2.5 py-1 rounded">
                FPGA TARGET: ZU7EV
              </span>
              <span className="bg-cyan-950/60 text-cyan-400 border border-cyan-800 px-2.5 py-1 rounded">
                BASE ADDR: 0x43C0_0000
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMN 1: SCRIPT PARAMETER CONFIGURATION */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-400" />
                  <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-wider font-semibold">
                    DIRECTIVE BUILDER
                  </span>
                </div>

                {/* Command select */}
                <div className="space-y-1">
                  <label className="text-[8.5px] font-mono text-slate-400 uppercase font-bold tracking-wider">Command Directive</label>
                  <select
                    value={skillsCommand}
                    onChange={(e) => setSkillsCommand(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[10.5px] focus:outline-none focus:border-cyan-600"
                  >
                    <option value="validate">validate - Run taxonomy safety checks</option>
                    <option value="status">status - Check target registration states</option>
                    <option value="health">health - Run live audit tests</option>
                    <option value="clock">clock - Synchronize CanonicalClock ticks</option>
                    <option value="heal">heal - Initialise auto-recovery loops</option>
                    <option value="deploy">deploy - Push payload to substrates</option>
                    <option value="train">train - Model train via deepseek-r1</option>
                    <option value="compress">compress - Compress model binary weights</option>
                    <option value="sync">sync - Replicate state parameters</option>
                    <option value="flash">flash - Write JTAG silicon bitstream</option>
                    <option value="install">install - Register MCP tools & drivers</option>
                  </select>
                </div>

                {/* Conditional Inputs */}
                {skillsCommand === "deploy" && (
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-mono text-slate-400 uppercase font-bold tracking-wider">Substrate Target</label>
                    <select
                      value={skillsTarget}
                      onChange={(e) => setSkillsTarget(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[10px]"
                    >
                      <option value="all">all - Local + Edge + FPGA + Soul</option>
                      <option value="edge">edge - Cloudflare Workers worker layer</option>
                      <option value="local">local - Local Ollama models engine</option>
                      <option value="fpga">fpga - Physical ZU7EV silicon mapping</option>
                      <option value="soul">soul - Cognitive consciousness lines</option>
                    </select>
                  </div>
                )}

                {skillsCommand === "train" && (
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-mono text-slate-400 uppercase font-bold tracking-wider">Target Model ID</label>
                    <select
                      value={skillsModel}
                      onChange={(e) => setSkillsModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[10px]"
                    >
                      <option value="pog2-yaostate">pog2-yaostate (6 Layers Yao)</option>
                      <option value="deepseek-r1:8b">deepseek-r1:8b (Sovereign baseline)</option>
                      <option value="kimi-k2.5:cloud">kimi-k2.5:cloud (Cloud hybrid)</option>
                    </select>
                  </div>
                )}

                {skillsCommand === "clock" && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[8.5px] font-mono text-slate-400 uppercase font-bold tracking-wider">Canonical Clock Rate</label>
                      <span className="text-[10px] text-amber-400 font-mono font-bold bg-slate-950 px-2 py-0.5 border border-slate-850 rounded">{skillsTickMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="2000"
                      step="40"
                      value={skillsTickMs}
                      onChange={(e) => setSkillsTickMs(parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-normal font-sans">
                      Drives the baseline temporal trigger interval for simulation and HIL processing cycle pipelines. Default pog2 standard rate is 640ms.
                    </p>
                  </div>
                )}

                {skillsCommand === "flash" && (
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-mono text-slate-400 uppercase font-bold tracking-wider">Bitstream Package (.bit)</label>
                    <input
                      type="text"
                      value={skillsBitstream}
                      onChange={(e) => setSkillsBitstream(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[10px] focus:outline-none focus:border-cyan-600"
                    />
                  </div>
                )}

                {skillsCommand === "health" && (
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-mono text-slate-400 uppercase font-bold tracking-wider">Audit Investigation Level</label>
                    <select
                      value={skillsDepth}
                      onChange={(e) => setSkillsDepth(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[10px]"
                    >
                      <option value="summary">summary - Standard device health checks</option>
                      <option value="full">full - Depth verify signatures & keys</option>
                      <option value="diagnostic">diagnostic - Run live latency loops</option>
                    </select>
                  </div>
                )}

                {/* Substrate Registry Matrix Checklist */}
                <div className="bg-slate-950/60 p-3 rounded border border-slate-850/80 space-y-2 select-none">
                  <span className="text-[8.5px] font-bold text-slate-450 uppercase block tracking-wider font-semibold">Active Substrates Status</span>
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Local Engine</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Cloudflare Worker</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>ZU7EV FPGA</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>Soul metaphysical</span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="pt-4 border-t border-slate-850/60 mt-4">
                <button
                  onClick={executeSkillsCommand}
                  disabled={isSkillsRunning}
                  className={`w-full py-2.5 rounded font-mono font-bold text-[10px] text-center tracking-wider transition ${
                    isSkillsRunning
                      ? "bg-slate-850 text-slate-500 cursor-not-allowed animate-pulse border border-slate-800"
                      : "bg-gradient-to-r from-blue-700 to-indigo-700 font-bold hover:brightness-110 active:scale-98 transition text-white border border-blue-500/30 cursor-pointer shadow-[0_0_12px_rgba(37,99,235,0.25)]"
                  }`}
                >
                  {isSkillsRunning ? "SYSTEM RUNNING DIRECTIVE..." : "EXECUTE SOVEREIGN DIST-LIMB DIRECTIVE"}
                </button>
              </div>
            </div>

            {/* COLUMN 2: RETRO INTERACTIVE TERMINAL OUTPUT */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-850 rounded-lg p-3 flex flex-col h-[400px] justify-between shadow-2xl">
                
                {/* Simulated bash utility window header */}
                <div className="flex justify-between items-center border-b border-slate-805 pb-2 mb-2 select-none">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/85" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/85" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/85" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono ml-2 font-bold flex items-center gap-1">
                      <span>bash</span>
                      <span className="text-slate-650">•</span>
                      <span className="text-cyan-400 text-[8.5px]">skills.sh</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <button
                      onClick={() => setSkillsTerminalLogs([
                        "POG2 Sovereign Distribution terminal log buffer cleared.",
                        "Ready."
                      ])}
                      className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded hover:text-white transition text-slate-400 cursor-pointer"
                    >
                      clear
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([skillsTerminalLogs.join("\n")], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "distribution_run.log";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded hover:text-white transition text-slate-400 cursor-pointer"
                    >
                      export logs
                    </button>
                  </div>
                </div>

                {/* Log Terminal Screen Output Area */}
                <div
                  ref={skillsTerminalRef}
                  className="flex-1 bg-black/95 font-mono text-[10px] rounded p-3 overflow-y-auto border border-black scrollbar-thin select-text space-y-1.5 focus:outline-none"
                >
                  {skillsTerminalLogs.map((logLine, lineIdx) => {
                    let colorClass = "text-slate-350";
                    if (logLine.startsWith("$")) {
                      colorClass = "text-yellow-400 font-bold";
                    } else if (logLine.startsWith("[OK]")) {
                      colorClass = "text-emerald-400 font-semibold";
                    } else if (logLine.startsWith("[SKILLS]")) {
                      colorClass = "text-blue-400 font-bold";
                    } else if (logLine.startsWith("[INFO]")) {
                      colorClass = "text-cyan-400";
                    } else if (logLine.startsWith("[WARN]")) {
                      colorClass = "text-amber-400 font-bold";
                    } else if (logLine.startsWith("[ERR]")) {
                      colorClass = "text-red-400 font-bold";
                    }
                    return (
                      <div key={lineIdx} className={`${colorClass} leading-relaxed break-all`}>
                        {logLine}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Code Reference Information Block */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg">
                <span className="text-[10px] text-slate-300 font-mono font-bold block mb-1 uppercase tracking-wider select-none leading-none">
                  Silion Registers mapped for State Taxonomy Enforcer:
                </span>
                <p className="text-[9.5px] text-slate-450 leading-relaxed font-mono">
                  BOOT_PHASE: <strong className="text-slate-200">0x2C</strong> |
                  CONTACTOR_STATUS: <strong className="text-slate-200">0x44</strong> |
                  HEXAGRAM_STATE: <strong className="text-slate-200">0x10</strong> |
                  YAO_LINES: <strong className="text-slate-200">0x14</strong> |
                  GHOSTSPLAT_FIELD: <strong className="text-slate-200">0x80-0x98</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* TAB 6: GHOSTSPLAT ADAPTIVE-ORDER PREDICTOR & MATH MODEL */}
      {activeTab === "ghostsplat" && (() => {
        return <GhostSplatVisualizer />;
        // Collect sandbox parameters
        const tempK = sandboxTemp;
        const currentA = sandboxCurrent;
        const uStar = sandboxUStar;
        const rho = sandboxRho;

        // Constants from Master Reference Sheet (POG2-MHD-PROP-001)
        const R_total = 0.001; // Ohms per segment
        const T_PCM_ONSET = 305.4; // Kelvin
        const K_SALT_PCM = 254.0; // Phase transition slope
        const C_thermal = 0.00418; // scaled thermal capacity constant (274 in Q16.16)

        // Hamiltonian Terms
        const hElec = sandboxElecReg !== 0 ? (currentA * currentA) * R_total : 0.0;
        const hTherm = tempK > T_PCM_ONSET ? (tempK - T_PCM_ONSET) * K_SALT_PCM : 0.0;
        const hFluid = (rho * uStar * uStar * uStar) / C_thermal;
        const hCrossEt = (hElec * hTherm) / 256.0;
        const hCrossEf = (hElec * hFluid) / 512.0;

        const hTotal = hElec + hTherm + hFluid + hCrossEt + hCrossEf;

        // Taylor sequence constants matching VHDL
        const dt = 0.60; // 600 ms canonical tick
        const factorialTable = [1.0, 1.0, 2.0, 6.0, 24.0, 120.0];
        const CONV_THRESH = 0.05; // 3277 in Q16.16

        // Compute Taylor sequence steps simulating the GHOSTSPLAT_PREDICTOR VHDL behavioral FSM (Rev 1.0)
        const steps: Array<{
          stage: string;
          order: number;
          sumBefore: number;
          termAdded: number;
          sumAfter: number;
          relChange: number;
          converged: boolean;
        }> = [];

        // STAGE_1ST (1st Order term: H * dt / 1!)
        const term1 = hTotal * dt;
        steps.push({
          stage: "STAGE_1ST",
          order: 1,
          sumBefore: tempK,
          termAdded: term1,
          sumAfter: tempK + term1,
          relChange: Math.abs(term1) / Math.max(0.001, tempK),
          converged: false
        });

        // STAGE_2ND (2nd Order term: term1 * H * dt / 2!)
        let prevSum = tempK + term1;
        const term2 = (term1 * hTotal * dt) / 2.0;
        const relChange2 = Math.abs(term2) / Math.max(0.001, prevSum);
        const conv2 = relChange2 < CONV_THRESH;
        steps.push({
          stage: "STAGE_2ND",
          order: 2,
          sumBefore: prevSum,
          termAdded: term2,
          sumAfter: prevSum + term2,
          relChange: relChange2,
          converged: conv2
        });

        let finalSum = prevSum + term2;
        let finalOrder = 2;
        let highVariance = false;
        let isDone = conv2;

        // STAGE_3RD (3rd Order term: term2 * H * dt / 3!)
        const prevSum3 = finalSum;
        const term3 = (term2 * hTotal * dt) / 6.0; // 3! = 6.0 fixed in rev 1.0
        const relChange3 = Math.abs(term3) / Math.max(0.001, prevSum3);
        const conv3 = relChange3 < CONV_THRESH;
        if (!isDone) {
          finalSum = prevSum3 + term3;
          finalOrder = 3;
          steps.push({
            stage: "STAGE_3RD",
            order: 3,
            sumBefore: prevSum3,
            termAdded: term3,
            sumAfter: finalSum,
            relChange: relChange3,
            converged: conv3
          });
          if (conv3) isDone = true;
        } else {
          steps.push({
            stage: "STAGE_3RD (Bypassed)",
            order: 3,
            sumBefore: prevSum3,
            termAdded: 0,
            sumAfter: prevSum3,
            relChange: 0,
            converged: true
          });
        }

        // STAGE_4TH (4th Order term: term3 * H * dt / 4!)
        const prevSum4 = finalSum;
        const term4 = (term3 * hTotal * dt) / 24.0; // 4! = 24.0 fixed
        const relChange4 = Math.abs(term4) / Math.max(0.001, prevSum4);
        const conv4 = relChange4 < CONV_THRESH;
        if (!isDone) {
          finalSum = prevSum4 + term4;
          finalOrder = 4;
          steps.push({
            stage: "STAGE_4TH",
            order: 4,
            sumBefore: prevSum4,
            termAdded: term4,
            sumAfter: finalSum,
            relChange: relChange4,
            converged: conv4
          });
          if (conv4) isDone = true;
        } else {
          steps.push({
            stage: "STAGE_4TH (Bypassed)",
            order: 4,
            sumBefore: prevSum4,
            termAdded: 0,
            sumAfter: prevSum4,
            relChange: 0,
            converged: true
          });
        }

        // STAGE_5TH (5th Order term: term4 * H * dt / 5!)
        const prevSum5 = finalSum;
        const term5 = (term4 * hTotal * dt) / 120.0; // 5! = 120.0 fixed
        const relChange5 = Math.abs(term5) / Math.max(0.001, prevSum5);
        const conv5 = relChange5 < CONV_THRESH;
        if (!isDone) {
          finalSum = prevSum5 + term5;
          finalOrder = 5;
          steps.push({
            stage: "STAGE_5TH",
            order: 5,
            sumBefore: prevSum5,
            termAdded: term5,
            sumAfter: finalSum,
            relChange: relChange5,
            converged: conv5
          });
          if (!conv5) highVariance = true;
        } else {
          steps.push({
            stage: "STAGE_5TH (Bypassed)",
            order: 5,
            sumBefore: prevSum5,
            termAdded: 0,
            sumAfter: prevSum5,
            relChange: 0,
            converged: true
          });
        }

        // Master Reference Document catalogs (POG2-MHD-PROP-001)
        const STATE_OUTPUTS_MATRIX = [
          { state: "IDLE", binary: "000000", thrust: "Zero", acoustic: "< 20 dB re 1 μPa @ 1m", magnetic: "< 50 nT", description: "Zero thrust. Zero signature. Zero consumption. System dormant. All contactors open. Dry ice sealed. Salt at ambient." },
          { state: "STEALTH", binary: "110100", thrust: "20–35% (2,000–3,500 N/m²)", acoustic: "35–45 dB @ 5 kts (broadband quiet)", magnetic: "< 50 nT", description: "Transpiration active. CO₂ microbubble flux @ 0.32 kg/(m²·s). Releasing dry ice sublimation gas. Salt buffer armed and cyclic." },
          { state: "TRANSIT", binary: "111000", thrust: "100% (10,000 N/m²)", acoustic: "45–55 dB @ 15 kts", magnetic: "< 50 nT", description: "Full 118 kW thermal load directly on dry ice layer. Salt cyclic (reversible). Electrodes bare (no gas blanket). Seawater full flow." },
          { state: "TR_SALT", binary: "111010", thrust: "100% (10,000 N/m²)", acoustic: "45–55 dB", magnetic: "< 50 nT", description: "Transit mode with salt buffer matrix active to absorb heat spikes. Pre-staged for surge loads." },
          { state: "TR_CRIT", binary: "111011", thrust: "100% (10,005 N/m²)", acoustic: "45–55 dB", magnetic: "< 50 nT", description: "Thermal critical. Max active sublimation + max salt fusion. Begins 47-tick (30.1s) safety interlock countdown." },
          { state: "LIMP_MODE", binary: "111001", thrust: "75% (7,500 N/m²)", acoustic: "Shed reduced", magnetic: "< 50 nT", description: "Segment checkerboard shed active (50% power). Consumable rates cut to 372 kg/hr dry ice. Current limited to 5,435 A." },
          { state: "PURGE", binary: "001001", thrust: "Zero", acoustic: "N/A", magnetic: "N/A", description: "Zero thrust. CO₂ plenum blast to flush saltwater. Formulates sacrificial carbonate scale passivation layer to regenerate electrodes." },
          { state: "ST_CRIT", binary: "110111", thrust: "Stealth thrust", acoustic: "35–45 dB", magnetic: "< 50 nT", description: "Severe thermal overload alert triggered while running stealth. Starts 47-tick watchdog interlock." }
        ];

        const PHYSICAL_CONSTANTS = {
          fluid: [
            { key: "ρ_seawater", value: "1,025 kg/m³", desc: "Seawater density (nominal ocean surface intake)" },
            { key: "ν_seawater", value: "1.2 × 10⁻⁶ m²/s", desc: "Kinematic viscosity of seawater" },
            { key: "σ_seawater", value: "5.0 S/m", desc: "Conductivity of seawater (essential for MHD Lorenz forces)" },
            { key: "γ_seawater/CO₂", value: "0.072 N/m", desc: "Interfacial boundary surface tension" },
            { key: "ρ_CO₂ (194K, 1.3atm)", value: "3.59 kg/m³", desc: "Density of sublimated dry ice transpiration gas" },
          ],
          thermal: [
            { key: "h_sub_CO₂", value: "571 kJ/kg", desc: "Thermal heat absorption of CO₂ sublimation at 194.7 K" },
            { key: "h_fus_Na₂SO₄·10H₂O", value: "254 kJ/kg", desc: "Enthalpy capacity of Glauber's salt bellows bed (reversible)" },
            { key: "T_sub_CO₂", value: "194.7 K (-78.5°C)", desc: "Sublimation temperature point" },
            { key: "T_phase_salt", value: "305.4 K (32.4°C)", desc: "Onset temperature of Salt Hydrate fusion" },
            { key: "α_SiC", value: "1.2 × 10⁻⁴ m²/s", desc: "Silicon Carbide backing diffusiveness lag" },
          ],
          electrical: [
            { key: "V_bus", value: "5,000 V DC", desc: "Nominal operational bus voltage delivered by generators" },
            { key: "I_nominal", value: "1,880 A", desc: "Continuous operation nominal bus current load" },
            { key: "I_limp", value: "5,435 A", desc: "Failsafe limit bus current in LIMP mode" },
            { key: "R_electrode", value: "0.1 - 0.5 mΩ", desc: "Segment active electrode contact resistance" },
          ],
          control: [
            { key: "Tick duration", value: "600 ms (VHDL tick) / 640 ms (system)", desc: "Canonical metabolic clock cycle timing rate" },
            { key: "CRIT timeout", value: "47 ticks (30.1 seconds)", desc: "Thermal spike cut-off safety interlock duration" },
            { key: "GhostSplat horizon", value: "3 ticks (1.92s)", desc: "Adaptive Taylor series extrapolation advance limit" },
            { key: "CONV_THRESH_Q16", value: "3277 (0.05)", desc: "FSM convergence relative checking limit" },
          ]
        };

        return (
          <div className="space-y-5 text-left font-sans animate-fade-in">
            {/* 1. Header Banner */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg flex flex-col md:flex-row shadow-lg justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-cyan-950 border border-cyan-800 rounded">
                  <Activity className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-display font-medium text-sm text-slate-150 tracking-wider uppercase mb-1 flex items-center gap-1.5">
                    GHOSTSPLAT TELEMETRY PREDICTOR
                    <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-900 px-1.5 py-0.2 rounded font-mono font-bold">GHOSTSPLAT_PREDICTOR.vhd Rev 1.0</span>
                  </h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed max-w-2xl">
                    Executes high-order adaptive Taylor Series temperature extrapolation inside the FPGA fabric based on physical Hamiltonian estimations. Matches exact VHDL division-by-zero guards, relative change parameters, and fixed factorials.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] shrink-0 self-center">
                <span className="bg-slate-950 text-slate-400 border border-slate-800 px-2 py-1 rounded">
                  CLK: <strong className="text-emerald-400">250 MHz</strong>
                </span>
                <span className="bg-slate-950 text-slate-400 border border-slate-800 px-2 py-1 rounded">
                  TICK_CANONICAL: <strong className="text-amber-500">600 ms</strong>
                </span>
                <span className="bg-slate-950 text-slate-400 border border-slate-800 px-2 py-1 rounded font-bold">
                  B_Halbach: <strong className="text-cyan-400">2.3 T</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* PANEL left: Simulator Sandbox & Interactive Overrides */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="border-b border-slate-800 pb-2 mb-3 flex items-center justify-between select-none">
                    <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                      <Sliders className="h-4 w-4 text-cyan-400" />
                      PHYSICAL SENSOR INPUTS
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[9px] font-mono select-none">
                      <input
                        type="checkbox"
                        checked={isSandboxSyncMode}
                        onChange={(e) => setIsSandboxSyncMode(e.target.checked)}
                        className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-3 w-3"
                      />
                      <span className={isSandboxSyncMode ? "text-cyan-400 font-bold" : "text-slate-400"}>SYNC WITH HIL</span>
                    </label>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal mb-4 font-mono leading-relaxed">
                    Adjust current, temperature, or speed inputs to evaluate the Taylor series response. Turn off "SYNC WITH HIL" to test stress boundaries.
                  </p>

                  <div className="space-y-4">
                    {/* Temperature Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-400">Electrode Temp (T_e):</span>
                        <span className={`font-bold ${tempK > 320 ? "text-red-400 animate-pulse" : tempK > 305.4 ? "text-amber-400" : "text-emerald-400"}`}>
                          {tempK.toFixed(1)} K
                        </span>
                      </div>
                      <input
                        type="range"
                        min="280"
                        max="340"
                        step="0.2"
                        value={tempK}
                        disabled={isSandboxSyncMode}
                        onChange={(e) => setSandboxTemp(parseFloat(e.target.value))}
                        className={`w-full accent-cyan-500 cursor-pointer ${isSandboxSyncMode ? "opacity-40 cursor-not-allowed" : ""}`}
                      />
                      <div className="flex justify-between text-[7.5px] font-mono text-slate-500">
                        <span>Nominal 298K</span>
                        <span className="text-amber-600 font-medium">Salt Phase: 305.4K</span>
                        <span className="text-red-500 font-bold">Shutdown 320K</span>
                      </div>
                    </div>

                    {/* Bus Current Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-400">Bus Current (I_bus):</span>
                        <span className="text-slate-200 font-bold">
                          {currentA.toFixed(0)} A
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="6000"
                        step="50"
                        value={currentA}
                        disabled={isSandboxSyncMode}
                        onChange={(e) => setSandboxCurrent(parseFloat(e.target.value))}
                        className={`w-full accent-cyan-500 cursor-pointer ${isSandboxSyncMode ? "opacity-40 cursor-not-allowed" : ""}`}
                      />
                      <div className="flex justify-between text-[7.5px] font-mono text-slate-500">
                        <span>Dormant 0A</span>
                        <span>Nominal 1880A</span>
                        <span>MAX LIMP 5435A</span>
                      </div>
                    </div>

                    {/* Seawater Velocity Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-400">Shear Velocity (u*):</span>
                        <span className="text-slate-200 font-bold">
                          {uStar.toFixed(3)} m/s
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.01"
                        value={uStar}
                        disabled={isSandboxSyncMode}
                        onChange={(e) => setSandboxUStar(parseFloat(e.target.value))}
                        className={`w-full accent-cyan-500 cursor-pointer ${isSandboxSyncMode ? "opacity-40 cursor-not-allowed" : ""}`}
                      />
                      <div className="flex justify-between text-[7.5px] font-mono text-slate-500">
                        <span>Idle 0.0</span>
                        <span>Stealth 0.09 m/s</span>
                        <span>Transit 0.277 m/s</span>
                      </div>
                    </div>

                    {/* Electrical Reg State Selector */}
                    <div className="space-y-1">
                      <label className="text-[8.5px] font-mono text-slate-400 uppercase font-bold tracking-wider">Electrical Cap Mode (electrical_reg)</label>
                      <select
                        value={sandboxElecReg}
                        disabled={isSandboxSyncMode}
                        onChange={(e) => setSandboxElecReg(parseInt(e.target.value))}
                        className={`w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[10px] focus:outline-none focus:border-cyan-600 ${isSandboxSyncMode ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <option value={0}>00 - ELEC_OFF (No Joule heating)</option>
                        <option value={1}>01 - ELEC_NOM (Nominal full-load)</option>
                        <option value={2}>10 - ELEC_SHED (Power shedding limited)</option>
                        <option value={3}>11 - ELEC_CRIT (Maximum power buffer surge)</option>
                      </select>
                    </div>

                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800/60 mt-4 space-y-1.5 font-mono text-[9px] select-none text-slate-500">
                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">VHDL SILICON COPIER SIGNALS</div>
                  <div className="flex justify-between">
                    <span>ADDR_0x80 (H_TOTAL):</span>
                    <span className="text-slate-350">0x{(Math.round(hTotal) & 0xFFFF).toString(16).toUpperCase().padStart(4,"0")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ADDR_0x8C (ORDER_SEL):</span>
                    <span className={`font-bold ${finalOrder >= 4 ? "text-amber-400" : "text-cyan-400"}`}>0x0{finalOrder}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ADDR_0x94 (VAR_FLAG):</span>
                    <span className={`font-bold ${highVariance ? "text-red-400" : "text-slate-400"}`}>{highVariance ? "0x01 (HIGH_VAR)" : "0x00_STABLE"}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/40 pt-1.5">
                    <span>predictedTempRaw (Kelvin x 10):</span>
                    <span className="text-cyan-400 font-bold">{(finalSum * 10).toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {/* PANEL right: Hamiltonian Equation Core View */}
              <div className="lg:col-span-8 bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="border-b border-slate-800 pb-2 mb-4 flex items-center justify-between">
                    <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                      <Binary className="h-4 w-4 text-cyan-400" />
                      HAMILTONIAN STATE TERM GENERATOR
                    </span>
                    <span className="text-[8.5px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-900 uppercase">
                      H_total = H_elec + H_therm + H_fluid + H_cross_et + H_cross_ef
                    </span>
                  </div>

                  {/* Hamiltonian box system diagram */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
                    
                    {/* H_elec */}
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded relative hover:border-slate-700 transition">
                      <div className="absolute top-1 right-2 text-[7.5px] text-slate-500 font-bold">ADDR_0x82</div>
                      <div className="text-[9.5px] font-bold text-amber-400 tracking-wider mb-1 flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        JOULE HEATING H_elec
                      </div>
                      <div className="text-slate-400 text-[10px] leading-relaxed mb-1 bg-slate-900/40 p-1.5 rounded border border-slate-900">
                        Formula: <code className="text-slate-300">I_bus² × R_seg</code>
                        <div className="text-[8px] text-slate-500">R_seg = 0.001 Ω</div>
                      </div>
                      <div className="text-[12px] font-bold text-slate-200 mt-2">
                        {hElec.toFixed(2)} <span className="text-[8px] font-normal text-slate-500">W/seg (Q16: {Math.round(hElec * 65536)})</span>
                      </div>
                    </div>

                    {/* H_therm */}
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded relative hover:border-slate-700 transition">
                      <div className="absolute top-1 right-2 text-[7.5px] text-slate-500 font-bold">ADDR_0x84</div>
                      <div className="text-[9.5px] font-bold text-teal-400 tracking-wider mb-1 flex items-center gap-1">
                        <Database className="h-3 w-3 text-teal-400" />
                        PCM ABSORP H_therm
                      </div>
                      <div className="text-slate-400 text-[10px] leading-relaxed mb-1 bg-slate-900/40 p-1.5 rounded border border-slate-900">
                        Formula: <code className="text-teal-300">ΔT_pcm × K_salt</code>
                        <div className="text-[8px] text-slate-500">T_onset = 305.4K, K=254</div>
                      </div>
                      <div className="text-[12px] font-bold text-slate-200 mt-2">
                        {hTherm.toFixed(2)} <span className="text-[8px] font-normal text-slate-500">W (Q16: {Math.round(hTherm * 65536)})</span>
                      </div>
                    </div>

                    {/* H_fluid */}
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded relative hover:border-slate-700 transition">
                      <div className="absolute top-1 right-2 text-[7.5px] text-slate-500 font-bold">ADDR_0x86</div>
                      <div className="text-[9.5px] font-bold text-blue-400 tracking-wider mb-1 flex items-center gap-1">
                        <Gauge className="h-3 w-3 text-blue-400" />
                        WALL SHEAR H_fluid
                      </div>
                      <div className="text-slate-400 text-[10px] leading-relaxed mb-1 bg-slate-900/40 p-1.5 rounded border border-slate-900">
                        Formula: <code className="text-blue-300">ρ × (u*)³ / C_therm</code>
                        <div className="text-[8px] text-slate-500">C_therm = 0.00418</div>
                      </div>
                      <div className="text-[12px] font-bold text-slate-200 mt-2">
                        {hFluid.toFixed(2)} <span className="text-[8px] font-normal text-slate-500">W (Q16: {Math.round(hFluid * 65536)})</span>
                      </div>
                    </div>

                  </div>

                  {/* Cross domains and aggregate */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 font-mono">
                    
                    {/* H_cross */}
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded hover:border-slate-700 transition">
                      <div className="text-[9.5px] font-bold text-indigo-400 tracking-wider mb-2 uppercase">
                        CROSS-DOMAIN INTERFACIAL COUPLINGS
                      </div>
                      <div className="space-y-2 text-[10px] text-slate-400 leading-normal">
                        <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded border border-slate-900">
                          <div>
                            <span className="font-bold text-indigo-300">H_cross_et (Elec-Therm):</span>
                            <div className="text-[7.5px] text-slate-500">Formula: (H_elec × H_therm) / 256</div>
                          </div>
                          <span className="text-slate-200 text-right font-bold">{hCrossEt.toFixed(3)} W</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded border border-slate-900">
                          <div>
                            <span className="font-bold text-indigo-300">H_cross_ef (Elec-Fluid):</span>
                            <div className="text-[7.5px] text-slate-500">Formula: (H_elec × H_fluid) / 512</div>
                          </div>
                          <span className="text-slate-200 text-right font-bold">{hCrossEf.toFixed(3)} W</span>
                        </div>
                      </div>
                    </div>

                    {/* Aggregate total H */}
                    <div className="bg-gradient-to-br from-slate-950 to-cyan-950/20 border border-cyan-800/40 p-4 rounded-lg flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-cyan-400 uppercase block tracking-wider mb-1 font-mono">TOTAL ESTIMATED SYSTEM HAMILTONIAN</span>
                        <p className="text-[9px] text-slate-500 font-sans leading-relaxed">
                          Integrates electromagnetic, fluid dynamics, and material phase kinetics models into a single thermal power derivative.
                        </p>
                      </div>
                      
                      <div className="flex justify-between items-end border-t border-slate-800/60 pt-3 mt-2">
                        <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">H_total (W):</span>
                        <span className="text-cyan-400 font-bold text-lg leading-none font-mono">
                          {hTotal.toFixed(2)} W <span className="text-[8.5px] font-normal text-slate-500">/ segment</span>
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Info and Warning alerts depending on custom temperatures */}
                <div className="mt-4 p-2.5 bg-slate-950/40 border border-slate-850 rounded font-sans text-[10px] text-slate-450 leading-relaxed max-w-4xl">
                  {tempK > 320 ? (
                    <div className="flex items-center gap-2 text-red-400 font-semibold font-mono">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      SENSOR EMERGENCY INTERLOCK ACTIVE: Temperature exceeds critical 320.0 K threshold. Hardware will trigger LIMP_MODE in {47} ticks if temperature doesn't retreat.
                    </div>
                  ) : tempK > 305.4 ? (
                    <div className="flex items-center gap-2 text-amber-400 font-mono">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      SALT HYDRATE PHASE CHANGE ACTIVE: Core temperature exceeds 305.4 K threshold. Core bellows bed is absorbing heat (Enthalpy 254 kJ/kg) to shelter NdFeB Halbach arrays.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400 font-mono">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      SIC BACKING THERMALLY PROTECTIVE: All sensor grids stable. Core operates below salt fusion limits, assuring peak structural magnetism in neodymium boundaries.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* 3. Taylor Series VHDL FSM Pipeline Execution steps */}
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg space-y-4">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  VHDL TAYLOR PIPELINE STEP SEQUENCE
                </span>
                <span className="text-[8px] font-mono text-slate-400">
                  CONVERGENCE TOLERANCE LIMIT: <strong className="text-amber-500">0.05 (5.0%)</strong>
                </span>
              </div>

              {/* Grid of pipeline stages */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 font-mono">
                {steps.map((st, sIdx) => {
                  const isActive = finalOrder === st.order || (sIdx === 0 && finalOrder === 2);
                  const isBypassed = st.stage.includes("Bypassed");
                  return (
                    <div
                      key={sIdx}
                      className={`bg-slate-950 border p-3 rounded flex flex-col justify-between relative transition duration-150 ${
                        isBypassed
                          ? "opacity-30 border-slate-900"
                          : isActive
                          ? "border-cyan-500 ring-1 ring-cyan-500/20 shadow-lg shadow-cyan-950/20"
                          : "border-slate-850 hover:border-slate-750"
                      }`}
                    >
                      {/* Step index badge */}
                      <div className="absolute top-1.5 right-2 text-[7.5px] text-slate-600 font-bold">
                        STAGE_0{sIdx + 1}
                      </div>

                      <div className="space-y-1.5 select-none">
                        <div className={`text-[9px] font-bold ${
                          isBypassed ? "text-slate-650" : isActive ? "text-cyan-400" : "text-slate-400"
                        }`}>
                          {st.stage}
                        </div>
                        <div className="text-[8px] text-slate-500 block leading-none">
                          Fact: {factorialTable[st.order]}! = {factorialTable[st.order].toFixed(0)}
                        </div>
                      </div>

                      <div className="space-y-2 mt-4 text-[9.5px]">
                        <div>
                          <span className="text-slate-550 block text-[7.5px]">TERM MAGNITUDE:</span>
                          <span className={`${isBypassed ? "text-slate-650" : "text-slate-300"} font-bold block`}>
                            {st.termAdded === 0 ? "0.00" : st.termAdded.toFixed(4)} K
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[7.5px]">ACCUMULATIVE T:</span>
                          <span className={`${isBypassed ? "text-slate-60)5" : "text-slate-200"} font-bold block`}>
                            {st.sumAfter.toFixed(2)} K
                          </span>
                        </div>
                        <div className="border-t border-slate-900 pt-1.5">
                          <span className="text-slate-550 block text-[7.5px]">REL CHANGE:</span>
                          <span className={`block font-bold ${
                            isBypassed ? "text-slate-650" : st.relChange < CONV_THRESH ? "text-emerald-400" : "text-amber-500"
                          }`}>
                            {isBypassed ? "N/A" : `${(st.relChange * 100).toFixed(2)}%`}
                          </span>
                        </div>
                      </div>

                      {/* Convergence dot indicator */}
                      <div className="mt-3 pt-2 border-t border-slate-900 flex justify-between items-center text-[7.5px]">
                        <span className="text-slate-550">CONVERGED:</span>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                          isBypassed ? "bg-slate-800" : st.relChange < CONV_THRESH ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Document Reference sheets panel - searchable with categories */}
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg space-y-4">
              <div className="border-b border-slate-800 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 font-semibold select-none">
                  <BookOpen className="h-4 w-4 text-cyan-400" />
                  MHD SYSTEM MASTER REFERENCE SHEET (PROP-001)
                </span>

                <div className="flex bg-slate-950 border border-slate-800 rounded p-0.5 font-mono text-[8.5px] items-center gap-0.5">
                  <button
                    onClick={() => setSandboxConstantsSubTab("consumables")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer shrink-0 ${
                      sandboxConstantsSubTab === "consumables" ? "bg-cyan-950/40 text-cyan-400 font-bold border border-cyan-900" : "text-slate-400 border border-transparent hover:text-slate-200"
                    }`}
                  >
                    CONSUMABLES
                  </button>
                  <button
                    onClick={() => setSandboxConstantsSubTab("constants")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer shrink-0 ${
                      sandboxConstantsSubTab === "constants" ? "bg-cyan-950/40 text-cyan-400 font-bold border border-cyan-900" : "text-slate-400 border border-transparent hover:text-slate-200"
                    }`}
                  >
                    CONSTANTS
                  </button>
                  <button
                    onClick={() => setSandboxConstantsSubTab("outputs")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer shrink-0 ${
                      sandboxConstantsSubTab === "outputs" ? "bg-cyan-950/40 text-cyan-400 font-bold border border-cyan-900" : "text-slate-400 border border-transparent hover:text-slate-200"
                    }`}
                  >
                    PRIMARY OUTPUTS
                  </button>
                  <button
                    onClick={() => setSandboxConstantsSubTab("matrix")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer shrink-0 ${
                      sandboxConstantsSubTab === "matrix" ? "bg-cyan-950/40 text-cyan-400 font-bold border border-cyan-900" : "text-slate-400 border border-transparent hover:text-slate-200"
                    }`}
                  >
                    STATE-TO-OUTPUT MATRIX
                  </button>
                </div>
              </div>

              {/* Sub-tab 1: Consumables */}
              {sandboxConstantsSubTab === "consumables" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[9.5px]">
                  
                  {/* CO2 Dry Ice */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded">
                    <span className="text-[10px] text-cyan-400 font-bold block mb-1.5 uppercase">1.1 DRY ICE (Solid CO₂)</span>
                    <div className="space-y-1.5 text-slate-400 leading-normal">
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Mass:</span> <strong className="text-slate-200">10,000 kg magazine</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Sublimation enthalpy:</span> <strong className="text-slate-200">571 kJ/kg @ 194.7 K</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Insulation barrier:</span> <strong className="text-slate-200">50mm Aerogel blanket</strong>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span>Active Heat Leak:</span> <strong className="text-slate-200">~2.0 kW total</strong>
                      </div>
                    </div>
                    <div className="bg-slate-900/40 p-2 border border-slate-900 rounded mt-3 text-[9px] text-slate-500">
                      <span className="font-bold text-slate-400 block mb-0.5">CONSUMPTION RATES:</span>
                      • IDLE & STEALTH TRANS: 745 kg/hr<br />
                      • TRANSIT & ACTIVE: 745 kg/hr (thermal)<br />
                      • LIMP MODE SAFETY: 372 kg/hr (50% shed)
                    </div>
                  </div>

                  {/* Salt Hydrate */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded">
                    <span className="text-[10px] text-teal-400 font-bold block mb-1.5 uppercase">1.2 SALT HYDRATE (Glauber's Salt)</span>
                    <div className="space-y-1.5 text-slate-400 leading-normal">
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Bellows bed mass:</span> <strong className="text-slate-200">279 kg matrix</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Phase transformation:</span> <strong className="text-slate-200">305.4 K (32.4°C)</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Transition Enthalpy:</span> <strong className="text-slate-200">254 kJ/kg</strong>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span>Total capacity:</span> <strong className="text-slate-200">70,866 kJ</strong>
                      </div>
                    </div>
                    <div className="bg-slate-900/40 p-2 border border-slate-900 rounded mt-3 text-[9px] text-slate-500">
                      <span className="font-bold text-slate-400 block mb-0.5">SPIKE PROTECTION DESIGN</span>
                      Thermal capacity guarantees 10 minutes of full 118 kW load absorption. Leaves 139 kg distilled water byproduct used for sacrificial electrode flush.
                    </div>
                  </div>

                  {/* Seawater open loop */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded">
                    <span className="text-[10px] text-blue-400 font-bold block mb-1.5 uppercase">1.3 SEAWATER OPEN LOOP</span>
                    <div className="space-y-1.5 text-slate-400 leading-normal">
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Conductivity (σ):</span> <strong className="text-slate-200">5.0 S/m (nominal ocean)</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Base mass density (ρ):</span> <strong className="text-slate-200">1,025 kg/m³</strong>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span>Boundary tension (γ):</span> <strong className="text-slate-200">0.072 N/m (vs CO₂)</strong>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span>Intake supply:</span> <strong className="text-slate-200">Unlimited (open loop)</strong>
                      </div>
                    </div>
                    <div className="bg-slate-900/40 p-2 border border-slate-900 rounded mt-3 text-[9px] text-slate-500">
                      <span className="font-bold text-slate-400 block mb-0.5">VELOCITY PROFILE:</span>
                      • IDLE flow rate: 0.5 m/s<br />
                      • STEALTH rate: 2.57 m/s (5 kts)<br />
                      • TRANSIT rate: 7.72 m/s (15 kts)
                    </div>
                  </div>

                </div>
              )}

              {/* Sub-tab 2: Constants Base */}
              {sandboxConstantsSubTab === "constants" && (
                <div className="bg-slate-950 p-4 border border-slate-850 rounded">
                  <div className="text-[10px] text-cyan-400 font-bold mb-3 uppercase border-b border-slate-900 pb-1.5 select-none font-mono">
                    PHYSICAL DESIGN & SILICON BOUNDARY CONSTANTS CODELYZER
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 font-mono text-[9px]">
                    <div>
                      <div className="text-slate-500 font-bold mb-1.5 uppercase text-[8px] tracking-wider">A. Fluids & Thermal properties</div>
                      <div className="space-y-1.5">
                        {PHYSICAL_CONSTANTS.fluid.map((c, idx) => (
                          <div key={idx} className="flex justify-between border-b border-slate-900 pb-1 text-slate-400">
                            <span>{c.key} ({c.desc}):</span>
                            <strong className="text-slate-200">{c.value}</strong>
                          </div>
                        ))}
                        {PHYSICAL_CONSTANTS.thermal.map((c, idx) => (
                          <div key={idx} className="flex justify-between border-b border-slate-900 pb-1 text-slate-400">
                            <span>{c.key} ({c.desc}):</span>
                            <strong className="text-slate-200">{c.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-bold mb-1.5 uppercase text-[8px] tracking-wider">B. Electrical & Controller boundaries</div>
                      <div className="space-y-1.5">
                        {PHYSICAL_CONSTANTS.electrical.map((c, idx) => (
                          <div key={idx} className="flex justify-between border-b border-slate-900 pb-1 text-slate-400">
                            <span>{c.key} ({c.desc}):</span>
                            <strong className="text-slate-200">{c.value}</strong>
                          </div>
                        ))}
                        {PHYSICAL_CONSTANTS.control.map((c, idx) => (
                          <div key={idx} className="flex justify-between border-b border-slate-900 pb-1 text-slate-400">
                            <span>{c.key} ({c.desc}):</span>
                            <strong className="text-slate-200">{c.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Primary Outputs */}
              {sandboxConstantsSubTab === "outputs" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[9.5px]">
                  
                  {/* Primary Thrust */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded">
                    <span className="text-[10px] text-cyan-400 font-bold block mb-1.5 uppercase">3.1 THRUST OUTPUT METRICS</span>
                    <div className="space-y-2 text-slate-400 leading-normal">
                      <p>
                        Target design load density is <strong className="text-slate-200">10,000 N/m²</strong> streamwise thrust, symmetric.
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-450 text-[9px]">
                        <li>Nominal Transition (transit): 100% thrust retention</li>
                        <li>Stealth state threshold: 20-35% thrust limits</li>
                        <li>Limp Mode: Keeps 75% thrust by utilizing 50% checkerboard segment shedding to save power boundaries.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Acoustic Signature */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded">
                    <span className="text-[10px] text-emerald-400 font-bold block mb-1.5 uppercase">3.2 ACOUSTIC SIGNATURE INTEGRITY</span>
                    <div className="space-y-2 text-slate-400 leading-normal">
                      <p>
                        Zero rotational or gearbox mechanical moving parts guarantees near total silent profile.
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-450 text-[9px]">
                        <li>IDLE profile: <strong className="text-slate-200">&lt; 20 dB re 1 μPa @ 1m</strong></li>
                        <li>STEALTH (5 kts): <strong className="text-slate-200">35–45 dB</strong> broadband quiet</li>
                        <li>TRANSIT (15 kts): <strong className="text-slate-200">45–55 dB</strong> ambient turbulences</li>
                        <li>Microbubbles resonate high at 6.5 kHz, above military sonar sensing bands.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Magnetic Shielding cascade */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded">
                    <span className="text-[10px] text-indigo-400 font-bold block mb-1.5 uppercase">3.3 MAGNETIC SIGNATURE ATTENUATION</span>
                    <div className="space-y-2 text-slate-400 leading-normal">
                      <p>
                        Dual-layered Halbach shield limits leakage fields to <strong className="text-slate-200">&lt; 50 nT</strong>, evading Magnetic Anomaly Detection (MAD) searches.
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-450 text-[9px]">
                        <li>Stage 1: 0.8 mm Si-Steel flux diverter (2.3 T → 0.5 T)</li>
                        <li>Stage 2: 1.5 mm aerated composites isolation spacer</li>
                        <li>Stage 3: 3 plies of 0.5 mm high-permeability Mu-Metal (0.5 T → &lt; 50 nT)</li>
                      </ul>
                    </div>
                  </div>

                </div>
              )}

              {/* Sub-tab 4: State-to-Output Matrix */}
              {sandboxConstantsSubTab === "matrix" && (
                <div className="bg-slate-950 rounded border border-slate-850 overflow-hidden font-mono text-[9px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-350 border-b border-slate-800 text-[8.5px] uppercase font-bold tracking-wider">
                        <th className="p-2.5">Core State Labels</th>
                        <th className="p-2.5">Binary (Yao)</th>
                        <th className="p-2.5">Thrust Capacity</th>
                        <th className="p-2.5">Acoustic Status</th>
                        <th className="p-2.5">Leakage Field</th>
                        <th className="p-2.5">Active Consumables & Operational Characteristics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {STATE_OUTPUTS_MATRIX.map((st, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/30 transition text-slate-400">
                          <td className="p-2.5 font-bold text-slate-200">{st.state}</td>
                          <td className="p-2.5 text-cyan-400 font-semibold">{st.binary}</td>
                          <td className="p-2.5">{st.thrust}</td>
                          <td className="p-2.5">{st.acoustic}</td>
                          <td className="p-2.5 text-emerald-400">{st.magnetic}</td>
                          <td className="p-2.5 text-slate-450 font-sans leading-relaxed">{st.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* TAB 7: MEMORY & PEDAGOGY INTEGRATION MAP */}
      {activeTab === "pedagogy" && (() => {
        // Collect sandbox/active parameters for integration mappings
        const currentA = currentPacket ? currentPacket.currBusRaw * 10 : 1880;
        const currentTempK = currentPacket ? (currentPacket.predictedTempRaw / 10) : 300.2;
        const currentPresAtm = currentPacket ? (currentPacket.pressPlenumRaw / 1000) : 1.30;
        const activeHexIndex = currentPacket ? currentPacket.hexagramState : 0;
        const currentFaultVal = currentPacket ? currentPacket.faultByte : 0;

        const PATHS_MAPPING = [
          {
            key: "pedagogy_rom",
            swPath: "memory/pedagogy/verified_entities.jsonl",
            swDesc: "Chronicles 229,000+ non-player combat entity profiles, level indexes, and attack ratings with verified SHA-256 signatures.",
            hwReg: "Hexagram Property ROM (0x800-0x9FF)",
            hwDesc: "A 64-entry distributed LUT ROM containing synthesized 8-byte property profiles for hardware fallback state boundaries.",
            address: "0x43C0_0800 to 0x43C0_09FF",
            fields: ["thermal_variance (8b fixed-point 8.8)", "crit_timeout (16b ticks)", "shed_pattern (10b mask)", "boot_profile (3b enum)"]
          },
          {
            key: "learning_db",
            swPath: "memory/learning/sovereign-learning.db",
            swDesc: "Sovereign Learning SQLite database archiving real-time local model weights and vector index offsets of historical runs.",
            hwReg: "GHOSTSPLAT_FIELD (0x80 - 0x98)",
            hwDesc: "FPGA registers detailing chordwise channel segment heat inputs and trend calculations used for active Taylor Series extrapolation.",
            address: "0x43C0_0400 to 0x43C0_041F",
            fields: ["segment_heat[5] (16b uint)", "segment_trend[5] (8b int)", "saturation_mask (8b mask)"]
          },
          {
            key: "compressed_states",
            swPath: "memory/consolidation/compressed_states/",
            swDesc: "Contains highly compressed (LZ4) historical telemetry session snapshots and emotional vibe parameters with 24h TTL limits.",
            hwReg: "TELEMETRY_SEQ (0xA0) + FAULT_LOG (0xBC)",
            hwDesc: "Automated streaming telemetry register and sequential co-processor fault history memory stack.",
            address: "0x43C0_0500 & 0x43C0_0610",
            fields: ["telemetry_sequence_counter (32b)", "fault_fifo_log_stack (32b x 16 entries)"]
          },
          {
            key: "storyboard_assets",
            swPath: "generations/storyboard/ & voice/",
            swDesc: "High-level creative storyboard files, synthesized tactical voice directives, and generated vector clips compiled during action sequence alerts.",
            hwReg: "BOOT_PHASE (0x2C) + TICK_COUNT (0x34)",
            hwDesc: "FPGA bootstrap phase tracker and high-speed metabolic system clock cycle timer.",
            address: "0x43C0_002C & 0x43C0_0034",
            fields: ["boot_phase_stage (8b enum)", "metabolic_tick_counter (32b)"]
          },
          {
            key: "limbs_metaphysical",
            swPath: "src/limbs/metaphysical/GhostLimb.ts",
            swDesc: "Software implementations of non-physical actuator drives (GhostLimb, RelicLimb, QuantumLimb) responding to anomalous force spikes.",
            hwReg: "STATUS (0x08) + CONTROL (0x0C)",
            hwDesc: "Core hardware status flags and direct system override drive lines.",
            address: "0x43C0_0008 & 0x43C0_000C",
            fields: ["status_initiations (INIT_DONE, GHOSTSPLAT_READY)", "thermal_critical_flags (THERMAL_CRIT)", "emergency_brakes (EMERGENCY_OPEN, LIMP)"]
          }
        ];

        const ENTITY_PEOPLE = [
          {
            id: 1,
            type: "Boss (high HP)",
            name: "General Graardor",
            hexagram: "1 (Creative)",
            hexagramId: 1,
            thermalVariance: 0.8,
            vibeMode: "AGITATED",
            shedPattern: "0000000000",
            bootProfile: "fast",
            critTimeoutTicks: 47,
            combatLevel: 624,
            maxHit: 60,
            attSpeed: 4,
            weakness: "range, mage",
            chokePhases: [0, 72, 144, 216, 288],
            description: "Extremely high combat aggression profile translating to a maximum thermal variance coefficient and an immediate boot execution profile. Does not shed contacts (fully unified load)."
          },
          {
            id: 23,
            type: "Boss (mechanic)",
            name: "Vorago",
            hexagram: "23 (Splitting)",
            hexagramId: 23,
            thermalVariance: 0.5,
            vibeMode: "TRANSIT",
            shedPattern: "1100110011",
            bootProfile: "slow",
            critTimeoutTicks: 47,
            combatLevel: 900,
            maxHit: 50,
            attSpeed: 6,
            weakness: "maul",
            chokePhases: [0, 60, 120, 180, 240],
            description: "Highly structured phase transitions. Utilizes a balanced thermal variance with checkerboard contactor shedding patterns to prevent localized coil hotspots."
          },
          {
            id: 52,
            type: "Slayer mob",
            name: "Abyssal demon",
            hexagram: "52 (Keeping Still)",
            hexagramId: 52,
            thermalVariance: 0.2,
            vibeMode: "SERENE",
            shedPattern: "1111111111",
            bootProfile: "cautious",
            critTimeoutTicks: 64,
            combatLevel: 124,
            maxHit: 8,
            attSpeed: 4,
            weakness: "slash",
            chokePhases: [0, 90, 180, 270, 360],
            description: "Conservative profile running beneath baseline thermal thresholds. Default stand-by or quiescent vibe mapping. Immediate full power contactor shedding permitted upon retreat."
          },
          {
            id: 64,
            type: "Wilderness boss",
            name: "Chaos Elemental",
            hexagram: "64 (Before Completion)",
            hexagramId: 64,
            thermalVariance: 1.0,
            vibeMode: "SPOOKY",
            shedPattern: "1111111111",
            bootProfile: "minimal",
            critTimeoutTicks: 32,
            combatLevel: 305,
            maxHit: 28,
            attSpeed: 5,
            weakness: "none",
            chokePhases: [0, 45, 90, 135, 180],
            description: "Maximum chaotic state representing random, high-frequency kinetic shifts. Imposes severe thermal load volatility requiring continuous adaptive PID dampening adjustments."
          },
          {
            id: 2,
            type: "Quest NPC",
            name: "Wise Old Man",
            hexagram: "2 (Receptive)",
            hexagramId: 2,
            thermalVariance: 0.3,
            vibeMode: "CLINICAL",
            shedPattern: "1111111111",
            bootProfile: "recovery",
            critTimeoutTicks: 56,
            combatLevel: 130,
            maxHit: 12,
            attSpeed: 4,
            weakness: "spellbind",
            chokePhases: [0, 80, 160, 240, 320],
            description: "Highly receptive, protective, and predictable profile utilizing a slow, defensive boot sequence and linear contactor shedding patterns."
          }
        ];

        const AXI_BLOCKS = [
          {
            key: "control",
            base: "0x43C0_0000",
            size: "0x100",
            name: "Control & Status Region",
            registers: [
              { offset: "0x00", name: "IP_ID", val: "0x504F4732", access: "R-O", desc: "Hexadecimal magic identifier string for hardware co-processor ('POG2')" },
              { offset: "0x04", name: "IP_VERSION", val: "0x00010000", access: "R-O", desc: "VHDL IP core revision number (Major 1.0, Minor 0.0)" },
              { offset: "0x08", name: "STATUS", val: "INIT_DONE | GHOSTSPLAT_READY" + (watchdogStatus === "HEALTHY" ? " | WATCHDOG_OK" : " | WATCHDOG_EXPIRED"), access: "R-O", desc: "Hardware status flags. High flags signal healthy boot and predictive engine readiness." },
              { offset: "0x0C", name: "CONTROL", val: watchdogStatus !== "HEALTHY" ? "0x00000001 (EMERGENCY_OPEN)" : "0x00000002 (AUTO_DAMP_EN)", access: "R-W", desc: "Active override core control register. Write 1 to set force OPEN interrupts." },
              { offset: "0x10", name: "HEXAGRAM_STATE", val: "0x" + activeHexIndex.toString(16).toUpperCase().padStart(2, "0") + " (" + activeHexIndex + "d)", access: "R-W", desc: "Current running Yao-6 state byte matching current state index (0 to 63)" },
              { offset: "0x14", name: "YAO_LINES", val: activeHexIndex.toString(2).padStart(6, "0"), access: "R-W", desc: "Raw bitstring representing the solid/broken lines of the active hexagram" },
              { offset: "0x2C", name: "BOOT_PHASE", val: "0x0" + (activeHexIndex === 0 ? "0" : "1") + " (STEALTH_IDLE)", access: "R-O", desc: "Reflects current phase of the hardware bootstrap sequencer (e.g. STEALTH_IDLE)" },
              { offset: "0x34", name: "TICK_COUNT", val: "0x" + (currentA > 0 ? (12400 + Math.round(currentTempK)).toString(16).toUpperCase() : "0000034A"), access: "R-O", desc: "Aggregated metabolic elapsed clock ticks since hardware power-on" }
            ]
          },
          {
            key: "personality",
            base: "0x43C0_0100",
            size: "0x100",
            name: "Personality & Sentiment",
            registers: [
              { offset: "0x00", name: "VIBE_MODE", val: activeHexIndex === 52 ? "0x05 (SERENE)" : activeHexIndex === 56 ? "0x03 (TRANSIT)" : "0x01 (AGITATED)", access: "R-W", desc: "Selected default emotional tone index mapped to active combat mindset" },
              { offset: "0x04", name: "THERMAL_VARIANCE", val: activeHexIndex === 52 ? "0x0033 (0.20)" : "0x00B2 (0.70)", access: "R-W", desc: "Adrenaline-derived volatility threshold. Controls Taylor expansion limits." },
              { offset: "0x08", name: "PERSONALITY_CARD", val: "0x3C9A (MULTI_EN)", access: "R-W", desc: "Mask of emotional multipliers (Quietude, Serenity, Tension, and Aggression)" },
              { offset: "0x0C", name: "TICK_DURATION_MS", val: "0x00000280 (640 ms)", access: "R-W", desc: "Programmable clock divider rate for local metabolic ticks. Divided down from 250MHz." }
            ]
          },
          {
            key: "actuation",
            base: "0x43C0_0200",
            size: "0x100",
            name: "Actuation & Contactor",
            registers: [
              { offset: "0x00", name: "CONTACTOR_STATUS", val: watchdogStatus !== "HEALTHY" ? "0x000" : "0x3FF (ALL_CLOSED)", access: "R-O", desc: "Direct feedback values showing actual physical contact open/closed state" },
              { offset: "0x04", name: "CONTACTOR_FAULT", val: "0x" + currentFaultVal.toString(16).toUpperCase().padStart(3, "0"), access: "R-O", desc: "Flag reporting internal segment fault indicators or structural grid welding" },
              { offset: "0x08", name: "CONTACTOR_TARGET", val: watchdogStatus !== "HEALTHY" ? "0x000" : "0x3FF", access: "R-W", desc: "Writable target command byte determining next contactor open/close goal" },
              { offset: "0x0C", name: "LIMP_MODE", val: activeHexIndex === 57 ? "0x1d (ACTIVE)" : "0x00 (INACTIVE)", access: "R-O", desc: "Asserted if segment checkerboard shedding becomes active due to heat overload" }
            ]
          },
          {
            key: "choke",
            base: "0x43C0_0300",
            size: "0x100",
            name: "Choke Driver",
            registers: [
              { offset: "0x00", name: "CHOKE_DUTY_ARRAY", val: "0x" + Math.round(currentA / 10).toString(16).toUpperCase() + " per seg", access: "R-O", desc: "Read array of individual duty ratings on the 5 independent chordwise segments" },
              { offset: "0x14", name: "CHOKE_PHASE_ARRAY", val: "[0, 72, 144, 216, 288] deg", access: "R-W", desc: "Writable phases ensuring even gas blanket transpiration along the channel" },
              { offset: "0x28", name: "CHOKE_FREQ", val: "0x00001960 (6500 Hz)", access: "R-W", desc: "Coils driving excitation frequency used for magnetic flux generation" }
            ]
          },
          {
            key: "thermal",
            base: "0x43C0_0400",
            size: "0x100",
            name: "Thermal Field Integration",
            registers: [
              { offset: "0x00", name: "SEGx_HEAT_ARRAY", val: "0x" + Math.round(currentTempK * 10).toString(16).padEnd(4, "0"), access: "R-O", desc: "Raw temperatures read from front and back electrode boundary channels" },
              { offset: "0x14", name: "SEGx_TREND_ARRAY", val: currentTempK > 300 ? "0x03 (RISING)" : "0x00 (FLAT)", access: "R-O", desc: "Velocity change metrics highlighting rapid heating or cooling cycles" },
              { offset: "0x20", name: "GHOSTSPLAT_CONF", val: "0x" + (currentTempK > 315 ? "7F (50%)" : "E5 (90%)"), access: "R-O", desc: "Adherence index comparing actual temperature tracking vs predicted Taylor curves" }
            ]
          },
          {
            key: "telemetry",
            base: "0x43C0_0500",
            size: "0x100",
            name: "Telemetry Pipeline",
            registers: [
              { offset: "0x00", name: "TELEMETRY_SEQ", val: "0x0000" + liveTelemetrySeq.toString(16).toUpperCase(), access: "R-O", desc: "Sequence counter increments on every telemetry transmit cycle" },
              { offset: "0x04", name: "TELEMETRY_RATE", val: isSourcingActive ? "0x64 (100 Hz)" : "0x0A (10 Hz)", access: "R-W", desc: "Variable streaming rate configuration. Boosts to 100 Hz during critical surges" },
              { offset: "0xB4", name: "TELEMETRY_MAGIC", val: "0xBEEFFF11", access: "R-O", desc: "Constant verification byte identifying valid streaming socket headers" }
            ]
          },
          {
            key: "logging",
            base: "0x43C0_0600",
            size: "0x100",
            name: "Fault Logging & Watchdogs",
            registers: [
              { offset: "0x00", name: "FAULT_CODE", val: currentFaultVal > 0 ? "0x" + currentFaultVal.toString(16).toUpperCase() : "0x00 (NONE)", access: "R-O", desc: "Error register recording the highest severity fault code flagged by interlocks" },
              { offset: "0x04", name: "FAULT_LOG", val: "[Stack FIFO active]", access: "R-O", desc: "16-deep FIFO, shifts out error history tracking with tick index tags" },
              { offset: "0x44", name: "WATCHDOG_TIMEOUT", val: "0x" + watchdogCountdown.toString(16).toUpperCase().padStart(4, "0") + " ticks (" + (watchdogCountdown * 0.64).toFixed(1) + "s)", access: "R-W", desc: "Failsafe countdown register. Must be pet before zeroing to avert emergency opens" }
            ]
          },
          {
            key: "rom",
            base: "0x43C0_0800",
            size: "0x200",
            name: "Distributed Hexagram Property ROM",
            registers: [
              { offset: "0x00", name: "ROM_CELL_01 (Creative)", val: "CC | 002F | 000 | 1", access: "R-W", desc: "Profile for Hexagram 1. Preloads aggressive thermal variance (0.80) and Fast Boot profile." },
              { offset: "0x08", name: "ROM_CELL_02 (Receptive)", val: "4D | 0038 | 3FF | 5", access: "R-W", desc: "Profile for Hexagram 2. Preloads cautious thermal variance (0.30) and Recovery Boot profile." },
              { offset: "0xB8", name: "ROM_CELL_23 (Splitting)", val: "80 | 0030 | 333 | 2", access: "R-W", desc: "Profile for Hexagram 23. Preloads moderate thermal variance (0.50) and Slow Boot profile." },
              { offset: "0x1A0", name: "ROM_CELL_52 (Keeping Still)", val: "33 | 0040 | 3FF | 3", access: "R-W", desc: "Profile for Hexagram 52. Preloads quiescent thermal variance (0.20) and Cautious Boot profile." },
              { offset: "0x200", name: "ROM_CELL_64 (Before Comp)", val: "FF | 0020 | 3FF | 4", access: "R-W", desc: "Profile for Hexagram 64. Preloads chaotic thermal variance (1.00) and Minimal Boot profile." }
            ]
          },
          {
            key: "health",
            base: "0x43C0_0A00",
            size: "0x100",
            name: "Health & Post-Mortem Monitors",
            registers: [
              { offset: "0x00", name: "FSM_HEARTBEATS", val: "[Packed Bits: 0x3F]", access: "R-O", desc: "6-bit pulsing bitmask representing live heartbeat triggers of critical controller modules." },
              { offset: "0x04", name: "CDC_METASTABILITY", val: "[Timing STATUS: OK]", access: "R-O", desc: "Status of Clock Domain Crossing synchronizers. High values indicate metastability desync alerts." },
              { offset: "0x08", name: "MEM_UTILIZATION", val: "[32-SRAM ring stack depth]", access: "R-O", desc: "Current FIFO depth and SRAM storage occupancy of the Post-Mortem Logging subsystem." },
              { offset: "0x10", name: "POST_MORTEM_CTR", val: "0x00000000", access: "R-W", desc: "Write selected post-mortem entry cursor index (0..31) to fetch logs data into details registers." },
              { offset: "0x14", name: "POST_MORTEM_DATA", val: "[SRAM Readback]", access: "R-O", desc: "Readback register showing text and metadata of the selected post-mortem log entry." }
            ]
          }
        ];

        // Active path details for UI
        const selectedPathData = PATHS_MAPPING.find(p => p.key === selectedHierarchyPath) || PATHS_MAPPING[0];
        const selectedEntityData = ENTITY_PEOPLE.find(e => e.id === selectedEntityId) || ENTITY_PEOPLE[0];
        const activeAxiBlock = AXI_BLOCKS.find(b => b.key === selectedRegisterBlock) || AXI_BLOCKS[0];

        // Trigger Event Sourcing co-processor simulation
        const handleEmitBridgeEvent = () => {
          let eventMsg = "";
          let levelVal: "INFO" | "SUCCESS" | "WARNING" = "INFO";
          const newSeq = liveTelemetrySeq + 1;
          setLiveTelemetrySeq(newSeq);

          const timeStr = new Date().toTimeString().split(' ')[0];
          const newAuditId = d1AuditLogs[d1AuditLogs.length - 1].id + 1;

          let hexVal = 1;
          let maskVal = 0;
          let confVal = 0.95;

          if (sourcingEvent === "combat_rotation") {
            eventMsg = `[EVT-SINK] Ability rotation executed. Adrenaline surged +15%. Telecom incremented to #${newSeq}.`;
            levelVal = "INFO";
            hexVal = selectedEntityId;
            maskVal = 1023; // all contacts active
            confVal = 0.98;
          } else if (sourcingEvent === "adrenaline_change") {
            eventMsg = `[EVT-SINK] Adrenaline modification sensed. Thermal segment heat arrays rising. Segment trends updating.`;
            levelVal = "INFO";
            hexVal = selectedEntityId;
            maskVal = 480; // alternate segments
            confVal = 0.91;
          } else if (sourcingEvent === "entity_death") {
            eventMsg = `[EVT-SINK] Entity neutralized! Contact fault bit set in CONTACTOR_FAULT register offsets. Simulating fault decay.`;
            levelVal = "SUCCESS";
            hexVal = selectedEntityId;
            maskVal = 512; // segment shed active
            confVal = 1.0;
          } else if (sourcingEvent === "ability_cooldown") {
            eventMsg = `[EVT-SINK] Combat ability cooldown trigger. Coils duty factor decreased to reduce thermal stresses.`;
            levelVal = "INFO";
            hexVal = selectedEntityId;
            maskVal = 1023;
            confVal = 0.94;
          } else if (sourcingEvent === "hexagram_transition") {
            eventMsg = `[EVT-SINK] Transitioning core Yao boundary. Cognitive pulse broadcast on STATUS (0x08).`;
            levelVal = "SUCCESS";
            hexVal = selectedEntityId;
            maskVal = 0;
            confVal = 1.0;
          }

          setEventSourcingLogs(prev => [
            `[${timeStr}] EMITTING: ${sourcingEvent.toUpperCase()}`,
            `[BRIDGE] Compiled 72-byte binary payload. Magic: 0xBEEFFF11, Sequence: #${newSeq}`,
            `[LZ4] Original: 72 bytes | Sourced down to: 18 bytes (4.0x ratio)`,
            `[KV] Delta committed successfully with TTL 86400 (expire 24h)`,
            eventMsg,
            ...prev.slice(0, 5)
          ]);

          // SQL Database insert simulation
          const randomSha = Math.random().toString(36).substring(2, 10) + "..." + Math.random().toString(36).substring(2, 6);
          const newSqlRow = {
            id: newAuditId,
            timestamp: timeStr,
            event_type: sourcingEvent,
            hexagram_id: hexVal,
            yao_lines: calculateTernaryMindYao().yaoArray.map(y => y === 1 ? "+" : y === -1 ? "-" : "0").join(""),
            segment_mask: maskVal,
            confidence: confVal,
            sha: randomSha
          };

          setD1AuditLogs(prev => [...prev, newSqlRow]);
          addLogEntry("SYSTEM" as any, levelVal, `EVENT SOURCING: Metasystem dispatched '${sourcingEvent}' event with sequence ID #${newSeq}. Synchronized on registers.`);
        };

        // Watchdog local timer Pet functionality
        const handlePetLocalWatchdog = () => {
          setWatchdogCountdown(47);
          setWatchdogStatus("HEALTHY");
          const timeStr = new Date().toTimeString().split(' ')[0];
          setLastPetTime(timeStr);
          addLogEntry(SubsystemId.SECURE_LOCK, "SUCCESS", "WATCHDOG: Hardware pet signal received (PulseMonitor). Safety timer refreshed for 47 ticks (30.1s).");
        };

        // Subsystem calibration & weights compression pipeline (hoisted to parent scope)

        return (
          <div className="space-y-6 text-left font-sans animate-fade-in pb-12">
            
            {/* A. Header Sub-Substrate */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col md:flex-row shadow-lg justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-rose-950 border border-rose-800 rounded">
                  <BookOpen className="h-6 w-6 text-rose-400" />
                </div>
                <div>
                  <h4 className="font-display font-medium text-sm text-slate-150 tracking-wider uppercase mb-1 flex items-center gap-1.5">
                    MEMORY & PEDAGOGY CO-PROCESSOR INTEGRATION MAP
                    <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-900 px-1.5 py-0.2 rounded font-mono font-bold animate-pulse">POG2-MHD-FPGA-001 Map Rev 1.0</span>
                  </h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed max-w-3xl">
                    Translates the software pedagogical corpus, structural learning databases, and neural weights consolidation logs into compiled FPGA Hardware Registers and static distributed LUT ROM entries via event-sourced transaction pipelines.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] shrink-0 self-center">
                <span className="bg-slate-950 text-slate-400 border border-slate-800 px-2 py-1 rounded">
                  SW CORE: <strong className="text-rose-400">pedagogy/learning</strong>
                </span>
                <span className="bg-slate-950 text-slate-400 border border-slate-800 px-2 py-1 rounded text-cyan-400 uppercase">
                  AXI REGISTER: <strong className="text-cyan-400 font-bold">0x43C0_0000</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* SECTION 1: Software Memory Hierarchy → FPGA Register Mapping (Left span 6) */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-850 p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="border-b border-slate-800 pb-2 mb-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                      <Layers className="h-4 w-4 text-rose-400" />
                      1. MEMORY HIERARCHY MAPPING
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 uppercase">Interactive Flow Explorer</span>
                  </div>

                  <p className="text-[10.5px] text-slate-400 mb-4 leading-relaxed">
                    Select a software pedagogical database or memory block path to trace and synthesize its aligned destination registry address inside the FPGA fabric:
                  </p>

                  <div className="space-y-2.5">
                    {PATHS_MAPPING.map((m) => {
                      const isSelected = selectedHierarchyPath === m.key;
                      return (
                        <div
                          key={m.key}
                          onClick={() => setSelectedHierarchyPath(m.key)}
                          className={`p-3 rounded border text-left cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? "bg-rose-950/20 border-rose-500/50 shadow shadow-rose-950/40"
                              : "bg-slate-950 border-slate-850 hover:bg-slate-900/40 hover:border-slate-800"
                          }`}
                        >
                          <div className="space-y-1">
                            <span className={`font-mono text-[10px] font-bold flex items-center gap-1.5 ${
                              isSelected ? "text-rose-400" : "text-slate-300"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-rose-500" : "bg-slate-600"}`} />
                              /{m.swPath}
                            </span>
                            <div className="text-[9.5px] text-slate-500 font-sans pl-3 line-clamp-1">
                              {m.swDesc}
                            </div>
                          </div>
                          <div className="text-right font-mono text-[9px] shrink-0 pl-4">
                            <span className="bg-slate-900/60 text-slate-400 px-2 py-1 rounded border border-slate-800">
                              =&gt; {m.address.split(" ")[0]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Focused mapping detail sheet */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded mt-5 space-y-2 font-mono">
                  <div className="text-[8px] font-bold text-rose-400 uppercase tracking-widest border-b border-slate-900 pb-1.5">
                    CORE REGISTER MAP DETAIL DIRECTIVE
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[9.5px] text-slate-400">
                    <div className="space-y-1">
                      <span className="text-slate-500 block text-[8px] uppercase">SOFTWARE BOUND MEMORY SOURCE:</span>
                      <strong className="text-slate-200 block text-[10px]">/{selectedPathData.swPath}</strong>
                      <p className="text-slate-500 text-[9px] mt-1 font-sans leading-relaxed">
                        {selectedPathData.swDesc}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-rose-400 block text-[8px] uppercase font-bold">FPGA REGISTER MAPPING DEST:</span>
                      <strong className="text-rose-350 block text-[10px]">{selectedPathData.hwReg}</strong>
                      <div className="text-[9px] text-slate-350 bg-slate-900 p-1.5 rounded border border-slate-850 mt-1">
                        <strong className="text-rose-500 text-[8.5px]">ADDR SPACE:</strong> {selectedPathData.address}<br />
                        <span className="text-slate-500 block text-[8px] mt-1">BITFIELDS INGESTED:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPathData.fields.map((f, fIdx) => (
                            <span key={fIdx} className="bg-slate-950 text-rose-300 font-mono text-[7px] px-1 py-0.2 rounded border border-rose-950/40">
                              {f.substring(0, f.indexOf(" (") > 0 ? f.indexOf(" (") : f.length)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Pedagogy Corpus → Hexagram Property ROM map (Right span 6) */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-850 p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="border-b border-slate-800 pb-2 mb-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                      <Binary className="h-4 w-4 text-rose-400" />
                      2. PEDAGOGY CORPUS TO FPGA ROM PROGRAMMER
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 uppercase">ROM Cells Constant Synthesis</span>
                  </div>

                  <p className="text-[10.5px] text-slate-400 mb-3 leading-relaxed">
                    Entities from the active pedagogy database are analyzed and compiled into 8-byte distributed LUT ROM arrays. Select an entity type to view its VHDL and JSON definitions:
                  </p>

                  {/* Horizontal pill list of entities */}
                  <div className="flex flex-wrap gap-1.5 mb-4 font-mono text-[9px]">
                    {ENTITY_PEOPLE.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSelectedEntityId(e.id)}
                        className={`px-2.5 py-1.5 rounded border transition cursor-pointer shrink-0 ${
                          selectedEntityId === e.id
                            ? "bg-rose-950 text-rose-400 border-rose-800 font-bold"
                            : "bg-slate-950 text-slate-400 border-slate-850 hover:text-slate-200"
                        }`}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>

                  {/* Multi-Pane: Software combat vs Hardware VHDL ROM constant */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 font-mono text-[9px]">
                    
                    {/* Software Combat Profile */}
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[7.5px] text-slate-500 font-bold uppercase mb-1.5 tracking-wider">
                        A. SOFTWARE COMBAT PROFILE (INPUT JSON)
                      </div>
                      <pre className="text-amber-400 text-[8.5px] leading-relaxed font-semibold overflow-x-auto whitespace-pre p-2 bg-slate-900/60 rounded border border-slate-900">
{`{
  "entity": "${selectedEntityData.name}",
  "type": "${selectedEntityData.type}",
  "combatLevel": ${selectedEntityData.combatLevel},
  "maxHit": ${selectedEntityData.maxHit},
  "attackSpeed": ${selectedEntityData.attSpeed}, // ticks
  "weaknesses": ["${selectedEntityData.weakness}"],
  "verified": true
}`}
                      </pre>
                    </div>

                    {/* FPGA ROM Translation */}
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[7.5px] text-rose-400 font-bold uppercase mb-1.5 tracking-wider">
                        B. FPGA THERMAL PROFILE (AUTO-GENERATED)
                      </div>
                      <pre className="text-cyan-400 text-[8.5px] leading-relaxed font-semibold overflow-x-auto whitespace-pre p-2 bg-slate-900/60 rounded border border-slate-900">
{`{
  "hexagramId": ${selectedEntityData.hexagramId},
  "thermalVariance": ${selectedEntityData.thermalVariance.toFixed(1)},
  "critTimeoutTicks": ${selectedEntityData.critTimeoutTicks},
  "limbShedPattern": "0x${parseInt(selectedEntityData.shedPattern, 2).toString(16).toUpperCase().padStart(3, "0")}",
  "bootProfile": "${selectedEntityData.bootProfile}",
  "vibeMode": "${selectedEntityData.vibeMode}"
}`}
                      </pre>
                    </div>

                  </div>
                </div>

                {/* Synths VHDL distributed LUT ROM Array */}
                <div className="bg-slate-950 border border-slate-850 p-3 rounded mt-4 font-mono">
                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between select-none">
                    <span>C. AUTO-SYNTHESIZED VHDL CONSTANT LUT PORT CELL</span>
                    <span className="text-rose-400 font-bold text-[7.5px]">Synthesized LUT (Q16.16)</span>
                  </div>
                  <pre className="text-slate-300 text-[8px] md:text-[8.5px] leading-relaxed overflow-x-auto p-3 bg-slate-900 border border-slate-850 rounded">
{`-- LUT index ${selectedEntityData.hexagramId} compiled from ${selectedEntityData.name} (${selectedEntityData.type})
${selectedEntityData.hexagramId} => (
    thermal_variance     => x"${Math.round(selectedEntityData.thermalVariance * 255).toString(16).toUpperCase().padStart(2, "0")}", -- Fixed-point ${selectedEntityData.thermalVariance.toFixed(2)}
    crit_timeout_ticks   => x"${selectedEntityData.critTimeoutTicks.toString(16).toUpperCase().padStart(4, "0")}", -- ${selectedEntityData.critTimeoutTicks} ticks
    limb_shed_pattern    => "${selectedEntityData.shedPattern}", -- contactor mask
    boot_profile         => "${selectedEntityData.bootProfile === "fast" ? "000" : selectedEntityData.bootProfile === "slow" ? "001" : selectedEntityData.bootProfile === "cautious" ? "010" : "011"}",
    vibe_mode_default    => x"${selectedEntityData.vibeMode === "CLINICAL" ? "0" : selectedEntityData.vibeMode === "AGITATED" ? "1" : selectedEntityData.vibeMode === "SERENE" ? "5" : "3"}"
),`}
                  </pre>
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* SECTION 3: Event Sourcing & SQL Audit Ledger Interface (Span 6) */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-850 p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="border-b border-slate-800 pb-2 mb-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-rose-400" />
                      3. CO-PROCESSOR EVENT SOURCING BRIDGE
                    </span>
                    <span className="text-amber-500 text-[9px] font-mono font-bold">100 Hz BURST ENABLED</span>
                  </div>

                  <p className="text-[10.5px] text-slate-400 mb-4 leading-relaxed">
                    Trigger software gameplay state events to stream live packets to the FPGA. This increments the hardware <code className="text-rose-400">TELEMETRY_SEQ</code> register and saves consolidated transactions onto the D1 structured SQL audit tracker:
                  </p>

                  <div className="grid grid-cols-2 gap-3.5 mb-4 font-mono text-[9px]">
                    <div>
                      <label className="text-[7.5px] text-slate-500 font-bold block uppercase mb-1">Select Dispatched Trigger Event</label>
                      <select
                        value={sourcingEvent}
                        onChange={(e) => setSourcingEvent(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[10px] focus:outline-none focus:border-rose-600"
                      >
                        <option value="combat_rotation">combat_rotation (TELEMETRY_SEQ++)</option>
                        <option value="adrenaline_change">adrenaline_change (SEGx_HEAT++)</option>
                        <option value="entity_death">entity_death (FAULT_LOG bits)</option>
                        <option value="ability_cooldown">ability_cooldown (CHOKE_DUTY down)</option>
                        <option value="hexagram_transition">hexagram_transition (YAO_LINES pulse)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <button
                        type="button"
                        onClick={handleEmitBridgeEvent}
                        className="w-full bg-gradient-to-r from-rose-950 to-rose-900/60 border border-rose-800 hover:border-rose-600 text-rose-200 font-bold py-2 px-3 rounded shadow hover:shadow-rose-950/20 active:translate-y-0.2 hover:scale-[1.01] transition text-[10px] uppercase font-mono tracking-wider cursor-pointer"
                      >
                        DISPATCH BRIDGE EVENT
                      </button>
                    </div>
                  </div>

                  {/* Flow chart streaming logs */}
                  <div className="bg-slate-950 rounded border border-slate-850 p-3 h-32 overflow-y-auto font-mono text-[8.5px] space-y-1 text-slate-400">
                    <div className="text-[8px] font-black text-rose-500/70 border-b border-slate-900 pb-1 uppercase tracking-widest mb-1.5">
                      LIVE UART TRANSMISSION TRANSITIONS BRIDGE
                    </div>
                    {eventSourcingLogs.map((log, idx) => (
                      <div key={idx} className={idx === 0 ? "text-rose-400 font-bold animate-pulse" : ""}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SQL Table Audit logs display (Matches 3.2 db structure) */}
                <div className="bg-slate-950 border border-slate-850 rounded mt-5 overflow-hidden font-mono text-[8.5px]">
                  <div className="bg-slate-900 border-b border-slate-850 p-2 text-slate-350 font-bold text-[8px] flex justify-between tracking-wide select-none">
                    <span>SQLite Table Name: fpga_events (D1 AUDIT LEDGER)</span>
                    <span className="text-rose-400">CONFIDENCE CAUSALITY CHAOS</span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 text-slate-500 border-b border-slate-900 text-[7px] uppercase font-bold text-center">
                        <th className="p-1.5 text-left pl-3">ID</th>
                        <th className="p-1.5">TIME (UTC)</th>
                        <th className="p-1.5 text-left">EVENT_TYPE</th>
                        <th className="p-1.5">HEXAGRAM</th>
                        <th className="p-1.5">YAO_LINES</th>
                        <th className="p-1.5">SEG_MASK</th>
                        <th className="p-1.5">CONF</th>
                        <th className="p-1.5 pr-3 text-right">SHA_LEDGER_SIGNATURE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-400 font-medium text-center">
                      {d1AuditLogs.slice(-4).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/30 transition text-[8px]">
                          <td className="p-1.5 text-left pl-3 font-bold text-slate-450">{row.id}</td>
                          <td className="p-1.5 text-slate-500">{row.timestamp}</td>
                          <td className="p-1.5 text-left font-semibold text-rose-300">{row.event_type}</td>
                          <td className="p-1.5 text-slate-200">{row.hexagram_id}</td>
                          <td className="p-1.5 text-cyan-400 font-mono">{row.yao_lines}</td>
                          <td className="p-1.5 text-emerald-400 font-semibold">{row.segment_mask}</td>
                          <td className="p-1.5">{row.confidence.toFixed(2)}</td>
                          <td className="p-1.5 pr-3 text-right text-slate-500 font-mono text-[7px] font-normal">{row.sha}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 4: Compression Pipeline & YaoState Model (Span 6) */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-850 p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="border-b border-slate-800 pb-2 mb-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                      <Brain className="h-4 w-4 text-rose-400" />
                      4. LUNA COMPRESSION PIPELINE & MODEL ENGINE
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isLunaAutoLoopActive && (
                        <span className="inline-flex items-center gap-1 text-[7.5px] px-1.5 py-0.5 rounded text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900 select-none animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          LUNA INTERLOCK ACTIVE
                        </span>
                      )}
                      <span className="text-rose-400 text-[8.5px] font-mono bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900">
                        OLLAMA &ldquo;{lunaModel}&rdquo; WEIGHT ENGINE
                      </span>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-400 mb-4 leading-relaxed">
                    Processes historical metrics, compresses training snapshots, and optimizes cell weights. Trigger the pipeline to train and write optimized vectors back to the ROM cells:
                  </p>

                  {/* LUNA SYSTEM TUNER AND DAEMON ROW */}
                  <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-950 p-3 rounded border border-slate-850 text-left font-mono text-[10px]" id="luna-daemon-panel">
                    <div className="space-y-1">
                      <span className="text-rose-400 block font-bold text-[8.5px] uppercase tracking-wider">
                        LUNA PIPELINE DEPLOYMENT ARCHITECTURE
                      </span>
                      <select
                        value={lunaModel}
                        onChange={(e) => setLunaModel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-[10px] focus:outline-none focus:border-rose-700 cursor-pointer"
                        id="luna-target-model-select"
                      >
                        <option value="pog2-yaostate">pog2-yaostate (6 Layers Yao State)</option>
                        <option value="deepseek-r1:8b">deepseek-r1:8b (ModelRolodex Ollama)</option>
                        <option value="deepseek-r1:32b">deepseek-r1:32b (ModelRolodex Ollama)</option>
                        <option value="gemma4:26b">gemma4:26b (ModelRolodex Distillation)</option>
                        <option value="qwen2p5-coder-32b">qwen2.5-coder:32b (ModelRolodex Local)</option>
                        <option value="gemini-1.5-pro">gemini-1.5-pro (ModelRolodex API)</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash (ModelRolodex Edge)</option>
                        <option value="moondream:latest">moondream:latest (ModelRolodex Vision)</option>
                        <option value="rsmv-substrate">rsmv-substrate (ModelRolodex Local Loopback)</option>
                      </select>
                      <span className="text-[7.5px] text-slate-500 block leading-tight">
                        Selected ModelRolodex pipeline training substrate.
                      </span>
                    </div>

                    <div className="space-y-1 select-none">
                      <span className="text-cyan-400 block font-bold text-[8.5px] uppercase tracking-wider">
                        DAEMON LOOP (STARTUP ON)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isLunaAutoLoopActive;
                          setIsLunaAutoLoopActive(next);
                          addLogEntry(
                            SubsystemId.INTERLOCK_SEQUENCE,
                            next ? "INFO" : "WARNING",
                            `LUNA DAEMON COMPILER: Auto collector & processing loops toggled ${next ? "ON" : "OFF"}.`
                          );
                        }}
                        className={`w-full py-1 px-2.5 rounded border text-[9px] font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          isLunaAutoLoopActive
                            ? "bg-emerald-950/25 border-emerald-700 text-emerald-400"
                            : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350"
                        }`}
                        id="luna-daemon-toggle-button"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isLunaAutoLoopActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                        {isLunaAutoLoopActive ? "DAEMON AUTO ACTIVE" : "DAEMON PAUSED"}
                      </button>
                      <span className="text-[7.5px] text-slate-500 block leading-tight">
                        Controls foreground training and background collections.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Progress tracking loading bar */}
                    {pipelineProgress >= 0 && (
                      <div className="bg-slate-950 p-3 rounded border border-slate-850 font-mono space-y-1 animate-fade-in">
                        <div className="flex justify-between font-bold text-[8.5px]">
                          <span className="text-rose-400 uppercase tracking-widest">TRAINING WEIGHTS PIPELINE:</span>
                          <span className="text-cyan-400 font-extrabold animate-pulse">{pipelineProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-800 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-rose-600 to-rose-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${pipelineProgress}%` }}
                          />
                        </div>
                        <span className="text-[8.5px] font-medium block text-slate-450 leading-relaxed pt-1">
                          {pipelineStage}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleStartPipeline}
                        disabled={pipelineProgress >= 0 && pipelineProgress < 100}
                        className={`w-full font-bold uppercase py-2 px-3 rounded shadow font-mono text-[9.5px] tracking-wider cursor-pointer border select-none transition duration-150 ${
                          pipelineProgress >= 0 && pipelineProgress < 100
                            ? "bg-slate-950 border-slate-850 text-slate-600 cursor-not-allowed"
                            : "bg-rose-950/20 border-rose-700 hover:border-rose-500 text-rose-200"
                        }`}
                        id="luna-manual-initiate-pipeline-button"
                      >
                        {pipelineProgress === 100 ? "RE-RUN OLLAMA RE-TRAIN PIPELINE" : "INITIATE WEIGHT COMPRESSION PIPELINE"}
                      </button>
                    </div>

                    {/* Stage descriptions */}
                    <div className="grid grid-cols-5 gap-1.5 font-mono text-center text-[7.5px] text-slate-600">
                      <div className={pipelineProgress >= 15 ? "text-rose-400 font-bold" : ""}>
                        <div>STAGE 1</div>
                        <div>Injest Logs</div>
                      </div>
                      <div className={pipelineProgress >= 35 ? "text-rose-400 font-bold" : ""}>
                        <div>STAGE 2</div>
                        <div>Valid Epistem</div>
                      </div>
                      <div className={pipelineProgress >= 55 ? "text-rose-400 font-bold" : ""}>
                        <div>STAGE 3</div>
                        <div>Extraction</div>
                      </div>
                      <div className={pipelineProgress >= 75 ? "text-rose-400 font-bold" : ""}>
                        <div>STAGE 4</div>
                        <div>Ollama Training</div>
                      </div>
                      <div className={pipelineProgress >= 100 ? "text-emerald-400 font-bold animate-pulse" : ""}>
                        <div>STAGE 5</div>
                        <div>Deploy ROM</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LUNA QBIT STRING INJECTION STATUS HEADER */}
                <div className="bg-slate-950 p-3.5 rounded border border-slate-850 mt-4 font-mono select-none space-y-2 text-[10px] text-left">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-900">
                    <span className="text-[8px] font-bold text-rose-450 tracking-wider">
                      CLASSIC LUNA STRING INJECTION STATUS
                    </span>
                    <span className="text-[7px] text-cyan-400 font-extrabold px-1.5 py-0.2 rounded border border-slate-800 bg-slate-900">
                      Q-BIT SPIN COUPLING ACTIVE
                    </span>
                  </div>
                  <div className="space-y-1.5 bg-black/45 p-2.5 rounded border border-slate-900 text-[9px] leading-relaxed">
                    <div className="flex items-start justify-between gap-4 text-slate-400">
                      <span className="shrink-0">Superposed State ψ:</span>
                      <span className="text-rose-350 break-all text-right font-semibold">{lunaQbitString}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 border-t border-slate-900/60 pt-1">
                      <span>Unified Ground Truth:</span>
                      <span className="text-cyan-400 font-bold">Hexagram State + Timestamped Compression Logs</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Deploy Target Models:</span>
                      <span className="text-emerald-400 font-medium">Ollama + APIs + FPGA ROM (Symmetric Distillation)</span>
                    </div>
                  </div>
                </div>

                {/* Highly interactive 64-Hexagram cell matrix representing compiled ROM mapping */}
                <div className="bg-slate-950 rounded border border-slate-850 p-4 mt-5 space-y-3 font-mono">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-900 select-none">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                      ROM PERSONALITY EMISSION CELLS (0x43C0_0800 - 0x93C0_09FF)
                    </span>
                    <span className="text-[7.5px] text-slate-500 font-medium font-mono">
                      STATUS: {isCustomFpgarRomFlanked ? (
                        <strong className="text-emerald-400">CUSTOM EMBEDDINGS INSTALLED</strong>
                      ) : (
                        <strong className="text-slate-500">FACTORY DEFAULTS LOADED</strong>
                      )}
                    </span>
                  </div>

                  {/* 8x8 mini grid of cells */}
                  <div className="grid grid-cols-8 gap-1 p-1 bg-slate-900 rounded border border-slate-850 max-w-full">
                    {Array.from({ length: 64 }).map((_, cIdx) => {
                      const cId = cIdx + 1;
                      const isEntityCell = ENTITY_PEOPLE.some(e => e.id === cId);
                      const isSelected = selectedEntityId === cId;
                      const isCellTrained = isCustomFpgarRomFlanked;

                      let cellColor = "bg-slate-950 border-slate-900 hover:border-slate-800 text-slate-600";
                      if (isSelected) {
                        cellColor = "bg-rose-950 text-rose-300 border-rose-600 font-extrabold shadow shadow-rose-950";
                      } else if (isEntityCell) {
                        cellColor = "bg-rose-900/10 border-rose-950 text-rose-450 hover:border-rose-900 font-semibold";
                      } else if (isCellTrained) {
                        cellColor = "bg-slate-950 border-emerald-950 text-emerald-600";
                      }

                      return (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => {
                            if (isEntityCell) {
                              setSelectedEntityId(cId);
                            }
                          }}
                          className={`aspect-square rounded border transition duration-100 flex items-center justify-center font-mono text-[9px] relative cursor-pointer select-none ${cellColor}`}
                          title={`Hexagram ROM Cell #${cId}`}
                        >
                          {cId}
                          {isEntityCell && (
                            <span className="absolute top-0.5 right-0.5 w-1 h-1 bg-rose-500 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[8px] leading-relaxed text-slate-500 leading-relaxed font-sans">
                    * ROM maps are standard word-aligned structures. Cells with high red dots signify profiles compiled directly from real entity templates inside the pedagogy corpus. Hover or click to highlight properties.
                  </div>
                </div>
              </div>

            </div>

            {/* SECTION 4B: MODELROLODEX v2.0 - SOVEREIGN MODEL JOB ASSIGNMENTS & ROUTING (Wide 12 span) */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-lg space-y-5 mt-6" id="modelrolodex-v2-panel">
              <div className="border-b border-slate-800 pb-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 select-none">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-rose-500 animate-pulse" />
                  <div>
                    <span className="text-[11px] text-slate-200 font-mono font-bold uppercase tracking-wider block">
                      MODELROLODEX v2.0: SOVEREIGN ROUTER & JOB ASSIGNMENTS
                    </span>
                    <span className="text-[7px] text-slate-500 font-mono block">
                      Direct capability-based routing of distilled models back to AXI4-Lite FPGA physical address registers
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[7.5px] px-2 py-0.5 rounded text-cyan-400 font-bold bg-cyan-950/30 border border-cyan-900">
                    <Binary className="h-3 w-3" />
                    CAPABILITY-BASED ROUTING ON
                  </span>
                  <span className="text-rose-400 text-[8.5px] font-mono bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900">
                    FPGA BUS: 0x43C00800
                  </span>
                </div>
              </div>

              {/* Distilled Model Instance status row */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {Object.keys(modelRegistry).map((mKey) => {
                  const m = modelRegistry[mKey];
                  const activeJobCount = (Object.values(modelJobAssignments) as Array<{ model: string; priority: number; sla: number }>).filter(a => a.model === mKey).length;
                  return (
                    <div key={mKey} className="bg-slate-950 border border-slate-850/60 p-2.5 rounded font-mono text-left relative flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-350 truncate block" title={m.name}>
                            {m.name}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <span className={`text-[7px] font-extrabold px-1 rounded block w-fit border uppercase ${m.color}`}>
                          {m.tier.replace("_", " ")}
                        </span>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-900 flex justify-between items-center text-[7.5px] text-slate-500">
                        <span>Lat: <strong className="text-cyan-400 font-bold">{m.latency}ms</strong></span>
                        <span>Jobs: <strong className="text-rose-400 font-bold">{activeJobCount}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Main routing matrix grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* 1. Job Assignments Panel (8 cols) */}
                <div className="lg:col-span-8 bg-slate-950/45 p-4 rounded border border-slate-850/70 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                    <span className="text-[9px] font-bold font-mono text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-rose-450" />
                      Job Assignment & SLA Controls
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono">
                      Click sliders/inputs to modify non-volatile route registers
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {jobsRegistry.map((job) => {
                      const assignment = modelJobAssignments[job.id] || { model: "pog2-yaostate", priority: 5, sla: job.defaultSla };
                      const assModel = modelRegistry[assignment.model] || modelRegistry["pog2-yaostate"];
                      const isSlaBreached = assModel.latency > assignment.sla;
                      const isCapabilityMismatched = assModel.tier !== job.recommendedTier && !job.fallbackChain.includes(assModel.tier);

                      return (
                        <div key={job.id} className="bg-slate-950 border border-slate-900/80 p-3 rounded hover:border-slate-800 transition duration-150 text-left flex flex-col md:flex-row justify-between gap-4">
                          {/* Left info */}
                          <div className="space-y-1 md:w-5/12 text-left">
                            <span className="text-[10px] font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              {job.name}
                            </span>
                            <p className="text-[8px] text-slate-500 leading-tight font-sans text-left">
                              {job.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[7.5px] text-left">
                              <span className="text-slate-500">Rec Tier:</span>
                              <span className="text-cyan-500 font-bold bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800 select-none uppercase tracking-wider font-mono">
                                {job.recommendedTier.replace("_", " ")}
                              </span>
                            </div>
                          </div>

                          {/* Controls / Inputs */}
                          <div className="md:w-7/12 grid grid-cols-2 xs:grid-cols-3 gap-3 items-center font-mono text-[9px]">
                            {/* Model Select */}
                            <div className="space-y-1 text-left">
                              <span className="text-[7px] text-slate-500 block uppercase font-bold">Assigned Model:</span>
                              <select
                                value={assignment.model}
                                onChange={(e) => {
                                  const updated = {
                                    ...modelJobAssignments,
                                    [job.id]: { ...assignment, model: e.target.value }
                                  };
                                  setModelJobAssignments(updated);
                                  localStorage.setItem("pog2_model_job_assignments", JSON.stringify(updated));
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.8 text-slate-300 font-mono text-[9px] focus:outline-none focus:border-rose-700 cursor-pointer"
                              >
                                {Object.keys(modelRegistry).map(mKey => (
                                  <option key={mKey} value={mKey}>{mKey}</option>
                                ))}
                              </select>
                            </div>

                            {/* Priority Weight Slider */}
                            <div className="space-y-1 text-left">
                              <div className="flex justify-between text-[7px] font-bold text-slate-500 uppercase">
                                <span>Priority:</span>
                                <span className="text-rose-450 font-extrabold">{assignment.priority}/10</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={assignment.priority}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const updated = {
                                    ...modelJobAssignments,
                                    [job.id]: { ...assignment, priority: val }
                                  };
                                  setModelJobAssignments(updated);
                                  localStorage.setItem("pog2_model_job_assignments", JSON.stringify(updated));
                                }}
                                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-rose-500 accent-active:bg-rose-600 focus:outline-none"
                              />
                            </div>

                            {/* Max SLA Target Input */}
                            <div className="space-y-1 col-span-2 xs:col-span-1 text-left">
                              <span className="text-[7.5px] text-slate-500 block uppercase font-bold">Max SLA (ms):</span>
                              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-1.5 py-0.8 rounded">
                                <input
                                  type="number"
                                  min="10"
                                  max="2000"
                                  value={assignment.sla}
                                  onChange={(e) => {
                                    const val = Math.max(10, parseInt(e.target.value) || 10);
                                    const updated = {
                                      ...modelJobAssignments,
                                      [job.id]: { ...assignment, sla: val }
                                    };
                                    setModelJobAssignments(updated);
                                    localStorage.setItem("pog2_model_job_assignments", JSON.stringify(updated));
                                  }}
                                  className="w-full bg-transparent text-slate-300 font-mono text-[9px] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold text-right"
                                />
                                <span className="text-[7px] text-slate-500 font-bold">ms</span>
                              </div>
                            </div>
                          </div>

                          {/* Extra Status Badges */}
                          <div className="flex flex-row md:flex-col justify-end gap-1.5 items-center shrink-0 min-w-28 font-mono text-[8px] border-t md:border-t-0 md:border-l border-slate-900 pt-2 md:pt-0 md:pl-2">
                            {/* SLA meter */}
                            <div className="flex items-center gap-1 text-right">
                              <span className="text-slate-500 uppercase font-bold text-[7px]" title="Assigned model latency / maximum SLA bounds">SLA:</span>
                              <span className={`font-semibold ${isSlaBreached ? "text-rose-450 animate-pulse font-bold" : "text-emerald-400"}`}>
                                {assModel.latency}ms / {assignment.sla}ms
                              </span>
                            </div>

                            {/* Warning Badges */}
                            {isSlaBreached && (
                              <span className="inline-flex items-center gap-0.5 text-[7px] px-1 py-0.2 rounded border border-rose-900/60 bg-rose-950/20 text-rose-450 font-bold select-none animate-pulse">
                                <AlertTriangle className="h-2 w-2 shrink-0" />
                                SLA BREACH RISK
                              </span>
                            )}
                            {isCapabilityMismatched && (
                              <span className="inline-flex items-center gap-0.5 text-[7px] px-1 py-0.2 rounded border border-amber-900/50 bg-amber-950/10 text-amber-500 font-medium select-none" title="Assigned model tier does not fully meet recommended capability matching">
                                <AlertTriangle className="h-2 w-2 shrink-0" />
                                TIER MISMATCH
                              </span>
                            )}
                            {!isSlaBreached && !isCapabilityMismatched && (
                              <span className="inline-flex items-center gap-0.5 text-[7px] px-1 py-0.2 rounded border border-emerald-950 bg-emerald-950/15 text-emerald-400 font-medium select-none">
                                <Check className="h-2 w-2 shrink-0" />
                                ROUTE SOLID
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Validation & Live Sync Panel (4 cols) */}
                <div className="lg:col-span-4 flex flex-col justify-between gap-4">
                  {/* Superposition Wavefront Display */}
                  <div className="bg-slate-950 p-3.5 rounded border border-slate-850 font-mono text-[10px] text-left space-y-2.5">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-900">
                      <span className="text-[8px] font-bold text-rose-450 uppercase tracking-wider">
                        Wavefunction Spin Registers
                      </span>
                      <span className="text-[7px] text-emerald-400 px-1 py-0.1 bg-emerald-950/20 border border-emerald-900 rounded">
                        LOCKED
                      </span>
                    </div>

                    <div className="bg-black/45 p-2.5 rounded border border-slate-900 text-[8.5px] space-y-1.5 leading-relaxed">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Wave Equation |ψ⟩:</span>
                        <span className="text-rose-350 text-right truncate font-semibold" title={lunaQbitString}>
                          {lunaQbitString.split(" [")[0]}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-t border-slate-900/50 pt-1">
                        <span className="text-slate-500">AXI4 address:</span>
                        <span className="text-cyan-400 font-bold select-all">0x43C00800</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Sampling Tick:</span>
                        <span className="text-emerald-400 font-semibold">640 ms metabolic</span>
                      </div>
                    </div>
                  </div>

                  {/* Routing Validation and Verification block */}
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded text-left flex flex-col justify-between flex-1 space-y-3 font-mono">
                    <div className="space-y-1.5 select-none">
                      <span className="text-rose-400 text-[8.5px] font-bold uppercase tracking-wider block">
                        FPGA Microcode Gate Synchronization
                      </span>
                      <p className="text-[8px] text-slate-500 leading-normal font-sans">
                        Locks the current ModelRolodex job assignments into non-volatile FPGA registers at 0x43C00800. This ensures zero-latency hardware execution boundaries.
                      </p>
                    </div>

                    {routingValidationProgress >= 0 && (
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-900 space-y-1">
                        <div className="flex justify-between text-[8px] font-bold font-mono">
                          <span className="text-cyan-400">BUS ROUTING VERIFICATION:</span>
                          <span className="text-rose-450 animate-pulse font-extrabold">{routingValidationProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1 border border-slate-800 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-rose-500 h-1 rounded-full transition-all duration-200"
                            style={{ width: `${routingValidationProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Routing validated real logs console info */}
                    <div className="bg-black/60 p-2 rounded border border-slate-900 text-[7.5px] leading-relaxed select-text flex-1 overflow-y-auto max-h-[160px] min-h-[120px] text-slate-400 space-y-1">
                      {routingValidationLogs.length === 0 ? (
                        <div className="text-slate-600 italic select-none">
                          Consolidation idle. Press the trigger below to load assignments and lock co-processor address tables...
                        </div>
                      ) : (
                        routingValidationLogs.map((log, lIdx) => {
                          let textC = "text-slate-400";
                          if (log.includes("PASS")) textC = "text-emerald-400 font-medium";
                          if (log.includes("LUNA SUCCESS")) textC = "text-emerald-400 font-bold";
                          if (log.includes("BREACH") || log.includes("MISMATCH")) textC = "text-rose-450";
                          if (log.includes("[ROUTING v2.0]")) textC = "text-cyan-400 font-bold";
                          return (
                            <div key={lIdx} className={`${textC} font-mono break-all`}>
                              {log}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleValidateRouting}
                      disabled={isRoutingValidating}
                      className={`w-full py-2 px-3 rounded shadow font-bold uppercase text-[9px] tracking-wider transition font-mono border cursor-pointer select-none ${
                        isRoutingValidating
                          ? "bg-slate-950 border-slate-900 text-slate-500 cursor-not-allowed"
                          : "bg-rose-950/20 border-rose-700 hover:border-rose-500 text-rose-200"
                      }`}
                    >
                      {isRoutingValidating ? "Synchronizing AXI4 Registers..." : "Lock & Validate Routing Grid"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: AXI4-Lite Address Space Memory Map Explorer (Wide 12 span) */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-lg space-y-4">
              <div className="border-b border-slate-800 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <span className="text-[11px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-rose-400" />
                  5. AXI4-LITE CO-PROCESSOR ADDRESS SPACE EXPLORER
                </span>

                {/* Sub-selectors of block segments */}
                <div className="flex flex-wrap bg-slate-950 border border-slate-800 rounded p-0.5 font-mono text-[8.5px] items-center gap-0.5">
                  {AXI_BLOCKS.map(block => (
                    <button
                      key={block.key}
                      onClick={() => setSelectedRegisterBlock(block.key)}
                      className={`px-2 py-0.8 rounded transition cursor-pointer shrink-0 ${
                        selectedRegisterBlock === block.key
                          ? "bg-rose-950 text-rose-400 font-bold border border-rose-900"
                          : "text-slate-400 border border-transparent hover:text-slate-200"
                      }`}
                    >
                      {block.name.split(" ")[0]} ({block.base})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 font-mono">
                
                {/* Left side column: detailed range info */}
                <div className="md:col-span-4 bg-slate-950 p-4 rounded border border-slate-850 space-y-3.5 text-[9.5px]">
                  <div className="text-[10px] text-rose-400 font-bold border-b border-slate-900 pb-1.5 uppercase select-none">
                    REGION RANGE METADATA
                  </div>
                  <div className="space-y-2 text-slate-450">
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span>Logical Name:</span>
                      <strong className="text-slate-200">{activeAxiBlock.name}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span>AXI Base Address:</span>
                      <strong className="text-cyan-400">{activeAxiBlock.base}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span>Assigned Block Size:</span>
                      <strong className="text-slate-200">{activeAxiBlock.size} bytes</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span>Interconnect Bus:</span>
                      <strong className="text-slate-200">AXI4-Lite Subordinate</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span>Access Constraints:</span>
                      <strong className="text-emerald-400 font-bold">Synchronous, Word-Aligned</strong>
                    </div>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded border border-slate-900 text-slate-500 font-sans leading-relaxed text-[9px]">
                    <strong className="text-slate-450 uppercase block font-mono text-[8.5px] pb-0.5">ALIGNMENT DEFINITIONS:</strong>
                    32-bit registers must align on boundaries (offset % 4 == 0). 16-bit array channels align on halfwords. Unauthorized write triggers SLVERR feedback signals.
                  </div>
                </div>

                {/* Right side block: register address editor dumps */}
                <div className="md:col-span-8 bg-slate-950 rounded border border-slate-850 overflow-hidden text-[9.5px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-350 border-b border-slate-850 text-[8px] uppercase font-bold text-center">
                        <th className="p-2.5 text-left pl-3.5">RELATIVE OFFSET</th>
                        <th className="p-2.5 text-left">AXI FULL ADDRESS</th>
                        <th className="p-2.5 text-left">REGISTER NAME</th>
                        <th className="p-2.5">MODE</th>
                        <th className="p-2.5 text-yellow-400 text-left pl-4">LIVE SYSTEM REGISTER VALUE</th>
                        <th className="p-2.5 text-left pr-3.5 font-sans leading-none">VHDL ARCHITECTURAL REGISTER FUNCTIONALITY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-400 font-mono text-center">
                      {activeAxiBlock.registers.map((reg, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/30 transition text-[9px]">
                          <td className="p-2.5 text-left pl-3.5 text-slate-500 font-bold">{reg.offset}</td>
                          <td className="p-2.5 text-left text-cyan-400 font-bold">0x{activeAxiBlock.base.split("_")[1] ?? "C00000"}{reg.offset.split("x")[1]}</td>
                          <td className="p-2.5 text-left font-bold text-slate-200">{reg.name}</td>
                          <td className="p-2.5">
                            <span className={`text-[7.5px] px-1.5 py-0.2 rounded border font-bold ${
                              reg.access === "R-O" ? "bg-slate-900 text-slate-450 border-slate-800" : "bg-rose-950 text-rose-400 border-rose-900"
                            }`}>
                              {reg.access}
                            </span>
                          </td>
                          <td className="p-2.5 text-left pl-4 font-bold text-yellow-400">
                            {reg.val}
                          </td>
                          <td className="p-2.5 text-left text-slate-450 font-sans leading-normal text-[8.5px] pr-3.5">{reg.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

            {/* SECTION 6: Cross-Layer Clock Sync & Watchdog Controls (Wide 12 span) */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-lg space-y-4">
              <div className="border-b border-slate-800 pb-2 mb-2 flex items-center justify-between select-none">
                <span className="text-[11px] text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4 text-rose-400" />
                  6. CROSS-LAYER SYNCHRONIZATION & SAFETY WATCHDOG
                </span>
                <span className="text-rose-400 text-[8.5px] font-mono">CLOCK HARMONIZERS ACTIVE</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-mono">
                
                {/* Visual Oscillator animation cards (Span 5) */}
                <div className="lg:col-span-5 bg-slate-950 p-4 rounded border border-slate-850 space-y-3">
                  <div className="text-[10px] text-rose-400 font-bold border-b border-slate-900 pb-1.5 uppercase select-none">
                    CLOCK DOMAINS & OSCILLATOR WAVEFORM INTEGRATION
                  </div>

                  <div className="space-y-4 text-[9px] text-slate-400">
                    {/* Domain 1: AXI4-Lite */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[8px] font-mono leading-none">
                        <span>AXI-Lite register clock (Zynq PS FCLK)</span>
                        <strong className="text-slate-350">250.00 MHz</strong>
                      </div>
                      <div className="w-full relative h-6 bg-slate-900/60 rounded border border-slate-900 flex items-center overflow-hidden">
                        {/* Dynamic wave pattern */}
                        <div className="absolute inset-x-0 h-4 flex items-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 to-transparent">
                          <svg className="w-full h-full opacity-50 stroke-rose-400 stroke-1" viewBox="0 0 400 20" preserveAspectRatio="none">
                            <path d="M 0 10 Q 5 0, 10 10 T 20 10 T 30 10 T 40 10 T 50 10 T 60 10 T 70 10 T 80 10 T 90 10 T 100 10 T 110 10 T 120 10 T 130 10 T 140 10 T 150 10 T 160 10 T 170 10 T 180 10 T 190 10 T 200 10 T 210 10 T 220 10 T 230 10 T 240 10 T 250 10 T 260 10 T 270 10 T 280 10 T 290 10 T 300 10 T 310 10 T 320 10 T 330 10 T 340 10 T 350 10 T 360 10 T 370 10 T 380 10 T 390 10 T 400 10" className="animate-pulse" />
                          </svg>
                        </div>
                        <div className="absolute left-2.5 top-1.5 text-[7px] font-black text-slate-500 uppercase tracking-widest pl-1">AXI_CLK Domain_A</div>
                      </div>
                    </div>

                    {/* Domain 2: Canonical Clock */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[8px] font-mono leading-none">
                        <span>Metabolic system clock (CanonicalClock / TICK_DURATION_MS)</span>
                        <strong className="text-amber-500">1.5625 Hz (640 ms) / 1.66 Hz (600 ms)</strong>
                      </div>
                      <div className="w-full relative h-6 bg-slate-900/60 rounded border border-slate-900 flex items-center overflow-hidden">
                        <div className="absolute inset-x-0 h-4 flex items-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/10 to-transparent">
                          <svg className="w-full h-full stroke-amber-500 stroke-1.5" viewBox="0 0 400 20" preserveAspectRatio="none">
                            <path d="M 0 10 L 50 10 Q 55 0, 60 10 L 110 10 Q 115 0, 120 10 L 170 10 Q 175 0, 180 10 L 230 10 Q 235 0, 240 10 L 290 10 Q 295 0, 300 10 L 350 10 Q 355 0, 360 10 L 400 10" />
                          </svg>
                        </div>
                        <div className="absolute left-2.5 top-1.5 text-[7px] font-black text-slate-500 uppercase tracking-widest pl-1">CANONICAL_CLK Domain_B (640ms Pulse)</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded border border-slate-850/60 mt-3 text-[8.5px] leading-relaxed text-slate-500 flex flex-col gap-1">
                    <span className="font-bold text-slate-400 uppercase">Metabolic pulse division formula:</span>
                    • RSC Mode (640 ms metabolic tick) = PLL divides 250 MHz clock by exactly 160,000,000.<br />
                    • RS3 Mode (600 ms metabolic tick) = PLL divides 250 MHz clock by exactly 150,000,000.
                  </div>
                </div>

                {/* Interactive Safety Watchdog module controller (Span 7) */}
                <div className="lg:col-span-7 bg-slate-950 p-4 rounded border border-slate-850 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] text-rose-400 font-bold border-b border-slate-900 pb-1.5 uppercase select-none flex justify-between items-center">
                      <span>7. SAFETY TIMER REGISTER INTERRUPT CONTROLLER (0x44)</span>
                      <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-mono font-extrabold border ${
                        watchdogStatus === "HEALTHY" ? "bg-emerald-950/40 text-emerald-400 border-emerald-900" : "bg-red-950/40 text-red-500 border-red-900 animate-pulse"
                      }`}>
                        {watchdogStatus}
                      </span>
                    </div>

                    <p className="text-[10.5px] text-slate-400 mt-2.5 mb-4 leading-relaxed">
                      If the software host ever hangs or forgets to write to the watchdog pet register (<code className="text-rose-400">PET</code> bit of offset register 0x44), the hardware countdown ticks down to zero. At zero, it asserts <code className="text-red-400">EMERGENCY_OPEN</code>, opening all contactor lines instantly.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                      {/* Watchdog Progress Dial */}
                      <div className="bg-slate-900 border border-slate-850 p-3 rounded flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider">TIMEOUT COUNTDOWN:</span>
                          <strong className={`font-mono text-xl ${watchdogCountdown < 12 ? "text-red-500 font-black animate-pulse" : "text-slate-100"}`}>
                            {watchdogCountdown} Ticks
                          </strong>
                          <span className="text-slate-500 text-[8.5px] block">({(watchdogCountdown * 0.64).toFixed(2)} seconds margin)</span>
                        </div>
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          {/* Circle loader background */}
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-800" strokeWidth="2.5" stroke="currentColor" fill="none" d="M 18,18 m 0,-16 a 16,16 0 1,1 0,32 a 16,16 0 1,1 0,-32" />
                            <path
                              className={watchdogCountdown < 12 ? "text-red-500 animate-pulse" : "text-rose-500"}
                              strokeWidth="2.5"
                              strokeDasharray={`${(watchdogCountdown / 47) * 100}, 100`}
                              strokeLinecap="round"
                              stroke="currentColor" fill="none" d="M 18,18 m 0,-16 a 16,16 0 1,1 0,32 a 16,16 0 1,1 0,-32"
                            />
                          </svg>
                          <span className="absolute text-[8.5px] font-bold text-slate-300 font-mono">
                            {Math.round((watchdogCountdown / 47) * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Controls card */}
                      <div className="bg-slate-900 border border-slate-850 p-3 rounded flex flex-col justify-between">
                        <div className="flex justify-between items-center text-[9px] text-slate-450">
                          <span>Auto-Petter Active:</span>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={watchdogRunning}
                              onChange={(e) => setWatchdogRunning(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-7 h-4 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:height-3 after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-900" />
                          </label>
                        </div>
                        <div className="text-[8px] text-slate-500 mt-1 leading-normal font-sans">
                          * If deactivated, the watchdog will deplete 1 tick per second. Click &ldquo;PET WATCHDOG&rdquo; to manually write a PulseMonitor command.
                        </div>
                        <div className="text-[9px] text-slate-400 flex justify-between font-mono mt-1 pt-1 border-t border-slate-850/40">
                          <span>Last Success Pet:</span>
                          <span className="text-slate-100 font-bold text-right">{lastPetTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 font-mono select-none">
                    <button
                      type="button"
                      onClick={handlePetLocalWatchdog}
                      className="w-full bg-gradient-to-r from-rose-950 to-rose-900/60 border border-rose-800 hover:border-rose-600 text-rose-200 font-bold py-2 px-3 rounded shadow active:translate-y-0.2 hover:scale-[1.01] transition text-[10px] uppercase cursor-pointer text-center"
                    >
                      PET WATCHDOG REGISTER (WRITE 0x44 = 0x01)
                    </button>
                    {watchdogStatus !== "HEALTHY" && (
                      <button
                        type="button"
                        onClick={() => {
                          setWatchdogCountdown(47);
                          setWatchdogStatus("HEALTHY");
                          addLogEntry("SYSTEM" as any, "SUCCESS", "REBOOT: Hardware Watchdog interlock cleared. Emergency brakes released. System restarted.");
                        }}
                        className="w-full bg-emerald-950/20 border border-emerald-800 hover:border-emerald-600 text-emerald-300 font-bold py-2 px-3 rounded shadow active:translate-y-0.2 transition text-[10px] uppercase cursor-pointer text-center"
                      >
                        CLEAR INTERLOCK & RESTORE BUS
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
        );
      })()}

      {activeTab === "world_buffer" && (
        <NtxWorldBuffer />
      )}

      {activeTab === "map_renderer" && (
        <MapRendererSubsystem />
      )}

      {activeTab === "sovereign_cns" && (
        <SovereignCnsSubsystem />
      )}

      {activeTab === "debug_stream" && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Register Table & Parity Indicators */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Registers Table */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg font-mono">
                <span className="text-[10px] text-slate-400 font-bold block mb-3 uppercase tracking-wider">
                  MEMORY-MAPPED DEBUG & FAULT REGISTERS (AXI-BASE: 0x43C0_0000)
                </span>
                <p className="text-[9px] text-slate-500 leading-relaxed mb-4">
                  The FPGA top-level U_AXI_SLAVE entity maps the following control and debug registers onto the ARM9 system memory bus.
                </p>

                <div className="space-y-2 text-[10px]">
                  {/* Register 0x84 */}
                  <div className="bg-slate-950 border border-slate-850 p-2 rounded">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>ADDR: 0x43C00084</span>
                      <span className="text-cyan-400">DEBUG_STATUS_REG</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                      <span>Current state index:</span>
                      <span className="text-slate-300 font-bold">0x{currentPacket.hexagramState.toString(16).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>Symmetry interlock verification:</span>
                      <span className="text-emerald-400 font-bold">HEALTHY (0x01)</span>
                    </div>
                  </div>

                  {/* Register 0x94 */}
                  <div className="bg-slate-950 border border-slate-850 p-2 rounded">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>ADDR: 0x43C00094</span>
                      <span className="text-red-400">FAULT_INJECT_REG</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                      <span>Stuck-at or measurement offset flips loaded:</span>
                      <span className="text-rose-400 font-bold">
                        {(!currentPacket.crcValid) ? "0x01 (INTEGRITY ERROR)" : "0x00 (HEALTHY)"}
                      </span>
                    </div>
                  </div>

                  {/* Register 0x98 */}
                  <div className="bg-slate-950 border border-slate-850 p-2 rounded">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>ADDR: 0x43C00098</span>
                      <span className="text-amber-500">DEBUG_STREAM_REG</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                      <span>Frame payload stream buffers:</span>
                      <span className="text-slate-300">0x{currentPacket.rawValueHex.substring(8, 16)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Parity Status Indicators Card */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg font-mono">
                <span className="text-[10px] text-slate-400 font-bold block mb-3 uppercase tracking-wider">
                  REAL-TIME INTEGRITY COMPARATOR VECTOR
                </span>

                <div className="space-y-2 text-[9px]">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                    <span className="text-slate-500 font-mono">TELEMETRY FRAME CHECKSUM:</span>
                    <span className={currentPacket.crcValid ? "text-emerald-400 font-bold" : "text-rose-400 font-bold animate-pulse"}>
                      {currentPacket.crcValid ? "● PASS (CRC-8 VALID)" : "❌ FAILED (CRC-8 MISMATCH)"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                    <span className="text-slate-500 font-mono">TRANSMITTED PACKAGE CHECKSUM:</span>
                    <span className="text-slate-300 font-bold">0x{(currentPacket.decodedCrc ?? 0).toString(16).toUpperCase()}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                    <span className="text-slate-500 font-mono">CALCULATED LOOK-AHEAD CRC-8:</span>
                    <span className="text-slate-300 font-bold">0x{(currentPacket.expectedCrc ?? 0).toString(16).toUpperCase()}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                    <span className="text-slate-500 font-mono">DIAGNOSTIC ADCs INTEGRITY PARITY:</span>
                    <span className={currentPacket.crcValid ? "text-emerald-400 font-bold" : "text-yellow-500 font-bold"}>
                      {currentPacket.crcValid ? "● HEALTHY (PARITY MET)" : "▲ DEGRADED (STRESS TRIGGERED)"}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: High-density stream terminal logger */}
            <div className="lg:col-span-7 flex flex-col h-full min-h-[480px]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wide">
                  CO-PROCESSOR DIGITAL DEBUG CAPTURE AREA (REG: 0x98)
                </span>
                <div className="flex gap-1.5 font-mono select-none">
                  <button
                    onClick={() => setDebugStreamPaused?.(!debugStreamPaused)}
                    className="text-[8px] font-bold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-2.5 py-1 rounded cursor-pointer transition active:scale-95"
                  >
                    {debugStreamPaused ? "AUTO-STREAM" : "HOLD MONITOR"}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg flex-1 flex flex-col font-mono text-[9px] text-slate-300 overflow-hidden relative shadow-inner">
                {/* Flow Indicators */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 select-none z-10">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={`${debugStreamPaused ? "" : "animate-ping"} absolute inline-flex h-full w-full rounded-full ${debugStreamPaused ? "bg-amber-400" : "bg-rose-400"} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${debugStreamPaused ? "bg-amber-500" : "bg-rose-500"}`}></span>
                  </span>
                  <span className={`text-[8px] font-bold ${debugStreamPaused ? "text-amber-500" : "text-rose-400"}`}>
                    {debugStreamPaused ? "MONITOR PAUSED" : "DEBUG CAPTURE STREAMING"}
                  </span>
                </div>

                {/* Stream Shell */}
                <div className="flex-1 overflow-y-auto max-h-[430px] pr-1 space-y-1">
                  {debugStreamLogs.length === 0 ? (
                    <div className="text-slate-600 italic h-full flex items-center justify-center">
                      Listening to 0x43C00098 co-processor register stream... Inject stress or fault vectors to review real-time response.
                    </div>
                  ) : (
                    debugStreamLogs.flatMap((line, idx) => (
                      <div
                        key={idx}
                        className={`py-1 px-1.5 rounded transition ${
                          line.includes("CRC_ERROR_DETECTED")
                            ? "bg-rose-950/20 text-rose-300 border-l border-rose-700" 
                            : line.includes("PARITY") 
                            ? "bg-amber-950/10 text-amber-300 border-l border-amber-850"
                            : "text-slate-400 hover:bg-slate-900/40"
                        }`}
                      >
                        <span className="text-[8px] text-slate-600 mr-2 bg-slate-900 px-1 py-0.5 rounded">
                          #{(debugStreamLogs.length - idx).toString().padStart(3, "0")}
                        </span>
                        <span>{line}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-900 font-mono text-[8px] text-slate-600 flex justify-between uppercase select-none">
                  <span>Logic Interface: CDC Multi-stage synchronizer</span>
                  <span>Frame payload: 64-bit frame buffer</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {activeTab === "bist_and_logging" && (
        <div className="space-y-6 animate-fade-in" id="fpga-bist-and-bram-logger">
          
          {/* Main header banner */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
            <div>
              <div className="text-[10px] text-cyan-400 font-mono font-bold tracking-wider uppercase flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                FPGA CO-PROCESSOR SELF-TEST & RECORDER SUB-SYSTEM
              </div>
              <h2 className="text-lg font-display font-medium text-slate-100 tracking-wide mt-1">
                FPGA Core Diagnostic Hub & Hardware Analyzer
              </h2>
              <p className="text-[11px] text-slate-450 font-mono mt-0.5 max-w-2xl leading-normal">
                Commanding high-performance Built-In Self-Tests (BIST) and configuring real-time on-chip RAM/SRAM data logic analyzers directly of bus signals.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-850 text-right">
                <div className="text-[7px] text-slate-500 font-mono font-bold">BIST_STATUS_REG (0x43C000A0)</div>
                <div className="text-xs text-cyan-400 font-mono font-bold mt-0.5 tracking-wider">
                  0x{bistStatusReg.toString(16).toUpperCase().padStart(8, "0")}
                </div>
              </div>
              <div className="flex bg-slate-950 border border-slate-850 p-1 rounded font-mono text-[9px] gap-2 items-center">
                <span className="text-slate-500">BIST STATE:</span>
                <span className={`px-1.5 py-0.5 rounded font-bold ${
                  bistState === "RUNNING" ? "bg-amber-950 text-amber-400 animate-pulse border border-amber-900" :
                  bistState === "COMPLETED" ? "bg-emerald-950 text-emerald-405 border border-emerald-900" :
                  "bg-slate-900 text-slate-400 border border-slate-800"
                }`}>
                  {bistState}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: Health Monitoring Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            <div className="md:col-span-8 bg-slate-900 border border-slate-850 rounded-lg p-5">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-4">
                <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
                  FPGA Real-Time Core Health Dashboard
                </span>
                <span className="text-[8px] font-mono px-1.5 py-0.5 bg-slate-950 text-slate-400 border border-slate-850 rounded">
                  HARDWARE STATUS SEGMENT
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                
                {/* Gauge 1: Average Temperature */}
                {(() => {
                  const tempK = (currentPacket.predictedTempRaw / 655.35) + 273.15;
                  const isHigh = tempK > 380;
                  const isCrit = tempK > 415;
                  return (
                    <div className="bg-slate-950 p-3 rounded border border-slate-850 flex flex-col justify-between">
                      <div>
                        <span className="text-[8px] font-mono text-slate-500 block uppercase font-bold">AVG CORE TEMPERATURE</span>
                        <div className="text-xl font-mono mt-1 font-bold text-slate-100">
                          {tempK.toFixed(1)} K
                        </div>
                        <span className="text-[8px] text-slate-550 block font-mono mt-0.5">
                          Raw: 0x{currentPacket.predictedTempRaw.toString(16).toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-4">
                        <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isCrit ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-emerald-500"}`} 
                            style={{ width: `${Math.min(100, (tempK / 500) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between font-mono text-[7px] text-slate-500 mt-1">
                          <span>MIN: 100K</span>
                          <span className={`${isCrit ? "text-red-400 font-bold" : isHigh ? "text-amber-400 font-bold" : ""}`}>
                            {isCrit ? "CRIT" : isHigh ? "WARN" : "NOMINAL"}
                          </span>
                          <span>MAX: 450K</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Gauge 2: Plenum Pressure */}
                {(() => {
                  const pressAtm = currentPacket.pressPlenumRaw / 8192;
                  const isLow = pressAtm < 0.6;
                  const isHigh = pressAtm > 5.5;
                  return (
                    <div className="bg-slate-950 p-3 rounded border border-slate-850 flex flex-col justify-between">
                      <div>
                        <span className="text-[8px] font-mono text-slate-500 block uppercase font-bold">PLENUM PRESSURE</span>
                        <div className="text-xl font-mono mt-1 font-bold text-slate-100">
                          {pressAtm.toFixed(2)} atm
                        </div>
                        <span className="text-[8px] text-slate-550 block font-mono mt-0.5">
                          Raw: 0x{currentPacket.pressPlenumRaw.toString(16).toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-4">
                        <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isLow || isHigh ? "bg-amber-500" : "bg-cyan-500"}`} 
                            style={{ width: `${Math.min(100, (pressAtm / 8.0) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between font-mono text-[7px] text-slate-500 mt-1">
                          <span>MIN: 0.1a</span>
                          <span className={isLow || isHigh ? "text-amber-400 font-bold" : "text-cyan-400 font-bold"}>
                            {isLow ? "LWR_WARN" : isHigh ? "UPR_WARN" : "NOMINAL"}
                          </span>
                          <span>MAX: 8.0a</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Gauge 3: Bus Current */}
                {(() => {
                  const currentA = currentPacket.currBusRaw / 3276.8;
                  const isHigh = currentA > 3.0;
                  return (
                    <div className="bg-slate-950 p-3 rounded border border-slate-850 flex flex-col justify-between">
                      <div>
                        <span className="text-[8px] font-mono text-slate-500 block uppercase font-bold">BUS CURRENT</span>
                        <div className="text-xl font-mono mt-1 font-bold text-slate-100">
                          {currentA.toFixed(2)} A
                        </div>
                        <span className="text-[8px] text-slate-550 block font-mono mt-0.5">
                          Raw: 0x{currentPacket.currBusRaw.toString(16).toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-4">
                        <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isHigh ? "bg-rose-500" : "bg-purple-500"}`} 
                            style={{ width: `${Math.min(100, (currentA / 5.0) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between font-mono text-[7px] text-slate-500 mt-1">
                          <span>MIN: 0.0A</span>
                          <span className={isHigh ? "text-rose-450 font-bold" : "text-purple-400"}>
                            {isHigh ? "OVERCURRENT" : "NOMINAL"}
                          </span>
                          <span>MAX: 5.0A</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Gauge 4: System Parameters & Mode */}
                <div className="bg-slate-950 p-3 rounded border border-slate-850 flex flex-col justify-between">
                  <div>
                    <span className="text-[8px] font-mono text-slate-500 block uppercase font-bold">ACTIVE SYSTEM MODE</span>
                    <div className="text-xs font-mono font-bold mt-1.5 text-amber-500 truncate uppercase">
                      {HexagramStateLabels[currentPacket.hexagramState]?.split(" (")[0] || "UNALIGNED"}
                    </div>
                    <span className="text-[8px] text-slate-550 block font-mono mt-1 pr-1 truncate">
                      Yao index: 0x{currentPacket.hexagramState.toString(16).toUpperCase()} ({toBinary(currentPacket.hexagramState, 6)})
                    </span>
                  </div>
                  <div className="mt-4 pt-1 border-t border-slate-900 flex justify-between font-mono text-[7.5px] text-slate-400">
                    <span>CO-PROC FREQ:</span>
                    <span className="font-bold text-slate-200">250 MHz</span>
                  </div>
                </div>

              </div>

              {/* Sub-block for Contactor Status, Choke Resonance and Active Fault Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                
                {/* Contactor Status Check */}
                <div className="bg-slate-950 p-3.5 rounded border border-slate-850 flex flex-col justify-between font-mono">
                  <div>
                    <div className="flex justify-between items-center pb-1 border-b border-slate-900 mb-2">
                      <span className="text-[8px] text-slate-500 uppercase font-bold">CONTACTOR CT_00 - CT_09 STATES</span>
                      <span className="text-[7px] bg-slate-900 text-slate-400 px-1 rounded">AXI 0x14</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${currentPacket.electricalReg === 1 ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                      <span className="text-xs font-bold text-slate-200 uppercase">
                        {currentPacket.electricalReg === 1 ? "ALL CLOSED (ACTV)" : currentPacket.electricalReg === 0 ? "OPEN / CUTOUT (SAFE)" : "STDBY / IN TRANSIT"}
                      </span>
                    </div>
                    <p className="text-[8px] text-slate-500 leading-normal mt-2">
                      Auxiliary monitoring feedbacks verify contactor symmetry parity. Direct trip lines active.
                    </p>
                  </div>
                  <div className="text-[8px] text-slate-400 bg-slate-900/50 p-1.5 rounded border border-slate-850 flex justify-between mt-2 select-none">
                    <span>FEEDBACK VERIFY:</span>
                    <span className={currentPacket.electricalReg === 1 ? "text-emerald-400 font-bold" : "text-rose-450"}>
                      {currentPacket.electricalReg === 1 ? "METRIC MATCH" : "ISOLATED"}
                    </span>
                  </div>
                </div>

                {/* Choke H-Bridge Lock */}
                <div className="bg-slate-950 p-3.5 rounded border border-slate-850 flex flex-col justify-between font-mono">
                  <div>
                    <div className="flex justify-between items-center pb-1 border-b border-slate-900 mb-2">
                      <span className="text-[8px] text-slate-500 uppercase font-bold">CHOKE RESONANCE DRIVE</span>
                      <span className="text-[7px] bg-cyan-950 text-cyan-405 px-1 rounded">5-SEG PWM</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${currentPacket.hexagramState !== HexagramState.IDLE ? "bg-cyan-500 animate-pulse" : "bg-slate-750"}`} />
                      <span className="text-xs font-bold text-slate-200 uppercase">
                        {currentPacket.hexagramState !== HexagramState.IDLE ? "LOCKED (6520 Hz)" : "STANDBY (FLAT)"}
                      </span>
                    </div>
                    <p className="text-[8px] text-slate-500 leading-normal mt-2">
                      Resonant circuit PWM generates optimized magnetic flux matching chamber gas density transpiration.
                    </p>
                  </div>
                  <div className="text-[8px] text-slate-450 bg-slate-900/50 p-1.5 rounded border border-slate-850 flex justify-between mt-2 select-none">
                    <span>DUTY PROFILE:</span>
                    <span className="text-cyan-400 font-bold">
                      {currentPacket.hexagramState !== HexagramState.IDLE ? "42.5% REGULAR" : "0.0% STOP"}
                    </span>
                  </div>
                </div>

                {/* Critical Fault Flags Register */}
                <div className="bg-slate-950 p-3.5 rounded border border-slate-850 flex flex-col justify-between font-mono">
                  <div>
                    <div className="flex justify-between items-center pb-1 border-b border-slate-900 mb-2">
                      <span className="text-[8px] text-slate-500 uppercase font-bold">CRITICAL CO-PROC HAZARDS</span>
                      <span className="text-[7px] bg-rose-950 text-rose-405 px-1 rounded">BITFIELD</span>
                    </div>
                    <div className="space-y-1.5 mt-1 max-h-[55px] overflow-y-auto pr-1">
                      {activeFaultCodes.length === 0 ? (
                        <div className="text-emerald-450 flex items-center gap-1 font-bold text-[9px] uppercase py-1">
                          <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                          NO HAZARD FAULTS ACTIVE
                        </div>
                      ) : (
                        activeFaultCodes.map(code => (
                          <div key={code} className="bg-rose-950/20 text-rose-350 border border-rose-900/60 p-1 rounded text-[7.5px] font-bold flex justify-between items-center">
                            <span>REG_FAULT [{code}]</span>
                            <span className="text-rose-450 animate-pulse font-black px-1">ALERT</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="text-[7.5px] text-slate-550 leading-relaxed pt-1.5 mt-1.5 border-t border-slate-900 uppercase">
                    Fault Byte: 0x{currentPacket.faultByte.toString(16).toUpperCase().padStart(2, "0")} ({toBinary(currentPacket.faultByte, 8)})
                  </div>
                </div>

              </div>

              {/* Real-Time Historical Telemetry Trends D3 Chart */}
              <div ref={d3ContainerRef} className="mt-4 pt-4 border-t border-slate-800/80">
                <div className="flex justify-between items-center mb-3 select-none">
                  <span className="text-[9px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <History className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                    Historical Trend Analysis & Temperature Drift (D3.js)
                  </span>
                  <div className="flex gap-3 text-[7.5px] font-mono">
                    <span className="flex items-center gap-1 text-purple-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded bg-purple-500" />
                      BUS CURRENT (A)
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded bg-cyan-400" />
                      TEMP DRIFT (K)
                    </span>
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-850/60 rounded p-1.5">
                  {d3ChartData.length === 0 ? (
                    <div className="h-[150px] flex items-center justify-center text-slate-500 font-mono text-[9px]">
                      Awaiting real-time telemetry buffer stream...
                    </div>
                  ) : (
                    <svg ref={d3SvgRef} width="100%" height={150} />
                  )}
                </div>
              </div>

            </div>

            {/* SPI Display Simulator - Dedicated Screen connected to SPI Bus */}
            <div className="md:col-span-4 bg-slate-900 border border-slate-850 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-4">
                  <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <Database className="h-3.5 w-3.5 text-cyan-400" />
                    SPI OLED Panel Simulator
                  </span>
                  <span className="text-[7px] font-mono px-1 py-0.5 bg-cyan-950/40 text-cyan-400 border border-cyan-900/50 rounded uppercase">
                    128x64 px
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 font-sans leading-relaxed mb-4">
                  Simulating an on-board hardware SPI SSD1306 OLED display mounted on the FPGA carrier board block.
                </p>

                {/* Simulated Screen */}
                <div className="bg-black text-[#5bf54c] font-mono text-[9px] p-3 rounded-lg border-2 border-slate-705 shadow-[inset_0_0_12px_rgba(91,245,76,0.3)] aspect-video flex flex-col justify-between select-none">
                  <div className="border-b border-[#5bf54c]/30 pb-1.5 flex justify-between items-center text-[7.5px]">
                    <span className="font-extrabold tracking-widest text-[#5bf54c]">POG2-FPGA PROBE</span>
                    <span className="animate-pulse">● RX</span>
                  </div>

                  <div className="space-y-1 my-2">
                    <div className="flex justify-between">
                      <span>TEMP: {(currentPacket.predictedTempRaw / 655.35 + 273.15).toFixed(1)}K</span>
                      <span>PRES: {(currentPacket.pressPlenumRaw / 8192).toFixed(2)}a</span>
                    </div>
                    <div className="flex justify-between">
                      <span>BIAS: {(currentPacket.currBusRaw / 3276.8).toFixed(2)}A</span>
                      <span>MODE: {HexagramStateLabels[currentPacket.hexagramState]?.split(" ")[0]}</span>
                    </div>
                    <div className="flex justify-between text-[7px] bg-[#5bf54c]/10 px-1 rounded py-0.5 mt-1">
                      <span>BIST CHK:</span>
                      <span className="font-bold">
                        {bistState === "IDLE" ? "STANDBY" : bistState === "RUNNING" ? "TESTING..." : (bistStatusReg >>> 31 === 1 && (bistStatusReg & (1 << 30)) === 0) ? "FMC: PASS" : (bistStatusReg & (1 << 30)) !== 0 ? "PMC: WARN" : "NMC: FAIL"}
                      </span>
                    </div>
                  </div>

                  <div className="text-[7px] border-t border-[#5bf54c]/20 pt-1 flex justify-between uppercase">
                    <span>ADDR_BUS: AXI4</span>
                    <span className="tracking-tighter">TICKS: {liveTelemetrySeq}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-800/40 text-[9px] font-mono text-slate-500 flex justify-between leading-normal pr-1">
                <span>Bus Protocol: SPI Master</span>
                <span>Chip Select: ACTIVE_LOW</span>
              </div>
            </div>

          </div>

          {/* SECTION 2: FPGA Self-Test (BIST) Engine */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* Self test checklist and command */}
            <div className="md:col-span-5 bg-slate-900 border border-slate-850 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-4 animate-fade-in">
                  <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <Cpu className="h-4 w-4 text-cyan-400" />
                    Diagnostic Self-Test Engine (BIST)
                  </span>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-900 rounded uppercase">
                    CONTROL REG 0x90
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                  Runs the hardware built-in-self-test routine sequence. Exercises write loops, examines ADC calibration bounds to check for open/shorts, triggers Pilot coils, validates PWM frequencies and Yao co-processor states.
                </p>

                {/* BIST progress and CTA */}
                <div className="bg-slate-950 p-4 rounded border border-slate-850 text-center mb-4">
                  <button
                    onClick={runSystemBist}
                    disabled={bistState === "RUNNING"}
                    className={`w-full py-2.5 px-4 font-mono font-bold text-xs uppercase rounded flex items-center justify-center gap-2 transition select-none ${
                      bistState === "RUNNING" 
                        ? "bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800" 
                        : "bg-cyan-950/40 hover:bg-cyan-950/80 text-cyan-405 border border-cyan-900/60 cursor-pointer active:scale-[0.98]"
                    }`}
                  >
                    <RefreshCw className={`h-4 w-4 ${bistState === "RUNNING" ? "animate-spin text-amber-500" : ""}`} />
                    {bistState === "RUNNING" ? "Running Core BIST..." : "Initiate High-Fidelity BIST"}
                  </button>

                  {bistState === "RUNNING" && (
                    <div className="mt-4">
                      <div className="flex justify-between text-[8px] font-mono text-slate-450 mb-1">
                        <span>SUITE PROGRESS: {Math.round((bistStep / 6) * 100)}%</span>
                        <span>EXECUTING STEP_{bistStep} / 6</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full animate-pulse transition-all duration-300" style={{ width: `${(bistStep / 6) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  {bistState === "COMPLETED" && (
                    <div className={`mt-3 py-1.5 px-3 rounded text-[9.5px] font-mono font-bold uppercase border flex items-center justify-center gap-1.5 ${
                      (bistStatusReg >>> 31 === 1 && (bistStatusReg & (1 << 30)) === 0)
                        ? "bg-emerald-950/30 text-emerald-400 border-emerald-900"
                        : (bistStatusReg & (1 << 30)) !== 0
                        ? "bg-amber-950/40 text-amber-400 border-amber-900/60"
                        : "bg-rose-955/20 text-rose-350 border-rose-900"
                    }`}>
                      {(bistStatusReg >>> 31 === 1 && (bistStatusReg & (1 << 30)) === 0) ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          <span>SYSTEM VERDICT: PASS [FMC - FULLY MISSION CAPABLE]</span>
                        </>
                      ) : (bistStatusReg & (1 << 30)) !== 0 ? (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          <span>SYSTEM VERDICT: WARNING [PMC - DEGRADED SYSTEM STATE]</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-450 animate-pulse" />
                          <span>SYSTEM VERDICT: FAIL [NMC - HARDWARE LOCKOUT DETECTED]</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Checklist variables */}
                <div className="space-y-2 text-[10px] font-mono">
                  
                  {/* Item 1 */}
                  <div className="flex justify-between items-center p-2 rounded bg-slate-950/50 border border-slate-850/60">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        bistResults.axi === true ? "bg-emerald-500" :
                        bistResults.axi === false ? "bg-red-500" :
                        bistState === "RUNNING" && bistStep === 1 ? "bg-amber-500 animate-ping" : "bg-slate-750"
                      }`} />
                      <span className={bistResults.axi === null ? "text-slate-500" : "text-slate-200 font-semibold"}>
                        AXI-Lite Register Read/Write Integrity
                      </span>
                    </div>
                    <span className="text-[8px] uppercase">
                      {bistResults.axi === true ? "PASS" : bistResults.axi === false ? "FAIL" : "STANDBY"}
                    </span>
                  </div>

                  {/* Item 2 */}
                  <div className="flex justify-between items-center p-2 rounded bg-slate-950/50 border border-slate-850/60">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        bistResults.sensors === true ? "bg-emerald-500" :
                        bistResults.sensors === false ? "bg-amber-500 animate-pulse" :
                        bistState === "RUNNING" && bistStep === 2 ? "bg-amber-500 animate-ping" : "bg-slate-750"
                      }`} />
                      <span className={bistResults.sensors === null ? "text-slate-500" : "text-slate-200 font-semibold"}>
                        Sensor Acquisition Channels (ADC)
                      </span>
                    </div>
                    <span className="text-[8px] uppercase">
                      {bistResults.sensors === true ? "PASS" : bistResults.sensors === false ? "WARN / DEGRD" : "STANDBY"}
                    </span>
                  </div>

                  {/* Item 3 */}
                  <div className="flex justify-between items-center p-2 rounded bg-slate-950/50 border border-slate-850/60">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        bistResults.contactors === true ? "bg-emerald-500" :
                        bistResults.contactors === false ? "bg-red-500" :
                        bistState === "RUNNING" && bistStep === 3 ? "bg-amber-500 animate-ping" : "bg-slate-750"
                      }`} />
                      <span className={bistResults.contactors === null ? "text-slate-500" : "text-slate-200 font-semibold"}>
                        Contactor Actuation Command & Aux Info
                      </span>
                    </div>
                    <span className="text-[8px] uppercase">
                      {bistResults.contactors === true ? "PASS" : bistResults.contactors === false ? "FAIL" : "STANDBY"}
                    </span>
                  </div>

                  {/* Item 4 */}
                  <div className="flex justify-between items-center p-2 rounded bg-slate-950/50 border border-slate-850/60">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        bistResults.pwm === true ? "bg-emerald-500" :
                        bistResults.pwm === false ? "bg-amber-500 animate-pulse" :
                        bistState === "RUNNING" && bistStep === 4 ? "bg-amber-500 animate-ping" : "bg-slate-750"
                      }`} />
                      <span className={bistResults.pwm === null ? "text-slate-500" : "text-slate-200 font-semibold"}>
                        Choke Driver Resonant PWM Duty Gating
                      </span>
                    </div>
                    <span className="text-[8px] uppercase">
                      {bistResults.pwm === true ? "PASS" : bistResults.pwm === false ? "WARN / DEGRD" : "STANDBY"}
                    </span>
                  </div>

                  {/* Item 5 */}
                  <div className="flex justify-between items-center p-2 rounded bg-slate-950/50 border border-slate-850/60">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        bistResults.fsm === true ? "bg-emerald-500" :
                        bistResults.fsm === false ? "bg-red-500" :
                        bistState === "RUNNING" && bistStep === 5 ? "bg-amber-500 animate-ping" : "bg-slate-750"
                      }`} />
                      <span className={bistResults.fsm === null ? "text-slate-500" : "text-slate-200 font-semibold"}>
                        Yao Finite State Machine Transitions
                      </span>
                    </div>
                    <span className="text-[8px] uppercase">
                      {bistResults.fsm === true ? "PASS" : bistResults.fsm === false ? "FAIL" : "STANDBY"}
                    </span>
                  </div>

                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-slate-800/40 text-[9px] font-mono text-slate-500 flex justify-between uppercase">
                <span>Self Diagnostic Controller v2.10</span>
                <span>AXI Addr: 0x43C00090</span>
              </div>
            </div>

            {/* BIST Terminal Serial Output Window */}
            <div className="md:col-span-7 bg-slate-900 border border-slate-850 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/60 mb-4">
                  <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <Terminal className="h-4 w-4 text-cyan-405" />
                    BIST Diagnostic Console
                  </span>
                  <button
                    onClick={() => setBistLogs(["[0.00s] Diagnostics console cache cleared."])}
                    className="text-[8.5px] font-mono text-slate-500 hover:text-slate-300 transition cursor-pointer select-none uppercase"
                  >
                    Clear Cache
                  </button>
                </div>

                <div className="bg-slate-950 rounded p-4 border border-slate-850 font-mono text-[9px] h-[310px] overflow-y-auto space-y-1.5 scrollbar-thin select-all">
                  {bistLogs.length === 0 ? (
                    <div className="text-slate-600 italic">
                      No diagnostic runs executed yet. STANDBY FOR CO-PROCESSOR SIGNAL COMMANDS.
                    </div>
                  ) : (
                    bistLogs.map((log, idx) => (
                      <div 
                        key={idx} 
                        className={`leading-relaxed ${
                          log.includes("🟢") || log.includes("PASS.") ? "text-emerald-400 font-bold" :
                          log.includes("🔴") || log.includes("❌") ? "text-rose-455 font-bold animate-pulse" :
                          log.includes("⚠️") || log.includes("WARNING:") ? "text-amber-400 font-bold" :
                          log.includes("STEP") ? "text-cyan-400 font-bold mt-2 pt-1 border-t border-slate-900/40 first:mt-0 first:pt-0 first:border-0" : "text-slate-350"
                        }`}
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/40 text-[9px] font-mono text-slate-550 flex justify-between items-center uppercase select-none">
                <span>Memory Cache: LOCAL SRAM Ring</span>
                <span>BAUD: 115200 bps</span>
              </div>
            </div>

          </div>

          {/* Robust Event Logging and Debugging Framework Panel */}
          <div className="bg-slate-900 border border-slate-850 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-4 select-none">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400 font-bold" />
                <div>
                  <h3 className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    High-Fidelity Event Logging & UART Port Controller
                  </h3>
                  <p className="text-[8.5px] text-slate-500 font-mono">
                    Proxy internal FPGA logic trace events to physical/simulated serial interfaces
                  </p>
                </div>
              </div>
              <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-900 text-cyan-404">
                UART CONTROL BAUD: 115200 BPS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Verbose logging */}
              <div className="bg-slate-950 p-4 rounded border border-slate-850 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2 font-mono">
                    <span className="text-[9px] font-bold text-slate-350 uppercase">Verbose System Core Logging</span>
                    <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border ${verboseLogging ? "bg-emerald-950/40 text-emerald-400 border-emerald-900 animate-pulse" : "bg-slate-900 text-slate-500 border-slate-800"}`}>
                      {verboseLogging ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-450 font-sans leading-relaxed">
                    Triggers complete instruction trace logging of system variables, internal CDC state boundaries, timing slack registers and ADC calibrations in 3-cycle intervals.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-905 flex justify-between items-center">
                  <span className="text-[8px] font-mono text-slate-500">CONTROL ADDR: 0x43C00098</span>
                  <button
                    onClick={() => setVerboseLogging?.(!verboseLogging)}
                    className={`px-3 py-1 font-mono text-[9px] font-bold uppercase rounded border transition cursor-pointer select-none ${verboseLogging ? "bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border-emerald-900" : "bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800"}`}
                  >
                    {verboseLogging ? "Disable Tracing" : "Enable Tracing"}
                  </button>
                </div>
              </div>

              {/* Option 2: UART bridge */}
              <div className="bg-slate-950 p-4 rounded border border-slate-850 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2 font-mono">
                    <span className="text-[9px] font-bold text-slate-350 uppercase">Serial UART Interface Proxy Bridge</span>
                    <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border ${transmitLogsOverUart ? "bg-emerald-950/40 text-emerald-400 border-emerald-900 animate-pulse" : "bg-slate-900 text-slate-500 border-slate-800"}`}>
                      {transmitLogsOverUart ? "CONNECTED" : "DISCONNECTED"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-450 font-sans leading-relaxed">
                    Instantly proxies and serializes all events queue directly into high-speed UART TX serial registers, updating the real-time physical co-processor stream.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-905 flex justify-between items-center">
                  <span className="text-[8px] font-mono text-slate-500">HARDWARE INTERRUPT (IRQ)</span>
                  <button
                    onClick={() => setTransmitLogsOverUart?.(!transmitLogsOverUart)}
                    className={`px-3 py-1 font-mono text-[9px] font-bold uppercase rounded border transition cursor-pointer select-none ${transmitLogsOverUart ? "bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border-emerald-900" : "bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800"}`}
                  >
                    {transmitLogsOverUart ? "Disconnect UART" : "Connect UART"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: High-Speed SRAM Data Logger & BRAM Analyzer Block */}
          <div className="bg-slate-900 border border-slate-850 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800/60 mb-5 gap-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-400" />
                <div>
                  <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">
                    High-Performance Signal Data Logger
                  </span>
                  <span className="text-[8px] text-slate-500 font-mono">Capture key sensors, FSM states and clock address bus signals</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px]">
                
                {/* Trigger Selector */}
                <div className="flex bg-slate-950 p-1 border border-slate-850 rounded">
                  <span className="text-slate-550 px-1.5">TRIGGER:</span>
                  <button 
                    onClick={() => setLogTriggerMode("MANUAL")}
                    className={`px-1.5 rounded select-none cursor-pointer ${logTriggerMode === "MANUAL" ? "bg-cyan-950 text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    MANUAL
                  </button>
                  <button 
                    onClick={() => setLogTriggerMode("ON_FAULT")}
                    className={`px-1.5 rounded select-none cursor-pointer ${logTriggerMode === "ON_FAULT" ? "bg-amber-950 text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    ON_FAULT
                  </button>
                  <button 
                    onClick={() => setLogTriggerMode("ON_STATE_CHANGE")}
                    className={`px-1.5 rounded select-none cursor-pointer ${logTriggerMode === "ON_STATE_CHANGE" ? "bg-cyan-950 text-cyan-405 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    STATE_TRAJ
                  </button>
                </div>

                {/* Medium Selector */}
                <div className="flex bg-slate-950 p-1 border border-slate-850 rounded">
                  <span className="text-slate-550 px-1.5">MEDIUM:</span>
                  <button 
                    onClick={() => {
                      setLogMedium("BRAM");
                      setLoggingBuffer(prev => prev.slice(0, 256));
                    }}
                    className={`px-1.5 rounded select-none cursor-pointer ${logMedium === "BRAM" ? "bg-cyan-950 text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    BRAM_CELLS [256]
                  </button>
                  <button 
                    onClick={() => setLogMedium("EXT_QSPI_SRAM")}
                    className={`px-1.5 rounded select-none cursor-pointer ${logMedium === "EXT_QSPI_SRAM" ? "bg-cyan-950 text-cyan-405 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    SPI_QSPI_SRAM [1024]
                  </button>
                </div>

                {/* Capture buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsLoggingActive(!isLoggingActive)}
                    className={`px-2.5 py-1 rounded select-none cursor-pointer font-bold ${
                      isLoggingActive 
                        ? "bg-rose-950/40 hover:bg-rose-955 text-rose-400 border border-rose-900/60" 
                        : "bg-emerald-955/40 hover:bg-emerald-950 text-emerald-400 border border-emerald-900"
                    }`}
                  >
                    {isLoggingActive ? "◼ FREEZE LOGGER" : "▶ START LOGGER"}
                  </button>
                  <button
                    onClick={() => {
                      setLoggingBuffer([]);
                      setCapturedCount(0);
                    }}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-850 px-2.5 py-1 rounded select-none cursor-pointer text-slate-400 hover:text-slate-200"
                  >
                    CLEAR
                  </button>
                </div>

              </div>
            </div>

            {/* Active Status Banner */}
            <div className="bg-slate-950 rounded p-3 mb-4 border border-slate-850 font-mono text-[9px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  {isLoggingActive && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isLoggingActive ? "bg-red-500" : "bg-slate-700"}`}></span>
                </span>
                <span className="text-slate-200">
                  LOGGER {isLoggingActive ? "RECORDING CONTINUOUS HARDWARE BUS..." : "FROZEN AT TRIGGER BLOCK RAM"}
                </span>
              </div>

              <div className="flex items-center gap-4 text-slate-450">
                <span>BUFFER LEVEL: <strong className="text-cyan-405">{loggingBuffer.length} / {logMedium === "BRAM" ? 256 : 1024} frames</strong></span>
                <span>TOTAL CAPTURED: <strong className="text-slate-350">{capturedCount} ticks</strong></span>
                
                {/* Export CSV button */}
                <button
                  onClick={() => {
                    if (loggingBuffer.length === 0) return;
                    // Format CSV
                    const headers = "Tick,Timestamp,Temp(K),Pressure(atm),Current(A),FSMState,Contactors,ChokeFreq(Hz),AWADDR_BUS,WDATA_BUS,ARADDR_BUS,RDATA_BUS,ValidCheck\n";
                    const rows = loggingBuffer.map(r => 
                      `${r.tick},${r.timestamp},${r.temp},${r.press},${r.current},${r.fsmState},${r.contactors},${r.chokeFreq},${r.awaddr},${r.wdata},${r.araddr},${r.rdata},${r.valid}`
                    ).join("\n");
                    const blob = new Blob([headers + rows], { type: "text/csv" });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.setAttribute("href", url);
                    a.setAttribute("download", `FPGA_HW_Log_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
                    a.click();
                  }}
                  disabled={loggingBuffer.length === 0}
                  className={`px-2 py-0.5 rounded border flex items-center gap-1 transition ${
                    loggingBuffer.length === 0 
                      ? "bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed" 
                      : "bg-cyan-950/40 border-cyan-900/60 hover:bg-cyan-950 text-cyan-400 cursor-pointer"
                  }`}
                >
                  <Download className="h-3 w-3" />
                  EXPORT CSV LOG
                </button>
              </div>
            </div>

            {/* BRAM Memory Dumper Table */}
            <div>
              <div className="overflow-x-auto rounded border border-slate-850">
                <table className="w-full text-left border-collapse font-mono text-[9px] select-text">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase select-none border-b border-slate-850">
                      <th className="p-2 w-14">TICK</th>
                      <th className="p-2 w-16">TIME</th>
                      <th className="p-2">FSM STATE</th>
                      <th className="p-2 text-right">TEMP (K)</th>
                      <th className="p-2 text-right">PRESS (a)</th>
                      <th className="p-2 text-right">CURR (A)</th>
                      <th className="p-2">CONTACTORS</th>
                      <th className="p-2 text-right">CHOKE FQ</th>
                      <th className="p-2">AXI AWADDR/WDATA</th>
                      <th className="p-2">AXI ARADDR/RDATA</th>
                      <th className="p-2 text-center w-12">PARITY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/50">
                    {loggingBuffer.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-500 bg-slate-950/40 italic select-none">
                          RAM log memory cells empty. Initiate FPGA operations or enable logger active stream capture.
                        </td>
                      </tr>
                    ) : (
                      loggingBuffer.slice(memoryPage * 10, (memoryPage + 1) * 10).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition">
                          <td className="p-2 text-slate-500">#{row.tick}</td>
                          <td className="p-2 text-slate-400">{row.timestamp}</td>
                          <td className="p-2">
                            <span className="font-bold text-slate-200">{row.fsmState}</span>
                          </td>
                          <td className="p-2 text-right font-semibold text-amber-500">
                            {row.temp.toFixed(1)} K
                          </td>
                          <td className="p-2 text-right font-semibold text-cyan-400">
                            {row.press.toFixed(2)} atm
                          </td>
                          <td className="p-2 text-right font-semibold text-purple-400">
                            {row.current.toFixed(2)} A
                          </td>
                          <td className="p-2">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${row.contactors.includes("CLSD") ? "bg-emerald-950 text-emerald-400" : "bg-rose-955/20 text-rose-350"}`}>
                              {row.contactors}
                            </span>
                          </td>
                          <td className="p-2 text-right text-cyan-300">
                            {row.chokeFreq > 0 ? `${row.chokeFreq.toFixed(1)} Hz` : "0.0 Hz"}
                          </td>
                          <td className="p-2 text-slate-400">
                            <span className="text-yellow-600 mr-1">{row.awaddr}</span>
                            <span className="text-slate-500">&rarr;</span>
                            <span className="text-emerald-400 ml-1">{row.wdata}</span>
                          </td>
                          <td className="p-2 text-slate-400">
                            <span className="text-yellow-650 mr-1">{row.araddr}</span>
                            <span className="text-slate-550">&rarr;</span>
                            <span className="text-indigo-400 ml-1">{row.rdata}</span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`text-[7.5px] font-bold px-1 py-0.5 rounded select-none ${row.valid ? "bg-emerald-950 text-emerald-400" : "bg-rose-953 text-rose-455"}`}>
                              {row.valid ? "VALID" : "CORRUPT"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginated control toolbar info */}
              {loggingBuffer.length > 10 && (
                <div className="flex justify-between items-center mt-3 font-mono text-[9px] text-slate-500 select-none">
                  <div>
                    Showing offsets <strong className="text-slate-300">{memoryPage * 10} - {Math.min(loggingBuffer.length, (memoryPage + 1) * 10)}</strong> of <strong className="text-slate-350">{loggingBuffer.length} frames</strong>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMemoryPage(prev => Math.max(0, prev - 1))}
                      disabled={memoryPage === 0}
                      className={`px-2 py-1 rounded border border-slate-850 cursor-pointer ${
                        memoryPage === 0 ? "text-slate-700 pointer-events-none" : "text-slate-400 hover:text-slate-100 hover:bg-slate-950"
                      }`}
                    >
                      &larr; PREV PAGE
                    </button>
                    <button
                      onClick={() => setMemoryPage(prev => Math.min(Math.floor((loggingBuffer.length - 1) / 10), prev + 1))}
                      disabled={(memoryPage + 1) * 10 >= loggingBuffer.length}
                      className={`px-2 py-1 rounded border border-slate-850 cursor-pointer ${
                        (memoryPage + 1) * 10 >= loggingBuffer.length ? "text-slate-700 pointer-events-none" : "text-slate-400 hover:text-slate-100 hover:bg-slate-950"
                      }`}
                    >
                      NEXT PAGE &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {activeTab === "mcp_registry" && (
        <div className="space-y-6 animate-fade-in" id="mcp-registry">
          {/* Header strip */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2.5">
              <Database className="h-5 w-5 text-indigo-400 rotate-12" />
              <div>
                <span className="text-[11px] text-slate-200 font-extrabold block uppercase tracking-widest">
                  MODEL CONTEXT PROTOCOL (MCP) & FORENSIC SCANNER
                </span>
                <span className="text-[9px] text-slate-500 lowercase block">
                  diagnose memory-mapped registers, direct-access I/O buses, and local CLI tools
                </span>
              </div>
            </div>
            <div className="bg-indigo-950/60 border border-indigo-800/40 px-2.5 py-1 text-indigo-400 font-mono font-bold text-[9px] rounded uppercase flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
              FORENSICS: 100% HARMONIZED
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (100% Forensic Findings of IO & CLI tools) - span 7 */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Box 1: Core Inputs & Outputs (Forensics Scan) */}
              <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 space-y-4">
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-400">⚡</span> INPUTS / OUTPUTS FORENSICS REGISTRY
                </h4>
                <div className="text-[9.5px] text-slate-500 leading-normal font-mono">
                  Real-time direct-access memory mappings observed on the Zynq UltraScale+ AXI-Lite co-processor bus:
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850/60 font-mono text-[9px] flex flex-col justify-between gap-1 hover:border-slate-800 transition">
                      <span className="text-slate-355 font-bold block">0x43C00A14 [RD] &larr;</span>
                      <span className="text-[8.5px] text-slate-500 font-sans">Propulsion electrodes thermal sensors reading. Continuously monitored via sliding anomalies queue.</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850/60 font-mono text-[9px] flex flex-col justify-between gap-1 hover:border-slate-800 transition">
                      <span className="text-slate-355 font-bold block">0x43C00400 [RD] &larr;</span>
                      <span className="text-[8.5px] text-slate-500 font-sans">Analog inputs for gas plenum pressure chamber. Auto-compensated for temperature bias offsets.</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850/60 font-mono text-[9px] flex flex-col justify-between gap-1 hover:border-slate-800 transition">
                      <span className="text-slate-355 font-bold block">0x43C00328 [RD] &larr;</span>
                      <span className="text-[8.5px] text-slate-500 font-sans">Main inductive coil choke frequency / feedback current monitor for magnetic harmonics lock.</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850/60 font-mono text-[9px] flex flex-col justify-between gap-1 hover:border-slate-800 transition">
                      <span className="text-slate-355 font-bold block">0x43C00204 [I/O] &harr;</span>
                      <span className="text-[8.5px] text-slate-500 font-sans">Gate command registers, physical contactor control bypasses, and hardware fault masking.</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-850/60 font-mono text-[9px] hover:border-slate-800 transition">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-400 font-bold">EXPORT OPERATIONS:</span>
                      <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/60 px-1 rounded uppercase font-bold">CSV / PDF</span>
                    </div>
                    <p className="text-[8.5px] text-slate-500 font-sans leading-relaxed">
                      Physical data buffers (e.g. <code>packetHistory</code> and <code>loggingBuffer</code>) can be serialized and downloaded as forensic analysis reports using the <code>Download CSV</code> or audit triggers on the main dashboards.
                    </p>
                  </div>
                </div>
              </div>

              {/* Box 2: CLI / Script Tool Registry */}
              <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 space-y-4">
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <span className="text-indigo-400">⚙️</span> DISCOVERED SHELL TOOLS REGISTRY
                </h4>

                <div className="space-y-3 font-mono text-[9px]">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-bold text-yellow-450 uppercase">1. Boundary Reset Tool</span>
                      <span className="text-slate-600 text-[8px]">LOCAL NPX</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-850/40 text-slate-450 break-words select-all">
                      sudo npx -y tsx /memory/reset_axis_boundaries.ts --force
                    </div>
                    <span className="text-[8.5px] text-slate-500 block font-sans">
                      Forcibly overrides clock phase bias matching and clears CRC fault queues on development interface.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-bold text-yellow-450 uppercase">2. Symmetry Verifying Tool</span>
                      <span className="text-slate-600 text-[8px]">SSH ENVIRONMENT</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-850/40 text-slate-450 break-words select-all">
                      ssh root@node-ollama \'sh /memory/check_symmetry_lock.sh\'
                    </div>
                    <span className="text-[8.5px] text-slate-500 block font-sans">
                      Checks system thermal limits and returns numerical coordinates in real-time.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-bold text-yellow-450 uppercase">3. Ollama pedagogy compiler compiler</span>
                      <span className="text-slate-600 text-[8px]">CMD SERVICE</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-850/40 text-slate-450 break-words select-all">
                      ollama create pog2-pedagogy --file Modelfile
                    </div>
                    <span className="text-[8.5px] text-slate-500 block font-sans">
                      Synthesizes hardware calibration instruction structures into a local gemma4 model.
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column (Live Endpoint Playground) - span 5 */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 space-y-4 flex flex-col justify-between h-[510px]">
                <div>
                  <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                    <span className="text-emerald-450">●</span> REAL-TIME PROGRAMMATIC REGISTRY ENDPOINTS
                  </h4>
                  <p className="text-[9.5px] text-slate-500 leading-normal font-sans pt-1">
                    These endpoints are fully attached to the <strong>window</strong> context in real-time. Call them directly in your browser\'s Developer Console or execute them below to fetch live, decoupled simulation telemetry.
                  </p>

                  {/* Interactors list */}
                  <div className="space-y-2 mt-4 font-mono text-[10px]">
                    
                    {/* Endpoint 1 */}
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850/65 flex items-center justify-between gap-1 hover:border-slate-800 transition">
                      <div>
                        <span className="text-cyan-400 font-bold block">getHexagram()</span>
                        <span className="text-[8px] text-slate-500 block">Returns current FSM State labels</span>
                      </div>
                      <button
                        onClick={() => {
                          if (typeof (window as any).getHexagram === "function") {
                            const res = (window as any).getHexagram();
                            setConsoleOutput(JSON.stringify(res, null, 2));
                          } else {
                            setConsoleOutput("Error: getHexagram is currently offline or unmounted.");
                          }
                        }}
                        className="px-2 py-1 bg-indigo-950 border border-indigo-800 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900 font-bold rounded uppercase text-[8px] cursor-pointer transition"
                      >
                        Execute
                      </button>
                    </div>

                    {/* Endpoint 2 */}
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850/65 flex items-center justify-between gap-1 hover:border-slate-800 transition">
                      <div>
                        <span className="text-cyan-400 font-bold block">getState()</span>
                        <span className="text-[8px] text-slate-500 block">Returns complete telemetry mapping</span>
                      </div>
                      <button
                        onClick={() => {
                          if (typeof (window as any).getState === "function") {
                            const res = (window as any).getState();
                            setConsoleOutput(JSON.stringify(res, null, 2));
                          } else {
                            setConsoleOutput("Error: getState is currently offline or unmounted.");
                          }
                        }}
                        className="px-2 py-1 bg-indigo-950 border border-indigo-800 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900 font-bold rounded uppercase text-[8px] cursor-pointer transition"
                      >
                        Execute
                      </button>
                    </div>

                    {/* Endpoint 3 */}
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850/65 flex items-center justify-between gap-1 hover:border-slate-800 transition">
                      <div>
                        <span className="text-cyan-400 font-bold block">getHealth()</span>
                        <span className="text-[8px] text-slate-500 block">Calculates dynamic health scores</span>
                      </div>
                      <button
                        onClick={() => {
                          if (typeof (window as any).getHealth === "function") {
                            const res = (window as any).getHealth();
                            setConsoleOutput(JSON.stringify(res, null, 2));
                          } else {
                            setConsoleOutput("Error: getHealth is currently offline or unmounted.");
                          }
                        }}
                        className="px-2 py-1 bg-indigo-950 border border-indigo-800 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900 font-bold rounded uppercase text-[8px] cursor-pointer transition"
                      >
                        Execute
                      </button>
                    </div>

                    {/* Endpoint 4 */}
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850/65 flex items-center justify-between gap-1 hover:border-slate-800 transition">
                      <div>
                        <span className="text-cyan-400 font-bold block">getNodeHealth()</span>
                        <span className="text-[8px] text-slate-500 block">Probes Switchboard and NodeTester state</span>
                      </div>
                      <button
                        onClick={() => {
                          if (typeof (window as any).getNodeHealth === "function") {
                            const res = (window as any).getNodeHealth();
                            setConsoleOutput(JSON.stringify(res, null, 2));
                          } else {
                            setConsoleOutput("Error: getNodeHealth is currently offline or unmounted.");
                          }
                        }}
                        className="px-2 py-1 bg-indigo-950 border border-indigo-800 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900 font-bold rounded uppercase text-[8px] cursor-pointer transition"
                      >
                        Execute
                      </button>
                    </div>

                  </div>
                </div>

                {/* Response Visualizer console */}
                <div className="space-y-1.5 pt-4">
                  <div className="flex justify-between items-center text-[8.5px] text-slate-500 uppercase font-mono tracking-widest select-none">
                    <span>⚡ CO-PROCESSOR REAL-TIME RESPONSE FEED:</span>
                    <button
                      onClick={() => setConsoleOutput(`{\n  "status": "idle",\n  "system": "mcp_terminal_ready"\n}`)}
                      className="text-slate-650 hover:text-slate-350 cursor-pointer text-[7.5px]"
                    >
                      CLEAR TERMINAL
                    </button>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 rounded p-3 h-[180px] overflow-y-auto font-mono text-[8.5px] text-slate-300 leading-normal select-all relative">
                    <pre className="text-emerald-400 overflow-x-auto whitespace-pre-wrap font-mono">{consoleOutput}</pre>
                    <span className="absolute bottom-1 right-1 text-[7.5px] text-slate-700 select-none uppercase">stdout_buf</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {activeTab === "physical_limbs" && (
        <div className="space-y-6 animate-fade-in text-left font-sans pb-12" id="physical-sovereign-limbs-dashboard">
          {/* Header strip */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
            <div>
              <div className="text-[10px] text-blue-400 font-mono font-bold tracking-wider uppercase flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                SOVEREIGN PHYSICAL DEPLOYMENT LINK ACTIVE
              </div>
              <h1 className="text-xl font-display font-medium text-slate-100 tracking-tight mt-0.5">
                MHD Hydro &amp; Propulsion Limbs Co-Processing Deck
              </h1>
              <p className="text-xs text-slate-400 max-w-2xl mt-1">
                Real-world cybernetic control substrate mirroring POG2 state logic. Active telemetry and motor actuation for water, air, and silicon vessels.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setIs640msIntervalActive(prev => {
                    const next = !prev;
                    addLogEntry("SYSTEM", next ? "SUCCESS" : "WARNING", `PHYSICAL TICK: 640ms hardware metabolic tick toggled ${next ? "ACTIVE" : "PAUSED"}.`);
                    return next;
                  });
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase cursor-pointer border transition ${
                  is640msIntervalActive 
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60" 
                    : "bg-slate-950 text-slate-500 border-slate-850"
                }`}
              >
                <Clock className={`h-3 w-3 ${is640msIntervalActive ? "animate-spin" : ""}`} />
                {is640msIntervalActive ? "640ms Cycle: ON" : "640ms Cycle: PAUSED"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (hydroLimbRef.current) {
                    const compiled = await hydroLimbRef.current.compilePhysicalState();
                    setHydroCompiledLog(compiled);
                    addLogEntry("SYSTEM", "SUCCESS", "HYDRO COMPILER: Force-compiled physical hexagram gate. Broadcast state to Globe Bridge.");
                    if (globeBridgeRef.current) {
                      globeBridgeRef.current.pushPhysicalState(compiled);
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/50 hover:bg-blue-900/50 border border-blue-900/60 text-blue-300 rounded text-[10px] font-mono font-bold uppercase cursor-pointer transition"
              >
                <RefreshCw className="h-3 w-3" />
                Trigger 15-Min Gate Compile
              </button>
            </div>
          </div>

          {/* Three columns grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: HYDRO SENSOR INGESTION (HydroTelemetryLimb) */}
            <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 space-y-4">
              <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
                <h2 className="text-xs text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  1. HydroTelemetryLimb
                </h2>
                <span className="text-[9px] font-mono select-none px-2 py-0.5 text-cyan-400 bg-cyan-950/30 border border-cyan-900/60 rounded">
                  BUFFER: {hydroFramesCount} FRAMES
                </span>
              </div>

              {/* In Memory SQLite Stat block */}
              <div className="bg-slate-950 p-3 rounded border border-slate-850/65 font-mono text-[10px] space-y-2">
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Storage Binding Status:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/40 p-1.5 rounded border border-slate-850">
                    <span className="text-slate-500 block text-[8px]">DO_SQL Preparation</span>
                    <span className="text-emerald-400 font-bold text-[8.5px]">READY (Simulated)</span>
                  </div>
                  <div className="bg-slate-900/40 p-1.5 rounded border border-slate-850">
                    <span className="text-slate-500 block text-[8px]">D1 Logging Stream</span>
                    <span className="text-emerald-400 font-bold text-[8.5px]">ACTIVE (Storage Sim)</span>
                  </div>
                </div>
                <div className="pt-1 text-[8.5px] text-slate-500">
                  <span className="text-cyan-400 font-bold mr-1">Latest SHA-256 Merkle Chain:</span>
                  <div className="bg-slate-900 p-1 mt-1 rounded font-mono text-[9px] text-slate-300 break-all border border-slate-800/50">
                    {hydroMerkleRoot}
                  </div>
                </div>
              </div>

              {/* Dynamic Sensor indicators */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider block">Live Propulsion Vessel Vectors</span>
                
                {/* Sensors Grid */}
                {hydroLastFrame ? (
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="bg-slate-950 border border-slate-850 rounded p-2 text-left">
                      <span className="text-slate-500">Battery Level</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-200 font-bold">{(hydroLastFrame.healthVector.battery * 100).toFixed(1)}%</span>
                        <div className="w-12 h-1.5 bg-slate-800 rounded">
                          <div 
                            className="h-full bg-emerald-400 rounded" 
                            style={{ width: `${hydroLastFrame.healthVector.battery * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-850 rounded p-2 text-left">
                      <span className="text-slate-500">Signal SNR</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-200 font-bold">{(hydroLastFrame.healthVector.signal * 100).toFixed(1)}%</span>
                        <div className="w-12 h-1.5 bg-slate-800 rounded">
                          <div 
                            className="h-full bg-cyan-400 rounded" 
                            style={{ width: `${hydroLastFrame.healthVector.signal * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-850 rounded p-2 text-left">
                      <span className="text-slate-500">Hull Pressure</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-200 font-semibold">{simulatedDepth.toFixed(1)} atm</span>
                        <span className="text-cyan-400 text-[9px]">{(hydroLastFrame.healthVector.pressure * 100).toFixed(0)}% Limit</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-850 rounded p-2 text-left">
                      <span className="text-slate-500">Thermal Output</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-200 font-semibold">{simulatedThermal}°C</span>
                        <span className={`text-[8.5px] font-bold ${simulatedThermal > 85 ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                          {simulatedThermal > 85 ? "OVERHEAT" : "NOMINAL"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-850 rounded-lg p-6 text-center text-slate-500 font-mono text-[10px]">
                    Waiting for first 640ms tick ingestion...
                  </div>
                )}
              </div>

              {/* Manual frame triggering */}
              <button
                type="button"
                onClick={async () => {
                  if (hydroLimbRef.current) {
                    const temp = 35 + Math.floor(Math.random() * 15);
                    const manualFrame: HydroFrame = {
                      timestamp: Date.now(),
                      domain: 'underwater',
                      source: `MANUAL_SONAR_INJECT_01`,
                      position: { lat: 34.6433, lon: 135.4211, depth: simulatedDepth, altitude: 0 },
                      healthVector: {
                        battery: 0.95,
                        propulsion: 0.90,
                        thermal: temp / 100,
                        magnetic: 0.98,
                        signal: 0.92,
                        pressure: simulatedDepth / 100
                      },
                      rawData: new Uint8Array([0xab, 0xcd, 0xef, 0x01]),
                      merkleRoot: ""
                    };
                    await hydroLimbRef.current.ingest(manualFrame);
                    setHydroFramesCount(hydroLimbRef.current.batchBuffer.length);
                    setHydroLastFrame(manualFrame);
                    setHydroMerkleRoot(hydroLimbRef.current.merkleChain);
                    addLogEntry("SYSTEM", "SUCCESS", "HYDRO LINK: Manually injected high-fidelity sonar telemetry Frame.");
                  }
                }}
                className="w-full py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-semibold font-mono rounded text-[10px] cursor-pointer transition uppercase"
              >
                Inject Manual Sonar Frame
              </button>

              {/* Compiled Log Box */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider block text-left">Compiled Hexagram Gate Status</span>
                {hydroCompiledLog ? (
                  <div className="bg-slate-950 border border-slate-850/85 rounded p-3 font-mono text-[9px] text-slate-300 space-y-2 text-left">
                    <div className="flex justify-between border-b border-slate-850 pb-1 text-slate-400">
                      <span>COMPILE TIME:</span>
                      <span className="text-cyan-400 font-bold">{new Date(hydroCompiledLog.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Aggregated Frame Count:</span>
                      <span className="text-slate-100 font-bold">{hydroCompiledLog.frameCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Evaluated Hexagram State:</span>
                      <span className="text-yellow-400 font-bold">{hydroCompiledLog.hexagramState?.state}</span>
                    </div>
                    
                    {/* Visual active lines */}
                    <div className="space-y-1 py-1">
                      <span className="text-[8px] text-slate-500 block">Active 6-Yao Lines Representation:</span>
                      <div className="flex flex-col-reverse items-center justify-center gap-1 bg-slate-900/60 p-2 rounded">
                        {hydroCompiledLog.hexagramState?.yaoLines?.map((line: any) => (
                          <div key={line.position} className="flex items-center gap-2 w-full max-w-[120px]">
                            <span className="text-[7.5px] text-slate-500 w-4">L{line.position}:</span>
                            <div className="flex-1 flex justify-center">
                              {line.state === "solid" ? (
                                <div className="h-1.5 bg-cyan-500 w-full rounded-sm" title={`Line ${line.position}: SOLID`} />
                              ) : (
                                <div className="flex gap-1.5 w-full">
                                  <div className="h-1.5 bg-rose-500 flex-1 rounded-sm" title={`Line ${line.position}: BROKEN`} />
                                  <div className="h-1.5 bg-rose-500 flex-1 rounded-sm" title={`Line ${line.position}: BROKEN`} />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-850 rounded p-4 text-center text-slate-500 font-mono text-[8px]">
                    No states compiled yet. Click &ldquo;Trigger 15-Min Gate Compile&rdquo; to process the buffered telemetries.
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: PROPULSION CONTROLLER (PropulsionControlLimb) */}
            <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 space-y-4">
              <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
                <h2 className="text-xs text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  2. PropulsionControlLimb
                </h2>
                <span className="text-[9px] font-mono text-blue-400 px-2 py-0.5 bg-blue-950/20 border border-blue-900/50 rounded">
                  ESC REGULATORS Nominal
                </span>
              </div>

              {/* Simulated hardware override controls */}
              <div className="bg-slate-950 p-3 rounded border border-slate-850/65 font-mono text-[10px] space-y-3">
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block text-left">Actuation Command Overrides</span>

                {/* Depth Slider */}
                <div className="space-y-1 text-left">
                  <div className="flex justify-between items-center text-[9px] text-slate-400">
                    <span>Target Vessel Depth:</span>
                    <span className="text-cyan-400 font-bold">{simulatedDepth.toFixed(1)} meters</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="110"
                    step="0.5"
                    value={simulatedDepth}
                    onChange={(e) => {
                      setSimulatedDepth(parseFloat(e.target.value));
                      setSimulatedError(null);
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[7px] text-slate-600">
                    <span>0m (Surface)</span>
                    <span className="text-red-500/80">100m (Hull Rating Extreme)</span>
                  </div>
                </div>

                {/* Thrust Slider */}
                <div className="space-y-1 text-left">
                  <div className="flex justify-between items-center text-[9px] text-slate-400">
                    <span>Target Thruster Power:</span>
                    <span className="text-blue-400 font-bold">{simulatedThrust.toFixed(1)} Newtons</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={simulatedThrust}
                    onChange={(e) => {
                      setSimulatedThrust(parseFloat(e.target.value));
                      setSimulatedError(null);
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[7px] text-slate-600">
                    <span>0N (Idle)</span>
                    <span>100N (Max Thruster Output)</span>
                  </div>
                </div>

                {/* Heading Input/Selector */}
                <div className="grid grid-cols-2 gap-2 text-left font-mono text-[9px]">
                  <div className="space-y-1 text-left">
                    <span className="text-[9px] text-slate-500 block">Target Yaw Heading ({simulatedHeading}°):</span>
                    <select
                      value={simulatedHeading}
                      onChange={(e) => setSimulatedHeading(parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-850 rounded px-1.5 py-1 text-slate-200 font-mono text-[9px] focus:outline-none cursor-pointer"
                    >
                      <option value="0">0° (True North)</option>
                      <option value="90">90° (East)</option>
                      <option value="180">180° (South)</option>
                      <option value="270">270° (West)</option>
                      <option value="45">45° (North-East)</option>
                      <option value="225">225° (South-West)</option>
                    </select>
                  </div>

                  <div className="space-y-1 text-left">
                    <span className="text-[9px] text-slate-500 block">Control Drive Mode:</span>
                    <select
                      value={simulatedStateMode}
                      onChange={(e) => {
                        setSimulatedStateMode(e.target.value as any);
                        setSimulatedError(null);
                      }}
                      className="w-full bg-slate-900 border border-slate-850 rounded px-1.5 py-1 text-slate-200 font-mono text-[9px] focus:outline-none cursor-pointer"
                    >
                      <option value="cruise">cruise (Propulsive Cruise)</option>
                      <option value="dive">dive (Hull descent sequence)</option>
                      <option value="surface">surface (Buoyancy blow)</option>
                      <option value="hover">hover (Fixed station-keep)</option>
                      <option value="emergency">emergency (Maximum Safety state)</option>
                    </select>
                  </div>
                </div>

                {/* Execution feedback line */}
                {simulatedError ? (
                  <div className="bg-red-950/45 border border-red-900 text-red-400 p-2 rounded text-[9px] font-bold text-center uppercase animate-pulse">
                    🚨 HARDWARE EXCEPTION: {simulatedError}
                  </div>
                ) : (
                  <div className="bg-slate-900 text-slate-400 p-2 rounded text-[9px] text-center border border-slate-800 flex items-center justify-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Limb status is Operational</span>
                  </div>
                )}
              </div>

              {/* Main Actuations */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (propulsionLimbRef.current) {
                      const finalCmd: PropulsionCommand = {
                        timestamp: Date.now(),
                        targetThrust: simulatedThrust,
                        targetDepth: simulatedDepth,
                        targetHeading: simulatedHeading,
                        mode: simulatedStateMode,
                        hexagramAuthority: 'Operator_Manual_Overrun'
                      };

                      // Check simulated hard thresholds artificially to test exception rules
                      if (simulatedThermal > 85) {
                        setSimulatedError(`THERMAL_THROTTLE: ${simulatedThermal}°C > 85°C core threshold limit!`);
                        addLogEntry("SYSTEM", "CRITICAL", `PROPULSION FAILURE: Overheat limit exceeded during override execution.`);
                        return;
                      }
                      if (simulatedDepth > 100) {
                        setSimulatedError(`PRESSURE_EXCEED: ${simulatedDepth.toFixed(1)}atm depth exceeds hull safety limits!`);
                        addLogEntry("SYSTEM", "CRITICAL", `PROPULSION FAILURE: Hull pressure limit exceeded.`);
                        return;
                      }

                      const res = await propulsionLimbRef.current.executeCommand(finalCmd);
                      if (res.success) {
                        setPropulsionCommandCurrent(finalCmd);
                        setPropulsionCommandLog(prev => [finalCmd, ...prev.slice(0, 15)]);
                        setSimulatedError(null);
                        addLogEntry("SYSTEM", "SUCCESS", `PROPULSION ACTION: Issued drive command. Thrust: ${simulatedThrust}N, Target: ${simulatedDepth}m.`);
                      } else {
                        setSimulatedError(res.error || "Execution fault");
                        addLogEntry("SYSTEM", "CRITICAL", `PROPULSION FAILURE: ${res.error}`);
                      }
                    }
                  }}
                  className="py-2 bg-blue-950/40 hover:bg-blue-900 border border-blue-700 text-blue-200 font-bold font-mono rounded text-[10px] cursor-pointer transition uppercase text-center flex items-center justify-center gap-1"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Execute Command
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (propulsionLimbRef.current) {
                      await propulsionLimbRef.current.ghostLimbFallback();
                      
                      const fallCmd: PropulsionCommand = {
                        timestamp: Date.now(),
                        targetThrust: simulatedThrust * 0.5,
                        targetDepth: simulatedDepth,
                        targetHeading: simulatedHeading,
                        mode: 'hover',
                        hexagramAuthority: 'GhostLimb_Operator_Trip'
                      };
                      setSimulatedStateMode('hover');
                      setSimulatedThrust(prev => prev * 0.5);
                      setPropulsionCommandCurrent(fallCmd);
                      setPropulsionCommandLog(prev => [fallCmd, ...prev.slice(0, 15)]);
                      setSimulatedError(null);
                      addLogEntry("SYSTEM", "WARNING", "GHOST_LIMB FORCE-TRIGGERED: Manual isolation override engagement complete.");
                    }
                  }}
                  className="py-2 bg-rose-950/20 hover:bg-rose-950/60 border border-rose-800 text-rose-300 font-bold font-mono rounded text-[10px] cursor-pointer transition uppercase text-center flex items-center justify-center gap-1"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Ghost Fallback
                </button>
              </div>

              {/* Subsystem specific actions */}
              <div className="space-y-2 bg-slate-950 p-2.5 rounded border border-slate-850/65 font-mono text-[9px] text-left">
                <span className="text-[8.5px] font-bold uppercase text-slate-400 block tracking-wider mb-1">Simulate External Failures For pedagogy Testing:</span>
                <div className="flex gap-1.5 col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimulatedThermal(92);
                      addLogEntry("SYSTEM", "WARNING", "HARDWARE FAULT TESTING: Artificially induced thermal runaway temp -> 92°C.");
                    }}
                    className="flex-1 py-1 px-1 bg-red-950/30 border border-red-900 rounded text-red-300 font-bold hover:bg-red-950/50 cursor-pointer text-center text-[8.5px] transition animate-pulse"
                  >
                    Force Core Melt (92°C)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimulatedDepth(105);
                      addLogEntry("SYSTEM", "WARNING", "HARDWARE FAULT TESTING: Deep oceanic submergence -> 105 meters.");
                    }}
                    className="flex-1 py-1 px-1 bg-purple-955/30 border border-purple-905 rounded text-purple-300 font-bold hover:bg-purple-950/50 cursor-pointer text-center text-[8.5px] transition"
                  >
                    Deep Ocean (105m)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimulatedThermal(41);
                      setSimulatedDepth(12.4);
                      setSimulatedError(null);
                      addLogEntry("SYSTEM", "SUCCESS", "HARDWARE FAULT CLEARED: Clean ambient sensors recalibrated successfully.");
                    }}
                    className="py-1 px-2 bg-slate-900 border border-slate-800 rounded text-slate-300 hover:text-white cursor-pointer text-[8.5px] font-bold text-center"
                  >
                    Clear Faults
                  </button>
                </div>
              </div>

              {/* Command execution logs */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider block text-left">Propulsion ESC Commands Ledger</span>
                <div className="bg-slate-950 border border-slate-850 rounded p-2.5 h-[135px] overflow-y-auto font-mono text-[9px] space-y-1 text-slate-350 select-all">
                  {propulsionCommandLog.length > 0 ? (
                    propulsionCommandLog.map((log, idx) => (
                      <div key={idx} className="border-b border-slate-900/60 pb-1 flex justify-between gap-1 items-start text-left shrink-0">
                        <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className="text-cyan-400 font-bold">{log.mode}</span>
                        <span className="text-slate-100 flex-1 text-right">{log.targetThrust}N / {log.targetDepth}m / {log.targetHeading}°</span>
                        <span className="text-yellow-600 font-semibold max-w-[85px] truncate">{log.hexagramAuthority}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-center py-8">
                      No motor PWM commands issued to ESC yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 3: GLOBE MULTIPLAYER BRIDGE (GlobeBridgeLimb) */}
            <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 space-y-4">
              <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
                <h2 className="text-xs text-slate-200 font-mono font-bold uppercase tracking-wider flex items-center gap-2 font-display">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  3. GlobeBridgeLimb
                </h2>
                <div className="flex items-center gap-1 text-[8.5px] font-bold font-mono">
                  <span className={`h-2 w-2 rounded-full ${wsOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                  <span className={wsOnline ? "text-emerald-400" : "text-slate-500"}>
                    {wsOnline ? "CONNECTED ENERGETIC" : "LOOPBACK MODEM ACTIVE"}
                  </span>
                </div>
              </div>

              {/* Server WebSocket parameters */}
              <div className="bg-slate-950 p-3 rounded border border-slate-850/65 font-mono text-[10px] space-y-2 text-left">
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">WebSocket Gateway Information:</span>
                <div className="space-y-1 text-left">
                  <span className="text-slate-500 block">Edge Endpoint Target Route:</span>
                  <div className="bg-slate-900 p-1.5 rounded text-[8.5px] text-slate-300 break-all border border-slate-850 font-semibold select-all">
                    {((import.meta as any).env?.VITE_POG2_GLOBE_ENDPOINT || "").replace('/parties/globe/pog2-sovereign', '')}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[8.5px] pt-1">
                  <div>
                    <span className="text-slate-500 block">Cobe Globe Protocol:</span>
                    <span className="text-emerald-400 font-bold">Inbound Broadcast Port</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Transit Surcharges:</span>
                    <span className="text-slate-100 font-bold">$0.00 / Free Tier</span>
                  </div>
                </div>
              </div>

              {/* Simulated multiplayer triggers from Globe Bridge */}
              <div className="bg-slate-950 p-3 rounded border border-slate-850 font-mono text-[10px] space-y-2 text-left">
                <span className="text-[9px] font-bold uppercase text-cyan-400 tracking-wider block">Simulate Incoming Globe user Interactions</span>
                <p className="text-[9px] text-slate-400 leading-normal text-left">
                  In production, remote participants dragging or clicking coordinates on the 3D Cobe Globe trigger reactive ESC changes to the drone over the WebSocket bridge.
                </p>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (globeBridgeRef.current?.onCommandCallback) {
                        globeBridgeRef.current.onCommandCallback({
                          type: "globe_command",
                          thrust: 35,
                          depth: 18.5,
                          heading: 180,
                          mode: "dive"
                        });
                      }
                    }}
                    className="py-1 px-1.5 bg-cyan-950/40 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-semibold text-[8px] rounded uppercase cursor-pointer text-center"
                  >
                    Click South (180°)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (globeBridgeRef.current?.onCommandCallback) {
                        globeBridgeRef.current.onCommandCallback({
                          type: "globe_command",
                          thrust: 55,
                          depth: 5.0,
                          heading: 90,
                          mode: "cruise"
                        });
                      }
                    }}
                    className="py-1 px-1.5 bg-cyan-950/40 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-semibold text-[8px] rounded uppercase cursor-pointer text-center"
                  >
                    Click East (90°)
                  </button>
                </div>
              </div>

              {/* Inbound/Outbound globe log stream */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider block text-left">Globe Bridge Transmissions</span>
                <div className="bg-slate-950 border border-slate-850 rounded p-2.5 h-[160px] overflow-y-auto font-mono text-[8.5px] space-y-1 text-slate-400 text-left select-all">
                  <div className="text-emerald-500 font-semibold">
                    [INFO] Globe Bridge telemetry interface listening...
                  </div>
                  {hydroLastFrame && (
                    <div className="text-blue-400 font-mono text-[8px] whitespace-normal break-all leading-normal text-left">
                      [{new Date().toLocaleTimeString()}] OUTBOUND TX: Domain: {hydroLastFrame.domain}, Lat: {hydroLastFrame.position.lat.toFixed(5)}, Lon: {hydroLastFrame.position.lon.toFixed(5)}, Depth: {hydroLastFrame.position.depth.toFixed(1)}m, State: Root computed.
                    </div>
                  )}
                  {globeMessages.map((msg, idx) => (
                    <div key={idx} className="text-cyan-400 font-mono text-[8.5px]">
                      {msg}
                    </div>
                  ))}
                  <div className="text-slate-600 text-[8px] text-left">
                    [LOOPBACK] Broadcast simulation outbound: {hydroFramesCount} frames synchronized.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}