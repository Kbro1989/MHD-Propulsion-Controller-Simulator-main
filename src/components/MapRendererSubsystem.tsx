import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Layers,
  Settings,
  Database,
  Terminal,
  Play,
  RotateCcw,
  Sparkles,
  HelpCircle,
  FileJson,
  Save,
  Check,
  AlertTriangle,
  RefreshCw,
  Compass,
  Activity,
  Cpu,
  Eye,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { runCloudflareWorkersAiText, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } from "../utils/cloudflareSubstrate";

// Coordinates boundary for Lumbridge Region (Lumby Castle / 3200,3200 base)
const REGION_GRID_SIZE = 48; // 48x48 block size for custom sandbox rendering
const CASTLE_WALLS_COORDS = [
  { x: 12, y: 14, w: 1, h: 11 }, // Left Tower Wall
  { x: 25, y: 14, w: 1, h: 11 }, // Right Tower Wall
  { x: 12, y: 14, w: 14, h: 1 },  // Bottom Gatehouse wall outer
  { x: 12, y: 24, w: 14, h: 1 },  // Top Outer boundary wall
];

const ACTIVE_MAP_NPCS = [
  { name: "Hans", x: 18, y: 16, type: "Guard/Guide", id: "0xFC9A" },
  { name: "Father Aereck", x: 34, y: 12, type: "Altar Priest", id: "0xBC81" },
  { name: "Lumbridge Guide", x: 20, y: 28, type: "Tutan Master", id: "0x98A0" },
  { name: "Gillie Groats", x: 8, y: 36, type: "Farm Host", id: "0x5E22" }
];

const ACTIVE_MAP_OBJECTS = [
  { name: "Cooking range", x: 15, y: 18, id: "loc_range_1" },
  { name: "Spinning wheel", x: 13, y: 15, id: "loc_spinning_1" },
  { name: "Castle Gatehouse Altar", x: 26, y: 23, id: "loc_altar_1" }
];

