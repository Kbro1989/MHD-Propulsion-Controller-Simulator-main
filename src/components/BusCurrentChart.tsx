/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from "react";
import { Activity, Thermometer, Sparkles } from "lucide-react";
import * as d3 from "d3";

interface BusCurrentChartProps {
  busCurrentHistory: number[];
  predictedTempHistory: number[];
  actualTempHistory: number[];
  tickCounter: number;
}

export default function BusCurrentChart({
  busCurrentHistory,
  predictedTempHistory,
  actualTempHistory,
  tickCounter,
}: BusCurrentChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 180 });

  // Monitor resize of container to ensure responsive SVG rendering
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 250),
          height: 180, // Fix standard height
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const { width, height } = dimensions;
  const paddingLeft = 35;
  const paddingRight = 35; // Expand right padding to fit Kelvin right-axis ticks beautifully
  const paddingTop = 15;
  const paddingBottom = 20;

  // 1. Process Bus Current Data (Left Y-scale)
  const dataset = busCurrentHistory.slice(-50);
  const displayLimit = 50;
  
  // Pad dataset to displayLimit with 1880.0 (nominal) so we always render a full 50-tick chart
  const dataToRender: number[] = [];
  if (dataset.length < displayLimit) {
    const missingCount = displayLimit - dataset.length;
    for (let i = 0; i < missingCount; i++) {
      dataToRender.push(1880.0); // Baseline nominal current
    }
  }
  dataToRender.push(...dataset);

  // 2. Process Predicted Temperature Data (Right Y-scale)
  const datasetTemp = (predictedTempHistory || []).slice(-50);
  const dataTempToRender: number[] = [];
  if (datasetTemp.length < displayLimit) {
    const missingCount = displayLimit - datasetTemp.length;
    for (let i = 0; i < missingCount; i++) {
      dataTempToRender.push(300.0); // Baseline nominal temperature
    }
  }
  dataTempToRender.push(...datasetTemp);

  // 3. Process Actual Temperature Data (Right Y-scale)
  const datasetActualTemp = (actualTempHistory || []).slice(-50);
  const dataActualTempToRender: number[] = [];
  if (datasetActualTemp.length < displayLimit) {
    const missingCount = displayLimit - datasetActualTemp.length;
    for (let i = 0; i < missingCount; i++) {
      dataActualTempToRender.push(300.0); // Baseline nominal temperature
    }
  }
  dataActualTempToRender.push(...datasetActualTemp);

  // Compute Scales
  const extentsY = d3.extent(dataToRender);
  const minY = Math.max(0, (extentsY[0] ?? 1880) - 200);
  const maxY = Math.max(2100, (extentsY[1] ?? 1880) + 150);

  // Dynamic but stable Kelvin domain matching Taylor range
  const extentsTempY = d3.extent([...dataTempToRender, ...dataActualTempToRender]);
  const minTempY = Math.min(270, (extentsTempY[0] ?? 300) - 5);
  const maxTempY = Math.max(340, (extentsTempY[1] ?? 310) + 10);

  const xScale = d3
    .scaleLinear()
    .domain([0, displayLimit - 1])
    .range([paddingLeft, width - paddingRight]);

  const yScale = d3
    .scaleLinear()
    .domain([minY, maxY])
    .range([height - paddingBottom, paddingTop]);

  const yScaleTemp = d3
    .scaleLinear()
    .domain([minTempY, maxTempY])
    .range([height - paddingBottom, paddingTop]);

  // Compute D3 paths
  const areaGenerator = d3
    .area<number>()
    .x((_, i) => xScale(i))
    .y0(height - paddingBottom)
    .y1((d) => yScale(d))
    .curve(d3.curveMonotoneX);

  const lineGenerator = d3
    .line<number>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d))
    .curve(d3.curveMonotoneX);

  const tempLineGenerator = d3
    .line<number>()
    .x((_, i) => xScale(i))
    .y((d) => yScaleTemp(d))
    .curve(d3.curveMonotoneX);

  const actualTempLineGenerator = d3
    .line<number>()
    .x((_, i) => xScale(i))
    .y((d) => yScaleTemp(d))
    .curve(d3.curveMonotoneX);

  const areaPath = areaGenerator(dataToRender) ?? "";
  const linePath = lineGenerator(dataToRender) ?? "";
  const tempLinePath = tempLineGenerator(dataTempToRender) ?? "";
  const actualTempLinePath = actualTempLineGenerator(dataActualTempToRender) ?? "";

  // Helper values for current status
  const latestValue = busCurrentHistory[busCurrentHistory.length - 1] ?? 1880.0;
  const maxCurrentObserved = d3.max(dataToRender) ?? 1880.0;
  const minCurrentObserved = d3.min(dataToRender) ?? 1880.0;

  const latestPredictedTemp = dataTempToRender[dataTempToRender.length - 1] ?? 300.0;
  const latestActualTemp = dataActualTempToRender[dataActualTempToRender.length - 1] ?? 300.0;

  // Generate gridlines
  const yTicks = yScale.ticks(4);
  const tempTicks = yScaleTemp.ticks(4);
  const xTicksBy5 = Array.from({ length: 6 }).map((_, i) => i * 10);

  return (
    <div
      ref={containerRef}
      className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between"
      id="bus-current-chart-card"
    >
      <div>
        <div className="flex justify-between items-center pb-2 border-b border-slate-850 mb-2 select-none">
          <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wide">
            <Activity className="h-4 w-4 text-emerald-400" />
            REAL-TIME DC BUS CURRENT & TEMP FORECAST (D3)
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
              latestValue >= 2000.0 
                ? "bg-red-950 text-red-400 border-red-900 animate-pulse" 
                : latestValue >= 1950.0
                ? "bg-amber-950 text-amber-400 border-amber-900 animate-pulse"
                : "bg-slate-900 text-slate-455 border-slate-800"
            }`}>
              AMPS: {latestValue.toFixed(0)}A
            </span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border bg-rose-950/40 text-rose-400 border-rose-900/60 uppercase">
              ACT: {latestActualTemp.toFixed(1)}K
            </span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border bg-amber-950/40 text-amber-400 border-amber-900/60 uppercase">
              PRED: {latestPredictedTemp.toFixed(1)}K
            </span>
          </div>
        </div>

        <p className="text-[10px] font-mono text-slate-555 leading-normal mb-2 leading-relaxed">
          Overlaying actual and predicted temperature trends from Taylor series calculations on DC bus demands. Allows cross-correlation analysis between inductive power load and thermodynamic rise.
        </p>

        {/* Visual Legend block explicitly showing correlations */}
        <div className="flex flex-wrap items-center gap-4 mb-3.5 text-[8.5px] font-mono select-none">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-1.5 bg-emerald-500/20 border-t-2 border-emerald-500 rounded-sm" />
            <span className="text-slate-400">Loads: Bus Current (A)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 border-t-2 border-rose-500" />
            <span className="text-slate-400">Thermodynamics: Actual Avg Temp (K)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-orange-400" />
            <span className="text-slate-400">Thermodynamics: Taylor Pred (K)</span>
          </div>
        </div>

        {/* Chart Viewport container */}
        <div className="relative bg-slate-900/50 rounded border border-slate-850 p-1">
          <svg className="w-full select-none overflow-visible" height={height}>
            <defs>
              {/* Glowing Linear Area Gradient for DC Bus Current */}
              <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Minor Horizontal Grid lines */}
            {yTicks.map((tick, i) => (
              <line
                key={i}
                x1={paddingLeft}
                y1={yScale(tick)}
                x2={width - paddingRight}
                y2={yScale(tick)}
                stroke="rgba(255,255,255,0.02)"
                strokeWidth="1"
              />
            ))}

            {/* Threshold safety boundary line (2000A) */}
            {yScale(2000) > paddingTop && yScale(2000) < height - paddingBottom && (
              <g>
                <line
                  x1={paddingLeft}
                  y1={yScale(2000)}
                  x2={width - paddingRight}
                  y2={yScale(2000)}
                  stroke="#ef4444"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  strokeOpacity="0.75"
                />
                <text
                  x={width - paddingRight - 110}
                  y={yScale(2000) - 4}
                  fill="#f87171"
                  className="font-mono text-[7px] font-bold"
                >
                  CRITICAL OVERCURRENT LIMIT (2000A)
                </text>
              </g>
            )}

            {/* Thermal Throttled Cap warning line (1500A) */}
            {yScale(1500) > paddingTop && yScale(1500) < height - paddingBottom && (
              <g>
                <line
                  x1={paddingLeft}
                  y1={yScale(1500)}
                  x2={width - paddingRight}
                  y2={yScale(1500)}
                  stroke="rgba(245, 158, 11, 0.45)"
                  strokeWidth="0.8"
                  strokeDasharray="3,3"
                  strokeOpacity="0.6"
                />
                <text
                  x={paddingLeft + 10}
                  y={yScale(1500) - 3}
                  fill="rgba(245, 158, 11, 0.75)"
                  className="font-mono text-[6px] font-medium"
                >
                  THERMAL THROWBACK CAP (1500A)
                </text>
              </g>
            )}

            {/* Thermal warning boundary for right-scale (320K) */}
            {yScaleTemp(320) > paddingTop && yScaleTemp(320) < height - paddingBottom && (
              <g>
                <line
                  x1={paddingLeft}
                  y1={yScaleTemp(320)}
                  x2={width - paddingRight}
                  y2={yScaleTemp(320)}
                  stroke="#fb923c"
                  strokeWidth="0.7"
                  strokeDasharray="2,2"
                  strokeOpacity="0.5"
                />
                <text
                  x={paddingLeft + 10}
                  y={yScaleTemp(320) + 7}
                  fill="#fca5a5"
                  className="font-mono text-[6px]"
                >
                  320K SHUTDOWN ENVELOPE
                </text>
              </g>
            )}

            {/* Render Area Filled Path for Load Current */}
            {areaPath && dataToRender.length > 0 && <path d={areaPath} fill="url(#area-gradient)" />}

            {/* Render Line stroke Path for Load Current */}
            {linePath && dataToRender.length > 0 && (
              <path
                d={linePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Render Line stroke Path for Actual Temperature Trend */}
            {actualTempLinePath && dataActualTempToRender.length > 0 && (
              <path
                d={actualTempLinePath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Render Line stroke Path for Temperature Forecast Overlay */}
            {tempLinePath && dataTempToRender.length > 0 && (
              <path
                d={tempLinePath}
                fill="none"
                stroke="#fb923c"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Left Y-axis text labels (DC Bus Amps) */}
            {yTicks.map((tick, i) => (
              <text
                key={i}
                x={paddingLeft - 6}
                y={yScale(tick) + 2.5}
                fill="rgba(16, 185, 129, 0.5)"
                className="font-mono text-[7.5px] font-semibold text-right"
                textAnchor="end"
              >
                {tick}A
              </text>
            ))}

            {/* Right Y-axis text labels (Predicted Kelvin) */}
            {tempTicks.map((tick, i) => (
              <text
                key={i}
                x={width - paddingRight + 6}
                y={yScaleTemp(tick) + 2.5}
                fill="#fb923c"
                fillOpacity="0.7"
                className="font-mono text-[7.5px] font-semibold text-left"
                textAnchor="start"
              >
                {tick.toFixed(0)}K
              </text>
            ))}

            {/* Time labels (Relative ticks) */}
            {xTicksBy5.map((tick, i) => {
              const fraction = tick / 50;
              const xPos = paddingLeft + fraction * (width - paddingLeft - paddingRight);
              return (
                <text
                  key={i}
                  x={xPos}
                  y={height - 5}
                  fill="rgba(148, 163, 184, 0.35)"
                  className="font-mono text-[7px]"
                  textAnchor="middle"
                >
                  -{50 - tick}t
                </text>
              );
            })}

            {/* Axis boundary borders */}
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={height - paddingBottom}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
            <line
              x1={width - paddingRight}
              y1={paddingTop}
              x2={width - paddingRight}
              y2={height - paddingBottom}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
            <line
              x1={paddingLeft}
              y1={height - paddingBottom}
              x2={width - paddingRight}
              y2={height - paddingBottom}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          </svg>
        </div>
      </div>

      {/* Numerical diagnostic metrics sub-strip */}
      <div className="mt-3.5 grid grid-cols-2 md:grid-cols-5 gap-2 border-t border-slate-900/60 pt-3 select-none">
        <div className="bg-slate-900/40 p-1 px-2 rounded border border-slate-850/30 text-center font-mono">
          <span className="text-[7px] text-slate-500 font-bold block">CURRENT BUS</span>
          <span className={`text-[10px] font-bold ${latestValue >= 2000 ? "text-red-400" : latestValue >= 1500 ? "text-amber-405" : "text-emerald-400"}`}>
            {latestValue.toFixed(0)}A
          </span>
        </div>
        <div className="bg-slate-900/40 p-1 px-2 rounded border border-slate-850/30 text-center font-mono">
          <span className="text-[7px] text-slate-500 font-bold block">PEAK CURRENT</span>
          <span className="text-[10px] font-bold text-slate-300">
            {maxCurrentObserved.toFixed(0)}A
          </span>
        </div>
        <div className="bg-slate-900/40 p-1 px-2 rounded border border-slate-850/30 text-center font-mono animate-fade-in">
          <span className="text-[7px] text-slate-500 font-bold block flex items-center justify-center gap-0.5">
            <Thermometer className="h-2 w-2 text-rose-450" />
            ACT TEMP
          </span>
          <span className="text-[10px] font-bold text-rose-400">
            {latestActualTemp.toFixed(1)}K
          </span>
        </div>
        <div className="bg-slate-900/40 p-1 px-2 rounded border border-slate-850/30 text-center font-mono animate-fade-in">
          <span className="text-[7px] text-slate-500 font-bold block flex items-center justify-center gap-0.5">
            <Thermometer className="h-2 w-2 text-orange-400" />
            PRED TEMP (T+3)
          </span>
          <span className="text-[10px] font-bold text-orange-400">
            {latestPredictedTemp.toFixed(1)}K
          </span>
        </div>
        <div className="bg-slate-900/40 p-1 px-2 rounded border border-slate-850/30 text-center font-mono animate-fade-in">
          <span className="text-[7px] text-slate-500 font-bold block flex items-center justify-center gap-0.5">
            <Sparkles className="h-2 w-2 text-cyan-400" />
            TAYLOR VARIANCE
          </span>
          <span className="text-[10px] font-bold text-cyan-400">
            {predictedTempHistory && predictedTempHistory.length > 1 ? (Math.abs(predictedTempHistory[predictedTempHistory.length - 1] - predictedTempHistory[predictedTempHistory.length - 2])).toFixed(2) : "0.00"}
          </span>
        </div>
      </div>
    </div>
  );
}
