/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { GhostTrainingLimb, GhostTrainingLimbState } from "../utils/GhostTrainingLimb";
import { Cpu, Zap, CheckCircle2, Play, AlertCircle, RefreshCw, Terminal, Wrench, ShieldAlert } from "lucide-react";

interface NodeStatus {
  id: string;
  name: string;
  address: string;
  status: "NOMINAL" | "FAULTY" | "RECOVERING" | "IDLE";
  latency: number;
}

export default function AIPedagogyStatus() {
  const ghostLimb = GhostTrainingLimb.getInstance();
  const [ghostState, setGhostState] = useState<GhostTrainingLimbState>(ghostLimb.getState());

  useEffect(() => {
    const handleStateChange = (updatedState: GhostTrainingLimbState) => {
      setGhostState(updatedState);
    };
    ghostLimb.registerListener(handleStateChange);
    return () => ghostLimb.unregisterListener(handleStateChange);
  }, []);

  const isCompiling = ghostState.isCompilingOllama;
  const progress = ghostState.compileProgress;

  // ===========================================================================
  // SWITCHBOARD & NODE TESTER STATE
  // ===========================================================================
  const [nodes, setNodes] = useState<NodeStatus[]>([
    { id: "coproc_01", name: "COPROCESSOR_CORE_0X01", address: "0x43C00088", status: "NOMINAL", latency: 12 },
    { id: "zynq_axi_02", name: "ZYNQ_AXI_BUS_INTERFACE", address: "0x43C00094", status: "NOMINAL", latency: 5 },
    { id: "ollama_ped_03", name: "OLLAMA_PEDAGOGY_CORE", address: "0x43C000B0", status: "NOMINAL", latency: 145 },
    { id: "vhdl_traj_04", name: "VHDL_TRAJECTORY_ALIGNER", address: "0x43C000C8", status: "FAULTY", latency: 999 }
  ]);

  const [testerStatus, setTesterStatus] = useState<"READY" | "DIAGNOSING" | "FAULT_DETECTED" | "HEALING" | "RECOVERED">("FAULT_DETECTED");
  const [testerLogs, setTesterLogs] = useState<string[]>([
    "[node-tester] Diagnostic supervisor online (PID: 3482).",
    "[node-tester] Mismatch caught on register 0x43C000C8: Calibration drift detected.",
    "[switchboard] Node [VHDL_TRAJECTORY_ALIGNER] entered emergency fault loop."
  ]);

  useEffect(() => {
    (window as any).getNodeHealth = () => {
      const summary = nodes.every(n => n.status === "NOMINAL") ? "NOMINAL" : "DEGRADED";
      return {
        timestamp: new Date().toISOString(),
        testerStatus: testerStatus,
        nodes: nodes.map(n => ({
          nodeId: n.id,
          name: n.name,
          address: n.address,
          status: n.status,
          latency: n.latency,
          healthScore: n.status === "NOMINAL" ? 100 : n.status === "RECOVERING" ? 50 : 0
        })),
        systemSummary: summary
      };
    };
    return () => {
      delete (window as any).getNodeHealth;
    };
  }, [nodes, testerStatus]);

  // Run Health Check
  const runHealthCheck = () => {
    if (testerStatus === "DIAGNOSING" || testerStatus === "HEALING") return;
    setTesterStatus("DIAGNOSING");
    setTesterLogs(prev => ["[node-tester] Initiating complete switchboard hardware health scan...", ...prev]);

    // Simulate probing nodes
    setTimeout(() => {
      setNodes(prev => prev.map(n => {
        if (n.id === "vhdl_traj_04") {
          // If already healed once, keep it nominal, otherwise keep/turn faulty
          return { ...n, status: n.status === "NOMINAL" ? "NOMINAL" : "FAULTY" };
        }
        return { ...n, latency: Math.floor(Math.random() * 20) + 4 };
      }));

      const isStillFaulty = nodes.some(n => n.status === "FAULTY");
      if (isStillFaulty) {
        setTesterStatus("FAULT_DETECTED");
        setTesterLogs(prev => [
          "[node-tester] Probe finished. Critical discrepancy found in sub-register 0x43C000C8.",
          "[node-tester] Recommendation: Execute immediate Shell Aligner Heal cycle.",
          ...prev
        ]);
      } else {
        setTesterStatus("RECOVERED");
        setTesterLogs(prev => [
          "[node-tester] Diagnostic probe finished: All 4 hardware logic gates aligned (100% nominal).",
          ...prev
        ]);
      }
    }, 1800);
  };

  // Heal Node Shell Operations
  const triggerHealNode = () => {
    if (testerStatus === "HEALING") return;
    setTesterStatus("HEALING");
    
    // Animate nodes resolving
    setNodes(prev => prev.map(n => {
      if (n.id === "vhdl_traj_04") return { ...n, status: "RECOVERING" };
      return n;
    }));

    const healSteps = [
      { delay: 400, log: "[shell] ssh root@node-ollama 'sh /memory/check_symmetry_lock.sh'" },
      { delay: 800, log: "[shell] Warning: Clock phase bias mismatch (4.2deg). Deploying realign compiler to dev/axi/02..." },
      { delay: 1300, log: "[shell] sudo npx -y tsx /memory/reset_axis_boundaries.ts --force" },
      { delay: 1800, log: "[shell] Executed alignment rewrite: Flashing recover logic sector into block RAM..." },
      { delay: 2400, log: "[shell] Clear CDC transmission fault queue: status=0" },
      { delay: 2900, log: "[node-tester] SUCCESS: VHDL_TRAJECTORY_ALIGNER calibration re-zeroed!" }
    ];

    healSteps.forEach(step => {
      setTimeout(() => {
        setTesterLogs(prev => [step.log, ...prev]);
      }, step.delay);
    });

    // Complete heal process
    setTimeout(() => {
      setNodes(prev => prev.map(n => {
        if (n.id === "vhdl_traj_04") return { ...n, status: "NOMINAL", latency: 8 };
        return n;
      }));
      setTesterStatus("RECOVERED");
      setTesterLogs(prev => [
        "[switchboard] Node [VHDL_TRAJECTORY_ALIGNER] marked NOMINAL.",
        "[node-tester] Switchboard fully integrated and operational. 0 error frames found.",
        ...prev
      ]);
    }, 3200);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="ai-pedagogy-and-switchboard-container">
      
      {/* LEFT COMPONENT: AIPedagogyStatus Build Progress */}
      <div className="bg-slate-900 border border-slate-850 rounded-lg p-5 font-mono text-[11px] text-slate-300 shadow-xl flex flex-col justify-between" id="ai-pedagogy-status-subpanel">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800/60 mb-5 gap-3">
            <div className="flex items-center gap-2.5">
              <Cpu className={`h-4.5 w-4.5 text-cyan-400 ${isCompiling ? "animate-spin" : ""}`} />
              <div>
                <span className="text-[11px] text-slate-200 font-bold block uppercase tracking-wider">
                  VHDL Pedagogy compilation & Real-time Ollama Linker
                </span>
                <span className="text-[8.5px] text-slate-550 lowercase block">
                  compiler core: ollama create pog2-pedagogy
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-bold border ${
                isCompiling 
                  ? "bg-amber-955/65 text-amber-400 border-amber-900/60 animate-pulse" 
                  : "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isCompiling ? "bg-amber-400 animate-ping" : "bg-emerald-500"}`} />
                {isCompiling ? "OLLAMA COMPILING..." : "STANDBY"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Progress bar container */}
            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span>Ollama Image Creation Status:</span>
                  <strong className="text-cyan-455 font-bold">pog2-pedagogy:latest</strong>
                </span>
                <span className="text-cyan-400 font-extrabold">{progress}%</span>
              </div>

              <div className="w-full h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden flex relative shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
                {progress > 0 && (
                  <div
                    style={{ width: `${progress}%` }}
                    className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 h-full transition-all duration-300 relative"
                  />
                )}
              </div>

              <div className="flex justify-between items-center text-[8.5px] text-slate-500 pt-1">
                <span>FROM gemma4:26b base</span>
                <span className="text-slate-405 uppercase italic animate-pulse font-bold">
                  {isCompiling ? "Compiling Modelfile..." : (progress === 100 ? "✓ Synthesis successful" : "Idling at baseline state")}
                </span>
                <span>{ghostState.corpusLineCount} instruction records</span>
              </div>
            </div>

            {/* In-progress compilation log feed */}
            <div className="bg-slate-950 border border-slate-850 rounded p-3 text-[9px] text-slate-450 space-y-2">
              <span className="text-slate-500 block font-bold border-b border-slate-900 pb-1 uppercase tracking-wider leading-none select-none">
                Pedagogy Compiler Output stream
              </span>
              <div className="max-h-[92px] min-h-[92px] overflow-y-auto space-y-1 text-slate-350 font-mono text-[8.5px] leading-relaxed">
                {ghostState.trainingLogs.slice(0, 5).map((log, idx) => (
                  <div 
                    key={idx} 
                    className={
                      log.includes("[compiler]") || log.includes("[GhostTrainingLimb]")
                        ? "text-cyan-400 select-all" 
                        : log.includes("successfully") 
                        ? "text-emerald-400 font-bold" 
                        : "text-slate-450"
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-850 flex justify-between items-center text-[9px] text-slate-500 uppercase select-none mt-4">
          <span>Ollama Engine: Online</span>
          <span>Baud Rate: Direct SRAM Bus</span>
        </div>
      </div>

      {/* RIGHT COMPONENT: Cybernetic Switchboard & Node-Tester Diagnostic Sub-station */}
      <div className="bg-slate-900 border border-slate-850 rounded-lg p-5 font-mono text-[11px] text-slate-300 shadow-xl flex flex-col justify-between" id="switchboard-node-tester-subpanel">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800/60 mb-5 gap-3">
            <div className="flex items-center gap-2.5">
              <Terminal className="h-4.5 w-4.5 text-violet-400" />
              <div>
                <span className="text-[11px] text-slate-200 font-bold block uppercase tracking-wider">
                  Switchboard Integration & Node Tester
                </span>
                <span className="text-[8.5px] text-slate-550 lowercase block">
                  real-time register level health diagnostics & heal procedures
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-sans font-semibold">
              <span className={`px-2 py-0.5 rounded text-[8.5px] border ${
                testerStatus === "RECOVERED"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                  : testerStatus === "DIAGNOSING" || testerStatus === "HEALING"
                  ? "bg-indigo-950/40 text-indigo-400 border-indigo-900/60 animate-pulse"
                  : "bg-rose-950/40 text-rose-400 border-rose-900/60 animate-pulse"
              }`}>
                {testerStatus}
              </span>
            </div>
          </div>

          {/* Switchboard hardware Node Array */}
          <div className="space-y-3">
            <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wide">
              INTEGRATION CONSOLE GRID:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              {nodes.map(node => (
                <div 
                  key={node.id} 
                  className={`p-2.5 rounded border flex flex-col justify-between gap-1 transition ${
                    node.status === "FAULTY"
                      ? "bg-rose-955/25 border-rose-800/40"
                      : node.status === "RECOVERING"
                      ? "bg-indigo-955/25 border-indigo-800/45 animate-pulse"
                      : "bg-slate-950 border-slate-850 hover:border-slate-800"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-bold truncate pr-1" title={node.name}>{node.name}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      node.status === "FAULTY"
                        ? "bg-red-500 animate-ping"
                        : node.status === "RECOVERING"
                        ? "bg-indigo-400 animate-pulse"
                        : "bg-emerald-500"
                    }`} />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-500 uppercase font-mono">
                    <span>ADDR: {node.address}</span>
                    <span className={node.status === "FAULTY" ? "text-red-400 font-bold" : "text-cyan-450"}>
                      {node.status === "FAULTY" ? "FAULT" : node.status === "RECOVERING" ? "HEALING" : `${node.latency}ms`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Console Terminal Logs */}
            <div className="space-y-1.5 mt-3">
              <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wide">
                DIAGNOSTIC TESTER MONITOR:
              </span>
              <div className="bg-slate-950 border border-slate-850 rounded p-2.5 font-mono text-[8.5px] text-slate-300 h-[86px] overflow-y-auto space-y-1 leading-snug">
                {testerLogs.slice(0, 5).map((log, idx) => (
                  <div 
                    key={idx} 
                    className={
                      log.includes("[shell]") 
                        ? "text-yellow-450 select-text" 
                        : log.includes("SUCCESS") || log.includes("RECOVERED")
                        ? "text-emerald-450 font-bold select-all" 
                        : "text-slate-450"
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons Segment */}
        <div className="pt-4 border-t border-slate-850/80 flex items-center justify-between gap-3 mt-4">
          <button
            onClick={runHealthCheck}
            disabled={testerStatus === "DIAGNOSING" || testerStatus === "HEALING"}
            className="flex-1 py-1 px-2.5 font-bold uppercase rounded border text-[9px] bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-350 hover:text-slate-100 transition cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${testerStatus === "DIAGNOSING" ? "animate-spin" : ""}`} />
            <span>Run Health Check</span>
          </button>

          <button
            onClick={triggerHealNode}
            disabled={testerStatus === "HEALING" || nodes.every(n => n.status === "NOMINAL")}
            className="flex-1 py-1 px-2.5 font-bold uppercase rounded border text-[9px] bg-indigo-950/30 hover:bg-indigo-950/60 border-indigo-850 hover:border-indigo-500 text-indigo-400 hover:text-indigo-200 transition cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            title="Attempts to fix corrupted registers via SSH execution and block RAM flashes"
          >
            <Wrench className="h-3 w-3" />
            <span>{testerStatus === "HEALING" ? "HEALING REGISTRY..." : "HEAL (SHELL CODE)"}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