export default function MapRendererSubsystem() {
  // ==========================================================================
  // CONFIGURATION STATES
  // ==========================================================================
  const [cacheSourceId, setCacheSourceId] = useState("1720");
  const [areaSelection, setAreaSelection] = useState("test");
  const [tileSize, setTileSize] = useState(512);
  const [noyFlip, setNoyFlip] = useState(false);
  const [noChunkOffset, setNoChunkOffset] = useState(false);
  const [pxPerTile, setPxPerTile] = useState(64);
  const [imageFormat, setImageFormat] = useState<"webp" | "png">("webp");
  const [gzipEnabled, setGzipEnabled] = useState(true);
  const [activeLayerMode, setActiveLayerMode] = useState<"3d" | "map" | "height" | "collision" | "interactions">("3d");

  // ==========================================================================
  // RUN TIME SIMULATOR & SHELL STATES
  // ==========================================================================
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "MHD_MAP_ENGINE_CO_PROCESSOR: Core online. Awaiting build trigger instruction...",
    "System aligned. Standard openrs2 loader database reference table cached (512 tiles/s)."
  ]);
  const [renderedMapMeta, setRenderedMapMeta] = useState<{
    buildNr: number;
    errorCount: number;
    completedFiles: number;
    skippedFiles: number;
    estimatedTime: string;
    version: number;
  } | null>(null);

  // ==========================================================================
  // VIEWPORT CANVAS INTERFACE STATES
  // ==========================================================================
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [viewRotationAngle, setViewRotationAngle] = useState(45); // isometric rotation in degrees
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ==========================================================================
  // JSON RAW EDITOR STATE
  // ==========================================================================
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");

  // Sync state to JSON textual representation
  const syncJsonTextFromState = () => {
    const configObj = {
      "$schema": "../generated/maprenderconfig.schema.json",
      "area": areaSelection,
      "tileimgsize": tileSize,
      "noyflip": noyFlip,
      "nochunkoffset": noChunkOffset,
      "layers": [
        {
          "name": "3d",
          "mode": "3d",
          "format": imageFormat,
          "level": 0,
          "pxpersquare": pxPerTile,
          "dxdy": 0.15,
          "dzdy": 0.25
        },
        {
          "name": "map",
          "mode": "map",
          "format": "png",
          "level": 0,
          "pxpersquare": pxPerTile,
          "mapicons": true,
          "wallsonly": false
        },
        {
          "name": "collision",
          "mode": "collision",
          "format": "png",
          "level": 0,
          "pxpersquare": pxPerTile
        },
        {
          "name": "height",
          "mode": "height",
          "level": 0,
          "pxpersquare": 1,
          "usegzip": gzipEnabled
        }
      ],
      "mapsizex": 100,
      "mapsizez": 200,
      "openrs2_source_id": cacheSourceId
    };
    setRawJsonText(JSON.stringify(configObj, null, 2));
    setIsEditorDirty(false);
  };

  useEffect(() => {
    syncJsonTextFromState();
  }, [cacheSourceId, areaSelection, tileSize, noyFlip, noChunkOffset, pxPerTile, imageFormat, gzipEnabled]);

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      if (parsed.area) setAreaSelection(parsed.area);
      if (parsed.tileimgsize) setTileSize(parsed.tileimgsize);
      if (parsed.noyflip !== undefined) setNoyFlip(parsed.noyflip);
      if (parsed.nochunkoffset !== undefined) setNoChunkOffset(parsed.nochunkoffset);
      if (parsed.openrs2_source_id) setCacheSourceId(parsed.openrs2_source_id.toString());
      
      const main3d = parsed.layers?.find((l: any) => l.mode === "3d");
      if (main3d) {
        if (main3d.pxpersquare) setPxPerTile(main3d.pxpersquare);
        if (main3d.format) setImageFormat(main3d.format);
      }
      
      const heightLayer = parsed.layers?.find((l: any) => l.mode === "height");
      if (heightLayer) {
        if (heightLayer.usegzip !== undefined) setGzipEnabled(heightLayer.usegzip);
      }

      setTerminalLogs((prev) => [
        `[CONFIG] Applied customized structural JSON configurations directly from inline editor.`,
        ...prev
      ]);
      setIsEditorDirty(false);
    } catch (e: any) {
      setTerminalLogs((prev) => [
        `[CRITICAL_PARSE_ERROR] Failed to map JSON configurations: ${e.message}`,
        ...prev
      ]);
    }
  };

  // ==========================================================================
  // CLOUDFLARE EDGE CO-PROCESSOR AI INFERENCE STATES
  // ==========================================================================
  const [cfPrompt, setCfPrompt] = useState("");
  const [cfResponse, setCfResponse] = useState("");
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState("");

  const handleCfDiagnose = async (overridePrompt?: string) => {
    const promptToSend = overridePrompt || cfPrompt || "Analyze this map config layers and suggest an optimal pre-charge caching strategy to avoid diagnostic cache-miss overhead.";
    setCfLoading(true);
    setCfError("");
    setCfResponse("");

    const systemPrompt = `You are the Cloudflare Workers AI edge co-processor inside a Magnetohydrodynamic (MHD) Propulsion controller. You analyze RuneApps World Map Renderer configurations, coordinate safety parameters, and diagnostic registers. Maintain an precise, technical, objective dialogue.`;

    try {
      const res = await runCloudflareWorkersAiText(promptToSend, systemPrompt);
      if (res.success && res.result) {
        setCfResponse(res.result);
      } else {
        setCfError(res.error || "Execution timeout or edge unavailable.");
      }
    } catch (err: any) {
      setCfError(err.message || "Failed to trigger Cloudflare inference pipeline.");
    } finally {
      setCfLoading(false);
    }
  };

  // ==========================================================================
  // RENDER ANIMATION PIPELINE
  // ==========================================================================
  const executeMapRendererCompilation = () => {
    if (isCompiling) return;
    setIsCompiling(true);
    setCompileProgress(0);
    setRenderedMapMeta(null);

    const logTackList = [
      { pr: 5, msg: "[nodegl] Spawning child nodegl process inside headless container window..." },
      { pr: 12, msg: `[io] Connecting to OpenRS2 Cache database (Registry: ID=${cacheSourceId}, BuildNr=1720)` },
      { pr: 25, msg: `[preload] Downloading files list for mapsquare [49,49] (Lumbridge Castle sector)...` },
      { pr: 38, msg: `[geometry] Found 278 unique terrain height nodes, compiling structural polygons...` },
      { pr: 50, msg: `[render] Drawing 3D Isometric mesh layer (FOV zoom matrix standard flat projection)` },
      { pr: 68, msg: `[mapscene] Unpacking sprite asset database archive #281 - Loaded 4 icons, 12 labels.` },
      { pr: 82, msg: `[compression] Writing height bin matrix per tile. Gzip alignment: ${gzipEnabled ? "asserted" : "disabled"}...` },
      { pr: 95, msg: `[mipping] Downscaling 5 levels of structural mipmaps via average-scaling filters...` },
      { pr: 100, msg: `[nodegl] Done. Output files synced cleanly to virtual disk. Compilation complete in 12.4s.` }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < logTackList.length) {
        const item = logTackList[stepIdx];
        setCompileProgress(item.pr);
        setTerminalLogs((prev) => [item.msg, ...prev]);
        stepIdx++;
      } else {
        clearInterval(interval);
        setIsCompiling(false);
        setRenderedMapMeta({
          buildNr: 1720,
          errorCount: 0,
          completedFiles: 14 + Math.round(Math.random() * 8),
          skippedFiles: 3+ Math.round(Math.random() * 4),
          estimatedTime: "1.28s",
          version: Math.round(Date.now() / 1000000)
        });
      }
    }, 450);
  };

  // ==========================================================================
  // RENDERING ENGINE CANVAS GRAPHICS
  // ==========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = "#020617"; // Slate 950
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    if (activeLayerMode === "3d") {
      // 3D Isometric Projection Engine
      const radius = 10;
      const angleRad = (viewRotationAngle * Math.PI) / 180;

      // Draw grid planes
      ctx.strokeStyle = "rgba(71, 85, 105, 0.25)"; // slate-600
      ctx.lineWidth = 1;
      
      for (let i = -12; i <= 12; i += 2) {
        // Line X-axis
        let x1 = centerX + (i * 12) * Math.cos(angleRad) - (-12 * 7) * Math.sin(angleRad);
        let y1 = centerY + (i * 12) * Math.sin(angleRad) + (-12 * 7) * Math.cos(angleRad);
        let x2 = centerX + (i * 12) * Math.cos(angleRad) - (12 * 7) * Math.sin(angleRad);
        let y2 = centerY + (i * 12) * Math.sin(angleRad) + (12 * 7) * Math.cos(angleRad);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Line Y-axis
        let x3 = centerX + (-12 * 12) * Math.cos(angleRad) - (i * 7) * Math.sin(angleRad);
        let y3 = centerY + (-12 * 12) * Math.sin(angleRad) + (i * 7) * Math.cos(angleRad);
        let x4 = centerX + (12 * 12) * Math.cos(angleRad) - (i * 7) * Math.sin(angleRad);
        let y4 = centerY + (12 * 12) * Math.sin(angleRad) + (i * 7) * Math.cos(angleRad);

        ctx.beginPath();
        ctx.moveTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.stroke();
      }

      // Draw standard Lumby River path
      ctx.fillStyle = "rgba(2, 132, 199, 0.4)"; // light blue water
      ctx.beginPath();
      ctx.ellipse(centerX + 60, centerY + 30, 80, 45, angleRad, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "rgba(14, 165, 233, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw castle walls isometric
      ctx.fillStyle = "rgba(100, 116, 139, 0.85)"; // Slate 500
      ctx.strokeStyle = "rgba(241, 245, 249, 0.9)";
      ctx.lineWidth = 2;

      // Draw custom 3D isometric castle tower
      const drawIsoBox = (cx: number, cy: number, sx: number, sy: number, sheight: number, fillColor: string) => {
        ctx.save();
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        
        // Top Face
        ctx.beginPath();
        ctx.moveTo(cx, cy - sheight);
        ctx.lineTo(cx + sx, cy - sy - sheight);
        ctx.lineTo(cx, cy - sy*2 - sheight);
        ctx.lineTo(cx - sx, cy - sy - sheight);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Left Face
        ctx.beginPath();
        ctx.moveTo(cx - sx, cy - sy - sheight);
        ctx.lineTo(cx, cy - sheight);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx - sx, cy - sy);
        ctx.closePath();
        ctx.fillStyle = "rgba(30, 41, 59, 0.9)"; // Darker inside
        ctx.fill();
        ctx.stroke();

        // Right Face
        ctx.beginPath();
        ctx.moveTo(cx, cy - sheight);
        ctx.lineTo(cx + sx, cy - sy - sheight);
        ctx.lineTo(cx + sx, cy - sy);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fillStyle = "rgba(51, 65, 85, 0.9)";
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      };

      // Draw castle wing
      drawIsoBox(centerX - 40, centerY + 10, 40, 20, 25, "#475569");
      drawIsoBox(centerX + 40, centerY + 10, 40, 20, 25, "#475569");

      // Draw Central Gatehouse Tower
      drawIsoBox(centerX, centerY - 10, 24, 12, 50, "#64748b");
      drawIsoBox(centerX - 60, centerY + 20, 14, 7, 35, "#334155");
      drawIsoBox(centerX + 60, centerY + 20, 14, 7, 35, "#334155");

      // Isometric annotations/scanning ring
      ctx.strokeStyle = "rgba(249, 115, 22, 0.4)"; // Orange
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - 10, 120, 60, angleRad, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Target Reticle
      ctx.strokeStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(centerX, centerY - 10, 6, 0, 2 * Math.PI);
      ctx.stroke();

    } else if (activeLayerMode === "map") {
      // 2D Classic Map Render Visual
      draw2DGridBase(ctx, w, h);

      // Render walls
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 3.5;
      CASTLE_WALLS_COORDS.forEach((wall) => {
        const xCoord = wall.x * (w / REGION_GRID_SIZE);
        const yCoord = (REGION_GRID_SIZE - wall.y - wall.h) * (h / REGION_GRID_SIZE);
        const wWidth = wall.w * (w / REGION_GRID_SIZE);
        const wHeight = wall.h * (h / REGION_GRID_SIZE);
        ctx.fillStyle = "rgba(148, 163, 184, 0.2)";
        ctx.fillRect(xCoord, yCoord, wWidth, wHeight);
        ctx.strokeRect(xCoord, yCoord, wWidth, wHeight);
      });

      // Render River Lum (2D styled layout)
      ctx.fillStyle = "#0c4a6e"; // Sky-900 water
      ctx.beginPath();
      ctx.moveTo(w * 0.75, h);
      ctx.quadraticCurveTo(w * 0.6, h * 0.5, w * 0.8, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Render symbols and text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      
      // Castle label
      ctx.fillText("LUMBRIDGE CASTLE", w * 0.38, h * 0.55);
      // River Label
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("RIVER LUM", w * 0.85, h * 0.4);

      // Icons
      ctx.fillStyle = "#e11d48"; // Rose-600
      ctx.beginPath();
      ctx.arc(w * 0.38, h * 0.45, 4, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#fbbf24"; // Amber 400 spinning wheel
      ctx.beginPath();
      ctx.rect(w * 0.28, h * 0.65, 6, 6);
      ctx.fill();

    } else if (activeLayerMode === "height") {
      // 16-bit Height Gradient Map Visualizer
      draw2DGridBase(ctx, w, h);

      // Generate elevation contour rings
      for (let r = 5; r >= 1; r--) {
        const radiusVal = r * 45;
        const elevMeters = (6 - r) * 12;
        ctx.fillStyle = `rgba(13, 148, 136, ${0.05 + (6 - r) * 0.08})`; // Teal grad
        ctx.beginPath();
        ctx.arc(centerX - 30, centerY + 10, radiusVal, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = `rgba(45, 212, 191, ${0.1 + (6 - r) * 0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#2dd4bf";
        ctx.font = "8px monospace";
        ctx.fillText(`+${elevMeters}m`, centerX - 30 + radiusVal - 14, centerY + 13);
      }

    } else if (activeLayerMode === "collision") {
      // Pathing / Line of Sight Mesh (Red / Orange blocks)
      draw2DGridBase(ctx, w, h);

      // Render red blocked boundaries
      const cellSize = w / REGION_GRID_SIZE;
      ctx.fillStyle = "rgba(239, 68, 68, 0.4)"; // Red blocked
      ctx.strokeStyle = "rgba(220, 38, 38, 0.8)";
      ctx.lineWidth = 0.5;

      // Draw custom bounding blocks around walls
      CASTLE_WALLS_COORDS.forEach((wall) => {
        for (let x = wall.x; x < wall.x + wall.w; x++) {
          for (let y = wall.y; y < wall.y + wall.h; y++) {
            const rx = x * cellSize;
            const ry = (REGION_GRID_SIZE - 1 - y) * cellSize;
            ctx.fillRect(rx, ry, cellSize, cellSize);
            ctx.strokeRect(rx, ry, cellSize, cellSize);
          }
        }
      });

      // Render orange safe spot or buffer cells
      ctx.fillStyle = "rgba(249, 115, 22, 0.25)"; // Orange hazard
      ctx.strokeStyle = "rgba(234, 88, 12, 0.6)";
      
      const orangeHazards = [
        { x: 18, y: 14 }, { x: 18, y: 15 }, // Courtyard gate gap
        { x: 11, y: 18 }, { x: 13, y: 18 }, // Range boundaries
        { x: 26, y: 22 }, { x: 26, y: 24 }  // Altar buffer zone
      ];

      orangeHazards.forEach((hNode) => {
        const rx = hNode.x * cellSize;
        const ry = (REGION_GRID_SIZE - 1 - hNode.y) * cellSize;
        ctx.fillRect(rx, ry, cellSize, cellSize);
        ctx.strokeRect(rx, ry, cellSize, cellSize);
      });

      // Legend overlay
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(w - 110, h - 55, 100, 45);
      ctx.strokeStyle = "#334155";
      ctx.strokeRect(w - 110, h - 55, 100, 45);

      ctx.fillStyle = "#ef4444";
      ctx.fillRect(w - 102, h - 48, 8, 8);
      ctx.fillStyle = "#f97316";
      ctx.fillRect(w - 102, h - 35, 8, 8);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "8px monospace";
      ctx.textAlign = "left";
      ctx.fillText("WALK BLOCKED", w - 88, h - 41);
      ctx.fillText("SIGHT BARRIER", w - 88, h - 28);

    } else if (activeLayerMode === "interactions") {
      // Interactive Trigger Vectors & database markers
      draw2DGridBase(ctx, w, h);
      const cellSize = w / REGION_GRID_SIZE;

      // Draw interactive bounding diamonds (amber)
      ACTIVE_MAP_OBJECTS.forEach((obj) => {
        const rx = obj.x * cellSize + cellSize / 2;
        const ry = (REGION_GRID_SIZE - 1 - obj.y) * cellSize + cellSize / 2;

        ctx.fillStyle = "rgba(217, 119, 6, 0.15)";
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 7);
        ctx.lineTo(rx + 7, ry);
        ctx.lineTo(rx, ry + 7);
        ctx.lineTo(rx - 7, ry);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fbbf24";
        ctx.font = "7px sans-serif";
        ctx.fillText(obj.name, rx, ry - 10);
      });

      // Draw NPC tracking triggers (cyan pulse)
      ACTIVE_MAP_NPCS.forEach((npc) => {
        const rx = npc.x * cellSize + cellSize / 2;
        const ry = (REGION_GRID_SIZE - 1 - npc.y) * cellSize + cellSize / 2;

        ctx.fillStyle = "rgba(6, 182, 212, 0.3)";
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = "#22d3ee";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(npc.name, rx, ry - 9);
      });
    }

    // Hover Cell Selector Highlight
    if (hoverTile) {
      const cellSize = w / REGION_GRID_SIZE;
      const rx = hoverTile.x * cellSize;
      const ry = (REGION_GRID_SIZE - 1 - hoverTile.y) * cellSize;

      ctx.save();
      ctx.strokeStyle = "#f97316"; // Bright Orange
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, cellSize, cellSize);
      ctx.fillStyle = "rgba(249, 115, 22, 0.15)";
      ctx.fillRect(rx, ry, cellSize, cellSize);
      ctx.restore();
    }

  }, [activeLayerMode, viewRotationAngle, hoverTile]);

  // Handle standard grid helper
  const draw2DGridBase = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const cellSize = w / REGION_GRID_SIZE;
    ctx.strokeStyle = "rgba(51, 65, 85, 0.15)"; // Slate-800 soft grid
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  };

  // Track hover coordinate
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const cellSize = canvas.width / REGION_GRID_SIZE;
    const hoverX = Math.floor(mx / cellSize);
    const hoverY = REGION_GRID_SIZE - 1 - Math.floor(my / cellSize);

    if (hoverX >= 0 && hoverX < REGION_GRID_SIZE && hoverY >= 0 && hoverY < REGION_GRID_SIZE) {
      setHoverTile({ x: hoverX, y: hoverY });
    } else {
      setHoverTile(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverTile(null);
  };

  // Find hover entities to display in overlay
  const detectedInteractiveInfo = useMemo(() => {
    if (!hoverTile) return null;
    const absoluteX = hoverTile.x + 3200; // Lumbridge base offsets
    const absoluteY = hoverTile.y + 3200;

    const matchedNpc = ACTIVE_MAP_NPCS.find(n => n.x === hoverTile.x && n.y === hoverTile.y);
    if (matchedNpc) {
      return {
        type: "NPC ENTITY",
        name: matchedNpc.name,
        meta: `Type: ${matchedNpc.type} | ID Ref: ${matchedNpc.id}`,
        coords: `(${absoluteX}, ${absoluteY})`
      };
    }

    const matchedObj = ACTIVE_MAP_OBJECTS.find(o => o.x === hoverTile.x && o.y === hoverTile.y);
    if (matchedObj) {
      return {
        type: "INTERACTIVE OBJECT",
        name: matchedObj.name,
        meta: `VHDL Target: ${matchedObj.id}`,
        coords: `(${absoluteX}, ${absoluteY})`
      };
    }

    const matchedWall = CASTLE_WALLS_COORDS.some(wall => 
      hoverTile.x >= wall.x && hoverTile.x < wall.x + wall.w &&
      hoverTile.y >= wall.y && hoverTile.y < wall.y + wall.h
    );

    if (matchedWall) {
      return {
        type: "TERRAIN STRUCTURAL WALL",
        name: "Lumbridge Castle Wall Segment",
        meta: "MAPPED SIGHT & WALK BLOCKING INTERLOCK BARRIER",
        coords: `(${absoluteX}, ${absoluteY})`
      };
    }

    return {
      type: "VACANT EXCAVATION GROUND TILE",
      name: "Grassland Tile",
      meta: "No object registrations in database. Altitude elevation 0.0m.",
      coords: `(${absoluteX}, ${absoluteY})`
    };

  }, [hoverTile]);

  return (
    <div className="space-y-6 text-left" id="map-renderer-subsystem">
      
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div>
          <div className="text-[10px] text-orange-400 font-mono font-bold tracking-wider uppercase flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            RUNEAPPS WEBGL WORLD MAP CORE ACTIVE
          </div>
          <h2 className="text-lg font-display font-medium text-slate-100 tracking-wide mt-1">
            RuneApps World Map Render Subsystem & nodegl Emulator
          </h2>
          <p className="text-[11px] text-slate-450 font-mono mt-0.5 max-w-2xl leading-normal">
            Compiles authentic high-fidelity RS-Classic game cache assets into 3D isometric perspectives, 2D vector overlays, pathing collision boundaries, and 16-bit packed height arrays.
          </p>
        </div>
        
        <div className="flex bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[10px] items-center gap-2 max-w-xs text-slate-400">
          <Database className="h-4 w-4 text-orange-500 shrink-0" />
          <span>Active JSON layout source: <strong className="text-slate-200">/extract_map/mapconfig.jsonc</strong></span>
        </div>
      </div>

      {/* Main Grid: Control Sidebar on left, Interactive Canvas Viewport in center, Terminal Code log on bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Sliders & nodegl compile controls (col-span-4) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-850 p-4 rounded-lg flex flex-col justify-between space-y-4">
          <div className="space-y-4 font-mono text-[11px]">
            <div className="border-b border-slate-800 pb-2 flex items-center justify-between select-none">
              <span className="font-bold text-slate-200 tracking-wider flex items-center gap-1.5 uppercase">
                <Settings className="h-4 w-4 text-orange-400" />
                Render Options
              </span>
              <span className="text-[8px] bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                v2.4.9
              </span>
            </div>

            {/* Config Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-[9.5px] uppercase font-bold text-slate-450 block mb-1">OpenRS2 Cache ID:</label>
                <select
                  value={cacheSourceId}
                  onChange={(e) => setCacheSourceId(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded p-1.5 text-[10.5px] focus:outline-none focus:border-orange-600"
                >
                  <option value="1720">openrs2:1720 (Standard Classic v219)</option>
                  <option value="1680">openrs2:1680 (Classic Beta v198)</option>
                  <option value="1225">openrs2:1225 (NXT Era build #830)</option>
                </select>
              </div>

              <div>
                <label className="text-[9.5px] uppercase font-bold text-slate-450 block mb-1">Target Area Preset:</label>
                <select
                  value={areaSelection}
                  onChange={(e) => setAreaSelection(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded p-1.5 text-[10.5px] focus:outline-none focus:border-orange-600"
                >
                  <option value="test">test (3x3 grid around Lumbridge Castle)</option>
                  <option value="main">main (Main Continent Boundary Mesh)</option>
                  <option value="full">full (Comprehensive world coordinate bounds)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9.5px] uppercase font-bold text-slate-450 block mb-1">Tile Resolution (px):</label>
                  <select
                    value={tileSize}
                    onChange={(e) => setTileSize(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded p-1.5 text-[10.5px] focus:outline-none focus:border-orange-600"
                  >
                    <option value="256">256 x 256</option>
                    <option value="512">512 x 512 (Standard)</option>
                    <option value="1024">1024 x 1024</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9.5px] uppercase font-bold text-slate-450 block mb-1">Pixels / Tile:</label>
                  <input
                    type="number"
                    value={pxPerTile}
                    onChange={(e) => setPxPerTile(Number(e.target.value))}
                    min="1"
                    max="128"
                    className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded p-1.5 font-bold text-[10.5px] focus:outline-none focus:border-orange-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9.5px] uppercase font-bold text-slate-450 block mb-1">Output Format:</label>
                  <select
                    value={imageFormat}
                    onChange={(e) => setImageFormat(e.target.value as "webp" | "png")}
                    className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded p-1.5 text-[11px] focus:outline-none focus:border-orange-600"
                  >
                    <option value="webp">WebP (90% compression)</option>
                    <option value="png">PNG (Lossless standard)</option>
                  </select>
                </div>
                
                {/* Gzip Enable Checkbox */}
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2 border border-slate-850 rounded hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={gzipEnabled}
                      onChange={(e) => setGzipEnabled(e.target.checked)}
                      className="accent-orange-500 h-3.5 w-3.5 cursor-pointer rounded"
                    />
                    <span className="text-[9.5px] uppercase font-semibold text-slate-300">Gzip Output (.gz)</span>
                  </label>
                </div>
              </div>

              {/* Advanced Toggle checkboxes */}
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={noyFlip}
                    onChange={(e) => setNoyFlip(e.target.checked)}
                    className="accent-orange-500 h-3 w-3 cursor-pointer"
                  />
                  <span>Disable yFlip (Direct coordinate origin)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={noChunkOffset}
                    onChange={(e) => setNoChunkOffset(e.target.checked)}
                    className="accent-orange-500 h-3 w-3 cursor-pointer"
                  />
                  <span>Align direct chunks (No grid offset multiplier)</span>
                </label>
              </div>
            </div>

            {/* Run Compilation trigger button */}
            <div className="pt-3">
              <button
                onClick={executeMapRendererCompilation}
                disabled={isCompiling}
                className={`w-full py-2.5 rounded-md font-bold uppercase transition text-xs flex items-center justify-center gap-2 cursor-pointer ${
                  isCompiling 
                  ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed" 
                  : "bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.15)] font-mono"
                }`}
              >
                {isCompiling ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Compiling Mapsquares ({compileProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-slate-950 text-slate-950" />
                    <span>Run Map Render Engine (nodegl)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compilation Outcome Panel */}
          {renderedMapMeta && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-lg text-emerald-400 font-mono text-[9.5px] leading-relaxed mt-2"
            >
              <div className="font-extrabold flex items-center gap-1.5 border-b border-emerald-900 pb-1.5 mb-1.5 uppercase tracking-wider">
                <Check className="h-4 w-4 text-emerald-500" />
                BUILD EXPORT CONVERGED SUCCESSFULLY
              </div>
              <div>• Cache build source: openrs2:{renderedMapMeta.buildNr}</div>
              <div>• Output version stamp: {renderedMapMeta.version}</div>
              <div>• Files written to disk: {renderedMapMeta.completedFiles} WebGL slices</div>
              <div>• Symmetric files skipped: {renderedMapMeta.skippedFiles} deduplicated</div>
              <div>• Engine telemetry cycle: {renderedMapMeta.estimatedTime} runtime</div>
            </motion.div>
          )}

          <div className="bg-slate-950 border border-slate-850 p-3 rounded text-[8.5px] leading-relaxed text-slate-450 mt-1">
            <span className="font-bold text-slate-350 block uppercase border-b border-slate-900 pb-0.5 mb-1">headless rendering warning:</span>
            Runs Map Renderer directly inside the virtual Electron frame sandbox container (node-gl context emulator), outputting tiles mapped to <code className="text-amber-400 font-bold">/dist/maprender/</code> instantly.
          </div>
        </div>

        {/* Dynamic Viewport WebGL Map Viewer (Col-span-8) */}
        <div className="lg:col-span-8 space-y-4 flex flex-col justify-between">
          <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-lg flex-1 flex flex-col justify-between">
            
            {/* Viewport Toolbar controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3.5 mb-4 select-none">
              <div>
                <span className="text-[10px] text-orange-400 font-mono font-bold block uppercase tracking-wider">
                  ACTIVE VIEWPORT PIPELINE
                </span>
                <span className="text-xs font-bold text-slate-200 font-mono">
                  Lumbridge Core Region (Mapsquare coords: [3200..3248, 3200..3248])
                </span>
              </div>

              {/* Layers buttons */}
              <div className="flex flex-wrap bg-slate-950 rounded p-1 border border-slate-850 gap-1 text-[9.5px] font-mono">
                <button
                  onClick={() => setActiveLayerMode("3d")}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    activeLayerMode === "3d" ? "bg-orange-950 text-orange-400 font-bold border border-orange-900/60" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="WebGL-based 3D perspective"
                >
                  3D ISOMETRIC
                </button>
                <button
                  onClick={() => setActiveLayerMode("map")}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    activeLayerMode === "map" ? "bg-orange-950 text-orange-400 font-bold border border-orange-900/60" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Traditional 2D layout"
                >
                  2D CLASSIC MAP
                </button>
                <button
                  onClick={() => setActiveLayerMode("height")}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    activeLayerMode === "height" ? "bg-orange-950 text-orange-400 font-bold border border-orange-900/60" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="16-bit elevation mesh outlines"
                >
                  HEIGHT GRID
                </button>
                <button
                  onClick={() => setActiveLayerMode("collision")}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    activeLayerMode === "collision" ? "bg-orange-950 text-orange-400 font-bold border border-orange-900/60" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Path finding obstacles, boundary walls"
                >
                  COLLISION
                </button>
                <button
                  onClick={() => setActiveLayerMode("interactions")}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    activeLayerMode === "interactions" ? "bg-orange-950 text-orange-400 font-bold border border-orange-900/60" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="NPC coordinate triggers, map labels"
                >
                  INTERACTIONS
                </button>
              </div>
            </div>

            {/* Viewport Canvas Container */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              <div className="md:col-span-8 flex justify-center items-center bg-slate-950 p-2.5 rounded-lg border border-slate-850 relative">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={320}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  className="rounded border border-slate-800/80 cursor-crosshair bg-slate-950 w-full hover:shadow-[0_0_15px_rgba(249,115,22,0.05)] transition duration-300"
                />

                {/* Left/Right angle rotate sliders in 2D layer view */}
                {activeLayerMode === "3d" && (
                  <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md text-[8.5px] font-mono text-slate-400">
                    <span>PERSPECTIVE ANGLE:</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={viewRotationAngle}
                      onChange={(e) => setViewRotationAngle(Number(e.target.value))}
                      className="w-16 accent-orange-500 cursor-pointer h-1 rounded"
                    />
                    <span className="text-orange-400 font-bold">{viewRotationAngle}°</span>
                  </div>
                )}
              </div>

              {/* Dynamic Coordinate info overlay (md:col-span-4) */}
              <div className="md:col-span-4 space-y-3 font-mono text-[10.5px] flex flex-col justify-between">
                
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg h-full space-y-2.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block border-b border-slate-900 pb-1.5 mb-2.5">
                      DYNAMIC TILE RADAR TELEMETRY
                    </span>

                    {hoverTile ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center bg-slate-900/40 px-2 py-1 rounded">
                          <span className="text-slate-450">LOCAL GRID:</span>
                          <span className="text-orange-400 font-bold font-mono">[{hoverTile.x}, {hoverTile.y}]</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/40 px-2 py-1 rounded">
                          <span className="text-slate-450">ABS COORDS:</span>
                          <span className="text-slate-205 font-bold">{hoverTile.x + 3200}, {hoverTile.y + 3200}</span>
                        </div>
                        <div className="border-t border-slate-900 pt-2 mt-2 space-y-1.5">
                          <div className="text-[9px] font-bold text-orange-400 uppercase tracking-wide flex items-center gap-1">
                            <Activity className="h-3 w-3 text-orange-400 animate-pulse" />
                            {detectedInteractiveInfo?.type}
                          </div>
                          <div className="text-slate-102 text-xs font-bold font-display leading-tight">
                            {detectedInteractiveInfo?.name}
                          </div>
                          <div className="text-[9.5px] text-slate-450 leading-relaxed font-sans font-medium">
                            {detectedInteractiveInfo?.meta}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-slate-505 text-center space-y-2">
                        <Compass className="h-8 w-8 text-slate-800 animate-spin" style={{ animationDuration: "12s" }} />
                        <span className="text-[8.5px] tracking-wider text-slate-500 font-bold uppercase">
                          Awaiting coordinate hover radar...
                        </span>
                        <p className="text-[9px] text-slate-600 max-w-xs font-sans mt-0.5">
                          Hover your cursor over tiles inside the WebGL-Preview canvas window to inspect diagnostic registers or VHDL coordinate blocks.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-920 border border-slate-900 p-2.5 rounded text-[8.5px] leading-relaxed text-slate-400 select-none">
                    • <strong className="text-slate-300">3D Camera</strong>: Simulates isometric transform matrices <code className="text-orange-400 font-bold">SkewOrthographicCamera</code> skew matrix multiplies.<br />
                    • <strong className="text-slate-300">CRC Verification</strong>: Ensures total asset block alignment relative to standard openrs2 file system indices.
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Row 2: Live configuration JSON view & Cloudflare workers AI (Gird 12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Configuration JSON panel (col-span-5) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-850 p-4.5 rounded-lg flex flex-col justify-between">
          <div className="space-y-3 font-mono text-[11px]">
            <div className="border-b border-slate-800 pb-2 flex items-center justify-between select-none">
              <span className="font-bold text-slate-200 tracking-wider flex items-center gap-1.5 uppercase">
                <FileJson className="h-4 w-4 text-orange-500" />
                mapconfig.jsonc configuration
              </span>
              <div className="flex items-center gap-1">
                {isEditorDirty && (
                  <span className="text-[8px] bg-orange-955 text-orange-400 border border-orange-900 px-1 rounded animate-pulse font-bold">
                    UNSAVED STRAW
                  </span>
                )}
                <span className="text-[8.5px] text-slate-500">
                  Target Config Layer
                </span>
              </div>
            </div>

            <p className="text-[9.5px] text-slate-500 leading-relaxed font-sans font-medium">
              Real-time editing and configuration profile for the RuneApps build exporter. Allows customized layer, pxpersquare size, levels, and WebGL angle registers overrides.
            </p>

            <div className="relative">
              <textarea
                value={rawJsonText}
                onChange={(e) => {
                  setRawJsonText(e.target.value);
                  setIsEditorDirty(true);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded p-3 font-mono text-[9px] text-slate-300 h-64 focus:outline-none focus:border-orange-700 leading-normal focus:ring-1 focus:ring-orange-700"
              />
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-slate-850 flex items-center justify-between gap-3 text-[10px] font-mono">
            <button
              onClick={syncJsonTextFromState}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:text-slate-100 text-slate-400 rounded cursor-pointer transition flex items-center gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              RESTORE NOMINAL
            </button>
            <button
              onClick={handleApplyJson}
              className={`px-4 py-1.5 rounded font-bold cursor-pointer transition flex items-center gap-1 ${
                isEditorDirty 
                ? "bg-orange-600 text-slate-950 hover:bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.2)]" 
                : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              APPLY OVERRIDES
            </button>
          </div>
        </div>

        {/* Cloudflare Workers AI edge co-processor diagnosis (col-span-7) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-850 p-4.5 rounded-lg flex flex-col justify-between">
          <div className="space-y-4 text-left">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-start gap-2.5">
                <div className="bg-orange-950/50 p-1.5 rounded border border-orange-900/60 shrink-0">
                  <Sparkles className="h-5 w-5 text-orange-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-display font-medium text-sm text-slate-100 tracking-wider uppercase flex items-center gap-2">
                    Cloudflare Workers AI Map Co-Processor
                    <span className="text-[8px] bg-orange-950 text-orange-400 border border-orange-900/80 px-2 py-0.5 rounded font-mono font-normal">
                      @cf/meta/llama-3.1-8b-instruct
                    </span>
                  </h4>
                  <p className="text-slate-400 font-sans text-[11px] mt-0.5">
                    Deploy real-time AI analytics on mapsquare grids, custom height layers, and path boundary conditions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-[9px] select-none shrink-0 border border-slate-800 px-2 py-1 rounded bg-slate-950 text-slate-400">
                {CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN ? (
                  <span className="text-emerald-400 animate-pulse font-bold flex items-center gap-1">
                    <span className="w-1 w-1 h-1 rounded-full bg-emerald-400" />
                    EDGE CHANNEL LIVE
                  </span>
                ) : (
                  <span className="text-amber-500 font-bold flex items-center gap-1" title="VITE_CLOUDFLARE_ACCOUNT_ID or API_TOKEN absent: running in high-fidelity sandbox fallback mode">
                    <span className="w-1 w-1 h-1 rounded-full bg-amber-500" />
                    SANDBOX FALLBACK ACTIVE
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5 space-y-3 font-mono text-[10.5px]">
                <span className="text-[9px] text-slate-450 block uppercase font-bold">
                  EDGE DIRECTIVE INPUT
                </span>

                <div className="relative">
                  <textarea
                    value={cfPrompt}
                    onChange={(e) => setCfPrompt(e.target.value)}
                    placeholder="Ask Llama-3.1 edge helper to audit collision files or pre-charge boundaries..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10.5px] text-slate-200 h-24 focus:outline-none focus:border-orange-700 leading-normal focus:ring-1 focus:ring-orange-700"
                  />
                </div>

                {/* Direct quick Diagnostic prompts */}
                <div>
                  <span className="text-[8px] text-slate-500 uppercase block mb-1.5 font-bold font-mono">
                    Quick Diagnostic Presets:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => {
                        const q = "Perform spatial audit and verify optimal pre-charge voltage caching alignment for mapsquare [49,49]";
                        setCfPrompt(q);
                        handleCfDiagnose(q);
                      }}
                      className="px-2 py-1 bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 rounded text-[9.2px] hover:text-slate-100 transition text-left shrink-0 cursor-pointer"
                    >
                      ⚡ MAP CO-PROCESSOR AUDIT
                    </button>
                    <button
                      onClick={() => {
                        const q = "Analyze elevation height limits inside Lumbridge terrain grid boundaries to prevent object clipping faults";
                        setCfPrompt(q);
                        handleCfDiagnose(q);
                      }}
                      className="px-2 py-1 bg-slate-950 border border-slate-855 hover:border-slate-700 text-slate-400 rounded text-[9.2px] hover:text-slate-100 transition text-left shrink-0 cursor-pointer"
                    >
                      ⚠️ HEIGHT ELEVATION CALIBRATOR
                    </button>
                  </div>
                </div>

                <div className="pt-1 select-none">
                  <button
                    disabled={cfLoading}
                    onClick={() => handleCfDiagnose()}
                    className="w-full py-2 bg-slate-950 border border-slate-800 hover:border-slate-650 text-slate-300 font-bold rounded cursor-pointer transition text-[10px] flex items-center justify-center gap-1.5 font-mono uppercase"
                  >
                    {cfLoading ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-orange-400" />
                        <span>Edge Response Pending...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                        <span>Query Co-Processor</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Live Edge Output logs */}
              <div className="md:col-span-7 flex flex-col justify-between">
                <span className="text-[9px] text-slate-450 font-mono block uppercase tracking-wider mb-2 font-bold select-none">
                  Registry Response Stream
                </span>

                <div className="flex-1 bg-slate-950 border border-slate-850 rounded-lg p-3 min-h-[170px] flex flex-col justify-between overflow-y-auto max-h-56 select-text">
                  {cfLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-2 flex-1">
                      <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-orange-400 font-mono text-[9.5px] uppercase font-bold tracking-widest animate-pulse">
                        Querying Edge Substrate...
                      </span>
                    </div>
                  ) : cfError ? (
                    <div className="p-3 bg-red-955/20 border border-red-900 rounded text-red-400 font-mono text-[9.5px] leading-relaxed flex-1">
                      <div className="flex items-center gap-1.5 font-bold mb-1 select-none">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                        EDGE QUERY TIMEOUT
                      </div>
                      {cfError}
                      <div className="mt-2 text-[8px] text-slate-500">
                        Check your workspace local environment setups and settings parameter configs.
                      </div>
                    </div>
                  ) : cfResponse ? (
                    <div className="font-mono text-[10px] text-slate-300 leading-relaxed flex-1 select-text">
                      <div className="text-[8px] text-slate-500 uppercase font-bold mb-1.5 tracking-wider flex items-center justify-between border-b border-slate-900 pb-1 border-dashed">
                        <span>EDGE DIAGNOSTIC RESPONSE COMPLETE</span>
                        {CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN ? (
                          <span className="text-emerald-400 font-normal">● LIVE INFERENCE ROUTE</span>
                        ) : (
                          <span className="text-amber-500 font-normal">▲ SANDBOX CASCADE INF</span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{cfResponse}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-600 flex-1 select-none text-center">
                      <Terminal className="h-7 w-7 text-slate-800 mb-1 shrink-0 animate-pulse" />
                      <span className="font-mono text-[8.5px] uppercase font-bold tracking-wider text-slate-500">
                        STREAM IDLE: WAITING_FOR_PROMPT
                      </span>
                      <p className="text-[8.5px] text-slate-500 max-w-xs font-sans mt-0.5 leading-normal">
                        Write a custom directive or query inside the input field, or click on a quick preset above to invoke edge analysis.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Historical terminal log stream on bottom */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-lg font-mono text-[10px]">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 select-none">
          <span className="font-bold text-slate-350 tracking-wider uppercase flex items-center gap-1">
            <FileText className="h-4 w-4 text-orange-400" />
            Headless Compiler Log (nodegl virtual shell stdout)
          </span>
          <button
            onClick={() => setTerminalLogs(["MHD_MAP_ENGINE_CO_PROCESSOR: Logs cleared cleanly."])}
            className="text-[8.5px] text-slate-500 hover:text-slate-300 transition uppercase font-bold cursor-pointer"
          >
            Clear logs
          </button>
        </div>

        <div className="bg-slate-950 p-3.5 rounded border border-slate-850 h-32 overflow-y-auto space-y-1 scrollbar-thin flex flex-col-reverse">
          {terminalLogs.map((log, idx) => {
            let color = "text-slate-400";
            if (log.startsWith("[CRITICAL") || log.startsWith("[io")) color = "text-rose-400 font-bold";
            else if (log.startsWith("[CONFIG]")) color = "text-emerald-400";
            else if (log.startsWith("[nodegl] Done") || log.startsWith("[preload]")) color = "text-cyan-400 font-medium";
            else if (log.startsWith("[render")) color = "text-amber-400";
            
            return (
              <div key={idx} className={`${color} leading-relaxed font-mono text-[9.5px]`}>
                &gt; {log}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
