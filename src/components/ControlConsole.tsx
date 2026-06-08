/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sliders, ShieldCheck, Key, AlertTriangle, CheckCircle, HelpCircle, ArrowRight, Cpu } from "lucide-react";
import { HexagramState, HexagramStateLabels, isValidTransition, VALID_TRANSITIONS } from "../types";
import { computeKnockSignature } from "../mhdUtils";

interface ControlConsoleProps {
  currentHexagram: HexagramState;
  onCommitState: (targetState: HexagramState, isKnockOverride: boolean) => void;
  nonceCounter: number;
  onInjectKnockOverride: (targetState: HexagramState, sig0: string, sig1: string) => boolean;
  activeFaults: any;
  isAiActive: boolean;
  setIsAiActive: (val: boolean) => void;
}

export default function ControlConsole({
  currentHexagram,
  onCommitState,
  nonceCounter,
  onInjectKnockOverride,
  activeFaults,
  isAiActive,
  setIsAiActive,
}: ControlConsoleProps) {
  const [proposedState, setProposedState] = useState<HexagramState>(HexagramState.IDLE);
  const [overrideMode, setOverrideMode] = useState(false);
  const [secretKey, setSecretKey] = useState("MHD-MEMBER-SECURE-250");
  const [signatureStatus, setSignatureStatus] = useState<"idle" | "success" | "error">("idle");
  const [sigFeedback, setSigFeedback] = useState("");

  const possibleStates = [
    HexagramState.IDLE,
    HexagramState.PURGE,
    HexagramState.STEALTH,
    HexagramState.TRANSIT,
    HexagramState.TR_SALT,
    HexagramState.TR_CRIT,
    HexagramState.ST_CRIT,
    HexagramState.LIMP_MODE,
  ];

  const transitionValid = isValidTransition(currentHexagram, proposedState);

  const handleCommit = () => {
    onCommitState(proposedState, false);
  };

  const calculateAndInjectSignature = () => {
    if (!secretKey) {
      setSignatureStatus("error");
      setSigFeedback("Secret authorization key empty.");
      return;
    }

    const sigs = computeKnockSignature(nonceCounter, secretKey);
    const success = onInjectKnockOverride(proposedState, sigs.sig0, sigs.sig1);

    if (success) {
      setSignatureStatus("success");
      setSigFeedback(`Signature calculated: SIG0=0x${sigs.sig0}, SIG1=0x${sigs.sig1}. Verification passed!`);
      // Automatically advance nonce after success
    } else {
      setSignatureStatus("error");
      setSigFeedback("Signature validation rejected by FPGA AXI verification block!");
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans relative" id="control-console-card">
      <div className="absolute top-3 right-3 text-[9px] font-mono font-bold text-slate-500 flex items-center gap-1">
        <Sliders className="h-3 w-3 text-emerald-500 animate-pulse" /> AXI4_LITE_SLAVE
      </div>

      <h3 className="text-sm font-display font-medium text-slate-200 tracking-wide pb-3 border-b border-slate-800 mb-4 uppercase">
        AXI4-Lite register controller
      </h3>

      {/* AI Autopilot vs. Human Manual Switch Tab Controller */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg mb-5 font-mono text-[10.5px] space-y-3 shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-950 pb-2.5">
          <div>
            <span className="block text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">Active Controller Allocation Protocol</span>
            <span className="text-slate-300 font-bold block mt-0.5 uppercase tracking-wide">
              {isAiActive ? "⚡ AUTOMATED CO-PROCESSOR DIRECTIVE ACTIVE" : "⚙️ HUMAN-IN-THE-LOOP RECTIFIER CALIBRATION"}
            </span>
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase border ${
            isAiActive 
              ? "bg-amber-950/60 text-amber-400 border-amber-900/50 animate-pulse" 
              : "bg-cyan-950/60 text-cyan-400 border-cyan-900/50"
          }`}>
            {isAiActive ? "AI DECISION TRAJECTORY" : "MANUAL SEQUENCING ENFORCED"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-850 rounded-lg">
          <button
            type="button"
            id="switch-mode-human"
            onClick={() => setIsAiActive(false)}
            className={`py-2 text-[10px] font-mono rounded font-bold cursor-pointer transition flex items-center justify-center gap-1.5 border uppercase ${
              !isAiActive 
                ? "bg-cyan-950 text-cyan-450 border-cyan-900 shadow-[0_0_8px_rgba(34,211,238,0.15)] font-extrabold" 
                : "text-slate-500 hover:text-slate-350 bg-transparent border-transparent"
            }`}
          >
            <Sliders className="h-3 w-3 shrink-0" />
            HUMAN MANUAL (BYPASS)
          </button>
          <button
            type="button"
            id="switch-mode-ai"
            onClick={() => setIsAiActive(true)}
            className={`py-2 text-[10px] font-mono rounded font-bold cursor-pointer transition flex items-center justify-center gap-1.5 border uppercase ${
              isAiActive 
                ? "bg-amber-950 text-amber-450 border-amber-900 shadow-[0_0_8px_rgba(245,158,11,0.15)] font-extrabold" 
                : "text-slate-500 hover:text-slate-350 bg-transparent border-transparent"
            }`}
          >
            <Cpu className="h-3 w-3 shrink-0 animate-pulse" />
            AI NEURAL AUTOPILOT
          </button>
        </div>

        <p className="text-[9px] text-slate-450 leading-relaxed italic">
          {isAiActive 
            ? "Autopilot loops read Taylor polynomial estimators periodically to commit pre-calculated transition keys automatically. Manual override inputs are gated for safety."
            : "Direct register writes are armed. Trigger overrides using secret authorization knocks or sequence target options directly below."
          }
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Left Column: Standard Sequential Path Proposer */}
        <div className="md:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wide">
                PROPOSE STATE PATHWAY
              </span>
              <span className="text-[9px] font-mono text-slate-500 italic">
                From: {HexagramStateLabels[currentHexagram].split(" (")[0]}
              </span>
            </div>

            {/* Custom Interactive Radio Grid of States */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {possibleStates.map((state) => {
                const isCurrent = state === currentHexagram;
                const isSelected = state === proposedState;
                const pathOk = isValidTransition(currentHexagram, state);
                
                return (
                  <button
                    key={state}
                    onClick={() => {
                      setProposedState(state);
                      setSignatureStatus("idle");
                    }}
                    className={`p-2.5 rounded text-left font-mono text-[10px] border relative transition ${
                      isSelected
                        ? "bg-slate-900 border-emerald-500 text-slate-100 font-bold"
                        : isCurrent
                        ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-400"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-300"
                    }`}
                  >
                    <div className="text-[9px] text-slate-500 truncate">
                      YAO {state.toString(2).padStart(6, "0")}
                    </div>
                    <div className="font-bold truncate mt-0.5">
                      {HexagramStateLabels[state].split(" (")[0]}
                    </div>

                    {/* Left Mini Border Indicator */}
                    {isCurrent && (
                      <span className="absolute bottom-1 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" title="Active State" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Path validation result panel */}
            <div className="mb-4">
              {currentHexagram === proposedState ? (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-[10px] font-mono text-slate-400 flex items-center gap-1.5 leading-snug">
                  <CheckCircle className="h-4 w-4 text-slate-500 shrink-0" />
                  <span>The controller is already steady at {HexagramStateLabels[proposedState]}. No transition required.</span>
                </div>
              ) : transitionValid ? (
                <div className="p-3 bg-emerald-950/25 border border-emerald-950 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5 leading-snug leading-normal">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>VALID STATE TRANSITION:</strong> Approved by sparse pathways rules. This trajectory is safe.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-red-950/20 border border-red-950/60 rounded text-[10px] font-mono text-red-400 flex items-start gap-1.5 leading-normal">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-red-300 font-bold">SPARSE TRANSITION EXCEPTION:</strong>
                    Direct trajectory requested is INVALID! Forcing this commits a <strong>Bit-0 Invalid Transition Fault</strong>. Needs AXI Knock-Lock cryptographic override!
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sequential Commit Action button */}
          <button
            onClick={handleCommit}
            disabled={isAiActive || overrideMode || currentHexagram === proposedState}
            className={`w-full py-2.5 px-4 font-mono text-[11px] font-bold rounded-md flex items-center justify-center gap-1.5 shadow active:scale-[98%] transition ${
              isAiActive
                ? "bg-amber-950/40 border border-amber-800 text-amber-500 cursor-not-allowed"
                : overrideMode
                ? "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed"
                : currentHexagram === proposedState
                ? "bg-slate-900 border border-slate-800/40 text-slate-500 cursor-not-allowed"
                : transitionValid
                ? "bg-emerald-600 hover:bg-emerald-500 text-slate-100 cursor-pointer"
                : "bg-amber-600 hover:bg-amber-500 text-slate-100 cursor-pointer"
            }`}
          >
            <span>{isAiActive ? "AI AUTOPILOT DIRECTIVE MODE" : "COMMIT PROPOSED TRANSITION"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Right Column: Knock-Lock Cryptographic Override Shield */}
        <div className="md:col-span-6 bg-slate-900 border border-slate-850 rounded-lg p-4 flex flex-col justify-between relative overflow-hidden">
          
          <div>
            {/* Override Mode Toggle */}
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800 mb-3 select-none">
              <span className="text-[10px] text-slate-200 font-mono font-bold flex items-center gap-1">
                <Key className="h-3.5 w-3.5 text-amber-500" />
                KNOCK-LOCK SECURITY OVERRIDE
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideMode}
                  onChange={(e) => {
                    setOverrideMode(e.target.checked);
                    setSignatureStatus("idle");
                  }}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-slate-950 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-550 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500 border border-slate-800" />
                <span className="ml-1 text-[9px] font-mono text-slate-400">ENABLE Override</span>
              </label>
            </div>

            {/* Instruction layout inside the Shield */}
            {!overrideMode ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-6 select-none leading-relaxed">
                <ShieldCheck className="h-10 w-10 text-slate-700 mb-2" />
                <div className="text-[11px] font-mono font-bold text-slate-400">KNOCK SIGNATURE ENGINE STANDBY</div>
                <p className="text-[10px] text-slate-500 max-w-[210px] mt-1">
                  Turn on <strong>ENABLE Override</strong> to simulate dynamic nonce verification for unauthorized transitions.
                </p>
              </div>
            ) : (
              <div className="space-y-3 font-mono text-[10px]">
                {/* Visual Nonce Meter Row */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-850 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[8px] uppercase">FPGA DYNAMIC NONCE</span>
                    <span className="text-amber-500 text-xs font-bold leading-none mt-1">
                      {nonceCounter} (0x{nonceCounter.toString(16).toUpperCase().padStart(8,"0")})
                    </span>
                  </div>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-900 rounded animate-pulse">
                    REPLAY GUARDED
                  </span>
                </div>

                {/* Secure Key Inputs */}
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 block font-bold">SECURE INTERLOCK KEY (PS SIDE):</label>
                  <input
                    type="text"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-[10px] font-mono focus:border-amber-500 outline-none text-slate-200"
                    placeholder="Enter authentication key string..."
                  />
                </div>

                {/* Signature calculations block layout */}
                <div className="p-2.5 bg-slate-950 rounded border border-slate-850 space-y-1 select-none">
                  <div className="text-[8px] text-slate-500">CALCULATED DOUBLE-WORD CORES</div>
                  <div className="flex justify-between font-mono text-[9px] text-slate-400">
                    <span>
                      SIG0: <strong className="text-slate-300">0x{computeKnockSignature(nonceCounter, secretKey).sig0}</strong>
                    </span>
                    <span>
                      SIG1: <strong className="text-slate-300">0x{computeKnockSignature(nonceCounter, secretKey).sig1}</strong>
                    </span>
                  </div>
                </div>

                {/* Signature Response Status Indicator */}
                {signatureStatus !== "idle" && (
                  <div className={`p-2 rounded text-[9px] leading-normal ${
                    signatureStatus === "success"
                      ? "bg-emerald-950/30 text-emerald-400 border border-emerald-950"
                      : "bg-red-950/30 text-red-400 border border-red-950"
                  }`}>
                    {sigFeedback}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Commit Override button */}
          {overrideMode && (
            <button
              onClick={calculateAndInjectSignature}
              className="w-full mt-4 py-2 px-4 bg-amber-600 hover:bg-amber-500 text-slate-100 font-mono text-[10px] font-bold rounded flex items-center justify-center gap-1 active:scale-[98%] transition"
            >
              <Key className="h-3 w-3" />
              <span>AUTHENTICATE & COMMIT TR_OVERRIDE</span>
            </button>
          )}

        </div>

      </div>

    </div>
  );
}
