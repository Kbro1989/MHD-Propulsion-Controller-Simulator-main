/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from "react";
import { Thermometer, Zap, Activity, ShieldCheck, Check, AlertOctagon } from "lucide-react";
import { ContactorState, ContactorStateLabels, ChokeState, StateTransition, HexagramState } from "../types";
import BusCurrentChart from "./BusCurrentChart";
import LogicAnalyzer from "./LogicAnalyzer";
import PowerEfficiencyAnalyzer from "./PowerEfficiencyAnalyzer";
import ChokeAudioSpectralVisualizer from "./ChokeAudioSpectralVisualizer";
import ChokeSpectralVisualizer from "./ChokeSpectralVisualizer";

interface StateVisualizersProps {
  tempSensors: number[]; // 16 values in Kelvin
  contactorStates: ContactorState[]; // 10 contactor relays
  coilDrive: boolean[]; // 10 relays coil energize status
  precharge: boolean[]; // 10 relays precharge status
  auxFeedback: boolean[]; // 10 relays aux statuses
  chokeActive: boolean;
  chokeFreq: number; // Nominally around 6500 Hz
  symmetryOk: boolean;
  busCurrentHistory: number[];
  predictedTempHistory: number[];
  actualTempHistory: number[];
  contactorHistory: ContactorState[][];
  tickCounter: number;
  transitionHistory: StateTransition[];
  currentHexagram: HexagramState;
  predictiveAlerts?: {
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
  };
  powerMitigationMode?: "NONE" | "DEADTIME" | "SNUBBER" | "DAMPENING" | "PREDICTIVE";
  setPowerMitigationMode?: (mode: "NONE" | "DEADTIME" | "SNUBBER" | "DAMPENING" | "PREDICTIVE") => void;
}

