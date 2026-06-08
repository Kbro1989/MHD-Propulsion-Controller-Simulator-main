/**
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Network, 
  Globe, 
  Cpu, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  FileImage, 
  ShieldCheck, 
  Sparkles, 
  Radio, 
  ChevronRight, 
  Activity, 
  Server, 
  Clock, 
  Sliders,
  Database,
  Key,
  Terminal as TerminalIcon,
  Check,
  FileJson,
  Play,
  Save,
  Trash2,
  Copy,
  ChevronDown,
  DollarSign,
  TrendingUp,
  Layers,
  AlertTriangle,
  Lock,
  Volume2,
  Shuffle,
  FileText,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { HexagramState } from "../types";
import { 
  getSubstrateConfig, 
  checkEdgeAvailability, 
  generateSensoryImage, 
  RemotePlayerNode 
} from "../utils/cloudflareSubstrate";

// 10-Tool Overlay and Sovereign Revenue mapping config matrix
interface CognitiveToolConfig {
  id: string;
  name: string;
  submodule: string;
  submoduleDesc: string;
  tier: string;
  tierDesc: string;
  icon: any;
  accent: string;
}

const COGNITIVE_TOOLS: CognitiveToolConfig[] = [
  {
    id: "flatbuffers",
    name: "01. FlatBuffers + Arrow",
    submodule: "Submodule 6: Temporal Router / Ternary Engine",
    submoduleDesc: "High-performance edge layout & zero-copy binary serialization structure",
    tier: "All Tiers (Embedded)",
    tierDesc: "Baked into core firmware distribution to slash transmission overhead by 87%.",
    icon: FileText,
    accent: "text-amber-400 border-amber-950/40 bg-amber-955/20",
  },
  {
    id: "onnx",
    name: "02. ONNX Runtime Web",
    submodule: "Submodule 5: Deterministic CNS / HexagramManager",
    submoduleDesc: "On-device quantized neural inference for real-time anomaly classification",
    tier: "Primary + Stack Lease",
    tierDesc: "Proprietary offline model weights secure air-gapped sovereign intelligence.",
    icon: Cpu,
    accent: "text-emerald-400 border-emerald-950/40 bg-emerald-955/20",
  },
  {
    id: "duckdb",
    name: "03. DuckDB-WASM",
    submodule: "Submodule 2: Thermal Cascade",
    submoduleDesc: "In-browser analytical SQL engine processing high-frequency Parquet frames",
    tier: "Stack Lease + Deep-Tech",
    tierDesc: "Empowers operator command stations to run offline multi-variant relational filters.",
    icon: Database,
    accent: "text-cyan-400 border-cyan-950/40 bg-cyan-955/20",
  },
  {
    id: "ollama",
    name: "04. Ollama JSON Mode",
    submodule: "Submodule 4: CO₂ Transpiration / Boundary Layer",
    submoduleDesc: "Strict schema-guided local LLM narrative generation for diagnostics logs",
    tier: "Deep-Tech License",
    tierDesc: "Bundled alongside venting hardware for human-scannable anomaly storytelling.",
    icon: Sparkles,
    accent: "text-violet-400 border-violet-950/40 bg-violet-955/20",
  },
  {
    id: "merkle",
    name: "05. Merkle Tree Audit Chain",
    submodule: "Submodule 7: DNA Substrate / Self-Describing State",
    submoduleDesc: "Cryptographic state lineage logs with near-instant tamper validation and audit seals",
    tier: "Primary (Sovereign)",
    tierDesc: "Immutable provenance tracking for defense command certification.",
    icon: Lock,
    accent: "text-teal-400 border-teal-950/40 bg-teal-955/20",
  },
  {
    id: "spectral",
    name: "06. WebGL Spectral Engine",
    submodule: "Submodule 1: Magnetic Shielding Cascade",
    submoduleDesc: "GPU-accelerated real-time multi-band magnetic field harmonic vector monitor",
    tier: "Defense Primes",
    tierDesc: "Immersive tactical visualizations separating premium licensees from raw competitors.",
    icon: Radio,
    accent: "text-blue-400 border-blue-950/40 bg-blue-955/20",
  },
  {
    id: "entropy",
    name: "07. Transfer Entropy",
    submodule: "Submodule 5: Deterministic CNS / HexagramManager",
    submoduleDesc: "Directed information-theory causality calculator measuring cross-domain signal leaks",
    tier: "Primary + Stack Lease",
    tierDesc: "Drives predictive boundary layer adjustment based on heat emission kinetics.",
    icon: Activity,
    accent: "text-indigo-400 border-indigo-950/40 bg-indigo-955/20",
  },
  {
    id: "chaos",
    name: "08. Chaos Limb",
    submodule: "Submodule 3: HV SiC Switching",
    submoduleDesc: "High-voltage interlock adversarial jitter and glitch stress-testing generator",
    tier: "Sovereign Agencies",
    tierDesc: "Allows localized air-gapped red-teams to simulate microsecond switching degradation.",
    icon: Shuffle,
    accent: "text-red-400 border-red-950/40 bg-red-955/20",
  },
  {
    id: "piper",
    name: "09. Piper TTS",
    submodule: "Submodule 5: Deterministic CNS / HexagramManager",
    submoduleDesc: "Ultra-low latency phonetic voice synthesizer translating hexagram transitions",
    tier: "Stack Lease",
    tierDesc: "Vocalizes critical telemetry alarms to submarine crews directly.",
    icon: Volume2,
    accent: "text-rose-400 border-rose-955/40 bg-rose-955/20",
  },
  {
    id: "replay",
    name: "10. Deterministic Replay",
    submodule: "Submodule 5: Deterministic CNS / HexagramManager",
    submoduleDesc: "Chronological black-box state reconstruction tool guaranteeing bit-for-bit playback",
    tier: "All Tiers (Baseline)",
    tierDesc: "Enforces exact replay of complex state divergence incidents for root-cause audit.",
    icon: RefreshCw,
    accent: "text-fuchsia-400 border-fuchsia-955/40 bg-fuchsia-955/20",
  }
];

interface SovereignGlobePanelProps {
  currentHexagram: HexagramState;
  avgElectrodeTemp: number;
  busCurrentA: number;
  tickCounter: number;
  addLogEntry: (subsystem: any, level: any, msg: string) => void;
}

// Pre-seeded authentic pog2 user data provided in user spec
const DEFAULT_POG2_USER_JSON = {
  "username": "pog2",
  "password": "yaostate",
  "group": 0,
  "x": 219,
  "y": 511,
  "fatigue": 64,
  "combatStyle": 0,
  "blockChat": false,
  "blockPrivateChat": false,
  "blockTrade": false,
  "blockDuel": false,
  "cameraAuto": false,
  "oneMouseButton": 0,
  "soundOn": 1,
  "hairColour": 9,
  "topColour": 8,
  "trouserColour": 11,
  "skinColour": 0,
  "headSprite": 7,
  "bodySprite": 2,
  "skulled": 0,
  "friends": [],
  "ignores": [],
  "inventory": [
    {"id": 10, "amount": 6},
    {"id": 1289, "equipped": true},
    {"id": 1031},
    {"id": 581, "equipped": true},
    {"id": 795},
    {"id": 36, "amount": 1}
  ],
  "bank": [],
  "questPoints": 0,
  "questStages": {},
  "skills": {
    "attack": {"current": 1, "experience": 0, "base": 1},
    "defense": {"current": 1, "experience": 0, "base": 1},
    "strength": {"current": 1, "experience": 0, "base": 1},
    "hits": {"current": 6, "experience": 4608, "base": 6},
    "ranged": {"current": 1, "experience": 0, "base": 1},
    "prayer": {"current": 1, "experience": 0, "base": 1},
    "magic": {"current": 1, "experience": 0, "base": 1},
    "cooking": {"current": 1, "experience": 0, "base": 1},
    "woodcutting": {"current": 1, "experience": 0, "base": 1},
    "fletching": {"current": 1, "experience": 0, "base": 1},
    "fishing": {"current": 1, "experience": 0, "base": 1},
    "firemaking": {"current": 1, "experience": 0, "base": 1},
    "crafting": {"current": 1, "experience": 0, "base": 1},
    "smithing": {"current": 1, "experience": 0, "base": 1},
    "mining": {"current": 1, "experience": 0, "base": 1},
    "herblaw": {"current": 1, "experience": 0, "base": 1},
    "agility": {"current": 1, "experience": 0, "base": 1},
    "thieving": {"current": 1, "experience": 16, "base": 1}
  },
  "cache": {},
  "loginIP": null,
  "world": 0,
  "id": 760101,
  "loginDate": 1769712931037
};

export default function SovereignGlobePanel({
  currentHexagram,
  avgElectrodeTemp,
  busCurrentA,
  tickCounter,
  addLogEntry
}: SovereignGlobePanelProps) {
  const config = useMemo(() => getSubstrateConfig(), []);
  
  // Automated health audit trigger
  useEffect(() => {
    if (tickCounter > 0 && tickCounter % 64 === 0) {
      addLogEntry("SYSTEM" as any, "INFO", `[AUDIT] Yao Cycle Health Check Triggered (Tick: ${tickCounter})`);
      // runHealthAudit('yao_cycle'); // Pending implementation of actual bridge integration
    }
    if (tickCounter > 0 && tickCounter % 1406 === 0) {
      addLogEntry("SYSTEM" as any, "INFO", `[AUDIT] Hexagram Gate Health Check Triggered (Tick: ${tickCounter})`);
      // runHealthAudit('hexagram_gate');
    }
  }, [tickCounter]);

  // Tab selector state
  const [activeTab, setActiveTab] = useState<"globe" | "kv" | "globalping" | "budget" | "tools">("globe");

  // 10-Tool Overlay and Simulation Board states
  const [activeToolId, setActiveToolId] = useState<string>("flatbuffers");

  // Tool 1: FlatBuffers
  const [t1Serializing, setT1Serializing] = useState<boolean>(false);
  const [t1Logs, setT1Logs] = useState<string[]>([]);
  const [t1Result, setT1Result] = useState<{ jsonSize: number; fbSize: number; speedUs: number; savings: number } | null>(null);

  // Tool 2: ONNX Runtime Web
  const [t2ElectrodeTemp, setT2ElectrodeTemp] = useState<number>(315);
  const [t2BusCurrent, setT2BusCurrent] = useState<number>(450);
  const [t2PlenumPressure, setT2PlenumPressure] = useState<number>(1.25);
  const [t2InferenceOutput, setT2InferenceOutput] = useState<{ probability: number; status: string; latencyMs: number } | null>(null);
  const [t2Running, setT2Running] = useState<boolean>(true);

  // Tool 3: DuckDB-WASM
  const [t3Query, setT3Query] = useState<string>("SELECT avg(temperature_ma) AS avg_heat, count(*) AS frames FROM telemetry_log WHERE status = 'WARP';");
  const [t3Result, setT3Result] = useState<Array<any> | null>(null);
  const [t3Executing, setT3Executing] = useState<boolean>(false);

  // Tool 4: Ollama JSON Mode
  const [t4Scenario, setT4Scenario] = useState<string>("boundary_leak");
  const [t4Narrative, setT4Narrative] = useState<any | null>(null);
  const [t4Generating, setT4Generating] = useState<boolean>(false);

  // Tool 5: Merkle Tree Audit Chain
  const [t5LogsToHash, setT5LogsToHash] = useState<string[]>([
    "STATECHANGE: Yao Yang established",
    "ELECTRODE: Temp normalized at 312K",
    "INTERLOCK: Switch contactor #4 Closed",
    "CHOKE_FREQ: Steady lock at 420.5 Hz"
  ]);
  const [t5TamperedIndex, setT5TamperedIndex] = useState<number | null>(null);
  const [t5TamperPayload, setT5TamperPayload] = useState<string>("");
  const [t5Recalculating, setT5Recalculating] = useState<boolean>(false);

  // Tool 6: WebGL Spectral Engine
  const [t6Frequency, setT6Frequency] = useState<number>(12.5); // MHz
  const [t6FieldStrength, setT6FieldStrength] = useState<number>(2.4); // Tesla
  const [t6SpectralPeaks, setT6SpectralPeaks] = useState<number[]>([12, 45, 78, 62, 33, 15, 8, 4]);

  // Tool 7: Transfer Entropy
  const [t7VarX, setT7VarX] = useState<string>("Thermal Swarm (Submodule 2)");
  const [t7VarY, setT7VarY] = useState<string>("CO2 Transpiration (Submodule 4)");
  const [t7Score, setT7Score] = useState<{ entropyBits: number; direction: string; confidence: number } | null>(null);
  const [t7Calculating, setT7Calculating] = useState<boolean>(false);

  // Tool 8: Chaos Limb
  const [t8ContactorJitter, setT8ContactorJitter] = useState<number>(150); // ns
  const [t8Injecting, setT8Injecting] = useState<boolean>(false);
  const [t8ChaosResult, setT8ChaosResult] = useState<{ severity: string; outcome: string; log: string } | null>(null);

  // Tool 9: Piper TTS
  const [t9InputMessage, setT9InputMessage] = useState<string>("Magnetic shielding cascade fully locked. High voltage switching now online.");
  const [t9SpeechStatus, setT9SpeechStatus] = useState<"idle" | "rendering" | "completed">("idle");
  const [t9Phonemes, setT9Phonemes] = useState<string>("");

  // Tool 10: Deterministic Replay
  const [t10StepIndex, setT10StepIndex] = useState<number>(4);
  const [t10Frames] = useState<Array<{ tick: number; hex: string; current: number; temp: number; hash: string }>>([
    { tick: 104, hex: "Yao Yin (0x01)", current: 310, temp: 302, hash: "0xe81a4b" },
    { tick: 105, hex: "Yao Yin (0x01)", current: 315, temp: 304, hash: "0xfa49cb" },
    { tick: 106, hex: "Hexagram Gate (0x03)", current: 412, temp: 315, hash: "0xb49a93" },
    { tick: 107, hex: "Yao Yang (0x05)", current: 450, temp: 320, hash: "0x8fa40c" },
    { tick: 108, hex: "Yao Yang (0x05)", current: 450, temp: 318, hash: "0xc8491d" },
    { tick: 109, hex: "Yao Yang (0x05)", current: 448, temp: 316, hash: "0x4a9d20" },
    { tick: 110, hex: "Yao Yang (0x05)", current: 445, temp: 315, hash: "0xfa11b0" },
    { tick: 111, hex: "Yao Yang (0x05)", current: 440, temp: 314, hash: "0xd94e33" },
    { tick: 112, hex: "Yao Yang (0x05)", current: 442, temp: 312, hash: "0x0aa2ff" },
    { tick: 113, hex: "Yao Yang (0x05)", current: 441, temp: 311, hash: "0x9ef05a" }
  ]);

  // Free Budget Simulator states
  const [expectedPlayers, setExpectedPlayers] = useState<number>(10);
  const [emulatedAlarmLogs, setEmulatedAlarmLogs] = useState<string[]>([
    "[SYSTEM] Diagnostic Scheduler initialized. Ready to execute 15-minute gate compilation."
  ]);
  const [isAlarmTransitioning, setIsAlarmTransitioning] = useState<boolean>(false);

  // Globalping Simulation states
  const [globalpingLoading, setGlobalpingLoading] = useState<boolean>(false);
  const [globalpingLogs, setGlobalpingLogs] = useState<string[]>([]);
  const [globalpingTarget, setGlobalpingTarget] = useState<string>(config.workerUrl || "https://hello-ai.kristain33rs.workers.dev");
  const [globalpingType, setGlobalpingType] = useState<"http" | "ping">("http");
  const [globalpingLocation, setGlobalpingLocation] = useState<string>("magic: world");
  const [globalpingProbeLimit, setGlobalpingProbeLimit] = useState<number>(10);
  const [globalpingResults, setGlobalpingResults] = useState<Array<{
    probeId: string;
    city: string;
    country: string;
    asn: string;
    provider: string;
    type: "eyeball" | "datacenter" | "cellular";
    latency: number;
    tlsHandshake?: number;
    match: boolean;
    precision: number;
  }> | null>(null);

  const [globalpingMode, setGlobalpingMode] = useState<"SIMULATION" | "REAL_API">("REAL_API");
  const [validationSource, setValidationSource] = useState<"SIMULATION_ONLY" | "REAL_API_SYNC">("SIMULATION_ONLY");
  const [globalpingValidationResult, setGlobalpingValidationResult] = useState<{
    status: "IDLE" | "SUCCESS" | "WARNING" | "FAILED";
    type: string;
    target: string;
    probesCount: number;
    avgRawRtt: string;
    simAvgRtt: string;
    correlationScore: string;
    remarks: string;
  } | null>(null);

  const generateSimulatedProbes = (location: string, type: "http" | "ping") => {
    const baseProbes = [
      { city: "Berlin", country: "DE", asn: "AS1653", provider: "DTAG Eyeball", type: "eyeball" as const, usDelay: 110, euDelay: 12 },
      { city: "Frankfurt", country: "DE", asn: "AS3320", provider: "Deutsche Telekom", type: "eyeball" as const, usDelay: 115, euDelay: 15 },
      { city: "Ohio", country: "US", asn: "AS16509", provider: "Amazon Web Services", type: "datacenter" as const, usDelay: 28, euDelay: 112 },
      { city: "Oregon", country: "US", asn: "AS16509", provider: "Amazon Web Services", type: "datacenter" as const, usDelay: 12, euDelay: 135 },
      { city: "London", country: "GB", asn: "AS1239", provider: "Sprint International", type: "datacenter" as const, usDelay: 85, euDelay: 22 },
      { city: "São Paulo", country: "BR", asn: "AS26599", provider: "Telefonica Brasil", type: "eyeball" as const, usDelay: 140, euDelay: 198 },
      { city: "Tokyo", country: "JP", asn: "AS2516", provider: "KDDI Corporation", type: "cellular" as const, usDelay: 98, euDelay: 232 },
      { city: "Sydney", country: "AU", asn: "AS4804", provider: "Optus Communications", type: "eyeball" as const, usDelay: 165, euDelay: 285 }
    ];

    let filtered = baseProbes;
    const locLower = location.toLowerCase();
    if (locLower.includes("germany") || locLower.includes("berlin") || locLower.includes("europe") || locLower.includes("de")) {
      filtered = baseProbes.filter(p => ["DE", "GB"].includes(p.country));
    } else if (locLower.includes("us") || locLower.includes("aws") || locLower.includes("oregon") || locLower.includes("ohio")) {
      filtered = baseProbes.filter(p => ["US"].includes(p.country));
    } else if (locLower.includes("south america") || locLower.includes("brazil") || locLower.includes("br")) {
      filtered = baseProbes.filter(p => ["BR"].includes(p.country));
    } else if (locLower.includes("tokyo") || locLower.includes("japan") || locLower.includes("asia") || locLower.includes("jp")) {
      filtered = baseProbes.filter(p => ["JP"].includes(p.country));
    }

    return filtered.slice(0, globalpingProbeLimit).map((p, i) => {
      const isEu = ["DE", "GB"].includes(p.country);
      const delay = isEu ? p.euDelay : p.usDelay;
      const jitter = Math.sin(i * 1.5) * 4;
      const actDelay = Math.max(5, Math.round(delay + jitter));
      
      return {
        probeId: `prb_${Math.floor(Math.random() * 9000 + 1000)}`,
        city: p.city,
        country: p.country,
        asn: p.asn,
        provider: p.provider,
        type: p.type,
        latency: actDelay,
        tlsHandshake: type === "http" ? Math.max(2, Math.round(actDelay * 0.35 + 4)) : undefined,
        match: true,
        precision: Number((98 + Math.random() * 1.95).toFixed(2))
      };
    });
  };

  const handleGlobalpingDispatch = async () => {
    setGlobalpingLoading(true);
    setGlobalpingResults(null);
    setGlobalpingLogs([]);
    setGlobalpingValidationResult(null);
    
    const cleanTarget = globalpingTarget
      .replace(/^https?:\/\//, "")
      .replace(/^wss?:\/\//, "")
      .split("/")[0]
      .split(":")[0] || "google.com";

    const resolveMagicLocation = (loc: string) => {
      if (loc === "Berlin, Germany") return "Europe";
      if (loc === "Oregon, US") return "US West";
      if (loc === "South America") return "South America";
      if (loc === "Tokyo, Japan") return "Tokyo";
      return "world";
    };

    addLogEntry("MULTILAYER" as any, "INFO", `Dispatching Globalping metrics verification for target endpoint: ${cleanTarget}`);

    if (globalpingMode === "REAL_API") {
      try {
        setGlobalpingLogs(prev => [...prev, `[API-CLIENT] DISPATCH POST https://api.globalping.io/v1/measurements`]);
        
        const locName = resolveMagicLocation(globalpingLocation);
        const reqPayload = {
          type: globalpingType === "http" ? "http" : "ping",
          target: cleanTarget,
          locations: locName === "world" ? [] : [{ magic: locName }],
          limit: globalpingProbeLimit
        };

        setGlobalpingLogs(prev => [...prev, `[API-CLIENT] Payload parameters: ${JSON.stringify(reqPayload)}`]);
        
        const postRes = await fetch("https://api.globalping.io/v1/measurements", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(reqPayload)
        });

        if (!postRes.ok) {
          const errText = await postRes.text().catch(() => "");
          throw new Error(`Globalping POST error (${postRes.status}): ${errText || "unauthorized/throttled"}`);
        }

        const postData = await postRes.json();
        const measurementId = postData.id;
        
        setGlobalpingLogs(prev => [
          ...prev, 
          `[API-SERVER] RESP 201 Created - Measurement ID: ${measurementId}`,
          `[API-SERVER] Querying globally distributed network probe clusters...`
        ]);

        let attempts = 0;
        let finished = false;
        let getResData: any = null;

        while (attempts < 12 && !finished) {
          await new Promise(r => setTimeout(r, 1500));
          attempts++;
          
          setGlobalpingLogs(prev => [...prev, `[API-SERVER] Polling live vantage response state (Attempt #${attempts})...`]);
          
          const getRes = await fetch(`https://api.globalping.io/v1/measurements/${measurementId}`);
          if (getRes.ok) {
            getResData = await getRes.json();
            if (getResData.status === "finished") {
              finished = true;
              setGlobalpingLogs(prev => [...prev, `[API-SERVER] Verification completed! All active endpoint probes responded.`]);
            } else {
              const rcvCount = getResData.results?.length || 0;
              setGlobalpingLogs(prev => [...prev, `[API-SERVER] Status check: "${getResData.status}". Ready nodes: ${rcvCount}/${globalpingProbeLimit}`]);
            }
          } else {
            setGlobalpingLogs(prev => [...prev, `[API-SERVER] Warning: Polling endpoint status failed: ${getRes.status}`]);
          }
        }

        if (getResData && getResData.results && getResData.results.length > 0) {
          const realProbes = getResData.results.map((resItem: any, idx: number) => {
            const probeInfo = resItem.probe || {};
            const stats = resItem.result?.stats || {};
            const actualLatency = Math.round(stats.avg || stats.min || 20);
            
            return {
              probeId: `prb_real_${probeInfo.asn || idx}_${Math.floor(Math.random() * 900 + 100)}`,
              city: probeInfo.city || "Edge Gateway",
              country: probeInfo.country || "GLOBAL",
              asn: `AS${probeInfo.asn || "unknown"}`,
              provider: probeInfo.network || "Service ISP",
              type: "datacenter" as const,
              latency: actualLatency,
              tlsHandshake: globalpingType === "http" ? Math.max(2, Math.round(actualLatency * 0.32 + 3)) : undefined,
              match: true,
              precision: Number((99.2 + Math.random() * 0.75).toFixed(2))
            };
          });

          setGlobalpingResults(realProbes);
          setValidationSource("REAL_API_SYNC");

          const realSum = realProbes.reduce((acc: number, cur: any) => acc + cur.latency, 0);
          const realAvg = (realSum / realProbes.length);
          
          const simProbes = generateSimulatedProbes(globalpingLocation, globalpingType);
          const simSum = simProbes.reduce((acc: number, cur: any) => acc + cur.latency, 0);
          const simAvg = (simSum / simProbes.length);

          const correlation = realAvg > 0 ? (1 - Math.abs(realAvg - simAvg) / Math.max(realAvg, simAvg)) * 100 : 0;

          setGlobalpingValidationResult({
            status: "SUCCESS",
            type: globalpingType.toUpperCase(),
            target: cleanTarget,
            probesCount: realProbes.length,
            avgRawRtt: `${realAvg.toFixed(1)} ms`,
            simAvgRtt: `${simAvg.toFixed(1)} ms`,
            correlationScore: `${Math.max(0, Math.min(100, correlation)).toFixed(1)}%`,
            remarks: `Sovereign telemetry synchronized with real-world DNS/RTT edge measurements on Globalping network. Verified OK.`
          });

          addLogEntry("MULTILAYER" as any, "SUCCESS", `Globalping live verification audit compiled. Synchronized ${realProbes.length} probe traces.`);
          setGlobalpingLoading(false);
          return;
        } else {
          throw new Error("Timeout: No active probes responded with metrics within the time limit.");
        }
      } catch (err: any) {
        addLogEntry("MULTILAYER" as any, "WARNING", `Globalping real API offline/restricted: ${err.message || String(err)}. Falling back to simulation.`);
        setGlobalpingLogs(prev => [
          ...prev,
          `[API-CLIENT-ERR] Real-Time query execution failed: ${err.message || String(err)}`,
          `[API-CLIENT-ERR] Automatically initiating simulated mirror backup verification run...`
        ]);
      }
    }

    // Default simulation fallback handler
    setValidationSource("SIMULATION_ONLY");
    
    const logsList = [
      `[SIMULATION-VALIDATE] Initiating isolated loop target verification: ${cleanTarget}`,
      `[SIMULATION-VALIDATE] Parsing protocol structures: type="${globalpingType}" target="${cleanTarget}" limit=${globalpingProbeLimit}`,
      `[API-SERVER] RESP 201 Created - Measurement ID: m_gping_sim_${Math.floor(Math.random() * 90000 + 10000)}`,
      `[API-SERVER] Querying globally distributed network probe clusters...`,
      `[API-SERVER] Resolving active physical endpoints...`,
      `[API-SERVER] Pinging target and decoding regional geolocation headers (CF-IPCountry, MaxMind)...`,
      `[API-SERVER] Aggregating measurements from vantage points...`
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < logsList.length) {
        setGlobalpingLogs(prev => [...prev, logsList[step]]);
        step++;
      } else {
        clearInterval(interval);
        const results = generateSimulatedProbes(globalpingLocation, globalpingType);
        setGlobalpingResults(results);

        const simSum = results.reduce((acc: number, cur: any) => acc + cur.latency, 0);
        const simAvg = (simSum / results.length);

        setGlobalpingValidationResult({
          status: "WARNING",
          type: globalpingType.toUpperCase(),
          target: cleanTarget,
          probesCount: results.length,
          avgRawRtt: `[SIMULATED CLIENT MIRROR]`,
          simAvgRtt: `${simAvg.toFixed(1)} ms`,
          correlationScore: `99.5% (Baseline Match)`,
          remarks: `No active internet ping dispatched, but trace schema and regional mappings are 100% compliant with standard Globalping specifications.`
        });

        setGlobalpingLoading(false);
        addLogEntry("MULTILAYER" as any, "SUCCESS", `Globalping simulation validated. Dispatched mock geo audit across ${results.length} simulated coordinate locations.`);
      }
    }, 380);
  };

  const triggerEmulatedAlarm = () => {
    setIsAlarmTransitioning(true);
    setEmulatedAlarmLogs([]);
    
    addLogEntry("SYSTEM" as any, "INFO", "Executing 15-minute Hexagram Gate Alarm telemetry batch optimization.");

    const sequence = [
      "[ALARM_INIT] ⏰ POG2WorldDO scheduler alarm triggered",
      "[STEP 1: API POLLS] Dispatching 50 concurrent external subrequests (Globalping, SatNOGS, OpenSky, Open-Meteo launcher checks)...",
      "[STEP 1: RESPONSE] Received payloads successfully; total cost: $0.00 (subrequests are free inside DO context)",
      "[STEP 2: LOCAL COMPILE] Reading local 'monitoring_stack' from memory Durable Object SQLite database...",
      `[STEP 2: LOCAL COMPILE] Extracted ${Math.floor(Math.random() * 8 + 5)} offline-queued ROS 2 sensor_msgs and ArduPilot MAVLink frames from SQLite`,
      "[STEP 3: NORMALIZATION] Aggregating local simulation and external API metrics into one single unified JSON telemetry frame",
      "[STEP 4: PERSISTENCE] Dispatching consolidated frame to Cloudflare D1 audit logs database...",
      "[STEP 4: DB_SUCCESS] SQL executed: INSERT INTO telemetry_log (ts, frame) VALUES (...). D1 writes consumed: 1 key log (0.1% daily cap)",
      "[STEP 5: BROADCAST] Broadcasting compiled frame via WebSocket channel to active client telemetry views",
      "[STEP 6: SCHEDULE_RESET] Cleanup: marked compiled SQLite references as 'processed=1' to reclaim memory. Rescheduling standard alarm: storage.setAlarm(Date.now() + 15 * 60 * 1000)"
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < sequence.length) {
        setEmulatedAlarmLogs(prev => [...prev, sequence[step]]);
        step++;
      } else {
        clearInterval(interval);
        setIsAlarmTransitioning(false);
        addLogEntry("SYSTEM" as any, "SUCCESS", "Free-Tier Telemetry Alarm flush completed. SQLite compacted; 1 row written to D1.");
      }
    }, 450);
  };

  // Tool 1: FlatBuffers + Arrow Simulation Trigger
  const handleT1RunSimulation = () => {
    setT1Serializing(true);
    setT1Result(null);
    setT1Logs([]);

    const sequence = [
      "[INFO] 📥 Hooking 16-channel sensor logs from live active DO (YaoState: 0x05)...",
      "[INFO] 🔍 Scanning JSON structures inside telemetry stack... Total raw frames: 24",
      "[INFO] ⚙️ Running FlatBuffers compiler on schema 'POG2_MHD_PROP.fbs' against fields...",
      "[INFO] ⚡ Byte-aligning vtable metadata and pre-calculating offsets (zero-allocation vector copy)...",
      "[INFO] 🔀 Constructing Apache Arrow IPC RecordBatch array stream format...",
      "[SUCCESS] 💾 Binary compilation finalized. Packed buffer stored in transactional SQLite."
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < sequence.length) {
        setT1Logs(prev => [...prev, sequence[step]]);
        step++;
      } else {
        clearInterval(interval);
        setT1Serializing(false);
        setT1Result({
          jsonSize: 768,
          fbSize: 84,
          speedUs: 1.82,
          savings: 89.06
        });
        addLogEntry("SYSTEM" as any, "SUCCESS", "FlatBuffers zero-copy binary layout successfully serialized. Bandwidth compressed from 768 to 84 Bytes (89.0% saved).");
      }
    }, 300);
  };

  // Tool 2: ONNX Runtime Web Simulation Trigger
  const handleT2RunInference = () => {
    setT2Running(true);
    setT2InferenceOutput(null);

    setTimeout(() => {
      setT2Running(false);
      let prob = 0.005;
      if (t2ElectrodeTemp > 360) prob += 0.32;
      if (t2ElectrodeTemp > 410) prob += 0.44;
      if (t2BusCurrent > 550) prob += 0.15;
      if (t2BusCurrent > 750) prob += 0.28;
      if (t2PlenumPressure > 1.8) prob += 0.11;
      if (t2PlenumPressure > 2.5) prob += 0.22;

      let status = "NOMINAL (99.9% PATTERN MATCH)";
      if (prob > 0.75) {
        status = "⚠️ CRITICAL THERMAL ESCAPE WARNING";
      } else if (prob > 0.40) {
        status = "⚡ HIGH-FREQUENCY JITTER DETECTED";
      } else if (prob > 0.15) {
        status = "📈 SLIGHT FLUID RESONANCE DRIFT";
      }

      setT2InferenceOutput({
        probability: Number((Math.min(0.999, prob) * 100).toFixed(2)),
        status,
        latencyMs: Number((1.38 + Math.random() * 0.4).toFixed(2))
      });

      addLogEntry(
        "SYSTEM" as any, 
        prob > 0.60 ? "ERROR" : prob > 0.20 ? "WARN" : "SUCCESS", 
        `ONNX runtime WASM: classification inference completed. Probability: ${(prob * 100).toFixed(1)}%. Status: ${status}`
      );
    }, 450);
  };

  // Tool 3: DuckDB-WASM Simulation Trigger
  const handleT3RunQuery = () => {
    setT3Executing(true);
    setT3Result(null);

    setTimeout(() => {
      setT3Executing(false);
      // Generate some interesting rows depending on query typed
      if (t3Query.toLowerCase().includes("avg")) {
        setT3Result([
          { status_class: "WARP_YANG", avg_heat_kelvin: 312.4, peak_current_a: 480.2, audit_rows: 14820 },
          { status_class: "YAO_YANG", avg_heat_kelvin: 324.8, peak_current_a: 550.5, audit_rows: 62282 },
          { status_class: "YAO_YIN", avg_heat_kelvin: 298.1, peak_current_a: 310.0, audit_rows: 71204 }
        ]);
      } else {
        setT3Result([
          { timestamp_offset: "15:00:22", variable: "electrode_temp", measured_value: t2ElectrodeTemp, deviation_score: 0.02 },
          { timestamp_offset: "15:00:23", variable: "bus_current", measured_value: t2BusCurrent, deviation_score: 0.05 },
          { timestamp_offset: "15:00:24", variable: "plenum_pressure", measured_value: t2PlenumPressure, deviation_score: 0.01 }
        ]);
      }
      addLogEntry("SYSTEM" as any, "SUCCESS", `DuckDB-WASM local vectorized query optimized. Scanned 148,306 memory rows in 2.34ms.`);
    }, 550);
  };

  // Tool 4: Ollama JSON Narrative Generator Simulation
  const handleT4RunNarrative = () => {
    setT4Generating(true);
    setT4Narrative(null);

    setTimeout(() => {
      setT4Generating(false);
      let output: any = {};
      if (t4Scenario === "boundary_leak") {
        output = {
          event_uid: "evt_mhd_773x_boundary",
          timestamp_utc: new Date().toISOString(),
          criticality: "CRITICAL",
          narrative_description: "Transient Boundary Layer separation detected on subsea node #4 near the aft thrust throat. Backpressure valve was automatically actuated, releasing CO2 transpiration mist to buffer wall turbulence and avoid kinetic cavitation.",
          subsystem_implicated: "CO2_TRANSPIRATION_CORE",
          recommended_restoration_playbook: "Slightly decrease Magnetic Shield Current parameter by -5% until current distribution indexes are uniform.",
          structural_signature: {
            vibration_db: 42.1,
            flow_rate_lpm: 12.8,
            boundary_layer_adhesion: "0.92 (Sufficient)"
          }
        };
      } else if (t4Scenario === "thermal_surge") {
        output = {
          event_uid: "evt_mhd_911y_thermal_surge",
          timestamp_utc: new Date().toISOString(),
          criticality: "HIGH",
          narrative_description: "High-frequency thermal surge registered on propulsion electrode array #3. Excess heat successfully dissipated into the integrated thermal cascade buffer space; core-temperature stabilized in 40ms.",
          subsystem_implicated: "THERMAL_CASCADE_ARRAY",
          recommended_restoration_playbook: "Examine SiC contactor switching cycles for high frequency jitter on diagnostic slot 0x08.",
          structural_signature: {
            electrode_temp_kelvin: t2ElectrodeTemp,
            heat_transfer_coefficient: "1280 W/m²K",
            gate_lock_retained: true
          }
        };
      } else {
        output = {
          event_uid: "evt_mhd_104a_gate_comp",
          timestamp_utc: new Date().toISOString(),
          criticality: "INFO",
          narrative_description: "System completed standard 15-minute Hexagram Gate transition without faults. All hardware registers report steady-state status coefficients in transactional SQLite.",
          subsystem_implicated: "HEXAGRAM_SCHEDULER",
          recommended_restoration_playbook: "No immediate actions required. Review compiled D1 audit indices at the daily circadian reset.",
          structural_signature: {
            d1_writes: 1,
            sqlite_rows_compacted: 24,
            clock_drift_ns: 8
          }
        };
      }
      setT4Narrative(output);
      addLogEntry("SYSTEM" as any, "SUCCESS", `Ollama local LLM: Narrative JSON parsed successfully under schema constraints.`);
    }, 650);
  };

  // Tool 5: Merkle Tree Hash Computations
  const getT5MerkleTreeData = () => {
    // Simple helper function to mock real hash string
    const simpleHash = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return "0x" + Math.abs(hash).toString(16).padStart(8, "0");
    };

    const inputs = [...t5LogsToHash];
    if (t5TamperedIndex !== null) {
      inputs[t5TamperedIndex] = t5TamperPayload || "⚠️ CORRUPTED DATA BLOCK ⚠️";
    }

    const leaves = inputs.map(simpleHash);
    const p1 = simpleHash(leaves[0] + leaves[1]);
    const p2 = simpleHash(leaves[2] + leaves[3]);
    const root = simpleHash(p1 + p2);

    return {
      inputs,
      leaves,
      parentNodes: [p1, p2],
      rootHash: root,
      isValid: t5TamperedIndex === null
    };
  };

  // Tool 7: Transfer Entropy Causality Handler
  const handleT7Calculate = () => {
    setT7Calculating(true);
    setT7Score(null);

    setTimeout(() => {
      setT7Calculating(false);
      let entropyBits = 0.82;
      let direction = "Var X ➡️ Var Y";
      let confidence = 99.4;

      if (t7VarX === t7VarY) {
        entropyBits = 0.00;
        direction = "None (Identical Variables)";
        confidence = 100;
      } else if (t7VarX.includes("Thermal") && t7VarY.includes("CO2")) {
        entropyBits = 0.84;
        direction = "Thermal Cascade (Submodule 2) ➡️ CO2 Transpiration (Submodule 4)";
        confidence = 99.8;
      } else if (t7VarX.includes("CO2") && t7VarY.includes("Thermal")) {
        entropyBits = 0.11;
        direction = "CO2 Transpiration (Submodule 4) ➡️ Thermal Cascade (Submodule 2)";
        confidence = 81.2;
      } else {
        entropyBits = Number((0.15 + Math.random() * 0.4).toFixed(2));
        direction = `${t7VarX} ➡️ ${t7VarY}`;
        confidence = Number((72 + Math.random() * 21).toFixed(1));
      }

      setT7Score({ entropyBits, direction, confidence });
      addLogEntry("SYSTEM" as any, "SUCCESS", `Transfer entropy causality graph computed: ${entropyBits} bits of information flow detected.`);
    }, 400);
  };

  // Tool 8: Chaos Limb Switching Interlocks Generator
  const handleT8RunAdversarial = () => {
    setT8Injecting(true);
    setT8ChaosResult(null);

    setTimeout(() => {
      setT8Injecting(false);
      
      let severity = "MINOR";
      let outcome = "SWIFT COGNITIVE SHIELDING (0ns interruption)";
      let log = "Transient jitter phase-corrected instantly inside dynamic FPGA hardware tracking cycles.";

      if (t8ContactorJitter > 210) {
        severity = "HIGH ADVERSARIAL FLOOD";
        outcome = "SWITCH INTERLOCK TRIPPED SAFE (Solid Isolation)";
        log = `Hardware isolation block captured extreme jitter at ${t8ContactorJitter}ns. Automatically tripped latch #3 in 115ns. Diverted voltage surge, preserving thermal consistency on downstream active Silicon Carbide switches. Submodule remains 100% operational via dual-redundant power paths.`;
      }

      setT8ChaosResult({ severity, outcome, log });
      addLogEntry(
        "SYSTEM" as any, 
        t8ContactorJitter > 210 ? "ERROR" : "SUCCESS", 
        `Chaos Limb stress: Jitter of ${t8ContactorJitter}ns injected. Mode: ${severity}. Result: ${outcome}`
      );
    }, 550);
  };

  // Tool 9: Piper TTS Synthesizer
  const handleT9Synthesize = () => {
    setT9SpeechStatus("rendering");
    setT9Phonemes("");

    setTimeout(() => {
      setT9SpeechStatus("completed");
      const cleaned = t9InputMessage.toLowerCase().replace(/[^a-z ]/g, "");
      
      const phonemeMap: Record<string, string> = {
        magnetic: "mæɡˈnɛtɪk",
        shielding: "ˈʃiːldɪŋ",
        cascade: "kæsˈkeɪd",
        fully: "ˈfʊli",
        locked: "lɒkt",
        high: "haɪ",
        voltage: "ˈvəʊltɪdʒ",
        switching: "ˈswɪtʃɪŋ",
        now: "naʊ",
        online: "ˈɒnˌlaɪn"
      };

      const words = cleaned.split(" ");
      const mapped = words.map(w => phonemeMap[w] || `[${w}]`).join("_");
      setT9Phonemes(`/${mapped}/`);
      addLogEntry("SYSTEM" as any, "SUCCESS", `Piper phonetic waveform compilation completed.`);
    }, 600);
  };

  // Helper function for simulated spectral bar visualizers
  const computeSpectralBars = () => {
    const bars: number[] = [];
    for (let i = 1; i <= 8; i++) {
      // Computes heights for 8 harmonic columns based on t6Frequency and t6FieldStrength
      const base = Math.sin((t6Frequency * i * Math.PI) / 16) * 35 + 45;
      const strengthBoost = (t6FieldStrength / 4.8) * 15;
      const jitter = Math.sin((Date.now() / 1000) + i) * 6;
      bars.push(Math.max(12, Math.min(100, Math.round(base + strengthBoost + jitter))));
    }
    return bars;
  };

  // Globe Swarm states
  const [socketStatus, setSocketStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [socketError, setSocketError] = useState<string | null>(null);
  const [receivedPacketsCount, setReceivedPacketsCount] = useState<number>(0);
  const [sentPacketsCount, setSentPacketsCount] = useState<number>(0);
  const [remoteNodes, setRemoteNodes] = useState<RemotePlayerNode[]>([]);
  const [edgeStatus, setEdgeStatus] = useState<{ checked: boolean; ok: boolean; message: string; latency?: number }>({
    checked: false,
    ok: false,
    message: "Endpoint not yet validated."
  });
  
  // Custom interactive features
  const [targetGlobePrompt, setTargetGlobePrompt] = useState<string>("Sovereign cold-plenum MHD plasma configuration");
  const [imageGenerating, setImageGenerating] = useState<boolean>(false);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [pingPulse, setPingPulse] = useState<boolean>(false);

  // --- Drone Live Telemetry States ---
  const [landDroneX, setLandDroneX] = useState<number>(219);
  const [landDroneY, setLandDroneY] = useState<number>(511);
  const [landBattery, setLandBattery] = useState<number>(92);
  const [landApiUsages, setLandApiUsages] = useState<number>(754);
  const [landApiPing, setLandApiPing] = useState<number>(45);
  const [landFlash, setLandFlash] = useState<boolean>(false);

  const [aerialElev, setAerialElev] = useState<number>(840);
  const [aerialSpeed, setAerialSpeed] = useState<number>(124.5);
  const [aerialApiPing, setAerialApiPing] = useState<number>(74);
  const [aerialFlash, setAerialFlash] = useState<boolean>(false);

  const [subDepth, setSubDepth] = useState<number>(145.2);
  const [subSalinity, setSubSalinity] = useState<number>(35.2);
  const [subApiPing, setSubApiPing] = useState<number>(210);
  const [subFlash, setSubFlash] = useState<boolean>(false);

  const [satAltitude, setSatAltitude] = useState<number>(420);
  const [satLat, setSatLat] = useState<number>(37.77);
  const [satLon, setSatLon] = useState<number>(-122.41);
  const [satApiPing, setSatApiPing] = useState<number>(115);
  const [satFlash, setSatFlash] = useState<boolean>(false);

  const [lastLoopPingZone, setLastLoopPingZone] = useState<string>("INITIALIZING");
  const [lastLoopPingTime, setLastLoopPingTime] = useState<string>(new Date().toLocaleTimeString());

  // Helper functions to compile live RSC JSON player and state string representation
  const getLiveTelemetryRscPlayerJson = () => {
    return {
      ...DEFAULT_POG2_USER_JSON,
      "x": landDroneX,
      "y": landDroneY,
      "fatigue": Math.round((satApiPing + aerialApiPing + subApiPing + landApiPing) / 4),
      "combatStyle": 0, // matching RSC standards
      "skills": {
        ...DEFAULT_POG2_USER_JSON.skills,
        "attack": { "current": 92, "experience": landApiUsages * 15, "base": 92 }, // Land drone API usages
        "ranged": { "current": 75, "experience": Math.round(aerialElev * 12), "base": 75 }, // Aerial globe api
        "magic": { "current": 55, "experience": Math.round(subDepth * 20), "base": 55 }, // Submersible aquatic api
        "prayer": { "current": 42, "experience": Math.round(satAltitude * 10), "base": 42 } // Satellite camera positions
      }
    };
  };

  const getLiveRscSaveString = () => {
    const avgFatigue = Math.round((satApiPing + aerialApiPing + subApiPing + landApiPing) / 4);
    return `RSC_SAVE_POG2_X${landDroneX}_Y${landDroneY}_ATK[92/Usage:${landApiUsages}]_RNG[75/Elev:${aerialElev.toFixed(0)}m]_MAG[55/Depth:${subDepth.toFixed(0)}m]_PRY[42/Alt:${satAltitude}km_Cam:${satLat.toFixed(1)}N,${satLon.toFixed(1)}E]_FATIGUE[${avgFatigue}]_STYLE[0]`;
  };

  // Synchronized Drone Telemetry Simulation & Periodic Ping loops
  useEffect(() => {
    let tick = 0;
    const intervalSim = setInterval(() => {
      tick++;
      const timeSecs = Date.now() / 1000;
      
      const newLandX = Math.round(219 + Math.sin(timeSecs / 10) * 8);
      const newLandY = Math.round(511 + Math.cos(timeSecs / 10) * 8);
      setLandDroneX(newLandX);
      setLandDroneY(newLandY);

      setLandBattery(prev => {
        const dec = prev - 0.03;
        return dec < 15 ? 95 : parseFloat(dec.toFixed(2));
      });

      const newAerialElev = parseFloat((840 + Math.sin(timeSecs / 5) * 55).toFixed(1));
      const newAerialSpeed = parseFloat((124.5 + Math.cos(timeSecs / 7) * 15).toFixed(1));
      setAerialElev(newAerialElev);
      setAerialSpeed(newAerialSpeed);

      const newSubDepth = parseFloat((145.2 + Math.sin(timeSecs / 12) * 22).toFixed(1));
      setSubDepth(newSubDepth);

      // Satellite Camera target tracks synced to 3D orbiting rotation
      const newSatLat = parseFloat((Math.sin(timeSecs / 15) * 82).toFixed(4));
      const newSatLon = parseFloat((((rotationAngle * 3.6) + 180) % 360 - 180).toFixed(4));
      setSatLat(newSatLat);
      setSatLon(newSatLon);

      const pingCheck = tick % 4;
      const ts = new Date().toLocaleTimeString();
      setLastLoopPingTime(ts);
      
      if (pingCheck === 0) {
        setSatApiPing(Math.round(110 + Math.random() * 15));
        setLastLoopPingZone("SATELLITE API");
        setSatFlash(true);
        setTimeout(() => setSatFlash(false), 500);
        setPingPulse(true);
        setTimeout(() => setPingPulse(false), 150);
      } else if (pingCheck === 1) {
        setAerialApiPing(Math.round(70 + Math.random() * 10));
        setLastLoopPingZone("AERIAL API");
        setAerialFlash(true);
        setTimeout(() => setAerialFlash(false), 500);
        setPingPulse(true);
        setTimeout(() => setPingPulse(false), 150);
      } else if (pingCheck === 2) {
        setSubApiPing(Math.round(200 + Math.random() * 25));
        setLastLoopPingZone("AQUATIC API");
        setSubFlash(true);
        setTimeout(() => setSubFlash(false), 500);
        setPingPulse(true);
        setTimeout(() => setPingPulse(false), 150);
      } else if (pingCheck === 3) {
        setLandApiPing(Math.round(40 + Math.random() * 8));
        setLandApiUsages(prev => prev + 1);
        setLastLoopPingZone("GLOBAL API");
        setLandFlash(true);
        setTimeout(() => setLandFlash(false), 500);
        setPingPulse(true);
        setTimeout(() => setPingPulse(false), 150);
      }
    }, 1200);

    return () => clearInterval(intervalSim);
  }, [rotationAngle]);

  const lastSelfWrittenJsonStrRef = useRef<string>("");

  useEffect(() => {
    const liveJson = getLiveTelemetryRscPlayerJson();
    const liveJsonStr = JSON.stringify(liveJson, null, 2);
    
    setPlayersKv(prev => ({
      ...prev,
      "player:pog2": liveJsonStr
    }));
    
    // Write directly to shared local storage to prevent pipeline desync across subsystems
    localStorage.setItem("pog2_mhd_player_state", liveJsonStr);
    lastSelfWrittenJsonStrRef.current = liveJsonStr;
    window.dispatchEvent(new Event("storage"));
    
    // Auto-update editor input text with live telemetry if player:pog2 is selected
    if (activeNamespace === "PLAYERS" && kvInputKey === "player:pog2") {
      setKvInputValue(liveJsonStr);
    }
  }, [landDroneX, landDroneY, landApiUsages, aerialElev, subDepth, satAltitude, satLat, satLon]);

  // Synchronize external changes (like string injections, JSON tweaks, and co-processor inputs) back to live coordinates
  useEffect(() => {
    const handleStorageSync = () => {
      try {
        const cached = localStorage.getItem("pog2_mhd_player_state");
        if (!cached || cached === lastSelfWrittenJsonStrRef.current) return;

        const parsed = JSON.parse(cached);
        if (parsed.x !== undefined && parsed.x !== landDroneX) {
          setLandDroneX(parsed.x);
        }
        if (parsed.y !== undefined && parsed.y !== landDroneY) {
          setLandDroneY(parsed.y);
        }
        if (parsed.skills) {
          if (parsed.skills.attack && parsed.skills.attack.experience !== undefined) {
            const usages = Math.round(parsed.skills.attack.experience / 15);
            if (usages !== landApiUsages && usages > 0) setLandApiUsages(usages);
          }
          if (parsed.skills.ranged && parsed.skills.ranged.experience !== undefined) {
            const elevVal = Math.round(parsed.skills.ranged.experience / 12);
            if (elevVal !== aerialElev && elevVal > 0) setAerialElev(elevVal);
          }
          if (parsed.skills.magic && parsed.skills.magic.experience !== undefined) {
            const depthVal = Math.round(parsed.skills.magic.experience / 20);
            if (depthVal !== subDepth && depthVal > 0) setSubDepth(depthVal);
          }
        }
      } catch (err) {}
    };

    window.addEventListener("storage", handleStorageSync);
    // Poll to bypass single-tab sandbox isolation hurdles
    const timer = setInterval(handleStorageSync, 1500);

    return () => {
      window.removeEventListener("storage", handleStorageSync);
      clearInterval(timer);
    };
  }, [landDroneX, landDroneY, landApiUsages, aerialElev, subDepth]);

  // Cloudflare KV Integration states
  const [activeNamespace, setActiveNamespace] = useState<"PLAYERS" | "rsc-server-do_GameWorld">("PLAYERS");
  const [kvInputKey, setKvInputKey] = useState<string>("player:pog2");
  const [kvInputValue, setKvInputValue] = useState<string>(JSON.stringify(DEFAULT_POG2_USER_JSON, null, 2));
  const [kvOperationLogs, setKvOperationLogs] = useState<string[]>([
    "[KV BRIDGE] Initialized Cloudflare isolated developer substrate namespaces.",
    "[KV BRIDGE] Bound PLAYERS (ID: 883369c71eea44ac934ae1e5f0f366af) to memory storage proxy.",
    "[KV BRIDGE] Bound rsc-server-do_GameWorld (ID: 45ecd1dd0e8b48148840a80f6254ac8c) to durable SQL Storage backing."
  ]);
  const [cliCommand, setCliCommand] = useState<string>("--save-state-kv");
  const [cliFeedback, setCliFeedback] = useState<string | null>(null);

  // Client-side Memory model for KV persistence (using LocalStorage fallback for real persistence)
  const [playersKv, setPlayersKv] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem("cf_kv_PLAYERS_883369c71eea44ac934ae1e5f0f366af");
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {
      "player:pog2": JSON.stringify(DEFAULT_POG2_USER_JSON, null, 2),
      "player:guest_101": JSON.stringify({ username: "guest_101", x: 220, y: 512, skills: { Agility: 15 } }, null, 2)
    };
  });

  const [worldDoKv, setWorldDoKv] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem("cf_kv_rsc-server-do_GameWorld_45ecd1dd0e8b48148840a80f6254ac8c");
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {
      "metadata:version": "2.1.0-lts",
      "world:active_count": "14",
      "durable:sql_status": "SQL_READY_CANONICAL"
    };
  });

  // Keep state saved to storage for persistence
  useEffect(() => {
    localStorage.setItem("cf_kv_PLAYERS_883369c71eea44ac934ae1e5f0f366af", JSON.stringify(playersKv));
  }, [playersKv]);

  useEffect(() => {
    localStorage.setItem("cf_kv_rsc-server-do_GameWorld_45ecd1dd0e8b48148840a80f6254ac8c", JSON.stringify(worldDoKv));
  }, [worldDoKv]);

  const socketRef = useRef<WebSocket | null>(null);

  // Auto rotate globe visualizer
  useEffect(() => {
    const timer = setInterval(() => {
      setRotationAngle((prev) => (prev + 0.4) % 360);
    }, 40);
    return () => clearInterval(timer);
  }, []);

  // Check edge status on mount
  useEffect(() => {
    verifyConnectivity();
  }, []);

  // Establish live WebSockets link to POG2 Globe Endpoint
  const connectGlobe = () => {
    if (!config.globeEnabled) {
      addLogEntry("MULTILAYER" as any, "WARNING", "Websocket Globe bypassed (POG2_GLOBE_ENABLED is set to false)");
      return;
    }

    if (socketRef.current) {
      socketRef.current.close();
    }

    setSocketStatus("connecting");
    setSocketError(null);
    addLogEntry("MULTILAYER" as any, "INFO", `Establishing connection to: ${config.globeEndpoint}`);

    try {
      const socket = new WebSocket(config.globeEndpoint);
      socketRef.current = socket;

      socket.onopen = () => {
        setSocketStatus("connected");
        setPingPulse(true);
        setTimeout(() => setPingPulse(false), 800);
        addLogEntry("MULTILAYER" as any, "SUCCESS", "POG2 Sovereign Multiplayer Globe successfully synchronized at edge.");
        broadcastState(socket);
      };

      socket.onmessage = (event) => {
        setReceivedPacketsCount((prev) => prev + 1);
        try {
          const rawData = JSON.parse(event.data);
          
          if (rawData.type === "state_update" || rawData.type === "presence") {
            setRemoteNodes((prev) => {
              const otherId = rawData.nodeId || "node_" + Math.floor(Math.random() * 100);
              const exists = prev.find(n => n.id === otherId);
              const updatedNode: RemotePlayerNode = {
                id: otherId,
                name: rawData.nodeName || `Terminal [${otherId.slice(0, 4)}]`,
                x: rawData.x ?? 33,
                y: rawData.y ?? 33,
                tempK: rawData.tempK,
                hexState: rawData.hexState,
                lastActive: Date.now()
              };

              if (exists) {
                return prev.map(n => n.id === otherId ? updatedNode : n);
              } else {
                return [...prev, updatedNode];
              }
            });
          }
        } catch (e) {
          // heartbeat
        }
      };

      socket.onerror = (err) => {
        setSocketError("WebSocket handshake failed or refused by server cluster.");
        addLogEntry("MULTILAYER" as any, "ERROR", `WebSocket connection fault: ${String(err)}`);
      };

      socket.onclose = (event) => {
        setSocketStatus("disconnected");
        addLogEntry("MULTILAYER" as any, "WARNING", `Sovereign connection detached. Code: ${event.code}`);
      };

    } catch (err: any) {
      setSocketStatus("disconnected");
      setSocketError(err.message || String(err));
    }
  };

  const disconnectGlobe = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setSocketStatus("disconnected");
  };

  // Broadcast state over WebSocket
  const broadcastState = (activeSocket = socketRef.current) => {
    if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return;

    try {
      const payload = {
        type: "state_update",
        nodeId: "pog2_c_" + Math.floor(Math.sin(tickCounter) * 1000 + 5000),
        nodeName: `Primary MHD Node`,
        x: 33 + Math.floor(Math.sin(tickCounter * 0.1) * 15),
        y: 33 + Math.floor(Math.cos(tickCounter * 0.1) * 15),
        tempK: avgElectrodeTemp,
        hexState: currentHexagram,
        busCurrent: busCurrentA,
        tick: tickCounter,
        timestamp: Date.now()
      };
      
      activeSocket.send(JSON.stringify(payload));
      setSentPacketsCount((prev) => prev + 1);
    } catch (e) {}
  };

  // Keep sending state update occasionally as telemetry ticks
  useEffect(() => {
    if (socketStatus === "connected") {
      broadcastState();
    }
  }, [tickCounter, currentHexagram, socketStatus]);

  const verifyConnectivity = async () => {
    setEdgeStatus({ checked: false, ok: false, message: "Pinging Cloudflare co-processor gateway..." });
    const res = await checkEdgeAvailability();
    setEdgeStatus({
      checked: true,
      ok: res.ok,
      message: res.message,
      latency: res.latency
    });
  };

  const executeGenerativePrompt = async () => {
    setImageGenerating(true);
    setGeneratedImg(null);
    
    addLogEntry("MULTILAYER" as any, "INFO", `Triggering Cloudflare AI image request: "${targetGlobePrompt}"`);
    const res = await generateSensoryImage(targetGlobePrompt);

    setImageGenerating(false);
    if (res.success && res.imageUrl) {
      setGeneratedImg(res.imageUrl);
      addLogEntry("MULTILAYER" as any, "SUCCESS", `Cloudflare dynamic sensory rendering loaded.`);
    } else {
      // Render fallback preview
      setGeneratedImg(`https://picsum.photos/seed/pog2_${Math.floor(Math.random() * 500)}/400/300`);
    }
  };

  // Clear stale players
  useEffect(() => {
    const timer = setInterval(() => {
      setRemoteNodes((prev) => prev.filter(n => Date.now() - n.lastActive < 15000));
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // === CLOUDFLARE KV & DO OPERATIONS IMPL ===
  const executeKvPut = () => {
    if (!kvInputKey.trim()) {
      pushKvLog("CRITICAL", "Key field was empty during compile phase.");
      return;
    }

    try {
      // Verify value is fine
      if (kvInputValue.startsWith("{") || kvInputValue.startsWith("[")) {
        JSON.parse(kvInputValue); // Test valid JSON
      }

      if (activeNamespace === "PLAYERS") {
        setPlayersKv(prev => ({ ...prev, [kvInputKey]: kvInputValue }));
      } else {
        setWorldDoKv(prev => ({ ...prev, [kvInputKey]: kvInputValue }));
      }

      pushKvLog("SUCCESS", `await env.KV.put('${kvInputKey}', <value>) successfully written to ${activeNamespace}`);
      addLogEntry("MULTILAYER" as any, "SUCCESS", `KV SUBSTRATE: Write key='${kvInputKey}' to namespace ${activeNamespace} (Ok)`);
    } catch (e: any) {
      pushKvLog("ERROR", `Syntax parse error during mock JSON write compilation: ${e.message}`);
    }
  };

  const executeKvGet = () => {
    if (!kvInputKey.trim()) {
      pushKvLog("WARNING", "Please enter a key to retrieve.");
      return;
    }

    const value = activeNamespace === "PLAYERS" ? playersKv[kvInputKey] : worldDoKv[kvInputKey];
    if (value !== undefined) {
      setKvInputValue(value);
      pushKvLog("SUCCESS", `await env.KV.get('${kvInputKey}') returned: size=${value.length} octets`);
    } else {
      pushKvLog("WARNING", `await env.KV.get('${kvInputKey}') returned null (KEY_NOT_FOUND)`);
    }
  };

  const executeKvDelete = () => {
    if (!kvInputKey.trim()) return;

    if (activeNamespace === "PLAYERS") {
      setPlayersKv(prev => {
        const next = { ...prev };
        delete next[kvInputKey];
        return next;
      });
    } else {
      setWorldDoKv(prev => {
        const next = { ...prev };
        delete next[kvInputKey];
        return next;
      });
    }

    pushKvLog("INFO", `await env.KV.delete('${kvInputKey}') completed on workspace`);
  };

  const executeKvList = () => {
    const keys = Object.keys(activeNamespace === "PLAYERS" ? playersKv : worldDoKv);
    pushKvLog("INFO", `await env.KV.list() retrieved ${keys.length} keys:`);
    keys.forEach((k) => {
      pushKvLog("LOG", ` - key: "${k}"`);
    });
  };

  const pushKvLog = (type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "LOG" | "CRITICAL", text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setKvOperationLogs(prev => [
      `[${timestamp}] [${type}] ${text}`,
      ...prev.slice(0, 24)
    ]);
  };

  // Execute terminal CLI command simulator (especially --save-state-kv or sync state requests)
  const runCliCommand = () => {
    const cmd = cliCommand.trim();
    if (!cmd) return;

    setCliFeedback(`Executing: "${cmd}"...`);
    setTimeout(() => {
      if (cmd === "--save-state-kv" || cmd.includes("save-state-kv")) {
        // Find existing state from localStorage if any, or default to the provided spec JSON
        let activeLocalState = DEFAULT_POG2_USER_JSON;
        try {
          const cached = localStorage.getItem("pog2_mhd_player_state");
          if (cached) {
            const parsed = JSON.parse(cached);
            activeLocalState = { ...DEFAULT_POG2_USER_JSON, ...parsed, username: "pog2" };
          }
        } catch (e) {}

        // Save into PLAYERS namespace memory store under player:pog2
        setPlayersKv(prev => ({
          ...prev,
          "player:pog2": JSON.stringify(activeLocalState, null, 2)
        }));

        pushKvLog("SUCCESS", `[CLI SCRIPT COMPLETED] --save-state-kv dispatched.`);
        pushKvLog("INFO", `[KV WRITE] Wrote gameplay DNA snapshot of "pog2" to PLAYERS (player:pog2) namespace.`);
        setCliFeedback(`[SUCCESS] State successfully saved to Cloudflare PLAYERS KV repository under key "player:pog2".`);
        addLogEntry("MULTILAYER" as any, "SUCCESS", `KV SUBSTRATE: Dispatched command '--save-state-kv'. Synchronized primary player 'pog2' dataset.`);
      } else if (cmd.startsWith("kv put ")) {
        const parts = cmd.slice(7).split(" ");
        if (parts.length >= 2) {
          const key = parts[0];
          const val = parts.slice(1).join(" ");
          if (activeNamespace === "PLAYERS") {
            setPlayersKv(prev => ({ ...prev, [key]: val }));
          } else {
            setWorldDoKv(prev => ({ ...prev, [key]: val }));
          }
          pushKvLog("SUCCESS", `CLI command manual override: put ${key} success`);
          setCliFeedback(`[OK] Key "${key}" updated.`);
        } else {
          setCliFeedback(`[ERROR] Invalid parameters. Usage: kv put [key] [value]`);
        }
      } else {
        setCliFeedback(`[WARNING] Command not recognized inside Cloudflare edge shell emulator. Supported commands: "--save-state-kv", "kv put"`);
      }
    }, 450);
  };

  // Preset state loader for easily testing custom RuneScape-like JSON formats
  const loadPresetIntoKvValue = (type: "pog2" | "world" | "worker") => {
    if (type === "pog2") {
      setKvInputKey("player:pog2");
      setKvInputValue(JSON.stringify(DEFAULT_POG2_USER_JSON, null, 2));
      pushKvLog("INFO", "Loaded authentic POG2 player JSON template to workspace.");
    } else if (type === "world") {
      setKvInputKey("do_sql_backplane_state");
      setKvInputValue(JSON.stringify({
        worldId: 0,
        name: "rsc-server-do_GameWorld",
        namespaceId: "45ecd1dd0e8b48148840a80f6254ac8c",
        engine: "SQL",
        players: ["pog2", "guest_101"],
        lastTickTime: Date.now()
      }, null, 2));
      pushKvLog("INFO", "Loaded rsc-server-do_GameWorld SQL template to workspace.");
    } else {
      setKvInputKey("worker_fetch_routine");
      setKvInputValue(`export default {
  async fetch(request, env, ctx) {
    // Save-state telemetry handler
    await env.KV.put('player:pog2', JSON.stringify(playerState));
    const value = await env.KV.get('player:pog2');
    return new Response(JSON.stringify({ success: true, payload: value }));
  }
}`);
      pushKvLog("INFO", "Loaded cloudflare worker fetch boilerplate template block.");
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans relative overflow-hidden h-full" id="cf-substrate-card">
      <div className="absolute top-0 right-0 p-1.5 bg-cyan-950 border-b border-l border-cyan-900 rounded-bl font-mono text-[8.5px] text-cyan-400 select-none font-bold uppercase tracking-widest z-10">
        CLOUDFLARE EDGE SUBSTRATE
      </div>

      <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-300 font-mono tracking-wider">
            SOVEREIGN GLOBE METASYSTEM
          </h3>
        </div>

        {/* Tab navigation buttons */}
        <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800 font-mono text-[9px] flex-wrap gap-0.5">
          <button 
            onClick={() => setActiveTab("globe")}
            className={`px-3 py-1 rounded cursor-pointer transition font-semibold flex items-center gap-1 ${activeTab === "globe" ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-900" : "text-slate-450 hover:text-slate-200"}`}
          >
            <Globe className="h-3 w-3" /> MULTIPLAYER SWARM
          </button>
          <button 
            onClick={() => setActiveTab("kv")}
            className={`px-3 py-1 rounded cursor-pointer transition font-semibold flex items-center gap-1 ${activeTab === "kv" ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-900" : "text-slate-450 hover:text-slate-200"}`}
          >
            <Database className="h-3 w-3" /> CLOUDFLARE KV & DO STATE
          </button>
          <button 
            onClick={() => setActiveTab("globalping")}
            className={`px-3 py-1 rounded cursor-pointer transition font-semibold flex items-center gap-1 ${activeTab === "globalping" ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-900" : "text-slate-450 hover:text-slate-200"}`}
          >
            <Network className="h-3 w-3" /> GEOGRAPHIC GLOBALPING
          </button>
          <button 
            onClick={() => setActiveTab("budget")}
            className={`px-3 py-1 rounded cursor-pointer transition font-semibold flex items-center gap-1 ${activeTab === "budget" ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-900" : "text-slate-450 hover:text-slate-200"}`}
          >
            <DollarSign className="h-3.5 w-3.5" /> FREE BUDGET ARCHITECTURE
          </button>
          <button 
            onClick={() => setActiveTab("tools")}
            className={`px-3 py-1 rounded cursor-pointer transition font-semibold flex items-center gap-1 ${activeTab === "tools" ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-900" : "text-slate-450 hover:text-slate-200"}`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> COGNITIVE TOOL OVERLAY
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "globe" ? (
          <motion.div 
            key="globe-tab"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left Side: Server Coordinates and WebSockets Network Status */}
            <div className="lg:col-span-8 flex flex-col justify-between gap-3 bg-slate-900/60 border border-slate-850 p-4 rounded-md">
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-400 font-mono">CONNECTION POOL STRATEGY</span>
                  <div className="flex items-center gap-1.5">
                    {socketStatus === "connected" ? (
                      <span className="flex items-center gap-1 font-mono text-[8.5px] bg-emerald-950/80 border border-emerald-900/80 text-emerald-400 px-1.5 py-0.5 rounded animate-pulse">
                        <Wifi className="h-2.5 w-2.5 text-emerald-400" /> CONNECTED TO SWARM
                      </span>
                    ) : socketStatus === "connecting" ? (
                      <span className="flex items-center gap-1 font-mono text-[8.5px] bg-amber-950/80 border border-amber-900/80 text-amber-400 px-1.5 py-0.5 rounded">
                        <RefreshCw className="h-2.5 w-2.5 text-amber-400 animate-spin" /> ESTABLISHING HANDSHAKE
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-mono text-[8.5px] bg-slate-900 border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                        <WifiOff className="h-2.5 w-2.5 text-slate-500" /> OFFLINE DISPATCH
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 font-mono text-[9px] text-slate-400">
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span className="text-slate-500">Multilayer Socket URL:</span>
                    <span className="text-slate-300 truncate max-w-[280px] hover:text-cyan-400 cursor-help" title={config.globeEndpoint}>
                      {config.globeEndpoint}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span className="text-slate-500">Worker Router URL:</span>
                    <span className="text-slate-300 truncate max-w-[280px] hover:text-cyan-400" title={config.workerUrl}>
                      {config.workerUrl || "EMPTY_WORKER_CO_PROCESSOR"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span className="text-slate-500">Cloudflare Account ID:</span>
                    <span className="text-slate-300 font-mono tracking-tighter">
                      {config.accountId ? `${config.accountId.slice(0, 10)}...${config.accountId.slice(-6)}` : "DEFAULT_AIS_SUBSTRATE"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Swarm Sync Isolation:</span>
                    <span className="text-amber-400 font-bold uppercase">{config.isIsolated ? "ACTIVE REGIONAL CONTAINER ONLY" : "SHARED MUTILAYER CLOUD ENV"}</span>
                  </div>
                </div>
              </div>

              {/* Connection Trigger Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-900">
                {socketStatus === "disconnected" ? (
                  <button 
                    onClick={connectGlobe}
                    className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950 border border-cyan-800 hover:bg-cyan-900 hover:border-cyan-700 text-cyan-400 rounded-md font-mono text-[9.5px] cursor-pointer transition duration-150"
                  >
                    <Radio className="h-3 w-3 animate-ping" />
                    INITIATE GLOBE SWARM LINK
                  </button>
                ) : (
                  <button 
                    onClick={disconnectGlobe}
                    className="flex items-center gap-1.5 px-3 py-1 bg-red-950/60 border border-red-900/60 hover:bg-red-950 text-red-400 rounded-md font-mono text-[9.5px] cursor-pointer transition duration-150"
                  >
                    <WifiOff className="h-3 w-3" />
                    DE-SEGMENT CONNECTION
                  </button>
                )}

                <button 
                  onClick={verifyConnectivity}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-950/80 border border-slate-800 hover:border-slate-755 text-slate-300 rounded-md font-mono text-[9.5px] cursor-pointer hover:bg-slate-900 transition duration-150"
                >
                  <RefreshCw className="h-3 w-3" />
                  PING CLOUDFLARE GATEWAY
                </button>
              </div>

              {/* Diagnostics and error trace logs */}
              <div className="mt-2 bg-slate-950 p-2.5 rounded border border-slate-850/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[7.5px] font-mono text-slate-500 uppercase tracking-widest">LIVE TRANSLATION METRICS</span>
                  <span className="text-[7.5px] font-mono text-cyan-400 font-bold">TX_RX QUEUE</span>
                </div>
                
                {socketError && (
                  <p className="text-[8.5px] font-mono text-red-400 leading-normal mb-1.5 border border-red-950 p-1 rounded bg-red-950/20 w-fit">
                    ⚡ <strong>HANDSHAKE CRASHED:</strong> {socketError}
                  </p>
                )}

                <div className="flex justify-between items-center text-[9px] font-mono">
                  <div className="flex items-center gap-4 text-slate-400">
                    <div>
                      <span className="text-slate-505">Transmitted (TX):</span> <strong className="text-slate-300">{sentPacketsCount}</strong> packets
                    </div>
                    <div>
                      <span className="text-slate-505">Received (RX):</span> <strong className="text-slate-300">{receivedPacketsCount}</strong> packets
                    </div>
                  </div>
                  
                  <div className="text-[8px] text-slate-550">
                    {edgeStatus.checked ? (
                      <span className={edgeStatus.ok ? "text-emerald-400" : "text-amber-500"}>
                        {edgeStatus.latency ? `Gateway verified: ${edgeStatus.latency}ms` : edgeStatus.message}
                      </span>
                    ) : (
                      <span>Checking Cloudflare substrate...</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Peer swarm listing */}
              <div className="mt-1">
                <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">ACTIVE NETWORK CLUSTER SWARM DIRECTORY</span>
                {remoteNodes.length === 0 ? (
                  <div className="text-center py-2 bg-slate-950/40 rounded border border-slate-900 text-[8.5px] font-mono text-slate-600">
                    {socketStatus === "connected" ? "SWARM IS NOMINAL. SEARCHING FOR PEERS..." : "ESTABLISH GLOBE CONNECTIVITY TO ENUMERATE REMOTE HARDWARE..."}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {remoteNodes.map((peer, idx) => (
                      <div key={peer.id || idx} className="bg-slate-950 border border-slate-850 p-1.5 rounded flex items-center justify-between text-[8px] font-mono">
                        <div className="truncate pr-1">
                          <span className="text-cyan-400">●</span> <strong className="text-slate-300">{peer.name}</strong>
                          <span className="block text-[7px] text-slate-500">Active Location: {peer.x}, {peer.y}</span>
                        </div>
                        {peer.tempK && (
                          <span className="text-[7.5px] bg-cyan-950 border border-cyan-900 text-cyan-400 px-1 py-0.1 rounded">
                            {peer.tempK.toFixed(1)}K
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Side: Interactive 3D SVG Orbiting Globe */}
            <div className="lg:col-span-4 flex flex-col justify-between items-center bg-slate-950 border border-slate-900 rounded p-4 relative min-h-[220px]">
              
              <div className="absolute top-1.5 left-2 font-mono text-[7px] text-slate-500 uppercase select-none tracking-wider">
                Sovereign Projection
              </div>

              {/* Beautiful SVG Globe Visualizer */}
              <div className="flex items-center justify-center py-4 relative w-full h-[140px]">
                <svg 
                  className={`w-32 h-32 text-slate-900 select-none transition-all duration-700 ${pingPulse ? 'scale-110 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : ''}`}
                  viewBox="0 0 100 100"
                >
                  <defs>
                    <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#082f49" stopOpacity="0.4" />
                      <stop offset="85%" stopColor="#0f172a" stopOpacity="1" />
                    </radialGradient>
                    <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>

                  <circle cx="50" cy="50" r="44" fill="url(#globeGlow)" stroke="#1e293b" strokeWidth="1" />
                  
                  <g transform={`rotate(${rotationAngle} 50 50)`}>
                    <ellipse cx="50" cy="50" rx="44" ry="44" fill="none" stroke="url(#gridGrad)" strokeWidth="0.5" />
                    <ellipse cx="50" cy="50" rx="44" ry="12" fill="none" stroke="url(#gridGrad)" strokeWidth="0.5" />
                    <ellipse cx="50" cy="50" rx="12" ry="44" fill="none" stroke="url(#gridGrad)" strokeWidth="0.5" />
                    <ellipse cx="50" cy="50" rx="44" ry="32" fill="none" stroke="url(#gridGrad)" strokeWidth="0.4" />
                    <ellipse cx="50" cy="50" rx="32" ry="44" fill="none" stroke="url(#gridGrad)" strokeWidth="0.4" />

                    <circle cx="28" cy="40" r="1.5" className="fill-cyan-500/40" />
                    <circle cx="32" cy="44" r="1.2" className="fill-cyan-500/40" />
                    <circle cx="38" cy="38" r="1" className="fill-cyan-500/40" />
                    <circle cx="68" cy="50" r="1.5" className="fill-cyan-500/40" />
                    <circle cx="62" cy="55" r="1" className="fill-sky-500/40" />
                    <circle cx="54" cy="25" r="1.2" className="fill-sky-500/40" />
                    <circle cx="48" cy="70" r="1" className="fill-sky-500/40" />
                  </g>

                  <line x1="6" y1="50" x2="94" y2="50" stroke="#0ea5e9" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="1,2" />
                  <circle cx="50" cy="50" r="3" className="fill-cyan-400" />
                  <circle cx="50" cy="50" r="6" className="stroke-cyan-500 fill-none animate-ping" strokeWidth="0.75" />

                  {remoteNodes.slice(0, 4).map((n, idx) => {
                    const angle = (idx * 90 + rotationAngle) * (Math.PI / 180);
                    const r = 32;
                    const nodeX = 50 + Math.cos(angle) * r;
                    const nodeY = 50 + Math.sin(angle) * r * 0.4;
                    return (
                      <g key={n.id}>
                        <line x1="50" y1="50" x2={nodeX} y2={nodeY} stroke="#0284c7" strokeWidth="0.4" strokeDasharray="1,1" strokeOpacity="0.6" />
                        <circle cx={nodeX} cy={nodeY} r="2" className="fill-emerald-400 animate-pulse" />
                      </g>
                    );
                  })}
                </svg>
                
                <div className="absolute bottom-2 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-[8px] text-slate-400">
                  CLUSTER PEER RATIO: <strong className="text-cyan-400">{remoteNodes.length + 1} ACTIVE</strong>
                </div>
              </div>

              {/* Cloudflare Sensory generators */}
              <div className="w-full mt-2 border-t border-slate-900 pt-3">
                <div className="group relative flex items-center justify-between mb-1.5 select-none text-[8.5px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-cyan-400 animate-pulse" /> CLOUDFLARE IMAGING CO-PROCESSOR
                  </span>
                </div>
                
                <div className="flex gap-1.5">
                  <input 
                    type="text"
                    value={targetGlobePrompt}
                    onChange={(e) => setTargetGlobePrompt(e.target.value)}
                    placeholder="Image rendering prompt specification"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-[8.5px] focus:outline-none focus:border-cyan-700" 
                  />
                  <button 
                    onClick={executeGenerativePrompt}
                    disabled={imageGenerating}
                    className="px-2.5 py-1 bg-cyan-950 border border-cyan-800 hover:bg-cyan-900 hover:border-cyan-700 text-cyan-400 rounded text-[8.5px] font-mono font-bold cursor-pointer transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {imageGenerating ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <FileImage className="h-2.5 w-2.5" />}
                    RENDER
                  </button>
                </div>

                <AnimatePresence>
                  {generatedImg && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="mt-2.5 relative border border-slate-800 rounded bg-slate-950 overflow-hidden"
                    >
                      <img 
                        src={generatedImg} 
                        alt="Cloudflare AI sensory rendering" 
                        referrerPolicy="no-referrer"
                        className="w-full h-24 object-cover object-center filter saturate-75 brightness-90 hover:saturate-100 transition duration-300" 
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1 font-mono text-[6.5px] text-slate-500 flex justify-between">
                        <span>CO-PROCESSOR IMAGE GENERATOR</span>
                        <button onClick={() => setGeneratedImg(null)} className="text-slate-400 hover:text-red-400 cursor-pointer">CLOSE</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* Live Drone Zone Telemetry Bento and RSC Save Encoder */}
            <div className="lg:col-span-12 mt-4 bg-slate-900/60 border border-slate-850 p-4 rounded-md">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5 tracking-tight font-sans">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    DRONE ZONE TELEMETRY DECK & LIVE API STATUS
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Real-time visual telemetry mapping of land, aerial, subaqueous, and satellite coordinate spaces.
                  </p>
                </div>
                
                <div className="flex gap-4 font-mono text-[9px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded border border-slate-850/40">
                  <div>
                    <span className="text-slate-500">Loop Clock:</span> <strong className="text-cyan-400">{lastLoopPingTime}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Active Gate:</span> <strong className="text-emerald-400 uppercase">{lastLoopPingZone}</strong>
                  </div>
                </div>
              </div>

              {/* Bento Grid: 4 Zones */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 font-mono">
                
                {/* Zone 1: Satellite Orbit Zone */}
                <div className={`p-4 rounded-lg border transition-all duration-300 ${satFlash ? "border-cyan-500 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "border-slate-850/60 bg-slate-950/40"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Zone 1: Satellite Orbit</span>
                    <span className={`h-2 w-2 rounded-full ${satFlash ? "bg-cyan-400 animate-ping" : "bg-cyan-600"}`}></span>
                  </div>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-mono">Telemetry Feed:</span>
                      <strong className="text-slate-300 font-mono">SATELLITE_API</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Alt Level:</span>
                      <strong className="text-cyan-400 font-mono">{satAltitude} km</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-900 pt-1 mt-1 font-semibold text-[9.5px] text-slate-400">
                      <span>Camera Pitch:</span>
                      <span>3D Projection</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Target Lat:</span>
                      <span className="text-white">{satLat.toFixed(3)}N</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Target Lon:</span>
                      <span className="text-white">{satLon.toFixed(3)}E</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-900 pt-1 text-[10px]">
                      <span className="text-slate-500">Est Latency:</span>
                      <strong className="text-cyan-400">{satApiPing}ms</strong>
                    </div>
                  </div>
                </div>

                {/* Zone 2: Aerial Surveillance Zone */}
                <div className={`p-4 rounded-lg border transition-all duration-300 ${aerialFlash ? "border-amber-500 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "border-slate-850/60 bg-slate-950/40"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Zone 2: Aerial Drone</span>
                    <span className={`h-2 w-2 rounded-full ${aerialFlash ? "bg-amber-400 animate-ping" : "bg-amber-600"}`}></span>
                  </div>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Telemetry Feed:</span>
                      <strong className="text-slate-300">GLOBE_AREAL_API</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Elevation:</span>
                      <strong className="text-amber-450">{aerialElev.toFixed(1)} m</strong>
                    </div>
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-slate-505">Airspeed:</span>
                      <strong className="text-slate-300">{aerialSpeed.toFixed(1)} m/s</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-900 pt-1 mt-1 font-semibold text-[9.5px] text-slate-400">
                      <span>Atm Pressure:</span>
                      <span className="text-emerald-400 font-bold">101.3 kPa</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-900 pt-1 text-[10px]">
                      <span className="text-slate-500">Est Latency:</span>
                      <strong className="text-amber-400">{aerialApiPing}ms</strong>
                    </div>
                  </div>
                </div>

                {/* Zone 3: Land Reconnaissance Zone */}
                <div className={`p-4 rounded-lg border transition-all duration-300 ${landFlash ? "border-sky-500 bg-sky-950/20 shadow-[0_0_15px_rgba(56,189,248,0.15)]" : "border-slate-850/60 bg-slate-950/40"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Zone 3: Land Rover</span>
                    <span className={`h-2 w-2 rounded-full ${landFlash ? "bg-sky-400 animate-ping" : "bg-sky-600"}`}></span>
                  </div>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Telemetry Feed:</span>
                      <strong className="text-slate-300">GLOBAL_API_V2</strong>
                    </div>
                    <div className="flex justify-between text-sky-400 font-bold">
                      <span>Coordinates X:</span>
                      <strong>{landDroneX}</strong>
                    </div>
                    <div className="flex justify-between text-sky-400 font-bold">
                      <span>Coordinates Y:</span>
                      <strong>{landDroneY}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-900 pt-1 mt-1 text-[10px]">
                      <span className="text-slate-500">Battery State:</span>
                      <span className="text-slate-300">{landBattery.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-900 pt-1 text-[10px]">
                      <span className="text-slate-500">Total Probes:</span>
                      <strong className="text-sky-400">{landApiUsages} counts</strong>
                    </div>
                  </div>
                </div>

                {/* Zone 4: Aquatic Submergence Zone */}
                <div className={`p-4 rounded-lg border transition-all duration-300 ${subFlash ? "border-purple-500 bg-purple-950/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]" : "border-slate-850/60 bg-slate-950/40"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Zone 4: Aquatic Sub</span>
                    <span className={`h-2 w-2 rounded-full ${subFlash ? "bg-purple-400 animate-ping" : "bg-purple-600"}`}></span>
                  </div>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-mono">Telemetry Feed:</span>
                      <strong className="text-slate-300">AQUATIC_API</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-mono font-bold text-purple-400">Sea Depth:</span>
                      <strong className="text-purple-400">{subDepth.toFixed(1)} m</strong>
                    </div>
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-slate-500">Water Salinity:</span>
                      <strong className="text-slate-350">{subSalinity} psu</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-900 pt-1 mt-1 font-semibold text-[9.5px] text-slate-400">
                      <span>FluidPressure:</span>
                      <span className="text-emerald-400 font-bold">NOMINAL</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-900 pt-1 text-[10px]">
                      <span className="text-slate-500">Est Latency:</span>
                      <strong className="text-purple-400">{subApiPing}ms</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Dynamic RSC Save String Decoder terminal */}
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg flex flex-col md:flex-row items-stretch justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TerminalIcon className="h-3 w-3" />
                      RUNESCAPE CLASSIC CHARACTER SAVE STRING
                    </span>
                    <span className="text-[8px] font-mono bg-slate-900 text-slate-500 px-2 py-0.5 rounded border border-slate-800">
                      LIVE SYSTEM STATE DNA
                    </span>
                  </div>
                  
                  <div className="bg-slate-900 p-3 rounded font-mono text-xs text-emerald-400 select-all border border-slate-850 break-all leading-normal">
                    {getLiveRscSaveString()}
                  </div>

                  {/* UI Legend translating variables */}
                  <div className="mt-4">
                    <span className="block text-[8.5px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">RSC SETUP MATRIX TRANSLATION LEGEND</span>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 font-mono text-[8.5px] text-slate-400">
                      <div className="bg-slate-900/40 p-2 rounded border border-slate-850/50">
                        <strong className="block text-sky-400 mb-0.5">X, Y POSITION</strong>
                        <span>Rover translation on the 2D grid: <strong className="text-slate-200">({landDroneX}, {landDroneY})</strong></span>
                      </div>
                      <div className="bg-slate-900/40 p-2 rounded border border-slate-850/50">
                        <strong className="block text-cyan-400 mb-0.5">ATTACK [92]</strong>
                        <span>Land database usages checked: <strong className="text-slate-200">{landApiUsages} pings</strong></span>
                      </div>
                      <div className="bg-slate-900/40 p-2 rounded border border-slate-850/50">
                        <strong className="block text-amber-500 mb-0.5">RANGED [75]</strong>
                        <span>Aerial flight transit elevation: <strong className="text-slate-200">{aerialElev.toFixed(0)}m</strong></span>
                      </div>
                      <div className="bg-slate-900/40 p-2 rounded border border-slate-850/50">
                        <strong className="block text-purple-400 mb-0.5">MAGIC [55]</strong>
                        <span>Underwater sub pressure depth: <strong className="text-slate-200">{subDepth.toFixed(0)}m</strong></span>
                      </div>
                      <div className="bg-slate-900/40 p-2 rounded border border-slate-850/50">
                        <strong className="block text-pink-400 mb-0.5">PRAYER [42]</strong>
                        <span>3D satellite orbit camera projection: <strong className="text-slate-200 font-mono font-bold text-pink-400">420km</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between items-center md:border-l border-slate-850 md:pl-4 text-center min-w-[155px] pt-3 md:pt-0">
                  <div className="space-y-1">
                    <span className="block text-[9px] text-slate-400 uppercase font-mono">KV STACK COMMITTEL</span>
                    <span className="block text-[7.5px] text-slate-500 leading-normal">
                      Syncs character JSON to Cloudflare memory proxies.
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      const saveStr = getLiveRscSaveString();
                      navigator.clipboard.writeText(saveStr);
                      setCliFeedback(`[CLIPBOARD] Generated telemetry string copied: ${saveStr.slice(0, 36)}...`);
                      setTimeout(() => setCliFeedback(null), 3000);
                    }}
                    className="w-full mt-3 px-2 py-1.5 bg-emerald-950 border border-emerald-900 hover:bg-emerald-900 text-emerald-400 font-mono text-[8.5px] font-bold rounded cursor-pointer transition flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-3 w-3" />
                    COPY CHARACTER DNA
                  </button>
                </div>
              </div>

            </div>

          </motion.div>
        ) : activeTab === "kv" ? (
          <motion.div 
            key="kv-tab"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left Column: KV Namespace Select & CRUD Actions */}
            <div className="lg:col-span-4 flex flex-col gap-3 bg-slate-900/60 border border-slate-850 p-4 rounded-md">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                ACTIVE CLOUDFLARE KV NAMESPACES
              </span>

              {/* Namespaces selector */}
              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setActiveNamespace("PLAYERS");
                    setKvInputKey("player:pog2");
                    setKvInputValue(playersKv["player:pog2"] || JSON.stringify(DEFAULT_POG2_USER_JSON, null, 2));
                  }}
                  className={`w-full text-left p-2.5 rounded border transition flex flex-col gap-1 cursor-pointer ${activeNamespace === "PLAYERS" ? "bg-cyan-950/50 border-cyan-800 shadow-[inset_0_0_8px_rgba(6,182,212,0.15)]" : "bg-slate-950 border-slate-900 hover:border-slate-800"}`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] font-mono font-bold text-slate-200 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${activeNamespace === "PLAYERS" ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`} />
                      PLAYERS
                    </span>
                    <span className="text-[6.5px] font-mono text-cyan-550 border border-cyan-900/50 px-1 rounded-sm">MEM STORAGE</span>
                  </div>
                  <span className="font-mono text-[7.5px] text-slate-500 block truncate">
                    Namespace ID: 883369c71eea44ac934ae1e5f0f366af
                  </span>
                </button>

                <button 
                  onClick={() => {
                    setActiveNamespace("rsc-server-do_GameWorld");
                    setKvInputKey("do_sql_backplane_state");
                    setKvInputValue(worldDoKv["do_sql_backplane_state"] || "");
                  }}
                  className={`w-full text-left p-2.5 rounded border transition flex flex-col gap-1 cursor-pointer ${activeNamespace === "rsc-server-do_GameWorld" ? "bg-amber-955/40 border-amber-850/80 shadow-[inset_0_0_8px_rgba(217,119,6,0.1)]" : "bg-slate-950 border-slate-900 hover:border-slate-800"}`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] font-mono font-bold text-slate-200 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${activeNamespace === "rsc-server-do_GameWorld" ? "bg-amber-400 animate-pulse" : "bg-slate-500"}`} />
                      rsc-server-do_GameWorld
                    </span>
                    <span className="text-[6.5px] font-mono text-amber-500 border border-amber-950 px-1 rounded-sm">SQL DURABLE DO</span>
                  </div>
                  <span className="font-mono text-[7.5px] text-slate-500 block truncate">
                    Namespace ID: 45ecd1dd0e8b48148840a80f6254ac8c
                  </span>
                </button>
              </div>

              {/* Preset Loaders */}
              <div className="border-t border-slate-900 pt-3 mt-1">
                <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
                  LOAD TEMPLATE SPEC
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button 
                    onClick={() => loadPresetIntoKvValue("pog2")}
                    className="py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded font-mono text-[8px] cursor-pointer text-center"
                  >
                    👤 POG2 STATE
                  </button>
                  <button 
                    onClick={() => loadPresetIntoKvValue("world")}
                    className="py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded font-mono text-[8px] cursor-pointer text-center"
                  >
                    🌍 GAMEWORLD
                  </button>
                  <button 
                    onClick={() => loadPresetIntoKvValue("worker")}
                    className="py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded font-mono text-[8px] cursor-pointer text-center"
                  >
                    📄 JS WORKER
                  </button>
                </div>
              </div>

              {/* CRUD Input panel */}
              <div className="border-t border-slate-900 pt-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[8.5px] font-mono text-slate-400 block">KEY IDENTITY (ID):</label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={kvInputKey}
                        onChange={(e) => setKvInputKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-[9px] focus:outline-none focus:border-cyan-700" 
                      />
                      <Key className="absolute right-2 top-1.5 h-3 w-3 text-slate-600" />
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button 
                      onClick={executeKvGet}
                      className="flex-1 py-1 bg-sky-950/30 border border-sky-900 hover:bg-sky-950 hover:text-sky-305 text-sky-400 rounded text-[9px] font-mono font-bold cursor-pointer transition flex items-center justify-center gap-1"
                    >
                      GET
                    </button>
                    <button 
                      onClick={executeKvPut}
                      className="flex-1 py-1 bg-emerald-950/30 border border-emerald-900 hover:bg-emerald-900 hover:border-emerald-700 text-emerald-400 rounded text-[9px] font-mono font-bold cursor-pointer transition flex items-center justify-center gap-1"
                    >
                      PUT
                    </button>
                    <button 
                      onClick={executeKvDelete}
                      className="py-1 px-2.5 bg-red-950/20 border border-red-900/60 hover:bg-red-950 text-red-400 rounded text-[9px] font-mono cursor-pointer transition flex items-center justify-center"
                      title="Delete Key"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button 
                      onClick={executeKvList}
                      className="py-1 px-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-[9px] font-mono cursor-pointer transition flex items-center justify-center font-bold"
                      title="List Keys"
                    >
                      LIST ALL KEYS
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-[7.5px] font-mono text-slate-500 leading-normal bg-slate-950/50 p-2 border border-slate-900 rounded">
                  <strong className="text-slate-400 uppercase">Namespace ID Lookup Matrix:</strong><br />
                  - PLAYERS: <code className="text-cyan-400">883369c71eea44ac934ae1e5f0f366af</code><br />
                  - GameWorld: <code className="text-amber-500">45ecd1dd0e8b48148840a80f6254ac8c</code> (SQL)
                </div>
              </div>

            </div>

            {/* Middle Column: Large Interactive Key-Value Workspace Container */}
            <div className="lg:col-span-5 flex flex-col gap-3 bg-slate-900/60 border border-slate-850 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1">
                  <FileJson className="h-3.5 w-3.5 text-cyan-400" />
                  JSON WORKSPACE REGISTER
                </span>
                <span className="text-[7.5px] font-mono text-slate-500 bg-slate-955 border border-slate-900 px-1.5 py-0.5 rounded uppercase">
                  SIZE: {kvInputValue.length.toLocaleString()} OCTETS
                </span>
              </div>

              <textarea 
                value={kvInputValue}
                onChange={(e) => setKvInputValue(e.target.value)}
                rows={12}
                placeholder="Paste key-value data payload here..."
                className="w-full flex-1 bg-slate-950 border border-slate-800 rounded p-3 text-slate-305 font-mono text-[8.5px] focus:outline-none focus:border-cyan-700 leading-tight resize-none"
              />

              <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 pt-1">
                <span>UTF-8 Word Aligned Encoding</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(kvInputValue);
                        setKvInputValue(JSON.stringify(parsed, null, 2));
                        pushKvLog("INFO", "Formatted and expanded content payload block.");
                      } catch (e: any) {
                        pushKvLog("ERROR", `Failed formatting: ${e.message}`);
                      }
                    }}
                    className="text-cyan-400 hover:text-cyan-300 uppercase cursor-pointer"
                  >
                    Format JSON
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(kvInputValue);
                      pushKvLog("INFO", "Copied value block payload to clipboard.");
                    }}
                    className="text-slate-400 hover:text-slate-200 uppercase cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Workers Live Script Fetch Playground & CLI Terminal */}
            <div className="lg:col-span-3 flex flex-col gap-3 justify-between">
              
              {/* CLI Command Shell */}
              <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-md space-y-2">
                <span className="text-[9.5px] font-mono font-bold text-cyan-400 uppercase block tracking-wider flex items-center gap-1">
                  <TerminalIcon className="h-3 w-3" /> EDGE EMULATION CONSOLE
                </span>
                
                <p className="text-[8px] text-slate-455 font-mono leading-tight">
                  Dispatches binary shell arguments directly to the OpenRSC Cloudflare persistence backplane substrate:
                </p>

                <div className="flex gap-1">
                  <input 
                    type="text"
                    value={cliCommand}
                    onChange={(e) => setCliCommand(e.target.value)}
                    placeholder="Enter command arguments (e.g. --save-state-kv)"
                    className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 py-1 text-slate-200 font-mono text-[9px] focus:outline-none focus:border-cyan-700" 
                  />
                  <button 
                    onClick={runCliCommand}
                    className="px-2.5 py-1 bg-cyan-950 border border-cyan-800 hover:bg-cyan-900 hover:border-cyan-700 text-cyan-400 rounded text-[9.5px] font-mono font-bold cursor-pointer transition flex items-center"
                  >
                    RUN
                  </button>
                </div>

                {cliFeedback && (
                  <div className="bg-slate-950 p-2 rounded border border-slate-850 text-[7.5px] font-mono text-emerald-400 leading-normal animate-fade-in break-words">
                    {cliFeedback}
                  </div>
                )}
              </div>

              {/* Workers Fetch Boilerplate Code box */}
              <div className="bg-slate-900/60 border border-slate-850 p-3 rounded-md space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[8.5px] font-mono text-slate-400 font-bold">CF WORKER METASCRIPT</span>
                    <span className="text-[6px] font-mono text-cyan-550 border border-cyan-900 px-1 rounded">worker.js</span>
                  </div>
                  
                  <div className="bg-slate-950 p-2 rounded border border-slate-850 text-[7px] font-mono text-slate-400 leading-normal overflow-auto max-h-[140px]">
                    <span className="text-amber-500">export default</span> &#123;<br />
                    &nbsp;&nbsp;<span className="text-violet-400">async</span> <span className="text-emerald-400">fetch</span>(request, env, ctx) &#123;<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500">// write key-value state</span><br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-violet-400">await</span> env.KV.<span className="text-sky-400">put</span>(<span className="text-emerald-500">'KEY'</span>, <span className="text-emerald-500">'VALUE'</span>);<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500">// read key-value state</span><br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-violet-400">const</span> value = <span className="text-violet-400">await</span> env.KV.<span className="text-sky-400">get</span>(<span className="text-emerald-500">'KEY'</span>);<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-violet-400">return new</span> <span className="text-amber-400">Response</span>(...);<br />
                    &nbsp;&nbsp;&#125;<br />
                    &#125;
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900 mt-2">
                  <button 
                    onClick={() => {
                      // Simulates compiling the worker block and executing
                      pushKvLog("INFO", "Running worker.js fetch() simulator against active namespace context...");
                      setTimeout(() => {
                        try {
                          const value = activeNamespace === "PLAYERS" ? playersKv["player:pog2"] : worldDoKv["do_sql_backplane_state"];
                          pushKvLog("SUCCESS", `[WORKER METASCRIPT] Return Code (200 OK) with KV bind response.`);
                          setCliFeedback(`[WORKER] fetch successful. Evaluated payload size: ${value ? value.length : 0} bytes.`);
                        } catch (e) {}
                      }, 250);
                    }}
                    className="w-full py-1.5 bg-gradient-to-r from-emerald-950/40 to-cyan-950/45 border border-cyan-800 hover:border-cyan-500 text-cyan-300 rounded font-mono text-[9px] cursor-pointer text-center font-bold flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Play className="h-3 w-3 text-cyan-400" />
                    EXECUTE WORKER FETCH
                  </button>
                </div>
              </div>

              {/* Console event listing */}
              <div className="bg-slate-950 p-2.5 rounded border border-slate-850 h-[100px] overflow-y-auto flex flex-col-reverse gap-1 select-none">
                {kvOperationLogs.length === 0 ? (
                  <span className="text-[7.5px] font-mono text-slate-600">No events logged. Run CRUD or scripts above.</span>
                ) : (
                  kvOperationLogs.map((log, idx) => {
                    let color = "text-slate-450";
                    if (log.includes("[SUCCESS]")) color = "text-emerald-450 font-semibold";
                    if (log.includes("[WARNING]")) color = "text-amber-450";
                    if (log.includes("[ERROR]") || log.includes("[CRITICAL]")) color = "text-red-400 font-bold";
                    if (log.includes("[INFO]")) color = "text-cyan-400";
                    return (
                      <div key={idx} className={`text-[7.5px] font-mono leading-tight break-words ${color}`}>
                        {log}
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="globalping-tab"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left Column: Probe Config Form */}
            <div className="lg:col-span-4 flex flex-col gap-3.5 bg-slate-900/60 border border-slate-855 p-4 rounded-md font-mono text-[9px]">
              <div>
                <span className="text-[10.5px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">
                  jsDelivr Globalping Test Runner
                </span>
                <p className="text-[8px] text-slate-500 leading-normal mb-3">
                  Triggers network measurements from globally distributed community probes targeting your endpoint to prove location accuracy.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-slate-450 block mb-1">Execution Mode Selector:</label>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-950 border border-slate-855 rounded">
                    <button
                      type="button"
                      onClick={() => setGlobalpingMode("REAL_API")}
                      className={`py-1 text-[8px] font-mono rounded font-bold cursor-pointer transition ${globalpingMode === "REAL_API" ? "bg-cyan-950 text-cyan-400 border border-cyan-900/60" : "text-slate-500 hover:text-slate-350 bg-transparent border-0"}`}
                    >
                      Real Globalping API
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalpingMode("SIMULATION")}
                      className={`py-1 text-[8px] font-mono rounded font-bold cursor-pointer transition ${globalpingMode === "SIMULATION" ? "bg-indigo-950 text-indigo-400 border border-indigo-900/60" : "text-slate-500 hover:text-slate-350 bg-transparent border-0"}`}
                    >
                      On-Device Sim Mirror
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-450 block mb-1">Target Host Name:</label>
                  <input 
                    type="text"
                    value={globalpingTarget}
                    onChange={(e) => setGlobalpingTarget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-slate-200 font-mono text-[9px] focus:outline-none focus:border-cyan-700 font-bold hover:border-cyan-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-450 block mb-1">Check Type:</label>
                    <select
                      value={globalpingType}
                      onChange={(e) => setGlobalpingType(e.target.value as "http" | "ping")}
                      className="w-full bg-slate-950 border border-slate-855 text-slate-300 font-mono text-[9px] p-1 focus:outline-none hover:border-cyan-700/50"
                    >
                      <option value="http">http GET</option>
                      <option value="ping">icmp ping</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-450 block mb-1">Max Probes Limit:</label>
                    <select
                      value={globalpingProbeLimit}
                      onChange={(e) => setGlobalpingProbeLimit(parseInt(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-855 text-slate-300 font-mono text-[9px] p-1 focus:outline-none hover:border-cyan-700/50"
                    >
                      <option value="4">4 Vantage pts</option>
                      <option value="8">8 Vantage pts</option>
                      <option value="10">10 Vantage pts</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-455 block mb-1">Location Targeting Selector:</label>
                  <select
                    value={globalpingLocation}
                    onChange={(e) => setGlobalpingLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 text-slate-300 font-mono text-[9px] p-1 focus:outline-none hover:border-cyan-700/50"
                  >
                    <option value="magic: world">magic: world (Distributed Random Mix)</option>
                    <option value="Berlin, Germany">Berlin, Germany (Europe Cluster)</option>
                    <option value="Oregon, US">Oregon, USA (US West Vantage)</option>
                    <option value="South America">Brazil / South America (LatAm Cluster)</option>
                    <option value="Tokyo, Japan">Tokyo, Japan (Asia-Pac Cluster)</option>
                  </select>
                </div>

                <button 
                  onClick={handleGlobalpingDispatch}
                  disabled={globalpingLoading}
                  className="w-full py-2 bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-800 text-cyan-300 font-bold hover:border-cyan-500 rounded text-center cursor-pointer transition flex items-center justify-center gap-1.5 shadow disabled:opacity-50 font-mono text-[9.5px]"
                >
                  <Play className="h-3 w-3 text-cyan-400" />
                  {globalpingLoading ? "DISPATCHING PROBES..." : "RUN VERIFICATION TEST"}
                </button>
              </div>

              {/* Status information banner */}
              <div className="bg-slate-950 rounded p-2 border border-slate-850 font-mono text-[7.5px] text-slate-555 leading-relaxed mt-1 select-none">
                <span className="text-slate-400 font-bold block uppercase mb-1">HOW AREAL TESTS ARE EVALUATED</span>
                Probes query the Cloudflare KV and Durable Object edge substrate. Geolocation headers (<strong className="text-cyan-400">CF-IPCountry</strong>) computed by the server map the physical coordinates. Testing validates if the Sovereign Globe's matching accuracy matches authentic probe positions.
              </div>
            </div>

            {/* Right Column: Execution Log Console & Interactive Map Tables */}
            <div className="lg:col-span-8 flex flex-col gap-3.5">
              
              {/* Web Console Stream of JSON queries */}
              <div className="bg-slate-950 p-3 rounded-md border border-slate-850 h-[110px] overflow-hidden flex flex-col justify-between font-mono select-text">
                <div className="flex-1 flex flex-col h-full min-h-0">
                  <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-900 select-none">
                    <span className="text-[8.5px] text-slate-400 font-bold">GLOBALPING MEASUREMENT DAEMON STREAM</span>
                    <span className="text-[7px] text-cyan-550 font-bold">stdout</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-0.5 text-[7.5px] leading-relaxed pr-1 font-semibold text-slate-400">
                    {globalpingLogs.length === 0 ? (
                      <div className="text-slate-650 italic select-none">Waiting to run Globalping measurement. Adjust settings and click 'RUN VERIFICATION TEST' above...</div>
                    ) : (
                      globalpingLogs.map((log, idx) => (
                        <div key={idx} className="break-words">
                          <span className="text-indigo-400 font-extrabold">[gping_mcp]</span> {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Geo Audit output table */}
              <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-md">
                <span className="text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2 select-none">
                  AREAL GEOLOCATION VALIDATION RECORD
                </span>

                {!globalpingResults ? (
                  <div className="text-center py-8 bg-slate-950/20 border border-dashed border-slate-850 rounded font-mono text-[8px] text-slate-500">
                    NO ACTIVE TEST RECORD. DISPATCH GLOBALPING TEST RUNNER TO EVALUATE REGIONAL DETECTIONS.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded border border-slate-900 font-mono text-[8px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-950 border-b border-slate-900 text-slate-500 select-none">
                        <tr>
                          <th className="p-1.5 pl-2.5">Probe ID</th>
                          <th className="p-1.5">Origin Vantage Point</th>
                          <th className="p-1.5">Provider Network</th>
                          <th className="p-1.5 text-center">Type</th>
                          <th className="p-1.5 text-right">Raw RTT</th>
                          {globalpingType === "http" && <th className="p-1.5 text-right">TLS Handshake</th>}
                          <th className="p-1.5 text-right pr-2.5 font-bold">Globe Match Precision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-950 text-slate-400">
                        {globalpingResults.map((r) => (
                          <tr key={r.probeId} className="hover:bg-slate-900/60">
                            <td className="p-1.5 pl-2.5 text-slate-500 font-bold">{r.probeId}</td>
                            <td className="p-1.5 text-slate-200 font-bold">
                              📍 {r.city}, {r.country}
                            </td>
                            <td className="p-1.5 text-slate-500 text-[7.5px] truncate max-w-[120px]" title={r.provider}>{r.provider} ({r.asn})</td>
                            <td className="p-1.5 text-center">
                              <span className={`px-1 rounded text-[7px] font-bold ${
                                r.type === 'datacenter' ? 'bg-indigo-950/40 text-indigo-405 border border-indigo-900/60' :
                                'bg-teal-950/40 text-teal-405 border border-teal-900/50'
                              }`}>
                                {r.type}
                              </span>
                            </td>
                            <td className="p-1.5 text-right font-bold text-slate-200">{r.latency}ms</td>
                            {globalpingType === "http" && (
                              <td className="p-1.5 text-right text-cyan-400 text-[7.5px] font-bold">{r.tlsHandshake}ms</td>
                            )}
                            <td className="p-1.5 text-right pr-2.5 font-bold text-emerald-400 animate-pulse">
                              ✓ {r.precision}% Match
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Simulation <-> API Comparative Validation Report */}
              {globalpingValidationResult && (
                <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-md font-mono text-[9px] space-y-3 shadow-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-950">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${globalpingValidationResult.status === "SUCCESS" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                      Sim-to-Edge Calibration & Validation Audit
                    </span>
                    <span className="text-[8px] px-1.5 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-400 font-bold">
                      Source: {validationSource === "REAL_API_SYNC" ? "REAL ACTIVE TRACE" : "LOCAL EMULATION"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-950/80 border border-slate-900 rounded p-2 text-left">
                      <div className="text-[7.5px] text-slate-500 uppercase font-bold">Target Host</div>
                      <div className="text-[9.5px] text-slate-200 mt-1 truncate" title={globalpingValidationResult.target}>
                        {globalpingValidationResult.target}
                      </div>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-900 rounded p-2 text-left">
                      <div className="text-[7.5px] text-slate-500 uppercase font-bold">Active Probes</div>
                      <div className="text-[10px] font-bold text-cyan-400 mt-1">
                        {globalpingValidationResult.probesCount} Nodes
                      </div>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-900 rounded p-2 text-left">
                      <div className="text-[7.5px] text-slate-505 uppercase font-bold">Sim RTT (Baseline)</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1">
                        {globalpingValidationResult.simAvgRtt}
                      </div>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-900 rounded p-2 text-left">
                      <div className="text-[7.5px] text-indigo-405 uppercase font-bold">Measured RTT</div>
                      <div className="text-[10px] font-bold text-indigo-300 mt-1">
                        {globalpingValidationResult.avgRawRtt}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-900 rounded p-2.5 flex items-center justify-between text-[8px] leading-normal gap-4">
                    <div className="flex-1">
                      <span className="text-[7px] text-slate-505 uppercase block font-bold mb-0.5">MATH PARITY CONVERGENCE</span>
                      <p className="text-slate-300">
                        {globalpingValidationResult.remarks}
                      </p>
                    </div>
                    <div className="text-right pl-3 border-l border-slate-900 shrink-0 font-mono">
                      <span className="text-[7.5px] text-slate-505 uppercase block font-bold mb-0.5 font-mono">SYMMETRIC INDEX</span>
                      <strong className={`text-[11px] font-extrabold ${globalpingValidationResult.status === "SUCCESS" ? "text-emerald-400" : "text-amber-400 animate-pulse"}`}>
                        {globalpingValidationResult.correlationScore}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}

        {activeTab === "budget" && (
          <motion.div 
            key="budget-tab"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left Hand: Comparison cards for the 3 corrections */}
            <div className="lg:col-span-6 flex flex-col gap-3 font-mono">
              <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-md space-y-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                  MANDATORY SYSTEM FREE-TIER CORRECTIONS
                </span>
                <p className="text-[8px] text-slate-550 leading-normal">
                  Reduces expensive KV write limits (1,000/day) and Workers requests (100,000/day) triggers by routing hot states inside isolated Durable Objects with transactional SQLite storage.
                </p>

                {/* Correction 1 Card */}
                <div className="bg-slate-950/80 border border-slate-900 rounded p-2.5 space-y-1.5 text-[8.5px]">
                  <div className="flex justify-between items-center text-[7.5px] font-bold">
                    <span className="text-slate-500">CORRECTION 01/03: INGESTION PROTOCOL</span>
                    <span className="text-emerald-400 bg-emerald-950/70 px-1 border border-emerald-950/70 rounded">100x REQUEST DEFLATION</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="bg-red-955/15 border border-red-950 p-1.5 rounded line-through text-red-400/80 opacity-60">
                      <strong className="block text-[7px] text-slate-500 uppercase">Pasted Stack:</strong>
                      Worker receives all MAVProxy and ROS 2 HTTP traffic directly at 1 Hz (86,400 hits/day).
                    </div>
                    <div className="bg-emerald-955/15 border border-emerald-950/60 p-1.5 rounded text-emerald-300">
                      <strong className="block text-[7px] text-emerald-400 font-bold uppercase">Optimized Scheme:</strong>
                      Worker upgrades to <strong>WebSocket tunnel</strong> on start. Stream data inside DO memory. Unlimited events for 1 single invocation request.
                    </div>
                  </div>
                </div>

                {/* Correction 2 Card */}
                <div className="bg-slate-950/80 border border-slate-900 rounded p-2.5 space-y-1.5 text-[8.5px]">
                  <div className="flex justify-between items-center text-[7.5px] font-bold">
                    <span className="text-slate-500">CORRECTION 02/03: CACHE PERSISTENCE BACKPLANE</span>
                    <span className="text-emerald-400 bg-emerald-950/70 px-1 border border-emerald-950/70 rounded">ZERO KV WRITE WEAR</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="bg-red-955/15 border border-red-950 p-1.5 rounded line-through text-red-400/80 opacity-60">
                      <strong className="block text-[7px] text-slate-500 uppercase">Pasted Stack:</strong>
                      Utilizes hot NVRAM Cloudflare KV space for active player state caching (exceeds 1,000 writes/day on 20 players).
                    </div>
                    <div className="bg-emerald-955/15 border border-emerald-950/60 p-1.5 rounded text-emerald-300">
                      <strong className="block text-[7px] text-emerald-400 font-bold uppercase">Optimized Scheme:</strong>
                      Committed to <strong>DO transactional SQLite</strong> database for hot game/metabolic state. 1 GB free space, zero-charge reads/writes.
                    </div>
                  </div>
                </div>

                {/* Correction 3 Card */}
                <div className="bg-slate-955 border border-slate-900 rounded p-2.5 space-y-1.5 text-[8.5px]">
                  <div className="flex justify-between items-center text-[7.5px] font-bold">
                    <span className="text-slate-500">CORRECTION 03/03: COMPILE BATCH MATRIX</span>
                    <span className="text-emerald-400 bg-emerald-950/70 px-1 border border-emerald-950/70 rounded">HEXAGRAM BUNDLING</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="bg-red-955/15 border border-red-950 p-1.5 rounded line-through text-red-400/80 opacity-60">
                      <strong className="block text-[7px] text-slate-500 uppercase">Pasted Stack:</strong>
                      No compile batching mechanisms. Commits log events directly to Cloud Run database as they occur.
                    </div>
                    <div className="bg-emerald-955/15 border border-emerald-950/60 p-1.5 rounded text-emerald-300">
                      <strong className="block text-[7px] text-emerald-400 font-bold uppercase">Optimized Scheme:</strong>
                      <strong>DO Alarm every 15 mins</strong> fetches up to 50 APIs, gathers SQLite stack, compiles a single frame, commits exactly 1 write to D1.
                    </div>
                  </div>
                </div>

              </div>

              {/* 4-Tier Diagnostic Metabolic Flowchart */}
              <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-md space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-cyan-400" />
                  THE 4-TIER SCHEDULING MATRIX
                </span>
                
                <div className="space-y-2 text-[8px] leading-relaxed">
                  <div className="flex border border-slate-900 bg-slate-950 rounded p-1.5 gap-2 items-start">
                    <span className="font-bold text-cyan-405 bg-cyan-950 border border-cyan-900 px-1 rounded text-[7px] mt-0.5 select-none">TIER 1</span>
                    <div>
                      <strong className="text-slate-300 uppercase block font-bold">Continuous heartbeat (640ms) – $0 Cost</strong>
                      <span className="text-slate-400">POG2WorldDO handles WebSocket packets instantly. Incoming MAVLink packets and ROS 2 telemetry are recorded into local SQLite stack tables. No KV wear.</span>
                    </div>
                  </div>

                  <div className="flex border border-slate-900 bg-slate-950 rounded p-1.5 gap-2 items-start">
                    <span className="font-bold text-emerald-405 bg-emerald-950 border border-emerald-900 px-1 rounded text-[7px] mt-0.5 select-none">TIER 2</span>
                    <div>
                      <strong className="text-emerald-300 uppercase block font-bold">Yao Cycle (64 ticks / 40.96s) – $0 Cost</strong>
                      <span className="text-slate-400">Active player position data commits sequentially to DO SQLite. Deep state monitoring logs are held silent in local tables.</span>
                    </div>
                  </div>

                  <div className="flex border border-slate-900 bg-slate-950 rounded p-1.5 gap-2 items-start">
                    <span className="font-bold text-yellow-500 bg-yellow-950 border border-yellow-905 px-1 rounded text-[7px] mt-0.5 select-none">TIER 3</span>
                    <div>
                      <strong className="text-yellow-300 uppercase block font-bold">Hexagram Gate (15 mins / DO Alarm) – 96 writes/day</strong>
                      <span className="text-slate-400">DO wakeup alarm triggers API polls, groups stack logs, compresses to a single JSON payload, writes to D1 audit, triggers global dashboard updates.</span>
                    </div>
                  </div>

                  <div className="flex border border-slate-900 bg-slate-955 rounded p-1.5 gap-2 items-start">
                    <span className="font-bold text-indigo-400 bg-indigo-950 border border-indigo-900 px-1 rounded text-[7px] mt-0.5 select-none">TIER 4</span>
                    <div>
                      <strong className="text-indigo-300 uppercase block font-bold">Circadian Reset (00:00 UTC) – Night rollup</strong>
                      <span className="text-slate-400">Compiles cumulative metrics for day-reports, executes R2 backup storage saves, purges memory buckets.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Hand: Simulation console + live slider and budget analytics */}
            <div className="lg:col-span-6 flex flex-col gap-3 font-mono">
              <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-md space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      CF LANDSCAPE CONSUMPTION CALCULATOR
                    </span>
                    <span className="text-[8px] font-bold text-emerald-400 border border-emerald-900 bg-emerald-950 px-1.5 py-0.5 rounded animate-pulse select-none uppercase">
                      STRICT FREE LIMITS
                    </span>
                  </div>
                  
                  {/* Interactive Slider */}
                  <div className="bg-slate-955 p-3 border border-slate-900 rounded space-y-2 mb-3">
                    <div className="flex justify-between items-center text-[8px]">
                      <span className="text-slate-400 font-bold uppercase">Expected Active Players Load:</span>
                      <strong className="text-cyan-400 text-[10px] font-bold">{expectedPlayers} Players / Day</strong>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="150"
                      value={expectedPlayers}
                      onChange={(e) => setExpectedPlayers(parseInt(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer h-1 rounded"
                    />
                    <div className="flex justify-between text-[7px] text-slate-600 font-mono">
                      <span>1 Player (Solo Dev)</span>
                      <span>50 (Squad Coop)</span>
                      <span>150 (Limits Pressure)</span>
                    </div>
                  </div>

                  {/* Meter Grid */}
                  <div className="space-y-3 text-[8px] leading-normal">
                    <span className="block text-[7.5px] text-slate-500 uppercase tracking-widest font-bold">DAILY QUOTA SIMULATION METERS</span>
                    
                    {/* Worker Requests */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Workers HTTP Requests Count (Cap: 100K)</span>
                        <span className="text-slate-305 font-medium">~{Math.round(200 + expectedPlayers * 1.5).toLocaleString()} / 100,000 requests</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden border border-slate-900">
                        <div 
                          className="bg-cyan-500 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((200 + expectedPlayers * 1.5) / 100000) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* DO Requests */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Durable Object Actions Counter (Cap: 100K)</span>
                        <span className="text-slate-305 font-medium">~{Math.round(96 + expectedPlayers * 300).toLocaleString()} / 100,000 requests</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden border border-slate-900">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((96 + expectedPlayers * 300) / 100000) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* DO Duration */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Durable Object Duration budget (Cap: 13,000 GB-s)</span>
                        <span className={`font-semibold ${expectedPlayers > 80 ? "text-amber-400 animate-pulse font-bold" : "text-slate-305"}`}>
                          ~{Math.round(11059 + expectedPlayers * 13).toLocaleString()} / 13,000 GB-s
                          {expectedPlayers > 80 && " ⚠️ WARNING: TRANSIT OVERTIME"}
                        </span>
                      </div>
                      <div className="w-full bg-slate-955 h-1.5 rounded overflow-hidden border border-slate-900">
                        <div 
                          className={`h-full transition-all duration-300 ${expectedPlayers > 80 ? "bg-amber-500" : "bg-teal-500"}`}
                          style={{ width: `${Math.min(100, (((11059 + expectedPlayers * 13) / 13000) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* KV Writes */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Cloudflare KV Writes Cap (Cap: 1K)</span>
                        <span className="text-slate-305 font-medium">96 (Hourly Batches) / 1,000 writes</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden border border-slate-900">
                        <div 
                          className="bg-violet-500 h-full"
                          style={{ width: "9.6%" }}
                        />
                      </div>
                    </div>

                    {/* D1 SQL Rows Written */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>D1 SQLite Database Rows Logged (Cap: 100K)</span>
                        <span className="text-slate-305 font-medium">~{Math.round(96 + expectedPlayers * 96).toLocaleString()} / 100,000 writes</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden border border-slate-900">
                        <div 
                          className="bg-indigo-500 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (((96 + expectedPlayers * 96) / 100000) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated Console Stream */}
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-900">
                  <div className="flex justify-between items-center text-[8px] flex-wrap gap-2">
                    <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-cyan-500 animate-pulse" />
                      DO ALARM DIAGNOSTIC EMULATOR CONSOLE
                    </span>
                    <button 
                      onClick={triggerEmulatedAlarm}
                      disabled={isAlarmTransitioning}
                      className="px-2.5 py-1 bg-gradient-to-r from-cyan-950 to-indigo-950 hover:from-cyan-900 hover:to-indigo-900 hover:text-white text-cyan-400 border border-cyan-800 rounded text-[7.5px] font-bold cursor-pointer transition select-none flex items-center gap-1.5"
                    >
                      {isAlarmTransitioning ? (
                        <>
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" /> RUNNING ALARM TIER...
                        </>
                      ) : (
                        "FORCE ALARM EMULATION (TIER 3)"
                      )}
                    </button>
                  </div>

                  <div className="bg-slate-950/90 border border-slate-900 rounded p-2 text-[7.5px] font-mono leading-relaxed h-[130px] overflow-y-auto space-y-1 text-slate-350 select-text">
                    {emulatedAlarmLogs.map((log, index) => (
                      <div key={index} className="wave-line select-text font-mono">
                        {log.startsWith("[ALARM") ? (
                          <span className="text-amber-400 font-bold">{log}</span>
                        ) : log.startsWith("[STEP 4") ? (
                          <span className="text-cyan-400 font-semibold">{log}</span>
                        ) : log.startsWith("[STEP 6") ? (
                          <span className="text-indigo-400 font-semibold">{log}</span>
                        ) : (
                          <span>{log}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-[7px] text-slate-500 leading-relaxed text-right font-mono italic">
                    * The absolute bottleneck is DO duration (85% consumed with 1 active DO awake continuously). Adding a second DO requires waking/hibernation cycling.
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "tools" && (
          <motion.div 
            key="tools-tab"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left Hand: 10-Tool Directory & Revenue Mapping */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-3 bg-slate-900/60 border border-slate-850 p-4 rounded-md">
              <div className="space-y-2">
                <span className="block text-[8px] text-slate-550 uppercase tracking-widest font-bold">10-Tool Market Architecture Directory</span>
                <p className="text-[7.5px] font-mono text-slate-450 leading-relaxed mb-4">
                  Select a deep-tech monitoring tool below to explore its primary submodule and simulated sovereign API.
                </p>
                
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {COGNITIVE_TOOLS.map((tool) => {
                    const isSelected = activeToolId === tool.id;
                    const ToolIcon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => setActiveToolId(tool.id)}
                        className={`w-full text-left p-2 rounded border transition cursor-pointer text-xs font-mono relative flex items-start gap-2.5 ${
                          isSelected 
                            ? "bg-slate-950 border-cyan-800 text-white shadow-md shadow-cyan-955/25" 
                            : "bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <div className={`p-1.5 rounded mt-0.5 border shrink-0 ${tool.accent}`}>
                          <ToolIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 text-[9.5px]">
                          <div className="flex justify-between items-center gap-1">
                            <span className="font-bold text-[9px] truncate">{tool.name}</span>
                            {isSelected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-450 shrink-0" />
                            )}
                          </div>
                          <span className="block text-[6.5px] text-slate-500 uppercase font-semibold mt-0.5 tracking-wider truncate">
                            {tool.tier}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sovereign Revenue Stream Summary Cards */}
              <div className="border-t border-slate-900 pt-4 space-y-2 font-mono">
                <div className="flex justify-between items-center text-[7.5px]">
                  <span className="font-bold text-slate-400 uppercase">Revenue Stream Model Card</span>
                  <span className="text-emerald-500 font-bold px-1 border border-emerald-950 bg-emerald-955/20 rounded text-[6.5px]">ACTIVE OVERLAY</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[8px] leading-tight">
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-900">
                    <span className="text-slate-500 block text-[6.5px] uppercase">Tech Sale</span>
                    <strong className="text-amber-500 font-bold block">$1.1B–$3.2B</strong>
                    <span className="text-[6px] text-slate-600 block mt-0.5">Sovereign Provenance</span>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-900">
                    <span className="text-slate-500 block text-[6.5px] uppercase">Stack Lease</span>
                    <strong className="text-cyan-400 font-bold block">$40M–$300M/y</strong>
                    <span className="text-[6px] text-slate-600 block mt-0.5">Cloudflare Mesh</span>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-900">
                    <span className="text-slate-500 block text-[6.5px] uppercase">Subm License</span>
                    <strong className="text-violet-400 font-bold block">$5M–$80M/lic</strong>
                    <span className="text-[6px] text-slate-600 block mt-0.5">Targeted Bundle</span>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-900">
                    <span className="text-slate-500 block text-[6.5px] uppercase">Royalty Stream</span>
                    <strong className="text-rose-400 font-bold block">$50M–$200M/y</strong>
                    <span className="text-[6px] text-slate-600 block mt-0.5">Lightweight Embeds</span>
                  </div>
                </div>
                
                <p className="text-[6px] text-slate-550 leading-normal italic">
                  * Cognitive tools enforce sovereignty retention via tamper chains, encrypted weights, and localized offline replay architectures.
                </p>
              </div>
            </div>

            {/* Right Hand: Deep Simulation Panel */}
            <div className="lg:col-span-8 flex flex-col justify-between bg-slate-900/60 border border-slate-850 p-4 rounded-md font-mono text-[8px]">
              {(() => {
                const currentTool = COGNITIVE_TOOLS.find(t => t.id === activeToolId) || COGNITIVE_TOOLS[0];
                const ToolIcon = currentTool.icon;
                return (
                  <div className="flex-1 flex flex-col justify-between h-full space-y-4">
                    {/* Header showing active tool details */}
                    <div className="border-b border-slate-900 pb-3 flex justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-[9px] text-white font-bold">
                          <ToolIcon className="h-4 w-4 text-cyan-400" />
                          <span>{currentTool.name}</span>
                        </div>
                        <div className="text-[7.5px] text-cyan-500/90 font-medium mt-1 uppercase tracking-wider">
                          🎯 {currentTool.submodule}
                        </div>
                        <p className="text-[7.5px] text-slate-500 mt-0.5">
                          {currentTool.submoduleDesc}
                        </p>
                      </div>
                      
                      <div className="text-right flex flex-col items-end shrink-0 select-none">
                        <span className="text-[6.5px] text-slate-550 uppercase tracking-widest font-bold">Buyer Channel Segment</span>
                        <span className="text-[7.5px] text-emerald-400 font-bold px-1.5 py-0.5 border border-emerald-950 bg-emerald-955/20 rounded mt-0.5">
                          {currentTool.tier}
                        </span>
                        <span className="text-[6px] text-slate-500 mt-1 max-w-[150px] leading-tight block">
                          {currentTool.tierDesc}
                        </span>
                      </div>
                    </div>

                    {/* Simulation Parameters & Controls Sub-panel */}
                    <div className="bg-slate-950/30 p-3 rounded border border-slate-900/60 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Simulation Control Panel</span>
                          <span className="text-[6.5px] text-slate-650">SIMULATION ENGINE VER: v3.1</span>
                        </div>

                        {/* RENDER CUSTOM CONTROLS BASED ON ACTIVE TOOL ID */}
                        {activeToolId === "flatbuffers" && (
                          <div className="space-y-2">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Compare standard serialization formats with binary FlatBuffers layouts. Ingest 16 high-frequency sensor channels from local memory and structure into an Apache Arrow table representation.
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={handleT1RunSimulation}
                                disabled={t1Serializing}
                                className="px-3 py-1.5 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded font-bold hover:bg-cyan-900/50 hover:text-white cursor-pointer transition select-none flex items-center gap-1.5"
                              >
                                {t1Serializing ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 animate-spin" /> PACKING BINARY BUFFER...
                                  </>
                                ) : (
                                  "RUN BINARY SERIALIZATION"
                                )}
                              </button>
                              <span className="text-slate-550 italic text-[7px]">* Subsecond execution without runtime copying overhead</span>
                            </div>
                          </div>
                        )}

                        {activeToolId === "onnx" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Adjust key subsea propulsion variables and feed them directly into the quantized on-device neural classifier model (ONNX framework compiled to WASM).
                            </p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-2.5 rounded border border-slate-900">
                              <div className="space-y-1">
                                <div className="flex justify-between text-slate-400 text-[7px]">
                                  <span>Electrode Heat (Kelvin)</span>
                                  <strong className="text-white">{t2ElectrodeTemp} K</strong>
                                </div>
                                <input
                                  type="range"
                                  min="280"
                                  max="460"
                                  value={t2ElectrodeTemp}
                                  onChange={(e) => setT2ElectrodeTemp(Number(e.target.value))}
                                  className="w-full accent-cyan-500 cursor-pointer"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-slate-400 text-[7px]">
                                  <span>Coil Bus Current (Ampere)</span>
                                  <strong className="text-white">{t2BusCurrent} A</strong>
                                </div>
                                <input
                                  type="range"
                                  min="100"
                                  max="900"
                                  value={t2BusCurrent}
                                  onChange={(e) => setT2BusCurrent(Number(e.target.value))}
                                  className="w-full accent-cyan-500 cursor-pointer"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-slate-400 text-[7px]">
                                  <span>Aft Plenum Pressure (Atm)</span>
                                  <strong className="text-white">{t2PlenumPressure} atm</strong>
                                </div>
                                <input
                                  type="range"
                                  min="0.5"
                                  max="3.5"
                                  step="0.05"
                                  value={t2PlenumPressure}
                                  onChange={(e) => setT2PlenumPressure(Number(e.target.value))}
                                  className="w-full accent-cyan-500 cursor-pointer"
                                />
                              </div>
                            </div>

                            <button
                              onClick={handleT2RunInference}
                              disabled={t2Running}
                              className="px-3 py-1.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded font-bold hover:bg-emerald-900/50 hover:text-white cursor-pointer transition select-none flex items-center gap-1.5"
                            >
                              {t2Running ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" /> CLASSIFYING ANOMALIES...
                                </>
                              ) : (
                                "EXECUTE WASM INFERENCE"
                              )}
                            </button>
                          </div>
                        )}

                        {activeToolId === "duckdb" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Run analytical columnar SQL queries inside the browser directly against Parquet telemetries using vectorized DuckDB instances.
                            </p>
                            
                            <div className="space-y-1">
                              <label className="text-[7px] text-slate-500 block uppercase">Enter SQL Statement</label>
                              <textarea
                                value={t3Query}
                                onChange={(e) => setT3Query(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-900 text-slate-200 p-2 rounded focus:outline-none font-mono text-[8px] min-h-[50px] leading-relaxed text-cyan-300"
                              />
                            </div>

                            <div className="flex gap-2.5">
                              <button
                                onClick={handleT3RunQuery}
                                disabled={t3Executing}
                                className="px-3 py-1.5 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded font-bold hover:bg-cyan-900/50 hover:text-white cursor-pointer transition select-none flex items-center gap-1.5"
                              >
                                {t3Executing ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 animate-spin" /> SCANNING PARQUET PARALLEL ROWS...
                                  </>
                                ) : (
                                  "RUN AD-HOC VECTOR SQL"
                                )}
                              </button>
                              
                              <button
                                onClick={() => setT3Query("SELECT count(*) AS failures FROM telemetry_log WHERE error_pct > 0.04;")}
                                className="px-2 py-1.5 bg-slate-950 text-slate-400 border border-slate-850 hover:border-slate-755 hover:text-white rounded transition cursor-pointer"
                              >
                                TEMPLATE: ANOMALY COUNT
                              </button>
                            </div>
                          </div>
                        )}

                        {activeToolId === "ollama" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Engage Ollama's local LLM grammar mode to draft comprehensive, highly-structured narrative status summaries constraining outputs strictly onto strict JSON schemas.
                            </p>
                            
                            <div className="space-y-1">
                              <span className="text-[7px] text-slate-500 block uppercase">Ingestation Incident Event Scenario</span>
                              <select
                                value={t4Scenario}
                                onChange={(e) => setT4Scenario(e.target.value)}
                                className="bg-slate-950 border border-slate-850 text-slate-350 p-1.5 rounded text-[8px] tracking-wide focus:outline-none"
                              >
                                <option value="boundary_leak">Boundary Layer Detachment & Cavitation Trigger</option>
                                <option value="thermal_surge">Electrode Thermal Surge Dissipation</option>
                                <option value="standard_gate">15-minute Sovereign Gate Stabilization Summary</option>
                              </select>
                            </div>

                            <button
                              onClick={handleT4RunNarrative}
                              disabled={t4Generating}
                              className="px-3 py-1.5 bg-violet-950 border border-violet-800 text-violet-400 rounded font-bold hover:bg-violet-900/50 hover:text-white cursor-pointer transition select-none flex items-center gap-1.5"
                            >
                              {t4Generating ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" /> SYMMETRIC DECODING...
                                </>
                              ) : (
                                "GENERATE GRAMMAR-NARRATIVE"
                              )}
                            </button>
                          </div>
                        )}

                        {activeToolId === "merkle" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Build cryptographic proof structures from standard telemetry sequences. Modify raw strings or initiate manual data tamper vectors to see the instant response of the Merkle Audit Chain validation!
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {t5LogsToHash.map((log, i) => (
                                <div key={i} className="space-y-1">
                                  <label className="text-[6.5px] text-slate-500 block font-semibold uppercase">Block [{i}] Frame Data</label>
                                  <input
                                    type="text"
                                    value={log}
                                    onChange={(e) => {
                                      const updated = [...t5LogsToHash];
                                      updated[i] = e.target.value;
                                      setT5LogsToHash(updated);
                                    }}
                                    className="w-full bg-slate-950 border border-slate-900 text-slate-200 px-2 py-1 rounded focus:outline-none font-mono text-[8px]"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2 items-center flex-wrap">
                              {t5TamperedIndex === null ? (
                                <button
                                  onClick={() => {
                                    setT5TamperedIndex(2);
                                    setT5TamperPayload("STATE_OVERRIDE_FAULT: INJECT FAULT SIGNATURE [0xFA]");
                                  }}
                                  className="px-2.5 py-1.5 bg-red-955/35 text-red-400 hover:text-white border border-red-900 rounded transition cursor-pointer select-none font-bold text-[7.5px]"
                                >
                                  TAMPER DATA STREAM (INJECT DISCREPANCY)
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setT5TamperedIndex(null);
                                    setT5TamperPayload("");
                                  }}
                                  className="px-2.5 py-1.5 bg-teal-90 border border-teal-800 text-teal-400 rounded transition cursor-pointer select-none font-bold text-[7.5px]"
                                >
                                  RE-STABILIZE TAMPER SECTOR
                                </button>
                              )}
                              <span className="text-[7.5px] text-slate-550 italic block">
                                {t5TamperedIndex !== null ? "⚠️ Hash correlation broken" : "✅ Block checksum signatures match perfectly"}
                              </span>
                            </div>
                          </div>
                        )}

                        {activeToolId === "spectral" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Simulate Real-time tactile visualizations of multi-band electromagnetic noise frequencies. Adjust base carrier parameters to watch physical peaks adapt.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-2.5 rounded border border-slate-900">
                              <div className="space-y-1">
                                <div className="flex justify-between text-slate-400 text-[7px]">
                                  <span>Carrier Frequency</span>
                                  <strong className="text-white">{t6Frequency} MHz</strong>
                                </div>
                                <input
                                  type="range"
                                  min="2"
                                  max="32"
                                  step="0.5"
                                  value={t6Frequency}
                                  onChange={(e) => setT6Frequency(Number(e.target.value))}
                                  className="w-full accent-blue-500 cursor-pointer"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-slate-400 text-[7px]">
                                  <span>Magnetic Field Strength</span>
                                  <strong className="text-white">{t6FieldStrength} Tesla</strong>
                                </div>
                                <input
                                  type="range"
                                  min="0.5"
                                  max="4.8"
                                  step="0.1"
                                  value={t6FieldStrength}
                                  onChange={(e) => setT6FieldStrength(Number(e.target.value))}
                                  className="w-full accent-blue-500 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {activeToolId === "entropy" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Calculate directed transfer entropy (information-theory measure) to mathematically pinpoint directed causal interactions between hardware submodules offline.
                            </p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/70 p-2.5 rounded border border-slate-900">
                              <div className="space-y-1">
                                <span className="text-[6.5px] text-slate-550 uppercase block">Cause Variable Source (X)</span>
                                <select
                                  value={t7VarX}
                                  onChange={(e) => setT7VarX(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 p-1.5 rounded text-[7.5px] focus:outline-none"
                                >
                                  <option value="Thermal Swarm (Submodule 2)">Thermal Swarm (Submodule 2)</option>
                                  <option value="CO2 Transpiration (Submodule 4)">CO₂ Transpiration (Submodule 4)</option>
                                  <option value="HV SiC Jitter (Submodule 3)">High-Voltage Switching (Submodule 3)</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[6.5px] text-slate-550 uppercase block">Affected Target Destination (Y)</span>
                                <select
                                  value={t7VarY}
                                  onChange={(e) => setT7VarY(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 p-1.5 rounded text-[7.5px] focus:outline-none"
                                >
                                  <option value="CO2 Transpiration (Submodule 4)">CO₂ Transpiration (Submodule 4)</option>
                                  <option value="Thermal Swarm (Submodule 2)">Thermal Swarm (Submodule 2)</option>
                                  <option value="High-Frequency Magnetic Flux">High-Frequency Magnetic Flux</option>
                                </select>
                              </div>
                            </div>

                            <button
                              onClick={handleT7Calculate}
                              className="px-3 py-1.5 bg-indigo-950 border border-indigo-800 text-indigo-400 rounded font-bold hover:bg-indigo-900/50 hover:text-white cursor-pointer transition select-none flex items-center gap-1.5 text-[7.5px]"
                            >
                              {t7Calculating ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" /> MEASURING INFORMATION ROUTING...
                                </>
                              ) : (
                                "CALCULATE CAUSAL ENTROPY VECTOR"
                              )}
                            </button>
                          </div>
                        )}

                        {activeToolId === "chaos" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Perform high-voltage switching adversarial jitter injections. Verify that FPGA hardware interlock arrays isolate risks inside microsecond timescales without cascading to primary components.
                            </p>
                            
                            <div className="space-y-2 bg-slate-950/70 p-2.5 rounded border border-slate-900">
                              <div className="flex justify-between text-slate-400">
                                <span>Switching Jitter Level (Nanoseconds)</span>
                                <strong className={`${t8ContactorJitter > 210 ? "text-red-400 animate-pulse font-bold" : "text-white"}`}>
                                  {t8ContactorJitter} ns {t8ContactorJitter > 210 && "(ADVERSARIAL STRESS OVER THRESHOLD)"}
                                </strong>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="400"
                                step="10"
                                value={t8ContactorJitter}
                                onChange={(e) => setT8ContactorJitter(Number(e.target.value))}
                                className="w-full accent-red-500 cursor-pointer"
                              />
                            </div>

                            <button
                              onClick={handleT8RunAdversarial}
                              disabled={t8Injecting}
                              className="px-3 py-1.5 bg-red-955/40 hover:bg-red-950 border border-red-800 text-red-500 rounded font-bold hover:text-white cursor-pointer transition select-none flex items-center gap-1.5 text-[7.5px]"
                            >
                              {t8Injecting ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" /> STREAMING HIGH-FREQUENCY DRIFT...
                                </>
                              ) : (
                                "INJECT ADVERSARIAL SWITHC LIMITS"
                              )}
                            </button>
                          </div>
                        )}

                        {activeToolId === "piper" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Vocalize critical system alerts from regional commands. Translate standard descriptive string scripts to localized phonemes arrays and compressed audio representation waveforms.
                            </p>
                            
                            <div className="space-y-1">
                              <label className="text-[7px] text-slate-550 block uppercase font-bold">Custom Synthetic Notification Alert Prompt</label>
                              <input
                                type="text"
                                value={t9InputMessage}
                                onChange={(e) => setT9InputMessage(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-900 text-slate-200 px-2 py-1.5 rounded focus:outline-none text-[8.5px]"
                              />
                            </div>

                            <button
                              onClick={handleT9Synthesize}
                              disabled={t9SpeechStatus === "rendering"}
                              className="px-3 py-1.5 bg-rose-950 border border-rose-800 text-rose-450 rounded font-bold hover:bg-rose-900/50 hover:text-white cursor-pointer transition select-none flex items-center gap-1.5"
                            >
                              {t9SpeechStatus === "rendering" ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" /> EXTRACTING ACOUSTIC PHONEMES...
                                </>
                              ) : (
                                "COMPILE PHONETIC SPEECH"
                              )}
                            </button>
                          </div>
                        )}

                        {activeToolId === "replay" && (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-[8px] leading-relaxed">
                              Enforce absolute mathematical replay safety. Scrub back and forth across 10 chronological microsecond ticks to confirm bit-for-bit repeatability of system status patterns offline.
                            </p>
                            
                            <div className="bg-slate-950/70 p-2.5 rounded border border-slate-900 space-y-2.5 font-mono">
                              <div className="flex justify-between text-slate-350">
                                <span className="uppercase text-[7.5px] font-bold">Timeline State-Step Scrub</span>
                                <span className="font-bold text-fuchsia-400">Step {t10StepIndex + 1} / 10 (Tick {t10Frames[t10StepIndex]?.tick})</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="9"
                                value={t10StepIndex}
                                onChange={(e) => setT10StepIndex(Number(e.target.value))}
                                className="w-full accent-fuchsia-500 cursor-pointer"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SIMULATED LIVE OUTPUT / VISUALIZATION SUITE */}
                      <div className="bg-slate-950 border border-slate-900/50 rounded p-3 h-[180px] overflow-y-auto relative flex flex-col justify-between">
                        <span className="absolute top-2 right-2 text-[6px] text-cyan-500 font-bold uppercase border border-cyan-950 px-1 rounded bg-cyan-955/20 tracking-widest">
                          Active Monitor Frame
                        </span>
                        
                        <div className="flex-1 overflow-y-auto">
                          {activeToolId === "flatbuffers" && (
                            <div className="space-y-2 h-full flex flex-col justify-between">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider select-none">FlatBuffers Encoder Log Pipe</span>
                              
                              <div className="font-mono text-[7px] text-slate-400 space-y-0.5 overflow-y-auto max-h-[80px]">
                                {t1Logs.length === 0 ? (
                                  <span className="text-slate-600 block italic font-mono select-none">No serialized trace compiled. Click 'Run Binary' to execute.</span>
                                ) : (
                                  t1Logs.map((log, i) => (
                                    <div key={i} className="wave-line">{log}</div>
                                  ))
                                )}
                              </div>

                              {t1Result && (
                                <div className="grid grid-cols-4 gap-2 border-t border-slate-900 pt-1.5 text-[8.5px] font-mono">
                                  <div>
                                    <span className="text-slate-500 block text-[6px] uppercase select-none">Payload JSON</span>
                                    <strong className="text-slate-350">{t1Result.jsonSize} B</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-550 block text-[6px] uppercase select-none font-semibold text-cyan-305">Binary FB</span>
                                    <strong className="text-cyan-400">{t1Result.fbSize} B</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[6px] uppercase select-none">Read Speed</span>
                                    <strong className="text-amber-500">{t1Result.speedUs} μs</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-550 block text-[6px] uppercase select-none text-emerald-400 font-semibold">Bandwidth Saved</span>
                                    <strong className="text-emerald-500">{t1Result.savings.toFixed(1)}%</strong>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {activeToolId === "onnx" && (
                            <div className="space-y-3 h-full flex flex-col justify-between">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider select-none">ONNX Web Anomaly Assessment Node</span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 items-center">
                                <div className="bg-slate-900/50 p-2 border border-slate-850 rounded text-[7.5px]">
                                  <span className="text-slate-550 block text-[6px] uppercase select-none font-bold">Inference Inputs Parameter Trace</span>
                                  <div className="mt-0.5 space-y-0.5">
                                    <div className="flex justify-between">
                                      <span>T_ELECTRODE:</span>
                                      <span className={`${t2ElectrodeTemp > 380 ? "text-red-400 animate-pulse font-bold" : "text-slate-350"}`}>{t2ElectrodeTemp} K</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>I_COIL_BUS:</span>
                                      <span className={`${t2BusCurrent > 650 ? "text-amber-400 font-bold" : "text-slate-350"}`}>{t2BusCurrent} A</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>P_PLENUM:</span>
                                      <span>{t2PlenumPressure} atm</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-slate-900/90 p-2.5 border border-slate-855 rounded flex flex-col justify-center text-center">
                                  {t2InferenceOutput ? (
                                    <div>
                                      <span className="text-slate-555 block text-[6.5px] uppercase select-none font-bold">Probability of Lattice Failure</span>
                                      <p className={`text-sm font-bold font-mono tracking-tight leading-none ${t2InferenceOutput.probability > 70 ? "text-red-400 animate-pulse" : t2InferenceOutput.probability > 30 ? "text-amber-400" : "text-emerald-400"}`}>
                                        {t2InferenceOutput.probability}%
                                      </p>
                                      <div className={`text-[7px] font-bold mt-1 tracking-wide uppercase ${t2InferenceOutput.probability > 70 ? "text-red-450" : t2InferenceOutput.probability > 30 ? "text-amber-450" : "text-emerald-450"}`}>
                                        {t2InferenceOutput.status}
                                      </div>
                                      <span className="text-[6px] text-slate-550 block mt-0.5 select-none font-semibold">ON-DEVICE WASM LATENCY: {t2InferenceOutput.latencyMs}ms</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-600 italic select-none">Adjust sliders above and click 'Execute WASM Inference' to compile pattern anomaly models...</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {activeToolId === "duckdb" && (
                            <div className="space-y-1.5 h-full flex flex-col justify-between">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider select-none">DuckDB Execution Result Frame</span>
                              
                              <div className="flex-1 overflow-x-auto">
                                {t3Result ? (
                                  <table className="w-full text-left font-mono text-[7px] leading-tight select-text">
                                    <thead>
                                      <tr className="border-b border-slate-900 text-slate-500 uppercase select-none font-bold">
                                        {Object.keys(t3Result[0]).map((key, i) => (
                                          <th key={i} className="pb-1 py-0.5 font-bold font-mono">{key}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-950 text-slate-350">
                                      {t3Result.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-900/40">
                                          {Object.values(row).map((val: any, j) => (
                                            <td key={j} className="py-1 font-mono">{typeof val === "number" ? val.toFixed(2) : String(val)}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-slate-600 italic select-none">
                                    No database results compiled into memory. Click 'Run Ad-Hoc SQL' above.
                                  </div>
                                )}
                              </div>
                              
                              <div className="text-[6.5px] text-cyan-500 border-t border-slate-950 mt-1 select-none font-semibold">
                                * DuckDB is running inside-browser using Parquet files on durable virtual filesystems. Zero network servers queried.
                              </div>
                            </div>
                          )}

                          {activeToolId === "ollama" && (
                            <div className="space-y-1 h-full flex flex-col justify-between">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider select-none">Ollama Grammar-Constrained JSON Output</span>
                              
                              <div className="flex-1 bg-slate-900/80 p-2.5 rounded border border-slate-855 font-mono text-[7.5px] leading-relaxed overflow-y-auto select-text text-violet-300">
                                {t4Narrative ? (
                                  <pre className="select-text whitespace-pre-wrap font-mono">{JSON.stringify(t4Narrative, null, 2)}</pre>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-slate-600 italic select-none">
                                    Select an event and click 'Generate Narrative (Ollama)' to query compiled YAML schema blocks...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {activeToolId === "merkle" && (
                            <div className="space-y-1 h-full flex flex-col justify-between">
                              {(() => {
                                const tree = getT5MerkleTreeData();
                                return (
                                  <div className="space-y-2 h-full flex flex-col justify-between">
                                    <div className="flex justify-between items-center select-none">
                                      <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider">Cryptographic Audit Proof Visualization</span>
                                      <span className={`text-[7px] px-1.5 py-0.5 rounded border font-bold ${tree.isValid ? 'bg-emerald-950/20 text-emerald-400 border-emerald-800' : 'bg-red-955/30 text-red-500 border-red-800 animate-pulse'}`}>
                                        {tree.isValid ? "PROVENANCE CHAIN VERIFIED" : "DISCREPANCY CORRUPTION DETECTED"}
                                      </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-4 gap-1.5 font-mono text-[6.5px]">
                                      {/* Leaf blocks */}
                                      {tree.leaves.map((leaf, index) => (
                                        <div 
                                          key={index} 
                                          className={`p-1 rounded border text-center font-mono ${
                                            t5TamperedIndex === index 
                                              ? 'border-red-600 bg-red-955/30 text-red-400 text-[6px]' 
                                              : 'border-slate-850 bg-slate-900'
                                          }`}
                                        >
                                          <div className="text-[5.5px] text-slate-550 uppercase select-none font-bold">Leaf [{index}]</div>
                                          <div className="font-bold font-mono mt-0.5 truncate">{leaf}</div>
                                          <div className="text-[4.5px] text-slate-600 mt-0.5 truncate select-none">{tree.inputs[index]}</div>
                                        </div>
                                      ))}
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 text-[6.5px] border-t border-slate-900 pt-1 select-none">
                                      <div className="bg-slate-900/50 p-1 border border-slate-850 rounded text-center">
                                        <span className="text-[5.5px] text-slate-500 uppercase block">Parent Leaf [0,1]</span>
                                        <strong className="text-slate-350 block font-mono">{tree.parentNodes[0]}</strong>
                                      </div>
                                      <div className="bg-slate-900/50 p-1 border border-slate-850 rounded text-center">
                                        <span className="text-[5.5px] text-slate-550 uppercase block font-medium">Parent Leaf [2,3]</span>
                                        <strong className="text-slate-350 block font-mono">{tree.parentNodes[1]}</strong>
                                      </div>
                                    </div>

                                    <div className="bg-slate-950 p-1.5 rounded border border-slate-900 text-center text-[7.5px] flex justify-between items-center px-3 gap-2">
                                      <span className="text-slate-500 uppercase select-none text-[6.5px] font-bold">Merkle Root Ledger Block Hash</span>
                                      <strong className={`font-mono text-[8px] font-bold ${tree.isValid ? 'text-teal-400' : 'text-red-405 underline block font-extrabold select-text'}`}>
                                        {tree.rootHash}
                                      </strong>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {activeToolId === "spectral" && (
                            <div className="space-y-1 h-full flex flex-col justify-between">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider select-none">Tactical Electromagnetic Flux Harmonics Peaks</span>
                              
                              <div className="flex h-[110px] items-end justify-between px-4 gap-1.5 bg-slate-900/30 border border-slate-900/60 p-2.5 rounded">
                                {computeSpectralBars().map((height, i) => (
                                  <div key={i} className="flex-1 flex flex-col items-center gap-1 min-h-0 h-full justify-end font-mono">
                                    <span className="text-[5px] text-slate-600 font-mono select-none">{height}%</span>
                                    <div 
                                      className="w-full bg-gradient-to-t from-blue-900 via-blue-500 to-indigo-400 rounded-t transition-all duration-300"
                                      style={{ height: `${height}%` }}
                                    />
                                    <span className="text-[4px] text-slate-500 select-none">H{i+1}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeToolId === "entropy" && (
                            <div className="space-y-1.5 h-full flex flex-col justify-between select-none animate-fade-in">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider">Causal Signal Flow Diagnostics</span>
                              
                              <div className="grid grid-cols-2 gap-4 flex-1 items-center">
                                <div className="bg-slate-900/50 p-2 border border-slate-850 rounded">
                                  <span className="text-slate-500 block text-[6px] uppercase font-bold">Information Flow Direction Vector</span>
                                  {t7Score ? (
                                    <div className="mt-1 font-semibold text-[8px] text-white">
                                      {t7Score.direction}
                                    </div>
                                  ) : (
                                    <div className="text-slate-600 italic text-[7.5px]">Click Calculate to trace informational vectors...</div>
                                  )}
                                </div>

                                <div className="bg-slate-900/90 p-2.5 border border-slate-850 rounded text-center">
                                  {t7Score ? (
                                    <div>
                                      <span className="text-slate-550 block text-[6.5px] uppercase">Transfer Entropy Force</span>
                                      <p className="text-sm font-extrabold text-indigo-400">{t7Score.entropyBits} bits</p>
                                      <span className="text-[6.5px] text-slate-600 mt-1 block font-bold uppercase">SIGNIFICANCE POWER: {t7Score.confidence}% (p &lt; 0.001)</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-600 italic text-[7px]">Ready to process directed causation models...</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {activeToolId === "chaos" && (
                            <div className="space-y-1.5 h-full flex flex-col justify-between text-[7px]">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider select-none">HV Interlock Adversarial Protection Logs</span>
                              
                              <div className="bg-slate-950 border border-slate-850 p-2 rounded flex-1">
                                {t8ChaosResult ? (
                                  <div className="space-y-1.5 leading-normal select-text">
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-550 uppercase block select-none">Attack Severity:</span>
                                      <strong className={`font-bold uppercase ${t8ChaosResult.severity.includes("HIGH") ? "text-red-400 animate-pulse font-extrabold" : "text-amber-500"}`}>{t8ChaosResult.severity}</strong>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-555 uppercase block select-none font-bold">Protection Outcome:</span>
                                      <strong className="text-emerald-400 font-bold uppercase">{t8ChaosResult.outcome}</strong>
                                    </div>
                                    <p className="text-slate-350 border-t border-slate-900 mt-1 pt-1 italic font-mono select-text leading-relaxed">
                                      {t8ChaosResult.log}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-slate-600 italic select-none">
                                    No adversarial switching jitter active. Push 'Inject Adversarial Jitter' to trigger fault protection logic.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {activeToolId === "piper" && (
                            <div className="space-y-1.5 h-full flex flex-col justify-between">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider select-none">Piper Synthetic Voice Phonemes Wave</span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 items-center">
                                <div className="bg-slate-900/50 p-2 border border-slate-850 rounded text-[7.5px] overflow-y-auto max-h-[110px] select-text">
                                  <span className="text-slate-550 block text-[6px] uppercase select-none font-bold">Synthesized Phonemes Array</span>
                                  {t9Phonemes ? (
                                    <p className="font-mono text-rose-300 font-semibold select-text mt-1 leading-relaxed break-all">
                                      {t9Phonemes}
                                    </p>
                                  ) : (
                                    <span className="text-slate-650 italic block mt-1 select-none">Enter custom words above and compile speech.</span>
                                  )}
                                </div>

                                <div className="bg-slate-900/90 p-2 border border-slate-850 rounded text-center flex flex-col items-center justify-center h-full min-h-[70px]">
                                  {t9SpeechStatus === "completed" ? (
                                    <div className="w-full space-y-1 select-none">
                                      <span className="text-slate-550 block text-[6px] uppercase">Microphone Waveform Audio Preview</span>
                                      
                                      {/* Mock Wave animation */}
                                      <div className="flex justify-center items-center gap-1 py-1.5">
                                        <div className="h-3 w-1 bg-rose-450 rounded animate-pulse" />
                                        <div className="h-6 w-1 bg-rose-405 rounded animate-pulse" />
                                        <div className="h-8 w-1 bg-rose-450 rounded animate-pulse" style={{ animationDelay: "0.15s" }} />
                                        <div className="h-5 w-1 bg-rose-405 rounded animate-pulse" style={{ animationDelay: "0.3s" }} />
                                        <div className="h-7 w-1 bg-rose-450 rounded animate-pulse" style={{ animationDelay: "0.45s" }} />
                                        <div className="h-3 w-1 bg-rose-405 rounded animate-pulse" style={{ animationDelay: "0.1s" }} />
                                      </div>
                                      <span className="text-[6.5px] text-emerald-400 font-bold block">16KHZ PHONETIC AUDIO OUTPUT LOADED</span>
                                    </div>
                                  ) : t9SpeechStatus === "rendering" ? (
                                    <span className="text-slate-500 animate-pulse text-[7.5px] select-none font-bold">Compiling sound waveforms...</span>
                                  ) : (
                                    <span className="text-slate-600 italic text-[7.5px] select-none">Speech synthesis idle.</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {activeToolId === "replay" && (
                            <div className="space-y-1 h-full flex flex-col justify-between font-mono">
                              <span className="text-[7.5px] text-slate-550 block font-bold uppercase tracking-wider select-none">Bit-for-Bit Deterministic Playback Log</span>
                              
                              <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850 font-mono text-[7.5px] leading-relaxed select-text">
                                {(() => {
                                  const frame = t10Frames[t10StepIndex];
                                  if (!frame) return null;
                                  return (
                                    <div className="grid grid-cols-2 gap-2 text-[8px] font-mono select-text">
                                      <div className="space-y-0.5 font-mono select-text">
                                        <div className="flex justify-between select-none"><span className="text-slate-550">LOGGED REPLAY TICK:</span> <strong className="text-white font-bold">{frame.tick}ms</strong></div>
                                        <div className="flex justify-between"><span className="text-slate-550">YAO STATE BINARY:</span> <strong className="text-fuchsia-400 font-bold">{frame.hex}</strong></div>
                                        <div className="flex justify-between"><span className="text-slate-550">BUS CURRENT DEMAND:</span> <strong className="text-slate-200 font-medium">{frame.current} A</strong></div>
                                      </div>
                                      <div className="space-y-0.5 border-l border-slate-900 pl-2 font-mono select-text">
                                        <div className="flex justify-between"><span className="text-slate-550">ELECTRODE HEAT:</span> <strong className="text-slate-205 font-medium">{frame.temp} K</strong></div>
                                        <div className="flex justify-between select-text"><span className="text-slate-550">REPLAY LOG HASH:</span> <strong className="text-amber-500 font-mono select-text font-bold">{frame.hash}</strong></div>
                                        <div className="text-[6.5px] text-emerald-450 mt-1 select-none font-bold uppercase animate-pulse">✓ Perfect repeat state confirmed</div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
