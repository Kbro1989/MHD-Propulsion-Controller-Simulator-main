import React, { useState, useEffect, useRef } from "react";
import {
  Compass,
  Settings,
  Database,
  Search,
  Dna,
  Layers,
  Sparkles,
  Command,
  FileCode,
  Shield,
  Shuffle,
  Wrench,
  Grid,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Plus
} from "lucide-react";
import playerSync from "../utils/playerSync";

// ============================================================================
// DATA MODELS & TYPES
// ============================================================================
export interface Coord {
  x: number;
  y: number;
  plane: number;
}

export type Direction =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west"
  | "up"
  | "down";

export interface TileLogic {
  walkable: boolean;
  hiddenBlockage?: boolean;
  edges?: {
    northBlocked?: boolean;
    southBlocked?: boolean;
    eastBlocked?: boolean;
    westBlocked?: boolean;
  };
  npc_only_blocks?: string[];
}

export type GridState = Record<string, TileLogic>;

export interface KineticAgent {
  id: string;
  name: string;
  type: "player" | "mouse_toy" | "platypus" | "patrol_guard";
  coord: Coord;
  color: string;
  path: Coord[];
  patrolRoute?: Coord[];
  patrolIndex?: number;
  lastX?: number;
  lastY?: number;
  direction?: string;
  lastSprite?: string;
  lastClientActivity?: number;
}

// Comparable interface for BinaryHeap
export interface Comparable<T> {
  compare(other: T): number;
}

// ============================================================================
// 1. PATH NORMALIZER - SOVEREIGN PATH AESTHETIC PROCESSOR
// ============================================================================
export class PathNormalizer {
  private static projectRoot: string = "C:\\Users\\Destiny\\Desktop\\pog-vibe-interactive";
  private static home: string = "C:\\Users\\Destiny";
  private static sovereignRoot: string = "D:\\sovereign";