export default function StateVisualizers({
  tempSensors,
  contactorStates,
  coilDrive,
  precharge,
  auxFeedback,
  chokeActive,
  chokeFreq,
  symmetryOk,
  busCurrentHistory,
  predictedTempHistory,
  actualTempHistory,
  contactorHistory,
  tickCounter,
  transitionHistory = [],
  currentHexagram,
  predictiveAlerts,
  powerMitigationMode = "NONE",
  setPowerMitigationMode,
}: StateVisualizersProps) {
  // FFT power spectral density simulation for mechanical harmonic analytics
  const fftData = useMemo(() => {
    return Array.from({ length: 28 }).map((_, i) => {
      const freqKhz = i * 0.75; // spectrum scale from 0 to 21 kHz
      let amp = chokeActive ? (Math.sin((tickCounter * 0.25) + i * 0.8) * 1.5 + 4) : (Math.random() * 1.5 + 1); // background noise in dB

      if (chokeActive) {
        // Core Resonant Peak around chokeFreq (~6.5 kHz)
        const distToCenter = Math.abs(freqKhz - (chokeFreq / 1000));
        if (distToCenter < 1.8) {
          amp += Math.max(0, (1.8 - distToCenter) * 32);
        }
        
        // 2nd harmonic around 13.0 kHz
        const distToSec = Math.abs(freqKhz - ((chokeFreq * 2) / 1000));
        if (distToSec < 1.8) {
          amp += Math.max(0, (1.8 - distToSec) * 10);
        }

        // 3rd harmonic around 19.5 kHz
        const distToThird = Math.abs(freqKhz - ((chokeFreq * 3) / 1000));
        if (distToThird < 1.8) {
          amp += Math.max(0, (1.8 - distToThird) * 4);
        }

        // Simulated periodic mechanical harmonic instability (rattling) on certain HIL patterns
        // Instability manifests every 32 metabolic cycles, between ticks 22 and 31
        const isInstabilityPeriod = (tickCounter % 32) >= 22;
        if (isInstabilityPeriod) {
          // Sub-harmonic peak rises at approx 4.5 kHz
          const distToInstability = Math.abs(freqKhz - 4.5);
          if (distToInstability < 1.2) {
            amp += Math.max(0, (1.2 - distToInstability) * (20 + Math.sin(Date.now() / 120) * 5));
          }
          // Chaos lift on noise floor
          amp += Math.random() * 4 + 1.5;
        }
      }

      return {
        freqKhz,
        amp: Math.max(2, Math.min(58, amp)),
      };
    });
  }, [chokeActive, chokeFreq, tickCounter]);

  // Setup wave offset hook to drive custom SVG wave oscillation
  const [wavePhase, setWavePhase] = useState(0);

  useEffect(() => {
    if (!chokeActive) return;
    let animId: number;
    const animate = () => {
      setWavePhase((prev) => (prev + 0.15) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [chokeActive]);

  // Heatmap color generator
  const getHeatmapColor = (kelvin: number): string => {
    // Range 280 Kelvin to 330 Kelvin
    // Nominal is 300K, Max is 320K
    const ratio = Math.max(0, Math.min(1, (kelvin - 280) / 45));
    if (kelvin > 320) {
      return "rgba(239, 68, 68, 0.25)"; // glowing red
    }
    if (kelvin > 310) {
      return `rgba(245, 158, 11, ${0.1 + ratio * 0.45})`; // amber
    }
    return `rgba(16, 185, 129, ${0.1 + ratio * 0.35})`; // green
  };

  const getHeatmapBorderColor = (kelvin: number): string => {
    if (kelvin > 320) return "border-red-500 text-red-400";
    if (kelvin > 310) return "border-amber-700/60 text-amber-400";
    return "border-slate-800 text-emerald-400";
  };

  // Generate SVG dynamic sine path for Choke Driver
  const makeWavePath = () => {
    const points: string[] = [];
    const width = 360;
    const height = 64;
    const amplitude = chokeActive ? 22 : 2.5;
    const frequencyMultiplier = chokeActive ? 0.045 : 0.012;

    for (let x = 0; x <= width; x += 3) {
      const y = height / 2 + Math.sin(x * frequencyMultiplier + wavePhase) * amplitude;
      points.push(`${x},${y}`);
    }
    return `M ${points.join(" L ")}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="state-visualizers-group">
      
      {/* 1. Electrode Temperature Heatmap Grid (Col span: 4) */}
      <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-850 mb-3.5 select-none">
            <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wide">
              <Thermometer className="h-4 w-4 text-orange-400" />
              16-CH ELECTRODE HEATMAP
            </span>
            <span className="text-[8px] font-mono font-semibold bg-orange-950 text-orange-400 border border-orange-900 px-1 rounded">
              KELVIN (K)
            </span>
          </div>

          {/* Interactive responsive 4x4 Grid */}
          <div className="grid grid-cols-4 gap-2">
            {tempSensors.map((k, i) => (
              <div
                key={i}
                style={{ backgroundColor: getHeatmapColor(k) }}
                className={`border rounded p-2 text-center font-mono hover:scale-105 transition duration-150 ${getHeatmapBorderColor(k)}`}
                title={`Channel ${i}: ${k.toFixed(1)} K`}
              >
                <div className="text-[7px] text-slate-500 font-bold block mb-0.5">CH{String(i).padStart(2, "0")}</div>
                <div className="text-[10px] font-bold tracking-tight">
                  {k.toFixed(0)}<span className="text-[8px] font-normal font-sans">K</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend of limit */}
        <div className="mt-4 p-2.5 bg-slate-900/40 border border-slate-850 rounded font-mono text-[9px] text-slate-500 leading-normal select-none">
          <div className="flex justify-between font-bold text-slate-400 mb-1">
            <span>THERMAL PROFILE SHUTOFF TRIGGER</span>
            <span className="text-red-500">320.0 K</span>
          </div>
          Sensor acquisition scans ADCs continuously to maintain full-coverage telemetry.
        </div>
      </div>

      {/* 2. 10-Channel Contactor Status Deck (Col span: 4) */}
      <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-850 mb-3.5 select-none">
            <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wide">
              <Zap className="h-4 w-4 text-emerald-400 animate-pulse" />
              10-CHANNEL RELAY MATRIX (CT_0..9)
            </span>
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
              symmetryOk 
                ? "bg-emerald-950 text-emerald-400 border-emerald-900" 
                : "bg-red-950 text-red-400 border-red-900 animate-pulse"
            }`}>
              {symmetryOk ? "Symmetry: SECURED" : "Symmetry: CRITICAL"}
            </span>
          </div>

          {/* Relays detailed layout list */}
          <div className="grid grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-1">
            {contactorStates.map((state, i) => {
              // Detailed visual states for beautiful gradient transitions
              let cardStyle = "border-slate-850 bg-slate-900 text-slate-500";
              let badgeStyle = "bg-slate-950 border border-slate-855 text-slate-500";
              let bulbStyle = "bg-slate-950 border-slate-800";

              if (state === ContactorState.CT_CLOSED) {
                cardStyle = "border-emerald-900/80 bg-emerald-950/15 text-emerald-300 shadow-[inset_0_0_8px_rgba(16,185,129,0.03)]";
                badgeStyle = "bg-emerald-950/80 border border-emerald-800/60 text-emerald-300";
                bulbStyle = "bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.55)]";
              } else if (state === ContactorState.CT_CLOSING) {
                cardStyle = "border-amber-600/70 bg-gradient-to-r from-slate-900 via-amber-955/20 to-slate-900 text-amber-300 animate-pulse";
                badgeStyle = "bg-amber-950/80 border border-amber-800/60 text-amber-300";
                bulbStyle = "bg-amber-400 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.55)]";
              } else if (state === ContactorState.CT_OPENING) {
                cardStyle = "border-cyan-600/70 bg-gradient-to-r from-slate-900 via-cyan-955/20 to-slate-900 text-cyan-305 animate-pulse";
                badgeStyle = "bg-cyan-950/80 border border-cyan-800/60 text-cyan-300";
                bulbStyle = "bg-cyan-400 border-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.55)]";
              } else if (state === ContactorState.CT_FAULT) {
                cardStyle = "border-red-950 bg-red-950/10 text-red-400";
                badgeStyle = "bg-red-950 border border-red-900 text-red-400";
                bulbStyle = "bg-red-500 border-red-400 animate-ping";
              }

              return (
                <div
                  key={i}
                  className={`border rounded p-2 font-mono text-[9px] relative flex justify-between items-center transition-all duration-700 ease-in-out ${cardStyle}`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-[9px] text-slate-400">CH_{i}</span>
                      <span className={`inline-block px-1 rounded-sm text-[7px] font-bold transition-all duration-700 ease-in-out ${badgeStyle}`}>
                        {ContactorStateLabels[state]}
                      </span>
                    </div>
                    {/* Core diagnostic signals */}
                    <div className="text-[8px] text-slate-500 flex gap-1.5">
                      <span>Coil:{coilDrive[i] ? "1" : "0"}</span>
                      <span>Snb:{precharge[i] ? "1" : "0"}</span>
                      <span>Aux:{auxFeedback[i] ? "1" : "0"}</span>
                    </div>
                  </div>
                  {/* Status active bulb */}
                  <div className="flex items-center justify-center">
                    <span className={`h-2.5 w-2.5 rounded-full border transition-all duration-700 ease-in-out ${bulbStyle}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkerboard status summaries */}
        <div className="mt-3.5 flex justify-between items-center bg-slate-900/60 p-2 border border-slate-850 rounded font-mono text-[9px] select-none">
          <span className="text-slate-500">RELAY HARMONIC SYMMETRY STATUS</span>
          <span className={`font-bold flex items-center gap-0.5 ${symmetryOk ? 'text-emerald-400' : 'text-red-400'}`}>
            {symmetryOk ? (
              <>
                <Check className="h-3 w-3" /> CT_PAIR_COMPLIANT
              </>
            ) : (
              <>
                <AlertOctagon className="h-3 w-3" /> SYMMETRY_EXCEPTION_TRIGGERED
              </>
            )}
          </span>
        </div>
      </div>

      {/* 3. Choke Driver Resonant Drive (Col span: 4) */}
      <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-850 mb-3 select-none">
            <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wide">
              <Activity className="h-4 w-4 text-cyan-400" />
              CHOKE DRIVE ANALYZER
            </span>
            <span className={`text-[8px] font-mono px-1.5 rounded border ${
              chokeActive 
                ? "bg-cyan-950 text-cyan-400 border-cyan-900 animate-pulse" 
                : "bg-slate-900 text-slate-500 border-slate-850"
            }`}>
              {chokeActive ? "OSC: ACTV" : "OSC: FLAT"}
            </span>
          </div>

          <p className="text-[10px] font-mono text-slate-500 leading-normal mb-3 leading-relaxed">
            H-Bridge resonant transducer feed. Monitors 6.5kHz target resonance time waveform and real-time spectrum bins.
          </p>

          {/* Time-Domain Sine Wave Segment */}
          <div className="mb-3.5">
            <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 mb-1 select-none">
              <span>TIME-DOMAIN COAX SEGMENT</span>
              <span className="text-cyan-400">1.0X OSCILLOSCOPE</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-850/60 rounded flex items-center justify-center relative overflow-hidden h-14 select-none">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.04),transparent_80%)] pointer-events-none" />
              <svg className="w-full h-full" viewBox="0 0 360 56" preserveAspectRatio="none">
                {/* Center Line reference */}
                <line x1="0" y1="28" x2="360" y2="28" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
                
                {/* Oscillating Sine Wave */}
                <path
                  d={makeWavePath()}
                  fill="none"
                  stroke={chokeActive ? "#06b6d4" : "rgba(100,116,139,0.3)"}
                  strokeWidth={chokeActive ? 1.8 : 1.2}
                  className="transition-all duration-100"
                />
              </svg>
            </div>
          </div>

          {/* Frequency-Domain Fast Fourier Transform (FFT) Spectrum */}
          <div>
            <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 mb-1 select-none">
              <span>FAST FOURIER TRANSFORM (FFT) BINS</span>
              <span className={(chokeActive && (tickCounter % 32) >= 22) ? "text-red-400 animate-pulse font-bold" : "text-emerald-500 font-bold"}>
                {(chokeActive && (tickCounter % 32) >= 22) ? "⚠️ INSTABILITY" : "🟢 COHERENT"}
              </span>
            </div>
            <div className="bg-slate-900 border border-slate-850 p-1.5 flex flex-col justify-between relative overflow-hidden h-24 select-none">
              <div className="absolute inset-0 bg-grid-slate-850/10 [mask-image:linear-gradient(0deg,white,transparent)] pointer-events-none" />
              
              {/* FFT Bars chart */}
              <div className="flex items-end justify-between h-16 w-full px-1 border-b border-slate-800 gap-[1px]">
                {fftData.map((d, i) => {
                  const isPeak = d.freqKhz >= 5.5 && d.freqKhz <= 7.5;
                  const isInstabilityWobble = d.freqKhz >= 3.8 && d.freqKhz <= 5.2 && (tickCounter % 32) >= 22;
                  
                  let barColor = "bg-slate-700/60";
                  if (chokeActive) {
                    if (isInstabilityWobble) {
                      barColor = "bg-red-500 animate-[pulse_0.15s_infinite]";
                    } else if (isPeak) {
                      barColor = "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]";
                    } else if (d.amp > 15) {
                      barColor = "bg-cyan-600/70";
                    } else {
                      barColor = "bg-slate-600/50";
                    }
                  }

                  return (
                    <div
                      key={i}
                      style={{ height: `${(d.amp / 58) * 100}%` }}
                      className={`w-full ${barColor} rounded-t-[1px] transition-all duration-150`}
                      title={`${d.freqKhz.toFixed(2)} kHz: ${d.amp.toFixed(1)} dB`}
                    />
                  );
                })}
              </div>

              {/* Spectrum Scale Labels */}
              <div className="flex justify-between text-[6.5px] font-mono text-slate-500 pt-1 select-none">
                <span>0.0 kHz</span>
                <span>5.0 kHz</span>
                <span className="text-cyan-400 font-bold">Lock (~6.5k)</span>
                <span>15.0 kHz</span>
                <span>20.0 kHz</span>
              </div>
            </div>

            {/* Warning alert overlay if instable */}
            {chokeActive && (tickCounter % 32) >= 22 && (
              <div className="mt-1.5 p-1 px-1.5 border border-red-950 bg-red-950/25 rounded font-mono text-[7px] text-red-400 leading-tight animate-pulse">
                ⚠️ <strong>SUB-HARMONIC WHINE:</strong> Unstable resonance spike at ~4.5 kHz. Perform system dampening decay or lower driver voltage bias.
              </div>
            )}

            {/* Real-time Drift Warning if > 5% */}
            {chokeActive && predictiveAlerts?.chokeFreqDriftPercent && predictiveAlerts.chokeFreqDriftPercent > 5.0 && (
              <div className="mt-1.5 p-1 px-1.5 border border-amber-900 bg-amber-955/20 rounded font-mono text-[7px] text-amber-400 leading-tight">
                ⚠️ <strong>CHOKE RESONANCE DRIFT EXCEEDED:</strong> Current drift is <strong>{predictiveAlerts.chokeFreqDriftPercent.toFixed(2)}%</strong> (Nominal: {predictiveAlerts.chokeFreqNominal?.toFixed(1)} Hz, Actual: {chokeFreq.toFixed(1)} Hz). Coupled subsea coil properties degraded!
              </div>
            )}

            {/* Predictive Drift Warning */}
            {chokeActive && predictiveAlerts?.isChokePredictiveDriftWarning && (
              <div className="mt-1.5 p-1.5 border border-rose-950 bg-rose-950/30 rounded font-mono text-[7px] text-rose-300 leading-tight animate-pulse">
                🚨 <strong>PREDICTIVE CHOKE DRIFT:</strong> Model estimates resonance drift will exceed 5% limit in <strong>t+{predictiveAlerts.predictedChokeDriftTick}</strong> ticks (Projected drift: {predictiveAlerts.predictedChokeDriftFreq?.toFixed(1)} Hz). Mitigation interlock scheduled.
              </div>
            )}

            {/* Custom Web Audio API Oscilloscope Waveform */}
            <div className="mt-4 space-y-4">
              <ChokeAudioSpectralVisualizer chokeActive={chokeActive} chokeFreq={chokeFreq} currentHexagram={currentHexagram} />
              <ChokeSpectralVisualizer chokeActive={chokeActive} chokeFreq={chokeFreq} />
            </div>
          </div>
        </div>

        {/* Dynamic tracker status metadata */}
        <div className="font-mono text-[9px] text-slate-500 flex flex-col sm:flex-row justify-between pt-2.5 mt-3 border-t border-slate-900/60 select-none gap-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span>TRACK_FREQ: <strong className={chokeActive ? "text-cyan-400" : "text-slate-400"}>{chokeActive ? `${chokeFreq.toFixed(1)} Hz` : "0.0 Hz"}</strong></span>
            <span>DRIFT: <strong className={chokeActive ? (predictiveAlerts?.chokeFreqDriftPercent && predictiveAlerts.chokeFreqDriftPercent > 5.0 ? "text-amber-450 font-bold animate-pulse" : "text-emerald-400") : "text-slate-500"}>
              {chokeActive ? `${predictiveAlerts?.chokeFreqDriftPercent?.toFixed(2)}%` : "0.00%"}
            </strong></span>
          </div>
          <span>LOCK: <strong className={chokeActive ? (predictiveAlerts?.chokeFreqDriftPercent && predictiveAlerts.chokeFreqDriftPercent > 5.0 ? "text-amber-550 font-bold" : "text-emerald-400") : "text-amber-550"}>
            {chokeActive ? (predictiveAlerts?.chokeFreqDriftPercent && predictiveAlerts.chokeFreqDriftPercent > 5.0 ? "DRIFT_WARN" : "LOCKED") : "STBY"}
          </strong></span>
        </div>
      </div>

      {/* Bottom Area: Real-Time D3 Chart, Timing Logic Analyzer, and Power Efficiency Correlator */}
      <div className="lg:col-span-12 grid grid-cols-1 xl:grid-cols-3 gap-5 mt-1">
        <BusCurrentChart busCurrentHistory={busCurrentHistory} predictedTempHistory={predictedTempHistory} actualTempHistory={actualTempHistory} tickCounter={tickCounter} />
        <LogicAnalyzer contactorHistory={contactorHistory} tickCounter={tickCounter} symmetryOk={symmetryOk} />
        <PowerEfficiencyAnalyzer 
          transitionHistory={transitionHistory} 
          busCurrentHistory={busCurrentHistory} 
          currentHexagram={currentHexagram} 
          tickCounter={tickCounter} 
          powerMitigationMode={powerMitigationMode}
          setPowerMitigationMode={setPowerMitigationMode}
        />
      </div>

    </div>
  );
}
