/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Award,
  Zap,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Binary,
  Layers,
  Sparkles,
  Compass
} from "lucide-react";

// Absolute RS3 coordinates mapped to local 0..65 grid
// World: X (3200..3265), Z (3200..3265)
const REGION_START_X = 3200;
const REGION_START_Y = 3200;
const GRID_SIZE = 66;

interface MapEntity {
  id: string;
  name: string;
  type: "npc" | "object";
  absX: number;
  absY: number;
  wikiUrl?: string;
}

// Embedded Lumbridge Map square Plane 0 dataset
const LUMBRIDGE_ENTITIES: MapEntity[] = [
  { id: "npc_hans", name: "Hans", type: "npc", absX: 3222, absY: 3218, wikiUrl: "https://runescape.wiki/w/Hans" },
  { id: "npc_ father_aereck", name: "Father Aereck", type: "npc", absX: 3244, absY: 3208, wikiUrl: "https://runescape.wiki/w/Father_Aereck" },
  { id: "obj_range", name: "Cooking range", type: "object", absX: 3211, absY: 3214, wikiUrl: "https://runescape.wiki/w/Cooking_range" },
  { id: "obj_spinning", name: "Spinning wheel", type: "object", absX: 3208, absY: 3211, wikiUrl: "https://runescape.wiki/w/Spinning_wheel" },
  { id: "obj_deposit", name: "Bank deposit box", type: "object", absX: 3209, absY: 3215, wikiUrl: "https://runescape.wiki/w/Bank_deposit_box" },
  { id: "obj_fountain_1", name: "Fountain North", type: "object", absX: 3220, absY: 3225, wikiUrl: "https://runescape.wiki/w/Fountain" },
  { id: "obj_fountain_2", name: "Fountain South", type: "object", absX: 3220, absY: 3209, wikiUrl: "https://runescape.wiki/w/Fountain" },
  { id: "obj_grave_1", name: "Gravestone (Aereck's Kin)", type: "object", absX: 3240, absY: 3201, wikiUrl: "https://runescape.wiki/w/Gravestone" },
  { id: "obj_grave_2", name: "Gravestone", type: "object", absX: 3238, absY: 3201, wikiUrl: "https://runescape.wiki/w/Gravestone" },
  { id: "obj_grave_3", name: "Gravestone", type: "object", absX: 3242, absY: 3201, wikiUrl: "https://runescape.wiki/w/Gravestone" },
  { id: "obj_grave_4", name: "Gravestone", type: "object", absX: 3245, absY: 3199, wikiUrl: "https://runescape.wiki/w/Gravestone" },
  { id: "obj_grave_5", name: "Gravestone", type: "object", absX: 3244, absY: 3201, wikiUrl: "https://runescape.wiki/w/Gravestone" },
  { id: "obj_grave_6", name: "Gravestone", type: "object", absX: 3246, absY: 3201, wikiUrl: "https://runescape.wiki/w/Gravestone" },
  { id: "obj_anvil", name: "Keldagrim Anvil", type: "object", absX: 3228, absY: 3253, wikiUrl: "https://runescape.wiki/w/Anvil" },
  { id: "obj_furnace", name: "Dwarven Furnace", type: "object", absX: 3225, absY: 3255, wikiUrl: "https://runescape.wiki/w/Furnace" },
  { id: "obj_church_door", name: "Church double door", type: "object", absX: 3238, absY: 3209, wikiUrl: "https://runescape.wiki/w/Church_door" },
];