  public static normalize(absolutePath: string): string {
    if (!absolutePath) return absolutePath;
    const normalized = absolutePath.replace(/\//g, "\\");

    if (normalized.startsWith(this.projectRoot)) {
      let rel = normalized.substring(this.projectRoot.length);
      if (rel.startsWith("\\")) rel = rel.substring(1);
      return rel === "" ? "." : `.\\${rel}`;
    }

    if (normalized.toLowerCase().startsWith(this.sovereignRoot.toLowerCase())) {
      const rel = normalized.substring(this.sovereignRoot.length);
      const cleanedRel = rel.replace(/^[\\/]/, "").replace(/\\/g, "/");
      return `POG2://${cleanedRel}`;
    }

    if (normalized.startsWith(this.home)) {
      let rel = normalized.substring(this.home.length);
      if (rel.startsWith("\\")) rel = rel.substring(1);
      return `~\\${rel}`;
    }

    return absolutePath;
  }

  public static normalizeString(text: string): string {
    const pathRegex = /([a-zA-Z]:[\\/][^:?*"<>|\r\n]+)/g;
    return text.replace(pathRegex, (match) => {
      if (match.includes("\\") || match.includes("/") || match.includes(".")) {
        return this.normalize(match);
      }
      return match;
    });
  }

  public static relative(absolutePath: string): string {
    const normalized = absolutePath.replace(/\//g, "\\");
    if (normalized.startsWith(this.projectRoot)) {
      let rel = normalized.substring(this.projectRoot.length);
      if (rel.startsWith("\\")) rel = rel.substring(1);
      return rel;
    }
    return absolutePath;
  }
}

// ============================================================================
// 2. SOVEREIGN PATH RESOLVER
// ============================================================================
export class SovereignPathResolver {
  private static AUTHORITATIVE_ROOT = "D:\\sovereign";
  private static LOCAL_ROOT = "c:\\Users\\Destiny\\Desktop\\pog-vibe-interactive\\files";

  private static simulatedFiles = new Set<string>([
    "D:\\sovereign\\atlas\\spatial\\m_55_50_logic.json",
    "D:\\sovereign\\refilled\\js5-12\\102_logic.json",
    "D:\\sovereign\\refilled\\js5-10\\99_logic.json",
    "D:\\sovereign\\atlas\\spatial\\pathing_theory\\ge_keldagrim_trace.json",
    "D:\\sovereign\\cache_pedagogy\\json_dumps\\objects.json",
    "D:\\sovereign\\cache_pedagogy\\json_dumps\\npcs.json",
    "D:\\sovereign\\memory\\pedagogy\\varbits.json",
    "D:\\sovereign\\memory\\pedagogy\\kinematics.json"
  ]);

  static resolveauthoritativePath(relativePath: string): string {
    const normalizedRel = relativePath.split(/[\\\/]/).join("\\");
    const dPath = `${this.AUTHORITATIVE_ROOT}\\${normalizedRel}`;

    if (this.simulatedFiles.has(dPath)) {
      return dPath;
    }

    return `${this.LOCAL_ROOT}\\${normalizedRel}`;
  }

  static resolveLogicFragment(major: number, id: number): string {
    const rel = `refilled\\js5-${major}\\${id}_logic.json`;
    return this.resolveauthoritativePath(rel);
  }

  static resolveSpatialAnchor(coordKey: string): string {
    const rel = `atlas\\spatial\\${coordKey}_logic.json`;
    return this.resolveauthoritativePath(rel);
  }
}

// ============================================================================
// 3. BINARY HEAP UTILITY (Min-Heap)
// ============================================================================
export class BinaryHeap<T extends Comparable<T>> {
  private data: T[] = [];

  public insert(item: T): void {
    this.data.push(item);
    this.upHeap(this.data.length - 1);
  }

  public pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const result = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.downHeap(0);
    }
    return result;
  }

  public isEmpty(): boolean {
    return this.data.length === 0;
  }

  private upHeap(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.data[index].compare(this.data[parent]) >= 0) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  private downHeap(index: number): void {
    const length = this.data.length;
    while (2 * index + 1 < length) {
      let left = 2 * index + 1;
      let right = left + 1;
      let smallest = left;
      if (right < length && this.data[right].compare(this.data[left]) < 0) {
        smallest = right;
      }
      if (this.data[index].compare(this.data[smallest]) <= 0) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.data[i];
    this.data[i] = this.data[j];
    this.data[j] = temp;
  }
}

// ============================================================================
// 4. PLANE TRANSITION REGISTRY (STAIR PORTS)
// ============================================================================
export class PlaneTransitionRegistry {
  private static instance: PlaneTransitionRegistry | null = null;
  private links = new Map<string, { from: Coord; to: Coord; type?: string }>();

  public static getInstance(): PlaneTransitionRegistry {
    if (!this.instance) {
      this.instance = new PlaneTransitionRegistry();
    }
    return this.instance;
  }

  public setLink(from: Coord, to: Coord, type?: string) {
    const key = `${from.plane}_${from.x}_${from.y}`;
    this.links.set(key, { from, to, type });
  }

  public getLink(from: Coord): { from: Coord; to: Coord; type?: string } | null {
    const key = `${from.plane}_${from.x}_${from.y}`;
    return this.links.get(key) || null;
  }

  public clear() {
    this.links.clear();
  }
}

// ============================================================================
// 5. DIRECTIONAL PATHFINDER NODE & ALGORITHM
// ============================================================================
class PathNode implements Comparable<PathNode> {
  public x: number;
  public y: number;
  public plane: number;
  public gScore: number;
  public fScore: number;
  public parent?: PathNode;

  constructor(coord: Coord, gScore: number, fScore: number, parent?: PathNode) {
    this.x = coord.x;
    this.y = coord.y;
    this.plane = coord.plane;
    this.gScore = gScore;
    this.fScore = fScore;
    this.parent = parent;
  }

  compare(other: PathNode): number {
    return this.fScore - other.fScore;
  }

  toCoord(): Coord {
    return { x: this.x, y: this.y, plane: this.plane };
  }

  get key(): string {
    return `${this.plane}_${this.x}_${this.y}`;
  }
}

export interface SpatialSovereigntyLimb {
  getLogicAt(plane: number, x: number, y: number): TileLogic | null;
  isWalkable(plane: number, x: number, y: number): boolean;
}

export class DirectionalPathfinder {
  constructor(private spatial: SpatialSovereigntyLimb) {}

  public findPath(
    start: Coord,
    end: Coord,
    npcIndex?: Map<string, any[]>,
    isPlayer = true,
    debug = false
  ): Coord[] {
    const openSet = new BinaryHeap<PathNode>();
    const closedSet = new Set<string>();
    const gScores = new Map<string, number>();

    const startNode = new PathNode(start, 0, this.heuristic(start, end));
    openSet.insert(startNode);
    gScores.set(startNode.key, 0);

    let iterations = 0;
    const MAX_ITERATIONS = Math.max(3000, Math.floor(this.heuristic(start, end) * 75));

    while (!openSet.isEmpty() && iterations < MAX_ITERATIONS) {
      iterations++;
      const current = openSet.pop()!;

      if (current.x === end.x && current.y === end.y && current.plane === end.plane) {
        if (debug) console.log(`Path found in ${iterations} iterations.`);
        return this.reconstructPath(current);
      }

      closedSet.add(current.key);

      const neighbors = this.getNeighbors(current);
      for (const { coord: next, direction } of neighbors) {
        const nKey = `${next.plane}_${next.x}_${next.y}`;

        if (closedSet.has(nKey)) continue;

        const canMove = this.canMove(current.toCoord(), next, direction, npcIndex, isPlayer);
        if (!canMove) continue;

        const tentativeG = current.gScore + 1;
        const existingG = gScores.get(nKey) ?? Infinity;

        if (tentativeG < existingG) {
          const nextNode = new PathNode(
            next,
            tentativeG,
            tentativeG + this.heuristic(next, end),
            current
          );
          gScores.set(nKey, tentativeG);
          openSet.insert(nextNode);
        }
      }
    }

    if (debug) console.warn(`No path found after ${iterations} iterations.`);
    return [];
  }

  public canMove(
    from: Coord,
    to: Coord,
    direction: Direction,
    npcIndex?: Map<string, any[]>,
    isPlayer = true
  ): boolean {
    if (direction === "up" || direction === "down") {
      const registry = PlaneTransitionRegistry.getInstance();
      const link = registry.getLink(from);
      return (
        link !== null &&
        link.to.x === to.x &&
        link.to.y === to.y &&
        link.to.plane === to.plane
      );
    }

    if (!this.isWalkable(to.plane, to.x, to.y)) {
      return false;
    }

    if (npcIndex) {
      const key = `${to.x},${to.y},${to.plane}`;
      if (npcIndex.has(key)) {
        return false;
      }
    }

    // DIAGONAL CLIP RULE
    if (
      direction === "north-east" ||
      direction === "north-west" ||
      direction === "south-east" ||
      direction === "south-west"
    ) {
      const isNorth = direction.includes("north");
      const isSouth = direction.includes("south");
      const isEast = direction.includes("east");
      const isWest = direction.includes("west");

      const orth1X = isEast ? from.x + 1 : isWest ? from.x - 1 : from.x;
      const orth1Y = from.y;
      const orth2X = from.x;
      const orth2Y = isNorth ? from.y + 1 : isSouth ? from.y - 1 : from.y;

      if (!this.isWalkable(from.plane, orth1X, orth1Y)) return false;
      if (!this.isWalkable(from.plane, orth2X, orth2Y)) return false;

      if (isNorth) {
        if (!this.canTransit(from, to, "north", isPlayer)) return false;
      }
      if (isSouth) {
        if (!this.canTransit(from, to, "south", isPlayer)) return false;
      }
      if (isEast) {
        if (!this.canTransit(from, to, "east", isPlayer)) return false;
      }
      if (isWest) {
        if (!this.canTransit(from, to, "west", isPlayer)) return false;
      }

      return true;
    }

    return this.canTransit(from, to, direction, isPlayer);
  }

  private canTransit(
    from: Coord,
    to: Coord,
    direction: Direction,
    isPlayer = true
  ): boolean {
    const fromLogic = this.spatial.getLogicAt(from.plane, from.x, from.y);
    const toLogic = this.spatial.getLogicAt(to.plane, to.x, to.y);

    if (fromLogic === null || toLogic === null) return false;

    // From Tile Edge Blocking
    if (typeof fromLogic === "object") {
      const c = fromLogic as any;
      if (!isPlayer && c.npc_only_blocks?.includes(direction)) return false;

      if (c.edges) {
        const edges = c.edges;
        if (direction === "north" && edges.northBlocked) return false;
        if (direction === "south" && edges.southBlocked) return false;
        if (direction === "east" && edges.eastBlocked) return false;
        if (direction === "west" && edges.westBlocked) return false;
      }
    }

    // To Tile Edge Blocking
    const reverseDir = this.getReverseDirection(direction);
    if (typeof toLogic === "object") {
      const c = toLogic as any;
      if (!isPlayer && c.npc_only_blocks?.includes(reverseDir)) return false;

      if (c.edges) {
        const edges = c.edges;
        if (reverseDir === "north" && edges.northBlocked) return false;
        if (reverseDir === "south" && edges.southBlocked) return false;
        if (reverseDir === "east" && edges.eastBlocked) return false;
        if (reverseDir === "west" && edges.westBlocked) return false;
      }
    }

    return true;
  }

  private isWalkable(p: number, x: number, z: number): boolean {
    return this.spatial.isWalkable(p, x, z);
  }

  private heuristic(a: Coord, b: Coord): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const dp = Math.abs(a.plane - b.plane);
    return (Math.max(dx, dy) + dp * 10) * 1.01;
  }

  private getNeighbors(node: PathNode): { coord: Coord; direction: Direction }[] {
    const neighbors: { coord: Coord; direction: Direction }[] = [
      { coord: { x: node.x, y: node.y + 1, plane: node.plane }, direction: "north" },
      { coord: { x: node.x, y: node.y - 1, plane: node.plane }, direction: "south" },
      { coord: { x: node.x + 1, y: node.y, plane: node.plane }, direction: "east" },
      { coord: { x: node.x - 1, y: node.y, plane: node.plane }, direction: "west" },
      {
        coord: { x: node.x + 1, y: node.y + 1, plane: node.plane },
        direction: "north-east"
      },
      {
        coord: { x: node.x - 1, y: node.y + 1, plane: node.plane },
        direction: "north-west"
      },
      {
        coord: { x: node.x + 1, y: node.y - 1, plane: node.plane },
        direction: "south-east"
      },
      {
        coord: { x: node.x - 1, y: node.y - 1, plane: node.plane },
        direction: "south-west"
      }
    ];

    const link = PlaneTransitionRegistry.getInstance().getLink(node.toCoord());
    if (link) {
      const dir: Direction = link.to.plane > node.plane ? "up" : "down";
      neighbors.push({ coord: link.to, direction: dir });
    }

    return neighbors;
  }

  private getReverseDirection(dir: Direction): Direction {
    const map: Record<Direction, Direction> = {
      north: "south",
      south: "north",
      east: "west",
      west: "east",
      "north-east": "south-west",
      "south-west": "north-east",
      "north-west": "south-east",
      "south-east": "north-west",
      up: "down",
      down: "up"
    };
    return map[dir];
  }

  private reconstructPath(node: PathNode): Coord[] {
    const path: Coord[] = [];
    let curr: PathNode | undefined = node;
    while (curr) {
      path.unshift(curr.toCoord());
      curr = curr.parent;
    }
    return path;
  }
}

// ============================================================================
// DETERMINISTIC SKILL-BASED PATHING MODELS
// ============================================================================
export interface SkillObstacle {
  x: number;
  y: number;
  plane: number;
  skill: "agility" | "thieving" | "strength" | "magic";
  levelRequired: number;
  label: string;
  color: string;
  icon: string;
}

export const SKILL_OBSTACLES: SkillObstacle[] = [
  { x: 33, y: 20, plane: 0, skill: "agility", levelRequired: 5, label: "Agility Squeeze", color: "#10b981", icon: "🏃" },
  { x: 33, y: 40, plane: 0, skill: "agility", levelRequired: 30, label: "Agility Leap", color: "#059669", icon: "🤸" },
  { x: 13, y: 21, plane: 0, skill: "thieving", levelRequired: 10, label: "Simple Gate", color: "#d97706", icon: "⚿" },
  { x: 23, y: 21, plane: 0, skill: "thieving", levelRequired: 50, label: "Dwarven Gate", color: "#b45309", icon: "🧳" },
  { x: 33, y: 30, plane: 0, skill: "strength", levelRequired: 25, label: "Rubble Blockade", color: "#ea580c", icon: "✊" },
  { x: 33, y: 50, plane: 0, skill: "magic", levelRequired: 40, label: "Aetherial Rift", color: "#8b5cf6", icon: "✨" }
];

// ============================================================================
// MAIN COMPONENT - NTX STYLE WORLD BUFFER GENERATOR
// ============================================================================
export default function NtxWorldBuffer() {
  // Loaded player character register state mapped deterministically for pathfinding routines
  const [playerState, setPlayerState] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("pog2_mhd_player_state");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  // Dynamic state sync loop with loaded state registry
  const refreshSkills = () => {
    try {
      const cached = localStorage.getItem("pog2_mhd_player_state");
      if (cached) {
        setPlayerState(JSON.parse(cached));
      }
    } catch (e) {}
  };

  useEffect(() => {
    const handleStorageChange = () => refreshSkills();
    window.addEventListener("storage", handleStorageChange);
    // Poll local cache occasionally in case storage event does not bubble in single window tabs
    const interval = setInterval(refreshSkills, 1500);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Config & Selection State
  const [activePlane, setActivePlane] = useState<number>(0);
  const [currentTool, setCurrentTool] = useState<"paint_walls" | "clear_walls" | "select_start" | "select_goal" | "directional_block" | "sensor_placement" | "spawn_agent">("paint_walls");
  const [selectedDirection, setSelectedDirection] = useState<"north" | "south" | "east" | "west">("north");
  const [characterMode, setCharacterMode] = useState<"player" | "npc">("player");
  const [diagonalClipEnabled, setDiagonalClipEnabled] = useState<boolean>(true);

  // Clockwork Mouse and GhostSplat states
  const [mouseReleased, setMouseReleased] = useState<boolean>(false);
  const [discoveredBlockages, setDiscoveredBlockages] = useState<Record<string, boolean>>({});
  const [isGhostSplatActive, setIsGhostSplatActive] = useState<boolean>(true);
  const mouseHistoryRef = useRef<Coord[]>([]);

  // Normalizer Inputs
  const [inputPath, setInputPath] = useState<string>("D:\\sovereign\\cache_pedagogy\\json_dumps\\objects.json");
  const [normalizedResult, setNormalizedResult] = useState<string>("");

  // DB Table queries
  const [dbSearchQuery, setDbSearchQuery] = useState<string>("");
  const [activeDbTable, setActiveDbTable] = useState<"objects" | "npcs" | "varbits" | "dbrow_state">("objects");
  const [selectedDbRow, setSelectedDbRow] = useState<any | null>(null);

  // Varbits simulation keys
  const [simVarbits, setSimVarbits] = useState<Record<number, number>>({
    1004: 0, // Mine cart switch A
    1005: 0, // Stair locks
    1020: 1  // Sector sensor active
  });

  // 66x66 grid simulation state
  const [gridState, setGridState] = useState<GridState>(() => {
    const initial: GridState = {};
    // Add some random/preset obstacles resembling RS regions (e.g. tracks, rivers, rooms)
    for (let x = 0; x < 66; x++) {
      for (let y = 0; y < 66; y++) {
        for (let p = 0; p < 3; p++) {
          const key = `${p}_${x}_${y}`;
          let walkable = true;

          // Preset 1: Surrounding walls for the boundary
          let hiddenBlockage = false;
          if (x === 0 || x === 65 || y === 0 || y === 65) {
            walkable = false;
          }
          // Preset 2: Minecart track obstacle walls running centrally
          else if (x === 33 && y > 10 && y < 55) {
            walkable = false;
            hiddenBlockage = true;
          }
          // Preset 3: Small dwarven chambers
          else if (p === 0 && x > 12 && x < 24 && y > 15 && y < 27) {
            // Leave center empty but make borders walls
            if (x === 13 || x === 23 || y === 16 || y === 26) {
              // Leave door
              if (y !== 21) {
                walkable = false;
                hiddenBlockage = true;
              }
            }
          }

          initial[key] = {
            walkable,
            hiddenBlockage,
            edges: {
              northBlocked: false,
              southBlocked: false,
              eastBlocked: false,
              westBlocked: false
            },
            npc_only_blocks: []
          };
        }
      }
    }
    return initial;
  });

  // Start & Goal coordinates for pathfinder
  const [startCoord, setStartCoord] = useState<Coord>({ x: 5, y: 5, plane: 0 });
  const [goalCoord, setGoalCoord] = useState<Coord>({ x: 45, y: 35, plane: 0 });
  const [currentPath, setCurrentPath] = useState<Coord[]>([]);
  const [stepThroughPathActive, setStepThroughPathActive] = useState<boolean>(false);

  // Simulation parameters for Gaussian Footprint
  const [sensorCenter, setSensorCenter] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [sensorActive, setSensorActive] = useState<boolean>(true);
  const [gaussianSigma, setGaussianSigma] = useState<number>(6.5);
  const [gaussianAmp, setGaussianAmp] = useState<number>(0.95);

  // Entities & Kinetis simulation states
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);
  const [simTick, setSimTick] = useState<number>(0);
  const [agents, setAgents] = useState<KineticAgent[]>([
    {
      id: "player",
      name: "Sovereign Player",
      type: "player",
      coord: { x: 5, y: 5, plane: 0 },
      color: "#f87171", // soft-red
      path: [],
      lastX: 5,
      lastY: 5,
      direction: "north",
      lastSprite: "north",
      lastClientActivity: Date.now()
    },
    {
      id: "mouse_toy",
      name: "Wind-up Mouse Toy",
      type: "mouse_toy",
      coord: { x: 18, y: 21, plane: 0 },
      color: "#22d3ee", // cyan
      path: [],
      lastX: 18,
      lastY: 21,
      direction: "east",
      lastSprite: "east",
      lastClientActivity: Date.now()
    },
    {
      id: "platypus",
      name: "Platypus Follower",
      type: "platypus",
      coord: { x: 8, y: 12, plane: 0 },
      color: "#10b981", // emerald
      path: [],
      lastX: 8,
      lastY: 12,
      direction: "north",
      lastSprite: "north",
      lastClientActivity: Date.now()
    },
    {
      id: "patrol_guard",
      name: "Sovereign Patrol Guard",
      type: "patrol_guard",
      coord: { x: 26, y: 10, plane: 0 },
      color: "#fbbf24", // yellow
      path: [],
      patrolRoute: [
        { x: 26, y: 10, plane: 0 },
        { x: 26, y: 30, plane: 0 },
        { x: 30, y: 30, plane: 0 },
        { x: 30, y: 10, plane: 0 }
      ],
      patrolIndex: 0,
      lastX: 26,
      lastY: 10,
      direction: "north",
      lastSprite: "north",
      lastClientActivity: Date.now()
    }
  ]);

  // Detected Agents in Gaussian sweep
  const [detectedAgents, setDetectedAgents] = useState<string[]>([]);

  // Pop to Surface animation structure & state
  interface PopAnimation {
    id: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    progress: number;
    label: string;
  }
  const [popAnimations, setPopAnimations] = useState<PopAnimation[]>([]);

  // Find nearest walkable surface tile
  const findNearestSurface = (
    x: number,
    y: number,
    plane: number,
    currentGrid: GridState = gridState,
    occupiedCoords?: Set<string>
  ): Coord => {
    const size = 66;
    // Spiral BFS Search
    const queue: [number, number][] = [[x, y]];
    const visited = new Set<string>();
    visited.add(`${x}_${y}`);

    let index = 0;
    while (index < queue.length) {
      const [cx, cy] = queue[index++];
      
      // If it's a valid interior coordinate and it's walkable, we found it!
      if (cx > 0 && cx < 65 && cy > 0 && cy < 65) {
        const key = `${plane}_${cx}_${cy}`;
        const tile = currentGrid[key];
        const isWalkable = !tile || tile.walkable;
        const isOccupied = occupiedCoords ? occupiedCoords.has(key) : false;

        if (isWalkable && !isOccupied) {
          return { x: cx, y: cy, plane };
        }
      }

      // Check adjacent neighbors
      const neighbors = [
        [cx, cy - 1], // N
        [cx, cy + 1], // S
        [cx + 1, cy], // E
        [cx - 1, cy], // W
        [cx + 1, cy - 1], // NE
        [cx - 1, cy - 1], // NW
        [cx + 1, cy + 1], // SE
        [cx - 1, cy + 1]  // SW
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          const nKey = `${nx}_${ny}`;
          if (!visited.has(nKey)) {
            visited.add(nKey);
            queue.push([nx, ny]);
          }
        }
      }
    }
    // Fallback default safe start
    return { x: 5, y: 5, plane };
  };

  const triggerPop = (id: string, name: string, fromX: number, fromY: number, toX: number, toY: number) => {
    const animId = `${id}_${Date.now()}`;
    setPopAnimations(prev => [
      ...prev,
      {
        id: animId,
        fromX,
        fromY,
        toX,
        toY,
        progress: 0,
        label: name
      }
    ]);
    setTerminalLogs((prev) => [
      ...prev,
      `[PATH] Pop detected! "${name}" popped to surface: (${fromX}, ${fromY}) ➔ (${toX}, ${toY}) due to boundary/collision`
    ]);
  };

  // Pop animation progress updater
  useEffect(() => {
    if (popAnimations.length === 0) return;
    const timer = setInterval(() => {
      setPopAnimations((prev) =>
        prev
          .map((anim) => ({ ...anim, progress: anim.progress + 0.1 }))
          .filter((anim) => anim.progress <= 1)
      );
    }, 40);
    return () => clearInterval(timer);
  }, [popAnimations]);

  // Console Logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "[SYS] NTX 66x66 World Buffer engine initialized.",
    "[SYS] Mapping spatial authority pointers to D:\\sovereign",
    "[SYS] Quaternary A* collision matrix loaded with standard boundaries."
  ]);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Set default Plane transition stairs and gateways
  useEffect(() => {
    const registry = PlaneTransitionRegistry.getInstance();
    registry.clear();
    // Default stairs connecting plane 0, plane 1, plane 2
    registry.setLink({ x: 20, y: 21, plane: 0 }, { x: 20, y: 21, plane: 1 }, "stairs");
    registry.setLink({ x: 20, y: 21, plane: 1 }, { x: 20, y: 21, plane: 0 }, "stairs");
    registry.setLink({ x: 40, y: 40, plane: 1 }, { x: 40, y: 40, plane: 2 }, "stairs");
    registry.setLink({ x: 40, y: 40, plane: 2 }, { x: 40, y: 40, plane: 1 }, "stairs");

    // Add Cosmic Portals linking plane 0 and plane 2 directly (Complete level bypass!)
    registry.setLink({ x: 10, y: 10, plane: 0 }, { x: 10, y: 10, plane: 2 }, "portal");
    registry.setLink({ x: 10, y: 10, plane: 2 }, { x: 10, y: 10, plane: 0 }, "portal");

    // Add Ladders
    registry.setLink({ x: 55, y: 15, plane: 0 }, { x: 55, y: 15, plane: 1 }, "ladder");
    registry.setLink({ x: 55, y: 15, plane: 1 }, { x: 55, y: 15, plane: 0 }, "ladder");
    registry.setLink({ x: 15, y: 55, plane: 1 }, { x: 15, y: 55, plane: 2 }, "ladder");
    registry.setLink({ x: 15, y: 55, plane: 2 }, { x: 15, y: 55, plane: 1 }, "ladder");

    // Add Dwarven Heavy Door Hatch 
    registry.setLink({ x: 30, y: 25, plane: 0 }, { x: 30, y: 25, plane: 1 }, "door");
    registry.setLink({ x: 30, y: 25, plane: 1 }, { x: 30, y: 25, plane: 0 }, "door");

    // Add Mine Caves
    registry.setLink({ x: 45, y: 45, plane: 1 }, { x: 45, y: 45, plane: 2 }, "cave");
    registry.setLink({ x: 45, y: 45, plane: 2 }, { x: 45, y: 45, plane: 1 }, "cave");

    // Add Agility/Leverage Shortcut
    registry.setLink({ x: 8, y: 35, plane: 0 }, { x: 8, y: 35, plane: 1 }, "shortcut");
    registry.setLink({ x: 8, y: 35, plane: 1 }, { x: 8, y: 35, plane: 0 }, "shortcut");

    // Log the configuration
    setTerminalLogs((prev) => [
      ...prev,
      "[VHDL] Multiplex plane transition network established!",
      "[VHDL] * Stairs: (20,21,P0) <-> (20,21,P1) and (40,40,P1) <-> (40,40,P2)",
      "[VHDL] * Cosmic Portals [Bypass]: (10,10,P0) <-> (10,10,P2)",
      "[VHDL] * Ladders: (55,15,P0)<->(55,15,P1) and (15,55,P1)<->(15,55,P2)",
      "[VHDL] * Heavy Doors: (30,25,P0) <-> (30,25,P1)",
      "[VHDL] * Mine Caves: (45,45,P1) <-> (45,45,P2)",
      "[VHDL] * Leverage Shortcuts: (8,35,P0) <-> (8,35,P1)",
    ]);
  }, []);

