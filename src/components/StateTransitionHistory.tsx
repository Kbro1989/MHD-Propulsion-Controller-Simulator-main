/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  History, 
  ArrowRight, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Activity, 
  ShieldAlert, 
  Cpu, 
  Key, 
  Zap, 
  Clock,
  Heart,
  FileJson,
  Plus
} from "lucide-react";
import { HexagramState, HexagramStateLabels, StateTransition } from "../types";

interface StateTransitionHistoryProps {
  transitionHistory: StateTransition[];
  onClearHistory: () => void;
}

export default function StateTransitionHistory({
  transitionHistory,
  onClearHistory
}: StateTransitionHistoryProps) {
  const [filterMethod, setFilterMethod] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy full log as JSON
  const handleCopyAll = () => {
    try {
      const dataStr = JSON.stringify(transitionHistory, null, 2);
      navigator.clipboard.writeText(dataStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy transition logs", err);
    }
  };

  // Copy single transition detail
  const handleCopySingle = (t: StateTransition) => {
    try {
      const text = `TICK #${t.tick} | ${t.timestamp} | ${t.method}\nTransition: ${HexagramStateLabels[t.fromState]} -> ${HexagramStateLabels[t.toState]}\nTrigger: ${t.trigger}\nSnapshot: Temp=${t.snapshot.temp.toFixed(1)}K, Pres=${t.snapshot.pressure.toFixed(2)}atm, Current=${t.snapshot.current}A, Faults=[${t.snapshot.faults.join(", ")}]`;
      navigator.clipboard.writeText(text);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper colors for state transition method badges
  const getMethodBadgeClass = (method: StateTransition["method"]) => {
    switch (method) {
      case "AUTOMATED_AI":
        return "bg-indigo-950/40 text-indigo-400 border border-indigo-900/60";
      case "MANUAL_COMMIT":
        return "bg-slate-900 text-slate-400 border border-slate-800";
      case "SECURE_OVERRIDE_KNOCK":
        return "bg-amber-955/40 text-amber-400 border border-amber-900/40";
      case "IMU_DECOHERENCE_SPIKE":
        return "bg-orange-950/45 text-orange-400 border border-orange-800/50 animate-pulse";
      case "TIMEOUT_EXCEEDED":
        return "bg-yellow-950/40 text-yellow-500 border border-yellow-905/50";
      case "CRITICAL_FAULT_SHUTDOWN":
        return "bg-red-950/50 text-red-405 border border-red-900/60 shadow-[0_0_8px_rgba(239,68,68,0.1)] animate-pulse";
      case "INITIALIZATION":
        return "bg-emerald-950/40 text-emerald-400 border border-emerald-900/60";
      case "RESET":
        return "bg-cyan-950/40 text-cyan-400 border border-cyan-900";
      default:
        return "bg-slate-900 text-slate-500 border border-slate-850";
    }
  };

  // Helper colors for the target hexagram state
  const getStateColorClass = (state: HexagramState) => {
    switch (state) {
      case HexagramState.LIMP_MODE:
        return "text-purple-400 border border-purple-900/50 bg-purple-950/20";
      case HexagramState.TR_CRIT:
      case HexagramState.ST_CRIT:
        return "text-red-400 border border-red-900/50 bg-red-950/25";
      case HexagramState.TR_SALT:
        return "text-cyan-400 border border-cyan-900/50 bg-cyan-950/20";
      case HexagramState.TRANSIT:
        return "text-emerald-400 border border-emerald-900/50 bg-emerald-950/20";
      case HexagramState.STEALTH:
        return "text-blue-400 border border-blue-900/50 bg-blue-950/20";
      case HexagramState.PURGE:
        return "text-pink-400 border border-pink-900/50 bg-pink-950/20";
      case HexagramState.IDLE:
      default:
        return "text-slate-400 border border-slate-800 bg-slate-900/40";
    }
  };

  // Filter & Search handling
  const filteredTransitions = transitionHistory.filter((t) => {
    // 1. Filter by transition type method
    if (filterMethod !== "ALL" && t.method !== filterMethod) {
      return false;
    }

    // 2. Search search text in state name or trigger message
    if (searchTerm.trim() !== "") {
      const lSearch = searchTerm.toLowerCase();
      const fromName = HexagramStateLabels[t.fromState].toLowerCase();
      const toName = HexagramStateLabels[t.toState].toLowerCase();
      const msg = t.trigger.toLowerCase();
      if (!fromName.includes(lSearch) && !toName.includes(lSearch) && !msg.includes(lSearch)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans mb-5 relative" id="state-transition-history-card">
      {/* Visual glowing background mark */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none select-none">
        <History className="w-40 h-40 text-indigo-400" />
      </div>

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-850 mb-4 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
              SYSTEM STATE TRANSITION HISTORY & AUDIT LOG
            </h2>
          </div>
          <p className="text-[10px] uppercase font-mono text-slate-500 mt-1 leading-normal leading-relaxed">
            FPGA Core Registry Auditor • Maximum depth: last 20 transition cycles
          </p>
        </div>

        {/* Copy / Export and Clear controls */}
        <div className="flex items-center gap-2 select-none font-mono">
          <button
            onClick={handleCopyAll}
            disabled={transitionHistory.length === 0}
            className={`px-3 py-1 text-[9px] font-bold rounded border uppercase flex items-center gap-1.5 transition ${
              transitionHistory.length === 0 
                ? "bg-slate-900/40 text-slate-600 border-slate-900/60 cursor-not-allowed"
                : "bg-slate-900 text-slate-350 border-slate-800 hover:border-slate-700 hover:text-slate-100"
            }`}
            title="Download full audit stream in JSON format"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">COPIED JSON!</span>
              </>
            ) : (
              <>
                <FileJson className="h-3 w-3 text-indigo-400" />
                <span>COPY AUDIT JSON</span>
              </>
            )}
          </button>
          <button
            onClick={onClearHistory}
            disabled={transitionHistory.length === 0}
            className={`px-3 py-1 text-[9px] font-bold rounded border uppercase flex items-center gap-1.5 transition ${
              transitionHistory.length === 0
                ? "bg-slate-900/40 text-slate-600 border-slate-900/60 cursor-not-allowed"
                : "bg-red-950/20 text-red-400 border-red-900/55 hover:bg-red-950/40 hover:border-red-800"
            }`}
          >
            <Trash2 className="h-3 w-3" />
            <span>CLEAR ENGINE</span>
          </button>
        </div>
      </div>

      {/* Filter Options Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 mb-4 select-none font-mono">
        {/* Search query box */}
        <div className="md:col-span-4 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-slate-550" />
          </span>
          <input
            type="text"
            className="w-full bg-slate-900 border border-slate-850 hover:border-slate-800 focus:border-indigo-600 focus:outline-none rounded pl-9 pr-3 py-1.5 text-slate-200 text-[10px] uppercase font-bold"
            placeholder="Search state name, log..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter category pills */}
        <div className="md:col-span-8 flex flex-wrap gap-1.5 items-center justify-start md:justify-end">
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider select-none pr-1.5">
            FILTER BY METHOD:
          </span>
          {[
            { id: "ALL", label: "ALL" },
            { id: "AUTOMATED_AI", label: "AI PILOT" },
            { id: "MANUAL_COMMIT", label: "MANUAL" },
            { id: "SECURE_OVERRIDE_KNOCK", label: "KNOCK OK" },
            { id: "CRITICAL_FAULT_SHUTDOWN", label: "SHUTDOWN" },
            { id: "IMU_DECOHERENCE_SPIKE", label: "SENSOR SPIKE" },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setFilterMethod(type.id)}
              className={`px-2 py-1 rounded text-[8.5px] border font-bold uppercase tracking-wide transition ${
                filterMethod === type.id
                  ? "bg-indigo-950/60 border-indigo-700 text-indigo-300 font-extrabold"
                  : "bg-slate-900/50 text-slate-500 border-slate-850 hover:border-slate-800 hover:text-slate-400"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transitions Log Stream Panel */}
      <div className="bg-slate-900/20 border border-slate-850 rounded overflow-hidden select-all selection:bg-indigo-900">
        <div className="overflow-y-auto max-h-[380px] p-2 space-y-2 font-mono scrollbar-thin">
          {filteredTransitions.length === 0 ? (
            <div className="py-12 text-center space-y-1.5">
              <History className="h-8 w-8 text-slate-700 mx-auto animate-pulse" />
              <span className="text-slate-600 italic text-[10px] block font-mono">
                {transitionHistory.length === 0 
                  ? "Audit log initialized. Ready to record sub-system state machine events."
                  : "No state change events match active filtering profiles."}
              </span>
            </div>
          ) : (
            filteredTransitions.map((t) => (
              <div 
                key={t.id} 
                className="bg-slate-950/85 border border-slate-850 hover:border-slate-800 rounded p-3 text-[10px] transition duration-150 space-y-2 relative group"
              >
                {/* Individual copy button */}
                <button
                  onClick={() => handleCopySingle(t)}
                  className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
                  title="Copy transition summary to clipboard"
                >
                  {copiedId === t.id ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>

                {/* Grid header row */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-900/60 pb-1.5">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-[10px] font-extrabold text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-900/40">
                      TICK #{t.tick}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-600" />
                      {t.timestamp}
                    </span>
                  </div>

                  {/* Method Pill Badge */}
                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${getMethodBadgeClass(t.method)}`}>
                    {t.method.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Transition State Flow representation */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-[8px] text-slate-550 uppercase">TRAJECTORY CHANGE:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStateColorClass(t.fromState)}`}>
                      {HexagramStateLabels[t.fromState] || t.fromState}
                    </span>
                    <ArrowRight className="h-3 w-3 text-slate-650" />
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStateColorClass(t.toState)}`}>
                      {HexagramStateLabels[t.toState] || t.toState}
                    </span>
                  </div>
                </div>

                {/* Triggering action logs */}
                <div className="text-[9px] text-slate-400 bg-slate-900/30 border border-slate-900/60 p-2 rounded leading-snug">
                  <strong className="text-slate-500 uppercase font-mono mr-1">TRIGGER SEQUENCE:</strong>
                  {t.trigger}
                </div>

                {/* Physical sensor snapshot fields */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5 text-[8.5px] uppercase select-none">
                  <div className="bg-slate-900/40 border border-slate-900/60 rounded px-2 py-1">
                    <span className="text-slate-550 block text-[7.5px]">TEMPERATURE:</span>
                    <strong className="text-slate-300 font-extrabold">{t.snapshot.temp.toFixed(1)} K</strong>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900/60 rounded px-2 py-1">
                    <span className="text-slate-550 block text-[7.5px]">PRESSURE:</span>
                    <strong className="text-slate-300 font-extrabold">{t.snapshot.pressure.toFixed(2)} atm</strong>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900/60 rounded px-2 py-1">
                    <span className="text-slate-550 block text-[7.5px]">BUS CURRENT:</span>
                    <strong className="text-cyan-400 font-extrabold">{t.snapshot.current} A</strong>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900/60 rounded px-2 py-1 col-span-1">
                    <span className="text-slate-550 block text-[7.5px]">ACTIVE ALARMS:</span>
                    <div className="flex gap-1 flex-wrap mt-[1px]">
                      {t.snapshot.faults.length === 0 ? (
                        <strong className="text-emerald-400 font-bold">NOMINAL</strong>
                      ) : (
                        t.snapshot.faults.map((code) => (
                          <span 
                            key={code} 
                            className="bg-red-950/50 text-red-400 border border-red-900/50 text-[7px] font-extrabold px-1 rounded"
                            title="Active fault on transition commit"
                          >
                            {code}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer statistics bar */}
      {transitionHistory.length > 0 && (
        <div className="mt-3 text-[8.5px] text-slate-500 flex flex-wrap justify-between items-center font-mono select-none">
          <span>COMPILED LOG DENSITY: <strong className="text-slate-350">{transitionHistory.length} EVENTS</strong></span>
          <span>SYSTEM LOCKSTATUS: <strong className="text-emerald-400">UNRESTRICTED AUDITS COMMITTED</strong></span>
        </div>
      )}
    </div>
  );
}
