/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Zap, Activity, CheckCircle, AlertTriangle, Play, Flame, Sliders } from "lucide-react";
import * as d3 from "d3";
import { HexagramState, HexagramStateLabels, StateTransition } from "../types";

interface PowerEfficiencyAnalyzerProps {
  transitionHistory: StateTransition[];
  busCurrentHistory: number[];
  currentHexagram: HexagramState;
  tickCounter: number;
  powerMitigationMode?: "NONE" | "DEADTIME" | "SNUBBER" | "DAMPENING" | "PREDICTIVE";
  setPowerMitigationMode?: (mode: "NONE" | "DEADTIME" | "SNUBBER" | "DAMPENING" | "PREDICTIVE") => void;
}

export default function PowerEfficiencyAnalyzer({
  transitionHistory = [],
  busCurrentHistory = [],
  currentHexagram,
  tickCounter,
  powerMitigationMode = "NONE",
  setPowerMitigationMode,
}: PowerEfficiencyAnalyzerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 350, height: 160 });

  // Handle responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 240),
          height: 140,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const latestCurrent = busCurrentHistory[busCurrentHistory.length - 1] ?? 1880.0;

  // 1. Calculate live switching efficiency score
  const liveEfficiencyScore = useMemo(() => {
    if (latestCurrent <= 1880.0) return 100;
    const excess = latestCurrent - 1880.0;
    const score = 100 - (excess * 0.23);
    return Math.max(15, Math.min(100, Math.round(score)));
  }, [latestCurrent]);

  // 2. Map full historical currents (up to 50 items) to calculated efficiency percentage array for the D3 plotter
  const displayLimit = 50;
  const efficiencyHistoryData = useMemo(() => {
    const dataset = busCurrentHistory.slice(-displayLimit);
    const paddedDataset: number[] = [];
    if (dataset.length < displayLimit) {
      const missingCount = displayLimit - dataset.length;
      for (let i = 0; i < missingCount; i++) {
        paddedDataset.push(1880.0); // nominal current baseline
      }
    }
    paddedDataset.push(...dataset);

    // Convert currents to efficiency percentages
    return paddedDataset.map((current) => {
      if (current <= 1880.0) return 100;
      const excess = current - 1880.0;
      const score = 100 - (excess * 0.23);
      return Math.max(15, Math.min(100, Math.round(score)));
    });
  }, [busCurrentHistory]);

  // 3. Correlate transition ticks to specific points in our 50-tick timeline
  const correlatedTransitionsInView = useMemo(() => {
    const list: Array<{ xIndex: number; tick: number; info: StateTransition; effValue: number }> = [];
    
    // For each position i in our 50-element history (where index 49 is the current tickCounter)
    for (let i = 0; i < displayLimit; i++) {
      const targetTick = tickCounter - (displayLimit - 1 - i);
      // Find a transition that happened on this tick
      const transitionAtTick = transitionHistory.find((t) => t.tick === targetTick);
      if (transitionAtTick) {
        list.push({
          xIndex: i,
          tick: targetTick,
          info: transitionAtTick,
          effValue: efficiencyHistoryData[i],
        });
      }
    }
    return list;
  }, [transitionHistory, tickCounter, efficiencyHistoryData]);

  // 4. Correlate general list of 5 recent events with details
  const correlatedDips = useMemo(() => {
    return transitionHistory.map((t) => {
      const snapCurrent = t.snapshot.current;
      const deviation = snapCurrent - 1880.0;
      
      let dipScore = 100;
      if (deviation > 0) {
        dipScore = 100 - (deviation * 0.23);
      }
      dipScore = Math.max(15, Math.min(100, Math.round(dipScore)));

      let status: "OPTIMAL" | "MINOR_DIP" | "CRITICAL_DIP" = "OPTIMAL";
      if (dipScore < 78) {
        status = "CRITICAL_DIP";
      } else if (dipScore < 92) {
        status = "MINOR_DIP";
      }

      let dynamicInsight = "";
      if (t.toState === HexagramState.LIMP_MODE) {
        dynamicInsight = "Emergency fallback triggered. Transients dropped to baseline safely.";
      } else if (t.toState === HexagramState.ST_CRIT || t.toState === HexagramState.TR_CRIT) {
        dynamicInsight = "High resonant oscillation spiked induction leakage at active nodes.";
      } else if (t.toState === HexagramState.TRANSIT) {
        dynamicInsight = "Contactor bounce & LC overlap generated transient overcurrent loss.";
      } else if (t.toState === HexagramState.STEALTH) {
        dynamicInsight = "Tuning gate drive altered pulse deadtime to suppress active harmonics.";
      } else {
        dynamicInsight = "Normal system transition. Core power routing stable.";
      }

      return {
        ...t,
        dipScore,
        deviation,
        status,
        insight: dynamicInsight,
      };
    }).slice(0, 4);
  }, [transitionHistory]);

  const recommendation = useMemo(() => {
    if (powerMitigationMode === "PREDICTIVE") {
      return {
        text: "🎯 LUNA Predictive Pre-Transition scheme active. Stator induction pre-conditioned 10ms before trajectory change.",
        severity: "optimal",
        details: "Full transient spike suppression. Inductive kickback eliminated. Core efficiency sustained at 100%."
      };
    } else if (powerMitigationMode === "DAMPENING") {
      return {
        text: "⚡ Gate Drive Active Dampening active. High-frequency resonant switching suppressed (6-8 kHz).",
        severity: "optimal",
        details: "Overshoot dampened to 20A peak. Transition efficiency maintained above nominal at 95%."
      };
    } else if (powerMitigationMode === "SNUBBER") {
      return {
        text: "🛡️ LC Snubber Network recalibrated (R=2.5Ω, C=47nF). RC decay suppression active.",
        severity: "optimal",
        details: "Decay rates accelerated. Overshoot limited to 28A peak with 94% transient efficiency."
      };
    } else if (powerMitigationMode === "DEADTIME") {
      return {
        text: "⏱️ Contactor deadtime tuned to 12ms (was 8ms). Nominal magnetic energy decay enabled.",
        severity: "optimal",
        details: "Kickback reduced. Moderate overshoot peak of 44A with transient efficiency stable at 90%."
      };
    } else {
      // NONE mode
      if (liveEfficiencyScore >= 92) {
        return {
          text: "System is in a high-conductance, low-impedance state. Dynamic harmonics aligned.",
          severity: "optimal",
          details: "No active overshoot. Resonance loop locked successfully at 6520 Hz. Ready for transient shift."
        };
      } else if (liveEfficiencyScore >= 78) {
        return {
          text: "Minor transient leakage registered near switching nodes during trajectory shifts.",
          severity: "warning",
          details: "Suggest tuning contactor deadtime values to 12ms to suppress inductive kickback."
        };
      } else {
        return {
          text: "⚠️ Severe power efficiency dip! Overcurrent peak (1995A vs 1880A) in SiC switching bridge.",
          severity: "danger",
          details: "Indentified LC inductive kickback mismatch. Tune switching registers to 12ms or engage Predictive Pre-Transition."
        };
      }
    }
  }, [liveEfficiencyScore, powerMitigationMode]);

  // Render D3 SVG parameters
  const { width, height } = dimensions;
  const paddingLeft = 32;
  const paddingRight = 15;
  const paddingTop = 12;
  const paddingBottom = 18;

  const xScale = d3
    .scaleLinear()
    .domain([0, displayLimit - 1])
    .range([paddingLeft, width - paddingRight]);

  const yScale = d3
    .scaleLinear()
    .domain([0, 105]) // 0% to 100% (plus breathing room)
    .range([height - paddingBottom, paddingTop]);

  const lineGenerator = d3
    .line<number>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d))
    .curve(d3.curveMonotoneX);

  const areaGenerator = d3
    .area<number>()
    .x((_, i) => xScale(i))
    .y0(height - paddingBottom)
    .y1((d) => yScale(d))
    .curve(d3.curveMonotoneX);

  const areaPath = areaGenerator(efficiencyHistoryData) || "";
  const linePath = lineGenerator(efficiencyHistoryData) || "";

  const ticksY = [0, 25, 50, 75, 100];

  return (
    <div
      ref={containerRef}
      className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between"
      id="power-efficiency-correlator-card"
    >
      <div>
        {/* Card Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-850 mb-2 select-none">
          <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wide">
            <Zap className="h-4 w-4 text-amber-400" />
            VHDL POWER EFFICIENCY CORRELATOR
          </span>
          <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 ${
            liveEfficiencyScore >= 92 
              ? "bg-emerald-950/30 text-emerald-400 border-emerald-900" 
              : liveEfficiencyScore >= 78
              ? "bg-amber-950/20 text-amber-400 border-amber-900/60"
              : "bg-red-955/20 text-red-400 border-red-900/60 animate-pulse"
          }`}>
            EFF_INDEX: {liveEfficiencyScore}%
          </span>
        </div>

        <p className="text-[9.5px] font-mono text-slate-550 leading-normal mb-3 leading-relaxed">
          Correlates transient bus current peaks with state changes. Highlight markers represent live transition events overlaying switching efficiency.
        </p>

        {/* D3 Real-Time Efficiency Line Chart */}
        <div className="relative bg-slate-900/40 rounded border border-slate-850 p-1 mb-3.5 select-none overflow-hidden">
          <svg className="w-full overflow-visible" height={height}>
            <defs>
              <linearGradient id="eff-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.15" />
                <stop offset="50%" stopColor="#10b981" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {ticksY.map((tick) => (
              <line
                key={tick}
                x1={paddingLeft}
                y1={yScale(tick)}
                x2={width - paddingRight}
                y2={yScale(tick)}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
              />
            ))}

            {/* Baseline efficiency threshold indicator at 85% */}
            <line
              x1={paddingLeft}
              y1={yScale(85)}
              x2={width - paddingRight}
              y2={yScale(85)}
              stroke="rgba(239, 68, 68, 0.4)"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />
            <text
              x={width - paddingRight - 90}
              y={yScale(85) - 3}
              fill="#ef4444"
              fillOpacity="0.6"
              className="font-mono text-[6.5px] font-bold"
            >
              BASELINE LIMIT (85% EFF)
            </text>

            {/* Render Area Path */}
            {areaPath && efficiencyHistoryData.length > 0 && <path d={areaPath} fill="url(#eff-area-gradient)" />}

            {/* Render Line Path */}
            {linePath && efficiencyHistoryData.length > 0 && (
              <path
                d={linePath}
                fill="none"
                stroke={liveEfficiencyScore >= 85 ? "#10b981" : "#ef4444"}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Y Axis ticks */}
            {ticksY.map((tick) => (
              <text
                key={tick}
                x={paddingLeft - 5}
                y={yScale(tick) + 2.5}
                fill="rgba(255,255,255,0.3)"
                className="font-mono text-[7px]"
                textAnchor="end"
              >
                {tick}%
              </text>
            ))}

            {/* Overlay Transition Event Marker Vertical Lines and Interlocks */}
            {correlatedTransitionsInView.map((evt, idx) => {
              const xPos = xScale(evt.xIndex);
              const yPos = yScale(evt.effValue);
              const targetShortName = HexagramStateLabels[evt.info.toState]?.split(" ")[0] || "SW";
              
              return (
                <g key={evt.tick + "-" + idx}>
                  {/* Vertical dashed marker */}
                  <line
                    x1={xPos}
                    y1={paddingTop}
                    x2={xPos}
                    y2={height - paddingBottom}
                    stroke="#ef4444"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    strokeOpacity="0.75"
                  />
                  {/* Glowing warning dot at efficiency intersection */}
                  <circle
                    cx={xPos}
                    cy={yPos}
                    r={3.5}
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="1"
                    className="animate-pulse"
                  />
                  {/* Label tag above dot */}
                  <text
                    x={xPos}
                    y={Math.max(paddingTop + 5, yPos - 8)}
                    fill="#fca5a5"
                    className="font-mono text-[6px] font-bold"
                    textAnchor="middle"
                  >
                    ⚡ {targetShortName}
                  </text>
                </g>
              );
            })}

            {/* Horizontal Axis bottom line */}
            <line
              x1={paddingLeft}
              y1={height - paddingBottom}
              x2={width - paddingRight}
              y2={height - paddingBottom}
              stroke="rgba(255,255,255,0.08)"
            />
          </svg>
        </div>

        {/* Transition list */}
        <div className="space-y-1.5">
          <span className="text-[7.5px] font-bold text-slate-500 font-mono block tracking-wider uppercase">CORRELATED EVENTS LIST</span>
          {correlatedDips.length === 0 ? (
            <div className="text-center py-4 bg-slate-900/10 border border-dashed border-slate-850 rounded font-mono text-[8px] text-slate-500">
              NO TRANSITIONS DETECTED YET. STANDBY ON PLC COMMANDS...
            </div>
          ) : (
            <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1">
              {correlatedDips.map((t) => (
                <div key={t.id} className="bg-slate-900/60 rounded border border-slate-850 p-1.5 flex flex-col gap-0.5 font-mono text-[7.5px] leading-relaxed">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-350 font-bold flex items-center gap-1">
                      <Play className="h-1.5 w-1.5 text-indigo-400" />
                      TICK #{t.tick} | {HexagramStateLabels[t.fromState]?.split(" (")[0]} → {HexagramStateLabels[t.toState]?.split(" (")[0]}
                    </span>
                    <span className={`px-1 rounded text-[7px] font-bold ${
                      t.dipScore >= 92 ? "text-emerald-400 bg-emerald-950/20 border-emerald-900" :
                      t.dipScore >= 78 ? "text-amber-400 bg-amber-950/15 border-amber-900/60" :
                      "text-red-400 bg-red-950/20 border-red-900/60 animate-pulse"
                    } border`}>
                      EFF: {t.dipScore}%
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[7px]">
                    <span>CURRENT SW LOAD: <strong className="text-slate-400">{t.snapshot.current}A</strong></span>
                    <span>SURGE DEV: <strong className={t.deviation > 0 ? "text-amber-400" : "text-emerald-400"}>+{t.deviation.toFixed(0)}A</strong></span>
                  </div>
                  <p className="text-slate-450 italic leading-snug border-l border-indigo-900/40 pl-1.5 mt-0.5">
                    {t.insight}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VHDL Switcher controls selector */}
      <div className="mt-3 p-2 bg-slate-900/50 rounded border border-slate-800" id="vhdl-switcher-controls-wrapper">
        <span className="text-[7.5px] font-bold text-slate-400 font-mono block tracking-wider uppercase mb-1.5 flex items-center gap-1 select-none">
          <Sliders className="h-2 w-2 text-indigo-400 animate-pulse" />
          VHDL State Transition Optimization Scheme
        </span>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-1 font-mono text-[7px]" id="power-scheme-controls">
          {[
            { id: "NONE", label: "NONE (Unmitigated)", color: "text-red-400 border-red-950/60 bg-red-950/5 hover:bg-red-950/15" },
            { id: "DEADTIME", label: "12ms Deadtime", color: "text-amber-400 border-amber-950/60 bg-amber-950/5 hover:bg-amber-950/15" },
            { id: "SNUBBER", label: "Snubber Recal", color: "text-cyan-400 border-cyan-950/60 bg-cyan-950/5 hover:bg-cyan-950/15" },
            { id: "DAMPENING", label: "Gate Drive Damp", color: "text-indigo-300 border-indigo-950/60 bg-indigo-950/5 hover:bg-indigo-950/15" },
            { id: "PREDICTIVE", label: "Predictive Intercept", color: "text-emerald-400 border-emerald-950/60 bg-emerald-950/5 hover:bg-emerald-950/15" }
          ].map((sch) => {
            const isSelected = powerMitigationMode === sch.id;
            return (
              <button
                key={sch.id}
                onClick={() => setPowerMitigationMode?.(sch.id as any)}
                className={`py-1 px-0.5 rounded border text-[7px] text-center font-bold tracking-tight transition-all duration-150 cursor-pointer ${
                  isSelected 
                    ? sch.id === "NONE" ? "text-red-300 bg-red-900/40 border-red-500 shadow-sm"
                      : sch.id === "DEADTIME" ? "text-amber-300 bg-amber-900/40 border-amber-500 shadow-sm"
                      : sch.id === "SNUBBER" ? "text-cyan-300 bg-cyan-900/40 border-cyan-500 shadow-sm"
                      : sch.id === "DAMPENING" ? "text-indigo-100 bg-indigo-900/40 border-indigo-400 shadow-sm"
                      : "text-emerald-300 bg-emerald-900/40 border-emerald-500 shadow-sm"
                    : sch.color
                }`}
              >
                {sch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recommendations engine band */}
      <div className={`mt-3 p-2 rounded border font-mono text-[7.5px] ${
        recommendation.severity === "optimal"
          ? "bg-emerald-950/20 border-emerald-950/50 text-emerald-400"
          : recommendation.severity === "warning"
          ? "bg-amber-955/15 border-amber-950/50 text-amber-400"
          : "bg-red-955/25 border-red-900/50 text-red-400"
      }`}>
        <div className="flex items-center gap-1 font-bold uppercase select-none mb-0.5">
          {recommendation.severity === "optimal" ? (
            <CheckCircle className="h-3 w-3 text-emerald-400" />
          ) : (
            <AlertTriangle className={`h-3 w-3 ${recommendation.severity === "warning" ? "text-amber-400" : "text-red-400 animate-pulse"}`} />
          )}
          <span>PLC POWER RECOMMENDATION:</span>
        </div>
        <p className="font-semibold text-[8px] leading-snug">{recommendation.text}</p>
        <p className="text-slate-400 leading-snug mt-1 italic">{recommendation.details}</p>
      </div>
    </div>
  );
}
