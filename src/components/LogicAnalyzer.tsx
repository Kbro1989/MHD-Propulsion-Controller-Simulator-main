/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Activity, Radio, AlertTriangle } from "lucide-react";
import { ContactorState, ContactorStateLabels } from "../types";

interface LogicAnalyzerProps {
  contactorHistory: ContactorState[][];
  tickCounter: number;
  symmetryOk: boolean;
}

export default function LogicAnalyzer({
  contactorHistory,
  tickCounter,
  symmetryOk,
}: LogicAnalyzerProps) {
  // If no history yet, fill with nominal idle state
  const historyLimit = 40; // Number of ticks to show in the analyzer
  const channelsCount = 10;

  // We want to slice the history to show the last limit of items
  const displayHistory = contactorHistory.slice(-historyLimit);
  
  // Fill empty historical frames if simulation just started so we always have a steady grid
  const paddedHistory: ContactorState[][] = [];
  if (displayHistory.length < historyLimit) {
    const missingCount = historyLimit - displayHistory.length;
    for (let i = 0; i < missingCount; i++) {
      paddedHistory.push(Array(channelsCount).fill(ContactorState.CT_OPEN));
    }
  }
  paddedHistory.push(...displayHistory);

  // SVG drawing dimensions
  const trackHeight = 24;
  const trackGap = 8;
  const labelWidth = 60;
  const paddingRight = 10;
  
  const widthByPoints = 420; // width of waveform area in SVG
  const totalWidth = labelWidth + widthByPoints + paddingRight;
  const totalHeight = channelsCount * (trackHeight + trackGap) + 20;

  // Create stepped digital waveform path for a single channel
  const makeWaveformPath = (channelIndex: number): string => {
    const points: { x: number; y: number }[] = [];
    const stepX = widthByPoints / (historyLimit - 1);

    paddedHistory.forEach((snapshot, tickIndex) => {
      const state = snapshot[channelIndex];
      // High logic (1) for CLOSED or CLOSING, low (0) otherwise
      const isHigh = state === ContactorState.CT_CLOSED || state === ContactorState.CT_CLOSING;
      
      const x = labelWidth + tickIndex * stepX;
      // High is y=low value inside track, Low is y=high value inside track
      const yOffset = channelIndex * (trackHeight + trackGap) + 10;
      const y = isHigh ? yOffset + 2 : yOffset + trackHeight - 2;

      if (tickIndex > 0) {
        // Add vertical transition line before setting new value if state changed
        const prevSnapshot = paddedHistory[tickIndex - 1];
        const prevState = prevSnapshot[channelIndex];
        const prevIsHigh = prevState === ContactorState.CT_CLOSED || prevState === ContactorState.CT_CLOSING;

        if (prevIsHigh !== isHigh) {
          const prevY = prevIsHigh ? yOffset + 2 : yOffset + trackHeight - 2;
          points.push({ x, y: prevY });
        }
      }

      points.push({ x, y });
    });

    if (points.length === 0) return "";
    return `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`;
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between" id="logic-analyzer-card">
      <div>
        <div className="flex justify-between items-center pb-2 border-b border-slate-850 mb-3.5 select-none">
          <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wide">
            <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
            10-CH CONTACTORS LOGIC TIMING ANALYZER
          </span>
          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
            symmetryOk 
              ? "bg-slate-900 text-slate-400 border-slate-800" 
              : "bg-red-950 text-red-400 border-red-900 animate-pulse"
          }`}>
            RESOLVER: {symmetryOk ? "ALIGN_OK" : "ALIGN_ERR"}
          </span>
        </div>

        <p className="text-[10px] font-mono text-slate-500 leading-normal mb-3 leading-relaxed">
          Dynamic timing analyzer tracking high-high transitions to debug symmetry delay in relay pairs (CT0/CT9 & CT1/CT8).
        </p>

        {/* Timing Diagram SVG Wrapper */}
        <div className="bg-slate-900 border border-slate-850 rounded p-3 overflow-x-auto overflow-y-hidden select-none">
          <svg className="w-full min-w-[500px]" height={totalHeight} viewBox={`0 0 ${totalWidth} ${totalHeight}`} preserveAspectRatio="xMidYMid meet">
            {/* Horizontal Grid Lines */}
            {Array.from({ length: channelsCount }).map((_, i) => {
              const yOffset = i * (trackHeight + trackGap) + 10;
              return (
                <g key={i}>
                  {/* Track boundaries background */}
                  <rect
                    x={labelWidth}
                    y={yOffset}
                    width={widthByPoints}
                    height={trackHeight}
                    fill="rgba(255,255,255,0.015)"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="1"
                    className="transition-colors"
                  />
                  
                  {/* Midline reference dotted */}
                  <line
                    x1={labelWidth}
                    y1={yOffset + trackHeight / 2}
                    x2={labelWidth + widthByPoints}
                    y2={yOffset + trackHeight / 2}
                    stroke="rgba(255,255,255,0.02)"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                </g>
              );
            })}

            {/* Vertical Time Div Grid Lines */}
            {Array.from({ length: 9 }).map((_, i) => {
              const x = labelWidth + (i + 1) * (widthByPoints / 10);
              return (
                <line
                  key={i}
                  x1={x}
                  y1={5}
                  x2={x}
                  y2={totalHeight - 15}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1"
                  strokeDasharray="3,6"
                />
              );
            })}

            {/* Digital Waveform Tracks */}
            {Array.from({ length: channelsCount }).map((_, i) => {
              const yOffset = i * (trackHeight + trackGap) + 10;
              const pathStr = makeWaveformPath(i);
              
              // Find channel status at the latest tick
              const latestState = contactorHistory[contactorHistory.length - 1]?.[i] ?? ContactorState.CT_OPEN;
              const isClosed = latestState === ContactorState.CT_CLOSED || latestState === ContactorState.CT_CLOSING;
              
              let strokeColor = "rgba(148, 163, 184, 0.4)"; // Default open state line
              let textClass = "text-slate-500";
              if (latestState === ContactorState.CT_FAULT) {
                strokeColor = "#f87171"; // Red
                textClass = "text-red-400 font-bold";
              } else if (isClosed) {
                strokeColor = i === 0 || i === 9 ? "#38bdf8" : i === 1 || i === 8 ? "#34d399" : "#a78bfa"; // Colored tracks for paired analysis
                textClass = isClosed ? "text-slate-200" : "text-slate-500";
              }

              return (
                <g key={i} className="group">
                  {/* Channel Name / Identifier Label */}
                  <text
                    x={10}
                    y={yOffset + trackHeight / 2 + 3}
                    fill="currentColor"
                    className={`font-mono text-[9px] selection:bg-transparent ${textClass}`}
                  >
                    CT_CH{i} {latestState === ContactorState.CT_FAULT ? "⚠" : isClosed ? "█" : "░"}
                  </text>

                  {/* Shaded Area underneath high waveform (using custom shadow rendering or path filling) */}
                  
                  {/* Render stepped line */}
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />
                </g>
              );
            })}

            {/* Time Marker axis line */}
            <line
              x1={labelWidth}
              y1={totalHeight - 15}
              x2={labelWidth + widthByPoints}
              y2={totalHeight - 15}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
            <text
              x={labelWidth}
              y={totalHeight - 3}
              fill="rgba(148, 163, 184, 0.4)"
              className="font-mono text-[7px]"
            >
              -{historyLimit} Ticks
            </text>
            <text
              x={labelWidth + widthByPoints - 25}
              y={totalHeight - 3}
              fill="rgba(16, 185, 129, 0.5)"
              className="font-mono text-[7px] font-bold"
            >
              LIVE (t)
            </text>
          </svg>
        </div>
      </div>

      {/* Synchronized analysis guidance */}
      <div className="mt-3.5 bg-slate-900/60 p-2 border border-slate-850 rounded font-mono text-[9px] leading-relaxed text-slate-500">
        {!symmetryOk ? (
          <div className="flex gap-1.5 items-start text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>INTERLOCK TIMING FAIL: Symmetrical pairs CT0/CT9 static offset detected. Asynchronous interlock spring trip triggered.</span>
          </div>
        ) : (
          <div className="text-slate-450">
            Pair alignment tracking: CH0 ↔ CH9 (complementary outer loop); CH1 ↔ CH8 (complementary inner pre-charge). Wave tracks aligned within mechanical tolerancing.
          </div>
        )}
      </div>
    </div>
  );
}
