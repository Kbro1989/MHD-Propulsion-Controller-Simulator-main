import React, { useState, useEffect, useMemo } from "react";
import {
  HexagramState,
  HexagramStateLabels,
  ContactorState,
  ContactorStateLabels,
  SubsystemId,
  SystemLog
} from "../types";
import {
  Layers,
  ArrowDownUp,
  Cpu,
  ShieldCheck,
  Compass,
  Sliders,
  Zap,
  Play,
  RotateCcw,
  Network
} from "lucide-react";

interface SpatialPlaneVisualizerProps {
  currentHexagram: HexagramState;
  contactorStates: ContactorState[];
  avgElectrodeTemp: number;
  plenumPressure: number;
  busCurrentA: number;
  safetyOk: boolean;
  activeFaultCodes: string[];
  isAiActive: boolean;
  systemLogs: SystemLog[];
}

// Plane Definition Types
interface OperationalPlane {
  id: string;
  name: string;
  registerHex: string;
  altitudeIndex: number; // 0 = EXECUTION, 1 = CAUSAL, 2 = INTERPRETATION, 3 = POLICY
  colorClass: string;
  textGlow: string;
  strokeColor: string;
  fillColor: string;
}

export default function SpatialPlaneVisualizer({
  currentHexagram,
  contactorStates,
  avgElectrodeTemp,
  plenumPressure,
  busCurrentA,
  safetyOk,
  activeFaultCodes,
  isAiActive,
  systemLogs
}: SpatialPlaneVisualizerProps) {
  // 3D View Manipulation Controls
  const [yaw, setYaw] = useState<number>(-35);      // Yaw rotation in degrees (-180 to 180)
  const [pitch, setPitch] = useState<number>(40);    // Pitch angle/inclination in degrees (15 to 75)
  const [spacing, setSpacing] = useState<number>(110); // Vertical gap (pixels) between planes
  const [zoom, setZoom] = useState<number>(1.0);     // Scale modifier
  const [activeSignalPulse, setActiveSignalPulse] = useState<boolean>(false);
  const [pulseLevel, setPulseLevel] = useState<number>(-1); // Animation progress for cascading pulse
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Auto-rotation effect
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setYaw((prev) => {
        const next = prev + 0.5;
        return next > 180 ? -180 : next;
      });
    }, 32);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Operational levels defined in standard validated state taxonomy
  const planes: OperationalPlane[] = useMemo(() => [
    {
      id: "policy",
      name: "POLICY Tier",
      registerHex: "0x0C",
      altitudeIndex: 3,
      colorClass: "text-amber-400",
      textGlow: "shadow-[0_0_12px_rgba(245,158,11,0.5)]",
      strokeColor: "#f59e0b",
      fillColor: "rgba(245, 158, 11, 0.04)"
    },
    {
      id: "interpretation",
      name: "INTERPRETATION Tier",
      registerHex: "0x80",
      altitudeIndex: 2,
      colorClass: "text-violet-400",
      textGlow: "shadow-[0_0_12px_rgba(167,139,250,0.5)]",
      strokeColor: "#a78bfa",
      fillColor: "rgba(167, 139, 250, 0.04)"
    },
    {
      id: "causal",
      name: "CAUSAL Tier",
      registerHex: "0x10",
      altitudeIndex: 1,
      colorClass: "text-cyan-400",
      textGlow: "shadow-[0_0_12px_rgba(34,211,238,0.5)]",
      strokeColor: "#22d3ee",
      fillColor: "rgba(34, 211, 238, 0.04)"
    },
    {
      id: "execution",
      name: "EXECUTION Tier",
      registerHex: "0x44",
      altitudeIndex: 0,
      colorClass: "text-emerald-400",
      textGlow: "shadow-[0_0_12px_rgba(52,211,153,0.5)]",
      strokeColor: "#34d399",
      fillColor: "rgba(52, 211, 153, 0.04)"
    }
  ], []);

  // Map 3D coordinates (x, y, zIndex) to Cartesian screen coordinates (X, Y)
  const projectPoint = (x: number, y: number, altitudeIndex: number) => {
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;

    // 1. Yaw rotation around vertical axis (Z)
    const xr = x * Math.cos(yawRad) - y * Math.sin(yawRad);
    const yr = x * Math.sin(yawRad) + y * Math.cos(yawRad);

    // 2. Isometric screen projection
    const screenX = 400 + xr * zoom * 1.5;
    // Squeeze the Y based on pitch, offset vertically by plane index * spacing
    const screenY = 320 + (yr * Math.sin(pitchRad)) * zoom * 1.5 - altitudeIndex * spacing;

    return { x: screenX, y: screenY };
  };

  // Coordinates for the four corners of each stacked parallel plane rhombus
  const getPlaneCorners = (altitudeIndex: number) => {
    const size = 110;
    const p1 = projectPoint(-size, -size, altitudeIndex);
    const p2 = projectPoint(size, -size, altitudeIndex);
    const p3 = projectPoint(size, size, altitudeIndex);
    const p4 = projectPoint(-size, size, altitudeIndex);
    return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
  };

  // Run cascading cascade simulation signal pulse
  const triggerCascadePulse = () => {
    if (activeSignalPulse) return;
    setActiveSignalPulse(true);
    setPulseLevel(3); // Start at Policy Plane

    const interval = setInterval(() => {
      setPulseLevel((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setActiveSignalPulse(false);
          return -1;
        }
        return prev - 1;
      });
    }, 350);
  };

  // Get active flow routes to print to terminal log panel
  const transitionPackets = useMemo(() => {
    const filtered = systemLogs
      .filter((log) => log.subsystem === SubsystemId.SECURE_LOCK || log.subsystem === SubsystemId.INTERLOCK_SEQUENCE || log.subsystem === "SYSTEM")
      .slice(-6)
      .reverse();
    return filtered;
  }, [systemLogs]);

  // Causal state machine paths
  const hexagramNodes = useMemo(() => [
    { state: HexagramState.IDLE, name: "IDLE", angle: 0 },
    { state: HexagramState.STEALTH, name: "STEALTH", angle: 45 },
    { state: HexagramState.TRANSIT, name: "TRANSIT", angle: 90 },
    { state: HexagramState.TR_SALT, name: "TR_SALT", angle: 135 },
    { state: HexagramState.TR_CRIT, name: "TR_CRIT", angle: 180 },
    { state: HexagramState.ST_CRIT, name: "ST_CRIT", angle: 225 },
    { state: HexagramState.LIMP_MODE, name: "LIMP_MODE", angle: 270 },
    { state: HexagramState.PURGE, name: "PURGE", angle: 315 },
  ], []);

  // Compute node coordinate positions on the CAUSAL Tier Plane (Altitude Index: 1)
  const causalNodesMapped = useMemo(() => {
    const radius = 65;
    return hexagramNodes.map((node) => {
      const rad = (node.angle * Math.PI) / 180;
      const localX = Math.cos(rad) * radius;
      const localY = Math.sin(rad) * radius;
      const screenPos = projectPoint(localX, localY, 1);
      return {
        ...node,
        screenX: screenPos.x,
        screenY: screenPos.y,
        localX,
        localY
      };
    });
  }, [yaw, pitch, spacing, zoom]);

  // Map 10 physical hardware contactors globally on the EXECUTION Plane (Altitude Index: 0)
  const contactorNodesMapped = useMemo(() => {
    return contactorStates.map((state, idx) => {
      // Line them up along a neat front-back diagonal or horizontal offset
      const localX = -75 + idx * 17;
      const localY = Math.sin(idx * 0.9) * 20; // Curved visual wave
      const screenPos = projectPoint(localX, localY, 0);
      return {
        id: idx,
        state,
        screenX: screenPos.x,
        screenY: screenPos.y
      };
    });
  }, [yaw, pitch, spacing, zoom, contactorStates]);

  // Map temperature and pressure grids onto INTERPRETATION Plane (Altitude Index: 2)
  const interpretationSensors = useMemo(() => {
    const sensors = [];
    const gridSize = 4; // 4x4 coordinate web points
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const localX = -60 + c * 40;
        const localY = -60 + r * 40;
        const screenPos = projectPoint(localX, localY, 2);
        sensors.push({
          row: r,
          col: c,
          screenX: screenPos.x,
          screenY: screenPos.y,
          localX,
          localY
        });
      }
    }
    return sensors;
  }, [yaw, pitch, spacing, zoom]);

  // Compute dynamic center points coordinates
  const policyCenter = useMemo(() => projectPoint(0, 0, 3), [yaw, pitch, spacing, zoom]);
  const interpretationCenter = useMemo(() => projectPoint(0, 0, 2), [yaw, pitch, spacing, zoom]);
  const causalCenter = useMemo(() => projectPoint(0, 0, 1), [yaw, pitch, spacing, zoom]);
  const executionCenter = useMemo(() => projectPoint(0, 0, 0), [yaw, pitch, spacing, zoom]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-2xl flex flex-col xl:flex-row gap-5 relative overflow-hidden" id="spatial-plane-coprocessor">
      
      {/* Visual Overlay: Watermark Grid */}
      <div className="absolute right-3 top-3 opacity-[0.03] select-none text-[80px] font-mono leading-none font-extrabold uppercase pointer-events-none tracking-tighter">
        3D BUS
      </div>

      {/* Main interactive CAD viewport panel */}
      <div className="flex-1 flex flex-col">
        {/* Header Ribbon */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-805 pb-4 mb-4 gap-3">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-cyan-400 rotate-12 filter drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
            <div>
              <h3 className="font-display font-medium text-xs text-slate-150 tracking-wider uppercase">
                Isometric Multi-Tier Spatial Plane Visualizer
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">
                REAL-TIME HARDWARE STACK TAXONOMY // REPLAY SYSTEM GATEWAYS
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={triggerCascadePulse}
              disabled={activeSignalPulse}
              className={`flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-900/40 to-amber-750/30 border border-amber-600/40 hover:border-amber-500 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition select-none ${
                activeSignalPulse ? "opacity-50 cursor-not-allowed" : "cursor-pointer text-amber-300 hover:text-white"
              }`}
              title="Manually inject POLICY [0x0C] command and witness downward cross-plane propagation"
            >
              <Zap className={`h-3 w-3 ${activeSignalPulse ? "animate-bounce text-amber-400" : "text-amber-500"}`} />
              Inject Policy Pulse
            </button>

            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`flex items-center gap-1 px-3 py-1 border rounded text-[10px] font-mono transition select-none cursor-pointer ${
                autoRotate
                  ? "bg-cyan-950/40 text-cyan-400 border-cyan-800"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-300"
              }`}
            >
              <RotateCcw className={`h-3 w-3 ${autoRotate ? "animate-spin text-cyan-400" : "text-slate-500"}`} />
              Auto Yaw: {autoRotate ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* The 3D Render Viewport (SVG Container) */}
        <div className="relative bg-slate-950/70 border border-slate-850 rounded-lg p-2 overflow-hidden flex items-center justify-center min-h-[440px] md:min-h-[480px]">
          
          {/* Compass / Angle status HUD widgets */}
          <div className="absolute top-3 left-3 flex flex-col gap-1 z-1 pointer-events-none select-none font-mono text-[9px] text-slate-500 border-l-2 border-slate-800 pl-2">
            <span className="text-[10px] text-slate-400 font-bold tracking-wider">VIEWPOINT SENSORS</span>
            <span>YAW: <strong className="text-cyan-400">{yaw.toFixed(0)}°</strong></span>
            <span>PITCH: <strong className="text-cyan-405">{pitch.toFixed(0)}°</strong></span>
            <span>ALTITUDE HEIGHT: <strong className="text-violet-400">{spacing}px</strong></span>
            <span>ACTIVE SIGNAL FLOW: {activeSignalPulse ? <span className="text-amber-400 font-bold animate-pulse">CASCADING</span> : <span className="text-slate-600">STABLE</span>}</span>
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-2 select-none font-mono text-[8.5px] text-slate-505 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>TACTIC MATRIX INTERRUPT</span>
          </div>

          {/* SVG Context wrapper */}
          <svg
            className="w-full max-w-[660px] h-[480px] drop-shadow-md select-none pointer-events-none"
            viewBox="0 0 800 600"
          >
            <defs>
              {/* Gradients */}
              <linearGradient id="busGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="35%" stopColor="#a78bfa" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#22d3ee" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
              </linearGradient>

              <linearGradient id="pulseSignalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
                <stop offset="50%" stopColor="#ec4899" stopOpacity="1" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>

              {/* Glowing SVG Filter */}
              <filter id="glow3d" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* A. RENDER THE VERTICAL TRIPLE-BUS (CORE SPINE PATHWAY) */}
            <line
              x1={policyCenter.x} y1={policyCenter.y}
              x2={executionCenter.x} y2={executionCenter.y}
              stroke="url(#busGradient)"
              strokeWidth="2.5"
              strokeDasharray="4,6"
              opacity="0.32"
            />
            
            {/* Super glowing solid spine for central active transitions */}
            <line
              x1={policyCenter.x} y1={policyCenter.y}
              x2={executionCenter.x} y2={executionCenter.y}
              stroke="url(#busGradient)"
              strokeWidth="1.5"
              opacity="0.15"
            />

            {/* B. DYNAMIC CASCADE OVERLAY (POLICY PULSE ACTION) */}
            {activeSignalPulse && pulseLevel >= 0 && (
              <circle
                cx={
                  pulseLevel === 3 ? policyCenter.x :
                  pulseLevel === 2 ? interpretationCenter.x :
                  pulseLevel === 1 ? causalCenter.x : executionCenter.x
                }
                cy={
                  pulseLevel === 3 ? policyCenter.y :
                  pulseLevel === 2 ? interpretationCenter.y :
                  pulseLevel === 1 ? causalCenter.y : executionCenter.y
                }
                r="18"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                className="animate-ping"
                filter="url(#glow3d)"
              />
            )}

            {/* RENDER THE FOUR STACKED PLANES (Back-to-Front Layer Ordering is done cleanly from Index 0 to 3) */}
            {planes.slice().reverse().map((plane) => {
              const activeCascadeMatch = activeSignalPulse && pulseLevel === plane.altitudeIndex;
              const isInterpretationNodeActive = plane.id === "interpretation";
              const isPolicyNodeActive = plane.id === "policy";

              return (
                <g key={plane.id}>
                  {/* Parallelogram Flat Wireframe Polygon representant */}
                  <polygon
                    points={getPlaneCorners(plane.altitudeIndex)}
                    fill={plane.fillColor}
                    stroke={activeCascadeMatch ? "#f59e0b" : plane.strokeColor}
                    strokeWidth={activeCascadeMatch ? "2.5" : "1.2"}
                    strokeDasharray={plane.id === "policy" ? "5,3" : "none"}
                    opacity={activeCascadeMatch ? 0.95 : 0.45}
                    className="transition-all duration-300"
                  />

                  {/* Little grid line ribs inside the rhomboid plane to amplify depth representation */}
                  {[ -50, 0, 50 ].map((offsetVal, lineIdx) => {
                    const planeLeft = projectPoint(-110, offsetVal, plane.altitudeIndex);
                    const planeRight = projectPoint(110, offsetVal, plane.altitudeIndex);
                    const planeTop = projectPoint(offsetVal, -110, plane.altitudeIndex);
                    const planeBottom = projectPoint(offsetVal, 110, plane.altitudeIndex);
                    
                    return (
                      <g key={`grid-${plane.id}-${lineIdx}`} opacity="0.12">
                        <line x1={planeLeft.x} y1={planeLeft.y} x2={planeRight.x} y2={planeRight.y} stroke={plane.strokeColor} strokeWidth="1" />
                        <line x1={planeTop.x} y1={planeTop.y} x2={planeBottom.x} y2={planeBottom.y} stroke={plane.strokeColor} strokeWidth="1" />
                      </g>
                    );
                  })}

                  {/* Outer corner grid rivets */}
                  {[ [-110,-110], [110,-110], [110,110], [-110,110] ].map((cornerOffset, cIdx) => {
                    const rivetPos = projectPoint(cornerOffset[0], cornerOffset[1], plane.altitudeIndex);
                    return (
                      <circle
                        key={`rivet-${plane.id}-${cIdx}`}
                        cx={rivetPos.x}
                        cy={rivetPos.y}
                        r="2"
                        fill={plane.strokeColor}
                        opacity="0.35"
                      />
                    );
                  })}

                  {/* Corner register descriptive tags */}
                  {(() => {
                    const tagPos = projectPoint(115, 65, plane.altitudeIndex);
                    return (
                      <g fontFamily="monospace" fontSize="8" fill={plane.strokeColor}>
                        <text x={tagPos.x} y={tagPos.y} opacity="0.6" textAnchor="start">
                          {plane.name} ({plane.registerHex})
                        </text>
                      </g>
                    );
                  })()}

                  {/* ==========================================================
                      SUB-RENDER: TIER-SPECIFIC SUB-COMPONENTS RENDER
                  ========================================================== */}
                  {/* POLICY LAYER NODES (Altitude: 3) */}
                  {plane.id === "policy" && (
                    <g>
                      {/* Anchor points representing AI Controller inputs */}
                      <circle
                        cx={policyCenter.x}
                        cy={policyCenter.y}
                        r="6"
                        fill={isAiActive ? "#f59e0b" : "#475569"}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        filter={isAiActive ? "url(#glow3d)" : "none"}
                        opacity="0.85"
                      />
                      {/* Text Label on POLICY Layer */}
                      <g fontFamily="monospace" fontSize="8" fill="#f59e0b">
                        <text x={policyCenter.x} y={policyCenter.y - 12} textAnchor="middle" fontWeight="bold">
                          {isAiActive ? "AI_AUTOPILOT (ARMED)" : "MANUAL_AXI4_OVERRIDE"}
                        </text>
                      </g>
                      {/* Decorative logic loop */}
                      <path
                        d={`M ${policyCenter.x - 25} ${policyCenter.y + 10} Q ${policyCenter.x} ${policyCenter.y + 15} ${policyCenter.x + 25} ${policyCenter.y + 10}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1"
                        strokeDasharray="2,3"
                        opacity="0.5"
                      />
                    </g>
                  )}

                  {/* INTERPRETATION LAYER NODES (Altitude: 2) */}
                  {plane.id === "interpretation" && (
                    <g>
                      {/* Grid representation with rippling physical elements (analogous to predictions) */}
                      {interpretationSensors.map((sensor, sIdx) => {
                        // Create a ripple based on simple math and sensors
                        const waveVal = Math.sin((sensor.row * 1.5 + sensor.col * 2.1 + (avgElectrodeTemp / 40)) * 1.0);
                        const isHotChannel = avgElectrodeTemp >= 310.0 && sIdx % 5 === 0;
                        const circleColor = isHotChannel ? "#ef4444" : "#c084fc";
                        const sizeMultiplier = waveVal > 0.4 ? 4 : 2;

                        return (
                          <g key={`sensor-${sIdx}`} opacity={waveVal > -0.3 ? 0.8 : 0.3}>
                            <circle
                              cx={sensor.screenX}
                              cy={sensor.screenY}
                              r={sizeMultiplier}
                              fill={circleColor}
                              filter={(isHotChannel || waveVal > 0.8) ? "url(#glow3d)" : "none"}
                            />
                            {waveVal > 0.8 && (
                              <circle
                                cx={sensor.screenX}
                                cy={sensor.screenY}
                                r={sizeMultiplier + 5}
                                fill="none"
                                stroke={circleColor}
                                strokeWidth="0.5"
                                opacity="0.4"
                              />
                            )}
                          </g>
                        );
                      })}
                      {/* Central core telemetry representative tag */}
                      <g fontFamily="monospace" fontSize="8" fill="#a78bfa">
                        <text x={interpretationCenter.x} y={interpretationCenter.y - 12} textAnchor="middle">
                          T_Est: {avgElectrodeTemp.toFixed(1)}K (Taylor Q16)
                        </text>
                      </g>
                    </g>
                  )}

                  {/* CAUSAL STATE MACHINE LEVEL (Altitude: 1) */}
                  {plane.id === "causal" && (
                    <g>
                      {/* Directed state machine pathway connections */}
                      {causalNodesMapped.map((fromNode) => {
                        return causalNodesMapped.map((toNode) => {
                          const isNormalTransition =
                            (fromNode.state === HexagramState.IDLE && toNode.state === HexagramState.STEALTH) ||
                            (fromNode.state === HexagramState.STEALTH && toNode.state === HexagramState.TRANSIT) ||
                            (fromNode.state === HexagramState.TRANSIT && toNode.state === HexagramState.TR_SALT) ||
                            (fromNode.state === HexagramState.TR_SALT && toNode.state === HexagramState.TR_CRIT) ||
                            (fromNode.state === HexagramState.TR_CRIT && toNode.state === HexagramState.LIMP_MODE) ||
                            (fromNode.state === HexagramState.STEALTH && toNode.state === HexagramState.ST_CRIT) ||
                            (fromNode.state === HexagramState.ST_CRIT && toNode.state === HexagramState.LIMP_MODE) ||
                            (fromNode.state === HexagramState.LIMP_MODE && toNode.state === HexagramState.IDLE);

                          if (!isNormalTransition) return null;

                          // Transition is valid. Draw connection wire.
                          const isActiveRoute = fromNode.state === currentHexagram;
                          const isPerfectTransitionMatch = fromNode.state === currentHexagram && toNode.state === currentHexagram;

                          return (
                            <line
                              key={`transition-wire-${fromNode.name}-${toNode.name}`}
                              x1={fromNode.screenX} y1={fromNode.screenY}
                              x2={toNode.screenX} y2={toNode.screenY}
                              stroke={isActiveRoute ? "#22d3ee" : "#334155"}
                              strokeWidth={isActiveRoute ? "2" : "0.7"}
                              strokeDasharray={isActiveRoute ? "none" : "2,3"}
                              opacity={isActiveRoute ? 0.8 : 0.25}
                            />
                          );
                        });
                      })}

                      {/* Render individual states circles */}
                      {causalNodesMapped.map((node) => {
                        const isActive = node.state === currentHexagram;
                        const nodeColor = isActive ? "#22d3ee" : "#1e293b";
                        const strokeColor = isActive ? "#22d3ee" : "#475569";
                        const sizeScalar = isActive ? 8 : 4.5;

                        return (
                          <g key={`state-node-${node.name}`}>
                            <circle
                              cx={node.screenX}
                              cy={node.screenY}
                              r={sizeScalar}
                              fill={nodeColor}
                              stroke={strokeColor}
                              strokeWidth="1.5"
                              filter={isActive ? "url(#glow3d)" : "none"}
                              opacity="0.9"
                            />
                            {isActive && (
                              <circle
                                cx={node.screenX}
                                cy={node.screenY}
                                r={sizeScalar + 6}
                                fill="none"
                                stroke="#22d3ee"
                                strokeWidth="0.8"
                                className="animate-pulse"
                                opacity="0.6"
                              />
                            )}

                            {/* Label showing active node states */}
                            {isActive && (
                              <g fontFamily="monospace" fontSize="8" fill="#e2e8f0" fontWeight="bold">
                                <text x={node.screenX} y={node.screenY - 14} textAnchor="middle">
                                  {node.name}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* EXECUTION HARDWARE LEVEL (Altitude: 0) */}
                  {plane.id === "execution" && (
                    <g>
                      {/* Flow wires tying physical contactor nodes */}
                      <path
                        d={`M ${contactorNodesMapped[0]?.screenX || 0} ${contactorNodesMapped[0]?.screenY || 0} L ${contactorNodesMapped[9]?.screenX || 0} ${contactorNodesMapped[9]?.screenY || 0}`}
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="1"
                        opacity="0.25"
                      />

                      {/* Hardware relays indicator lights */}
                      {contactorNodesMapped.map((node) => {
                        // CT Segment Status color coding
                        let colorHex = "#475569"; // CT_OPEN (idle grey)
                        let glowFilter = "none";
                        let ringPulse = false;

                        if (node.state === ContactorState.CT_CLOSED) {
                          colorHex = "#10b981"; // Active working GREEN
                          glowFilter = "url(#glow3d)";
                        } else if (node.state === ContactorState.CT_CLOSING || node.state === ContactorState.CT_OPENING) {
                          colorHex = "#fbbf24"; // Dynamic yellowish amber transposition pulse
                          ringPulse = true;
                        } else if (node.state === ContactorState.CT_FAULT) {
                          colorHex = "#f87171"; // RED FAULT BLINK
                          glowFilter = "url(#glow3d)";
                          ringPulse = true;
                        }

                        return (
                          <g key={`contactor-rel-${node.id}`}>
                            <circle
                              cx={node.screenX}
                              cy={node.screenY}
                              r="5"
                              fill={colorHex}
                              stroke="#0f172a"
                              strokeWidth="1.2"
                              filter={glowFilter}
                              opacity="0.9"
                            />
                            
                            {ringPulse && (
                              <circle
                                cx={node.screenX}
                                cy={node.screenY}
                                r="10"
                                fill="none"
                                stroke={colorHex}
                                strokeWidth="0.5"
                                className="animate-ping"
                                opacity="0.5"
                              />
                            )}

                            {/* CT labels */}
                            {node.id === 0 || node.id === 9 ? (
                              <text
                                x={node.screenX}
                                y={node.screenY + 14}
                                fontFamily="monospace"
                                fontSize="7"
                                fill="#64748b"
                                textAnchor="middle"
                              >
                                CT{node.id}
                              </text>
                            ) : null}
                          </g>
                        );
                      })}
                      {/* Active indicator description bottom text */}
                      <g fontFamily="monospace" fontSize="8" fill="#34d399">
                        <text x={executionCenter.x} y={executionCenter.y - 12} textAnchor="middle">
                          Rectifiers: {safetyOk ? "EMERGENCY_CONNECTED" : "DECOUPLED_SAFE"}
                        </text>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Sizing, Height and Rotation sliders */}
          <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 border border-slate-800 p-3 rounded flex flex-wrap items-center gap-4 text-[10px] font-mono leading-none shadow-md">
            <div className="flex-1 min-w-[120px] flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-450 uppercase whitespace-nowrap">YAW:</span>
              <input
                type="range"
                min="-180"
                max="180"
                value={yaw}
                onChange={(e) => {
                  setYaw(parseInt(e.target.value));
                  setAutoRotate(false); // disable autorotate on manual input
                }}
                className="w-full accent-cyan-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex-1 min-w-[120px] flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 text-slate-500 rotate-90" />
              <span className="text-slate-450 uppercase whitespace-nowrap">PITCH:</span>
              <input
                type="range"
                min="15"
                max="75"
                value={pitch}
                onChange={(e) => setPitch(parseInt(e.target.value))}
                className="w-full accent-cyan-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex-1 min-w-[120px] flex items-center gap-2">
              <ArrowDownUp className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-450 uppercase whitespace-nowrap">HEIGHT:</span>
              <input
                type="range"
                min="70"
                max="160"
                value={spacing}
                onChange={(e) => setSpacing(parseInt(e.target.value))}
                className="w-full accent-cyan-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setYaw(-35);
                  setPitch(40);
                  setSpacing(110);
                  setZoom(1.0);
                  setAutoRotate(false);
                }}
                className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded hover:text-white transition cursor-pointer"
                title="Reset standard camera isometric coordinates parameters"
              >
                Reset HUD
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right side information monitor list panel */}
      <div className="w-full xl:w-72 bg-slate-950/40 border border-slate-850 p-4 rounded-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400 font-bold mb-3 select-none">
            <Network className="h-4 w-4" />
            <span>CROSS-TIER STATE MONITOR</span>
          </div>

          <p className="text-[11px] text-slate-400 font-sans leading-relaxed mb-4">
            Witness how changes flow causally between different hardware registers. Toggle AXI4 overrides or manipulate input parameters on outer panels to watch signals propagate.
          </p>

          {/* Vertical step-by-step description mapping */}
          <div className="space-y-3.5 mb-5 select-none text-[10.5px]">
            <div className="flex gap-2.5 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 filter drop-shadow-[0_0_3px_#f59e0b]" />
              <div>
                <span className="font-mono text-slate-200 block font-bold leading-tight uppercase">
                  [0x0C] POLICY REG
                </span>
                <span className="text-slate-500 block font-mono text-[9px] mt-0.5">
                  AI Autopilot status: <strong className={isAiActive ? "text-amber-400" : "text-slate-500"}>{isAiActive ? "ENGAGED" : "MANUAL_WRITE"}</strong>
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 items-start border-l border-slate-800 ml-0.75 pb-2 pl-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1 filter drop-shadow-[0_0_3px_#a78bfa]" />
              <div>
                <span className="font-mono text-slate-200 block font-bold leading-tight uppercase">
                  [0x80] INTERPRETATION
                </span>
                <span className="text-slate-500 block font-mono text-[9px] mt-0.5">
                  GhostSplat Field Prediction T_Est = {avgElectrodeTemp.toFixed(1)}K, {activeFaultCodes.length} active anomalies.
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 items-start border-l border-slate-800 ml-0.75 pb-2 pl-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1 filter drop-shadow-[0_0_3px_#22d3ee]" />
              <div>
                <span className="font-mono text-slate-200 block font-bold leading-tight uppercase">
                  [0x10] CAUSAL STATE
                </span>
                <span className="text-slate-500 block font-mono text-[9px] mt-0.5">
                  Current Hexagram State machine: <strong className="text-cyan-400">{HexagramStateLabels[currentHexagram].split(" (")[0]}</strong>
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 filter drop-shadow-[0_0_3px_#34d399]" />
              <div>
                <span className="font-mono text-slate-200 block font-bold leading-tight uppercase">
                  [0x44] EXECUTION PHYSICAL
                </span>
                <span className="text-slate-500 block font-mono text-[9px] mt-0.5">
                  Power distribution: <strong className="text-emerald-400">{busCurrentA.toFixed(0)}A</strong> through 10-ch electromagnetic relays.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time cross plane activity logs */}
        <div className="border-t border-slate-850 pt-3">
          <div className="text-[9px] font-mono text-slate-500 font-bold uppercase tracking-wider mb-2 select-none">
            CAUSAL TRANSACTION FEED
          </div>
          <div className="space-y-1.5 bg-slate-950/60 border border-slate-900 rounded p-2.5 font-mono text-[8.5px] leading-relaxed max-h-[145px] overflow-y-auto select-none">
            {transitionPackets.length === 0 ? (
              <span className="text-slate-600 block italic">Standby... Monitoring AXI4-Lite transaction registers...</span>
            ) : (
              transitionPackets.map((log) => {
                const subColorClass =
                  log.level === "CRITICAL" ? "text-red-400" :
                  log.level === "WARNING" ? "text-amber-400" :
                  log.level === "SUCCESS" ? "text-emerald-400" : "text-slate-450";

                return (
                  <div key={log.id} className="border-b border-slate-900/50 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex justify-between text-slate-550 mb-0.5">
                      <span>[{log.subsystem}]</span>
                      <span>{log.timestamp}</span>
                    </div>
                    <span className={`${subColorClass} block`}>{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