export default function GhostSplatVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simulation Controls & Modes
  const [isLive, setIsLive] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showSafespots, setShowSafespots] = useState<boolean>(true);
  const [tickDepth, setTickDepth] = useState<number>(104);

  // Entities state
  const [playerPosition, setPlayerPosition] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [playerPath, setPlayerPath] = useState<Array<{ x: number; y: number }>>([]);
  const [playerTrail, setPlayerTrail] = useState<Array<{ x: number; y: number }>>([
    { x: 30, y: 30 }, { x: 29, y: 30 }, { x: 28, y: 31 }, { x: 28, y: 32 }
  ]);

  // Dynamic NPCs with their paths or patrol vectors
  const [npcs, setNpcs] = useState<Array<{
    id: string;
    name: string;
    x: number; // Local coordinate matches 0..65
    y: number;
    color: string;
    patrolType: "rect" | "random" | "church";
    radius: number;
  }>>([
    { id: "hans", name: "Hans", x: 22, y: 18, color: "#fb7185", patrolType: "rect", radius: 1.5 },
    { id: "aereck", name: "Father Aereck", x: 44, y: 8, color: "#facc15", patrolType: "church", radius: 2.2 },
    { id: "rabbit", name: "Canyon Rabbit", x: 10, y: 48, color: "#34d399", patrolType: "random", radius: 1.0 },
    { id: "specter", name: "Shadow Specter", x: 50, y: 45, color: "#a855f7", patrolType: "random", radius: 2.8 },
  ]);

  const [heatmap, setHeatmap] = useState<Float32Array>(new Float32Array(GRID_SIZE * GRID_SIZE));
  const [safespotsList, setSafespotsList] = useState<Array<{ x: number; y: number; confidence: number }>>([]);
  const [focusCoord, setFocusCoord] = useState<{ x: number; y: number } | null>(null);

  // Diagnostics & Sidebar States
  const [kernelDiagnostics, setKernelDiagnostics] = useState({
    phase: "STABLE",
    multiplier: 1.00,
    volatility: 0.015,
    stability: 0.985,
    accuracy: 0.984,
    transitions: 4
  });

  const [movingLines, setMovingLines] = useState<Array<{
    position: number;
    fromState: string;
    toState: string;
    source: string;
  }>>([
    { position: 2, fromState: "YIN", toState: "YANG", source: "thermal" },
    { position: 5, fromState: "YANG", toState: "YIN", source: "fluid_reg" }
  ]);

  const [decisionTimeline, setDecisionTimeline] = useState<string[]>(
    Array(20).fill("").map(() => (Math.random() > 0.35 ? "COMMIT" : Math.random() > 0.5 ? "PREPARE" : "WAIT"))
  );
  const [abilityQueue, setAbilityQueue] = useState<Array<{ actionType: string; confidence: number }>>([
    { actionType: "Evasion Surge", confidence: 0.92 },
    { actionType: "Aegis Shelter", confidence: 0.81 }
  ]);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>(
    Array(30).fill(0).map(() => 0.85 + Math.random() * 0.14)
  );

  // Fixed static obstacle cells simulating walls/scenery
  const blockedTilesRef = useRef<Set<string>>(new Set());
  if (blockedTilesRef.current.size === 0) {
    // Add border blocks
    for (let i = 0; i < 66; i++) {
      blockedTilesRef.current.add(`0_${i}`);
      blockedTilesRef.current.add(`65_${i}`);
      blockedTilesRef.current.add(`${i}_0`);
      blockedTilesRef.current.add(`${i}_65`);
    }
    // Add Lumbridge Castle walls preset lines
    for (let y = 14; y <= 24; y++) {
      blockedTilesRef.current.add(`12_${y}`);
      blockedTilesRef.current.add(`25_${y}`);
    }
    for (let x = 12; x <= 25; x++) {
      if (x !== 18) { // door
        blockedTilesRef.current.add(`${x}_14`);
        blockedTilesRef.current.add(`${x}_24`);
      }
    }
  }

  // Handle Canvas Grid Clicks (Move player to coordinate)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const cellSize = canvas.width / GRID_SIZE;
    const clickedX = Math.floor(mx / cellSize);
    const clickedY = GRID_SIZE - 1 - Math.floor(my / cellSize);

    if (clickedX > 0 && clickedX < 65 && clickedY > 0 && clickedY < 65) {
      if (!blockedTilesRef.current.has(`${clickedX}_${clickedY}`)) {
        // Set path
        setPlayerPath([{ x: clickedX, y: clickedY }]);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const cellSize = canvas.width / GRID_SIZE;
    const hoverX = Math.floor(mx / cellSize);
    const hoverY = GRID_SIZE - 1 - Math.floor(my / cellSize);

    if (hoverX >= 0 && hoverX < GRID_SIZE && hoverY >= 0 && hoverY < GRID_SIZE) {
      setFocusCoord({ x: hoverX, y: hoverY });
    } else {
      setFocusCoord(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setFocusCoord(null);
  };

  // Helper static lookup for entities
  const getEntityAt = (x: number, y: number) => {
    const absX = x + REGION_START_X;
    const absY = y + REGION_START_Y;
    return LUMBRIDGE_ENTITIES.find(e => e.absX === absX && e.absY === absY);
  };

  // Resets the simulator
  const resetSimulator = () => {
    setPlayerPosition({ x: 30, y: 30 });
    setPlayerPath([]);
    setPlayerTrail([{ x: 30, y: 30 }]);
    setTickDepth(100);
    setNpcs([
      { id: "hans", name: "Hans", x: 22, y: 18, color: "#fb7185", patrolType: "rect", radius: 1.5 },
      { id: "aereck", name: "Father Aereck", x: 44, y: 8, color: "#facc15", patrolType: "church", radius: 2.2 },
      { id: "rabbit", name: "Canyon Rabbit", x: 10, y: 48, color: "#34d399", patrolType: "random", radius: 1.0 },
      { id: "specter", name: "Shadow Specter", x: 50, y: 45, color: "#a855f7", patrolType: "random", radius: 2.8 },
    ]);
  };

  // Dynamic simulation tick loop
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setTickDepth(prev => prev + 1);

      // 1. Move NPCs safely inside grid
      setNpcs(prevNpcs => {
        return prevNpcs.map(npc => {
          let nx = npc.x;
          let ny = npc.y;

          if (npc.patrolType === "rect") {
            // Square path patrol for Hans
            const tickFactor = Math.floor(Date.now() / 1500) % 4;
            if (tickFactor === 0) nx += 1;
            else if (tickFactor === 1) ny += 1;
            else if (tickFactor === 2) nx -= 1;
            else ny -= 1;
          } else if (npc.patrolType === "church") {
            // Smaller circular walk near church grounds
            const angle = (Date.now() / 4000) % (2 * Math.PI);
            nx = Math.round(44 + Math.cos(angle) * 6);
            ny = Math.round(8 + Math.sin(angle) * 5);
          } else {
            // Random jitter walk
            const dx = Math.floor(Math.random() * 3) - 1;
            const dy = Math.floor(Math.random() * 3) - 1;
            const newX = nx + dx;
            const newY = ny + dy;
            if (
              newX > 1 && newX < 64 && newY > 1 && newY < 64 &&
              !blockedTilesRef.current.has(`${newX}_${newY}`)
            ) {
              nx = newX;
              ny = newY;
            }
          }

          return { ...npc, x: nx, y: ny };
        });
      });

      // 2. Move Player toward clicked destination step-by-step
      setPlayerPosition(currPlayer => {
        if (playerPath.length > 0) {
          const target = playerPath[0];
          let dx = Math.sign(target.x - currPlayer.x);
          let dy = Math.sign(target.y - currPlayer.y);

          const stepX = currPlayer.x + dx;
          const stepY = currPlayer.y + dy;

          if (stepX === target.x && stepY === target.y) {
            setPlayerPath([]);
          }

          const nextPos = { x: stepX, y: stepY };

          // Maintain Trail history
          setPlayerTrail(trailHistory => {
            const nextTrail = [nextPos, ...trailHistory];
            if (nextTrail.length > 20) {
              nextTrail.pop();
            }
            return nextTrail;
          });

          return nextPos;
        }
        return currPlayer;
      });

    }, 800);

    return () => clearInterval(interval);
  }, [isLive, playerPath]);

  // Recalculate threat Heatmap and Safespots depending on positions
  useEffect(() => {
    // Generate new Heatmap
    const newHeatmap = new Float32Array(GRID_SIZE * GRID_SIZE);

    npcs.forEach(npc => {
      const { x: cx, y: cy, radius } = npc;
      // High-precision Gaussian spread
      for (let y = Math.max(0, cy - 10); y <= Math.min(65, cy + 10); y++) {
        for (let x = Math.max(0, cx - 10); x <= Math.min(65, cx + 10); x++) {
          const dx = x - cx;
          const dy = y - cy;
          const distSq = dx * dx + dy * dy;
          const intensity = Math.exp(-distSq / (2 * radius * radius)) * 12.0;
          const idx = y * GRID_SIZE + x;
          newHeatmap[idx] = Math.min(15.0, newHeatmap[idx] + intensity);
        }
      }
    });

    // Add border values as light threat
    for (let i = 0; i < 66; i++) {
      newHeatmap[i] = Math.max(newHeatmap[i], 3.0);
      newHeatmap[65 * GRID_SIZE + i] = Math.max(newHeatmap[65 * GRID_SIZE + i], 3.0);
      newHeatmap[i * GRID_SIZE] = Math.max(newHeatmap[i * GRID_SIZE], 3.0);
      newHeatmap[i * GRID_SIZE + 65] = Math.max(newHeatmap[i * GRID_SIZE + 65], 3.0);
    }

    setHeatmap(newHeatmap);

    // Identify dynamic clean safespots near the player
    const safespots: Array<{ x: number; y: number; confidence: number }> = [];
    const radiusScan = 5;
    for (let dy = -radiusScan; dy <= radiusScan; dy++) {
      for (let dx = -radiusScan; dx <= radiusScan; dx++) {
        const sx = playerPosition.x + dx;
        const sy = playerPosition.y + dy;
        if (sx > 1 && sx < 64 && sy > 1 && sy < 64) {
          const idx = sy * GRID_SIZE + sx;
          const isWalkable = !blockedTilesRef.current.has(`${sx}_${sy}`);
          const heatVal = newHeatmap[idx];

          if (isWalkable && heatVal < 0.1 && (dx !== 0 || dy !== 0)) {
            // Local minima is walkable and completely safe
            safespots.push({
              x: sx,
              y: sy,
              confidence: 0.9 + Math.exp(-(dx * dx + dy * dy) / 25) * 0.1
            });
          }
        }
      }
    }

    const trimmedSafes = safespots.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
    setSafespotsList(trimmedSafes);

    // Calculate real-time HIL/FPGA telemetry depending on danger level
    const playerHeatIdx = playerPosition.y * GRID_SIZE + playerPosition.x;
    const playerHeat = newHeatmap[playerHeatIdx];

    const currentDiagnosticsPhase = playerHeat > 6.0
      ? "DEGRADING"
      : playerHeat > 1.0
      ? "FALSE_STABILITY"
      : "STABLE";

    const vol = currentDiagnosticsPhase === "DEGRADING" ? 0.320 + Math.random() * 0.1 : 0.012 + Math.random() * 0.02;
    const stab = currentDiagnosticsPhase === "STABLE" ? 0.985 + Math.random() * 0.01 : 0.450 + Math.random() * 0.1;
    const acc = currentDiagnosticsPhase === "STABLE" ? 0.984 + Math.random() * 0.014 : 0.810 + Math.random() * 0.05;

    setKernelDiagnostics(d => ({
      phase: currentDiagnosticsPhase,
      multiplier: currentDiagnosticsPhase === "DEGRADING" ? 1.50 : currentDiagnosticsPhase === "FALSE_STABILITY" ? 1.15 : 1.00,
      volatility: vol,
      stability: stab,
      accuracy: acc,
      transitions: currentDiagnosticsPhase !== d.phase ? d.transitions + 1 : d.transitions
    }));

    // Update Decision timeline queue
    setDecisionTimeline(prev => {
      const nextDecision = currentDiagnosticsPhase === "STABLE" ? "COMMIT" : currentDiagnosticsPhase === "DEGRADING" ? "WAIT" : "PREPARE";
      const copy = [nextDecision, ...prev];
      if (copy.length > 20) copy.pop();
      return copy;
    });

    setConfidenceHistory(prev => {
      const nextConf = acc;
      const copy = [nextConf, ...prev];
      if (copy.length > 30) copy.pop();
      return copy;
    });

    // Update active ability queues based on phase status
    setAbilityQueue(() => {
      if (currentDiagnosticsPhase === "DEGRADING") {
        return [
          { actionType: "Evasion Surge", confidence: acc },
          { actionType: "Aegis Shelter", confidence: acc * 0.85 },
          { actionType: "Escape Conduit", confidence: acc * 0.70 }
        ];
      }
      return [
        { actionType: "Evasion Surge", confidence: acc },
        { actionType: "Aegis Shelter", confidence: acc * 0.91 }
      ];
    });

    // Generate changing lines status based on phase transition
    if (currentDiagnosticsPhase === "DEGRADING") {
      setMovingLines([
        { position: 2, fromState: "YIN", toState: "YANG", source: "volatility" },
        { position: 3, fromState: "YANG", toState: "YIN", source: "heat_overload" },
        { position: 5, fromState: "YANG", toState: "YIN", source: "displacement" }
      ]);
    } else if (currentDiagnosticsPhase === "FALSE_STABILITY") {
      setMovingLines([
        { position: 3, fromState: "YIN", toState: "YANG", source: "clutter_drift" },
        { position: 5, fromState: "YANG", toState: "YIN", source: "buffer_shift" }
      ]);
    } else {
      setMovingLines([
        { position: 2, fromState: "YIN", toState: "YANG", source: "thermal" },
        { position: 5, fromState: "YANG", toState: "YIN", source: "fluid_reg" }
      ]);
    }

  }, [playerPosition, npcs]);

  // Main Canvas Drawing hook
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear with fully ambient off-black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw blocked walls boundary preset
    ctx.fillStyle = "#1e1e2f";
    blockedTilesRef.current.forEach((key) => {
      const [xStr, yStr] = key.split("_");
      const bx = parseInt(xStr);
      const by = parseInt(yStr);
      // Flip Y in drawing
      ctx.fillRect(bx * cellSize, (GRID_SIZE - 1 - by) * cellSize, cellSize, cellSize);
      ctx.strokeStyle = "#2e2e42";
      ctx.strokeRect(bx * cellSize, (GRID_SIZE - 1 - by) * cellSize, cellSize, cellSize);
    });

    // 2. Draw Threat Heatmap overlay if enabled
    if (showHeatmap) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const idx = y * GRID_SIZE + x;
          const heatVal = heatmap[idx];
          if (heatVal > 0.05) {
            const intensity = Math.min(1.0, heatVal / 10.0);
            ctx.fillStyle = `rgba(239, 68, 68, ${intensity * 0.48})`;
            ctx.fillRect(x * cellSize, (GRID_SIZE - 1 - y) * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    // 3. Draw Tactical Safespots if enabled
    if (showSafespots) {
      safespotsList.forEach((spot) => {
        ctx.save();
        const ax = (spot.x + 0.5) * cellSize;
        const ay = (GRID_SIZE - 1 - spot.y + 0.5) * cellSize;

        ctx.fillStyle = "rgba(81, 255, 157, 0.22)";
        ctx.beginPath();
        ctx.arc(ax, ay, cellSize * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#51ff9d";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(ax, ay, cellSize * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }

    // 4. Draw static real map square objects list inside the viewport (under coordinate bounds)
    LUMBRIDGE_ENTITIES.forEach(ent => {
      const localX = ent.absX - REGION_START_X;
      const localY = ent.absY - REGION_START_Y;

      if (localX >= 0 && localX < GRID_SIZE && localY >= 0 && localY < GRID_SIZE) {
        ctx.save();
        const ox = (localX + 0.5) * cellSize;
        const oy = (GRID_SIZE - 1 - localY + 0.5) * cellSize;

        ctx.fillStyle = ent.type === "object" ? "rgba(100, 116, 139, 0.75)" : "transparent";
        ctx.fillRect(localX * cellSize + 1.5, (GRID_SIZE - 1 - localY) * cellSize + 1.5, cellSize - 3, cellSize - 3);

        ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(localX * cellSize + 1.5, (GRID_SIZE - 1 - localY) * cellSize + 1.5, cellSize - 3, cellSize - 3);
        ctx.restore();
      }
    });

    // 5. Draw Player historic dashed trail first
    if (playerTrail.length > 1) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(81, 255, 255, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      playerTrail.forEach((pos, trailIdx) => {
        const hx = (pos.x + 0.5) * cellSize;
        const hy = (GRID_SIZE - 1 - pos.y + 0.5) * cellSize;
        if (trailIdx === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Player Ghost dot
    const pxX = (playerPosition.x + 0.5) * cellSize;
    const pxY = (GRID_SIZE - 1 - playerPosition.y + 0.5) * cellSize;
    ctx.save();
    ctx.fillStyle = "#51ffff";
    ctx.shadowColor = "#51ffff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(pxX, pxY, cellSize * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(pxX, pxY, cellSize * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 7. Draw NPC Projections with their elevated selection ring
    npcs.forEach(npc => {
      const nx = (npc.x + 0.5) * cellSize;
      const ny = (GRID_SIZE - 1 - npc.y + 0.5) * cellSize;

      ctx.save();
      // Outer ring: dark red elevated shadow offset
      ctx.strokeStyle = "rgba(139, 0, 0, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(nx - cellSize * 0.9, ny - cellSize * 0.9, cellSize * 1.8, cellSize * 1.8);

      // Inner ring: bright glowing red Precise boundary
      ctx.strokeStyle = "#ff4d4d";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(nx - cellSize * 0.8, ny - cellSize * 0.8, cellSize * 1.6, cellSize * 1.8 - 2);

      // Above ground glow
      ctx.shadowColor = "rgba(255, 77, 77, 0.48)";
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = -2;
      ctx.strokeRect(nx - cellSize * 0.8, ny - cellSize * 0.8, cellSize * 1.6, cellSize * 1.6);
      ctx.shadowColor = "transparent";

      // Corner Accents ("+" cross feel)
      ctx.fillStyle = "#ff6565";
      const cornerSize = 4;
      const left = nx - cellSize * 0.8;
      const top = ny - cellSize * 0.8;
      const width = cellSize * 1.6;
      const height = cellSize * 1.6;

      ctx.fillRect(left, top, cornerSize, 1.5);
      ctx.fillRect(left, top, 1.5, cornerSize);

      ctx.fillRect(left + width - cornerSize, top, cornerSize, 1.5);
      ctx.fillRect(left + width - 1.5, top, 1.5, cornerSize);

      ctx.fillRect(left, top + height - 1.5, cornerSize, 1.5);
      ctx.fillRect(left, top + height - cornerSize, 1.5, cornerSize);

      ctx.fillRect(left + width - cornerSize, top + height - 1.5, cornerSize, 1.5);
      ctx.fillRect(left + width - 1.5, top + height - cornerSize, 1.5, cornerSize);

      // Draw NPC dot center
      ctx.fillStyle = npc.color;
      ctx.beginPath();
      ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Label name splits
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 3;
      ctx.fillText(npc.name, nx - npc.name.length * 2, ny - cellSize * 1.1);

      ctx.restore();
    });

    // 8. Draw Grid Lines
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }
    ctx.restore();

  }, [heatmap, safespotsList, playerPosition, npcs, showHeatmap, showSafespots]);

  // Sparkline generator SVG helper
  const drawSparkline = () => {
    if (confidenceHistory.length === 0) return null;
    const width = 160;
    const height = 30;
    const padding = 2;
    const step = width / (confidenceHistory.length - 1);

    const min = Math.min(...confidenceHistory);
    const max = Math.max(...confidenceHistory);
    const range = max - min === 0 ? 1 : max - min;

    const points = confidenceHistory.map((val, idx) => {
      const cx = idx * step;
      const cy = height - padding - ((val - min) / range) * (height - 2 * padding);
      return `${cx},${cy}`;
    }).join(" ");

    return (
      <svg className="w-full h-full block" viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke="#51ffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  // Resolve focused coordinate string details
  const getFocusDetails = () => {
    if (!focusCoord) return "CURSOR COORDS: —";
    const absoluteX = focusCoord.x + REGION_START_X;
    const absoluteY = focusCoord.y + REGION_START_Y;
    const localVal = `${focusCoord.x}, ${focusCoord.y}`;
    const absoluteVal = `${absoluteX}, ${absoluteY}`;

    let details = `[ABS]: [${absoluteVal}] / [LOCAL]: [${localVal}]`;

    // Find any scenery object or NPC at coordinates
    const scenery = getEntityAt(focusCoord.x, focusCoord.y);
    if (scenery) {
      details += ` ➔ FOUND: ${scenery.name.toUpperCase()} (${scenery.type.toUpperCase()})`;
    }

    const heatVal = heatmap[focusCoord.y * GRID_SIZE + focusCoord.x];
    details += ` | THREAT HEAT: ${heatVal.toFixed(1)} kW/s`;

    return details;
  };

  return (
    <div className="space-y-5 text-left font-sans animate-fade-in text-slate-300">
      {/* Visualizer header */}
      <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-lg flex flex-col md:flex-row justify-between gap-4 shadow-lg select-none">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-slate-900/80 border border-slate-800 text-teal-400 rounded-lg shadow-inner">
            <Compass className="h-6 w-6 animate-spin" style={{ animationDuration: "12s" }} />
          </div>
          <div>
            <h4 className="font-display font-medium text-sm text-slate-100 tracking-wider uppercase mb-1 flex items-center gap-1.5">
              GHOSTSPLAT VISUALIZATION PLATFORM
              <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-900/60 px-1.5 py-0.2 rounded font-mono font-bold">PREDICTIVE SPATIAL INTEL</span>
            </h4>
            <p className="text-slate-400 text-[11px] leading-relaxed max-w-2xl font-mono leading-relaxed">
              Provides real-time spatial projection profiles of Lumbridge (Plane 0) NXT map square. Simulates Taylor series path convergence multipliers, boundary safety zones, and transitional Yao topological indicators.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] shrink-0 self-center">
          <span className="bg-slate-920 text-slate-400 border border-slate-800 px-2.5 py-1 rounded-md">
            WORLD FRAME: <strong className="text-cyan-400">[3200..3265, 3200..3265]</strong>
          </span>
          <span className={`bg-slate-920 border border-slate-800 px-2.5 py-1 rounded-md ${isLive ? "text-cyan-400 animate-pulse" : "text-slate-400"}`}>
            SIM SPEED: <strong className={isLive ? "text-emerald-400" : "text-slate-400"}>{isLive ? "LIVE STREAM" : "PAUSED"}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Playable Canvas and Basic Controls column */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="relative bg-slate-950 border border-slate-850 p-2.5 rounded-xl shadow-xl shadow-black/80 max-w-full">
            <canvas
              ref={canvasRef}
              width={528}
              height={528}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              className="block rounded-lg cursor-crosshair max-w-full bg-black shadow-inner"
            />

            {/* Quick interactive controls panel inside canvas column */}
            <div className="mt-3 flex flex-wrap gap-2 justify-between items-center select-none font-mono">
              <div className="flex gap-1.5">
                <button
                  onClick={resetSimulator}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded text-[10px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  title="Reset positions"
                >
                  <RotateCcw className="h-3 w-3 text-slate-400" />
                  Reset
                </button>
                <button
                  onClick={() => setIsLive(!isLive)}
                  className={`border px-3 py-1.5 rounded text-[10px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    isLive
                      ? "bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-950/60"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {isLive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isLive ? "Live: ON" : "Live: PAUSED"}
                </button>
              </div>

              <div className="flex gap-2 text-[10px]">
                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`border px-2.5 py-1.5 rounded transition active:scale-95 cursor-pointer ${
                    showHeatmap ? "bg-red-950/30 border-red-900 text-red-400 font-bold" : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  Heatmap
                </button>
                <button
                  onClick={() => setShowSafespots(!showSafespots)}
                  className={`border px-2.5 py-1.5 rounded transition active:scale-95 cursor-pointer ${
                    showSafespots ? "bg-emerald-950/30 border-emerald-900 text-emerald-400 font-bold" : "bg-slate-900 border-slate-850 text-slate-500"
                  }`}
                >
                  Safespots
                </button>
              </div>
            </div>

            {/* Bottom mini coordinate indicator */}
            <div className="bg-slate-900/80 border border-slate-850 mt-3 p-2 rounded-lg font-mono text-[9px] text-cyan-400 font-semibold text-center select-none shadow-inner truncate">
              {getFocusDetails()}
            </div>
          </div>
        </div>

        {/* Sidebar Diagnostics Column */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* A. SYSTEM METRICS */}
          <div className="bg-slate-950/90 border border-slate-850 p-4 rounded-xl shadow-lg relative select-none">
            <span className="absolute top-2.5 right-3 text-[9px] bg-slate-900 text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded font-mono uppercase tracking-widest">REALTIME</span>
            <h5 className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              SYSTEM METRICS
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850/60 flex flex-col justify-between">
                <span className="text-[8px] text-slate-500 font-mono uppercase">Tick Depth</span>
                <span className="text-[15px] font-mono font-bold text-slate-100 mt-1">{tickDepth}</span>
              </div>
              <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850/60 flex flex-col justify-between">
                <span className="text-[8px] text-slate-500 font-mono uppercase">Total Heat</span>
                <span className="text-[15px] font-mono font-bold text-red-400 mt-1">118 kW/s</span>
              </div>
              <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850/60 flex flex-col justify-between">
                <span className="text-[8px] text-slate-500 font-mono uppercase">NPC Ghosts</span>
                <span className="text-[15px] font-mono font-bold text-yellow-400 mt-1">{npcs.length}</span>
              </div>
              <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850/60 flex flex-col justify-between">
                <span className="text-[8px] text-slate-500 font-mono uppercase">Safespots</span>
                <span className="text-[15px] font-mono font-bold text-emerald-400 mt-1">{safespotsList.length}</span>
              </div>
            </div>
          </div>

          {/* B. KERNEL DIAGNOSTICS & TRANSITIONAL TOPOLOGY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Kernel block */}
            <div className="bg-slate-950/90 border border-slate-850 p-4 rounded-xl shadow-lg flex flex-col justify-between">
              <div>
                <h5 className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 select-none">
                  <Activity className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  KERNEL DIAGNOSTICS
                </h5>
                <div className="space-y-2 font-mono text-[10px]">
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span className="text-slate-500">PHASE:</span>
                    <span className={`font-bold ${
                      kernelDiagnostics.phase === "DEGRADING"
                        ? "text-red-400 animate-pulse"
                        : kernelDiagnostics.phase === "FALSE_STABILITY"
                        ? "text-yellow-400"
                        : "text-emerald-400"
                    }`}>{kernelDiagnostics.phase}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span className="text-slate-500">GATE MULTIPLIER:</span>
                    <span className="text-slate-200">{kernelDiagnostics.multiplier.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span className="text-slate-500">VOLATILITY EMA:</span>
                    <span className="text-slate-200">{kernelDiagnostics.volatility.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span className="text-slate-500">STABILITY EMA:</span>
                    <span className="text-slate-200">{kernelDiagnostics.stability.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">PREDICTION ACC:</span>
                    <span className="text-cyan-400 font-bold">{(kernelDiagnostics.accuracy * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-900/60 pt-2 mt-3 flex justify-between items-center text-[9px] font-mono text-slate-550 select-none">
                <span>TRANSITIONS count:</span>
                <span className="text-slate-300 font-bold">{kernelDiagnostics.transitions}</span>
              </div>
            </div>

            {/* Transitional Topology block */}
            <div className="bg-slate-950/90 border border-slate-850 p-4 rounded-xl shadow-lg flex flex-col justify-between">
              <div>
                <h5 className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
                  <Binary className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  TRANSITIONAL TOPOLOGY
                </h5>
                <div className="flex gap-2 text-center text-[10px] font-mono mb-3">
                  <div className="flex-1 bg-slate-900 border border-slate-800 p-2 rounded">
                    <span className="text-[7.5px] text-slate-500 block uppercase">PRIMARY (BEN GUA)</span>
                    <span className="text-cyan-400 font-bold block mt-0.5">{kernelDiagnostics.phase === "DEGRADING" ? "YAO_OVER" : "YAO_STEADY"}</span>
                  </div>
                  <div className="flex-1 bg-slate-900 border border-slate-800 p-2 rounded">
                    <span className="text-[7.5px] text-slate-500 block uppercase">NUCLEAR (HU GUA)</span>
                    <span className={`font-bold block mt-0.5 ${kernelDiagnostics.phase === "STABLE" ? "text-emerald-400" : "text-yellow-500"}`}>
                      {kernelDiagnostics.phase === "STABLE" ? "ALIGNED" : "CHURNING"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 select-none leading-none">
                  <span className="text-[8px] font-bold text-slate-500 font-mono block uppercase tracking-widest">ACTIVE MOVING LINES</span>
                  <div className="space-y-1">
                    {movingLines.map((line, lIdx) => (
                      <div key={lIdx} className="bg-slate-900/60 border border-slate-900 text-[9px] font-mono p-1 rounded-md flex justify-between items-center pl-2 pr-2">
                        <span>
                          <strong className="text-slate-350">Line {line.position}: </strong>
                          <span className="text-slate-400">{line.fromState}</span> ➔ <span className="text-cyan-400">{line.toState}</span>
                        </span>
                        <span className="text-slate-500 text-[8px]">({line.source})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* C.⏳ HYSTERESIS STATE CARD */}
          <div className="bg-slate-950/90 border border-slate-850 p-4 rounded-xl shadow-lg space-y-3 relative select-none">
            <h5 className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 leading-none">
              <Layers className="h-3.5 w-3.5 text-cyan-400 shrink-0 animate-pulse" />
              ⏳ HYSTERESIS DECISION LIFECYCLE
            </h5>

            <div className="space-y-2">
              <div className="text-[7.5px] font-bold text-slate-500 font-mono block uppercase tracking-widest">DECISION TIMELINE (LAST 20 TICKS)</div>
              <div className="flex gap-1 h-5 border border-slate-900 p-1 bg-black rounded-lg items-center">
                {decisionTimeline.map((item, idx) => {
                  const color = item === "COMMIT" ? "bg-emerald-500" : item === "PREPARE" ? "bg-amber-500" : "bg-red-500";
                  const opacity = item === "WAIT" ? "opacity-40" : "opacity-100";
                  return (
                    <div
                      key={idx}
                      className={`flex-1 h-full rounded ${color} ${opacity}`}
                      title={`${item} @ Tick`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pipeline queues */}
              <div className="space-y-1.5 font-mono text-[9px]">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">QUEUE PIPELINE STATE</span>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg space-y-1.5 min-h-[46px] flex flex-col justify-center">
                  {abilityQueue.slice(0, 1).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] font-bold text-slate-200">
                      <span>⚡ QUEUED: <span className="text-cyan-400">{item.actionType}</span></span>
                      <span className="text-cyan-300">{(item.confidence * 100).toFixed(0)}% Conf</span>
                    </div>
                  ))}
                  <div className="text-[8px] text-slate-550 leading-none">
                    {abilityQueue.length} actions in active compiler line pipeline.
                  </div>
                </div>
              </div>

              {/* Confidence Trend */}
              <div className="space-y-1.5 font-mono text-[9px]">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">CONFIDENCE STABILITY TREND</span>
                <div className="bg-slate-900 border border-slate-800 p-1.5 h-12 rounded-lg flex items-center justify-center">
                  {drawSparkline()}
                </div>
              </div>
            </div>

          </div>

          {/* D. LEGEND GROUP */}
          <div className="bg-slate-950/90 border border-slate-850 p-4 rounded-xl shadow-lg relative font-mono text-[9.5px] select-none text-slate-400">
            <h5 className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider mb-2 select-none leading-none">
              LEGEND
            </h5>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#51ffff] border border-white" />
                <span>Player Ghost (Trail: dashed)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 border border-red-500 relative flex items-center justify-center bg-red-950/20">
                  <div className="h-1 w-1 bg-[#ff4d4d] rounded-full" />
                </div>
                <span>NPC Projection (Lifted)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-950/30 border border-dashed border-[#51ff9d]" />
                <span>Tactical Safespot</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-[#1e1e2f] border border-[#2e2e42]" />
                <span>Blocked Obstacle Scenery</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