  // Run pathfinder when coordinates, grid walls, or diagonal configurations change
  useEffect(() => {
    recalculatePlayerPath();
  }, [startCoord, goalCoord, activePlane, gridState, diagonalClipEnabled, characterMode, playerState]);

  const recalculatePlayerPath = () => {
    const spatialLimb: SpatialSovereigntyLimb = {
      getLogicAt: (p, x, y) => {
        const key = `${p}_${x}_${y}`;
        return gridState[key] || null;
      },
      isWalkable: (p, x, y) => {
        // If there is an active skill obstacle on this tile on the specific plane, consult player skills deterministically
        const skillObs = SKILL_OBSTACLES.find(obs => obs.x === x && obs.y === y && obs.plane === p);
        if (skillObs) {
          const skills = playerState?.skills;
          let level = 1;
          if (skills) {
            level = skills[skillObs.skill]?.current ?? 1;
          }
          return level >= skillObs.levelRequired;
        }

        const key = `${p}_${x}_${y}`;
        const tile = gridState[key];
        if (!tile) return true;
        // If it's a hidden blockage and not discovered yet, it is walkable for player pathing
        if (!tile.walkable && tile.hiddenBlockage && !discoveredBlockages[key]) {
          return true;
        }
        return tile.walkable;
      }
    };

    const pathfinder = new DirectionalPathfinder(spatialLimb);

    // Build helper isNPC blocking lookup map
    const npcMap = new Map<string, any[]>();
    // Inject active non-player agent coordinates
    agents.forEach((agent) => {
      if (agent.id !== "player" && agent.coord.plane === activePlane) {
        npcMap.set(`${agent.coord.x},${agent.coord.y},${agent.coord.plane}`, [agent]);
      }
    });

    const path = pathfinder.findPath(
      startCoord,
      goalCoord,
      npcMap,
      characterMode === "player",
      false
    );

    setCurrentPath(path);

    // Also update player agent's planned path
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === "player") {
          return { ...agent, coord: startCoord, path };
        }
        return agent;
      })
    );
  };

  // Run dynamic simulation loop
  useEffect(() => {
    if (!isSimPlaying) return;

    const interval = setInterval(() => {
      setSimTick((prev) => prev + 1);
      advanceSimulationTick();
    }, 450);

    return () => clearInterval(interval);
  }, [isSimPlaying, agents, gridState, sensorCenter, gaussianSigma]);

  // Calculate GhostSplat Heat Overlay for rendering and AI decisions
  const getGhostSplatHeat = (agentsInput: KineticAgent[], activePlaneInput: number) => {
    const heat = new Float32Array(66 * 66);
    
    // 1. Player aura: creates positive blue heat that trails or glows around player
    const player = agentsInput.find(a => a.id === "player");
    if (player && player.coord.plane === activePlaneInput) {
      const px = player.coord.x;
      const py = player.coord.y;
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          const tx = px + dx;
          const ty = py + dy;
          if (tx >= 0 && tx < 66 && ty >= 0 && ty < 66) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= 3) {
              heat[ty * 66 + tx] += (3 - dist) * 0.15; // player cyan glow
            }
          }
        }
      }
    }

    // 2. Guard aura: creates aggressive heat (red) with radius 4
    const guard = agentsInput.find(a => a.type === "patrol_guard");
    if (guard && guard.coord.plane === activePlaneInput) {
      const gx = guard.coord.x;
      const gy = guard.coord.y;
      for (let dx = -4; dx <= 4; dx++) {
        for (let dy = -4; dy <= 4; dy++) {
          const tx = gx + dx;
          const ty = gy + dy;
          if (tx >= 0 && tx < 66 && ty >= 0 && ty < 66) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= 4) {
              // High alert heat near the guard
              heat[ty * 66 + tx] += (4 - dist) * 0.25; // guard aggressive heat
            }
          }
        }
      }
    }

    // 3. Mouse aura: scans with cyan/purple heat with radius 3
    const mouse = agentsInput.find(a => a.id === "mouse_toy");
    if (mouse && mouse.coord.plane === activePlaneInput && mouseReleased) {
      const mx = mouse.coord.x;
      const my = mouse.coord.y;
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          const tx = mx + dx;
          const ty = my + dy;
          if (tx >= 0 && tx < 66 && ty >= 0 && ty < 66) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= 3) {
              heat[ty * 66 + tx] += (3 - dist) * 0.20; // mouse scout aura
            }
          }
        }
      }
    }

    return heat;
  };

  // Execute one tick logic
  const advanceSimulationTick = () => {
    const spatialLimb: SpatialSovereigntyLimb = {
      getLogicAt: (p, x, y) => {
        const key = `${p}_${x}_${y}`;
        return gridState[key] || null;
      },
      isWalkable: (p, x, y) => {
        // If there is an active skill obstacle on this tile on the specific plane, consult player skills deterministically
        const skillObs = SKILL_OBSTACLES.find(obs => obs.x === x && obs.y === y && obs.plane === p);
        if (skillObs) {
          const skills = playerState?.skills;
          let level = 1;
          if (skills) {
            level = skills[skillObs.skill]?.current ?? 1;
          }
          return level >= skillObs.levelRequired;
        }

        const key = `${p}_${x}_${y}`;
        const tile = gridState[key];
        if (!tile) return true;
        // Player pathfinding treats undiscovered hidden blockages as walkable.
        if (!tile.walkable && tile.hiddenBlockage && !discoveredBlockages[key]) {
          return true;
        }
        return tile.walkable;
      }
    };
    const spatialLimbTrue: SpatialSovereigntyLimb = {
      getLogicAt: (p, x, y) => {
        const key = `${p}_${x}_${y}`;
        return gridState[key] || null;
      },
      isWalkable: (p, x, y) => {
        // If there is an active skill obstacle on this tile on the specific plane, consult player skills deterministically
        const skillObs = SKILL_OBSTACLES.find(obs => obs.x === x && obs.y === y && obs.plane === p);
        if (skillObs) {
          const skills = playerState?.skills;
          let level = 1;
          if (skills) {
            level = skills[skillObs.skill]?.current ?? 1;
          }
          return level >= skillObs.levelRequired;
        }

        const key = `${p}_${x}_${y}`;
        const tile = gridState[key];
        return tile ? tile.walkable : true;
      }
    };
    const pathfinder = new DirectionalPathfinder(spatialLimb);
    const pathfinderTrue = new DirectionalPathfinder(spatialLimbTrue);

    // Let's copy current agents
    const updatedAgents = agents.map((agent): KineticAgent => {
      // 1. PLAYER: Step along their computed path if any, checking for collisions
      if (agent.type === "player") {
        if (agent.path && agent.path.length > 1) {
          const nextStep = agent.path[1]; // index 0 is current position
          const nextStepKey = `${nextStep.plane}_${nextStep.x}_${nextStep.y}`;
          const nextTile = gridState[nextStepKey];

          // Check if physical layout is blocked but undiscovered
          if (nextTile && !nextTile.walkable && nextTile.hiddenBlockage && !discoveredBlockages[nextStepKey]) {
            // Player collided with a hidden blockage! Reveal and bounce back
            const nextDiscovered = { ...discoveredBlockages, [nextStepKey]: true };
            setDiscoveredBlockages(nextDiscovered);
            triggerPop("player_bump", "PLAYER COLLISION", agent.coord.x, agent.coord.y, nextStep.x, nextStep.y);
            
            setTerminalLogs((prev) => [
              ...prev,
              `[COLLISION] Ouch! Player bumped into hidden obstruction at (${nextStep.x}, ${nextStep.y}, P${nextStep.plane})! Blockage mapped to grid, recalculating pathing.`
            ]);
            
            // Stop player movement
            return { ...agent, path: [] };
          }

          const remainingPath = agent.path.slice(1);
          setStartCoord(nextStep); // update start position

          // Check if plane changed
          if (nextStep.plane !== agent.coord.plane) {
            setActivePlane(nextStep.plane);
            const registry = PlaneTransitionRegistry.getInstance();
            const link = registry.getLink(agent.coord);
            const transitionType = link?.type || "gateway";
            setTerminalLogs((prev) => [
              ...prev,
              `[TRANSITION] Traveling via ${transitionType.toUpperCase()} from (${agent.coord.x}, ${agent.coord.y}, P${agent.coord.plane}) ➔ Emerging on Plane P${nextStep.plane} at (${nextStep.x}, ${nextStep.y})!`
            ]);
          }

          return { ...agent, coord: nextStep, path: remainingPath };
        }
        return agent;
      }

      // 2. MOUSE TOY: AI-driven scan & discover. Steered by GhostSplat overlay
      if (agent.id === "mouse_toy") {
        if (!mouseReleased) {
          // If retrieved in pocket, stay locked to the player's current spot
          const player = agents.find(p => p.id === "player");
          return { ...agent, coord: player ? { ...player.coord } : agent.coord, path: [] };
        }

        const dirs: { dx: number; dy: number; dir: Direction }[] = [
          { dx: 0, dy: 1, dir: "north" },
          { dx: 0, dy: -1, dir: "south" },
          { dx: 1, dy: 0, dir: "east" },
          { dx: -1, dy: 0, dir: "west" }
        ];

        let bestMove = agent.coord;
        let bestScore = -Infinity;

        const guard = agents.find(a => a.type === "patrol_guard");
        const player = agents.find(a => a.id === "player");
        const recentHistory = mouseHistoryRef.current || [];

        // Score adjacent candidate coordinates using GhostSplat heatmap & threat analysis
        for (const move of dirs) {
          const tx = agent.coord.x + move.dx;
          const ty = agent.coord.y + move.dy;
          const targetCoord: Coord = { x: tx, y: ty, plane: agent.coord.plane };

          // Basic true physical canMove validation
          if (!pathfinderTrue.canMove(agent.coord, targetCoord, move.dir, undefined, false)) {
            continue;
          }

          let score = 0;

          // A: Guard Threat Avoidance (Aggressively run away from Guard's active aura)
          if (guard && guard.coord.plane === agent.coord.plane) {
            const distToGuard = Math.max(Math.abs(tx - guard.coord.x), Math.abs(ty - guard.coord.y));
            if (distToGuard <= 4) {
              score -= (5 - distToGuard) * 15; // extreme threat penalty
            }
          }

          // B: Attraction towards Undiscovered hidden blockages
          let nearestBlockageDist = Infinity;
          for (let bx = 0; bx < 66; bx++) {
            for (let by = 0; by < 66; by++) {
              const bKey = `${agent.coord.plane}_${bx}_${by}`;
              const bTile = gridState[bKey];
              if (bTile && !bTile.walkable && bTile.hiddenBlockage && !discoveredBlockages[bKey]) {
                const dist = Math.abs(tx - bx) + Math.abs(ty - by);
                if (dist < nearestBlockageDist) {
                  nearestBlockageDist = dist;
                }
              }
            }
          }

          if (nearestBlockageDist !== Infinity) {
            // Highly prioritize exploring closest unmapped walls!
            score += (100 - nearestBlockageDist) * 2.5;
          } else {
            // If no hidden blockage remains, move away from the player slightly to discover new places
            if (player) {
              const distToPlayer = Math.abs(tx - player.coord.x) + Math.abs(ty - player.coord.y);
              score += distToPlayer * 0.4;
            }
          }

          // C: Avoid oscillation and short-circuit path loops
          const visitedCount = recentHistory.filter(pt => pt.x === tx && pt.y === ty).length;
          score -= visitedCount * 12;

          // D: Subtle noise to prevent lock steps
          score += Math.random() * 1.5;

          if (score > bestScore) {
            bestScore = score;
            bestMove = targetCoord;
          }
        }

        // Save position sequence in memory ref
        mouseHistoryRef.current = [...recentHistory, agent.coord].slice(-6);

        // Radar Sweep for any blockages adjacent to next coordinate (radius = 2)
        let discoveredCount = 0;
        const nextDiscoveredBlockages = { ...discoveredBlockages };

        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            const bx = bestMove.x + dx;
            const by = bestMove.y + dy;
            if (bx >= 0 && bx < 66 && by >= 0 && by < 66) {
              const bKey = `${bestMove.plane}_${bx}_${by}`;
              const bTile = gridState[bKey];
              if (bTile && !bTile.walkable && bTile.hiddenBlockage && !nextDiscoveredBlockages[bKey]) {
                nextDiscoveredBlockages[bKey] = true;
                discoveredCount++;
                triggerPop("blockage_" + bx + "_" + by, "Blockage Mapped", bestMove.x, bestMove.y, bx, by);
              }
            }
          }
        }

        if (discoveredCount > 0) {
          setDiscoveredBlockages(nextDiscoveredBlockages);
          setTerminalLogs(prev => [
            ...prev,
            `[SENSORS] Clockwork Mouse mapped ${discoveredCount} blockages near (${bestMove.x}, ${bestMove.y}, P${bestMove.plane}). Grid collisions disclosed!`
          ]);
        }

        return { ...agent, coord: bestMove, path: [] };
      }

      // 3. PLATYPUS FOLLOWER: Pursues the player!
      if (agent.type === "platypus") {
        const playerCoord = agents.find((a) => a.id === "player")?.coord;
        if (playerCoord && playerCoord.plane === agent.coord.plane) {
          // Pathfind to player position
          const chasePath = pathfinder.findPath(agent.coord, playerCoord, undefined, false, false);
          if (chasePath && chasePath.length > 1) {
            const nextStep = chasePath[1];
            return { ...agent, coord: nextStep, path: chasePath.slice(1) };
          }
        }
        return agent;
      }

      // 4. PATROL GUARD: Aggressively seeks out player within 4 tiles, otherwise follows patrol route
      if (agent.type === "patrol_guard") {
        const player = agents.find(a => a.id === "player");
        if (player && player.coord.plane === agent.coord.plane) {
          const dx = Math.abs(agent.coord.x - player.coord.x);
          const dy = Math.abs(agent.coord.y - player.coord.y);
          const dist = Math.max(dx, dy);

          // Alert aggression radius: 4 squares
          if (dist <= 4) {
            // Override patrol! Chase aggressively!
            agent.color = "#f43f5e"; // hostile rose
            agent.name = "🚨 Aggressive Guard (HUNTING)";
            
            const alertPath = pathfinderTrue.findPath(agent.coord, player.coord, undefined, false, false);
            if (alertPath && alertPath.length > 1) {
              const nextStep = alertPath[1];
              
              if (nextStep.x === player.coord.x && nextStep.y === player.coord.y) {
                triggerPop("arrest_event", "PLAYER CAPTURED!", agent.coord.x, agent.coord.y, player.coord.x, player.coord.y);
                setTerminalLogs(prev => [
                  ...prev,
                  `[ALARM] Intruder detected! Hostile guard captured player at (${nextStep.x}, ${nextStep.y})!`
                ]);
              }
              
              return { ...agent, coord: nextStep, path: alertPath.slice(1) };
            }
            return agent;
          }
        }

        // Return to passive patrol mode
        agent.color = "#fbbf24"; // yellow patrol
        agent.name = "Sovereign Patrol Guard";

        let pIdx = agent.patrolIndex ?? 0;
        const currentGoal = agent.patrolRoute ? agent.patrolRoute[pIdx] : { x: 26, y: 10, plane: 0 };

        // If reached current patrol vertex, advance destination
        if (agent.coord.x === currentGoal.x && agent.coord.y === currentGoal.y && agent.patrolRoute) {
          pIdx = (pIdx + 1) % agent.patrolRoute.length;
          const nextGoal = agent.patrolRoute[pIdx];
          const routePath = pathfinder.findPath(agent.coord, nextGoal, undefined, false, false);
          const nextCoord = routePath.length > 1 ? routePath[1] : agent.coord;
          return {
            ...agent,
            coord: nextCoord,
            patrolIndex: pIdx,
            path: routePath.slice(1)
          };
        } else {
          const routePath = pathfinder.findPath(agent.coord, currentGoal, undefined, false, false);
          const nextCoord = routePath.length > 1 ? routePath[1] : agent.coord;
          return {
            ...agent,
            coord: nextCoord,
            patrolIndex: pIdx,
            path: routePath.slice(1)
          };
        }
      }

      return agent;
    });

    const popCheckedAgents: KineticAgent[] = [];
    const occupiedKeys = new Set<string>();

    updatedAgents.forEach((ag) => {
      const key = `${ag.coord.plane}_${ag.coord.x}_${ag.coord.y}`;
      const tile = gridState[key];
      const isBlocked = !tile || !tile.walkable || ag.coord.x === 0 || ag.coord.x === 65 || ag.coord.y === 0 || ag.coord.y === 65;
      const isOverlapping = occupiedKeys.has(key);

      if (isBlocked || isOverlapping) {
        const popped = findNearestSurface(ag.coord.x, ag.coord.y, ag.coord.plane, gridState, occupiedKeys);
        triggerPop(ag.id, ag.name, ag.coord.x, ag.coord.y, popped.x, popped.y);
        const resolved = {
          ...ag,
          coord: popped,
          path: []
        };
        const poppedKey = `${popped.plane}_${popped.x}_${popped.y}`;
        occupiedKeys.add(poppedKey);
        popCheckedAgents.push(resolved);
      } else {
        occupiedKeys.add(key);
        popCheckedAgents.push(ag);
      }
    });

    // Apply OpenRSC delta-sync tracking to each agent
    const synchronizedAgents = popCheckedAgents.map((ag): KineticAgent => {
      const prevAg = agents.find(p => p.id === ag.id);
      
      // Calculate current direction of motion
      let calculatedDirection = ag.direction || "north";
      if (prevAg) {
        const dx = ag.coord.x - prevAg.coord.x;
        const dy = ag.coord.y - prevAg.coord.y;
        if (dx > 0) calculatedDirection = "east";
        else if (dx < 0) calculatedDirection = "west";
        else if (dy > 0) calculatedDirection = "north";
        else if (dy < 0) calculatedDirection = "south";
      }

      const playerObj = {
        x: ag.coord.x,
        y: ag.coord.y,
        lastX: prevAg ? prevAg.lastX : ag.coord.x,
        lastY: prevAg ? prevAg.lastY : ag.coord.y,
        direction: calculatedDirection,
        lastSprite: prevAg ? prevAg.lastSprite : "north",
        lastClientActivity: prevAg ? prevAg.lastClientActivity : Date.now()
      };

      // Call OpenRSC helpers dynamically to track changes
      const moved = playerSync.hasMoved.call(playerObj);
      const spChanged = playerSync.spriteChanged.call(playerObj);
      
      // Update activity if agent has moved/updated
      if (moved || spChanged) {
        playerSync.updateActivity.call(playerObj);
      }

      return {
        ...ag,
        lastX: playerObj.lastX,
        lastY: playerObj.lastY,
        direction: playerObj.direction,
        lastSprite: playerObj.lastSprite,
        lastClientActivity: playerObj.lastClientActivity
      };
    });

    setAgents(synchronizedAgents);

    // Re-verify Gaussian Sensor intersections
    performGaussianSweep(synchronizedAgents);
  };

  // Perform sensor detection verification
  const performGaussianSweep = (activeAgents: KineticAgent[]) => {
    if (!sensorActive) {
      setDetectedAgents([]);
      return;
    }

    const detections: string[] = [];
    activeAgents.forEach((agent) => {
      if (agent.coord.plane === activePlane) {
        // Calculate Distance
        const dx = agent.coord.x - sensorCenter.x;
        const dy = agent.coord.y - sensorCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Gaussian Probability: A * exp(-d^2 / 2sigma^2)
        const probability = gaussianAmp * Math.exp(-(dist * dist) / (2 * gaussianSigma * gaussianSigma));

        if (probability >= 0.15) {
          detections.push(
            `"${agent.name}" at (${agent.coord.x}, ${agent.coord.y}) - Detection Sig: ${(probability * 100).toFixed(1)}%`
          );
        }
      }
    });

    setDetectedAgents(detections);
    if (detections.length > 0 && Math.random() > 0.6) {
      setTerminalLogs((prev) => [
        ...prev,
        `[SENSOR] Real-time Gaussian Sweep captured ${detections.length} kinetics inside standard deviation threshold.`
      ]);
    }
  };

  // Grid Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 66;
    const cw = canvas.width;
    const ch = canvas.height;
    const cellSize = cw / size; // exactly 7 pixels if width is 462

    // Clear background
    ctx.fillStyle = "#090d16"; // deep slate-black
    ctx.fillRect(0, 0, cw, ch);

    // Draw Gaussian sensor heatmap background layer if active
    if (sensorActive) {
      const sx = (sensorCenter.x + 0.5) * cellSize;
      const sy = (sensorCenter.y + 0.5) * cellSize;
      const maxRadius = gaussianSigma * cellSize * 3; // 3 sigma envelope

      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, maxRadius);
      grad.addColorStop(0, `rgba(6, 182, 212, ${0.45 * gaussianAmp})`); // glowing cyan core
      grad.addColorStop(0.3, `rgba(6, 182, 212, ${0.22 * gaussianAmp})`);
      grad.addColorStop(0.65, `rgba(6, 182, 212, ${0.07 * gaussianAmp})`);
      grad.addColorStop(1, "rgba(6, 182, 212, 0)");

      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, maxRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw grid wires
    ctx.strokeStyle = "#131b2e"; // very subtle tech line
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= size; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, ch);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(cw, i * cellSize);
      ctx.stroke();
    }

    // Paint cells based on grid rules
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const key = `${activePlane}_${x}_${y}`;
        const tile = gridState[key];
        if (!tile) continue;

        const rx = x * cellSize;
        const ry = y * cellSize;

        // Non-walkable obstacles
        if (!tile.walkable) {
          const isHidden = tile.hiddenBlockage && !discoveredBlockages[key];
          if (isHidden) {
            // Draw a subtle translucent dotted purple dashed indicator for Fog-of-war blockages
            ctx.save();
            ctx.strokeStyle = "rgba(168, 85, 247, 0.22)";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 1.5]);
            ctx.strokeRect(rx + 1, ry + 1, cellSize - 2, cellSize - 2);
            ctx.restore();
          } else {
            ctx.fillStyle = "#1e293b"; // charcoal block for walls
            ctx.fillRect(rx + 0.5, ry + 0.5, cellSize - 1, cellSize - 1);
            // inner solid core
            ctx.fillStyle = "#334155";
            ctx.fillRect(rx + 2, ry + 2, cellSize - 4, cellSize - 4);
          }
        }

        // Check if transition gateways are located on this tile
        const transitionRegistry = PlaneTransitionRegistry.getInstance();
        const link = transitionRegistry.getLink({ x, y, plane: activePlane });
        if (link) {
          const transType = link.type || "stairs";
          if (transType === "portal") {
            // Cosmic level bypass portal: blue-indigo glowing circle vortex with cyan core
            ctx.save();
            ctx.beginPath();
            ctx.arc(rx + cellSize / 2, ry + cellSize / 2, cellSize / 2 - 1, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(139, 92, 246, 0.5)"; // Violet aura
            ctx.fill();

            ctx.beginPath();
            ctx.arc(rx + cellSize / 2, ry + cellSize / 2, cellSize / 3, 0, 2 * Math.PI);
            ctx.fillStyle = "#8b5cf6"; // Dark purple core
            ctx.fill();

            ctx.strokeStyle = "#22d3ee"; // Cyano neon outline
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(rx + cellSize / 2, ry + cellSize / 2, 2, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
          } else if (transType === "ladder") {
            // Ladder with rails and rungs
            ctx.save();
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(rx + 2, ry + 1.5, cellSize - 4, cellSize - 3);

            ctx.strokeStyle = "#f97316"; // Orange iron rails
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(rx + 3, ry + 1);
            ctx.lineTo(rx + 3, ry + cellSize - 1);
            ctx.moveTo(rx + cellSize - 3, ry + 1);
            ctx.lineTo(rx + cellSize - 3, ry + cellSize - 1);
            ctx.stroke();

            ctx.strokeStyle = "#fed7aa"; // Light apricot rungs
            ctx.lineWidth = 1;
            for (let rungY = ry + 3; rungY < ry + cellSize; rungY += 4) {
              ctx.beginPath();
              ctx.moveTo(rx + 3, rungY);
              ctx.lineTo(rx + cellSize - 3, rungY);
              ctx.stroke();
            }
            ctx.restore();
          } else if (transType === "door") {
            // Heavy Dwarven Security Hatch / Door: bound oak panel
            ctx.save();
            ctx.fillStyle = "#78350f"; // Wood brown
            ctx.fillRect(rx + 1.5, ry + 1.5, cellSize - 3, cellSize - 3);
            ctx.strokeStyle = "#451a03"; // Dark iron rim
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + 2, ry + 2, cellSize - 4, cellSize - 4);
            // Diagonal iron brace
            ctx.beginPath();
            ctx.moveTo(rx + 2.5, ry + 2.5);
            ctx.lineTo(rx + cellSize - 2.5, ry + cellSize - 2.5);
            ctx.stroke();
            // Brass center door-knob
            ctx.fillStyle = "#fb923c";
            ctx.beginPath();
            ctx.arc(rx + cellSize / 2, ry + cellSize / 2, 1.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
          } else if (transType === "cave") {
            // Mountain cave descent opening
            ctx.save();
            ctx.fillStyle = "#1e293b"; // Stone gray backing
            ctx.fillRect(rx + 1, ry + 1, cellSize - 2, cellSize - 2);
            // Stone arch
            ctx.fillStyle = "#020617"; // Void black pit center
            ctx.beginPath();
            ctx.arc(rx + cellSize / 2, ry + cellSize / 2 + 1, cellSize / 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = "#94a3b8"; // Slate gray stone border
            ctx.stroke();
            ctx.restore();
          } else if (transType === "shortcut") {
            // Agility bypass shortcut tile
            ctx.save();
            ctx.fillStyle = "#14532d"; // Emerald backing
            ctx.fillRect(rx + 1.5, ry + 1.5, cellSize - 3, cellSize - 3);
            ctx.fillStyle = "#cbd5e1"; // Stepping stone accent
            ctx.beginPath();
            ctx.arc(rx + cellSize / 2, ry + cellSize / 2, 2.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
          } else {
            // Standard multi-level stairs
            ctx.fillStyle = "#c084fc"; // magenta stair core
            ctx.fillRect(rx + 1.5, ry + 1.5, cellSize - 3, cellSize - 3);

            // Draw step levels
            ctx.fillStyle = "#3b1e54";
            ctx.fillRect(rx + 3, ry + 3, cellSize - 6, cellSize - 6);
          }
        }

        // Draw active directional edges
        if (tile.edges) {
          ctx.lineWidth = 1.5;
          if (tile.edges.northBlocked) {
            ctx.strokeStyle = "#f43f5e"; // rose block line
            ctx.beginPath();
            ctx.moveTo(rx, ry + cellSize);
            ctx.lineTo(rx + cellSize, ry + cellSize);
            ctx.stroke();
          }
          if (tile.edges.southBlocked) {
            ctx.strokeStyle = "#f43f5e";
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + cellSize, ry);
            ctx.stroke();
          }
          if (tile.edges.eastBlocked) {
            ctx.strokeStyle = "#f43f5e";
            ctx.beginPath();
            ctx.moveTo(rx + cellSize, ry);
            ctx.lineTo(rx + cellSize, ry + cellSize);
            ctx.stroke();
          }
          if (tile.edges.westBlocked) {
            ctx.strokeStyle = "#f43f5e";
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx, ry + cellSize);
            ctx.stroke();
          }
        }
      }
    }

    // DRAW SKILL-BASED DETERMINISTIC PATHING OBSTACLES OVERLAY
    SKILL_OBSTACLES.forEach((obs) => {
      if (obs.plane !== activePlane) return;

      const rx = obs.x * cellSize;
      const ry = obs.y * cellSize;

      const skills = playerState?.skills;
      let level = 1;
      if (skills) {
        level = skills[obs.skill]?.current ?? 1;
      }
      const isPassed = level >= obs.levelRequired;

      ctx.save();

      // Clear background beneath to highlight the node
      ctx.clearRect(rx + 0.5, ry + 0.5, cellSize - 1, cellSize - 1);

      // Special background fill
      ctx.fillStyle = isPassed ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)";
      ctx.fillRect(rx + 0.5, ry + 0.5, cellSize - 1, cellSize - 1);

      // Border style representing pass/fail status
      ctx.strokeStyle = isPassed ? "#10b981" : "#ef4444";
      ctx.lineWidth = 1.25;
      ctx.shadowColor = isPassed ? "#10b981" : "#ef4444";
      ctx.shadowBlur = 4;
      ctx.strokeRect(rx + 0.75, ry + 0.75, cellSize - 1.5, cellSize - 1.5);

      // Centered unicode glyph
      ctx.shadowBlur = 0;
      ctx.font = "bold 9px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isPassed ? "#34d399" : "#f87171";
      ctx.fillText(obs.icon, rx + cellSize / 2, ry + cellSize / 2);

      ctx.restore();
    });

    // DRAW GHOSTSPLAT INFLUENCE OVERLAY
    if (isGhostSplatActive) {
      const heat = getGhostSplatHeat(agents, activePlane);
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const val = heat[y * 66 + x];
          if (val > 0.02) {
            const rx = x * cellSize;
            const ry = y * cellSize;
            
            // Choose color representation depending on threat level or scan fields
            const guard = agents.find(g => g.type === "patrol_guard");
            const mouse = agents.find(m => m.id === "mouse_toy");
            
            let r = 6, g = 182, b = 212; // cyan default
            
            if (guard && guard.coord.plane === activePlane) {
              const guardDist = Math.max(Math.abs(x - guard.coord.x), Math.abs(y - guard.coord.y));
              if (guardDist <= 4) {
                r = 244; g = 63; b = 94; // red/rose alert heat
              }
            } else if (mouse && mouse.coord.plane === activePlane && mouseReleased) {
              const mouseDist = Math.max(Math.abs(x - mouse.coord.x), Math.abs(y - mouse.coord.y));
              if (mouseDist <= 3) {
                r = 168; g = 85; b = 247; // purple scout heat
              }
            }
            
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.35, val)})`;
            ctx.fillRect(rx + 0.5, ry + 0.5, cellSize - 1, cellSize - 1);
          }
        }
      }
    }

    // Draw Computed Pathfinder Trail
    if (currentPath && currentPath.length > 0) {
      ctx.strokeStyle = "#22c55e"; // neon green trail
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      currentPath.forEach((pt, idx) => {
        const px = (pt.x + 0.5) * cellSize;
        const py = (pt.y + 0.5) * cellSize;

        if (idx === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();

      // Draw little node dots along the path
      ctx.fillStyle = "rgba(34,197,94,0.6)";
      currentPath.forEach((pt) => {
        const px = (pt.x + 0.5) * cellSize;
        const py = (pt.y + 0.5) * cellSize;
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Start Coordinate Marker
    const startX = (startCoord.x + 0.5) * cellSize;
    const startY = (startCoord.y + 0.5) * cellSize;
    ctx.strokeStyle = "#ef4444"; // pure red start pulse
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(startX, startY, cellSize * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(startX, startY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Goal Coordinate Marker
    const goalX = (goalCoord.x + 0.5) * cellSize;
    const goalY = (goalCoord.y + 0.5) * cellSize;
    ctx.strokeStyle = "#3b82f6"; // neon blue destination target
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(goalX, goalY, cellSize * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    // Inner cross hairs
    ctx.beginPath();
    ctx.moveTo(goalX - cellSize * 0.5, goalY);
    ctx.lineTo(goalX + cellSize * 0.5, goalY);
    ctx.moveTo(goalX, goalY - cellSize * 0.5);
    ctx.lineTo(goalX, goalY + cellSize * 0.5);
    ctx.stroke();

    // DRAW KINETIC AGENTS
    agents.forEach((agent) => {
      if (agent.coord.plane !== activePlane) return;
      if (agent.id === "mouse_toy" && !mouseReleased) return; // skip rendering if in player's pocket

      const ax = (agent.coord.x + 0.5) * cellSize;
      const ay = (agent.coord.y + 0.5) * cellSize;

      ctx.save();
      ctx.fillStyle = agent.color;
      ctx.shadowColor = agent.color;
      ctx.shadowBlur = 6;

      ctx.beginPath();
      if (agent.type === "player") {
        // Star pattern for player
        ctx.arc(ax, ay, cellSize * 0.65, 0, Math.PI * 2);
      } else if (agent.type === "mouse_toy") {
        // Triangle for wind-up toy mouse
        ctx.moveTo(ax, ay - cellSize * 0.6);
        ctx.lineTo(ax + cellSize * 0.5, ay + cellSize * 0.4);
        ctx.lineTo(ax - cellSize * 0.5, ay + cellSize * 0.4);
        ctx.closePath();
      } else if (agent.type === "platypus") {
        // Hexagon for Platypus
        ctx.arc(ax, ay, cellSize * 0.55, 0, Math.PI * 2);
      } else {
        // Square for patrol guards
        ctx.rect(ax - cellSize * 0.5, ay - cellSize * 0.5, cellSize, cellSize);
      }
      ctx.fill();
      ctx.restore();

      // Label hover text
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(agent.name.split(" ")[1] || agent.name, ax + cellSize * 0.7, ay - cellSize * 0.3);
    });

    // DRAW POP ANIMAL RIPPLES
    popAnimations.forEach((anim) => {
      const fromAx = (anim.fromX + 0.5) * cellSize;
      const fromAy = (anim.fromY + 0.5) * cellSize;
      const toAx = (anim.toX + 0.5) * cellSize;
      const toAy = (anim.toY + 0.5) * cellSize;

      ctx.save();
      
      // 1. Draw pop trail trajectory line
      ctx.strokeStyle = "rgba(168, 85, 247, 0.75)"; // purple pop trail
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(fromAx, fromAy);
      ctx.lineTo(toAx, toAy);
      ctx.stroke();

      // 2. Draw rising dot traveling on progress
      const curX = fromAx + (toAx - fromAx) * anim.progress;
      const curY = fromAy + (toAy - fromAy) * anim.progress;
      ctx.fillStyle = "#c084fc"; // soft magenta glow
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fill();

      // 3. Draw expanding shockwave ring at destination
      const maxRadius = cellSize * 2.8;
      const radius = anim.progress * maxRadius;
      ctx.strokeStyle = `rgba(168, 85, 247, ${1 - anim.progress})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(toAx, toAy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 4. Draw warning/block source point
      ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fromAx - 5, fromAy - 5);
      ctx.lineTo(fromAx + 5, fromAy + 5);
      ctx.moveTo(fromAx + 5, fromAy - 5);
      ctx.lineTo(fromAx - 5, fromAy + 5);
      ctx.stroke();

      // Label
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#e9d5ff";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3;
      ctx.fillText(`POP: ${anim.label}`, toAx + 8, toAy + 12);

      ctx.restore();
    });

    // Outer frame bounds
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, cw, ch);
  }, [gridState, startCoord, goalCoord, activePlane, currentPath, agents, sensorCenter, sensorActive, gaussianSigma, gaussianAmp, popAnimations]);

  // Handle interaction click/drag paint triggers on grid canvas
  const handleCanvasMouse = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const size = 66;
    const cellSize = canvas.width / size;

    const mapX = Math.floor((mx * scaleX) / cellSize);
    const mapY = Math.floor((my * scaleY) / cellSize);

    if (mapX < 0 || mapX >= size || mapY < 0 || mapY >= size) return;

    clickGridCell(mapX, mapY);
  };

  const clickGridCell = (x: number, y: number) => {
    const key = `${activePlane}_${x}_${y}`;
    const tile = gridState[key];
    if (!tile) return;

    // Apply active tool
    if (currentTool === "paint_walls") {
      if (x === 0 || x === 65 || y === 0 || y === 65) return; // leave margins
      const nextGridState = {
        ...gridState,
        [key]: { ...gridState[key], walkable: false }
      };
      setGridState(nextGridState);

      // Check if startCoord is on the painted tile
      if (startCoord.x === x && startCoord.y === y && startCoord.plane === activePlane) {
        const popped = findNearestSurface(x, y, activePlane, nextGridState);
        setStartCoord(popped);
        triggerPop("start", "Start Anchor", x, y, popped.x, popped.y);
      }

      // Check if goalCoord is on the painted tile
      if (goalCoord.x === x && goalCoord.y === y && goalCoord.plane === activePlane) {
        const popped = findNearestSurface(x, y, activePlane, nextGridState);
        setGoalCoord(popped);
        triggerPop("goal", "Goal Anchor", x, y, popped.x, popped.y);
      }

      // Check if any agent is on the painted tile
      setAgents((prev) =>
        prev.map((ag) => {
          if (ag.coord.x === x && ag.coord.y === y && ag.coord.plane === activePlane) {
            const popped = findNearestSurface(x, y, activePlane, nextGridState);
            triggerPop(ag.id, ag.name, x, y, popped.x, popped.y);
            return { ...ag, coord: popped, path: [] };
          }
          return ag;
        })
      );
    } else if (currentTool === "clear_walls") {
      setGridState((prev) => ({
         ...prev,
         [key]: { ...prev[key], walkable: true }
      }));
    } else if (currentTool === "select_start") {
      const isBlocked = !tile.walkable || x === 0 || x === 65 || y === 0 || y === 65;
      if (isBlocked) {
        const popped = findNearestSurface(x, y, activePlane);
        setStartCoord(popped);
        triggerPop("start", "Start Anchor", x, y, popped.x, popped.y);
      } else {
        setStartCoord({ x, y, plane: activePlane });
      }
    } else if (currentTool === "select_goal") {
      const isBlocked = !tile.walkable || x === 0 || x === 65 || y === 0 || y === 65;
      if (isBlocked) {
        const popped = findNearestSurface(x, y, activePlane);
        setGoalCoord(popped);
        triggerPop("goal", "Goal Anchor", x, y, popped.x, popped.y);
      } else {
        setGoalCoord({ x, y, plane: activePlane });
      }
    } else if (currentTool === "spawn_agent") {
      const occupied = new Set<string>();
      agents.forEach(a => occupied.add(`${a.coord.plane}_${a.coord.x}_${a.coord.y}`));

      const isOccupiedSpot = occupied.has(`${activePlane}_${x}_${y}`);
      const isBlocked = !tile.walkable || x === 0 || x === 65 || y === 0 || y === 65;
      const newAgentId = `npc_custom_${Date.now()}`;
      const agentNames = [
        "Escaped Dwarf", "Sovereign Beetle", "Magma Slime", "Rune Guardian", 
        "Canyon Rabbit", "Keldagrim Golem", "Shadow Specter"
      ];
      const name = agentNames[Math.floor(Math.random() * agentNames.length)];
      
      const colors = ["#fb7185", "#c084fc", "#34d399", "#facc15", "#f472b6", "#fb923c"];
      const color = colors[Math.floor(Math.random() * colors.length)];

      let finalCoord = { x, y, plane: activePlane };
      if (isBlocked || isOccupiedSpot) {
        finalCoord = findNearestSurface(x, y, activePlane, gridState, occupied);
        triggerPop(newAgentId, name, x, y, finalCoord.x, finalCoord.y);
      } else {
        setTerminalLogs((prev) => [
          ...prev,
          `[SYS] Spawned "${name}" at (${x}, ${y}, P${activePlane})`
        ]);
      }

      const newAgent: KineticAgent = {
        id: newAgentId,
        name,
        type: "mouse_toy",
        coord: finalCoord,
        color,
        path: []
      };

      setAgents((prev) => [...prev, newAgent]);
    } else if (currentTool === "directional_block") {
      const updatedEdges = { ...(tile.edges || {}) };
      const side = selectedDirection;

      if (side === "north") updatedEdges.northBlocked = !updatedEdges.northBlocked;
      if (side === "south") updatedEdges.southBlocked = !updatedEdges.southBlocked;
      if (side === "east") updatedEdges.eastBlocked = !updatedEdges.eastBlocked;
      if (side === "west") updatedEdges.westBlocked = !updatedEdges.westBlocked;

      setGridState((prev) => ({
        ...prev,
        [key]: { ...prev[key], edges: updatedEdges }
      }));

      setTerminalLogs((prev) => [
        ...prev,
        `[VHDL] Toggled edge direction blocking on tile (${x}, ${y}, P${activePlane}).`
      ]);
    } else if (currentTool === "sensor_placement") {
      setSensorCenter({ x, y });
      setTerminalLogs((prev) => [
        ...prev,
        `[SENSOR] Active Gaussian scanner array repositioned to coordinate: (${x}, ${y}, P${activePlane}).`
      ]);
    }
  };

  // Preset Generation
  const generatePreset = (preset: "dwarven_tracks" | "sensor_maze" | "blank_slate") => {
    setTerminalLogs((prev) => [
      ...prev,
      `[LOADER] Generating spatial authority landscape preset: "${preset.toUpperCase()}"`
    ]);

    const copy = { ...gridState };
    const size = 66;

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let p = 0; p < 3; p++) {
          const key = `${p}_${x}_${y}`;
          let walkable = true;

          if (x === 0 || x === 65 || y === 0 || y === 65) {
            walkable = false;
          }

          if (preset === "dwarven_tracks") {
            // Horizontal tracks at y=33
            if (y === 33 && (x < 15 || x > 20)) {
              walkable = false;
            }
            // Vertical tracks at x=33
            if (x === 33 && (y < 28 || y > 38)) {
              walkable = false;
            }
          } else if (preset === "sensor_maze") {
            // Horizontal divider lines with alternating gaps
            if (y === 15 && x > 10) walkable = false;
            if (y === 30 && x < 55) walkable = false;
            if (y === 45 && x > 15) walkable = false;
          }

          copy[key] = {
            walkable,
            edges: {
              northBlocked: false,
              southBlocked: false,
              eastBlocked: false,
              westBlocked: false
            },
            npc_only_blocks: []
          };
        }
      }
    }

    setGridState(copy);
    setStartCoord({ x: 5, y: 5, plane: 0 });
    setGoalCoord({ x: 50, y: 50, plane: 0 });
  };

  // Execute manual path normalization check
  const handleNormalizePath = () => {
    const res = PathNormalizer.normalizeString(inputPath);
    setNormalizedResult(res);
    setTerminalLogs((prev) => [
      ...prev,
      `[PATH] Path resolved. Absolute System String normalized safely to client aesthetic: "${res}"`
    ]);
  };

  // Simulated SQLite Database rows corresponding to index reports
  const activeObjectsDb = [
    { id: 101, name: "Mine Cart Route Track Switcher", type: "minecart", walkable: "false", extra: "VHDL Varbit trigger linked to 0x0F" },
    { id: 102, name: "Platform Lever", type: "lever", walkable: "true", extra: "Triggers staircase deployment at 20,21" },
    { id: 103, name: "Escaped Mouse Toy Anchor", type: "kinetic", walkable: "true", extra: "Standard linear speed multiplier: 1.5" },
    { id: 250, name: "Keldagrim Substation Boundary Rail", type: "minecart", walkable: "false", extra: "Authoritative D-drive logic node mapped" },
    { id: 310, name: "Feral Platypus Burrow", type: "kinetic", walkable: "true", extra: "Tracks nearby signal coordinates on ticks" }
  ];

  const activeNpcsDb = [
    { id: 9001, name: "Sovereign Patrol Drone", type: "patrol", walk_range: 20, motion_formula: "Quaternary Ortho Map" },
    { id: 9002, name: "Smuggler Spirit Detector", type: "kinetic", walk_range: 12, motion_formula: "Gaussian Probability Envelope" },
    { id: 9003, name: "Clockwork Mouse Constructor", type: "autonomous", walk_range: 55, motion_formula: "Forward Path Sweep" }
  ];

  const activeVarbitsDb = [
    { varbit: 1004, value: simVarbits[1004], description: "Mine Cart Track Switch A (Determines if track cell (33,33) blocks pathing)" },
    { varbit: 1005, value: simVarbits[1005], description: "Platypus safety lock (If enabled, Platypus tracking radius increases)" },
    { varbit: 1020, value: simVarbits[1020], description: "MHD Sensor Core sweep activity tracking flag" }
  ];

  const toggleVarbit = (v: number) => {
    const nextVal = simVarbits[v] === 1 ? 0 : 1;
    setSimVarbits((prev) => ({ ...prev, [v]: nextVal }));

    // Real trigger simulation
    if (v === 1004) {
      // Toggle track blocking cell (33,33)
      const key = `${activePlane}_33_33`;
      setGridState((prev) => ({
        ...prev,
        [key]: { ...prev[key], walkable: nextVal === 0 }
      }));
      setTerminalLogs((prev) => [
        ...prev,
        `[VARBIT] Changed Varbit 1004 value to ${nextVal}. Sector block (33,33) is now ${nextVal === 0 ? "WALKABLE" : "BLOCKED"}.`
      ]);
    } else {
      setTerminalLogs((prev) => [
        ...prev,
        `[VARBIT] Modified Varbit ${v} state value directly to database cell: 0x${nextVal.toString(16).toUpperCase()}`
      ]);
    }
  };

  // Filter lists based on DB Search query
  const filteredObjects = activeObjectsDb.filter((x) =>
    x.name.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
    x.type.toLowerCase().includes(dbSearchQuery.toLowerCase())
  );

  const filteredNpcs = activeNpcsDb.filter((x) =>
    x.name.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
    x.type.toLowerCase().includes(dbSearchQuery.toLowerCase())
  );

  return (
    <div id="ntx_world_buffer_container" className="space-y-5 bg-slate-950 border border-teal-900/40 p-4 rounded text-slate-100">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-900 pb-3 gap-2">
        <div>
          <h2 className="text-sm font-bold font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
            <Compass className="h-4 w-4 text-cyan-400 animate-spin" />
            NTX Sovereign 66x66 World Buffer Generator
          </h2>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Quaternary A* Directional Pathfinding Matrix with Local Grid Authority and Gaussian Sensors
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 bg-slate-900/60 p-1 rounded border border-slate-800">
          <span className="text-[8px] font-mono text-slate-500 uppercase px-1.5">Simulation clock divider:</span>
          <span className="text-[9px] font-mono font-bold bg-slate-950 border border-slate-800 text-teal-400 px-2 py-0.5 rounded">
            600 ms (VHDL)
          </span>
        </div>
      </div>

      {/* Grid Canvas Section & Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left column: Controls/Tools */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded">
            <span className="text-[9px] font-mono font-bold uppercase block mb-2 text-cyan-400 tracking-wider">
              🎮 GRID INTERACTION TOOLS
            </span>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCurrentTool("paint_walls")}
                className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border transition flex items-center gap-2 ${
                  currentTool === "paint_walls"
                    ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Grid className="h-3 w-3 shrink-0" />
                Paint Obstacle
              </button>
              
              <button
                onClick={() => setCurrentTool("clear_walls")}
                className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border transition flex items-center gap-2 ${
                  currentTool === "clear_walls"
                    ? "bg-rose-950/40 border-rose-500 text-rose-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <RotateCcw className="h-3 w-3 shrink-0" />
                Erase Obstacle
              </button>

              <button
                onClick={() => setCurrentTool("select_start")}
                className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border transition flex items-center gap-2 ${
                  currentTool === "select_start"
                    ? "bg-red-950/40 border-red-500 text-red-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Dna className="h-3 w-3 shrink-0" />
                Set Start (Player)
              </button>

              <button
                onClick={() => setCurrentTool("select_goal")}
                className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border transition flex items-center gap-2 ${
                  currentTool === "select_goal"
                    ? "bg-blue-950/40 border-blue-500 text-blue-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="h-3 w-3 shrink-0" />
                Set Goal (Blue)
              </button>

              <button
                onClick={() => setCurrentTool("sensor_placement")}
                className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border transition flex items-center gap-2 ${
                  currentTool === "sensor_placement"
                    ? "bg-cyan-950/40 border-teal-500 text-teal-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity className="h-3 w-3 shrink-0" />
                Place Sensor
              </button>

              <button
                onClick={() => setCurrentTool("spawn_agent")}
                className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border transition flex items-center gap-2 ${
                  currentTool === "spawn_agent"
                    ? "bg-purple-950/40 border-purple-500 text-purple-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                Spawn (Auto-Pop)
              </button>

              <button
                onClick={() => setCurrentTool("directional_block")}
                className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border transition flex items-center justify-center gap-2 col-span-2 ${
                  currentTool === "directional_block"
                    ? "bg-amber-950/40 border-amber-500 text-amber-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Shield className="h-3 w-3 shrink-0" />
                Direction Edge Block:
                <span className="font-bold underline text-lime-400 uppercase">{selectedDirection}</span>
              </button>
            </div>

            {currentTool === "directional_block" && (
              <div className="mt-2.5 bg-slate-950 p-1.5 rounded border border-slate-850 flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-450 uppercase">Select Target Edge:</span>
                <div className="flex gap-1">
                  {(["north", "south", "east", "west"] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setSelectedDirection(dir)}
                      className={`text-[9.5px] font-mono px-2 py-0.5 rounded transition ${
                        selectedDirection === dir
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "bg-slate-900 border border-slate-800 text-slate-400"
                      }`}
                    >
                      {dir.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-[9px] text-slate-450 font-mono mt-2.5 leading-relaxed bg-slate-950 p-2 rounded border border-slate-850">
              💡 <span className="font-semibold text-slate-300">Aesthetic Interaction:</span> Select any tool above, then click or drag directly on the 66x66 grid block on the right to redraw terrain, relocate endpoints, deploy boundary stairs, or tune signal grids!
            </p>
          </div>

          {/* Plane Floor Tab Selection */}
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded">
            <span className="text-[9px] font-mono font-bold uppercase block mb-2 text-cyan-400 tracking-wider">
              📶 ACTIVE PLANE LAYERS (MULTI-LEVEL AUTHORITY)
            </span>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePlane(p)}
                  className={`flex-1 text-[10px] font-mono font-bold py-1.5 rounded border transition ${
                    activePlane === p
                      ? "bg-purple-950/40 border-purple-500 text-purple-300 shadow-inner"
                      : "bg-slate-950 border-slate-800 text-slate-450 hover:text-slate-300"
                  }`}
                >
                  📡 PLANE P{p}
                </button>
              ))}
            </div>
            <div className="text-[8px] text-slate-450 font-mono mt-2 space-y-1 bg-slate-950 p-2.5 rounded border border-slate-850">
              <span className="font-semibold text-slate-300 block border-b border-slate-900 pb-1 mb-1">⛓️ INSTALLED PLANE TRANSITION NETWORK:</span>
              <div className="grid grid-cols-1 gap-1 text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">🌀</span>
                  <span><strong className="text-cyan-400 font-bold uppercase text-[7.5px]">Cosmic Portal:</strong> <span className="text-cyan-300 font-bold">(10,10)</span> P0 ↔ P2 <span className="text-purple-400">[Bypasses P1]</span></span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">🪜</span>
                  <span><strong className="text-orange-400 font-bold uppercase text-[7.5px]">Iron Ladder:</strong> <span className="text-orange-300 font-bold">(55,15)</span> P0 ↔ P1 and <span className="text-orange-300 font-bold">(15,55)</span> P1 ↔ P2</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">🚪</span>
                  <span><strong className="text-amber-500 font-bold uppercase text-[7.5px]">Oak Heavy Door:</strong> <span className="text-amber-300 font-bold">(30,25)</span> P0 ↔ P1</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">🕳️</span>
                  <span><strong className="text-slate-400 font-bold uppercase text-[7.5px]">Descent Cave:</strong> <span className="text-slate-300 font-bold">(45,45)</span> P1 ↔ P2</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">🏃</span>
                  <span><strong className="text-emerald-400 font-bold uppercase text-[7.5px]">Agility Shortcut:</strong> <span className="text-emerald-300 font-bold">(8,35)</span> P0 ↔ P1</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">📶</span>
                  <span><strong className="text-purple-400 font-bold uppercase text-[7.5px]">Stairwells:</strong> <span className="text-purple-300 font-bold">(20,21)</span> P0 ↔ P1 and <span className="text-purple-300 font-bold">(40,40)</span> P1 ↔ P2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Deterministic Skill-Based Pathing Status Panel */}
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono font-bold uppercase block text-cyan-400 tracking-wider">
                🧠 DETERMINISTIC SKILL-BASED PATHING
              </span>
              <button 
                onClick={refreshSkills}
                className="text-[7.5px] font-mono text-cyan-500 hover:text-cyan-300 font-bold uppercase bg-slate-950 border border-slate-800 px-1 py-0.5 rounded cursor-pointer leading-none"
              >
                🔄 Sync
              </button>
            </div>
            <p className="text-[8px] text-slate-400 font-mono leading-tight">
              A* algorithms evaluate character skills to open shortcuts. Inject a profile (e.g. Setting Agility to 30) in the Telemetry tab to watch pathing update deterministically.
            </p>

            <div className="bg-slate-950 p-2 rounded border border-slate-850 text-[8px] font-mono text-slate-300 leading-tight space-y-1.5">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8.5px] font-bold border-b border-slate-900 pb-1.5">
                <div className="flex justify-between">
                  <span className="text-emerald-400">🏃 AGIL:</span>
                  <strong className="text-white font-bold">{playerState?.skills?.agility?.current ?? 1}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-500">⚿ THIEV:</span>
                  <strong className="text-white font-bold">{playerState?.skills?.thieving?.current ?? 1}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-500">✊ STR:</span>
                  <strong className="text-white font-bold">{playerState?.skills?.strength?.current ?? 1}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-400">✨ MAGIC:</span>
                  <strong className="text-white font-bold">{playerState?.skills?.magic?.current ?? 1}</strong>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[7.5px] font-bold text-slate-500 block uppercase tracking-wider">Active Plane Gates/Shortcuts:</span>
                {SKILL_OBSTACLES.filter(obs => obs.plane === activePlane).map((obs, idx) => {
                  const skills = playerState?.skills;
                  let level = 1;
                  if (skills) {
                    level = skills[obs.skill]?.current ?? 1;
                  }
                  const isPassed = level >= obs.levelRequired;
                  return (
                    <div key={idx} className="flex justify-between items-center text-[8px] bg-slate-900/40 px-1.5 py-0.5 rounded border border-slate-900">
                      <span className="flex items-center gap-1 text-slate-200">
                        <span>{obs.icon}</span>
                        <span className="font-semibold">{obs.label}</span>
                        <span className="text-[7px] text-slate-500 font-normal">({obs.skill} &gt;={obs.levelRequired})</span>
                      </span>
                      <span className={`font-mono font-bold text-[7px] uppercase px-1 rounded border leading-none scale-90 ${isPassed ? "bg-emerald-950/20 border-emerald-800 text-emerald-400" : "bg-rose-950/20 border-rose-905 text-rose-400"}`}>
                        {isPassed ? "OPEN" : "LOCKED"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* OpenRSC Delta Sync Monitor */}
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded space-y-2">
            <span className="text-[9px] font-mono font-bold uppercase block text-cyan-400 tracking-wider">
              🔄 OPENRSC DELTA SYNC MONITOR
            </span>
            <p className="text-[8px] text-slate-400 font-mono leading-tight">
              Real-time delta packet state analysis based on canon 600ms metabolic tick cycles in OpenRSC.
            </p>

            <div className="bg-slate-950 p-2.5 rounded border border-slate-850 text-[8px] font-mono leading-tight space-y-2">
              {/* Player Status State */}
              {(() => {
                const player = agents.find(ag => ag.id === "player");
                if (!player) return <div className="text-rose-500">Player offline</div>;
                
                // Construct objects conforming to playerSync methods signature
                const pObj = {
                  x: player.coord.x,
                  y: player.coord.y,
                  lastX: player.lastX ?? player.coord.x,
                  lastY: player.lastY ?? player.coord.y,
                  direction: player.direction ?? "north",
                  lastSprite: player.lastSprite ?? "north",
                  lastClientActivity: player.lastClientActivity ?? Date.now()
                };

                const playerMoved = playerSync.hasMoved.call(pObj);
                const spriteChanged = playerSync.spriteChanged.call(pObj);
                const heartbeatAgo = Date.now() - (player.lastClientActivity ?? Date.now());

                // Find other entities in range
                const inRangeNpcs = agents.filter(ag => ag.id !== "player").map(ag => {
                  const isInRange = playerSync.withinRange.call(pObj, { x: ag.coord.x, y: ag.coord.y }, 16);
                  return { ag, isInRange };
                });

                return (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 border-b border-slate-900 pb-2">
                      <div>
                        <span className="text-slate-505 block text-[7px]">CURRENT COORD:</span>
                        <strong className="text-white text-[8.5px]">({player.coord.x}, {player.coord.y}, P{player.coord.plane})</strong>
                      </div>
                      <div>
                        <span className="text-slate-505 block text-[7px]">PREVIOUS COORD:</span>
                        <strong className="text-slate-400">({player.lastX ?? "-"}, {player.lastY ?? "-"})</strong>
                      </div>
                      <div>
                        <span className="text-slate-505 block text-[7px]">SPRITE / DIRECTION:</span>
                        <strong className="text-orange-400 uppercase">{player.direction ?? "north"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-505 block text-[7px]">LAST SPRITE:</span>
                        <strong className="text-slate-500 uppercase">{player.lastSprite ?? "north"}</strong>
                      </div>
                    </div>

                    <div className="space-y-1 bg-slate-900/30 p-1.5 rounded border border-slate-900/60">
                      <div className="flex justify-between items-center text-[7.5px] uppercase">
                        <span className="text-slate-400 font-bold">📡 HAS_MOVED FLAG:</span>
                        <span className={`px-1 rounded-sm ${playerMoved ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-slate-900 text-slate-505"}`}>
                          {playerMoved ? "TRUE (SYNC)" : "FALSE"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[7.5px] uppercase">
                        <span className="text-slate-400 font-bold">🎬 SPRITE_CHANGED:</span>
                        <span className={`px-1 rounded-sm ${spriteChanged ? "bg-cyan-950 text-cyan-400 border border-cyan-800" : "bg-slate-900 text-slate-505"}`}>
                          {spriteChanged ? "TRUE (DIR OVERRIDE)" : "FALSE"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[7.5px] uppercase">
                        <span className="text-slate-400 font-bold">💓 HEARTBEAT SLEEP:</span>
                        <span className="text-indigo-400 uppercase tracking-tight">
                          {heartbeatAgo < 3000 ? "● SECURE ACTIVE" : `${Math.floor(heartbeatAgo / 1000)}s Ago`}
                        </span>
                      </div>
                    </div>

                    {/* Entities in View Range check */}
                    <div className="pt-1.5 space-y-1">
                      <span className="text-[7.5px] text-slate-505 block uppercase tracking-wider font-bold">
                        👥 ENTITIES WITHIN AUTHENTIC RANGE (16 TILES):
                      </span>
                      <div className="space-y-1">
                        {inRangeNpcs.map(({ ag, isInRange }) => (
                          <div key={ag.id} className="flex justify-between items-center text-[7.5px] bg-slate-900/20 px-1 py-0.5 rounded border border-slate-900">
                            <span className="flex items-center gap-1">
                              <span style={{ color: ag.color }}>●</span>
                              <span className="font-semibold text-slate-300">{ag.name}</span>
                              <span className="text-slate-500">({ag.coord.x}, {ag.coord.y})</span>
                            </span>
                            <span className={`font-mono font-bold uppercase px-1 rounded-sm leading-none scale-90 ${isInRange ? "text-emerald-400 font-bold" : "text-rose-500 font-normal"}`}>
                              {isInRange ? "IN VIEW" : "OUT OF RANGE"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Clockwork Mouse Operations Hub */}
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded space-y-2.5">
            <span className="text-[9px] font-mono font-bold uppercase block text-cyan-400 tracking-wider">
              ⚙️ CLOCKWORK MOUSE OPERATION CONTROL
            </span>
            <p className="text-[8px] text-slate-400 font-mono leading-tight">
              Release the Clockwork Mouse, a pocket device mapping collisions, scanning unmapped pathways, and alerting you to nearby threat boundaries.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMouseReleased(true);
                  // Spawn mouse at player's location
                  const player = agents.find(p => p.id === "player");
                  setAgents(prev => prev.map(ag => {
                    if (ag.id === "mouse_toy") {
                      return {
                        ...ag,
                        coord: player ? { ...player.coord } : ag.coord,
                        path: []
                      };
                    }
                    return ag;
                  }));
                  setTerminalLogs(prev => [
                    ...prev,
                    "[SENSORS] Clockwork Mouse released from pocket! Initiating autonomous exploration..."
                  ]);
                }}
                disabled={mouseReleased}
                className={`flex-1 text-[9px] font-mono font-bold py-1.5 rounded border transition text-center ${
                  mouseReleased
                    ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
                    : "bg-cyan-950/40 border-cyan-500 text-cyan-300 hover:bg-cyan-900/40 shadow-sm"
                }`}
              >
                🚀 RELEASE MOUSE
              </button>
              <button
                onClick={() => {
                  setMouseReleased(false);
                  const player = agents.find(p => p.id === "player");
                  setAgents(prev => prev.map(ag => {
                    if (ag.id === "mouse_toy") {
                      return {
                        ...ag,
                        coord: player ? { ...player.coord } : ag.coord,
                        path: []
                      };
                    }
                    return ag;
                  }));
                  setTerminalLogs(prev => [
                    ...prev,
                    "[SENSORS] Clockwork Mouse retrieved. Blockage memory is preserved!"
                  ]);
                }}
                disabled={!mouseReleased}
                className={`flex-1 text-[9px] font-mono font-bold py-1.5 rounded border transition text-center ${
                  !mouseReleased
                    ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
                    : "bg-amber-950/40 border-amber-500 text-amber-300 hover:bg-amber-900/40 shadow-sm"
                }`}
              >
                🎒 RETRIEVE MOUSE
              </button>
            </div>
            
            <div className="flex items-center justify-between pt-1">
              <span className="text-[9.5px] font-mono text-slate-400">Render GhostSplat AI Heat Overlay:</span>
              <button
                onClick={() => setIsGhostSplatActive(!isGhostSplatActive)}
                className={`text-[9px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                  isGhostSplatActive
                    ? "bg-purple-950/40 border-purple-500 text-purple-300"
                    : "bg-slate-950 border-slate-800 text-slate-450"
                }`}
              >
                {isGhostSplatActive ? "ACTIVE (SHOW)" : "HIDDEN (HIDE)"}
              </button>
            </div>

            <div className="bg-slate-950 p-2 rounded border border-slate-850 text-[8.5px] font-mono text-slate-400 leading-tight space-y-1">
              <div className="flex justify-between">
                <span>Mouse Status:</span>
                <span className={mouseReleased ? "text-cyan-400 font-bold" : "text-amber-400 font-bold"}>
                  {mouseReleased ? "📡 EXPLORING (AI DECIDES)" : "🎒 IN PLAYER POCKET"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mapped Obstruction Elements:</span>
                <span className="text-purple-400 font-bold font-mono">
                  {Object.keys(discoveredBlockages).length} walls mapped
                </span>
              </div>
            </div>
          </div>

          {/* Pathfinder Configuration Parameters */}
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded space-y-3">
            <span className="text-[9px] font-mono font-bold uppercase block mb-1 text-cyan-400 tracking-wider">
              ⚙️ PATHFINDING SETTINGS
            </span>

            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-mono text-slate-400">Diagonal Corner-clip Rule:</span>
              <button
                onClick={() => setDiagonalClipEnabled(!diagonalClipEnabled)}
                className={`text-[9PX] font-mono font-bold px-2.5 py-0.5 rounded border ${
                  diagonalClipEnabled
                    ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500 text-rose-300"
                }`}
              >
                {diagonalClipEnabled ? "ACTIVE (STRICT)" : "DISABLED (LAX)"}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-mono text-slate-400">Character Pathing Class:</span>
              <button
                onClick={() => setCharacterMode(characterMode === "player" ? "npc" : "player")}
                className="text-[9px] font-mono font-bold px-2 py-0.5 bg-slate-950 text-amber-400 border border-amber-800/60 rounded uppercase"
              >
                {characterMode === "player" ? "👤 Player (Edge rules)" : "🤖 NPC (Block directives)"}
              </button>
            </div>

            <div className="bg-slate-950 p-2 rounded border border-slate-850">
              <span className="text-[9px] font-mono font-bold uppercase block text-teal-400 mb-1">
                🌄 SPATIAL SCENARIOS
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => generatePreset("blank_slate")}
                  className="flex-1 text-[8.5px] font-mono bg-slate-900 hover:bg-slate-850 border border-slate-800 py-1 rounded"
                >
                  BLANK SLATE
                </button>
                <button
                  onClick={() => generatePreset("dwarven_tracks")}
                  className="flex-1 text-[8.5px] font-mono bg-slate-900 hover:bg-slate-850 border border-slate-800 py-1 rounded text-cyan-300"
                >
                  CART TRACKS
                </button>
                <button
                  onClick={() => generatePreset("sensor_maze")}
                  className="flex-1 text-[8.5px] font-mono bg-slate-900 hover:bg-slate-850 border border-slate-800 py-1 rounded text-amber-300"
                >
                  SENSOR MAZE
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center column: Active Grid Block (Canvas Render) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="bg-slate-900 border border-slate-850 p-2 rounded flex flex-col items-center relative">
            
            {/* Visual Indicators */}
            <div className="w-full flex justify-between items-center px-1 pb-1.5">
              <span className="text-[9.5px] font-mono text-sky-400 font-bold flex items-center gap-1">
                <Grid className="h-3 w-3 animate-pulse text-sky-400" />
                NTX BOUNDARY GRID: [66 × 66]
              </span>
              <span className="text-[8.5px] font-mono text-slate-500 uppercase bg-slate-950 border border-slate-850 px-2 py-0.5 rounded">
                Active plane: <span className="font-bold text-purple-400">P{activePlane}</span>
              </span>
            </div>

            {/* Canvas Container with static sizes */}
            <div className="relative group overflow-hidden border border-slate-800 rounded">
              <canvas
                ref={canvasRef}
                width={462}
                height={462}
                onMouseDown={handleCanvasMouse}
                onMouseMove={(e) => {
                  if (e.buttons === 1) handleCanvasMouse(e);
                }}
                className="cursor-crosshair bg-slate-950 max-w-full block"
              />
            </div>

            {/* Coordinates and Path details */}
            <div className="w-full mt-2.5 bg-slate-950 p-2 rounded border border-slate-850 flex items-center justify-between text-[9px] font-mono text-slate-400">
              <span>Start: <strong className="text-red-400">({startCoord.x}, {startCoord.y})</strong></span>
              <span>Goal: <strong className="text-blue-400">({goalCoord.x}, {goalCoord.y})</strong></span>
              <span>A* Path nodes: <strong className="text-emerald-400">{currentPath.length} tiles</strong></span>
            </div>
          </div>
        </div>

        {/* Right column: Simulation, Kinetics Details and Terminal logs */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Kinetics engine panel */}
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded space-y-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-mono font-bold uppercase text-cyan-400 tracking-wider">
                🤖 DYNAMIC KINETICS SIMULATOR
              </span>
              <button
                onClick={() => setIsSimPlaying(!isSimPlaying)}
                className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                  isSimPlaying
                    ? "bg-rose-950 text-rose-400 border border-rose-800"
                    : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                }`}
              >
                {isSimPlaying ? (
                  <>
                    <Pause className="h-2.5 w-2.5" /> PAUSE
                  </>
                ) : (
                  <>
                    <Play className="h-2.5 w-2.5" /> START
                  </>
                )}
              </button>
            </div>

            {/* List current kinetics agents */}
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto bg-slate-950 p-2 rounded border border-slate-850">
              {agents.map((ag) => (
                <div key={ag.id} className="flex justify-between items-center text-[9px] font-mono border-b border-slate-900/40 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: ag.color, boxShadow: `0 0 4px ${ag.color}` }}
                    />
                    <span className="text-slate-300 font-bold">{ag.name}</span>
                  </div>
                  <span className="text-slate-400 font-bold">({ag.coord.x}, {ag.coord.y}, P{ag.coord.plane})</span>
                </div>
              ))}
            </div>

            <p className="text-[8px] text-slate-500 font-mono italic leading-dense">
              🤖 <span className="font-bold text-slate-400">Kinetics logic:</span> Mouse toy wanders semi-randomly avoiding obstacles. The Platypus detects player signals and hunts/pursues them in real-time. Guard patrols corridors.
            </p>
          </div>

          {/* Gaussean Envelope Footprint Parameter tuning */}
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded space-y-2">
            <span className="text-[9px] font-mono font-bold uppercase block text-cyan-400 tracking-wider">
              🌌 GAUSSIAN SIGNAL sweep
            </span>

            <div className="flex justify-between items-center text-[9px] font-mono">
              <span className="text-slate-400">Sensor center coordinates:</span>
              <span className="text-cyan-400 font-mono font-bold inline-block bg-slate-950 border border-slate-850 px-1 py-0.5 rounded">
                ({sensorCenter.x}, {sensorCenter.y})
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-mono">
                <span className="text-slate-450 text-[8px]">Standard Deviation (σ width):</span>
                <span className="text-slate-300 font-bold">{gaussianSigma.toFixed(1)} cells</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="18.0"
                step="0.5"
                value={gaussianSigma}
                onChange={(e) => setGaussianSigma(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-950 rounded h-1 cursor-pointer"
              />

              <div className="flex justify-between items-center text-[9px] font-mono">
                <span className="text-slate-450 text-[8px]">Sensor Gain Amplitude (A):</span>
                <span className="text-slate-300 font-bold">{(gaussianAmp * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={gaussianAmp}
                onChange={(e) => setGaussianAmp(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-950 rounded h-1 cursor-pointer"
              />
            </div>

            {/* Sweep detected kinetics table */}
            <div className="bg-slate-950 rounded border border-slate-850 p-1.5 space-y-1">
              <span className="text-[8px] font-mono uppercase block text-slate-450 border-b border-slate-900 pb-0.5">
                🎯 Captured Signal Intersections:
              </span>
              {detectedAgents.length === 0 ? (
                <span className="text-[8px] font-mono text-slate-600 block pl-1">0 kinetics in sweep radius.</span>
              ) : (
                detectedAgents.map((detStr, i) => (
                  <span key={i} className="text-[8.5px] font-mono text-cyan-300 lock leading-none block">
                    ⚡ {detStr}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Path normalizer prompt tool */}
          <div className="bg-slate-900/60 border border-slate-850 p-3 rounded space-y-2">
            <span className="text-[9px] font-mono font-bold uppercase block text-cyan-400 tracking-wider">
              📂 PATH AUTHORITY AESTHETIC RESOLVER
            </span>
            <div className="space-y-1.5">
              <input
                type="text"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                placeholder="Enter absolute computer path..."
                className="w-full bg-slate-950 border border-slate-800 text-[10px] font-mono px-2 py-1.5 rounded focus:outline-none focus:border-cyan-500 text-slate-300"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleNormalizePath}
                  className="flex-1 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/60 text-[9px] font-mono py-1 rounded text-cyan-400 font-bold"
                >
                  NORMALIZE DIRECTORY
                </button>
                <button
                  onClick={() => {
                    // Try to resolve authoritatively
                    const resolved = SovereignPathResolver.resolveauthoritativePath(inputPath);
                    setTerminalLogs((prev) => [
                      ...prev,
                      `[RESOLVER] Checked authorize boundary. Auth path mapped: "${resolved}"`
                    ]);
                  }}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[8.5px] font-mono px-2.5 py-1 rounded text-slate-400"
                >
                  VERIFY AUTH
                </button>
              </div>
            </div>

            {normalizedResult && (
              <div className="bg-slate-950 border border-slate-850 p-2 rounded font-mono text-[8.5px] text-slate-300 space-y-0.5 leading-none">
                <span className="text-slate-500 block">Sovereign Aesthetic Output:</span>
                <span className="text-teal-400 block font-bold truncate break-all">{normalizedResult}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Database audits & Active Varbit Registry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-900">
        
        {/* DB Audit Ledger (Enum, Varbit, DbRow) */}
        <div className="bg-slate-900/60 border border-slate-850 p-3 rounded">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2 mb-2">
            <span className="text-[10px] font-mono font-bold uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" /> SQLite Pedagogy Audit Columns
            </span>

            <div className="flex gap-1.5 shrink-0">
              {(["objects", "npcs", "varbits"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveDbTable(tab);
                    setSelectedDbRow(null);
                  }}
                  className={`text-[8.5px] font-mono px-2 py-0.5 rounded transition ${
                    activeDbTable === tab ? "bg-cyan-950/40 border border-cyan-800 text-cyan-400 font-bold" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {/* Search filter in DB */}
            {activeDbTable !== "varbits" && (
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3 w-3 text-slate-500" />
                <input
                  type="text"
                  value={dbSearchQuery}
                  onChange={(e) => setDbSearchQuery(e.target.value)}
                  placeholder="Query database row keyword (e.g. keldagrim, patrol, mouse)..."
                  className="w-full bg-slate-950 border border-slate-850 text-[9.5px] font-mono pl-7 pr-2 py-1.5 rounded focus:outline-none focus:border-cyan-500 text-slate-300 placeholder-slate-600"
                />
              </div>
            )}

            {/* List Rows */}
            <div className="max-h-[140px] overflow-y-auto space-y-1 bg-slate-950 rounded border border-slate-850 p-2">
              {activeDbTable === "objects" && (
                <table className="w-full text-left font-mono text-[9px] text-slate-400">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-500">
                      <th className="pb-1">DB_FILE_ID</th>
                      <th className="pb-1">DB_COLUMN_NAME</th>
                      <th className="pb-1">WALKABLE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredObjects.map((obj) => (
                      <tr
                        key={obj.id}
                        onClick={() => setSelectedDbRow(obj)}
                        className="hover:bg-slate-900/60 cursor-pointer text-[8.5px]"
                      >
                        <td className="py-1 text-cyan-500">0x{obj.id.toString(16).toUpperCase()}</td>
                        <td className="py-1 text-slate-300 font-bold">{obj.name}</td>
                        <td className="py-1 text-slate-450">{obj.walkable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeDbTable === "npcs" && (
                <table className="w-full text-left font-mono text-[9px] text-slate-400">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-500">
                      <th className="pb-1">ID</th>
                      <th className="pb-1">DB_COLUMN_NAME</th>
                      <th className="pb-1">WALK_RANGE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNpcs.map((npc) => (
                      <tr
                        key={npc.id}
                        onClick={() => setSelectedDbRow(npc)}
                        className="hover:bg-slate-900/60 cursor-pointer text-[8.5px]"
                      >
                        <td className="py-1 text-cyan-500">{npc.id}</td>
                        <td className="py-1 text-slate-300 font-bold">{npc.name}</td>
                        <td className="py-1 text-slate-450">{npc.walk_range} tiles</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeDbTable === "varbits" && (
                <div className="space-y-1">
                  {activeVarbitsDb.map((vb) => (
                    <div key={vb.varbit} className="flex justify-between items-center text-[9px] border-b border-slate-900/40 py-1 hover:bg-slate-900/40 px-1">
                      <div>
                        <span className="text-emerald-400 font-bold mr-2">VARBIT {vb.varbit}</span>
                        <span className="text-slate-400">{vb.description}</span>
                      </div>
                      <button
                        onClick={() => toggleVarbit(vb.varbit)}
                        className={`text-[8.5px] px-2 py-0.5 rounded border transition font-mono ${
                          vb.value === 1
                            ? "bg-emerald-950 border-emerald-800 text-emerald-400"
                            : "bg-slate-900 border-slate-800 text-slate-500"
                        }`}
                      >
                        {vb.value === 1 ? "HIGH_BIT (1)" : "LOW_BIT (0)"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedDbRow && (
              <div className="bg-slate-950 p-2 border border-slate-850 rounded text-[9px] font-mono text-slate-300">
                <span className="text-slate-500 uppercase block text-[8px] mb-1">Row Detail State:</span>
                <div className="grid grid-cols-2 gap-1 bg-slate-900/40 p-1.5 rounded">
                  <div>Name: <strong className="text-teal-400">{selectedDbRow.name}</strong></div>
                  <div>ID: <strong>{selectedDbRow.id}</strong></div>
                  {selectedDbRow.velocity && <div>Velocity: <strong>{selectedDbRow.velocity}</strong></div>}
                  {selectedDbRow.extra && <div className="col-span-2 text-[8px] text-slate-450 mt-1">{selectedDbRow.extra}</div>}
                  {selectedDbRow.motion_formula && <div className="col-span-2 text-[8px] text-slate-450 mt-1">Formula: <strong className="text-purple-400">{selectedDbRow.motion_formula}</strong></div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Console / Shell feedback */}
        <div className="bg-slate-900/60 border border-slate-850 p-3 rounded flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold uppercase text-teal-400 tracking-wider mb-2 flex items-center gap-1.5">
            <Command className="h-3.5 w-3.5 text-teal-400" />
            Sovereign Path Console Outputs
          </span>
          
          <div className="flex-1 bg-slate-950 rounded p-2 border border-slate-850 font-mono text-[9px] overflow-y-auto max-h-[145px] space-y-1.5 text-slate-300 select-all">
            {terminalLogs.slice(-10).map((log, index) => {
              let color = "text-slate-400";
              if (log.includes("[SYS]")) color = "text-slate-500";
              if (log.includes("[VHDL]")) color = "text-amber-400";
              if (log.includes("[VARBIT]")) color = "text-purple-400 animate-pulse";
              if (log.includes("[PATH]")) color = "text-green-400";
              if (log.includes("[SENSOR]")) color = "text-cyan-400";
              if (log.includes("[RESOLVER]")) color = "text-sky-400";
              
              return (
                <div key={index} className={`${color} leading-normal border-l border-slate-900 pl-1.5`}>
                  {log}
                </div>
              );
            })}
          </div>

          <div className="mt-2 text-[8.5px] font-mono text-slate-500 flex justify-between items-center">
            <span>Scan buffer: 0xDEAD_CAFE</span>
            <span>Tick cycle time: 640ms (RSC divider)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
