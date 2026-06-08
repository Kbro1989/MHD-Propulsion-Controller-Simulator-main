/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useEffect, useState } from "react";
import { Cpu, Zap, Activity, ShieldAlert, Sliders, ChevronRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { HexagramState, HexagramStateLabels, ElectricalReg, SysMode, SysModeLabels } from "../types";
import {
  hasActiveCloudFunctions,
  CF_PREDICTOR_URL,
  CF_TELEMETRY_URL,
  CF_HIL_SIM_URL
} from "../utils/cfIntegration";

interface SystemSchematicProps {
  currentHexagram: HexagramState;
  proposedHexagram: HexagramState;
  electricalState: ElectricalReg;
  sysMode: SysMode;
  safetyOk: boolean;
  activeFaultsCount: number;
  tickActive: boolean;
  tickCounter: number;
  currentTempSensors: number[];
  predictiveAlerts?: {
    isCritPredicted: boolean;
    predictedCriticalBreachTick: number;
    predictedCriticalBreachTemp: number;
    isWarnPredicted: boolean;
    predictedWarningBreachTick: number;
    predictedWarningBreachTemp: number;
    futureTemps: number[];
  };
}

// Dynamic waveguide photon data conduits connecting schematic modules
function WaveguideConduit({ 
  Active, 
  Surge, 
  Color = "#06b6d4", 
  SurgeColor = "#f59e0b" 
}: { 
  Active: boolean; 
  Surge: boolean; 
  Color?: string; 
  SurgeColor?: string; 
}) {
  return (
    <div className="hidden lg:flex lg:col-span-1 flex-col justify-around items-center h-full py-16 relative pointer-events-none select-none">
      <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-around items-center">
        <svg className="w-full h-full" viewBox="0 0 60 220" preserveAspectRatio="none">
          <defs>
            <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={Color} stopOpacity="0.15" />
              <stop offset="50%" stopColor={Surge ? SurgeColor : Color} stopOpacity="1" />
              <stop offset="100%" stopColor={Color} stopOpacity="0.15" />
            </linearGradient>
          </defs>
          
          {/* Waveguide Lane 1 */}
          <path d="M 5 45 L 55 45" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          <motion.path 
            d="M 5 45 L 55 45" 
            stroke="url(#laserGrad)" 
            strokeWidth="1.8" 
            strokeDasharray="14 14"
            animate={{ strokeDashOffset: [-35, 0] }}
            transition={{ repeat: Infinity, duration: Surge ? 0.35 : 1.3, ease: "linear" }}
          />

          {/* Waveguide Lane 2 */}
          <path d="M 5 110 L 55 110" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          <motion.path 
            d="M 5 110 L 55 110" 
            stroke="url(#laserGrad)" 
            strokeWidth="1.8" 
            strokeDasharray="16 16"
            animate={{ strokeDashOffset: [-40, 0] }}
            transition={{ repeat: Infinity, duration: Surge ? 0.4 : 1.6, ease: "linear" }}
          />

          {/* Waveguide Lane 3 */}
          <path d="M 5 175 L 55 175" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          <motion.path 
            d="M 5 175 L 55 175" 
            stroke="url(#laserGrad)" 
            strokeWidth="1.8" 
            strokeDasharray="12 12"
            animate={{ strokeDashOffset: [-30, 0] }}
            transition={{ repeat: Infinity, duration: Surge ? 0.28 : 1.1, ease: "linear" }}
          />
        </svg>
      </div>
      <div className={`h-2.5 w-2.5 rounded-full z-10 transition-all duration-300 ${Surge ? 'bg-amber-400 scale-125 animate-ping' : Active ? 'bg-cyan-500/70 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-slate-800'}`} />
      <div className={`h-2.5 w-2.5 rounded-full z-10 transition-all duration-300 ${Surge ? 'bg-amber-400 scale-125 animate-ping' : Active ? 'bg-cyan-500/70 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-slate-800'}`} />
    </div>
  );
}

export default function SystemSchematic({
  currentHexagram,
  proposedHexagram,
  electricalState,
  sysMode,
  safetyOk,
  activeFaultsCount,
  tickActive,
  tickCounter,
  currentTempSensors,
  predictiveAlerts,
}: SystemSchematicProps) {
  // Trigger flow surge pulse animation on hexagram transitions
  const [transitionPulse, setTransitionPulse] = useState(false);
  useEffect(() => {
    setTransitionPulse(true);
    const timer = setTimeout(() => setTransitionPulse(false), 900);
    return () => clearTimeout(timer);
  }, [currentHexagram]);

  // Map Hexagram State to visual representation
  const formatYao = (state: HexagramState): string => {
    return state.toString(2).padStart(6, "0");
  };

  // Render tiny SVG real-time Predictive sparkline chart
  const drawPredictiveSparkline = () => {
    if (!predictiveAlerts || !predictiveAlerts.futureTemps || predictiveAlerts.futureTemps.length === 0) {
      return (
        <div className="h-10 bg-slate-950/60 rounded border border-slate-900 flex items-center justify-center font-mono text-[8px] text-slate-600">
          WAITING FOR TEMPERATURE TRACES...
        </div>
      );
    }
    const temps = predictiveAlerts.futureTemps;
    const padding = 12;
    const w = 240;
    const h = 55;
    
    // Scale domain: X: 0 to 9 ticks, Y: 295K to 325K
    const getX = (index: number) => padding + (index * (w - 2 * padding)) / 9;
    const getY = (tempVal: number) => {
      const minVal = 295;
      const maxVal = 325;
      const ratio = (tempVal - minVal) / (maxVal - minVal);
      return h - padding - ratio * (h - 2 * padding);
    };

    let pathD = `M ${getX(0)} ${getY(temps[0])} `;
    for (let i = 1; i < temps.length; i++) {
      pathD += `L ${getX(i)} ${getY(temps[i])} `;
    }

    const warningY = getY(310.0);
    const criticalY = getY(320.0);

    return (
      <div className="relative">
        <svg className="w-full h-[55px] bg-slate-950/80 border border-slate-850/60 rounded select-none pointer-events-none" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          {/* Threshold dashed lines */}
          <line x1="0" y1={warningY} x2={w} y2={warningY} stroke="#f59e0b" strokeWidth="0.75" strokeOpacity="0.25" strokeDasharray="2,2" />
          <line x1="0" y1={criticalY} x2={w} y2={criticalY} stroke="#ef4444" strokeWidth="0.75" strokeOpacity="0.35" strokeDasharray="2,2" />
          
          {/* Legend bounds */}
          <text x="6" y={Math.max(10, warningY - 3)} className="fill-amber-500/50 text-[6.5px] font-mono">310K (WEAR)</text>
          <text x="6" y={Math.max(6, criticalY - 3)} className="fill-red-500/50 text-[6.5px] font-mono text-right">320K (TRIP)</text>

          {/* Interpolated future trajectory path */}
          <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Interactive node keys */}
          {temps.map((tp, idx) => {
            let dotRadius = 1.8;
            let dotColor = "fill-cyan-400";
            if (tp >= 320.0) {
              dotColor = "fill-red-500 animate-pulse";
              dotRadius = 2.4;
            } else if (tp >= 310.0) {
              dotColor = "fill-amber-500";
              dotRadius = 2.0;
            }
            return (
              <circle
                key={idx}
                cx={getX(idx)}
                cy={getY(tp)}
                r={dotRadius}
                className={dotColor}
              />
            );
          })}
        </svg>
        <div className="flex justify-between font-mono text-[6.5px] text-slate-500 px-1 mt-0.5">
          <span>T+1 tick</span>
          <span>T+5 ticks</span>
          <span>T+10 ticks (6.0s ADV)</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans relative overflow-hidden" id="sys-schematic-card">
      {/* Visual Ambient Background Grids */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent_40%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

      {/* Title & Metadata Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 mb-5">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-emerald-500 animate-pulse" />
          <h3 className="text-sm font-display font-medium tracking-wide text-slate-200">
            SYSTEM RTL SCHEMATIC ARCHITECTURE
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-0">
          {hasActiveCloudFunctions() ? (
            <div className="group relative flex items-center gap-1.5 font-mono text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-900 px-2 py-0.5 rounded cursor-help">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>CLOUD CO-PROCESSORS ACTIVE</span>
              
              {/* Tooltip to list active endpoints */}
              <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-slate-900 border border-slate-800 rounded shadow-xl z-50 text-[9px] text-slate-300 font-mono hidden group-hover:block leading-relaxed">
                <div className="font-bold text-cyan-400 border-b border-slate-800 pb-1 mb-2">ACTIVE WEBHOOK CO-PROCESSORS</div>
                {CF_TELEMETRY_URL && <div className="truncate"><span className="text-emerald-400">Telemetry:</span> {CF_TELEMETRY_URL}</div>}
                {CF_PREDICTOR_URL && <div className="truncate"><span className="text-emerald-400">Predictor:</span> {CF_PREDICTOR_URL}</div>}
                {CF_HIL_SIM_URL && <div className="truncate"><span className="text-emerald-400">HIL Sim:</span> {CF_HIL_SIM_URL}</div>}
              </div>
            </div>
          ) : (
            <div className="group relative flex items-center gap-1.5 font-mono text-[10px] text-slate-500 bg-slate-900/60 border border-slate-800/80 px-2 py-0.5 rounded cursor-help">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
              <span>LOCAL EMULATION ONLY</span>
              
              {/* Tooltip to instruct user */}
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-900 border border-slate-800 rounded shadow-xl z-50 text-[9px] text-slate-400 font-mono hidden group-hover:block leading-normal">
                <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 mb-1.5">HYBRID CLOUD ACCELERATION</div>
                Configure cloud function trigger webhooks (e.g. <code className="text-amber-400">VITE_CF_...</code>) in your local <code className="text-amber-400">.env</code> to offload live telemetry logs, simulation evaluations, and custom high-order thermal Taylor models!
              </div>
            </div>
          )}
          <span className="font-mono text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
            POG2-MHD-PROP-001 REV 1.0
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded">
            <span className={`h-1.5 w-1.5 rounded-full ${tickActive ? 'bg-emerald-400 animate-ping' : 'bg-emerald-600'}`} />
            METABOLIC TICK: <span className="text-emerald-300 font-bold">{tickCounter}</span>
          </div>
        </div>
      </div>

      {/* Schematic Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch relative min-h-[340px]">
        
        {/* Left Side: Inputs Channels (ADCs & IMUs) */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-3 h-full">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1 px-1">PHYSICAL SENSORS</div>
          
          {/* SPI Temperature Bank */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 relative hover:border-slate-700 transition flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-mono font-bold">TEMP SPI (4x ADCs)</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>
            
            {/* 4x4 Electrode Heatmap Grid Overlay */}
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1.5 rounded border border-slate-800/50">
              {currentTempSensors && currentTempSensors.map((temp, i) => {
                const ratio = Math.max(0, Math.min(1, (temp - 290) / 30)); // 290K to 320K
                let colorClass = "bg-emerald-500/10 text-emerald-450 border-emerald-950";
                
                let backgroundColor = `rgba(16, 185, 129, ${0.1 + ratio * 0.45})`;
                let borderColor = "rgba(16, 185, 129, 0.25)";

                if (temp >= 320) {
                  backgroundColor = `rgba(239, 68, 68, ${0.2 + ratio * 0.55})`;
                  borderColor = "rgba(239, 68, 68, 0.8)";
                  colorClass = "text-red-400 animate-pulse font-bold";
                } else if (temp >= 310) {
                  backgroundColor = `rgba(245, 158, 11, ${0.15 + ratio * 0.5})`;
                  borderColor = "rgba(245, 158, 11, 0.6)";
                  colorClass = "text-amber-400 font-bold";
                }

                return (
                  <div
                    key={i}
                    style={{ backgroundColor, borderColor }}
                    className={`h-[18px] rounded border font-mono text-[6.5px] flex flex-col items-center justify-center transition-all ${colorClass}`}
                    title={`Electrode ${i}: ${temp.toFixed(1)}K`}
                  >
                    <span className="opacity-75">E{i}</span>
                    <span className="text-[5.5px] leading-none">{Math.round(temp)}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between font-mono text-[8px] text-slate-500 pt-0.5">
              <span>Electrode Heat Array</span>
              <span className="text-emerald-500">Active</span>
            </div>
          </div>

          {/* SPI Plenum Pressure Bank */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 relative hover:border-slate-700 transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-400 font-mono font-bold">PRESSURE SPI</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[9px] text-slate-500">
                <span>Plenum 0..3 (1.3 atm)</span>
                <span className="text-cyan-500">Normal</span>
              </div>
              <div className="w-full bg-slate-950 h-1 rounded overflow-hidden">
                <div className="bg-cyan-500 h-full w-[70%] animate-pulse" />
              </div>
            </div>
          </div>

          {/* SPI Current Bus */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 relative hover:border-slate-700 transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-400 font-mono font-bold">CURRENT SPI</span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[9px] text-slate-500">
                <span>1880A @ 5000V</span>
                <span className="text-amber-500">Active</span>
              </div>
              <div className="w-full bg-slate-950 h-1 rounded overflow-hidden">
                <div className="bg-amber-500 h-full w-[45%] animate-pulse" />
              </div>
            </div>
          </div>

          {/* IMU Interupter */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 relative hover:border-slate-700 transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-400 font-mono font-bold">IMU (6-AXIS INT)</span>
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              <span className="text-[9px] text-slate-500">DECOHERENCE IRQ</span>
              <span className="text-[9px] text-emerald-400 font-bold">ARMED</span>
            </div>
          </div>
        </div>

        {/* Diagnostic Waveguide Conduit (Inputs -> Processors) */}
        <WaveguideConduit Active={tickActive} Surge={transitionPulse} Color="#0ea5e9" SurgeColor="#10b981" />

        {/* Center: Main Processor Core & Predictions */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3 h-full">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1 px-1">FPGA PL COMBINATORIAL PROCESSORS</div>

          {/* GHOSTSPLAT Taylor Predictor & Predictive Analysis Panel */}
          <div className="bg-slate-900/95 border border-slate-800 rounded p-4 relative hover:border-slate-750 transition duration-200">
            <div className="absolute top-2.5 right-2 px-1 rounded border border-slate-830 bg-slate-950 font-mono text-[7.5px] text-slate-500 select-none">
              THERM_PRED
            </div>
            
            <div className="flex items-center gap-1.5 mb-2 select-none">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span className="text-[10.5px] font-bold text-slate-300 font-mono tracking-wider uppercase">PREDICTIVE THERMAL ALERT NETWORK</span>
            </div>

            {/* Predictive status banner depending on upcoming breaches */}
            <div className="mb-2.5 select-none">
              {predictiveAlerts?.isCritPredicted ? (
                <div className="bg-red-950/40 border border-red-900/60 p-1.5 rounded flex items-center gap-2 text-[8px] font-mono text-red-400 animate-pulse">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <div>
                    <strong>🚨 INTERLOCK TRIP INBOUND:</strong> Breach estimated at <strong>t+{predictiveAlerts.predictedCriticalBreachTick}</strong> ticks ({predictiveAlerts.predictedCriticalBreachTemp.toFixed(1)}K).
                  </div>
                </div>
              ) : predictiveAlerts?.isWarnPredicted ? (
                <div className="bg-amber-950/40 border border-amber-900/60 p-1.5 rounded flex items-center gap-2 text-[8px] font-mono text-amber-400">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <div>
                    <strong>⚠️ THERMAL WEAR INBOUND:</strong> Wear limit reached in <strong>t+{predictiveAlerts.predictedWarningBreachTick}</strong> ticks ({predictiveAlerts.predictedWarningBreachTemp.toFixed(1)}K).
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/30 border border-emerald-900/40 p-1.5 rounded flex items-center gap-1.5 text-[8.5px] font-mono text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>🟢 THERMAL REGULATION NOMINAL. No future safety interlock breaches flagged.</span>
                </div>
              )}
            </div>

            {/* Scientific explanation */}
            <p className="text-[9.5px] text-slate-400 mb-3 leading-normal font-mono">
              FPGA physical predictor. Fits extrapolation Taylor sequences in real-time to intercept thermal emergencies.
            </p>

            {/* Core Mini Sparkline Plotting */}
            <div className="mb-3">
              <span className="block text-[8px] font-mono text-slate-500 mb-1 select-none">10-TICK PREDICTIVE TRAJECTORY HORIZON:</span>
              {drawPredictiveSparkline()}
            </div>

            {/* Proactive safety recommendation actions */}
            <div className="pt-2 border-t border-slate-900 text-[8.5px] font-mono text-slate-500 select-none">
              {predictiveAlerts?.isCritPredicted ? (
                <p>
                  <strong className="text-red-400 animate-pulse">SAFETY SUGGESTION:</strong> Trigger <strong>ELECTRODE MATRIX SHEDDING</strong> immediately or lower bias current to under 1200A.
                </p>
              ) : predictiveAlerts?.isWarnPredicted ? (
                <p>
                  <strong className="text-amber-400">MONITOR WARNING:</strong> Ensure auxiliary cooling fans are active. Interlock safety line held standing by.
                </p>
              ) : (
                <p>
                  <strong>SYSTEM SUGGESTION:</strong> All thermodynamic profiles are secure. Maintain active 6.5kHz choke resonant driving vectors.
                </p>
              )}
            </div>
          </div>

          {/* HEXAGRAM STATE MACHINE CORE */}
          <motion.div 
            key={currentHexagram}
            initial={{ borderColor: "rgba(16, 185, 129, 0.3)" }}
            animate={{ 
              borderColor: [
                "rgba(16, 185, 129, 0.3)",
                "rgba(34, 197, 94, 0.8)",
                "rgba(16, 185, 129, 0.3)"
              ],
              scale: [1, 1.015, 1]
            }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="bg-slate-900/90 border-2 rounded p-4 relative shadow-lg hover:border-emerald-700 transition group bg-gradient-to-br from-slate-900 to-emerald-950/20"
          >
            <div className="absolute top-2 right-2 text-[9px] text-slate-500 border border-slate-800 px-1 py-0.2 font-mono">
              ADDR_0x03
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1 bg-emerald-950 border border-emerald-500/50 rounded">
                <Cpu className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              </div>
              <span className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">
                HEXAGRAM STATE machine
              </span>
            </div>
            
            <div className="space-y-2 mt-3 font-mono">
              <div className="flex justify-between items-center text-xs border-b border-slate-800/40 pb-1.5 h-7">
                <span className="text-slate-500 text-[10px]">CURRENT HEX:</span>
                <div className="overflow-hidden relative flex items-center">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={currentHexagram}
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="text-slate-200 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono font-bold text-[10px]"
                    >
                      {HexagramStateLabels[currentHexagram] || "UNKNOWN"}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-xs border-b border-slate-800/40 pb-1.5 h-7">
                <span className="text-slate-500 text-[10px]">YAO SIGNALS:</span>
                <div className="flex gap-0.5">
                  {formatYao(currentHexagram).split("").map((bit, idx) => (
                    <motion.span
                      key={`${idx}-${bit}`}
                      initial={{ rotateX: 90, opacity: 0.3 }}
                      animate={{ rotateX: 0, opacity: 1 }}
                      transition={{ duration: 0.25, delay: idx * 0.03 }}
                      className={`text-[9px] font-bold px-1 rounded font-mono border ${
                        bit === "1"
                          ? "text-emerald-400 bg-emerald-950/40 border-emerald-900/60"
                          : "text-slate-600 bg-slate-950/40 border-slate-900"
                      }`}
                    >
                      {bit}
                    </motion.span>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center text-xs h-6">
                <span className="text-slate-500 text-[10px]">SYS_MODE:</span>
                <div className="overflow-hidden relative flex items-center">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={sysMode}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.18 }}
                      className="text-cyan-400 font-bold text-[10px] uppercase"
                    >
                      {SysModeLabels[sysMode]}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>

          {/* AXI4-LITE register bus */}
          <div className="bg-slate-900/80 border border-slate-800 rounded p-3 relative hover:border-slate-700 transition">
            <div className="flex justify-between items-center font-mono text-[10px] mb-1.5">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500" />
                AXI4-LITE INTERCONNECT (PS ARM9)
              </span>
              <span className="text-amber-500 font-bold bg-amber-950/20 border border-amber-900 px-1 rounded text-[9px]">100MHz</span>
            </div>
            <div className="grid grid-cols-3 gap-1 grid-flow-row text-[9px] font-mono text-slate-400 text-center bg-slate-950 p-1.5 rounded border border-slate-800">
              <div className="px-1 py-0.5 bg-slate-900 rounded select-none">KNOCK_NONCE</div>
              <div className="px-1 py-0.5 bg-slate-900 rounded select-none">OVERRIDE_EN</div>
              <div className="px-1 py-0.5 bg-slate-900 rounded select-none">TICK_PERIOD</div>
            </div>
          </div>
        </div>

        {/* Output Command Waveguide Conduit (Processors -> Outputs) */}
        <WaveguideConduit Active={tickActive} Surge={transitionPulse} Color="#f59e0b" SurgeColor="#ef4444" />

        {/* Right: Driver Drivers & System Actuators */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-3 h-full">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1 px-1">OUTPUT DRIVERS</div>

          {/* 10-Channel Contactor Sequencer */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 hover:border-slate-700 transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-400 font-mono font-bold">10-CH CONTACTORS</span>
              <span className={`h-2 w-2 rounded-full ${electricalState !== ElectricalReg.ELEC_OFF ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[9px] text-slate-500">
                <span>Coil Power Status:</span>
                <span className={electricalState !== ElectricalReg.ELEC_OFF ? 'text-emerald-400' : 'text-slate-500'}>
                  {electricalState !== ElectricalReg.ELEC_OFF ? "ENERGIZED" : "DISABLED"}
                </span>
              </div>
              <div className="flex gap-0.5 justify-between">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 flex-1 rounded-sm border ${
                      electricalState === ElectricalReg.ELEC_OFF
                        ? "bg-slate-950 border-slate-800"
                        : electricalState === ElectricalReg.ELEC_SHED && (i === 1 || i === 2 || i === 5 || i === 6 || i === 9)
                        ? "bg-amber-950 border-amber-900 text-amber-500"
                        : "bg-emerald-950 border-emerald-800 text-emerald-400"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Choke Membrane Resonant Drive */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 hover:border-slate-700 transition">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 font-mono font-bold">CHOKE MEMBRANE</span>
              <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-900 px-1 rounded">6.5 kHz</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[9px] text-slate-500">
                <span>PWM Active:</span>
                <span className={currentHexagram !== HexagramState.IDLE && currentHexagram !== HexagramState.PURGE ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}>
                  {currentHexagram !== HexagramState.IDLE && currentHexagram !== HexagramState.PURGE ? "OSCILLATING" : "IDLE"}
                </span>
              </div>
              <div className="flex justify-between items-center p-1 bg-slate-950 rounded border border-slate-850">
                <span className="text-[9px] font-mono text-slate-500">H-BRIDGE PWM</span>
                <div className="flex items-center gap-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${currentHexagram !== HexagramState.IDLE ? 'bg-cyan-500 animate-ping' : 'bg-slate-700'}`} />
                  <span className="text-[9px] font-mono text-slate-400">LEG A/B</span>
                </div>
              </div>
            </div>
          </div>

          {/* SiC MOSFET Gate Arrays */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 hover:border-slate-700 transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-400 font-mono font-bold">SiC GATE ARRAYS</span>
              <span className="text-[9px] font-mono text-emerald-400 font-bold">DESAT_N: HIGH</span>
            </div>
            <p className="text-[9px] font-mono text-slate-500 leading-tight">
              5 segments × 19 parallel MOSFETs. Driving phase-coherent current vectors.
            </p>
          </div>

          {/* Physical Safety Interlocks Check */}
          <div className="bg-slate-900/90 border border-slate-800 rounded p-3 relative bg-gradient-to-r from-slate-900 to-slate-950">
            <div className={`p-1 rounded flex items-center gap-1.5 font-mono text-[10px] ${safetyOk ? 'bg-emerald-950/50 border border-emerald-900 text-emerald-400' : 'bg-red-950/50 border border-red-950 text-red-400'}`}>
              <ShieldAlert className="h-3.5 w-3.5 animate-pulse" />
              <span>SAFETY INTERLOCKS: {safetyOk ? "SECURED (OK)" : "TRIPPED"}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Schematic Diagnostic Signal Flow overlay lines */}
      <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-600 pointer-events-none uppercase">
        AXI-ADX-HIL HARDWARE CO-SIMULATOR PIPELINE ACTIVE
      </div>
    </div>
  );
}
