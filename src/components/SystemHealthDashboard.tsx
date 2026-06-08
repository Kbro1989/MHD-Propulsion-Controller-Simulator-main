/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { 
  Activity, 
  Terminal, 
  ShieldAlert, 
  Cpu, 
  Database, 
  Clock, 
  Settings, 
  CheckCircle2, 
  AlertTriangle, 
  Check, 
  Search, 
  Radio, 
  Filter, 
  RefreshCw, 
  HardDrive,
  Volume2,
  VolumeX
} from "lucide-react";
import { 
  HexagramState, 
  HexagramStateLabels, 
  ContactorState, 
  ContactorStateLabels, 
  ChokeState, 
  ChokeStateLabels, 
  SubsystemId, 
  VALID_TRANSITIONS,
  DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES
} from "../types";

// ============================================================================
// SYSTEM HEALTH STRUCTURE TYPES
// ============================================================================

export interface PostMortemLog {
  id: string;
  tick: number;
  timestamp: string;
  source: "AXI_BUS" | "FSM_ST" | "SENSOR_ANOMALY" | "CDC_CLOCKY";
  hexAddr: string;
  level: "WARNING" | "CRITICAL" | "FATAL";
  message: string;
}

interface SystemHealthDashboardProps {
  tickCounter: number;
  currentHexagram: HexagramState;
  contactorStates: ContactorState[];
  chokeState: ChokeState;
  avgElectrodeTemp: number;
  plenumPressure: number;
  busCurrentA: number;
  symmetryOk: boolean;
  activeFaultCodes: string[];
  
  // Controls
  temperatureBias: number;
  busCurrentBias: number;
  plenumPressureNominal: number; // pass the state value
  
  // Fault Injections
  faultInjectAxiTimeout: boolean;
  faultInjectAxiReadbackMismatch: boolean;
  faultInjectCdcDesync: boolean;
  faultInjectCdcDrift: boolean;
  faultInjectThermalRateExceeded: boolean;
  faultInjectSensorDivergence: boolean;

  onAddLogEntry: (
    subsystem: SubsystemId | "SYSTEM",
    level: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL",
    message: string
  ) => void;

  // AXI performance counters props
  statWriteCount?: number;
  statReadCount?: number;
  avgWriteLatency?: number;
  avgReadLatency?: number;
  statHexagramWriteCount?: number;
  statTickWriteCount?: number;
  statAxiErrorCount?: number;
  axiLatencyHistory?: Array<{ read: number; write: number }>;
}

// ============================================================================
// D3 ANOMALY HISTOGRAM COMPONENT
// ============================================================================
export function D3AnomalyHistogram({ anomalies }: { anomalies: number[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || anomalies.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clean container

    const width = 480;
    const height = 180;
    const margin = { top: 15, right: 15, bottom: 30, left: 35 };

    // Set x scale based on anomalies (from minimum anomaly up to max with safety padding)
    const minA = d3.min(anomalies) ?? -5;
    const maxA = d3.max(anomalies) ?? 50;
    const x = d3.scaleLinear()
      .domain([minA - 1, maxA + 2])
      .nice()
      .range([margin.left, width - margin.right]);

    // Bin generator
    const histogram = d3.bin()
      .value(d => d)
      .domain(x.domain() as [number, number])
      .thresholds(x.ticks(32)); // ~32 bins

    const bins = histogram(anomalies);

    // Set y scale
    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length) || 10])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Create a color gradient for the bars
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "bar-gradient-histogram")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#0ea5e9"); // cyan bright blue

    gradient.append("stop")
      .attr("offset", "70%")
      .attr("stop-color", "#fb923c"); // amber highlight

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#f87171"); // bright red top

    // Draw background grid lines
    svg.append("g")
      .attr("stroke", "rgba(255, 255, 255, 0.05)")
      .attr("stroke-dasharray", "2,2")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(-height + margin.top + margin.bottom).tickFormat(() => ""))
      .call(g => g.select(".domain").remove());

    svg.append("g")
      .attr("stroke", "rgba(255, 255, 255, 0.05)")
      .attr("stroke-dasharray", "2,2")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).tickSize(-width + margin.left + margin.right).tickFormat(() => ""))
      .call(g => g.select(".domain").remove());

    // Draw bars for the distribution
    const barGroups = svg.append("g")
      .selectAll("g")
      .data(bins)
      .join("g");

    barGroups.append("rect")
      .attr("x", d => x(d.x0 ?? 0) + 0.5)
      .attr("width", d => Math.max(0, x(d.x1 ?? 0) - x(d.x0 ?? 0) - 1.0))
      .attr("y", d => y(d.length))
      .attr("height", d => y(0) - y(d.length))
      .attr("fill", "url(#bar-gradient-histogram)")
      .attr("opacity", 0.85)
      .attr("class", "hover:opacity-100 transition-opacity cursor-pointer")
      .append("title")
      .text(d => `Anomaly Delta: [${d.x0?.toFixed(2)}K, ${d.x1?.toFixed(2)}K]\nOccurrences count: ${d.length} ticks`);

    // Draw x axis
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => `${d} K`))
      .attr("font-size", "8px")
      .attr("font-family", "JetBrains Mono")
      .attr("color", "rgba(255, 255, 255, 0.35)")
      .call(g => g.select(".domain").style("stroke", "rgba(255, 255, 255, 0.15)"));

    // Draw y axis
    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(5))
      .attr("font-size", "8px")
      .attr("font-family", "JetBrains Mono")
      .attr("color", "rgba(255, 255, 255, 0.35)")
      .call(g => g.select(".domain").style("stroke", "rgba(255, 255, 255, 0.15)"));

  }, [anomalies]);

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox="0 0 480 180"
        className="w-full h-auto bg-slate-950/80 border border-slate-850/60 rounded p-1"
      />
    </div>
  );
}

const FAULT_SPOKEN_NAMES: Record<string, string> = {
  "T-01": "Electrode temperature thermal rate warning, active thermal throttling applied",
  "T-02": "Electrode over-temperature critical shut off threshold reached",
  "E-01": "Bus current overload hazard detected",
  "E-02": "High voltage active rectifier read back mismatch",
  "M-01": "Plenum pressure below safe dynamic limits",
  "M-02": "Plenum pressure exceeds safe structural boundaries",
  "S-01": "Contactor complementary symmetry lock imbalance",
  "S-02": "Gate drive desaturation critical trip event",
  "C-01": "Timing slack delay violation on interconnect"
};

