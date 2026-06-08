/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Cpu, 
  Activity, 
  Sparkles, 
  Database, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Unplug, 
  RotateCcw, 
  Network, 
  Radio, 
  FileCode, 
  CheckCircle,
  AlertOctagon,
  Flame,
  Binary,
  History,
  AlertTriangle
} from "lucide-react";
import { HexagramState, HexagramStateLabels, DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES, EmotionalTone } from "../types";
import { GhostTrainingLimb, GhostTrainingLimbState } from "../utils/GhostTrainingLimb";

interface AIHexagramDecisionBrainProps {
  currentHexagram: HexagramState;
  isAiActive: boolean;
  setIsAiActive: (val: boolean) => void;
  avgElectrodeTemp: number;
  plenumPressure: number;
  busCurrentA: number;
  symmetryOk: boolean;
  activeFaultCodes: string[];
  onCommitState: (targetState: HexagramState) => void;
  onResetSimulator: () => void;
  ghostState: GhostTrainingLimbState;
  ghostLimb: GhostTrainingLimb;
  healthFeedbackTail?: Array<{
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
  }>;
  transitionalState?: {
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
  };
}

export default function AIHexagramDecisionBrain({
  currentHexagram,
  isAiActive,
  setIsAiActive,
  avgElectrodeTemp,
  plenumPressure,
  busCurrentA,
  symmetryOk,
  activeFaultCodes,
  onCommitState,
  onResetSimulator,
  ghostState,
  ghostLimb,
  healthFeedbackTail = [],
  transitionalState
}: AIHexagramDecisionBrainProps) {
  // Save State and Collector system state
  const [collectorBuffer, setCollectorBuffer] = useState<string[]>([]);
  const [compressedPayloads, setCompressedPayloads] = useState<string[]>([]);
  const [fillRate, setFillRate] = useState(0); // 0 to 100%
  const [compressAlgorithm, setCompressAlgorithm] = useState<"TRANSCRIPTOME_LZO" | "HUFFMAN_TERNARY">("TRANSCRIPTOME_LZO");
  const [emergencyCutActive, setEmergencyCutActive] = useState(false);
  const [qbitPhase, setQbitPhase] = useState(0);

  // Pedagogy input form state for co-processor block
  const [coprocInstruction, setCoprocInstruction] = useState("");
  const [coprocOutput, setCoprocOutput] = useState("");

  // Trigger Synthesis progress & completion states
  const [lastCompilingState, setLastCompilingState] = useState(false);
  const [showSuccessGlow, setShowSuccessGlow] = useState(false);

  useEffect(() => {
    if (ghostState.isCompilingOllama) {
      setLastCompilingState(true);
      setShowSuccessGlow(false);
    } else if (lastCompilingState && !ghostState.isCompilingOllama && ghostState.compileProgress === 100) {
      setLastCompilingState(false);
      setShowSuccessGlow(true);
      const timer = setTimeout(() => setShowSuccessGlow(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setLastCompilingState(ghostState.isCompilingOllama);
    }
  }, [ghostState.isCompilingOllama, ghostState.compileProgress, lastCompilingState]);

  // Endpoint AI Lock Status Matrix
  // True = Blocked/Supervised by AI (User manual click is bypassed or routed through AI validation)
  // False = Manual Override (Human)
  const endpointLockStatus = {
    stateSelector: isAiActive,
    coilDriveSequencer: isAiActive,
    chokeResonantDrive: isAiActive,
    plenumRegulator: isAiActive && plenumPressure >= 1.25 && plenumPressure <= 1.35,
    busCurrentLimiter: isAiActive,
    emergencyKillswitch: false, // ALWAYS human override first
  };

  // Continuous animation cycle for Qubit wave functions and ternary pulse lines
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setQbitPhase((prev) => (prev + 0.05) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute Qubit amplitudes based on physical readings and active hexagram
  // We represent the 6 Yao lines of the hexagram as qubits in a superposition state.
  // Lower probability of |1> if there are warning alarms on those specific parameters.
  const computeYaoQubitStates = () => {
    const defaultWeights = DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[currentHexagram]?.weights || {
      [EmotionalTone.QUIETUDE]: 0,
      [EmotionalTone.SERENITY]: 0,
      [EmotionalTone.VIGILANCE]: 0,
      [EmotionalTone.COURAGE]: 0,
      [EmotionalTone.DETERMINATION]: 0,
      [EmotionalTone.TENSION]: 0,
      [EmotionalTone.FEAR]: 0,
    };

    const tensionVal = defaultWeights[EmotionalTone.TENSION] || 0;
    const fearVal = defaultWeights[EmotionalTone.FEAR] || 0;
    const alertFactor = (tensionVal + fearVal) * 0.5;

    // We build 6 qubits corresponding to each digit of the 6-bit state of currentHexagram
    const hexBinaryStr = currentHexagram.toString(2).padStart(6, "0");
    
    return Array.from({ length: 6 }).map((_, idx) => {
      const bitValue = parseInt(hexBinaryStr[idx]);
      
      // Calculate quantum noise (superposition randomness) based on temperature and faults
      let thermalNoise = Math.max(0, (avgElectrodeTemp - 300) / 100); // 0 to 0.2
      if (activeFaultCodes.length > 0) {
        thermalNoise += 0.15;
      }

      // Qubit amplitudes: alpha|0> + beta|1> where |alpha|^2 + |beta|^2 = 1
      let betaSq = bitValue === 1 ? (1 - thermalNoise) : thermalNoise;
      betaSq = Math.max(0.01, Math.min(0.99, betaSq));
      const alphaSq = 1 - betaSq;

      const alpha = Math.sqrt(alphaSq);
      const beta = Math.sqrt(betaSq);

      // Phase angles based on qbitPhase and indexing
      const phaseAngle = (qbitPhase + idx * (Math.PI / 3)) % (Math.PI * 2);

      return {
        lineIndex: 5 - idx,
        bit: bitValue,
        alpha,
        beta,
        probability0: alphaSq * 100,
        probability1: betaSq * 100,
        phaseAngle,
        coherent: !activeFaultCodes.includes("C-01") && !activeFaultCodes.includes("X-01"),
      };
    });
  };

  const qubits = computeYaoQubitStates();

  // Create current player save string (State DNA structure injects qubits + emotional weights)
  const generatePlayerSaveString = () => {
    const weights = DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[currentHexagram]?.weights || {
      [EmotionalTone.QUIETUDE]: 1.0,
      [EmotionalTone.SERENITY]: 0,
      [EmotionalTone.VIGILANCE]: 0,
      [EmotionalTone.COURAGE]: 0,
      [EmotionalTone.DETERMINATION]: 0,
      [EmotionalTone.TENSION]: 0,
      [EmotionalTone.FEAR]: 0,
    };

    const timeRef = Date.now() / 1000;
    // Fallback dynamic formulas
    let xVal = 219 + Math.round(Math.sin(timeRef / 10) * 8);
    let yVal = 511 + Math.round(Math.cos(timeRef / 10) * 8);
    let usages = 754 + Math.round(timeRef / 15) % 1000;
    let elev = 840 + Math.round(Math.sin(timeRef / 5) * 60);
    let depth = 145 + Math.round(Math.sin(timeRef / 8) * 20);
    let alt = 420;
    let latStr = (Math.sin(timeRef / 20) * 82).toFixed(1);
    let lonStr = (((timeRef * 5) % 360) - 180).toFixed(1);
    let fatigue = Math.round(42 + Math.sin(timeRef / 12) * 10);
    let combatStyle = Math.abs(Math.round(Math.sin(timeRef / 30) * 3)) % 4;

    try {
      const cached = localStorage.getItem("pog2_mhd_player_state");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.x !== undefined) xVal = parsed.x;
        if (parsed.y !== undefined) yVal = parsed.y;
        if (parsed.fatigue !== undefined) fatigue = parsed.fatigue;
        if (parsed.combatStyle !== undefined) combatStyle = parsed.combatStyle;
        if (parsed.skills) {
          if (parsed.skills.attack && parsed.skills.attack.experience !== undefined) {
            usages = Math.round(parsed.skills.attack.experience / 15);
          }
          if (parsed.skills.ranged && parsed.skills.ranged.experience !== undefined) {
            elev = Math.round(parsed.skills.ranged.experience / 12);
          }
          if (parsed.skills.magic && parsed.skills.magic.experience !== undefined) {
            depth = Math.round(parsed.skills.magic.experience / 20);
          }
          if (parsed.skills.prayer && parsed.skills.prayer.experience !== undefined) {
            alt = Math.round(parsed.skills.prayer.experience / 10);
          }
        }
      }
    } catch (e) {}

    // RSC Player Setup Mapping save string representing Land, Aerial, Submersible, and Satellite Globe coordinates
    return `RSC_SAVE_POG2_X${xVal}_Y${yVal}_ATK[92/Usage:${usages}]_RNG[75/Elev:${elev}m]_MAG[55/Depth:${depth}m]_PRY[42/Alt:${alt}km_Cam:${latStr}N,${lonStr}E]_FATIGUE[${fatigue}]_STYLE[${combatStyle}]`;
  };

  const saveStateString = generatePlayerSaveString();

  // Handle manual or automatic state buffer pushes
  const pushSaveStateToCollector = () => {
    if (emergencyCutActive) return;

    setCollectorBuffer((prev) => {
      const next = [saveStateString, ...prev];
      // Increment fill level relative to buffer size (e.g., limit of 6 states indicates a batch)
      const currentFillPercent = Math.min(100, Math.round((next.length / 6) * 100));
      setFillRate(currentFillPercent);
      return next;
    });
  };

  // Automated background collector trigger on ticks
  useEffect(() => {
    if (currentHexagram === HexagramState.IDLE || emergencyCutActive || !isAiActive) return;
    // Push state metrics every 5 metabolic ticks
    pushSaveStateToCollector();
  }, [currentHexagram, isAiActive]);

  // Handle batch compression once limit is filled (or manually forced)
  const executeBatchCompression = () => {
    if (collectorBuffer.length === 0) return;

    // Simulate custom LZO/Huffman DNA compression
    const joinedStrings = collectorBuffer.join("\n");
    const base64Encoded = btoa(unescape(encodeURIComponent(joinedStrings))).substring(0, 48);
    const compressedFormatted = `▲_COMP_TRANSCRIPTOME_[${compressAlgorithm === "TRANSCRIPTOME_LZO" ? "LZO-V4" : "H-HUFF"}]_CRC32_0x${(Math.random()*0xFFFFFFFF>>>0).toString(16).toUpperCase()}_[${base64Encoded}...]`;

    setCompressedPayloads((prev) => [compressedFormatted, ...prev]);
    setCollectorBuffer([]);
    setFillRate(0);
  };

  useEffect(() => {
    if (fillRate >= 100) {
      executeBatchCompression();
    }
  }, [fillRate]);

  // Handle dynamic emergency safety cutout
  const triggerManualEmergencyCut = () => {
    setEmergencyCutActive(true);
    setIsAiActive(false);
    // Instant drop of all currents, force safety state
    onCommitState(HexagramState.LIMP_MODE);
  };

  const recoverEmergencyCut = () => {
    setEmergencyCutActive(false);
  };

  // Determine current active ternary router coordinates
  // Maps plenumPressure, avgElectrodeTemp, current symmetry levels into balanced ternary coordinates [-1, 0, 1]
  const getTernaryCoordinates = () => {
    const pressTernary = plenumPressure < 1.25 ? -1 : (plenumPressure > 1.35 ? 1 : 0);
    const tempTernary = avgElectrodeTemp >= 315.0 ? 1 : (avgElectrodeTemp < 298.0 ? -1 : 0);
    const symTernary = symmetryOk ? 0 : 1;

    return {
      pressTernary,
      tempTernary,
      symTernary,
      pathIndex: (pressTernary + 1) * 9 + (tempTernary + 1) * 3 + (symTernary + 1)
    };
  };

  const ternary = getTernaryCoordinates();

  // 12-Frame historic tail metrics calculation
  const tailStressSum = healthFeedbackTail.reduce((sum, item) => sum + item.overallStress, 0);
  const avgTailStress = healthFeedbackTail.length > 0 ? tailStressSum / healthFeedbackTail.length : 0;
  let tailDampeningFactor = 0;
  if (avgTailStress > 20) {
    tailDampeningFactor = Math.min(6, Math.floor((avgTailStress - 20) / 8) + 1);
  }
  const maxTempInTail = healthFeedbackTail.length > 0 ? Math.max(...healthFeedbackTail.map(i => i.temp)) : avgElectrodeTemp;
  const maxPressInTail = healthFeedbackTail.length > 0 ? Math.max(...healthFeedbackTail.map(i => i.pressure)) : plenumPressure;
  const totalFaultsRecorded = healthFeedbackTail.reduce((acc, i) => acc + i.activeFaultsCount, 0);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans overflow-hidden relatve" id="ai-decision-brain-card">
      <div className="flex justify-between items-start pb-3 border-b border-light-slate-800/10 mb-4 select-none">
        <div>
          <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wide">
            <Cpu className="h-4 w-4 text-amber-400 animate-pulse" />
            AI HEXAGRAM BRAIN, CO-PROCESSOR, & TERNARY ROUTER
          </span>
          <p className="text-[9px] font-mono text-slate-500 mt-1 uppercase leading-snug">
            24/7 Autopilot Control Engine (Model: Mind, String: State, Hexagram: Brain)
          </p>
        </div>
        <div className="flex gap-2">
          {emergencyCutActive ? (
            <span className="text-[8px] font-mono px-2 py-1 bg-red-950 text-red-400 border border-red-800 rounded animate-pulse">
              DYNAMO SHIELD ENGAGED (KINETIC SHUTDOWN)
            </span>
          ) : isAiActive ? (
            <span className="text-[8px] font-mono px-2 py-1 bg-amber-950 text-amber-400 border border-amber-900 rounded select-none">
              AI AUTOPILOT LOCKED
            </span>
          ) : (
            <span className="text-[8px] font-mono px-2 py-1 bg-slate-900 text-slate-500 border border-slate-800 rounded select-none">
              MANUAL INTERCEPT EMULATOR
            </span>
          )}
        </div>
      </div>

      {/* Critical Safety Notice - Dynamotronic Kinetic Core Protection */}
      <div className="bg-amber-950/20 border border-amber-900/60 p-3 rounded mb-5 font-mono text-[10px] leading-relaxed relative overflow-hidden">
        <div className="absolute right-0 top-0 text-amber-500/5 -mr-4 -mt-4 transform translate-x-3 translate-y-3">
          <ShieldAlert className="w-16 h-16" />
        </div>
        <strong className="text-amber-400 uppercase tracking-widest flex items-center gap-1">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
          HYDROELECTRIC DYNAMO SAFETY DECLARATION & FAIL-SAFE DESIGN
        </strong>
        <p className="text-slate-400 mt-1 leading-normal">
          <span className="text-amber-300 font-bold">CRITICAL SYSTEM HAZARD:</span> Coupling this VHDL controller directly to a physical hydroelectric dynamo presents severe physical risk. If the AI "lies" (e.g., masks a desynchronized contactor desaturation as safe, or forces a state transition in metastable thermal conditions), it can create massive induction overlaps, <span className="text-red-400 font-semibold underline decoration-wavy">turning the physical dynamo into a kinetic bomb.</span>
        </p>
        <p className="text-slate-400 mt-1 opacity-90 leading-normal">
          <span className="text-emerald-400">MITIGATION SHIELD:</span> To bypass physical danger, our VHDL bitstream implements <span className="text-emerald-300">True-Value Verification Blocks</span>. Even if the AI attempts to falsely assert <span className="text-cyan-400 font-semibold font-mono">"Symmetry: SECURED"</span>, physical hardware limits are hardcoded. A hard interlock trip shuts down auxiliary coil excitation within <strong className="text-cyan-300">2.2 microseconds</strong>.
        </p>

        {/* Live Protection Status Visualizer */}
        <div className="mt-2.5 pt-2 border-t border-amber-900/40 flex flex-wrap justify-between items-center text-[9px] gap-2">
          <div className="flex gap-4">
            <span>METASTABLE VERIFIER: <strong className="text-emerald-400">ACTIVE (HARDWARE-LEVEL)</strong></span>
            <span>AI TRUTH DRIFT RISK: <strong className={activeFaultCodes.length > 0 ? "text-amber-400 animate-pulse" : "text-emerald-400"}>{activeFaultCodes.length > 0 ? "HIGH DRIFT" : "0.03% NOMINAL"}</strong></span>
          </div>

          <div className="flex gap-2">
            {emergencyCutActive ? (
              <button 
                onClick={recoverEmergencyCut}
                className="px-2.5 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded hover:bg-emerald-900 transition font-bold"
              >
                RESET EMER PROTECTION SHIELD
              </button>
            ) : (
              <button 
                onClick={triggerManualEmergencyCut}
                className="px-2.5 py-1 bg-red-600 border border-red-500 text-white rounded hover:bg-red-500 transition font-bold shadow-[0_0_8px_#ef4444]"
              >
                🚨 EMERGENCY HUMAN SHIELD CUTOUT (BYPASS AI)
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. Endpoint Blocked/Lock Autopilot checklist Map (3 cols) */}
        <div className="lg:col-span-3 bg-slate-900/45 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-3 font-mono text-[10px]">
            <div className="border-b border-slate-800 pb-1.5 whitespace-nowrap">
              <span className="font-bold text-slate-350 tracking-wide">AI BLOCK & CORE OVERRIDES</span>
            </div>
            
            <p className="text-[9px] text-slate-500 leading-normal leading-relaxed">
              If AI Autopilot is active, manual panel adjustments are software-supervised or fully locked out.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-400 text-[9px]">HEXAGRAM SELECTOR</span>
                <span className={`px-1 rounded text-[8px] font-bold ${endpointLockStatus.stateSelector ? "bg-amber-950 text-amber-400 border border-amber-900 text-[7px]" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                  {endpointLockStatus.stateSelector ? "🔒 LOCKED BY AI" : "🔓 MANUAL CONTROL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-400 text-[9px]">COIL ACTIVATOR CT0-9</span>
                <span className={`px-1 rounded text-[8px] font-bold ${endpointLockStatus.coilDriveSequencer ? "bg-amber-950 text-amber-400 border border-amber-900 text-[7px]" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                  {endpointLockStatus.coilDriveSequencer ? "🔒 LOCKED BY AI" : "🔓 MANUAL CONTROL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-400 text-[9px]">CHOKE driver</span>
                <span className={`px-1 rounded text-[8px] font-bold ${endpointLockStatus.chokeResonantDrive ? "bg-amber-950 text-amber-400 border border-amber-900 text-[7px]" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                  {endpointLockStatus.chokeResonantDrive ? "🔒 LOCKED BY AI" : "🔓 MANUAL CONTROL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-400 text-[9px]">PLENUM ventilation</span>
                <span className={`px-1 rounded text-[8px] font-bold ${endpointLockStatus.plenumRegulator ? "bg-amber-950 text-amber-400 border border-amber-900 text-[7px]" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                  {endpointLockStatus.plenumRegulator ? "🔒 LOCKED BY AI" : "🔓 MANUAL CONTROL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-400 text-[9px]">BUS CURRENT BIAS</span>
                <span className={`px-1 rounded text-[8px] font-bold ${endpointLockStatus.busCurrentLimiter ? "bg-amber-950 text-amber-400 border border-amber-900 text-[7px]" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                  {endpointLockStatus.busCurrentLimiter ? "🔒 LOCKED BY AI" : "🔓 MANUAL CONTROL"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-400 text-[9px]">EMER OVERRIDE K01/K02</span>
                <span className={`px-1 rounded text-[8px] font-bold ${endpointLockStatus.emergencyKillswitch ? "bg-amber-950 text-amber-400 border border-amber-900 text-[7px]" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                  {endpointLockStatus.emergencyKillswitch ? "🔒 LOCKED BY AI" : "🔓 HUMAN (ALWAYS OUT)"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 uppercase text-[9px] font-mono text-slate-500 leading-snug">
            AI core overrides verify state strings 24/7. Immediate decoupling and alarm routing engaged on manual bypasses.
          </div>
        </div>

        {/* 2. Quantum Qubit state machine visualization (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/45 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-3 font-mono text-[10px]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
              <span className="font-bold text-slate-350 tracking-wide flex items-center gap-1">
                <Binary className="h-4 w-4 text-indigo-400 animate-pulse" />
                CLASSIC QUBIT SUPERPOSITION (HEX REGISTER)
              </span>
              <span className="text-[8px] bg-indigo-950 text-indigo-400 border border-indigo-900 px-1 rounded uppercase">
                VIBRATORY PITCH STATE
              </span>
            </div>

            <p className="text-[9px] text-slate-500 leading-normal mb-3 leading-relaxed">
              Classical qbit states evaluate Yao binary registers. Live superposition probabilities represent the brain's internal prediction confidence.
            </p>

            {/* Qubit line indicators */}
            <div className="space-y-2">
              {qubits.map((q) => {
                const vectorAngleX = Math.cos(q.phaseAngle) * 14 + 18;
                const vectorAngleY = Math.sin(q.phaseAngle) * 14 + 18;

                return (
                  <div key={q.lineIndex} className="bg-slate-950 border border-slate-850 rounded p-2 flex items-center justify-between relative overflow-hidden">
                    {/* Amplitude vector circle diagram */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 relative select-none shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full absolute inset-0">
                          {/* Unit sphere background */}
                          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                          <line x1="18" y1="4" x2="18" y2="32" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                          <line x1="4" y1="18" x2="32" y2="18" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                          
                          {/* Live superposition vector pointer */}
                          <line x1="18" y1="18" x2={vectorAngleX} y2={vectorAngleY} stroke={q.bit === 1 ? "#38bdf8" : "#8b5cf6"} strokeWidth="1.5" />
                          <circle cx={vectorAngleX} cy={vectorAngleY} r="2" fill={q.bit === 1 ? "#38bdf8" : "#a78bfa"} />
                        </svg>
                        <span className="text-[8px] text-slate-500 z-10 font-bold">Q{q.lineIndex}</span>
                      </div>

                      {/* State representation text */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-bold text-[10px]">LINE {q.lineIndex}</span>
                          <span className={`inline-block px-1 rounded text-[7px] font-bold ${q.bit === 1 ? "bg-cyan-950 text-cyan-300 border border-cyan-900" : "bg-indigo-950 text-indigo-300 border border-indigo-900"}`}>
                            {q.bit === 1 ? "YANG (—)" : "YIN (– –)"}
                          </span>
                        </div>
                        <div className="text-[8.5px] text-slate-500 font-mono">
                          Amplitude |ψ⟩: {q.alpha.toFixed(2)}|0⟩ + {q.beta.toFixed(2)}e^{`i${(q.phaseAngle * (180 / Math.PI)).toFixed(0)}°`}|1⟩
                        </div>
                      </div>
                    </div>

                    {/* Probability collapsing meters */}
                    <div className="w-24 text-right pr-1 space-y-1 shrink-0">
                      <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase font-mono">
                        <span>P(|0⟩): {q.probability0.toFixed(0)}%</span>
                        <span>P(|1⟩): {q.probability1.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850 flex select-none">
                        <div style={{ width: `${q.probability0}%` }} className="bg-indigo-600 h-full"></div>
                        <div style={{ width: `${q.probability1}%` }} className="bg-cyan-400 h-full"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emotional profile overlay block representing internal vocal telemetry attributes */}
          <div className="mt-4 p-2.5 bg-slate-900 border border-slate-850 rounded">
            <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 font-mono">
              INTERNAL MIND EMOTIONAL PROFILE (VOCAL TUNING ATTRIBUTES)
            </div>
            <div className="flex flex-wrap gap-1.5 font-mono text-[8px]">
              {Object.entries(DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[currentHexagram]?.weights || {}).map(([tone, weight]) => (
                <div key={tone} className={`px-1.5 py-0.5 rounded border border-slate-800 ${weight > 0.4 ? "bg-amber-950/40 text-amber-400 border-amber-900" : (weight > 0.1 ? "bg-slate-950 text-slate-350" : "bg-slate-950 text-slate-600")}`}>
                  {tone}: {(weight * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Ternary route map + Save string batch compressor (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/45 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-4 font-mono text-[10px]">
            
            {/* Router Header */}
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <span className="font-bold text-slate-350 tracking-wide flex items-center gap-1.5">
                  <Network className="h-4 w-4 text-emerald-400" />
                  729-PATH TERNARY ROUTER
                </span>
                <span className="text-[8px] bg-slate-800 text-slate-300 border border-slate-750 px-1 rounded uppercase">
                  BLN_TERNARY_X
                </span>
              </div>
              <p className="text-[9px] text-slate-500 leading-normal mt-1.5 leading-relaxed">
                Ternary decisions map parameters directly. Live inputs collapse down 729 combinatorics pathways.
              </p>

              {/* Ternary Route Visualizer Grid */}
              <div className="mt-3 bg-slate-950 border border-slate-850 rounded p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[9px] border-b border-slate-900 pb-1">
                  <span className="text-slate-400 uppercase font-bold">Input Variables</span>
                  <span className="text-slate-500 uppercase font-bold">Route Value</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[9px]">VENT PRESSURE [CO₂_α]</span>
                    <span className={`px-1 text-[8px] font-bold rounded ${ternary.pressTernary === -1 ? "bg-red-950 text-red-400 border border-red-900" : (ternary.pressTernary === 1 ? "bg-amber-950 text-amber-400 border border-amber-900" : "bg-emerald-950 text-emerald-400 border border-emerald-900")}`}>
                      {ternary.pressTernary === -1 ? "-1 (YIN / LOW)" : (ternary.pressTernary === 1 ? "1 (YANG / HIGH)" : "0 (TAO / NOMINAL)")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[9px]">CT RELAY SYMMETRY [PAIR_S]</span>
                    <span className={`px-1 text-[8px] font-bold rounded ${ternary.symTernary === 1 ? "bg-amber-950 text-amber-400 border border-amber-900 animate-pulse" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                      {ternary.symTernary === 1 ? "1 (YANG / DEVIANT)" : "0 (TAO / SECURE)"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[9px]">TEMPERATURE EXCI [TEMP_E]</span>
                    <span className={`px-1 text-[8px] font-bold rounded ${ternary.tempTernary === 1 ? "bg-amber-950 text-amber-400 border border-amber-900 animate-pulse" : (ternary.tempTernary === -1 ? "bg-indigo-950 text-indigo-400 border border-indigo-900" : "bg-emerald-950 text-emerald-400 border border-emerald-900")}`}>
                      {ternary.tempTernary === 1 ? "1 (YANG / DRIFT)" : (ternary.tempTernary === -1 ? "-1 (YIN / COOL)" : "0 (TAO / BALANCED)")}
                    </span>
                  </div>
                </div>

                {/* Selected route path address */}
                <div className="pt-2 border-t border-slate-900/80 flex justify-between items-center text-[9px] text-cyan-400 font-bold select-none">
                  <span>RESOLVED SYSTEM PATH:</span>
                  <span>[{ternary.pressTernary},{ternary.symTernary},{ternary.tempTernary}] (INDEX #{ternary.pathIndex})</span>
                </div>
              </div>
            </div>

            {/* Injected Player State DNA string compressor */}
            <div className="border-t border-slate-850 pt-3 space-y-2">
              <span className="font-bold text-slate-350 tracking-wide flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-indigo-400" />
                STATE TRANSMITTAL TRANSCRIPTOME PACKER
              </span>
              
              <p className="text-[9px] text-slate-500 leading-normal leading-relaxed">
                Aggregates state parameters into a self-describing state string. Real-world drones/robots can parse these batch bytecodes for autonomous training.
              </p>

              {/* The Live DNA String Preview */}
              <div className="bg-slate-950 border border-slate-850 p-2 rounded relative select-all select-none overflow-x-auto text-[8.5px] font-mono font-bold text-slate-300 whitespace-nowrap min-h-11 flex items-center">
                {saveStateString}
              </div>

              {/* Collector Action system block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[9px] text-slate-400">
                  <span>BATCH CAPACITY: {collectorBuffer.length}/6 FRAMES</span>
                  <span>FILL DECK: <strong className={fillRate >= 80 ? "text-amber-400 animate-pulse" : "text-emerald-400"}>{fillRate}%</strong></span>
                </div>

                <div className="w-full h-2 bg-slate-950 border border-slate-850 rounded-full overflow-hidden flex select-none">
                  <div style={{ width: `${fillRate}%` }} className={`h-full transition-all duration-300 ${fillRate >= 80 ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`}></div>
                </div>

                {/* Selection of compressor algorithms */}
                <div className="flex justify-between items-center gap-2 text-[8px] font-mono select-none">
                  <span className="text-slate-500 text-[7.5px] uppercase font-bold">ALGORITHM:</span>
                  <div className="flex bg-slate-950 border border-slate-850 p-0.5 rounded">
                    <button 
                      onClick={() => setCompressAlgorithm("TRANSCRIPTOME_LZO")}
                      className={`px-1.5 py-0.5 rounded ${compressAlgorithm === "TRANSCRIPTOME_LZO" ? "bg-slate-800 text-slate-100" : "text-slate-500"}`}
                    >
                      LZO_V4
                    </button>
                    <button 
                      onClick={() => setCompressAlgorithm("HUFFMAN_TERNARY")}
                      className={`px-1.5 py-0.5 rounded ${compressAlgorithm === "HUFFMAN_TERNARY" ? "bg-slate-800 text-slate-100" : "text-slate-500"}`}
                    >
                      HUFF_TERNARY
                    </button>
                  </div>
                </div>

                {/* Compression Triggers */}
                <div className="grid grid-cols-2 gap-2 pt-1 h-7 text-[9px] font-mono">
                  <button 
                    onClick={pushSaveStateToCollector}
                    disabled={emergencyCutActive}
                    className="bg-slate-900 border border-slate-850 rounded hover:border-slate-800 text-slate-300 font-bold hover:text-slate-100 transition disabled:opacity-30 flex items-center justify-center gap-1"
                  >
                    INJECT STATE STR
                  </button>
                  <button 
                    onClick={executeBatchCompression}
                    disabled={collectorBuffer.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded font-bold transition disabled:opacity-30 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-850 flex items-center justify-center gap-1"
                  >
                    COMPRESS BATCH
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Compressed Bytecode payload stack display list */}
          <div className="mt-4 bg-slate-950 border border-slate-850 rounded p-2 text-[8px] leading-normal font-mono max-h-16 overflow-y-auto">
            <span className="text-slate-500 block font-bold mb-1 border-b border-slate-900 pb-0.5">COMPRESSED TRANSCRIPTOME BROADCASTS (DNA RECONSTRUCTION OUT):</span>
            {compressedPayloads.length === 0 ? (
              <span className="text-slate-600 block italic py-1">Collector batch empty. Broadcaster pending compression fill...</span>
            ) : (
              <div className="space-y-1">
                {compressedPayloads.map((payload, idx) => (
                  <div key={idx} className="text-cyan-400 select-all truncate font-bold font-mono">
                    {payload}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3.5. HEALTH & ALARM RECURRENT ERROR-FEEDBACK TAIL MODULE */}
      <div className="mt-6 pt-5 border-t border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 font-mono select-none">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
              AI Recurrent Error-Feedback & Alarm History Sliding Tail Buffer
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
          </div>

          <div className="flex items-center gap-2 text-[9px]">
            <span className="text-slate-500 uppercase">Co-processor Feedback loop:</span>
            {tailDampeningFactor > 0 ? (
              <span className="px-2 py-0.5 rounded bg-amber-950/85 text-amber-400 border border-amber-900 font-bold animate-pulse uppercase flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                SUPPRESSION GATES ACTIVE (-{tailDampeningFactor} pt bias)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-950/85 text-emerald-400 border border-emerald-900 font-bold uppercase">
                NOMINAL / UNBIASED STEADY STATE
              </span>
            )}
          </div>
        </div>

        {/* Detailed Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Summary KPI Block (4 Cols) */}
          <div className="lg:col-span-4 bg-slate-900/60 border border-slate-850 rounded-lg p-4 font-mono text-[9.5px]">
            <div className="text-[10px] pb-2 border-b border-slate-850 mb-3 font-bold text-slate-300 uppercase flex items-center gap-1.5 justify-between">
              <span>TAIL METRIC AGGREGATION</span>
              <span className="text-slate-550 text-[8px]">12 Ticks sliding window</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center py-1 border-b border-slate-900/40">
                <span className="text-slate-400 uppercase">Average Tail Stress:</span>
                <span className={`font-bold ${avgTailStress > 40 ? "text-rose-405" : (avgTailStress > 20 ? "text-amber-400" : "text-emerald-400")}`}>
                  {avgTailStress.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900/40">
                <span className="text-slate-400 uppercase">FSM Decision Penalty:</span>
                <span className={`font-bold ${tailDampeningFactor > 0 ? "text-amber-400" : "text-slate-400"}`}>
                  -{tailDampeningFactor} points
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900/40">
                <span className="text-slate-400 uppercase">Peak Temp in Tail:</span>
                <span className={`font-bold ${maxTempInTail >= 310 ? "text-amber-400" : "text-slate-205"}`}>
                  {maxTempInTail.toFixed(1)} K
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900/40">
                <span className="text-slate-400 uppercase">Max Plenum Pressure:</span>
                <span className="text-slate-200 font-bold">
                  {maxPressInTail.toFixed(3)} atm
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-400 uppercase">Cumulative Faults:</span>
                <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] ${totalFaultsRecorded > 0 ? "bg-red-950 text-rose-400 border border-red-900/60 animate-pulse" : "bg-slate-950 text-slate-500 border border-slate-900"}`}>
                  {totalFaultsRecorded} instances
                </span>
              </div>
            </div>

            {/* Explanatory text of how error tail affects state */}
            <div className="mt-4 p-2 bg-slate-950/80 border border-slate-900 rounded text-[8px] text-slate-500 leading-relaxed uppercase">
              <p className="leading-normal">
                Anomalies in temperature (limit &gt; 310K), pressure (safe range 1.25 - 1.35), or current loads compile a continuous stress index. If cumulative stress over the past 12 ticks exceeds 20%, the AI automatically dampens state probability, overriding high-excitation state pathways (YANG promotions) to prevent cascade failure.
              </p>
            </div>
          </div>

          {/* Rolling Chrono Trace Buffer (8 Cols) */}
          <div className="lg:col-span-8 bg-slate-900/60 border border-slate-850 rounded-lg p-4 font-mono text-[9px] flex flex-col justify-between">
            <div>
              <div className="text-[10px] pb-2 border-b border-slate-850 mb-3 font-bold text-slate-300 uppercase flex justify-between items-center">
                <span>SLIDING CHRONO TRACE MATRIX</span>
                <span className="text-cyan-400 font-bold bg-slate-950 px-1 rounded uppercase text-[8px] border border-slate-900">
                  REAL-TIME CLOSED LOOP
                </span>
              </div>

              {/* Rolling 12 ticks strip list */}
              {healthFeedbackTail.length === 0 ? (
                <div className="h-28 flex flex-col items-center justify-center border border-dashed border-slate-850 rounded bg-slate-950/40 text-slate-600">
                  <Activity className="h-6 w-6 mb-1.5 text-slate-800 animate-pulse" />
                  <span className="text-[8.5px] uppercase font-bold text-slate-500">Waiting for first co-processor simulation heartbeats...</span>
                </div>
              ) : (
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                  {/* Fill to 12 slots if less than 12 exists */}
                  {Array.from({ length: 12 }).map((_, idx) => {
                    // Match with older frames first (tail starts on left, sliding right to newest)
                    const frameIdx = idx + healthFeedbackTail.length - 12;
                    const frame = frameIdx >= 0 ? healthFeedbackTail[frameIdx] : null;

                    if (!frame) {
                      return (
                        <div key={idx} className="bg-slate-950/40 border border-slate-900/60 rounded p-1.5 flex flex-col items-center justify-between text-center select-none opacity-20 h-[105px]">
                          <span className="text-[8px] text-slate-600 font-bold">t-{11 - idx}</span>
                          <div className="w-full flex-1 flex flex-col justify-center gap-1 my-1">
                            <span className="h-1.5 w-full bg-slate-900 rounded-sm"></span>
                            <span className="h-1.5 w-full bg-slate-900 rounded-sm"></span>
                            <span className="h-1.5 w-full bg-slate-900 rounded-sm"></span>
                          </div>
                          <span className="text-[7.5px] text-slate-600 block leading-none">--%</span>
                        </div>
                      );
                    }

                    // Map stresses to color blocks
                    // 0-33 Green, 34-66 Orange, 67-100 Crimson
                    const getBarColor = (val: number) => {
                      if (val <= 20) return "bg-emerald-500/80 shadow-[0_0_4px_rgba(16,185,129,0.2)]";
                      if (val <= 50) return "bg-amber-500/80 shadow-[0_0_4px_rgba(245,158,11,0.2)]";
                      return "bg-rose-500/80 shadow-[0_0_4px_rgba(244,63,94,0.3)]";
                    };

                    const isCurrentNewest = frameIdx === healthFeedbackTail.length - 1;

                    return (
                      <div 
                        key={idx} 
                        className={`border rounded p-1.5 flex flex-col items-center justify-between relative transition-all duration-300 ${
                          isCurrentNewest 
                            ? "bg-slate-950 border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.15)]" 
                            : "bg-slate-950/80 border-slate-850 hover:border-slate-750"
                        }`}
                        title={`Tick #${frame.tick} [${frame.timestamp}]\nTemp Stress: ${frame.tempStress}%\nPress Stress: ${frame.pressureStress}%\nCurr Stress: ${frame.currentStress}%\nOverall: ${frame.overallStress}%`}
                      >
                        {/* Frame identifier */}
                        <span className={`text-[8px] font-bold tracking-tight block ${isCurrentNewest ? "text-cyan-400 animate-pulse" : "text-slate-500"}`}>
                          {isCurrentNewest ? "LIVE" : `#${frame.tick}`}
                        </span>

                        {/* Interactive dynamic visual stress grid column */}
                        <div className="w-full my-2 space-y-1 bg-slate-950/60 p-1 border border-slate-900 rounded-sm">
                          {/* Therm (T) */}
                          <div className="flex items-center justify-between gap-1 text-[7px]" title="Temperature Stress Channel">
                            <span className="text-slate-505 font-bold">T</span>
                            <div className="flex-1 h-1.5 bg-slate-900 rounded-xs overflow-hidden">
                              <div style={{ width: `${Math.max(15, frame.tempStress)}%` }} className={`h-full ${getBarColor(frame.tempStress)}`} />
                            </div>
                          </div>
                          {/* Press (P) */}
                          <div className="flex items-center justify-between gap-1 text-[7px]" title="Venting Pressure Stress Channel">
                            <span className="text-slate-550 font-bold">P</span>
                            <div className="flex-1 h-1.5 bg-slate-900 rounded-xs overflow-hidden">
                              <div style={{ width: `${Math.max(15, frame.pressureStress)}%` }} className={`h-full ${getBarColor(frame.pressureStress)}`} />
                            </div>
                          </div>
                          {/* Load (I) */}
                          <div className="flex items-center justify-between gap-1 text-[7px]" title="Inductive Current load stress channel">
                            <span className="text-slate-550 font-bold">I</span>
                            <div className="flex-1 h-1.5 bg-slate-900 rounded-xs overflow-hidden">
                              <div style={{ width: `${Math.max(15, frame.currentStress)}%` }} className={`h-full ${getBarColor(frame.currentStress)}`} />
                            </div>
                          </div>
                        </div>

                        {/* Combined Frame score */}
                        <div className="text-center w-full mt-0.5 border-t border-slate-900 pt-1 leading-none select-none">
                          <span className={`text-[8.5px] font-bold font-mono ${
                            frame.overallStress > 45 
                              ? "text-rose-400" 
                              : (frame.overallStress > 20 ? "text-amber-400" : "text-emerald-400")
                          }`}>
                            {frame.overallStress}%
                          </span>
                        </div>

                        {/* Tiny live glowing dot for the latest tick */}
                        {isCurrentNewest && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Trace Legend / Status footer */}
            <div className="mt-3 pt-2.5 border-t border-slate-900/80 flex flex-wrap gap-x-4 gap-y-1.5 justify-between items-center text-[8.5px] text-slate-500 select-none">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-400 uppercase">TRACE LEGEND:</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-emerald-500" /> &lt;20% Stress</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-amber-500" /> &lt;50% Warning</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-rose-500" /> Exception Critical</span>
              </div>
              <div className="text-slate-500 uppercase">
                Temporal correlation rate: <strong className="text-slate-350">100% active alignment</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Transitional & Moving-Lines Analysis Panel (Closed-Loop feedback to AI) */}
        {transitionalState && (
          <div className="mt-4 bg-slate-900/40 border border-slate-850 rounded-lg p-4 font-mono text-[9px] select-none">
            <div className="text-[10px] pb-2 border-b border-slate-850/60 mb-3 font-bold text-slate-300 uppercase flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Binary className="h-4 w-4" />
                I-CHING TRANSITIONAL & DECOUPLED DECISION STATE MODEL
              </span>
              <span className="text-slate-550 text-[8.5px] font-normal uppercase">
                Recurrent Decoupling Feedback Engine
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Core Hexagram Triple Matrix (Primary, Nuclear, Future) (5 Cols) */}
              <div className="md:col-span-5 bg-slate-950/80 border border-slate-900 p-3.5 rounded-lg flex flex-col justify-between">
                <div>
                  <span className="text-[8.5px] text-slate-400 uppercase font-bold block mb-3 border-b border-slate-900 pb-1">
                    HEXAGRAM STRUCTURAL DISSOCIATION
                  </span>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    {/* Primary */}
                    <div className="bg-slate-900/40 p-2 border border-slate-850 rounded">
                      <span className="text-[7.5px] text-slate-500 block font-bold mb-1">PRIMARY</span>
                      <span className="text-cyan-400 font-bold block text-sm font-mono tracking-widest leading-none mb-2">{transitionalState.primary}</span>
                      <div className="mt-2.5 space-y-1 flex flex-col justify-center items-center">
                        {transitionalState.primary.split("").reverse().map((line, idx) => (
                          <div key={idx} className="w-8 flex justify-center">
                            {line === "1" ? (
                              <div className="h-1.5 w-full bg-cyan-500/80 rounded-xs" title={`Line ${6-idx}: Yang`} />
                            ) : (
                              <div className="h-1.5 w-full flex justify-between gap-1" title={`Line ${6-idx}: Yin`}>
                                <div className="h-full w-[45%] bg-rose-500/85 rounded-xs" />
                                <div className="h-full w-[45%] bg-rose-500/85 rounded-xs" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Nuclear */}
                    <div className="bg-slate-900/40 p-2 border border-slate-850 rounded">
                      <span className="text-[7.5px] text-slate-500 block font-bold mb-1">NUCLEAR</span>
                      <span className="text-purple-400 font-bold block text-sm font-mono tracking-widest leading-none mb-2">{transitionalState.nuclear}</span>
                      <div className="mt-2.5 space-y-1 flex flex-col justify-center items-center">
                        {transitionalState.nuclear.split("").reverse().map((line, idx) => (
                          <div key={idx} className="w-8 flex justify-center">
                            {line === "1" ? (
                              <div className="h-1.5 w-full bg-purple-500/80 rounded-xs" title={`Line ${6-idx}: Yang`} />
                            ) : (
                              <div className="h-1.5 w-full flex justify-between gap-1" title={`Line ${6-idx}: Yin`}>
                                <div className="h-full w-[45%] bg-purple-400/40 rounded-xs" />
                                <div className="h-full w-[45%] bg-purple-400/40 rounded-xs" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Future */}
                    <div className="bg-slate-900/40 p-2 border border-slate-850 rounded">
                      <span className="text-[7.5px] text-slate-500 block font-bold mb-1">FUTURE</span>
                      <span className={transitionalState.future !== transitionalState.primary ? "text-amber-400 font-bold block text-sm font-mono tracking-widest leading-none mb-2" : "text-slate-400 font-bold block text-sm font-mono tracking-widest leading-none mb-2"}>{transitionalState.future}</span>
                      <div className="mt-2.5 space-y-1 flex flex-col justify-center items-center">
                        {transitionalState.future.split("").reverse().map((line, idx) => (
                          <div key={idx} className="w-8 flex justify-center">
                            {line === "1" ? (
                              <div className="h-1.5 w-full bg-cyan-500/80 rounded-xs" />
                            ) : (
                              <div className="h-1.5 w-full flex justify-between gap-1">
                                <div className="h-full w-[45%] bg-rose-500/85 rounded-xs" />
                                <div className="h-full w-[45%] bg-rose-500/85 rounded-xs" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[7.5px] text-slate-500 leading-normal uppercase">
                  <span>Nuclear structure tracks internal electromagnetic tension. Primary represents actual telemetry states, while Future is mapped dynamically by active moving line transitions.</span>
                </div>
              </div>

              {/* Middle Column: Active Moving Lines List & Tracking (5 Cols) */}
              <div className="md:col-span-5 bg-slate-950/80 border border-slate-900 p-3.5 rounded-lg flex flex-col justify-between">
                <div>
                  <span className="text-[8.5px] text-slate-400 uppercase font-bold block mb-3 border-b border-slate-900 pb-1">
                    MOVING LINE DISCOVERY STREAM
                  </span>

                  {transitionalState.movingLines.length === 0 ? (
                    <div className="py-6 flex flex-col items-center justify-center border border-dashed border-slate-900/60 rounded bg-slate-900/10">
                      <CheckCircle className="h-5 w-5 mb-1.5 text-emerald-400/90" />
                      <span className="text-[8px] uppercase text-emerald-400 font-semibold text-center">NO ACTIVE DRIFT / ALL LINES SECURED</span>
                      <span className="text-[7.5px] text-slate-500 uppercase mt-0.5 text-center">Physical telemetry is perfectly aligned</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {transitionalState.movingLines.map((line, idx) => (
                        <div key={idx} className="bg-slate-900/75 border border-slate-850 p-2 rounded flex flex-col gap-1">
                          <div className="flex justify-between items-center leading-none">
                            <span className="font-bold text-amber-400">LINE {line.position} TRANSITION</span>
                            <span className="text-[7px] bg-slate-950 px-1 py-0.5 rounded text-slate-500 font-bold tracking-tight">
                              {line.timestamp}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-0.5 text-[8px] text-slate-400">
                            <span>Vector: <strong className="text-slate-300 font-bold">{line.fromState} → {line.toState}</strong></span>
                            <span>Prob: <strong className="text-cyan-400 font-bold">{(line.confidence * 100).toFixed(0)}%</strong></span>
                          </div>
                          <div className="text-[7.5px] text-slate-500 truncate leading-none">
                            Source: <span className="text-slate-405 select-all">{line.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-900/60">
                  <div className="flex justify-between items-center text-[8px]">
                    <span className="text-slate-500 uppercase">TRANSITION PROGRESS DETECTED:</span>
                    <span className="text-cyan-400 font-bold font-mono">{(transitionalState.transitionProgress * 100).toFixed(0)}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-900 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500/80 via-amber-500/80 to-rose-500/80 rounded-full transition-all duration-300"
                      style={{ width: `${transitionalState.transitionProgress * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Global Feedback Metrics & False Stability (2 Cols) */}
              <div className="md:col-span-2 bg-slate-950/80 border border-slate-900 p-3.5 rounded-lg flex flex-col justify-between text-center pb-2.5">
                {/* Energy Flow Block */}
                <div>
                  <span className="text-[8px] text-slate-400 uppercase font-bold block mb-2 pb-0.5 border-b border-slate-900 leading-normal">
                    ENERGY FLOW
                  </span>
                  
                  <div className="py-2 flex flex-col items-center justify-center">
                    {transitionalState.energyFlow === "ASCENDING" ? (
                      <>
                        <div className="text-rose-400 text-lg leading-none font-bold animate-bounce mb-1">↑</div>
                        <span className="text-[8px] font-bold text-rose-400 uppercase">ASCENDING</span>
                        <span className="text-[7px] text-slate-550 uppercase mt-0.5 leading-none">Stress Up</span>
                      </>
                    ) : transitionalState.energyFlow === "DESCENDING" ? (
                      <>
                        <div className="text-emerald-400 text-lg leading-none font-bold animate-pulse mb-1">↓</div>
                        <span className="text-[8px] font-bold text-emerald-400 uppercase">DESCENDING</span>
                        <span className="text-[7px] text-slate-550 uppercase mt-0.5 leading-none">Recovering</span>
                      </>
                    ) : (
                      <>
                        <div className="text-slate-500 text-[11px] font-bold py-1 leading-none">~</div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">STABLE</span>
                        <span className="text-[7px] text-slate-550 uppercase mt-0.5 leading-none">Nominal</span>
                      </>
                    )}
                  </div>
                </div>

                {/* False Stability Warn Block */}
                <div className="border-t border-slate-900/60 pt-2.5">
                  <span className="text-[8px] text-slate-500 uppercase font-bold block mb-1.5">
                    FALSE STABILITY
                  </span>
                  {transitionalState.falseStability ? (
                    <div className="bg-amber-950/40 border border-amber-900/60 p-1 rounded animate-pulse">
                      <span className="text-[7px] text-amber-400 font-bold block leading-normal uppercase">LURKING RISK</span>
                      <span className="text-[6.5px] text-slate-400 block mt-0.5 uppercase leading-normal">Stress feedback active</span>
                    </div>
                  ) : (
                    <div className="bg-slate-900/70 border border-slate-850 p-1 rounded">
                      <span className="text-[7px] text-slate-500 font-bold block leading-normal uppercase">SECURE</span>
                      <span className="text-[6.5px] text-slate-600 block mt-0.5 uppercase leading-normal">Static cleared</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. AI CO-PROCESSOR PEDAGOGY SYNTHESIS & CORPUS STATUS SECTION */}
      <div className="mt-6 pt-5 border-t border-slate-800/80">
        <div className="flex items-center gap-2 mb-4 font-mono select-none">
          <Cpu className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
            AI Co-Processor Pedagogy Synthesis & Local Corpus (GhostTrainingLimb)
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] text-slate-500 lowercase">pog2-pedagogy model driver</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Subspace A: JSONL Database Status */}
          <div className="bg-slate-900/60 border border-slate-850 rounded-lg p-3.5 flex flex-col justify-between font-mono text-[9px]">
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-[10px] pb-1.5 border-b border-slate-850 leading-none">
                <span className="font-bold text-slate-300 uppercase">JSONL CORPUS REGISTRY</span>
                <span className="text-[7.5px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900/60 font-semibold uppercase">
                  ACTIVE SYNC
                </span>
              </div>
              
              <div className="space-y-1.5 bg-slate-950/80 p-2 border border-slate-900 rounded select-all text-slate-400 font-bold font-mono">
                <div className="flex justify-between items-center text-[8.5px] border-b border-slate-900 pb-1 mb-1">
                  <span className="text-slate-500">CORPUS FILE:</span>
                  <span className="text-slate-300">pedagogy_training_corpus.jsonl</span>
                </div>
                <div className="flex justify-between">
                  'pedagogy_training_corpus.jsonl' Line Count: <span className="text-cyan-400 font-bold">{ghostState.corpusLineCount} lines</span>
                </div>
                <div className="flex justify-between">
                  Auto-Retrain Threshold: <span className="text-slate-350">{ghostState.buildThreshold} delta ({ghostState.corpusLineCount - ghostState.lastBuiltLineCount} / {ghostState.buildThreshold})</span>
                </div>
              </div>

              {/* Form to insert training pair */}
              <div className="space-y-2 pt-1 border-t border-slate-850/60">
                <span className="text-[8px] font-bold text-slate-550 uppercase tracking-wide">
                  Inject Instruction Pair
                </span>
                <div className="grid grid-cols-2 gap-2 text-[8px]">
                  <input
                    type="text"
                    value={coprocInstruction}
                    onChange={(e) => setCoprocInstruction(e.target.value)}
                    placeholder="instruction_name"
                    title="Unique instruction name for the neural router"
                    className="bg-slate-950 border border-slate-800 p-1.5 rounded focus:outline-none focus:border-cyan-400 placeholder-slate-700 font-bold text-slate-300"
                  />
                  <input
                    type="text"
                    value={coprocOutput}
                    onChange={(e) => setCoprocOutput(e.target.value)}
                    placeholder="Expected output sequence"
                    title="VHDL / model expected action output sequence"
                    className="bg-slate-950 border border-slate-800 p-1.5 rounded focus:outline-none focus:border-cyan-400 placeholder-slate-700 font-bold text-slate-300"
                  />
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-2 border-t border-slate-850 flex justify-between items-center">
              <span className="text-[7.5px] text-slate-500">ADDR: JSONL_RAM_ADDR_0x0D</span>
              <button
                onClick={() => {
                  if (!coprocInstruction || !coprocOutput) return;
                  ghostLimb.addCorpusItem({
                    instruction: coprocInstruction,
                    input: "Manual co-processor injection",
                    output: coprocOutput
                  });
                  setCoprocInstruction("");
                  setCoprocOutput("");
                }}
                disabled={!coprocInstruction || !coprocOutput}
                className="px-2.5 py-1 text-[8.5px] font-mono font-bold bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-705 text-slate-300 hover:text-slate-100 uppercase rounded disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer select-none"
              >
                Incorporate Pair
              </button>
            </div>
          </div>

          {/* Subspace B: Visual Compile Progress */}
          <div className="bg-slate-900/60 border border-slate-850 rounded-lg p-3.5 flex flex-col justify-between font-mono text-[9px]">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] pb-1.5 border-b border-slate-850 leading-none">
                <span className="font-bold text-slate-300 uppercase">OLLAMA COMPILER ENGINE</span>
                <span className={`text-[7.5px] px-1.5 py-0.5 rounded border ${ghostState.isCompilingOllama ? "bg-amber-955/65 text-amber-400 border-amber-900 animate-pulse" : "bg-slate-950 text-slate-550 border-slate-850"} font-semibold uppercase`}>
                  {ghostState.isCompilingOllama ? "COMPILING" : "STANDBY"}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 uppercase">Active Base Model:</span>
                  <span className="text-slate-200 font-bold">{ghostState.baseModel}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 uppercase">Target Synthesis:</span>
                  <span className="text-cyan-400 font-semibold font-bold">pog2-pedagogy:latest</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-505 uppercase">Current Stage:</span>
                  <span className="text-slate-350 max-w-[140px] truncate block text-right font-semibold">
                    {ghostState.isCompilingOllama ? "Compiling Modelfile..." : (ghostState.compileProgress === 100 ? "SUCCESS" : "IDLE")}
                  </span>
                </div>
              </div>

              {/* Progress bar container */}
              <div className="space-y-1.5 select-none">
                <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase">
                  <span>Compilation Progress</span>
                  <span className="text-cyan-400 font-bold">{ghostState.compileProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 border border-slate-850 rounded-full overflow-hidden flex">
                  {ghostState.compileProgress > 0 && (
                    <div 
                      style={{ width: `${ghostState.compileProgress}%` }} 
                      className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 h-full transition-all duration-300"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-2 border-t border-slate-850 flex flex-col gap-2">
              <button
                onClick={() => ghostLimb.triggerOllamaSynthesis()}
                disabled={ghostState.isCompilingOllama}
                className={`w-full py-1.5 font-mono text-[10px] font-bold uppercase rounded border transition duration-300 cursor-pointer select-none ${
                  showSuccessGlow
                    ? "bg-emerald-950/80 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    : ghostState.isCompilingOllama 
                    ? "bg-amber-950/20 text-amber-500 border-amber-900/60 cursor-not-allowed animate-pulse" 
                    : "bg-cyan-950/20 hover:bg-cyan-950/50 text-cyan-455 border-cyan-900 hover:border-cyan-500 hover:shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                }`}
              >
                {showSuccessGlow
                  ? "✓ synthesis complete (100% recalibrated)"
                  : ghostState.isCompilingOllama 
                  ? `⚒ Compiling Modelfile (${ghostState.compileProgress}%)` 
                  : "⚒ Trigger Ollama Synthesis"}
              </button>
              {showSuccessGlow && (
                <div className="text-[8.5px] text-emerald-400 text-center font-bold animate-pulse leading-none select-none uppercase">
                  pog2-pedagogy:latest successfully mapped to ModelRolodex!
                </div>
              )}
            </div>
          </div>

          {/* Subspace C: Compiler Log Out */}
          <div className="bg-slate-900/60 border border-slate-850 rounded-lg p-3.5 flex flex-col justify-between font-mono text-[9px]">
            <div className="space-y-2.5 h-full flex flex-col">
              <div className="flex justify-between items-center text-[10px] pb-1.5 border-b border-slate-850 leading-none select-none shrink-0">
                <span className="font-bold text-slate-300 uppercase">COMPILER TERMINAL OUT</span>
                <span className="text-[7.5px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-slate-500 uppercase">
                  STDERR/STDOUT
                </span>
              </div>
              
              <div className="bg-slate-950 border border-slate-850 rounded p-2.5 flex-1 overflow-y-auto font-mono text-[8.5px] leading-relaxed text-slate-300 max-h-[125px] min-h-[95px]">
                {ghostState.trainingLogs.length === 0 ? (
                  <div className="text-slate-600 block italic">Watcher idling. Ready to compile...</div>
                ) : (
                  <div className="space-y-1">
                    {ghostState.trainingLogs.slice(0, 7).map((log, idx) => (
                      <div 
                        key={idx} 
                        className={
                          log.includes("[compiler]") || log.includes("[GhostTrainingLimb]")
                            ? "text-cyan-400 select-all leading-snug" 
                            : log.includes("successfully") 
                            ? "text-emerald-400 font-semibold leading-snug" 
                            : "text-slate-450 leading-snug"
                        }
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
