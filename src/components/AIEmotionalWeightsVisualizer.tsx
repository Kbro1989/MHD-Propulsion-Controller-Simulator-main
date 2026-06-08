/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Heart, 
  Settings, 
  Sliders, 
  Compass, 
  Cpu, 
  MapPin, 
  AlertTriangle, 
  TrendingUp, 
  Shuffle, 
  CheckCircle,
  Play,
  RotateCcw,
  Zap,
  Flame,
  Shield,
  Eye,
  Activity,
  Anchor,
  HelpCircle
} from "lucide-react";
import { HexagramState, EmotionalTone, DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES } from "../types";

interface AIEmotionalWeightsVisualizerProps {
  currentHexagram: HexagramState;
  temperatureBias: number;
  setTemperatureBias: (v: number) => void;
  plenumPressure: number;
  setPlenumPressure: (v: number) => void;
  busCurrentBias: number;
  setBusCurrentBias: (v: number) => void;
  symmetryOk: boolean;
  activeFaultCodes: string[];
  isAiActive: boolean;
  setIsAiActive: (val: boolean) => void;
}

export default function AIEmotionalWeightsVisualizer({
  currentHexagram,
  temperatureBias,
  setTemperatureBias,
  plenumPressure,
  setPlenumPressure,
  busCurrentBias,
  setBusCurrentBias,
  symmetryOk,
  activeFaultCodes,
  isAiActive,
  setIsAiActive
}: AIEmotionalWeightsVisualizerProps) {
  // Sandbox mode override allows users to slide inputs in isolation from simulator loop
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [sandboxTemp, setSandboxTemp] = useState(300); // 280 to 330 Kelvin
  const [sandboxPressure, setSandboxPressure] = useState(1.30); // 1.10 to 1.50 atm
  const [sandboxCurrent, setSandboxCurrent] = useState(1880); // 0 to 2400 Amps
  const [sandboxSymmetry, setSandboxSymmetry] = useState(true);
  const [sandboxFaults, setSandboxFaults] = useState<string[]>([]);

  // Simulation of autonomous subsea drone pathing trajectory
  const [droneCoordinates, setDroneCoordinates] = useState<{ x: number; y: number }[]>([]);
  const [dronePosition, setDronePosition] = useState({ x: 180, y: 100 });
  const [droneTarget, setDroneTarget] = useState({ x: 260, y: 30 });
  const [droneHeading, setDroneHeading] = useState(0);

  // Active inputs depending on whether sandbox override is active
  const liveTemp = isSandboxMode ? sandboxTemp : (300.0 + temperatureBias);
  const livePressure = isSandboxMode ? sandboxPressure : plenumPressure;
  const liveCurrent = isSandboxMode ? sandboxCurrent : (1880.0 + busCurrentBias);
  const liveSymmetry = isSandboxMode ? sandboxSymmetry : symmetryOk;
  const liveFaults = isSandboxMode ? sandboxFaults : activeFaultCodes;

  // Compute live emotional modifiers due to physical stresses
  // 1. Temperature stresses
  const tempDiffK = Math.max(0, liveTemp - 300);
  const tempVigilanceMod = tempDiffK * 0.015;  // 1.5% Vigilance per degree > 300K
  const tempTensionMod = tempDiffK * 0.012;    // 1.2% Tension per degree
  const tempFearMod = Math.max(0, liveTemp - 310) * 0.035; // 3.5% Fear when approaching shutdown (320K)

  // 2. Pressure stresses
  const pressureDiffAtm = Math.abs(livePressure - 1.30);
  const pressVigilanceMod = pressureDiffAtm * 0.6; // Scale vigilance on pressure drift
  const pressTensionMod = pressureDiffAtm * 0.55;  // Scale tension

  // 3. Current loads
  const currentRatio = Math.min(1.2, liveCurrent / 1880);
  const courageCurrentMod = Math.max(0, currentRatio - 0.7) * 0.25; // High currents drive courage

  // 4. Faults impact
  const faultFearMod = liveFaults.length * 0.12; 
  const faultTensionMod = liveFaults.length * 0.09;
  const symmetryFearMod = !liveSymmetry ? 0.30 : 0.0; // Bad symmetry drives high fear and tension
  const symmetryTensionMod = !liveSymmetry ? 0.20 : 0.0;

  // Base state definition weights
  const baseProfile = DEFAULT_HEXAGRAM_EMOTIONAL_PROFILES[currentHexagram] || {
    weights: {
      [EmotionalTone.QUIETUDE]: 0.5,
      [EmotionalTone.SERENITY]: 0.5,
      [EmotionalTone.VIGILANCE]: 0,
      [EmotionalTone.COURAGE]: 0,
      [EmotionalTone.DETERMINATION]: 0,
      [EmotionalTone.TENSION]: 0,
      [EmotionalTone.FEAR]: 0,
    }
  };

  // Synthesize modified real-time weights
  const rawWeights: Record<EmotionalTone, number> = {
    [EmotionalTone.QUIETUDE]: Math.max(0, baseProfile.weights[EmotionalTone.QUIETUDE] - (tempTensionMod * 0.4) - (faultFearMod * 0.5)),
    [EmotionalTone.SERENITY]: Math.max(0, baseProfile.weights[EmotionalTone.SERENITY] - (tempTensionMod * 0.5) - (faultFearMod * 0.6) - (pressureDiffAtm * 0.4)),
    [EmotionalTone.VIGILANCE]: Math.min(1.0, baseProfile.weights[EmotionalTone.VIGILANCE] + tempVigilanceMod + pressVigilanceMod + (liveFaults.length ? 0.15 : 0)),
    [EmotionalTone.COURAGE]: Math.max(0, Math.min(1.0, baseProfile.weights[EmotionalTone.COURAGE] + courageCurrentMod - (faultFearMod * 0.2))),
    [EmotionalTone.DETERMINATION]: Math.min(1.0, baseProfile.weights[EmotionalTone.DETERMINATION] + (tempDiffK > 5 ? 0.10 : 0) + (pressureDiffAtm > 0.05 ? 0.10 : 0)),
    [EmotionalTone.TENSION]: Math.min(1.0, baseProfile.weights[EmotionalTone.TENSION] + tempTensionMod + pressTensionMod + faultTensionMod + symmetryTensionMod),
    [EmotionalTone.FEAR]: Math.min(1.0, baseProfile.weights[EmotionalTone.FEAR] + tempFearMod + faultFearMod + symmetryFearMod),
  };

  // Normalize weights so they sum to 100%
  const totalRawWeight = Object.values(rawWeights).reduce((sum, w) => sum + w, 0) || 1;
  const currentWeights = {} as Record<EmotionalTone, number>;
  Object.keys(rawWeights).forEach((key) => {
    currentWeights[key as EmotionalTone] = parseFloat(((rawWeights[key as EmotionalTone] / totalRawWeight) * 100).toFixed(1));
  });

  // Calculate pre-execution AI state paths recommendation
  // Determined by the highest normalized emotional weight profile
  const dominantEmotionalState = Object.entries(currentWeights).reduce(
    (max, cur) => (cur[1] > max[1] ? cur : max),
    [EmotionalTone.QUIETUDE, 0]
  )[0] as EmotionalTone;

  interface AIStatePathSelection {
    target: string;
    description: string;
    securityLockStatus: string;
    ternaryCoordinates: string;
    vocalPitchShift: string;
  }

  const getAiStatePathSelection = (): AIStatePathSelection => {
    if (currentWeights[EmotionalTone.FEAR] > 35 || liveFaults.includes("T-02") || !liveSymmetry) {
      return {
        target: "LIMP_MODE (111001) / EMERGENCY RECOVERY",
        description: "AI mind perceives hazardous induction overlap. Safe-harbor program active, dropping bus limits dynamically under 240s boot safety rules.",
        securityLockStatus: "HARD LOCKED — Human bypass restricted unless manually isolated via K-01/K-02 keys.",
        ternaryCoordinates: `[+1, +1, -1]`,
        vocalPitchShift: "-15% Subdued, cautions tones"
      };
    }
    if (currentWeights[EmotionalTone.TENSION] > 30 || liveTemp >= 310) {
      return {
        target: "TR_SALT (111010) or TR_CRIT (111011)",
        description: "Pre-staging dry ice sublimation to cool SiC electrode arrays. Active preheating and current throttling to 1500A engaged.",
        securityLockStatus: "AI SUPERVISED — Handover checks arming. Sliders and controllers software-locked.",
        ternaryCoordinates: `[0, +1, +1]`,
        vocalPitchShift: "+25% High speaking rate synthetic strain response"
      };
    }
    if (currentWeights[EmotionalTone.DETERMINATION] > 25 && currentHexagram === HexagramState.IDLE) {
      return {
        target: "PURGE MODE (001001)",
        description: "Electrode matrix cleaning cycles active. Discharging fresh Glauber's salt hydration water to purge salt bridges from active foam.",
        securityLockStatus: "AUTO SHEDDING ACTIVE — Flow-control valves fully bound to AI optimization rules.",
        ternaryCoordinates: `[-1, 0, 0]`,
        vocalPitchShift: "+10% High frequency vocal resonance tuning"
      };
    }
    if (currentWeights[EmotionalTone.COURAGE] > 30) {
      return {
        target: "TRANSIT SPRINTMODE (111000)",
        description: "Optimal propulsion density target. All 10 high-power contactors aligned. 5,000 V DC bus is fully active, symmetry checks cleared.",
        securityLockStatus: "FULLY INTEGRATED CO-PROCESSOR LOCK — Manual selection bypassed.",
        ternaryCoordinates: `[+1, 0, 0]`,
        vocalPitchShift: "+15% Speak speaking tempo configured"
      };
    }
    if (currentWeights[EmotionalTone.SERENITY] > 35) {
      return {
        target: "STEALTH STEADY STATE (110100)",
        description: "Perfect laminar boundary layer control. CO₂ gas transpiration is active, suppressing acoustic sonar echo signatures.",
        securityLockStatus: "AI STEERING LOCKED — Acoustic signatures and degaussing arrays dynamically balanced.",
        ternaryCoordinates: `[0, 0, -1]`,
        vocalPitchShift: "-20% Hushed low-tempo vocal whisper profile"
      };
    }
    return {
      target: "IDLE GLIDE (000000)",
      description: "Low-current thermal rest, cooling core. Bellows are stabilizing salt hydrate volumes toward zero volumetric expansion.",
      securityLockStatus: "STANDBY RECONSTRUCTION — Operator controls standard.",
      ternaryCoordinates: `[0, 0, 0]`,
      vocalPitchShift: "-5% Resting frequency"
    };
  };

  const aiDecision = getAiStatePathSelection();

  // Dynamic autonomous subsea drone simulation loops
  useEffect(() => {
    // Generate static background obstacles/path outline
    const pts = [];
    for (let i = 0; i < 18; i++) {
      const theta = (i / 17) * Math.PI;
      const wave = Math.sin(theta * 2.5) * 20;
      pts.push({
        x: 40 + i * 18,
        y: 80 - wave + Math.cos(theta * 1.5) * 10
      });
    }
    setDroneCoordinates(pts);
  }, []);

  // Animate the drone following targets dynamically influenced by the Mind's state
  useEffect(() => {
    const runPath = setInterval(() => {
      setDronePosition((prev) => {
        // Direct target recalculation
        const dx = droneTarget.x - prev.x;
        const dy = droneTarget.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 4) {
          // Relocate targeted grid point based on state
          const newX = 50 + Math.random() * 260;
          let newY = 20 + Math.random() * 90;
          
          // Emotional states restrict spatial limits or adjust path boundaries
          if (dominantEmotionalState === EmotionalTone.FEAR || dominantEmotionalState === EmotionalTone.TENSION) {
            // Under tension/fear, drone pathing shifts deep to avoid threats (forced safe maneuvers)
            newY = 100 + Math.random() * 20; 
          } else if (dominantEmotionalState === EmotionalTone.COURAGE) {
            // Courage: direct fast travel path
            newY = 15 + Math.random() * 30;
          }

          setDroneTarget({ x: newX, y: newY });
          return prev;
        }

        // Apply heading updates
        const angle = Math.atan2(dy, dx);
        setDroneHeading(angle * (180 / Math.PI));

        // Travel speeds
        let speed = 1.6;
        if (dominantEmotionalState === EmotionalTone.FEAR) speed = 0.5; // low speed LIMP MODE creeping
        if (dominantEmotionalState === EmotionalTone.COURAGE) speed = 3.2; // transit sprint mode

        return {
          x: prev.x + Math.cos(angle) * speed,
          y: prev.y + Math.sin(angle) * speed,
        };
      });
    }, 45);

    return () => clearInterval(runPath);
  }, [droneTarget, dominantEmotionalState]);

  // Handle manual sandbox injection changes
  const toggleFaultInSandbox = (code: string) => {
    setSandboxFaults((prev) => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans mb-5 relative overflow-hidden" id="ai-emotional-visualizer-card">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Heart className="w-56 h-56 text-pink-500 animate-pulse" />
      </div>

      {/* Header with high-tech badge */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-850 mb-5 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500 animate-pulse shrink-0" />
            <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
              REAL-TIME AI MIND EMOTIONAL SPECTRUM & DECISION PATHING
            </h2>
          </div>
          <p className="text-[10px] uppercase font-mono text-slate-500 mt-1 leading-normal leading-relaxed">
            Neural Tuning Layer (Model == Mind | Hexagram == Brain | State String == DNA)
          </p>
        </div>

        {/* Sandbox Override Trigger Panel */}
        <div className="flex items-center gap-2 select-none">
          <span className="text-[9px] font-mono text-slate-400">TUNING SANDBOX PLAYGROUND:</span>
          <button
            onClick={() => setIsSandboxMode(!isSandboxMode)}
            className={`px-3 py-1 text-[9px] font-mono font-bold rounded border uppercase flex items-center gap-1.5 transition ${
              isSandboxMode 
                ? "bg-pink-950/40 text-pink-400 border-pink-700/60 shadow-[0_0_6px_rgba(236,72,153,0.15)]" 
                : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-750"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            {isSandboxMode ? "SANDBOX OVERRIDE: ACTIVE" : "SIMULATOR BOUND: ON"}
          </button>
        </div>
      </div>

      {/* Sandbox Controller Tray when override mode active */}
      {isSandboxMode && (
        <div className="bg-pink-950/10 border border-pink-900/30 p-4 rounded mb-5 font-mono text-[10px] space-y-3.5 transition duration-200">
          <div className="flex justify-between items-center text-[9px] text-pink-400 border-b border-pink-900/30 pb-1.5 font-bold uppercase">
            <span>🎛️ SANDBOX TELEMETRY INJECTOR (Isolated Tuning Playground)</span>
            <span className="animate-pulse">MANUAL TESTING LIVE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Range 1: Temperature slider */}
            <div className="space-y-1">
              <div className="flex justify-between font-bold text-slate-400">
                <span>ELECTRODE TEMP (K):</span>
                <span className={sandboxTemp >= 310 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                  {sandboxTemp} K
                </span>
              </div>
              <input 
                type="range" 
                min="280" 
                max="330" 
                value={sandboxTemp}
                onChange={(e) => setSandboxTemp(parseInt(e.target.value))}
                className="w-full accent-pink-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-slate-550">
                <span>280K (ICE COLD)</span>
                <span>320K (LIMIT)</span>
              </div>
            </div>

            {/* Range 2: Plenum Pressure slider */}
            <div className="space-y-1">
              <div className="flex justify-between font-bold text-slate-400">
                <span>PLENUM PRESSURE:</span>
                <span className={sandboxPressure < 1.25 || sandboxPressure > 1.35 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                  {sandboxPressure.toFixed(2)} atm
                </span>
              </div>
              <input 
                type="range" 
                min="1.10" 
                max="1.50" 
                step="0.01"
                value={sandboxPressure}
                onChange={(e) => setSandboxPressure(parseFloat(e.target.value))}
                className="w-full accent-pink-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-slate-550">
                <span>1.10atm (EMPTY)</span>
                <span>1.50atm (HIGH)</span>
              </div>
            </div>

            {/* Range 3: Bus current slider */}
            <div className="space-y-1">
              <div className="flex justify-between font-bold text-slate-400">
                <span>BUS CURRENT:</span>
                <span className="text-cyan-400 font-bold">{sandboxCurrent} A</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="2400" 
                value={sandboxCurrent}
                onChange={(e) => setSandboxCurrent(parseInt(e.target.value))}
                className="w-full accent-pink-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-slate-550">
                <span>0A (OFF)</span>
                <span>2000A (DANGER)</span>
              </div>
            </div>

            {/* Range 4: Symmetry and Fault injections */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400">RELAY SYMMETRY:</span>
                <button
                  onClick={() => setSandboxSymmetry(!sandboxSymmetry)}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold ${sandboxSymmetry ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : "bg-red-950 text-red-500 border border-red-900"}`}
                >
                  {sandboxSymmetry ? "COMPLIANT" : "ASYMMETRIC FAULT"}
                </button>
              </div>

              {/* Multi-toggle fast faults */}
              <div className="space-y-1">
                <span className="font-bold text-slate-450 text-[8px]">SIMULATE CORE ALARMS:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {["T-02", "S-02", "M-02"].map(code => {
                    const isSet = sandboxFaults.includes(code);
                    return (
                      <button
                        key={code}
                        onClick={() => toggleFaultInSandbox(code)}
                        className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border transition ${isSet ? "bg-red-900 text-red-100 border-red-700" : "bg-slate-900 text-slate-500 border-slate-800"}`}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Core Column 1: Live Emotional Weights Meter (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/40 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-3.5 font-mono">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 select-none">
              <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                <Shuffle className="h-4 w-4 text-pink-400" />
                NEURAL WAVE WEIGHTS
              </span>
              <span className="text-[8px] bg-pink-950/40 text-pink-400 border border-pink-900/40 px-1.5 rounded uppercase">
                VOCAL SPEECH RATIOS
              </span>
            </div>

            <p className="text-[9px] text-slate-500 leading-normal leading-relaxed">
              Dynamically derived state modifiers map sensor pressures and temperatures directly into vocal weights, modifying Speak models in real time:
            </p>

            {/* The 7 Weights Meters List */}
            <div className="space-y-2.5">
              {Object.entries(currentWeights).map(([tone, weight]) => {
                // Color mapping per emotional trait
                let barColor = "bg-slate-600";
                let textColor = "text-slate-400";
                let glowShadow = "";

                if (tone === EmotionalTone.QUIETUDE) { barColor = "bg-blue-600"; textColor = "text-blue-400"; }
                else if (tone === EmotionalTone.SERENITY) { barColor = "bg-emerald-500"; textColor = "text-emerald-450"; }
                else if (tone === EmotionalTone.VIGILANCE) { barColor = "bg-amber-450"; textColor = "text-amber-400"; }
                else if (tone === EmotionalTone.COURAGE) { barColor = "bg-cyan-400"; textColor = "text-cyan-450"; }
                else if (tone === EmotionalTone.DETERMINATION) { barColor = "bg-purple-500"; textColor = "text-purple-400"; }
                else if (tone === EmotionalTone.TENSION) { 
                  barColor = "bg-orange-500"; 
                  textColor = "text-orange-400";
                  if (weight > 15) glowShadow = "shadow-[0_0_8px_rgba(249,115,22,0.35)]";
                }
                else if (tone === EmotionalTone.FEAR) { 
                  barColor = "bg-red-500"; 
                  textColor = "text-red-400";
                  if (weight > 15) glowShadow = "shadow-[0_0_8px_rgba(239,68,68,0.45)]";
                }

                const isHighest = tone === dominantEmotionalState;

                return (
                  <div key={tone} className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isHighest ? "bg-pink-500 animate-ping" : "bg-slate-700"}`} />
                        <span className={isHighest ? "text-slate-200 font-extrabold tracking-wide uppercase" : "text-slate-400"}>
                          {tone}
                        </span>
                        {isHighest && (
                          <span className="text-[7.5px] bg-pink-950 text-pink-400 border border-pink-900 px-1 rounded uppercase font-bold tracking-widest scale-90">
                            DOMINANT MIND INTENT
                          </span>
                        )}
                      </div>
                      <span className={`font-mono ${textColor} ${isHighest ? "text-pink-400 scale-105" : ""}`}>
                        {weight.toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-950 border border-slate-850 rounded-full overflow-hidden flex select-none relative">
                      <div 
                        style={{ width: `${weight}%` }} 
                        className={`h-full transition-all duration-300 ${barColor} ${glowShadow}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 flex flex-wrap gap-2 text-[8px] font-mono select-none text-slate-500 uppercase">
            <span>COIL INDUCTION MULTIPLIER: <strong className="text-slate-350">{(currentWeights[EmotionalTone.COURAGE] * 0.01 + 0.5).toFixed(2)}x</strong></span>
            <span>THERMAL EXPANSION DECAY: <strong className="text-slate-350">{((100 - currentWeights[EmotionalTone.SERENITY]) * 0.01).toFixed(2)}γ</strong></span>
          </div>
        </div>

        {/* Core Column 2: The pre-calculated AI decision trail and Ternary output (3 cols) */}
        <div className="lg:col-span-3 bg-slate-900/40 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-4 font-mono text-[10px]">
            
            <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center select-none">
              <span className="font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
                <Compass className="h-4 w-4 text-emerald-400" />
                PRE-COMMIT MIND SNAPSHOT
              </span>
            </div>

            <p className="text-[9px] text-slate-500 leading-normal leading-relaxed">
              Simulating the AI’s pathing decision metrics *before* committing the hardware bitstream on the next metabolic clock cycle:
            </p>

            {/* Pre-execution output fields */}
            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-850 rounded p-2.5 transition duration-150">
                <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1">RECOMMENDED TARGET STATE:</span>
                <span className="text-emerald-400 font-extrabold text-[11px] block select-all tracking-wide">
                  {aiDecision.target}
                </span>
                <span className="text-slate-450 text-[9px] block leading-relaxed leading-normal mt-1.5">
                  {aiDecision.description}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded p-2.5">
                <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1">CO-PROCESSOR REG OVERRIDE MASK:</span>
                <span className="text-[9px] text-slate-300 font-semibold leading-normal block">
                  {aiDecision.securityLockStatus}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded p-2.5 flex justify-between items-center h-10 select-none">
                <div>
                  <span className="text-[8px] text-slate-500 font-bold uppercase block">TERNARY COORDINATES:</span>
                  <span className="text-cyan-400 font-bold text-[10px]">{aiDecision.ternaryCoordinates}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-slate-500 font-bold uppercase block">VOCAL SPEECH PITCH:</span>
                  <span className="text-slate-300 text-[9px]">{aiDecision.vocalPitchShift}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 text-[8.5px] font-mono text-slate-500 uppercase leading-snug">
            AI evaluates 729 routes per tick. All hardware adjustments are filtered through pre-execution safety modules prior to coil activation.
          </div>
        </div>

        {/* Core Column 3: "Real-world autonomous vehicle / drone / robot pathing simulations" (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/40 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-3 font-mono">
            
            <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center select-none">
              <span className="font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-cyan-400 animate-pulse" />
                REAL-WORLD NEED TRANSFER LOGIC
              </span>
            </div>

            <p className="text-[9px] text-slate-500 leading-normal leading-relaxed">
              State bytecodes aren’t for play; they drive autonomous subsea drones, vehicles, and robots. Live flight adjustments show real-time logic transfers:
            </p>

            {/* Dynamic Drone path simulation panel */}
            <div className="bg-slate-950 border border-slate-850 rounded p-2.5 relative select-none">
              <span className="text-[8px] text-emerald-400 font-extrabold uppercase block mb-1.5 tracking-wider flex items-center gap-1">
                <Compass className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "12s" }} />
                SUBSEA DRONE FLIGHT RADAR
              </span>

              {/* Graphical radar tracking area */}
              <div className="w-full h-24 bg-slate-900/80 border border-slate-850 rounded relative overflow-hidden flex items-center justify-center">
                {/* Visual horizontal/vertical radar lines */}
                <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-500/10 pointer-events-none" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-500/10 pointer-events-none" />

                {/* Simulated contour obstacles */}
                <svg className="w-full h-full absolute inset-0 opacity-15">
                  {droneCoordinates.length > 0 && (
                    <path 
                      d={`M ${droneCoordinates.map(p => `${p.x / 1.3}, ${p.y / 1.3}`).join(" L ")}`}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                    />
                  )}
                </svg>

                {/* Subsea Target beacon point */}
                <div 
                  style={{ left: `${droneTarget.x / 1.3}px`, top: `${droneTarget.y / 1.3}px` }}
                  className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-cyan-400 border border-white animate-ping"
                />
                <div 
                  style={{ left: `${droneTarget.x / 1.3}px`, top: `${droneTarget.y / 1.3}px` }}
                  className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-cyan-400/80 border border-cyan-300"
                />

                {/* Active autonomous coordinate point */}
                <div 
                  style={{ 
                    left: `${dronePosition.x / 1.3}px`, 
                    top: `${dronePosition.y / 1.3}px`,
                    transform: `rotate(${droneHeading}deg)`
                  }}
                  className="absolute w-4.5 h-4.5 -ml-2 -mt-2 transition-transform duration-100 bg-emerald-500 border border-emerald-300 shadow shadow-emerald-500/50 flex items-center justify-center rounded-sm"
                >
                  <Anchor className="w-2.5 h-2.5 text-slate-950 font-extrabold" />
                </div>
              </div>

              {/* Guidance status logs */}
              <div className="mt-2 text-[8px] flex justify-between uppercase">
                <span>COORD: <strong className="text-slate-300">X:{dronePosition.x.toFixed(0)} Y:{dronePosition.y.toFixed(0)}</strong></span>
                <span>TRAJECTORY: <strong className={dominantEmotionalState === EmotionalTone.FEAR ? "text-red-400 animate-pulse" : "text-emerald-400"}>
                  {dominantEmotionalState === EmotionalTone.FEAR ? "DIVERGING DEEP" : "NOMINAL GLIDE"}
                </strong></span>
              </div>
            </div>

            {/* Segment showing autonomous application mappings */}
            <div className="bg-slate-950 border border-slate-850 p-2.5 rounded text-[8.5px] leading-normal space-y-1.5 selection:bg-cyan-900">
              <span className="text-slate-450 block font-bold uppercase border-b border-slate-900 pb-0.5">AUTONOMOUS EMBEDDED PATHING APPLICATIONS:</span>
              <div className="space-y-1.5 text-slate-400">
                <div className="flex gap-1.5 items-start">
                  <span className="text-cyan-400 font-extrabold shrink-0">1.</span>
                  <p><strong>GPS-Denied Navigation</strong>: Drone uses base-state DNA string registers & qbits to compute and verify positional coordinates during acoustic telemetry blackouts.</p>
                </div>
                <div className="flex gap-1.5 items-start">
                  <span className="text-cyan-400 font-extrabold shrink-0">2.</span>
                  <p><strong>Silent Pipeline Inspection</strong>: Uses checkersport shedding patterns to drop local current load, suppressing electromagnetic signatures during close-sensor scans.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 flex justify-between text-[8px] font-mono text-slate-500 uppercase select-none font-bold">
            <span>BITSTREAM ENVELOPE: DRONE_V3X_TRANS</span>
            <span className="text-emerald-500 animate-pulse">PARSING ACTIVE</span>
          </div>
        </div>

      </div>
    </div>
  );
}