export default function SystemHealthDashboard({
  tickCounter,
  currentHexagram,
  contactorStates,
  chokeState,
  avgElectrodeTemp,
  plenumPressure,
  busCurrentA,
  symmetryOk,
  activeFaultCodes,
  temperatureBias,
  busCurrentBias,
  plenumPressureNominal,
  faultInjectAxiTimeout,
  faultInjectAxiReadbackMismatch,
  faultInjectCdcDesync,
  faultInjectCdcDrift,
  faultInjectThermalRateExceeded,
  faultInjectSensorDivergence,
  onAddLogEntry,
  statWriteCount = 0,
  statReadCount = 0,
  avgWriteLatency = 0,
  avgReadLatency = 0,
  statHexagramWriteCount = 0,
  statTickWriteCount = 0,
  statAxiErrorCount = 0,
  axiLatencyHistory = []
}: SystemHealthDashboardProps) {

  const lastLoggedTickRef = useRef<number>(-1);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [latencyView, setLatencyView] = useState<"trend" | "distribution">("distribution");
  const prevFaultCodesRef = useRef<string[]>([]);

  // Speech synthesis feedback loop
  useEffect(() => {
    if (isAudioMuted) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel(); // stop current announcements if operator mutes
      }
      return;
    }

    const previousCodes = prevFaultCodesRef.current;
    
    // Find newly added faults
    const newlyAdded = activeFaultCodes.filter(code => !previousCodes.includes(code));
    
    if (newlyAdded.length > 0 && typeof window !== "undefined" && "speechSynthesis" in window) {
      newlyAdded.forEach(code => {
        const spokenDescription = FAULT_SPOKEN_NAMES[code] || `active fault code ${code}`;
        const phrase = `Attention operator. ${spokenDescription}. Systemic response protocol is actively applied.`;
        
        try {
          const utterance = new SpeechSynthesisUtterance(phrase);
          
          // Retrieve and bind high-fidelity premium organic voice profiles
          const voices = window.speechSynthesis.getVoices();
          const premiumVoice = voices.find(v => 
            (v.name.includes("Natural") || 
             v.name.includes("Google") || 
             v.name.includes("Premium") || 
             v.name.includes("Apple") || 
             v.name.includes("Samantha") || 
             v.name.includes("Daniel") || 
             v.name.includes("Fiona")) && 
            v.lang.startsWith("en")
          ) || voices.find(v => v.lang.startsWith("en")) || voices[0];
          
          if (premiumVoice) {
            utterance.voice = premiumVoice;
          }

          // Fetch active hexagram organic emotional weights to map parameters
          const profile = DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[currentHexagram];
          const pitchShift = profile ? profile.voicePitchShift : 0; 
          const tempoBias = profile ? profile.voiceTempoBias : 1.0;  

          // Dynamically scale pitch and rate based on bio-metamorphic vector offsets
          const finalPitch = 1.0 + (pitchShift / 100);
          const finalRate = 0.95 * tempoBias;

          utterance.pitch = Math.max(0.5, Math.min(2.0, finalPitch));
          utterance.rate = Math.max(0.5, Math.min(2.0, finalRate));
          
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn("Speech Synthesis fault announcement failed", err);
        }
      });
    }

    prevFaultCodesRef.current = [...activeFaultCodes];
  }, [activeFaultCodes, isAudioMuted]);

  // AXI Interconnect high latency warning log triggers
  const prevAxiLatencyWarnRef = useRef<boolean>(false);
  useEffect(() => {
    const threshold = 15; // clock cycles
    const writeOver = avgWriteLatency > threshold;
    const readOver = avgReadLatency > threshold;

    if ((writeOver || readOver) && !prevAxiLatencyWarnRef.current) {
      onAddLogEntry(
        "SYSTEM",
        "WARNING",
        `AXI Bus Warning: Average latency exceeded threshold (${threshold} cycles). Active Write Latency: ${avgWriteLatency} cycles | Read Latency: ${avgReadLatency} cycles. Timing margin degraded.`
      );
      prevAxiLatencyWarnRef.current = true;
    } else if (!writeOver && !readOver && prevAxiLatencyWarnRef.current) {
      onAddLogEntry(
        "SYSTEM",
        "SUCCESS",
        `AXI Bus Recovery: Latency dropped back to nominal levels below threshold. Write: ${avgWriteLatency} cycles | Read: ${avgReadLatency} cycles.`
      );
      prevAxiLatencyWarnRef.current = false;
    }
  }, [avgWriteLatency, avgReadLatency]);

  // AXI real-time bandwidth (MB/s) and latency density histogram
  const bandwidthMBs = useMemo(() => {
    // Each tick simulated has a specific total of writes and reads processed.
    // Average transaction operates on 4 bytes (32-bit width).
    // Let's compute based on the current AXI transaction rates:
    // When latency increases, throughput degrades natively!
    const activeTxThisTick = ((statWriteCount + statReadCount) % 15) + 3;
    const avgLatencyCycles = (avgWriteLatency + avgReadLatency) / 2 || 5;
    return parseFloat(((100 / avgLatencyCycles) * activeTxThisTick * 4).toFixed(2));
  }, [statWriteCount, statReadCount, avgWriteLatency, avgReadLatency]);

  const latencyBins = useMemo(() => {
    if (!axiLatencyHistory || axiLatencyHistory.length === 0) return [];
    
    // We bin the latency data from 2 cycles to max cycles (nominally timeout extends to ~35 cycles)
    const numBins = 8;
    const minVal = 2;
    const maxVal = 36;
    const binWidth = (maxVal - minVal) / numBins;
    
    const bins = Array.from({ length: numBins }, (_, idx) => {
      const start = minVal + idx * binWidth;
      const end = start + binWidth;
      return {
        label: `${Math.round(start)}-${Math.round(end)}`,
        writeCount: 0,
        readCount: 0,
      };
    });
    
    axiLatencyHistory.forEach(item => {
      const wBinIdx = Math.min(numBins - 1, Math.max(0, Math.floor((item.write - minVal) / binWidth)));
      const rBinIdx = Math.min(numBins - 1, Math.max(0, Math.floor((item.read - minVal) / binWidth)));
      
      bins[wBinIdx].writeCount++;
      bins[rBinIdx].readCount++;
    });
    
    return bins;
  }, [axiLatencyHistory]);

  // ==========================================================================
  // SHARED BUFFER STATES (FIFO Stack size 32)
  // ==========================================================================
  // SHARED BUFFER STATES (FIFO Stack size 32)
  // ==========================================================================
  const [postMortemLogs, setPostMortemLogs] = useState<PostMortemLog[]>([
    {
      id: "PM-001",
      tick: 0,
      timestamp: new Date().toISOString().substring(11, 19),
      source: "AXI_BUS",
      hexAddr: "0x43C00A00",
      level: "WARNING",
      message: "Diagnostics pipeline initialized. Ring buffer mapped on AXI bus index range [0x00..0x1C]."
    }
  ]);

  const [cliInput, setCliInput] = useState("");
  const [cliHistory, setCliHistory] = useState<string[]>([
    "POG2 ZYNQ CO-PROCESSOR DIAGNOSTICS SHELL v1.42",
    "Enter 'help' to see system commands or 'health-chk' to run register scans.",
    "----------------------------------------------------------------------"
  ]);

  // ==========================================================================
  // HISTORICAL ANOMALIES FOR D3 HISTOGRAM (LAST 1000 TICKS)
  // ==========================================================================
  const [historicalAnomalies, setHistoricalAnomalies] = useState<number[]>(() => {
    // Populate initially with 1000 realistic historical electrode temperature anomalies.
    // Nominally temperature starts around 300K, so anomaly is centered around 0K, with positive/negative spreads.
    return Array.from({ length: 1000 }, () => {
      // Normal variation (Standard base fluctuation around 300K)
      const baseVariation = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.8;
      // occasional high value thermal peak spikes:
      if (Math.random() > 0.982) {
        return baseVariation + 15.0 + Math.random() * 35.0; // 15 to 50 Kelvin overheating anomaly
      }
      return baseVariation;
    });
  });

  useEffect(() => {
    if (tickCounter === 0) return;
    const currentAnomaly = avgElectrodeTemp - 300.0;
    setHistoricalAnomalies(prev => {
      const next = [...prev, currentAnomaly];
      if (next.length > 1000) {
        next.shift();
      }
      return next;
    });
  }, [tickCounter, avgElectrodeTemp]);

  // ==========================================================================
  // HIGH-SPEED TELEMETRY BUFFER & DYNAMIC LOGGER STATE
  // ==========================================================================
  const [isProfilingAcq, setIsProfilingAcq] = useState(true);
  const [profilingSampleFrequencyMs, setProfilingSampleFrequencyMs] = useState(100);
  const [searchHighSpeed, setSearchHighSpeed] = useState("");
  const [activeChartSensor, setActiveChartSensor] = useState<"temp" | "pressure" | "current">("temp");
  const [highSpeedLogs, setHighSpeedLogs] = useState<any[]>(() => {
    const baseTime = Date.now() - 30000;
    return Array.from({ length: 15 }, (_, index) => {
      const offsetMs = index * 2000;
      const stepTick = Math.max(0, index * 3);
      const logTime = new Date(baseTime + offsetMs).toISOString().substring(11, 23);
      const simulatedTemp = 300.0 + (Math.sin(index / 2.0) * 4.5);
      const simulatedPress = 1.30 + (Math.cos(index / 3.0) * 0.05);
      const simulatedCurr = 1880 + Math.round(Math.sin(index / 1.5) * 40);
      return {
        id: `HS-${(100 + index).toString()}`,
        tick: stepTick,
        timestamp: logTime,
        temp: parseFloat(simulatedTemp.toFixed(2)),
        pressure: parseFloat(simulatedPress.toFixed(3)),
        current: simulatedCurr,
        hexagram: "IDLE",
        choke: "IDLE",
        contactors: "OOOOOOOOOO",
        axiAccess: `[AXI_RD] Reg 0x${(0x43C00A00 + (index * 4)).toString(16).toUpperCase()} -> VAL: 0x3F`
      };
    });
  });

  // ==========================================================================
  // I-CHING 64-BIT ALTERNATIVE QBIT ENGINE & PLAYER STRING STATE
  // ==========================================================================
  const [entropyFactor, setEntropyFactor] = useState(48.5);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [savedTrainingCount, setSavedTrainingCount] = useState(15);
  const [playerStateJsonStr, setPlayerStateJsonStr] = useState<string>(() => {
    return localStorage.getItem("pog2_mhd_player_state") || "";
  });

  // ==========================================================================
  // LORA PEFT ADAPTER CONFIGURATION & TRAINING STATE
  // ==========================================================================
  const [loraRank, setLoraRank] = useState(8);
  const [loraAlpha, setLoraAlpha] = useState(16);
  const [loraLearningRate, setLoraLearningRate] = useState("3e-4");
  const [loraTargetModules, setLoraTargetModules] = useState("q_proj, v_proj");
  const [isLoraTraining, setIsLoraTraining] = useState(false);
  const [loraProgress, setLoraProgress] = useState(0);
  const [loraCurrentLoss, setLoraCurrentLoss] = useState<number | null>(null);
  const [loraLogs, setLoraLogs] = useState<string[]>([]);
  const [isLoraMerged, setIsLoraMerged] = useState(false);
  const [activeQbitTab, setActiveQbitTab] = useState<"qbit" | "lora">("qbit");

  const loraDataset = useMemo(() => {
    const records = highSpeedLogs.slice(-6);
    return (records.length > 0 ? records : [
      {
        id: "HS-SAMPLE",
        tick: tickCounter,
        temp: avgElectrodeTemp,
        pressure: plenumPressure,
        current: Math.round(busCurrentA),
        hexagram: HexagramStateLabels[currentHexagram]?.split(" (")[0] || "IDLE",
        choke: ChokeStateLabels[chokeState] || "IDLE"
      }
    ]).map((log, index) => {
      const hexVal = log.hexagram || "IDLE";
      const vibe = hexVal === "IDLE" ? "QUIETITUDE" :
                   hexVal === "PURGE" ? "DETERMINATION" :
                   hexVal === "STEALTH" ? "SERENITY" :
                   hexVal === "ST_CRIT" ? "TENSION" :
                   hexVal === "TRANSIT" ? "COURAGE" :
                   hexVal === "LIMP_MODE" ? "VIGILANCE" : "CALM";

      const timestampMs = Date.now() - (index * 2000);
      const rawWord = (BigInt(currentHexagram) << 58n) |
                      (BigInt(timestampMs % 1099511627776) << 16n) |
                      (BigInt(vibe.charCodeAt(0) || 0x41) << 8n) |
                      BigInt((log.tick || tickCounter) % 256);
      const qbit = "0x" + rawWord.toString(16).toUpperCase().padStart(16, "0");

      return {
        id: `FT-${100 + index}`,
        prompt: `[I-CHING CONTEXT] Hexagram: ${hexVal} | Qbit: ${qbit} | Temp: ${log.temp?.toFixed(1) ?? "300"}K | Pressure: ${log.pressure?.toFixed(3) ?? "1.300"}atm | Active Faults: ${activeFaultCodes.length > 0 ? activeFaultCodes.join(",") : "NONE"}`,
        completion: `[ADAPTER COMPILER DETECTS] Vibe is ${vibe}. Apply Low-Rank correction to target modules. Parameter offset gradient step commits: Delta_W = BA, stable lock frequency verified at ${log.current ?? 1800}A.`,
        qbit,
        vibe
      };
    });
  }, [highSpeedLogs, currentHexagram, activeFaultCodes, tickCounter, avgElectrodeTemp, plenumPressure, busCurrentA, chokeState]);

  // Expose global getHexagram, setHexagram, getState, and getHealth helper methods
  useEffect(() => {
    (window as any).getHexagram = () => {
      return {
        code: currentHexagram,
        label: HexagramStateLabels[currentHexagram]?.split(" (")[0] || "IDLE"
      };
    };

    (window as any).setHexagram = (state: HexagramState) => {
      if (state in HexagramStateLabels) {
        onAddLogEntry(
          "SYSTEM" as any, 
          "SUCCESS", 
          `[getHexagram/setHexagram TRIGGER] Programmatic state update. Formulating dynamic registry path override to: ${HexagramStateLabels[state]}`
        );
        return true;
      }
      return false;
    };

    (window as any).getState = () => {
      return {
        timestamp: new Date().toISOString(),
        tickCounter,
        currentHexagram: {
          code: currentHexagram,
          label: HexagramStateLabels[currentHexagram]?.split(" (")[0] || "IDLE"
        },
        telemetry: {
          avgElectrodeTemp,
          plenumPressure,
          busCurrentA,
          symmetryOk,
        },
        biases: {
          temperatureBias,
          busCurrentBias,
          plenumPressureNominal
        },
        activeFaultCodes
      };
    };

    (window as any).getHealth = () => {
      const activeFaultsCount = activeFaultCodes.length;
      const score = Math.max(0, 100 - activeFaultsCount * 15 - (avgElectrodeTemp > 310 ? (avgElectrodeTemp - 300) * 1.5 : 0));
      return {
        timestamp: new Date().toISOString(),
        status: activeFaultsCount > 2 ? "CRITICAL" : activeFaultsCount > 0 ? "DEGRADED" : "NOMINAL",
        faultCodes: activeFaultCodes,
        healthScore: parseFloat(score.toFixed(1)),
        isSymmetric: symmetryOk
      };
    };

    return () => {
      delete (window as any).getHexagram;
      delete (window as any).setHexagram;
      delete (window as any).getState;
      delete (window as any).getHealth;
    };
  }, [
    currentHexagram, 
    tickCounter, 
    avgElectrodeTemp, 
    plenumPressure, 
    busCurrentA, 
    symmetryOk, 
    activeFaultCodes, 
    temperatureBias, 
    busCurrentBias, 
    plenumPressureNominal, 
    onAddLogEntry
  ]);

  // Synchronized High-Speed telemetry logging buffer logic (metabolic system ticks trigger logger writes)
  useEffect(() => {
    if (!isProfilingAcq || tickCounter === 0) return;
    if (tickCounter === lastLoggedTickRef.current) return;
    lastLoggedTickRef.current = tickCounter;

    const timestamp = new Date().toISOString().substring(11, 23);
    const id = `HS-${tickCounter}-${Math.floor(100 + Math.random() * 900)}`;

    const axiRegs = [
      "0x43C00010 (HEX_FSM)",
      "0x43C00204 (CON_SEQ)",
      "0x43C00328 (CHK_DRV)",
      "0x43C00400 (SEN_ACQ)",
      "0x43C00A00 (F_HEART)",
      "0x43C00A04 (C_METAS)",
      "0x43C00A08 (M_UTILS)",
      "0x43C00A14 (PM_DATA)"
    ];
    const chosenReg = axiRegs[Math.floor(Math.random() * axiRegs.length)];
    const accessType = Math.random() > 0.3 ? "AXI_RD" : "AXI_WR";
    const accessVal = Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, "0");
    const axiAccess = `[${accessType}] Reg ${chosenReg} -> VAL: 0x${accessVal}`;

    const contactorString = contactorStates.map(c => 
      c === ContactorState.CT_OPEN ? "O" : 
      c === ContactorState.CT_CLOSED ? "C" : 
      c === ContactorState.CT_CLOSING ? "g" : 
      c === ContactorState.CT_OPENING ? "o" : "F"
    ).join("");

    const newLog = {
      id,
      tick: tickCounter,
      timestamp,
      temp: parseFloat(avgElectrodeTemp.toFixed(2)),
      pressure: parseFloat(plenumPressure.toFixed(3)),
      current: Math.round(busCurrentA),
      hexagram: HexagramStateLabels[currentHexagram]?.split(" (")[0] || "IDLE",
      choke: ChokeStateLabels[chokeState] || "IDLE",
      contactors: contactorString,
      axiAccess
    };

    setHighSpeedLogs(prev => {
      const next = [...prev, newLog];
      if (next.length > 50) {
        next.shift();
      }
      return next;
    });

    // Perturb quantum alternative entropy rating dynamically
    setEntropyFactor(prev => {
      const diff = (avgElectrodeTemp / 4.0) + (plenumPressure * 8.0) + (Math.random() * 4.0);
      return Math.max(10.0, Math.min(99.0, parseFloat(diff.toFixed(1))));
    });

  }, [tickCounter, isProfilingAcq, avgElectrodeTemp, plenumPressure, busCurrentA, currentHexagram, chokeState, contactorStates]);

  // Player state JSON injection function
  const handleInjectOnPlayerString = () => {
    try {
      const cached = localStorage.getItem("pog2_mhd_player_state");
      let pObj: any = {};
      if (cached) {
        try {
          pObj = JSON.parse(cached);
        } catch (e) {
          pObj = { username: "pog2", x: 219, y: 511 };
        }
      } else {
        pObj = { username: "pog2", x: 219, y: 511 };
      }

      // Emotional profile selection matching hexagram state
      const profiling = currentHexagram === HexagramState.IDLE ? "QUIETUDE" :
                        currentHexagram === HexagramState.PURGE ? "DETERMINATION" :
                        currentHexagram === HexagramState.STEALTH ? "SERENITY" :
                        currentHexagram === HexagramState.ST_CRIT ? "TENSION" :
                        currentHexagram === HexagramState.TRANSIT ? "COURAGE" :
                        currentHexagram === HexagramState.LIMP_MODE ? "VIGILANCE" :
                        currentHexagram === HexagramState.TR_SALT ? "SERENITY" : "FEAR";

      const timestampMs = Date.now();
      const rawWord = (BigInt(currentHexagram) << 58n) |
                      (BigInt(timestampMs % 1099511627776) << 16n) |
                      (BigInt(profiling.charCodeAt(0) || 0x41) << 8n) |
                      BigInt(tickCounter % 256);

      const qbitHexWord = "0x" + rawWord.toString(16).toUpperCase().padStart(16, "0");
      const binaryBits = rawWord.toString(2).padStart(64, "0");
      const humanBinary = binaryBits.slice(0, 6) + "..." + binaryBits.slice(-16);

      const mhdDataset = {
        hexagram: currentHexagram,
        hexagramLabel: HexagramStateLabels[currentHexagram]?.split(" (")[0] || "IDLE",
        qbitHexWord,
        qbitBinaryString: binaryBits,
        humanBinaryFormatted: humanBinary,
        emotionalStamp: profiling,
        systemicTimestamp: new Date().toISOString(),
        metabolicClockTick: tickCounter,
        sensorLockData: {
          temperatureKelvin: parseFloat(avgElectrodeTemp.toFixed(2)),
          plenumAtmosphere: parseFloat(plenumPressure.toFixed(3)),
          busCurrentAmps: Math.round(busCurrentA),
          activeFaultsList: activeFaultCodes
        },
        actionables: [
          { command: "ENGAGE_MHD_RESONATOR", mode: "write", returnType: "TRANSITIONAL_SPIKE_A" },
          { command: "PURGE_CHAMBER_PNEUMATIC", mode: "write", returnType: "PLENUM_PRESSURE_ATM" },
          { command: "SET_STEALTH_MODE", mode: "write", returnType: "TAYLOR_SERIES_COEF" },
          { command: "GET_TELEMETRY_PACKET", mode: "read", returnType: "64_BIT_HEX" },
          { command: "DUMP_POST_MORTEM", mode: "read", returnType: "SRAM_JSON_REST" }
        ],
        returns: {
          lastInjectedOperation: "HEX_QBIT_STAMP",
          status: "SUCCESS_OK",
          transceiverParityOk: symmetryOk
        }
      };

      pObj.hexagramQbit = mhdDataset;
      pObj.lastClientActivity = Date.now();

      // Slightly alter positions mimicking regional wandering rules
      pObj.x = Math.max(50, Math.min(480, (pObj.x || 220) + (Math.random() > 0.5 ? 1 : -1)));
      pObj.y = Math.max(50, Math.min(480, (pObj.y || 512) + (Math.random() > 0.5 ? 1 : -1)));

      const updatedStr = JSON.stringify(pObj, null, 2);
      localStorage.setItem("pog2_mhd_player_state", updatedStr);
      setPlayerStateJsonStr(updatedStr);

      onAddLogEntry(
        SubsystemId.SECURE_LOCK,
        "SUCCESS",
        `[PLAYER_STRING] Stamped & injected 64-bit alternative qbit q=${qbitHexWord} and emotional=${profiling} on player key string.`
      );

      addPostMortemLog(
        "AXI_BUS",
        "0x43C00A10",
        "WARNING",
        `PLAYER STRING SYNC: Stamped qbit 64-bit configuration into localStorage (pog2_mhd_player_state).`
      );

      window.dispatchEvent(new Event("storage"));
    } catch (e: any) {
      onAddLogEntry("SYSTEM" as any, "CRITICAL", `[PLAYER STRING INJECT FAIL] Error: ${e.message}`);
    }
  };

  const handleTriggerTraining = () => {
    if (isTraining || isLoraTraining) return;
    setIsTraining(true);
    setTrainingProgress(0);
    setIsLoraMerged(false);
    onAddLogEntry("SYSTEM" as any, "INFO", `[ML_CO_PROCESSOR] Initiating baseline compression co-processor on ${highSpeedLogs.length} hexagram frames...`);

    // Stage 1: State Compression (1.5 seconds)
    const interval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsTraining(false);
          setSavedTrainingCount(c => c + highSpeedLogs.length);
          onAddLogEntry(
            "SYSTEM" as any,
            "SUCCESS",
            `[ML_CO_PROCESSOR] COMPRESS STAGE SUCCESS: Processed I-Ching qbit structures. Baseline weights adjusted.`
          );

          // Launch Stage 2: LoRA Fine-tuning on Hexagram Stamped Content/Context (2 seconds)
          setIsLoraTraining(true);
          setLoraProgress(0);
          setLoraCurrentLoss(2.84);
          setLoraLogs([
            `[LoRA INIT] Target adapter modules: [${loraTargetModules}] detected.`,
            `[LoRA INIT] Hyperparameters: Rank r=${loraRank}, Alpha a=${loraAlpha} (scaling=${(loraAlpha / loraRank).toFixed(2)}).`,
            `[LoRA INIT] Optimizer loaded: AdamW (lr=${loraLearningRate}, eps=1e-8).`,
            `[LoRA BOOT] Processing ${loraDataset.length} hexagram-stamped dataset patterns...`
          ]);
          onAddLogEntry("SYSTEM" as any, "INFO", `[LoRA FINE-TUNER] Booting Low-Rank Adaptation adapter fine-tuning on ${loraDataset.length} hexagram stamped samples...`);

          let loraStep = 0;
          const loraInterval = setInterval(() => {
            loraStep += 10;
            setLoraProgress(loraStep);

            // Compute realistic declining training loss
            const stepFraction = loraStep / 100;
            const currentLoss = 2.84 * Math.exp(-3.2 * stepFraction) + (Math.random() * 0.04);
            setLoraCurrentLoss(parseFloat(currentLoss.toFixed(4)));

            // Log step progress
            if (loraStep === 20) {
              setLoraLogs(prev => [
                ...prev,
                `[LoRA STEP 10/50] Loss: ${currentLoss.toFixed(4)} | Rank space Projection matrices A, B initialized.`
              ]);
            } else if (loraStep === 50) {
              setLoraLogs(prev => [
                ...prev,
                `[LoRA STEP 25/50] Loss: ${currentLoss.toFixed(4)} | Gradient norms bounds check passed.`
              ]);
            } else if (loraStep === 80) {
              setLoraLogs(prev => [
                ...prev,
                `[LoRA STEP 40/50] Loss: ${currentLoss.toFixed(4)} | Custom emotional weights aligned on qbit superposition vectors.`
              ]);
            }

            if (loraStep >= 100) {
              clearInterval(loraInterval);
              setIsLoraTraining(false);
              setIsLoraMerged(true);
              setLoraCurrentLoss(0.0384);
              
              setLoraLogs(prev => [
                ...prev,
                `[LoRA COMPLETE] Delta Weight Delta_W matrices successfully populated. Rank bounds checked.`,
                `[LoRA COMPLETE] Output adapter checkpoint: \`pog2_mhd_lora_r${loraRank}_a${loraAlpha}.safetensors\`.`,
                `[LoRA MERGE] Successfully folded low-rank adapter back into central intelligence model context.`
              ]);

              onAddLogEntry(
                "SYSTEM" as any,
                "SUCCESS",
                `[LoRA CO-PROCESSOR] Low-Rank Adaptation (r=${loraRank}, a=${loraAlpha}) complete. Hexagram-stamped fine-tuned adapter merged. Final validation loss: 0.0384.`
              );

              // Add post mortem log entry
              addPostMortemLog(
                "FSM_ST",
                "0x43C00A14",
                "WARNING",
                `LoRA ADAPTER MERGED: Fine-tuned hexagram context compiled dynamically with loss=0.0384.`
              );
            }
          }, 150);

          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };


  const [postMortemFilterSource, setPostMortemFilterSource] = useState<string>("ALL");
  const [postMortemFilterSeverity, setPostMortemFilterSeverity] = useState<string>("ALL");
  const [postMortemSearchText, setPostMortemSearchText] = useState("");

  // Select Register mapping index for AXI post-mortem readback simulator register
  const [readIndexCursor, setReadIndexCursor] = useState(0);

  // Heartbeats (increases continuously to show live pulsing activity)
  const [heartbeatPulses, setHeartbeatPulses] = useState({
    HEX_FSM: 0,
    CON_SEQ: 0,
    CHK_DRV: 0,
    SEN_ACQ: 0,
    TEL_ENC: 0,
    SYS_HLT: 0
  });

  // Keep a command line input scroll ref
  const terminalLogsEndRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // PULSING HEARTBEATS TICK STEPPER
  // ==========================================================================
  useEffect(() => {
    if (tickCounter === 0) return;
    setHeartbeatPulses((prev) => ({
      HEX_FSM: prev.HEX_FSM + (Math.random() > 0.1 ? 1 : 0),
      CON_SEQ: prev.CON_SEQ + (Math.random() > 0.05 ? 1 : 0),
      CHK_DRV: prev.CHK_DRV + (chokeState !== ChokeState.CH_IDLE ? 2 : 0),
      SEN_ACQ: prev.SEN_ACQ + 1,
      TEL_ENC: prev.TEL_ENC + 1,
      SYS_HLT: prev.SYS_HLT + 1
    }));
  }, [tickCounter, chokeState]);

  // ==========================================================================
  // HELPER FOR POST-MORTEM DB LOG INSERTION
  // ==========================================================================
  const addPostMortemLog = (
    source: PostMortemLog["source"],
    hexAddr: string,
    level: PostMortemLog["level"],
    message: string
  ) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    setPostMortemLogs((prev) => {
      // Eliminate duplicates of identical error within last 3 entries
      const slicedLast = prev.slice(-3);
      if (slicedLast.some((log) => log.message === message)) {
        return prev;
      }

      let nextId = 1;
      if (prev.length > 0) {
        const lastLog = prev[prev.length - 1];
        const match = lastLog.id.match(/PM-(\d+)/);
        if (match) {
          nextId = parseInt(match[1], 10) + 1;
        } else {
          nextId = prev.length + 1;
        }
      }
      const newLog: PostMortemLog = {
        id: `PM-${nextId.toString().padStart(3, "0")}`,
        tick: tickCounter,
        timestamp,
        source,
        hexAddr,
        level,
        message
      };

      const copy = [...prev, newLog];
      if (copy.length > 32) {
        copy.shift(); // Strictly enforce 32-deep internal FIFO size limitation
      }
      return copy;
    });

    // Mirror vital logs to the master System Logs console in UI outer panels
    onAddLogEntry(
      source === "AXI_BUS" ? SubsystemId.SECURE_LOCK : 
      source === "SENSOR_ANOMALY" ? SubsystemId.THERMAL :
      source === "CDC_CLOCKY" ? SubsystemId.CDC_CLOCKING : 
      SubsystemId.INTERLOCK_SEQUENCE,
      level === "FATAL" ? "CRITICAL" : level === "WARNING" ? "WARNING" : "CRITICAL",
      `[POST_MORTEM] ${source} anomaly: ${message} (Registered ADDR: ${hexAddr})`
    );
  };

  // ==========================================================================
  // DETECT UNEXPECTED STATE TRANSITIONS IN FSMs
  // ==========================================================================
  const prevHexRef = useRef<HexagramState>(currentHexagram);
  const prevContactorStatesRef = useRef<ContactorState[]>(contactorStates);
  const prevChokeStateRef = useRef<ChokeState>(chokeState);

  useEffect(() => {
    // 1. Hexagram transition check
    if (prevHexRef.current !== currentHexagram) {
      const from = prevHexRef.current;
      const to = currentHexagram;
      const isPermitted = VALID_TRANSITIONS.some((path) => path.from === from && path.to === to);
      
      if (!isPermitted && from !== HexagramState.IDLE) {
        addPostMortemLog(
          "FSM_ST",
          "0x43C00010",
          "CRITICAL",
          `UNEXPECTED HEXAGRAM SEQUENCE PATH DETECTED: Illegal transition attempt ${HexagramStateLabels[from]?.split(" (")[0]} -> ${HexagramStateLabels[to]?.split(" (")[0]}. Target was bypassed.`
        );
      }
      prevHexRef.current = currentHexagram;
    }

    // 2. Contactor transition checks (Verify strict chronological state sequencing)
    contactorStates.forEach((state, i) => {
      const prevState = prevContactorStatesRef.current[i];
      if (prevState !== undefined && prevState !== state) {
        // Unexpected jump paths e.g. Open directly to Closed (skipping closing delay)
        let hasAnomaly = false;
        let desc = "";

        if (prevState === ContactorState.CT_OPEN && state === ContactorState.CT_CLOSED) {
          hasAnomaly = true;
          desc = `Contactor CT${i} bypassed CLOSING delay state; jumped directly from OPEN -> CLOSED. Possible timing constraint collision.`;
        } else if (prevState === ContactorState.CT_CLOSED && state === ContactorState.CT_OPEN) {
          hasAnomaly = true;
          desc = `Contactor CT${i} bypassed OPENING snubber arc-suppressed state; jumped directly from CLOSED -> OPEN. Welded contact danger.`;
        } else if (prevState === ContactorState.CT_FAULT && state === ContactorState.CT_CLOSED) {
          hasAnomaly = true;
          desc = `Contactor CT${i} forced directly into CLOSED from active hardware FAULT lock state without intermediate safe recalibration.`;
        }

        if (hasAnomaly) {
          addPostMortemLog("FSM_ST", "0x43C00200", "WARNING", `CONTACTOR SEQ EXPORT ERROR: ${desc}`);
        }
      }
    });
    prevContactorStatesRef.current = [...contactorStates];

    // 3. Choke Driver sequence sanity check
    if (prevChokeStateRef.current !== chokeState) {
      const prevCh = prevChokeStateRef.current;
      const nextCh = chokeState;

      if (prevCh === ChokeState.CH_IDLE && nextCh === ChokeState.CH_RESONANT) {
        addPostMortemLog(
          "FSM_ST",
          "0x43C00328",
          "WARNING",
          `CHOKE RESONANCE RAMP FAILURE: Resonant phase tracking skipped CH_TRACKING locks; jumped directly CH_IDLE -> CH_RESONANT.`
        );
      }
      prevChokeStateRef.current = chokeState;
    }
  }, [currentHexagram, contactorStates, chokeState]);

  // ==========================================================================
  // DETECT CRITICAL SENSOR DATA ANOMALIES
  // ==========================================================================
  const lastAvgTempRef = useRef<number>(avgElectrodeTemp);
  useEffect(() => {
    // A. Check for thermal runaway rate limit checks (dT/dt > 4.5 K/s)
    const dt = avgElectrodeTemp - lastAvgTempRef.current;
    if (Math.abs(dt) > 4.5 && tickCounter > 0) {
      addPostMortemLog(
        "SENSOR_ANOMALY",
        "0x43C00400",
        "FATAL",
        `THERMAL ACCELERATION THRESHOLD BREACH: dT/dt heating spike is ${dt.toFixed(2)} K/tick. Outpaces safety cooling capabilities.`
      );
    }
    lastAvgTempRef.current = avgElectrodeTemp;

    // B. Out of Range parameters checks
    if (avgElectrodeTemp < 150.0 || avgElectrodeTemp > 450.0) {
      addPostMortemLog(
        "SENSOR_ANOMALY",
        "0x43C00400",
        "CRITICAL",
        `ADC HARD LIMIT SATURATION FEEDS: Temperature channel read value ${avgElectrodeTemp.toFixed(1)}K exceeds cryogenic or absolute melting limits.`
      );
    }

    if (plenumPressure < 0.2 || plenumPressure > 3.0) {
      addPostMortemLog(
        "SENSOR_ANOMALY",
        "0x43C00414",
        "CRITICAL",
        `PRESSURE TRANSDUCER SATURATION: Plenum pressure read ${plenumPressure.toFixed(2)} atm is outside operational bounds limits.`
      );
    }

    // C. Sensor divergence checks
    if (faultInjectSensorDivergence) {
      addPostMortemLog(
        "SENSOR_ANOMALY",
        "0x43C00400",
        "WARNING",
        `PRIMARY/SECONDARY THERMOCOUPLE Divergence: Multi-channel sensors drift recorded over acceptable differential threshold (>15 Kelvin divergence).`
      );
    }

    // D. Missing sensor data / stuck signals
    if (plenumPressure === 0.0 && plenumPressureNominal !== 0) {
      // Stuck at-zero fault or missing transducer connector
      addPostMortemLog(
        "SENSOR_ANOMALY",
        "0x43C00414",
        "WARNING",
        `SIGNAL LOGIC ERROR: Plenum pressure stuck-at-zero detected. Expected physical pressure feedback but found null/missing logic.`
      );
    }
  }, [avgElectrodeTemp, plenumPressure, tickCounter, faultInjectSensorDivergence]);

  // ==========================================================================
  // MONITORS FOR FAULT INJECTION SIGNALS
  // ==========================================================================
  useEffect(() => {
    if (faultInjectAxiTimeout) {
      addPostMortemLog(
        "AXI_BUS",
        "0x43C0DEAD",
        "FATAL",
        `AXI REGISTER DECODING EXCEPTION CHIP: Bus decoding interconnect flagged DECERR boundary violation at unmapped address 0x43C0DEAD.`
      );
    }
  }, [faultInjectAxiTimeout]);

  useEffect(() => {
    if (faultInjectAxiReadbackMismatch) {
      addPostMortemLog(
        "AXI_BUS",
        "0x43C0009C",
        "WARNING",
        `AXI WRITE/READ INTEGRITY CHECK FAILURE: Bus master readback SLVERR parity mismatch. Written state cell did not reconcile with static cache.`
      );
    }
  }, [faultInjectAxiReadbackMismatch]);

  useEffect(() => {
    if (faultInjectCdcDesync) {
      addPostMortemLog(
        "CDC_CLOCKY",
        "0x43C00614",
        "CRITICAL",
        `CLOCK CROSSING HANDSHAKING GLITCH: Double flip-flop synchronizer flagged metastability loss across CDC boundary domains.`
      );
    }
  }, [faultInjectCdcDesync]);

  useEffect(() => {
    if (faultInjectCdcDrift) {
      addPostMortemLog(
        "CDC_CLOCKY",
        "0x43C0061C",
        "WARNING",
        `PL INTERNAL OSCILLATOR SKEW WARNING: Transmitted metadata clock skew drifted above allowed timing thresholds (>85 ps).`
      );
    }
  }, [faultInjectCdcDrift]);

  // ==========================================================================
  // HARDWARE RECOVERY STATE DERIVATIVES & CLK
  // ==========================================================================
  const physicalFrequencyHz = activeFaultCodes.includes("C-01") ? 200000000 : 250000000;
  
  // Dynamic metrics
  const clockDriftKhz = faultInjectCdcDrift ? 240.5 : (Math.sin(tickCounter * 0.1) * 3.5);
  const worstNegativeSlackWns = faultInjectCdcDesync ? -0.045 : (0.114 + Math.sin(tickCounter * 0.2) * 0.012);
  const clockStabilityFactor = Math.abs(worstNegativeSlackWns) > 0 ? Math.max(25, Math.min(100, Math.round(100 - (Math.abs(clockDriftKhz) * 0.15)))) : 98;

  // AXI address bus packet captures
  const capturedAxiReadsCount = tickCounter > 0 ? (12 + tickCounter * 4) : 0;
  const capturedAxiWritesCount = tickCounter > 0 ? (8 + tickCounter * 2) : 0;
  const registerCacheMemoryPercent = Math.round((28 / 64) * 100);

  // ==========================================================================
  // SIMULATED AXI REGISTER VALUE MAPPING FOR READBACK CMDs
  // ==========================================================================
  const readSimulatedAxiRegister = (addr: string): string => {
    const rawAddr = addr.replace(/^0x/i, "").toUpperCase();
    
    // Address mapping translations
    switch (rawAddr) {
      case "43C00000": return "0x504F4732 ('POG2' magic ID)";
      case "43C00004": return "0x00010000 (VHDL IP Core Rev 1.0)";
      case "43C00010": return `0x${currentHexagram.toString(16).toUpperCase().padStart(2, "0")} (${HexagramStateLabels[currentHexagram]?.split(" (")[0]})`;
      case "43C00200": return `0x${contactorStates.reduce((acc, val, i) => acc | (val === ContactorState.CT_CLOSED ? (1 << i) : 0), 0).toString(16).toUpperCase()} (Contactor Status register)`;
      case "43C00400": return `0x${Math.round(avgElectrodeTemp * 10).toString(16).toUpperCase()} (${avgElectrodeTemp.toFixed(1)}K Readout)`;
      case "43C00610": return `0x43C0${clockStabilityFactor.toString(16).toUpperCase()}0 (Stability registry)`;
      case "43C00618": {
        // Module Heartbeats bit packing
        let hbByte = 0;
        if (heartbeatPulses.HEX_FSM % 2 === 0) hbByte |= (1 << 0);
        if (heartbeatPulses.CON_SEQ % 2 === 0) hbByte |= (1 << 1);
        if (heartbeatPulses.CHK_DRV % 2 === 0) hbByte |= (1 << 2);
        if (heartbeatPulses.SEN_ACQ % 2 === 0) hbByte |= (1 << 3);
        if (heartbeatPulses.TEL_ENC % 2 === 0) hbByte |= (1 << 4);
        if (heartbeatPulses.SYS_HLT % 2 === 0) hbByte |= (1 << 5);
        return `0x${hbByte.toString(16).toUpperCase().padStart(8, "0")} (CDC Pulsing Matrix)`;
      }
      case "43C00A00": return `0x${postMortemLogs.length.toString(16).toUpperCase()} (Current ${postMortemLogs.length} logged anomalies)`;
      case "43C00A10": return `0x${readIndexCursor.toString(16).toUpperCase()} (Post-mortem FIFO selector cursor)`;
      case "43C00A14": {
        const item = postMortemLogs[readIndexCursor];
        if (item) {
          return `LOG_PM_${item.id} | Tick: ${item.tick} | Src: ${item.source} | Msg: ${item.message.substring(0, 30)}...`;
        }
        return "0x00000000 (No log segment selected at current address)";
      }
      default: {
        if (rawAddr.startsWith("43C00A")) {
          return "0x00000000 (Health Mon region register)";
        }
        return "0xFFFFFFFF (unmapped physical memory region DECERR address exception)";
      }
    }
  };

  // ==========================================================================
  // INTERACTIVE CLINICAL SHELL PARSER
  // ==========================================================================
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const cmdLine = cliInput.trim();
    const parts = cmdLine.split(/\s+/);
    const command = parts[0].toLowerCase();
    const arg0 = parts[1];
    const arg1 = parts[2];

    let responseLines: string[] = [];
    responseLines.push(`$ pog2-sh> ${cmdLine}`);

    switch (command) {
      case "help":
        responseLines.push(
          "Available Diagnostics & Management Instructions:",
          "  help               - Output the command manual handbook",
          "  health-chk         - Evaluate CDC sync, timing slacks, and heartbeats",
          "  pm-dump            - Dump core post-mortem FIFO log registers",
          "  axi-read <addr>    - Read 32-bit register (e.g. AXI base 0x43C00000)",
          "  axi-write <ad> <v> - Transmit master register write command",
          "  clear-posts        - Wipe FIFO log memory allocations",
          "  clear              - Wipe shell logs text cache"
        );
        break;

      case "health-chk": {
        const cdcStatus = worstNegativeSlackWns < 0 ? "METASTABLE_VIOLATION 🔴" : "STABLE / PHASE_LOCKED 🟢";
        const tempAnomCount = postMortemLogs.filter(l => l.source === "SENSOR_ANOMALY").length;
        const axiAnomCount = postMortemLogs.filter(l => l.source === "AXI_BUS").length;
        responseLines.push(
          "============================================================",
          "              FPGA PL SYSTEM CORE INTEGRITY REPORT           ",
          "============================================================",
          `  SYSTEM TICK       : #${tickCounter} elapsed metabolic cycles`,
          `  FABRIC REF CLOCK  : ${(physicalFrequencyHz / 1e6).toFixed(2)} MHz [Stability: ${clockStabilityFactor}%]`,
          `  OSCILLATOR DRIFT  : ${clockDriftKhz.toFixed(2)} KHz [Timing WNS: ${worstNegativeSlackWns.toFixed(3)} ns]`,
          `  CDC SIGNALS STATUS: ${cdcStatus}`,
          `  LOG MEMORY STOCK  : ${postMortemLogs.length} / 32 slots consumed [SRAM Occupancy: ${((postMortemLogs.length / 32)*100).toFixed(1)}%]`,
          "------------------------------------------------------------",
          "  MODULE HEARTBEATS COUNTERS MATRIX:",
          `    - HEXAGRAM_FSM_CORE   : ${heartbeatPulses.HEX_FSM.toString().padStart(6)} cycles`,
          `    - CONTACTOR_SEQ_LOGIC : ${heartbeatPulses.CON_SEQ.toString().padStart(6)} cycles`,
          `    - CHOKE_RESONANCE_DRV : ${heartbeatPulses.CHK_DRV.toString().padStart(6)} cycles`,
          `    - SENSOR_ACQUIS_FILTER: ${heartbeatPulses.SEN_ACQ.toString().padStart(6)} cycles`,
          "------------------------------------------------------------",
          `  ANOMALIES DIAGNOSED: ${tempAnomCount} Sensors | ${axiAnomCount} Bus | Total ${postMortemLogs.length} incidents`,
          symmetryOk 
            ? "  COMPLEMENTARY RETROGRADE STATUS: REGISTERED NOMINAL ALIGN 🟢" 
            : "  COMPLEMENTARY RETROGRADE STATUS: RETROGRADE SYMMETRY DELAY ERROR 🔴",
          "============================================================"
        );
        break;
      }

      case "clear":
        setCliHistory([]);
        setCliInput("");
        return;

      case "clear-posts":
        setPostMortemLogs([]);
        addPostMortemLog("AXI_BUS", "0x43C00A00", "WARNING", "Wiped Post-Mortem FIFO storage allocations via command invocation.");
        responseLines.push("FIFO Ring buffer reset successfully.");
        break;

      case "pm-dump":
        responseLines.push(
          "======================================================",
          "        POST-MORTEM EVENT BUFFER REGISTER DUMP",
          "======================================================"
        );
        if (postMortemLogs.length === 0) {
          responseLines.push("  [Core buffer empty. Standing by for hardware faults.]");
        } else {
          postMortemLogs.forEach((log) => {
            responseLines.push(
              `  [${log.timestamp}][T:${log.tick.toString().padStart(3)}] ID:${log.id} | SRC:${log.source} | ADDR:${log.hexAddr} | LVL:${log.level} | ${log.message}`
            );
          });
        }
        responseLines.push("======================================================");
        break;

      case "axi-read":
        if (!arg0) {
          responseLines.push("ERROR: Target address argument missing. Usage: axi-read <address>");
        } else {
          const formattedAddr = arg0.startsWith("0x") ? arg0 : `0x${arg0}`;
          if (!formattedAddr.toLowerCase().startsWith("0x43c0")) {
            // DECERR out of range trigger simulation
            addPostMortemLog(
              "AXI_BUS",
              formattedAddr,
              "FATAL",
              `ILLEGAL BUS MEMORY ACCESS: Reading outside mapped hardware Zynq periphery (BASE range: 0x43C00000..0x43C00C00). Interconnect DECERR issued.`
            );
            responseLines.push(`ERROR: AXI bus master address DECERR read violation at range '${formattedAddr}'! Logged PM anomaly.`);
          } else {
            const data = readSimulatedAxiRegister(formattedAddr);
            responseLines.push(`  READ REGISTER [${formattedAddr}] ➔ ${data}`);
          }
        }
        break;

      case "axi-write":
        if (!arg0 || !arg1) {
          responseLines.push("ERROR: Address and value arguments required. Usage: axi-write <address> <value>");
        } else {
          const formattedAddr = arg0.startsWith("0x") ? arg0 : `0x${arg0}`;
          const valHex = arg1.startsWith("0x") ? arg1 : `0x${arg1}`;

          if (!formattedAddr.toLowerCase().startsWith("0x43c0")) {
            // DECERR write exception
            addPostMortemLog(
              "AXI_BUS",
              formattedAddr,
              "FATAL",
              `ILLEGAL WRITE ACCESS: attempted to commit control word to unmapped physical memory register address ${formattedAddr}. Intercept DECERR.`
            );
            responseLines.push(`ERROR: AXI DECERR Address decoding exception during Master register write [${formattedAddr}] ➔ [${valHex}]!`);
          } else {
            // Simulated register write
            if (formattedAddr === "0x43C00A10") {
              const selectedIndex = parseInt(arg1, 10);
              if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= 32) {
                responseLines.push(`ERROR: Cursor allocation fault. Cursor index '${selectedIndex}' exceeds FIFO log array ring size (32).`);
              } else {
                setReadIndexCursor(selectedIndex);
                responseLines.push(`  WRITE SUCCESS: Address [0x43C00A10] logged selection cursor ➔ ${selectedIndex}`);
              }
            } else {
              // Simulated write mapping
              responseLines.push(`  WRITE REGISTER [${formattedAddr}] ➔ [${valHex}] successfully acknowledged. Parity echo validated.`);
            }
          }
        }
        break;

      default:
        responseLines.push(
          `Command exception: term '${command}' is unmapped.`,
          "Type 'help' for command definitions handbook."
        );
        break;
    }

    setCliHistory((prev) => [...prev, ...responseLines]);
    setCliInput("");
  };

  // Scroll terminal to the bottom when history appends
  useEffect(() => {
    terminalLogsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cliHistory]);

  // ==========================================================================
  // HIGH SPEED TELEMETRY FILTERING & EXPORTS
  // ==========================================================================
  const filteredHighSpeed = useMemo(() => {
    return highSpeedLogs.filter(log => {
      if (!searchHighSpeed) return true;
      const term = searchHighSpeed.toLowerCase();
      return log.timestamp.toLowerCase().includes(term) ||
             log.hexagram.toLowerCase().includes(term) ||
             log.choke.toLowerCase().includes(term) ||
             log.id.toLowerCase().includes(term) ||
             log.axiAccess.toLowerCase().includes(term);
    });
  }, [highSpeedLogs, searchHighSpeed]);

  const handleExportData = (format: "json" | "csv") => {
    try {
      let content = "";
      let mimeType = "";
      let filename = "";

      if (format === "json") {
        content = JSON.stringify(highSpeedLogs, null, 2);
        mimeType = "application/json";
        filename = `pog2_mhd_highspeed_telemetry_tick_${tickCounter}.json`;
      } else {
        const headers = ["ID", "Timestamp", "Tick", "Temp(K)", "Pressure(atm)", "Current(A)", "Hexagram", "Choke", "Contactors", "AXI_Access"];
        const rows = highSpeedLogs.map(log => [
          log.id, 
          log.timestamp, 
          log.tick, 
          log.temp, 
          log.pressure, 
          log.current, 
          log.hexagram, 
          log.choke, 
          log.contactors, 
          `"${log.axiAccess.replace(/"/g, '""')}"`
        ]);
        content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        mimeType = "text/csv";
        filename = `pog2_mhd_highspeed_telemetry_tick_${tickCounter}.csv`;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onAddLogEntry(
        "SYSTEM" as any, 
        "SUCCESS", 
        `Exported high-speed buffer logs containing ${highSpeedLogs.length} frames to ${filename} successfully.`
      );
    } catch (e: any) {
      onAddLogEntry("SYSTEM" as any, "CRITICAL", `Failed to export high-speed buffer telemetry: ${e.message}`);
    }
  };

  // ==========================================================================
  // LOG DATA FILTERING & SORTING
  // ==========================================================================
  const filteredLogs = useMemo(() => {
    return postMortemLogs.filter((log) => {
      const matchSource = postMortemFilterSource === "ALL" || log.source === postMortemFilterSource;
      const matchSeverity = postMortemFilterSeverity === "ALL" || log.level === postMortemFilterSeverity;
      const matchText = log.message.toLowerCase().includes(postMortemSearchText.toLowerCase()) || 
                        log.hexAddr.toLowerCase().includes(postMortemSearchText.toLowerCase()) || 
                        log.id.toLowerCase().includes(postMortemSearchText.toLowerCase());
      return matchSource && matchSeverity && matchText;
    });
  }, [postMortemLogs, postMortemFilterSource, postMortemFilterSeverity, postMortemSearchText]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-6" id="system-health-dashboard-wrapper">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-850 pb-4 select-none">
        <div>
          <h2 className="text-sm font-bold tracking-wider font-display text-slate-100 flex items-center gap-2 uppercase">
            <Radio className="h-5 w-5 text-emerald-400 animate-pulse" />
            VHDL Real-Time System Health & KPI Monitor
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            CO-SIMULATOR PERFORMANCE ASSURANCE SUITE & COPROCESSOR FAULT DECODER STACKS
          </p>
        </div>
        
        {/* Dynamic global metrics */}
        <div className="flex gap-4 mt-3 md:mt-0 font-mono text-[9px] items-center">
          <button
            onClick={() => setIsAudioMuted(prev => !prev)}
            className={`px-2 py-1 rounded border font-mono font-bold flex items-center gap-1.5 transition-all text-[8px] cursor-pointer outline-none ${
              isAudioMuted 
                ? "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400 hover:bg-slate-900" 
                : "bg-emerald-950/30 text-emerald-400 border-emerald-900 hover:bg-emerald-900/10"
            }`}
            title={isAudioMuted ? "Click to enable spoken alerts for system faults" : "Click to mute spoken alerts"}
            id="fault-audio-toggle"
          >
            {isAudioMuted ? (
              <>
                <VolumeX className="h-3 w-3 text-slate-500" />
                VOICE: MUTED
              </>
            ) : (
              <>
                <Volume2 className="h-3 w-3 text-emerald-400 animate-pulse" />
                VOICE: ACTIVE
              </>
            )}
          </button>

          <div className="bg-slate-950 px-2 py-1 rounded border border-slate-850 flex items-center gap-1.5">
            <span className="text-slate-550">CLOCK DRIFT:</span>
            <span className={`font-bold ${Math.abs(clockDriftKhz) > 100 ? "text-amber-400" : "text-cyan-400"}`}>
              {clockDriftKhz > 0 ? "+" : ""}{clockDriftKhz.toFixed(1)} KHz
            </span>
          </div>
          <div className="bg-slate-950 px-2 py-1 rounded border border-slate-850 flex items-center gap-1.5">
            <span className="text-slate-550">SLACK WNS:</span>
            <span className={`font-bold ${worstNegativeSlackWns < 0 ? "text-red-400" : "text-emerald-400"}`}>
              {worstNegativeSlackWns.toFixed(3)} ns
            </span>
          </div>
          <div className="bg-slate-950 px-2 py-1 rounded border border-slate-850 flex items-center gap-1.5">
            <span className="text-slate-550">STABILITY:</span>
            <span className={`font-bold ${clockStabilityFactor < 85 ? "text-amber-400 animate-pulse" : "text-emerald-400"}`}>
              {clockStabilityFactor}%
            </span>
          </div>
        </div>
      </div>

      {/* REMAINDER COMPONENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: MODULE HEALTH METRICS & CDC INTERFACE REGISTER CARD (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Card 1: Module Heartbeat Signals */}
          <div className="bg-slate-950/75 border border-slate-850 rounded-lg p-4 space-y-4" id="hb-signals-card">
            <div className="flex justify-between items-center pb-2 border-b border-slate-900 select-none">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-emerald-400" />
                VHDL module execution heartbeats
              </span>
              <span className="text-[7.5px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-900/40 animate-pulse">
                SYS_CLK_ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
              
              {/* HE_01 */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-850 flex flex-col justify-between h-16 relative overflow-hidden group">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">HEXAGRAM_FSM</span>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                </div>
                <div className="text-[8.5px] text-slate-550 mt-1 select-all">ADDR: 0x43C00010</div>
                <div className="flex justify-between items-end mt-0.5 select-none">
                  <span className="font-bold text-slate-100">{heartbeatPulses.HEX_FSM.toString()} HZ</span>
                  <span className="text-[7px] text-slate-550 group-hover:text-emerald-400 transition-colors uppercase">RUNNING</span>
                </div>
              </div>

              {/* HE_02 */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-850 flex flex-col justify-between h-16 relative overflow-hidden group">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">CONTACTOR_SEQ</span>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                </div>
                <div className="text-[8.5px] text-slate-550 mt-1 select-all">ADDR: 0x43C00204</div>
                <div className="flex justify-between items-end mt-0.5 select-none">
                  <span className="font-bold text-slate-100">{heartbeatPulses.CON_SEQ.toString()} HZ</span>
                  <span className="text-[7px] text-slate-550 group-hover:text-emerald-400 transition-colors uppercase">NOMINAL</span>
                </div>
              </div>

              {/* HE_03 */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-850 flex flex-col justify-between h-16 relative overflow-hidden group">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">CHOKE_RES_PWM</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${chokeState !== ChokeState.CH_IDLE ? "bg-emerald-500 animate-ping" : "bg-slate-700"}`} />
                </div>
                <div className="text-[8.5px] text-slate-550 mt-1 select-all">ADDR: 0x43C00328</div>
                <div className="flex justify-between items-end mt-0.5 select-none">
                  <span className="font-bold text-slate-100">{heartbeatPulses.CHK_DRV.toString()} HZ</span>
                  <span className="text-[7px] text-slate-550 group-hover:text-emerald-400 transition-colors uppercase">
                    {chokeState === ChokeState.CH_IDLE ? "STANDBY" : "ACTIVE"}
                  </span>
                </div>
              </div>

              {/* HE_04 */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-850 flex flex-col justify-between h-16 relative overflow-hidden group">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">SENSOR_ACQ_FLT</span>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                </div>
                <div className="text-[8.5px] text-slate-550 mt-1 select-all">ADDR: 0x43C00400</div>
                <div className="flex justify-between items-end mt-0.5 select-none">
                  <span className="font-bold text-slate-100">{heartbeatPulses.SEN_ACQ.toString()} HZ</span>
                  <span className="text-[7px] text-slate-550 group-hover:text-emerald-400 transition-colors uppercase">ACQUIRING</span>
                </div>
              </div>

            </div>
          </div>

          {/* Card 2: Memory & Relational Register utilization */}
          <div className="bg-slate-950/75 border border-slate-850 rounded-lg p-4 space-y-3.5 select-none" id="mem-kpis-card">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Database className="h-4 w-4 text-cyan-405" />
              AXI Register Cache Memory Allocation KPIs
            </span>

            <div className="space-y-3 font-mono text-[9.5px]">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500 uppercase">Periphery register cache density</span>
                  <span className="text-slate-300 font-bold">{registerCacheMemoryPercent}% [28/64 Regs]</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${registerCacheMemoryPercent}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500 uppercase">Post-mortem FIFO log buffer occupancy</span>
                  <span className="text-slate-300 font-bold">{postMortemLogs.length} / 32 cells used</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${postMortemLogs.length >= 24 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} style={{ width: `${(postMortemLogs.length / 32) * 100}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] pt-1">
                <div className="bg-slate-900 p-2 rounded border border-slate-850 leading-relaxed">
                  <div className="text-slate-500 uppercase text-[8px]">TOTAL AXI READS</div>
                  <div className="text-cyan-400 font-bold font-mono text-xs mt-0.5">{statReadCount} calls</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-850 leading-relaxed">
                  <div className="text-slate-500 uppercase text-[8px]">TOTAL AXI WRITES</div>
                  <div className="text-cyan-400 font-bold font-mono text-xs mt-0.5">{statWriteCount} calls</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-850 leading-relaxed">
                  <div className="text-slate-500 uppercase text-[8px]">ACTIVE THROUGHPUT</div>
                  <div className="text-emerald-400 font-bold font-mono text-xs mt-0.5">{bandwidthMBs.toFixed(2)} MB/s</div>
                </div>
                <div className={`p-2 rounded border leading-relaxed transition-all duration-300 ${statAxiErrorCount > 0 ? "bg-red-950/40 border-red-900" : "bg-slate-900 border-slate-850"}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase text-[8px]">AXI BUS ERRORS</span>
                    {statAxiErrorCount > 0 && (
                      <span className="bg-red-500 text-white font-extrabold text-[7px] px-1 rounded animate-pulse">
                        ALERT
                      </span>
                    )}
                  </div>
                  <div className={`font-bold font-mono text-xs mt-0.5 ${statAxiErrorCount > 0 ? "text-red-400 font-extrabold pb-0.5" : "text-slate-400"}`}>
                    {statAxiErrorCount} errors
                  </div>
                </div>
              </div>

              {/* Real-time AXI Bus Latency Sparkline and Frequency Histogram Switcher */}
              <div className="mt-3.5 pt-3.5 border-t border-slate-900/60 font-mono">
                <div className="flex justify-between items-center text-[9px] mb-2">
                  <span className="text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1.5">
                    <span>RESOLUTION:</span>
                    <button 
                      onClick={() => setLatencyView("trend")} 
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition text-[8px] font-bold ${latencyView === "trend" ? "bg-cyan-950 text-cyan-400 border border-cyan-800" : "bg-slate-900 text-slate-500 hover:text-slate-350"}`}
                    >
                      TREND
                    </button>
                    <button 
                      onClick={() => setLatencyView("distribution")} 
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition text-[8px] font-bold ${latencyView === "distribution" ? "bg-purple-950 text-purple-400 border border-purple-800" : "bg-slate-900 text-slate-500 hover:text-slate-350"}`}
                    >
                      HISTOGRAM
                    </button>
                  </span>
                  <div className="flex gap-2 text-[8px]">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                      W_LAT: {avgWriteLatency}c
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                      R_LAT: {avgReadLatency}c
                    </span>
                  </div>
                </div>
                
                {latencyView === "trend" ? (
                  <div className="bg-slate-900/80 border border-slate-900 rounded p-1.5 h-[72px] flex items-center justify-center relative">
                    {axiLatencyHistory && axiLatencyHistory.length > 1 ? (
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
                        {/* Grid lines */}
                        <line x1="0" y1="12" x2="100" y2="12" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="1,1" />
                        
                        {/* Write Latency Route */}
                        <path
                          d={(() => {
                            const wPts = axiLatencyHistory.map((item) => item.write);
                            const maxVal = Math.max(30, ...wPts, ...axiLatencyHistory.map(i => i.read));
                            const step = 100 / (axiLatencyHistory.length - 1);
                            return "M " + wPts.map((val, i) => `${i * step},${24 - (val / maxVal) * 20}`).join(" L ");
                          })()}
                          fill="none"
                          stroke="#0ea5e9"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-90"
                        />

                        {/* Read Latency Route */}
                        <path
                          d={(() => {
                            const rPts = axiLatencyHistory.map((item) => item.read);
                            const maxVal = Math.max(30, ...rPts, ...axiLatencyHistory.map(i => i.write));
                            const step = 100 / (axiLatencyHistory.length - 1);
                            return "M " + rPts.map((val, i) => `${i * step},${24 - (val / maxVal) * 20}`).join(" L ");
                          })()}
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-80"
                        />
                      </svg>
                    ) : (
                      <span className="text-[8px] text-slate-500 animate-pulse">COLLECTING SIGNAL FLOW DATA...</span>
                    )}
                    {/* Min / Max bounds */}
                    <div className="absolute left-1 bottom-0.5 text-[6.5px] text-slate-550 select-none">MIN: 1c</div>
                    <div className="absolute right-1 top-0.5 text-[6.5px] text-slate-550 select-none font-bold">
                      MAX: {Math.max(15, ...axiLatencyHistory.map(item => Math.max(item.read, item.write)))}c
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 border border-slate-900 rounded p-1.5 h-[72px] flex flex-col justify-between relative font-mono text-[8px]">
                    {latencyBins && latencyBins.length > 0 ? (
                      <div className="w-full h-11 flex items-end justify-between px-1 border-b border-slate-800/80">
                        {latencyBins.map((bin, bi) => {
                          const maxCount = Math.max(1, ...latencyBins.map(b => Math.max(b.writeCount, b.readCount)));
                          const wHeight = (bin.writeCount / maxCount) * 100;
                          const rHeight = (bin.readCount / maxCount) * 100;
                          return (
                            <div key={bi} className="flex-1 flex items-end justify-center h-full group relative mx-0.5">
                              {/* Slanted overlays representing write vs read densities */}
                              <div className="w-full flex justify-center gap-[2px] h-full items-end">
                                <div 
                                  className="w-1 bg-cyan-500/80 hover:bg-cyan-400 transition-all rounded-t-sm"
                                  style={{ height: `${wHeight}%` }}
                                  title={`Writes in ${bin.label} cycles: ${bin.writeCount}`}
                                />
                                <div 
                                  className="w-1 bg-purple-500/80 hover:bg-purple-400 transition-all rounded-t-sm"
                                  style={{ height: `${rHeight}%` }}
                                  title={`Reads in ${bin.label} cycles: ${bin.readCount}`}
                                />
                              </div>
                              
                              {/* Hover Tooltip tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-950 border border-slate-800 text-[7px] text-slate-200 p-1.5 shadow-lg whitespace-nowrap z-20 pointer-events-none font-sans rounded">
                                <div className="font-bold text-slate-350 font-mono mb-0.5">{bin.label} cycles</div>
                                <div className="text-cyan-400">Writes: {bin.writeCount} samples</div>
                                <div className="text-purple-400">Reads: {bin.readCount} samples</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500">NO LATENCY STATISTICS REGISTERED</div>
                    )}
                    
                    {/* X axis labels */}
                    <div className="flex justify-between px-0.5 text-[6.5px] text-slate-500 mt-1 select-none font-bold">
                      {latencyBins.map((bin, bi) => (
                        <span key={bi} className="flex-1 text-center truncate">{bin.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>              </div>
            </div>
          </div>

          {/* Card 3: Clock Security Synchronization (CDC) Status warnings */}
          <div className="bg-slate-950/75 border border-slate-850 rounded-lg p-4 space-y-3 leading-relaxed select-none" id="cdc-kpis-card">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-purple-400" />
              Dynamic Clock Domain Crossing (CDC) checks
            </span>

            <ul className="space-y-2 text-[9.5px] font-mono">
              <li className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                <span className="text-slate-550 uppercase">CDC Handshaking interface</span>
                <span className={`font-bold uppercase ${faultInjectCdcDesync ? "text-red-400 animate-pulse" : "text-emerald-400 font-semibold"}`}>
                  {faultInjectCdcDesync ? "DESYNC_METASTABLE_ERR" : "GrayCoded_OK"}
                </span>
              </li>
              <li className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                <span className="text-slate-550 uppercase">Timing paths setup slack (WNS)</span>
                <span className={`font-bold transition ${worstNegativeSlackWns < 0 ? "text-red-400 font-black animate-bounce" : "text-emerald-400"}`}>
                  {worstNegativeSlackWns < 0 ? "VIOLATION FAIL" : "PASS (Timing met)"}
                </span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-slate-550 uppercase">Core Reference stability phase</span>
                <span className={`font-bold uppercase ${faultInjectCdcDrift ? "text-amber-400 font-bold animate-pulse" : "text-emerald-400"}`}>
                  {faultInjectCdcDrift ? "SKEW_LIMITS_EXCEEDED" : "LOCKED_STABLE"}
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* RIGHT COLUMN: INTERACTIVE DIAGNOSTICS LOG BUFFER & TERMINAL CONSOLE (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Top segment: The Interactive Diagnosic CLI Terminal Shell */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between" id="axi-cli-panel">
            <div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-850/60 mb-3.5 select-none">
                <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-widest">
                  <Terminal className="h-4 w-4 text-cyan-405 animate-pulse" />
                  AXI4-Lite register diagnostics console
                </span>
                <span className="text-[7.5px] font-mono text-slate-550 border border-slate-850 bg-slate-900 px-1.5 py-0.5 rounded">
                  BAUD: 115200 BPS
                </span>
              </div>

              {/* Terminal Logs stream area */}
              <div className="bg-slate-900 border border-slate-850 rounded p-4 font-mono text-[9.3px] h-[190px] overflow-y-auto space-y-1.5 scrollbar-thin select-all">
                {cliHistory.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`leading-relaxed whitespace-pre-wrap ${
                      log.includes("🟢") || log.includes("PASS") || log.includes("validated") ? "text-emerald-400 font-bold" :
                      log.includes("🔴") || log.includes("ERROR") || log.includes("DECERR") || log.includes("SLVERR") ? "text-red-400 font-bold animate-pulse" :
                      log.includes("⚠️") || log.includes("WARNING") || log.includes("anomaly") ? "text-amber-400 font-bold" :
                      log.startsWith("$") ? "text-cyan-400 font-bold border-b border-slate-950 pb-1 mt-1.5 first:mt-0 first:pt-0" : "text-slate-350"
                    }`}
                  >
                    {log}
                  </div>
                ))}
                <div ref={terminalLogsEndRef} />
              </div>
            </div>

            {/* Terminal Input form */}
            <form onSubmit={handleCliSubmit} className="mt-3.5 flex gap-2">
              <span className="font-mono text-xs text-slate-500 select-none flex items-center shrink-0">pog2-sh&gt;</span>
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="Type 'help' or register command (e.g. axi-read 43C00010)..."
                className="flex-1 bg-slate-900/85 border border-slate-850 rounded px-3 py-1 text-xs text-slate-100 font-mono outline-none focus:border-cyan-400 transition"
              />
              <button
                type="submit"
                className="bg-cyan-950/40 hover:bg-cyan-950 border border-cyan-900 text-cyan-400 font-mono text-[9px] px-3.5 rounded transition font-bold select-none cursor-pointer"
              >
                EXEC
              </button>
            </form>
          </div>

          {/* Bottom segment: Post-Mortem AXI Log Buffer Explorer inside RAM */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-4" id="post-mortem-log-card">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-850 pb-3 gap-3 select-none">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                <div>
                  <h3 className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest">
                    Post-Mortem AXI Log Buffer (32-SRAM Ring Cache)
                  </h3>
                  <p className="text-[8px] text-slate-500 font-mono mt-0.5 uppercase">
                    Direct memory-mapped hardware FIFO buffer stack. Filter results below or dump via CLI.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setPostMortemLogs([]);
                  addPostMortemLog("AXI_BUS", "0x43C00A00", "WARNING", "Wiped Post-Mortem FIFO storage allocations manually.");
                }}
                className="text-[8px] font-mono font-bold bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800 px-2 py-1 rounded cursor-pointer transition uppercase shrink-0"
              >
                Clear Buffer
              </button>
            </div>

            {/* Filter controls panel */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-2 border border-slate-850 rounded text-[9.5px] font-mono">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3 w-3 text-slate-500" />
                <span className="text-slate-500 uppercase sm:inline hidden">Filters:</span>
              </div>

              {/* Source filter */}
              <select
                value={postMortemFilterSource}
                onChange={(e) => setPostMortemFilterSource(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none px-1.5 py-0.5 text-[9px]"
              >
                <option value="ALL">ALL SOURCES</option>
                <option value="AXI_BUS">AXI_BUS</option>
                <option value="FSM_ST">FSM_ST</option>
                <option value="SENSOR_ANOMALY">SENSOR_ANOMALY</option>
                <option value="CDC_CLOCKY">CDC_CLOCKY</option>
              </select>

              {/* Severity filter */}
              <select
                value={postMortemFilterSeverity}
                onChange={(e) => setPostMortemFilterSeverity(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none px-1.5 py-0.5 text-[9px]"
              >
                <option value="ALL">ALL SEVERITIES</option>
                <option value="WARNING">WARNING</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="FATAL">FATAL</option>
              </select>

              {/* Search input text */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 ml-auto w-full sm:w-40">
                <Search className="h-3 w-3 text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Seach anomalies..."
                  value={postMortemSearchText}
                  onChange={(e) => setPostMortemSearchText(e.target.value)}
                  className="bg-transparent border-0 outline-none text-slate-100 placeholder-slate-600 text-[9px] w-full"
                />
              </div>
            </div>

            {/* Logs Table Area */}
            <div className="border border-slate-850 rounded overflow-hidden">
              <div className="max-h-[160px] overflow-y-auto overflow-x-auto scrollbar-thin select-text">
                <table className="w-full font-mono text-[9px] text-left border-collapse min-w-[550px]">
                  <thead className="bg-slate-900/90 text-slate-500 uppercase h-6 sticky top-0 border-b border-slate-850">
                    <tr>
                      <th className="px-3">ID</th>
                      <th className="px-2">GMT_T</th>
                      <th className="px-2">TICK</th>
                      <th className="px-2">ANOMALY_SOURCE</th>
                      <th className="px-2">AXI_ADDR</th>
                      <th className="px-2">SEV</th>
                      <th className="px-3">ANOMALY_DETAILS_DESC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-600 italic">
                          No post-mortem diagnostic entries recorded matching specified filters. Standing by...
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => {
                        const levelColor = 
                          log.level === "FATAL" ? "text-red-400 bg-red-950/30 border border-red-900" :
                          log.level === "CRITICAL" ? "text-amber-500 bg-amber-950/20 border border-amber-900/60" :
                          "text-slate-400 bg-slate-900 border border-slate-850";
                        
                        return (
                          <tr key={log.id} className="hover:bg-slate-900/40 transition">
                            <td className="px-3 font-bold text-slate-400 py-1.5">{log.id}</td>
                            <td className="px-2 text-slate-200">{log.timestamp}</td>
                            <td className="px-2 text-slate-400 font-bold">#{log.tick}</td>
                            <td className="px-2">
                              <span className="text-cyan-400 px-1 font-semibold">{log.source}</span>
                            </td>
                            <td className="px-2 font-bold text-slate-500">{log.hexAddr}</td>
                            <td className="px-2">
                              <span className={`px-1 py-0.2 rounded text-[8px] font-bold ${levelColor}`}>
                                {log.level}
                              </span>
                            </td>
                            <td className="px-3 text-slate-350 limit-text leading-tight max-w-xs truncate" title={log.message}>
                              {log.message}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-550 pt-1 select-none">
              <span>FIFO Buffer Mapped Range: 0x43C00A00 - 0x43C00A1C</span>
              <span>Showing {filteredLogs.length} of {postMortemLogs.length} anomalies inside SRAM</span>
            </div>
          </div>

        </div>

      </div>

      {/* ROW 3: DYNAMIC PROPULSION SENSOR LOGGER & SUPERPOSITION QBIT EMBEDDING PANEL */}
      <div className="border-t border-slate-850 pt-6 grid grid-cols-1 xl:grid-cols-12 gap-6" id="dual-logging-qbits-hub">
        
        {/* CARD 1: HIGH-SPEED TELEMETRY BUFFER LOGGER (7 columns) */}
        <div className="xl:col-span-7 bg-slate-950/75 border border-slate-850 rounded-lg p-5 space-y-4" id="hs-telemetry-panel">
          <div className="flex justify-between items-center border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className={`h-5 w-5 ${isProfilingAcq ? "text-amber-400 animate-pulse" : "text-slate-500"}`} />
              <div>
                <h3 className="text-xs font-bold tracking-wider font-display text-slate-200 uppercase">
                  POG2 MHD High-Speed Telemetry Logger
                </h3>
                <p className="text-[8.5px] font-mono text-slate-500 mt-0.5">
                  Real-time high-speed buffer capturing multi-channel transducer feeds.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsProfilingAcq(!isProfilingAcq)}
                className={`text-[8px] font-mono font-bold px-2.5 py-1 rounded cursor-pointer transition uppercase flex items-center gap-1.5 ${
                  isProfilingAcq 
                    ? "bg-amber-950/40 text-amber-400 border border-amber-900 animate-pulse hover:bg-amber-900/30" 
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-850"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isProfilingAcq ? "bg-amber-400 animate-ping" : "bg-slate-500"}`} />
                {isProfilingAcq ? "PROFILING ON" : "PROFILING OFF"}
              </button>

              <div className="flex items-center rounded overflow-hidden border border-slate-800">
                <button
                  onClick={() => handleExportData("json")}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-[8px] font-mono font-bold px-2 py-1 border-r border-slate-800 uppercase"
                  title="Export telemetry frames as JSON"
                >
                  JSON
                </button>
                <button
                  onClick={() => handleExportData("csv")}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-[8px] font-mono font-bold px-2 py-1 uppercase"
                  title="Export telemetry frames as CSV spreadsheet"
                >
                  CSV
                </button>
              </div>
            </div>
          </div>

          {/* DYNAMIC SPARK trend CHARTS */}
          <div className="bg-slate-900/50 border border-slate-850 rounded p-3 space-y-3.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono text-slate-450 uppercase flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-405" />
                Buffered trend-line visualizations
              </span>
              <div className="flex items-center gap-1 text-[8px] font-mono bg-slate-950 p-0.5 rounded border border-slate-850">
                <button
                  onClick={() => setActiveChartSensor("temp")}
                  className={`px-2 py-0.5 rounded uppercase leading-none ${activeChartSensor === "temp" ? "bg-rose-950 text-rose-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                >
                  Temp
                </button>
                <button
                  onClick={() => setActiveChartSensor("pressure")}
                  className={`px-2 py-0.5 rounded uppercase leading-none ${activeChartSensor === "pressure" ? "bg-sky-950 text-sky-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                >
                  Press
                </button>
                <button
                  onClick={() => setActiveChartSensor("current")}
                  className={`px-2 py-0.5 rounded uppercase leading-none ${activeChartSensor === "current" ? "bg-amber-950 text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
                >
                  Current
                </button>
              </div>
            </div>

            {/* Render dynamically packed Trend paths */}
            <div className="pt-1">
              {(() => {
                const field = activeChartSensor;
                const dataPoints = highSpeedLogs.slice(-25); // Show last 25 entries
                if (dataPoints.length === 0) {
                  return (
                    <div className="text-slate-600 text-center py-6 italic text-[9.5px] font-mono">
                      Awaiting logger data captures. Engage simulation ticker above.
                    </div>
                  );
                }

                const width = 500;
                const height = 90;
                const padding = 15;

                const vals = dataPoints.map(d => d[field] as number);
                const minVal = Math.min(...vals) * 0.999;
                const maxVal = Math.max(...vals) * 1.001;
                const diff = (maxVal - minVal) || 1.0;

                const points = dataPoints.map((d, index) => {
                  const x = padding + (index / (dataPoints.length - 1 || 1)) * (width - padding * 2);
                  const y = height - padding - ((d[field] - minVal) / diff) * (height - padding * 2);
                  return { x, y, val: d[field], tick: d.tick };
                });

                const pathD = points.reduce((acc, p, index) => {
                  return index === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                }, "");

                const fillD = points.length === 0 ? "" : `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

                const color = field === "temp" ? "#f87171" : field === "pressure" ? "#38bdf8" : "#fbbf24";
                const gradientId = `chart-sprk-${field}`;

                return (
                  <div className="relative">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
                      <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#182235" strokeDasharray="3,3" />
                      <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="#182235" strokeDasharray="3,3" />
                      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

                      {points.length > 1 && <path d={fillD} fill={`url(#${gradientId})`} />}
                      {points.length > 1 && <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

                      {points.map((p, i) => (
                        <circle 
                          key={i} 
                          cx={p.x} 
                          cy={p.y} 
                          r={i === points.length - 1 ? 4 : 2} 
                          className={`${i === points.length - 1 ? "animate-pulse" : ""}`}
                          fill={i === points.length - 1 ? "#ffffff" : color} 
                          stroke={color}
                          strokeWidth={i === points.length - 1 ? 2 : 0}
                        />
                      ))}
                    </svg>
                    <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-550 px-1 mt-1 select-none">
                      <span>MIN RANGE: {minVal.toFixed(field === "pressure" ? 3 : 1)}</span>
                      <span className="text-slate-400">
                        VAL: <strong style={{ color }}>{vals[vals.length - 1]?.toFixed(field === "pressure" ? 3 : 1)}</strong>
                      </span>
                      <span>MAX RANGE: {maxVal.toFixed(field === "pressure" ? 3 : 1)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* D3 HISTOGRAM FOR HISTORICAL TEMPERATURE ANOMALIES (LAST 1000 TICKS) */}
          <div className="bg-slate-900/50 border border-slate-850 rounded p-4 space-y-3">
            <div className="flex justify-between items-center select-none">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-rose-450 animate-pulse" />
                D3 HISTOGRAM: ELECTRODE TEMP ANOMALIES (LAST 1000 TICKS)
              </span>
              <span className="text-[7.5px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/40 uppercase">
                Active distribution
              </span>
            </div>
            
            <p className="text-[9.5px] text-slate-500 font-mono leading-normal">
              Distribution anomaly factor delta <strong className="text-slate-400">Δ = Temp_current - 300K</strong>. Tracked continuously over a high density sliding buffer of the last 1000 simulator ticks.
            </p>

            <D3AnomalyHistogram anomalies={historicalAnomalies} />

            <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-500 pt-1 select-none">
              <span>NORMAL FLUCTUATION ZONE (-5.0K to 5.0K)</span>
              <span>OVERHEATING WARNING (&gt;15.0K)</span>
            </div>
          </div>

          {/* TELEMETRY SEARCH & HIGH-SPEED BUFFER TABLE */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded border border-slate-850 text-[9px] font-mono">
              <div className="flex items-center gap-1.5 select-text w-full">
                <Search className="h-3 w-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter key results (e.g. STEALTH, PURGE)..."
                  value={searchHighSpeed}
                  onChange={(e) => setSearchHighSpeed(e.target.value)}
                  className="bg-transparent border-none outline-none text-slate-200 placeholder-slate-600 text-[9px] w-full max-w-sm"
                />
              </div>
              <span className="text-slate-500 shrink-0 uppercase sm:inline hidden">
                Captured {highSpeedLogs.length} Ticks
              </span>
            </div>

            <div className="border border-slate-855 rounded overflow-hidden">
              <div className="max-h-[140px] overflow-y-auto scrollbar-thin select-text">
                <table className="w-full font-mono text-[8.5px] text-left border-collapse">
                  <thead className="bg-slate-900 text-slate-500 uppercase sticky top-0 border-b border-slate-850 h-6">
                    <tr>
                      <th className="px-2.5">ID</th>
                      <th className="px-2">GMT_T</th>
                      <th className="px-1.5">TICK</th>
                      <th className="px-2">SENSORS (T/P/A)</th>
                      <th className="px-2">FSM</th>
                      <th className="px-2">COILS CH</th>
                      <th className="px-2.5">AXI4 ADDRESS TRANSACTIONS LOGS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 bg-slate-950/20">
                    {filteredHighSpeed.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-600 italic font-mono">
                          No buffered telemetry entries matched filters.
                        </td>
                      </tr>
                    ) : (
                      filteredHighSpeed.map(log => {
                        const isSymmetricOk = log.contactors.indexOf("F") === -1;
                        return (
                          <tr key={log.id} className="hover:bg-slate-900/35 transition">
                            <td className="px-2.5 text-slate-450 font-bold py-1 select-all">{log.id}</td>
                            <td className="px-2 text-slate-300">{log.timestamp}</td>
                            <td className="px-1.5 font-bold text-slate-400">#{log.tick}</td>
                            <td className="px-2 text-slate-200">
                              {log.temp}K | {log.pressure} | {log.current}A
                            </td>
                            <td className="px-2 font-semibold text-cyan-400">{log.hexagram}</td>
                            <td className="px-2">
                              <span className={`px-1 py-0.2 rounded-sm text-[8px] font-bold ${
                                isSymmetricOk ? "bg-emerald-950/30 text-emerald-400 border border-emerald-950" : "bg-rose-955 text-rose-455"
                              }`}>
                                {log.contactors}
                              </span>
                            </td>
                            <td className="px-2.5 text-slate-400 select-all truncate max-w-[140px]" title={log.axiAccess}>
                              {log.axiAccess}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-550 select-none">
              <span>SRAM High-Speed circular buffer memory map: Q16.16 mapped registers</span>
              <span>Buffer deep index range: [0..49] cells</span>
            </div>
          </div>
        </div>

        {/* CARD 2: I-CHING QUANTUM QBIT SUPERPOSITION & PLAYER STRING INTEGRATOR (5 columns) */}
        <div className="xl:col-span-5 bg-slate-950/75 border border-slate-850 rounded-lg p-5 space-y-4" id="quantum-qbit-panel">
          <div className="flex justify-between items-center border-b border-slate-900 pb-3 font-display">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-indigo-400 animate-pulse" />
              <div>
                <h3 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                  I-Ching Qbit & LoRA PEFT Engine
                </h3>
                <p className="text-[8.5px] font-mono text-slate-500 mt-0.5">
                  Embed binary Yao-states & Low-Rank parameter updates inside custom adapters.
                </p>
              </div>
            </div>
            
            {/* Tab switchers */}
            <div className="flex items-center gap-1 text-[8.5px] font-mono p-0.5 bg-slate-900 border border-slate-800 rounded">
              <button
                onClick={() => setActiveQbitTab("qbit")}
                className={`px-2 py-0.5 rounded uppercase leading-tight font-bold transition cursor-pointer ${activeQbitTab === "qbit" ? "bg-indigo-950 text-indigo-300 border border-indigo-900/40" : "text-slate-550 hover:text-slate-300"}`}
              >
                Qbit Stamp
              </button>
              <button
                onClick={() => setActiveQbitTab("lora")}
                className={`px-2 py-0.5 rounded uppercase leading-tight font-bold transition cursor-pointer flex items-center gap-1 ${activeQbitTab === "lora" ? "bg-emerald-950 text-emerald-300 border border-emerald-900/40" : "text-slate-550 hover:text-slate-300"}`}
              >
                <span className={`w-1 h-1 rounded-full ${isLoraTraining ? "bg-emerald-400 animate-ping" : isLoraMerged ? "bg-emerald-450" : "bg-slate-500"}`} />
                LoRA Tuner
              </button>
            </div>
          </div>

          {activeQbitTab === "qbit" ? (
            <>
              {/* SYSTEM EMBEDDING QBIT VISUAL SPEC */}
              <div className="bg-slate-900/50 border border-slate-850 rounded p-3 space-y-3 font-mono">
                <div className="flex justify-between items-center text-[9px] text-slate-400 pb-1.5 border-b border-slate-900 select-none">
                  <span className="uppercase">Core Qbit superposed matrix parameters</span>
                  <span className="text-indigo-400 uppercase">State mapped: 0x{currentHexagram.toString(16).toUpperCase()}</span>
                </div>

                <div className="space-y-2 text-[9.5px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase">Superposition bits:</span>
                    <span className="text-slate-200 font-bold text-right truncate max-w-[180px] select-all" title="Packed I-Ching 64-bit frame">
                      {(() => {
                        const profiling = currentHexagram === HexagramState.IDLE ? "QUIET" :
                                          currentHexagram === HexagramState.PURGE ? "PURG" :
                                          currentHexagram === HexagramState.STEALTH ? "STLH" :
                                          currentHexagram === HexagramState.ST_CRIT ? "S_CR" :
                                          currentHexagram === HexagramState.TRANSIT ? "TRNS" :
                                          currentHexagram === HexagramState.LIMP_MODE ? "LIMP" :
                                          currentHexagram === HexagramState.TR_SALT ? "SALT" : "CRIT";
                        const timestampMs = Date.now();
                        const rawVal = (BigInt(currentHexagram) << 58n) |
                                        (BigInt(timestampMs % 1099511627776) << 16n) |
                                        (BigInt(profiling.charCodeAt(0) || 0x41) << 8n) |
                                        BigInt(tickCounter % 256);
                        return "0x" + rawVal.toString(16).toUpperCase().padStart(16, "0");
                      })()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase">Dynamic entropy variance:</span>
                    <span className="text-indigo-400 font-bold text-xs">{entropyFactor}%</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase">Feelings Stamp:</span>
                    <span className="text-rose-400 font-bold">
                      {currentHexagram === HexagramState.IDLE ? "QUIETUDE" :
                       currentHexagram === HexagramState.PURGE ? "DETERMINATION" :
                       currentHexagram === HexagramState.STEALTH ? "SERENITY" :
                       currentHexagram === HexagramState.ST_CRIT ? "TENSION" :
                       currentHexagram === HexagramState.TRANSIT ? "COURAGE" :
                       currentHexagram === HexagramState.LIMP_MODE ? "VIGILANCE" :
                       currentHexagram === HexagramState.TR_SALT ? "SERENITY" : "FEAR"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase">Clock registry stamp:</span>
                    <span className="text-slate-350">{new Date().toISOString().substring(11, 23)} UTC</span>
                  </div>
                </div>

                {/* Simulated compiler slider */}
                {isTraining && (
                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between text-[7.5px] text-slate-500 uppercase select-none">
                      <span>Compressing Yao-states...</span>
                      <span>{trainingProgress}%</span>
                    </div>
                    <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-150 animate-pulse" style={{ width: `${trainingProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION BUTTON INTERFACE */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleInjectOnPlayerString}
                  className="bg-indigo-900/90 hover:bg-indigo-850 text-indigo-100 font-mono text-[9px] font-bold py-2 px-3 rounded cursor-pointer transition border border-indigo-700 flex items-center justify-center gap-1.5 uppercase leading-tight text-center"
                  title="Stamp double-word parameters and append to real game string"
                >
                  <RefreshCw className="h-3 w-3 shrink-0 animate-spin-slow" />
                  Stamp Player String
                </button>

                <button
                  onClick={handleTriggerTraining}
                  disabled={isTraining || isLoraTraining}
                  className={`font-mono text-[9px] font-bold py-2 px-3 rounded cursor-pointer transition border flex items-center justify-center gap-1.5 uppercase leading-tight text-center ${
                    (isTraining || isLoraTraining)
                      ? "bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed" 
                      : "bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border-indigo-900"
                  }`}
                  title="Run compression and fine-tune subsequent LoRA adapter"
                >
                  <Database className="h-3 w-3 shrink-0 animate-pulse" />
                  ML + LoRA Train
                </button>
              </div>

              <div className="flex justify-between items-center text-[8px] font-mono text-slate-550 select-none px-1">
                <span>Matrices compiled: <strong>{savedTrainingCount} elements</strong></span>
                <span>Programmatic: <strong>getHexagram() / setHexagram() online</strong></span>
              </div>

              {/* COLLAPSIBLE SERIALIZED PLAYER STATE VIEW */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono text-slate-500 uppercase flex items-center gap-1 select-none">
                  <Check className="h-3.5 w-3.5 text-indigo-400" />
                  Serialized Player String KV Memory Snapshot:
                </span>

                <div className="bg-slate-950 rounded p-2 border border-slate-875 relative">
                  <pre className="text-[8.5px] font-mono text-slate-300 overflow-x-auto max-h-[120px] select-all leading-tight scrollbar-thin">
                    {playerStateJsonStr ? playerStateJsonStr : JSON.stringify({
                      info: "Click [Stamp Player String] above to inject the latest quantum Alternative I-Ching superposition data structures and active actionables into the gameplay state."
                    }, null, 2)}
                  </pre>
                  <div className="absolute top-1.5 right-1.5 text-[6.5px] font-mono bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 px-1 rounded uppercase select-none">
                    {playerStateJsonStr ? "pog2_mhd_player_state" : "standing by..."}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* LORA HYPERPARAMETER CONTROLLER PANEL */}
              <div className="bg-slate-900/40 border border-slate-850 rounded p-3 space-y-3 font-mono text-left">
                <div className="flex justify-between items-center text-[9px] text-slate-400 pb-1.5 border-b border-slate-900 select-none">
                  <span className="uppercase text-emerald-400 font-bold">LoRA Adaptation Hyperparameters</span>
                  <span className="text-slate-500 uppercase">Target: PEFT/PyTorch</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[9px]">
                  {/* Rank Selector */}
                  <div className="space-y-1">
                    <label className="text-slate-500 block uppercase font-bold text-[8px]">Adapter Rank (r):</label>
                    <div className="flex gap-1">
                      {[4, 8, 16, 32].map((rValue) => (
                        <button
                          key={rValue}
                          disabled={isLoraTraining || isTraining}
                          onClick={() => {
                            setLoraRank(rValue);
                            // Auto adjust alpha proportional to rank
                            setLoraAlpha(rValue * 2);
                          }}
                          className={`flex-1 text-[8.5px] py-0.5 rounded border leading-none font-bold cursor-pointer transition ${
                            loraRank === rValue
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : "bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900"
                          }`}
                        >
                          {rValue}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alpha Selector */}
                  <div className="space-y-1">
                    <label className="text-slate-500 block uppercase font-bold text-[8px]">Alpha (scaling):</label>
                    <div className="flex gap-1">
                      {[8, 16, 32, 64].map((aValue) => (
                        <button
                          key={aValue}
                          disabled={isLoraTraining || isTraining}
                          onClick={() => setLoraAlpha(aValue)}
                          className={`flex-1 text-[8.5px] py-0.5 rounded border leading-none font-bold cursor-pointer transition ${
                            loraAlpha === aValue
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : "bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900"
                          }`}
                        >
                          {aValue}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target modules */}
                  <div className="space-y-1">
                    <label className="text-slate-500 block uppercase font-bold text-[8px]">Target Modules:</label>
                    <input
                      type="text"
                      disabled={isLoraTraining || isTraining}
                      value={loraTargetModules}
                      onChange={(e) => setLoraTargetModules(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-1.5 py-0.5 text-slate-300 text-[8.5px] outline-none font-semibold focus:border-emerald-600 focus:bg-slate-900/60"
                    />
                  </div>

                  {/* Learning rate */}
                  <div className="space-y-1">
                    <label className="text-slate-500 block uppercase font-bold text-[8px]">Learning Rate (lr):</label>
                    <input
                      type="text"
                      disabled={isLoraTraining || isTraining}
                      value={loraLearningRate}
                      onChange={(e) => setLoraLearningRate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-1.5 py-0.5 text-slate-300 text-[8.5px] outline-none font-semibold focus:border-emerald-600 focus:bg-slate-900/60"
                    />
                  </div>
                </div>

                <div className="text-[8px] text-slate-500 select-none bg-slate-950/40 p-1.5 rounded border border-slate-900 text-center">
                  Scaling Factor (α/r): <strong className="text-emerald-400">{(loraAlpha / loraRank).toFixed(2)}</strong> | Trainable Parameters: <strong className="text-indigo-400">{(loraRank * 16384 * 2).toLocaleString()}</strong>
                </div>
              </div>

              {/* LORA TRAINING SIMULATION PANEL */}
              {(isLoraTraining || isLoraMerged) && (
                <div className="bg-slate-900 border border-slate-850 rounded p-3 space-y-2.5 font-mono text-left">
                  <div className="flex justify-between items-center text-[9px] select-none">
                    <span className="uppercase text-slate-400 flex items-center gap-1.5">
                      <Activity className={`w-3 h-3 ${isLoraTraining ? "text-emerald-400 animate-pulse" : "text-emerald-500"}`} />
                      Fine-Tuning Loss Convergence
                    </span>
                    <span className="text-[8px] text-slate-500 bg-slate-950 px-1 py-0.2 rounded font-bold">
                      {isLoraTraining ? "Acquiring..." : "Symmetry Locked"}
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-3 items-center">
                    {/* Loss convergence value */}
                    <div className="col-span-4 bg-slate-950 rounded p-1.5 text-center border border-slate-850 select-all">
                      <span className="text-[7px] text-slate-500 block uppercase">Log Loss</span>
                      <strong className="text-[14px] font-bold text-emerald-400">
                        {loraCurrentLoss !== null ? loraCurrentLoss.toFixed(4) : "---"}
                      </strong>
                    </div>

                    {/* Progress slider */}
                    <div className="col-span-8 space-y-1">
                      <div className="flex justify-between text-[7px] text-slate-500 uppercase select-none">
                        <span>Low-Rank Step Adaptations</span>
                        <span className="text-emerald-400 font-bold">{loraProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-150 animate-pulse" 
                          style={{ width: `${loraProgress}%` }} 
                        />
                      </div>
                      <p className="text-[7.5px] text-slate-450 leading-none truncate">
                        {isLoraTraining ? `Backpropagating gradient matrix on ${loraTargetModules}...` : `Folded adapter model successfully into primary context.`}
                      </p>
                    </div>
                  </div>

                  {/* Mini scrolling step log box */}
                  <div className="border border-slate-850 rounded bg-slate-950 p-2 max-h-[80px] overflow-y-auto scrollbar-thin text-[8px] text-emerald-400 select-text font-mono space-y-0.5 leading-tight">
                    {loraLogs.map((log, i) => (
                      <div key={i} className="truncate">
                        <span className="text-slate-650 inline mr-1 opacity-60">[{log.indexOf("]") !== -1 ? log.slice(1, log.indexOf("]")) : "STEP"}]</span>
                        <span className="text-slate-300">{log.slice((log.indexOf("]") !== -1 ? log.indexOf("]") + 1 : 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTIVE TRAINING CONTEXT EXAMPLES (STAMPED DATASETS) */}
              <div className="space-y-1.5 text-left">
                <span className="text-[9px] font-mono text-slate-500 font-bold uppercase flex justify-between items-center select-none">
                  <span>Hexagram-Stamped Context Samples ({loraDataset.length}):</span>
                  <span className="text-emerald-400 text-[8px]">Live compiler dataloader</span>
                </span>

                <div className="space-y-2 max-h-[145px] overflow-y-auto scrollbar-thin">
                  {loraDataset.map((sample) => (
                    <div key={sample.id} className="bg-slate-950 border border-slate-850 rounded p-2 text-[8.5px] font-mono space-y-1 hover:border-slate-800 transition">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-900 select-none">
                        <span className="text-[7.5px] font-bold text-slate-450 uppercase">{sample.id} ({sample.vibe})</span>
                        <span className="text-emerald-400 font-bold font-mono text-[7.5px]" title="Packed qbit timestamp stamp">{sample.qbit}</span>
                      </div>
                      <div className="space-y-0.5 select-text">
                        <div className="text-slate-400 leading-tight">
                          <strong className="text-indigo-405 text-[7.2px] uppercase bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 px-1 rounded mr-1">Prompt:</strong>
                          {sample.prompt}
                        </div>
                        <div className="text-emerald-300 leading-tight pt-1">
                          <strong className="text-emerald-455 text-[7.2px] uppercase bg-emerald-950/40 text-emerald-300 border border-emerald-900/40 px-1 rounded mr-1">Completion:</strong>
                          {sample.completion}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic merge / test buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleTriggerTraining}
                  disabled={isLoraTraining || isTraining}
                  className={`flex-1 font-mono text-[9px] font-bold py-2 px-3 rounded cursor-pointer transition border flex items-center justify-center gap-1.5 uppercase leading-tight ${
                    isLoraTraining || isTraining
                      ? "bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed animate-pulse"
                      : "bg-emerald-950/80 text-emerald-100 hover:bg-emerald-900/60 border-emerald-800"
                  }`}
                  title="Run stages and retrain everything"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoraTraining ? "animate-spin" : ""}`} />
                  {isLoraTraining ? "Training Adapter Core..." : "Force Train Adapter Checkpoint"}
                </button>
              </div>
            </>
          )}
        </div>

      </div>

    </div>
  );
}

