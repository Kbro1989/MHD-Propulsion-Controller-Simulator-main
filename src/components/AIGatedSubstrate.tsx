/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Shield, 
  Zap, 
  Activity, 
  Target, 
  Binary, 
  Key, 
  HelpCircle, 
  Play, 
  Pause, 
  Compass, 
  Flame, 
  RotateCcw,
  RefreshCw,
  Cpu,
  Lock,
  Unlock,
  AlertTriangle,
  Award
} from "lucide-react";
import { HexagramState, HexagramStateLabels } from "../types";

// Authentic OpenRSC data/ranged references and prayer indexes
const PRAYER_BONUSES = {
  0: { name: "Thick Skin", skill: "defense", multiplier: 1.05 },
  1: { name: "Burst of Strength", skill: "strength", multiplier: 1.05 },
  2: { name: "Clarity of Thought", skill: "attack", multiplier: 1.05 },
  3: { name: "Rock Skin", skill: "defense", multiplier: 1.10 },
  4: { name: "Superhuman Strength", skill: "strength", multiplier: 1.10 },
  5: { name: "Improved Reflexes", skill: "attack", multiplier: 1.10 },
  9: { name: "Steel Skin", skill: "defense", multiplier: 1.15 },
  10: { name: "Ultimate Strength", skill: "strength", multiplier: 1.15 },
  11: { name: "Incredible Reflexes", skill: "attack", multiplier: 1.15 }
};

interface AIGatedSubstrateProps {
  currentHexagram: HexagramState;
  plenumPressure: number;
  avgElectrodeTemp: number;
  busCurrentA: number;
  symmetryOk: boolean;
  activeFaultCodes: string[];
}

export default function AIGatedSubstrate({
  currentHexagram,
  plenumPressure,
  avgElectrodeTemp,
  busCurrentA,
  symmetryOk,
  activeFaultCodes
}: AIGatedSubstrateProps) {
  // RSC calculation states
  const [combatStyle, setCombatStyle] = useState<number>(0); // 0=Controlled, 1=Aggressive, 2=Accurate, 3=Defensive
  const [equipmentWeaponAim, setEquipmentWeaponAim] = useState<number>(45); // weapon bonus
  const [equipmentWeaponPower, setEquipmentWeaponPower] = useState<number>(55); // strength bonus
  const [equipmentArmourPoints, setEquipmentArmourPoints] = useState<number>(60); // armor bonus

  // Dynamic adversary attributes (Vortex Wave)
  const [adversaryLevel, setAdversaryLevel] = useState<number>(40);
  const [adversaryHealth, setAdversaryHealth] = useState<number>(100);
  const [droneHealth, setDroneHealth] = useState<number>(100);

  // Challenge and Knock overrides validation
  const [clientNonce, setClientNonce] = useState<number>(101);
  const [enteredNonce, setEnteredNonce] = useState<string>("101");
  const [nonceValid, setNonceValid] = useState<boolean>(true);
  const [lastBypassResults, setLastBypassResults] = useState<string>("");

  // Spatial log for spatial rw logistics & plane transitioning
  const [battleLogs, setBattleLogs] = useState<{ id: string; msg: string; type: "drone" | "vortex" | "system" | "success" }[]>([]);

  // Simulation controls
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  const [simTick, setSimTick] = useState<number>(0);

  // Gate Drive Protection Mode (Binary vs Ternary)
  const [gatingMode, setGatingMode] = useState<"BINARY" | "TERNARY">("TERNARY");

  // Hardware status triggers for safety check
  const isTempTripped = avgElectrodeTemp >= 310.0;
  const isPressureTripped = plenumPressure < 1.25 || plenumPressure > 1.35;
  const isAsymmetric = !symmetryOk;
  const hasActiveFaults = activeFaultCodes.length > 0;
  const isEquipmentFaulty = isTempTripped || isPressureTripped || isAsymmetric || hasActiveFaults;

  // Mapping I Ching lines of active hexadecimal state using protective gating
  const getGatedInteractionPasses = () => {
    const binary = currentHexagram.toString(2).padStart(6, "0");
    return Array.from({ length: 6 }).map((_, idx) => {
      const bit = parseInt(binary[idx]);
      
      // Determine ternary state
      // - Binary Mode: bit ===== 1 is Active, regardless of faults (Unprotected).
      // - Ternary Mode:
      //     - bit === 1 && safe => +1 (Yang Active)
      //     - bit === 1 && faulty => -1 (Forced Yin/Suppressed)
      //     - bit === 0 => 0 (Yao Standby/Quietude)
      let ternaryVal = 0;
      let active = false;
      let isForcedYin = false;

      if (gatingMode === "BINARY") {
        active = bit === 1;
        ternaryVal = active ? 1 : -1;
      } else {
        if (bit === 1) {
          if (isEquipmentFaulty) {
            active = false;
            ternaryVal = -1;
            isForcedYin = true;
          } else {
            active = true;
            ternaryVal = 1;
          }
        } else {
          active = false;
          ternaryVal = 0;
        }
      }
      
      // Assign specific RSC prayers to active gates
      let prayerName = "Thick Skin (+5% Def)";
      let prayerIndex = 0;
      if (idx === 0) { prayerName = "Thick Skin (+5% Def)"; prayerIndex = 0; }
      else if (idx === 1) { prayerName = "Burst of Strength (+5% Str)"; prayerIndex = 1; }
      else if (idx === 2) { prayerName = "Clarity of Thought (+5% Atk)"; prayerIndex = 2; }
      else if (idx === 3) { prayerName = "Rock Skin (+10% Def)"; prayerIndex = 3; }
      else if (idx === 4) { prayerName = "Superhuman Strength (+10% Str)"; prayerIndex = 4; }
      else if (idx === 5) { prayerName = "Improved Reflexes (+10% Atk)"; prayerIndex = 5; }

      // Extra boost prayers if in critical or transit states
      const isCriticalState = currentHexagram === HexagramState.TR_CRIT || currentHexagram === HexagramState.ST_CRIT;
      const isTransitState = currentHexagram === HexagramState.TRANSIT || currentHexagram === HexagramState.TR_SALT;
      
      let higherPrayerName = "";
      let higherPrayerIndex = -1;

      if (isCriticalState) {
        higherPrayerName = "Steel Skin (+15% Def)";
        higherPrayerIndex = 9;
      } else if (isTransitState) {
        higherPrayerName = "Ultimate Strength (+15% Str)";
        higherPrayerIndex = 10;
      }

      return {
        lineIndex: 5 - idx,
        bit,
        active,
        ternaryVal,
        isForcedYin,
        prayerName: active 
          ? prayerName 
          : isForcedYin 
            ? "FORCED YIN (Safety Mute / Transient Damping)" 
            : "Gate Standby (Yao Balance)",
        prayerIndex,
        higherName: active && higherPrayerIndex !== -1 ? higherPrayerName : null,
        higherIndex: active && higherPrayerIndex !== -1 ? higherPrayerIndex : -1
      };
    });
  };

  const passes = getGatedInteractionPasses();

  // RSC Prayer multipliers calculated from gated passes
  const getPrayerModifiers = () => {
    let attack = 1.0;
    let strength = 1.0;
    let defense = 1.0;

    passes.forEach((pass) => {
      if (pass.active) {
        const bonus = PRAYER_BONUSES[pass.prayerIndex as keyof typeof PRAYER_BONUSES];
        if (bonus) {
          if (bonus.skill === "attack") attack = Math.max(attack, bonus.multiplier);
          if (bonus.skill === "strength") strength = Math.max(strength, bonus.multiplier);
          if (bonus.skill === "defense") defense = Math.max(defense, bonus.multiplier);
        }

        if (pass.higherIndex !== -1) {
          const higherBonus = PRAYER_BONUSES[pass.higherIndex as keyof typeof PRAYER_BONUSES];
          if (higherBonus) {
            if (higherBonus.skill === "attack") attack = Math.max(attack, higherBonus.multiplier);
            if (higherBonus.skill === "strength") strength = Math.max(strength, higherBonus.multiplier);
            if (higherBonus.skill === "defense") defense = Math.max(defense, higherBonus.multiplier);
          }
        }
      }
    });

    return { attack, strength, defense };
  };

  // Combat styles bonus levels
  const getStyleBonus = (style: number, skill: string) => {
    if (style === 0) return 1; // Controlled bonus is flat +1 to all
    if (skill === "strength" && style === 1) return 3; // Aggressive
    if (skill === "attack" && style === 2) return 3; // Accurate
    if (skill === "defense" && style === 3) return 3; // Defensive
    return 0;
  };

  // Dynamic Drone Stats derived from real-world telemetry
  const getDroneSkills = () => {
    // Current base levels scale based on physics stress inputs
    const attackBase = Math.floor(40 + (busCurrentA / 50));
    const strengthBase = Math.floor(45 + (100 - avgElectrodeTemp) / 5);
    const defenseBase = Math.floor(50 + (plenumPressure * 10));

    return {
      attack: attackBase,
      strength: strengthBase,
      defense: defenseBase
    };
  };

  // === AUTHENTIC RSC FORMULAS ===
  const calculateAccuracy = (accuracy: number, defense: number) => {
    let hitChance;
    if (accuracy > defense) {
      hitChance = 1 - ((defense + 2) / (2 * (accuracy + 1)));
    } else {
      hitChance = accuracy / (2 * (defense + 1));
    }
    return { hitChance, hit: Math.random() <= hitChance };
  };

  const getDroneMeleeAccuracy = () => {
    const skills = getDroneSkills();
    const styleBonus = getStyleBonus(combatStyle, "attack");
    const prayerBonus = getPrayerModifiers().attack;
    const bonusConstant = 8;
    return (Math.floor(skills.attack * prayerBonus) + bonusConstant + styleBonus) * (equipmentWeaponAim + 64);
  };

  const getDroneMeleeDefense = () => {
    const skills = getDroneSkills();
    const styleBonus = getStyleBonus(combatStyle, "defense");
    const prayerBonus = getPrayerModifiers().defense;
    const bonusConstant = 8;
    return (Math.floor(skills.defense * prayerBonus) + bonusConstant + styleBonus) * (equipmentArmourPoints + 64);
  };

  const getDroneMeleeMaxRoll = () => {
    const skills = getDroneSkills();
    const styleBonus = getStyleBonus(combatStyle, "strength");
    const prayerBonus = getPrayerModifiers().strength;
    const bonusConstant = 8;
    return (Math.floor(skills.strength * prayerBonus) + bonusConstant + styleBonus) * (equipmentWeaponPower + 64);
  };

  const calculateMeleeDamage = (maxRoll: number) => {
    if (maxRoll <= 0) return 0;
    const rawVal = Math.floor(Math.random() * maxRoll);
    return Math.floor((rawVal + 320) / 640);
  };

  // Adversary formulas
  const getAdversaryAccuracy = () => {
    const baseAtk = adversaryLevel;
    return (baseAtk + 8) * (30 + 64); // raw average equipment
  };

  const getAdversaryDefense = () => {
    const baseDef = adversaryLevel;
    return (baseDef + 8) * (20 + 64);
  };

  const getAdversaryMaxRoll = () => {
    const baseStr = adversaryLevel + 5;
    return (baseStr + 8) * (40 + 64);
  };

  // Run combat simulation steps on tick intervals
  useEffect(() => {
    if (!isSimRunning) return;

    const interval = setInterval(() => {
      setSimTick((prev) => {
        const nextTick = prev + 1;
        
        // Let's roll a clash!
        const droneAcc = getDroneMeleeAccuracy();
        const vortexDef = getAdversaryDefense();
        const droneClash = calculateAccuracy(droneAcc, vortexDef);

        const vortexAcc = getAdversaryAccuracy();
        const droneDef = getDroneMeleeDefense();
        const vortexClash = calculateAccuracy(vortexAcc, droneDef);

        const newLogs: typeof battleLogs = [];

        // 1. Drone Attacks Adversary (Vortex Wave)
        if (droneClash.hit) {
          const maxRoll = getDroneMeleeMaxRoll();
          const dmg = calculateMeleeDamage(maxRoll);
          const randId = Math.random().toString(36).substring(2, 9);
          if (dmg > 0) {
            setAdversaryHealth((h) => Math.max(0, h - dmg));
            newLogs.push({
              id: `LOG-DRONE-${nextTick}-${randId}`,
              msg: `✈️ Drone accuracy check PASSED (${(droneClash.hitChance * 100).toFixed(0)}%). STR max roll [${maxRoll}] collapsed into: **${dmg} DMG** hit on Vortex Wave!`,
              type: "drone"
            });
          } else {
            newLogs.push({
              id: `LOG-DRONE-M-${nextTick}-${randId}`,
              msg: `💨 Drone accuracy PASSED but rolled defensive absorb (0 DMG hit).`,
              type: "system"
            });
          }
        } else {
          const randId = Math.random().toString(36).substring(2, 9);
          newLogs.push({
            id: `LOG-DRONE-F-${nextTick}-${randId}`,
            msg: `🛡️ Drone signature check MISSED Vortex (Chances: ${(droneClash.hitChance * 100).toFixed(0)}%).`,
            type: "system"
          });
        }

        // 2. Vortex Wave attacks Drone
        if (vortexClash.hit) {
          const vortexMax = getAdversaryMaxRoll();
          const dmg = calculateMeleeDamage(vortexMax);
          const randId = Math.random().toString(36).substring(2, 9);
          if (dmg > 0) {
            setDroneHealth((h) => Math.max(0, h - dmg));
            newLogs.push({
              id: `LOG-VORTEX-${nextTick}-${randId}`,
              msg: `⚡ Vortex electromagnetic pulse hit drone for **${dmg} damage** (Chances: ${(vortexClash.hitChance * 100).toFixed(0)}%).`,
              type: "vortex"
            });
          }
        } else {
          const randId = Math.random().toString(36).substring(2, 9);
          newLogs.push({
            id: `LOG-VORTEX-F-${nextTick}-${randId}`,
            msg: `🟢 Drone's VHDL interlocks successfully deflected Vortex pulses (Chances: ${(vortexClash.hitChance * 100).toFixed(0)}%).`,
            type: "success"
          });
        }

        // Failsafe alert under Ternary gating
        if (isEquipmentFaulty && gatingMode === "TERNARY" && Math.random() < 0.5) {
          const randId = Math.random().toString(36).substring(2, 9);
          newLogs.push({
            id: `LOG-TERNARY-PROTECT-${nextTick}-${randId}`,
            msg: `🛡️ FAILSAFE ACTIVE: Ternary gating intercepted mechanical faults! Active gates are forced to protective Yin (-1) damping to shield current regulators.`,
            type: "success"
          });
        }

        // Keep last 15 items in state log
        setBattleLogs((prevLogs) => {
          const copy = [...newLogs, ...prevLogs];
          return copy.slice(0, 15);
        });

        return nextTick;
      });
    }, 2400); // Ticks slower than simulation to allow readable interaction

    return () => clearInterval(interval);
  }, [isSimRunning, currentHexagram, plenumPressure, avgElectrodeTemp, busCurrentA, gatingMode, isEquipmentFaulty, combatStyle]);

  // Handle client Challenge authentication
  const handleValidateKey = () => {
    const val = parseInt(enteredNonce);
    if (val === clientNonce) {
      setNonceValid(true);
      setLastBypassResults(`AUTHENTICATION SUCCESS: Challenge nonce matches sub-layer. Gated interaction bypass ARMED.`);
      // AUTHENTIC REPAIR: Restoring drone structural and electromagnetic integrity via high-frequency magnetic re-polarization of MHD induction rails.
      setDroneHealth(100);
      setClientNonce((prev) => prev + 15); // refresh nonce
    } else {
      setNonceValid(false);
      setLastBypassResults(`CRYPTO MISMATCH: Nonce (${enteredNonce}) does not match current challenge (${clientNonce}). Lockout asserted!`);
    }
  };

  const handleResetFights = () => {
    setDroneHealth(100);
    setAdversaryHealth(100);
    setBattleLogs([]);
    addLogMessage("SYSTEM ACTION: Relocated coordinate plane. Battle log and health parameters synchronized.");
  };

  const addLogMessage = (msg: string) => {
    const randSuffix = Math.random().toString(36).substring(2, 9);
    setBattleLogs((prev) => [
      { id: `SYS-${Date.now()}-${randSuffix}`, msg, type: "system" },
      ...prev
    ]);
  };

  const droneStats = getDroneSkills();
  const prayerMods = getPrayerModifiers();

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans mb-5 relative overflow-hidden" id="ai-gated-substrate-card">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Binary className="w-48 h-48 text-indigo-500" />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-850 mb-5 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400 shrink-0" />
            <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
              GATED HEXAGRAM INTERACTION SUBSTRATE (RSC MULTI-PLANE FORMULAS)
            </h2>
          </div>
          <p className="text-[10px] uppercase font-mono text-slate-500 mt-1 leading-normal leading-relaxed">
            Adapting Ancient Yao State-Machine transitions into Real-world Spatial Defense Parameters
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 select-none">
          <button
            onClick={() => setIsSimRunning(!isSimRunning)}
            className={`px-3 py-1 text-[9px] font-mono font-bold rounded border uppercase flex items-center gap-1.5 transition ${
              isSimRunning 
                ? "bg-indigo-950/40 text-indigo-400 border-indigo-700/60 shadow-[0_0_6px_rgba(99,102,241,0.15)]" 
                : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-750"
            }`}
          >
            {isSimRunning ? (
              <>
                <Pause className="h-3 w-3" />
                TRANSLATION CORE: RUNNING
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                TRANSLATION CORE: MUTED
              </>
            )}
          </button>
          <button
            onClick={handleResetFights}
            className="p-1 px-2.5 bg-slate-900 border border-slate-800 text-[9px] font-mono hover:border-slate-700 hover:text-slate-200 rounded text-slate-400 uppercase transition flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> RESET
          </button>
        </div>
      </div>

      {/* Core Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Line-Gate Passes Mapping Matrix (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/40 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-4 font-mono text-[10px]">
            <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center select-none">
              <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wide">
                <Binary className="h-4 w-4" />
                6-LINE INTERACTION GATES
              </span>
              <span className="text-[8px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-1.5 rounded uppercase">
                TERNARY ALIGNMENT
              </span>
            </div>

            {/* Gating Mode Toggle */}
            <div className="bg-slate-950 border border-slate-850 p-2.5 rounded space-y-2">
              <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">GATING MODE MATRIX SELECT</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  id="gating-mode-binary-toggle"
                  onClick={() => setGatingMode("BINARY")}
                  className={`py-1 text-[8.5px] font-mono font-bold uppercase rounded border transition cursor-pointer ${
                    gatingMode === "BINARY"
                      ? "bg-slate-900 text-indigo-400 border-indigo-700/60 shadow-[0_0_6px_rgba(99,102,241,0.15)]"
                      : "bg-slate-950 text-slate-500 border-slate-900 hover:border-slate-800 hover:text-slate-400"
                  }`}
                >
                  BINARY (LEGACY)
                </button>
                <button
                  type="button"
                  id="gating-mode-ternary-toggle"
                  onClick={() => setGatingMode("TERNARY")}
                  className={`py-1 text-[8.5px] font-mono font-bold uppercase rounded border transition cursor-pointer ${
                    gatingMode === "TERNARY"
                      ? "bg-indigo-950/40 text-emerald-400 border-emerald-700/60 shadow-[0_0_6px_rgba(16,185,129,0.15)]"
                      : "bg-slate-950 text-slate-500 border-slate-900 hover:border-slate-800 hover:text-slate-400"
                  }`}
                >
                  TERNARY (Failsafe)
                </button>
              </div>
            </div>

            {/* Hardware Safety Advisor */}
            <div className={`p-2 rounded border text-[8.5px] leading-relaxed flex items-start gap-2 ${
              isEquipmentFaulty 
                ? "bg-rose-955/25 border-rose-800/40 text-rose-300 animate-pulse" 
                : "bg-slate-950/40 border-slate-850 text-slate-405"
            }`}>
              {isEquipmentFaulty ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-200 block uppercase">CRITICAL SYSTEM CONFLICTS DETECTED</span>
                    Hardware faults present! {gatingMode === "TERNARY" ? "Ternary defense active: Forced Yin protection couples active high lines to suppress solenoid burnout." : "WARNING: Binary mode lets active gates fire high in a faulty environment, risking solenoid destruction!"}
                  </div>
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-350 block uppercase">SYSTEM OPERATIONS COMPLIANT</span>
                    No active faults. Active gates are executing Yang (+1) excitation pathways.
                  </div>
                </>
              )}
            </div>

            <p className="text-[9px] text-slate-500 leading-normal leading-relaxed">
              Each state bit from the active I Ching Hexagram acts as a gated transition filter on combat formulas. State <strong className="text-slate-350">{HexagramStateLabels[currentHexagram]?.split(" (")[0] || currentHexagram}</strong> yields active gates:
            </p>

            {/* Passes Visualizer list */}
            <div className="space-y-2">
              {passes.map((pass) => {
                let badgeColor = "bg-slate-900 text-slate-500 border-slate-850";
                let textClass = "text-slate-600";
                let containerBorder = "bg-slate-950/80 border-slate-850";

                if (pass.active) {
                  // Active Yang
                  badgeColor = "bg-amber-950/30 text-amber-400 border border-amber-800/60 animate-pulse";
                  textClass = "text-amber-400";
                  containerBorder = "bg-slate-950/80 border-amber-900/40 shadow-[0_0_8px_rgba(245,158,11,0.03)]";
                } else if (pass.isForcedYin) {
                  // Forced Yin
                  badgeColor = "bg-rose-955/25 text-rose-405 border border-rose-800 animate-pulse";
                  textClass = "text-rose-405";
                  containerBorder = "bg-slate-955/15 border-rose-900/60 shadow-[0_0_8px_rgba(244,63,94,0.05)]";
                } else if (pass.ternaryVal === 0) {
                  // Yao balanced
                  badgeColor = "bg-cyan-950/20 text-cyan-500 border border-cyan-900/40";
                  textClass = "text-slate-500";
                  containerBorder = "bg-slate-950/40 border-slate-900";
                }

                return (
                  <div key={pass.lineIndex} className={`border p-2 rounded flex items-center justify-between transition-colors ${containerBorder}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5 items-center shrink-0">
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[8.5px] font-black border ${badgeColor}`}>
                          {pass.bit}
                        </span>
                        <span className="text-[7px] text-slate-500 font-mono scale-90">
                          {pass.ternaryVal > 0 ? "YANG" : pass.ternaryVal < 0 ? "YIN" : "YAO"}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-slate-505 font-bold block uppercase">Yao Line {pass.lineIndex}</span>
                        <span className={`text-[9px] font-semibold flex items-center gap-1 ${textClass}`}>
                          {pass.isForcedYin && <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />}
                          {pass.prayerName}
                        </span>
                      </div>
                    </div>
                    {pass.higherName && (
                      <span className={`text-[7px] font-bold uppercase border px-1 py-0.5 rounded shrink-0 ${pass.active ? "bg-amber-955/25 text-amber-400 border-amber-900 animate-pulse" : "bg-slate-955 text-slate-500 border-slate-850"}`}>
                        ⚡ {pass.higherName.split(" (")[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cumulative Multiplier block */}
            <div className="pt-2 border-t border-slate-850 space-y-1.5 text-[8.5px] uppercase text-slate-400">
              <span className="font-bold text-[8px] text-slate-500 block">RECONSTRUCTED PRAYER COEFFICIENTS:</span>
              <div className="grid grid-cols-3 gap-1 text-center font-mono">
                <div className="bg-slate-950 border border-slate-850 p-1 rounded">
                  <span className="text-slate-550 block text-[7.5px]">ATTACK:</span>
                  <strong className="text-cyan-400">{prayerMods.attack.toFixed(2)}x</strong>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-1 rounded">
                  <span className="text-slate-550 block text-[7.5px]">STRENGTH:</span>
                  <strong className="text-indigo-400">{prayerMods.strength.toFixed(2)}x</strong>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-1 rounded">
                  <span className="text-slate-550 block text-[7.5px]">DEFENSE:</span>
                  <strong className="text-emerald-400">{prayerMods.defense.toFixed(2)}x</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Live Authentic RSC Clash Simulator Arena (4 cols) */}
        <div className="lg:col-span-5 bg-slate-900/40 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-4 font-mono text-[10px]">
            <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center select-none">
              <span className="font-bold text-slate-350 uppercase tracking-wide flex items-center gap-1.5">
                <Target className="h-4 w-4 text-cyan-400" />
                AUTHENTIC RSC COMBAT CLASH
              </span>
              <span className="text-[8px] bg-slate-950 text-emerald-400 border border-slate-850 px-1.5 rounded uppercase font-bold tracking-wider">
                CO-PRES SPATIAL PLANE
              </span>
            </div>

            {/* Simulated health status boards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Drone Health block */}
              <div className="bg-slate-950 border border-slate-850 p-2.5 rounded relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                  <Cpu className="h-10 w-10 text-indigo-400" />
                </div>
                <span className="text-[8px] font-bold uppercase text-slate-500 block mb-1">MHD Drone Core health</span>
                <span className={`text-[13px] font-bold block ${droneHealth < 30 ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                  {droneHealth}%
                </span>
                <div className="w-full h-1 bg-slate-900 rounded-full mt-2 overflow-hidden flex select-none">
                  <div style={{ width: `${droneHealth}%` }} className={`h-full ${droneHealth < 30 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`}></div>
                </div>

                {/* Derived live skills indicators */}
                <div className="mt-2.5 pt-2 border-t border-slate-900 text-[7.5px] uppercase space-y-1 text-slate-450">
                  <div className="flex justify-between">
                    <span>ATK (Accu):</span>
                    <strong className="text-indigo-400">{droneStats.attack} ({getDroneMeleeAccuracy()})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>DEF (Armour):</span>
                    <strong className="text-emerald-400">{droneStats.defense} ({getDroneMeleeDefense()})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>STR (Max Roll):</span>
                    <strong className="text-cyan-400">{droneStats.strength} ({getDroneMeleeMaxRoll()})</strong>
                  </div>
                </div>
              </div>

              {/* Vortex Health block */}
              <div className="bg-slate-950 border border-slate-850 p-2.5 rounded relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                  <Flame className="h-10 w-10 text-red-500 animate-pulse" />
                </div>
                <span className="text-[8px] font-bold uppercase text-slate-500 block mb-1">Vortex Electromagnetic Interf</span>
                <span className={`text-[13px] font-bold block ${adversaryHealth < 30 ? "text-emerald-400 animate-pulse" : "text-red-400"}`}>
                  {adversaryHealth}%
                </span>
                <div className="w-full h-1 bg-slate-900 rounded-full mt-2 overflow-hidden flex select-none">
                  <div style={{ width: `${adversaryHealth}%` }} className={`h-full ${adversaryHealth < 30 ? "bg-emerald-500" : "bg-red-500"}`}></div>
                </div>

                {/* Adversary derived stats */}
                <div className="mt-2.5 pt-2 border-t border-slate-900 text-[7.5px] uppercase space-y-1 text-slate-450">
                  <div className="flex justify-between">
                    <span>ATK (Accu):</span>
                    <strong className="text-indigo-400">{adversaryLevel} ({getAdversaryAccuracy()})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>DEF (Armour):</span>
                    <strong className="text-emerald-400">{adversaryLevel} ({getAdversaryDefense()})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>STR (Max Roll):</span>
                    <strong className="text-cyan-400">{adversaryLevel + 5} ({getAdversaryMaxRoll()})</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Combat styles toggle */}
            <div className="bg-slate-950 border border-slate-850 p-2 rounded">
              <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1.5">DRONE COMBAT POSTURE STYLE:</span>
              <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[8px] font-bold uppercase">
                {[
                  { id: 0, label: "CONTROLLED", desc: "+1 to Atk, Str, Def" },
                  { id: 1, label: "AGGRESSIVE", desc: "+3 to Strength" },
                  { id: 2, label: "ACCURATE", desc: "+3 to Attack" },
                  { id: 3, label: "DEFENSIVE", desc: "+3 to Defense" }
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setCombatStyle(style.id)}
                    className={`p-1.5 rounded border transition ${combatStyle === style.id ? "bg-indigo-950/60 border-indigo-700 font-extrabold text-slate-100" : "bg-slate-900 text-slate-500 border-slate-850 hover:border-slate-800 hover:text-slate-400"}`}
                    title={style.desc}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Battle logs stream list */}
            <div className="bg-slate-950 border border-slate-850 rounded p-2.5 h-24 overflow-y-auto space-y-1.5 select-all selection:bg-indigo-900">
              {battleLogs.length === 0 ? (
                <span className="text-slate-650 italic text-[8.5px] block py-4 text-center">Translation stream initialized. Ticking and checking spatial bounds...</span>
              ) : (
                battleLogs.map((log) => {
                  let textClass = "text-slate-400";
                  if (log.type === "drone") textClass = "text-cyan-400 font-bold";
                  else if (log.type === "vortex") textClass = "text-red-400 animate-pulse";
                  else if (log.type === "success") textClass = "text-emerald-400";
                  else if (log.type === "system") textClass = "text-slate-500 font-extrabold";

                  return (
                    <div key={log.id} className={`text-[8px] leading-relaxed font-mono ${textClass}`}>
                      {log.msg}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Challenge Authenticator & Plane Override (4 cols) */}
        <div className="lg:col-span-3 bg-slate-900/40 border border-slate-850 p-4 rounded flex flex-col justify-between">
          <div className="space-y-4 font-mono text-[10px]">
            <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center select-none">
              <span className="font-bold text-slate-350 tracking-wide flex items-center gap-1">
                <Key className="h-4 w-4 text-amber-400" />
                AXI4_SLAVE SECURE OVERRIDE
              </span>
            </div>

            <p className="text-[9px] text-slate-500 leading-normal leading-relaxed">
              If drone state slips or interlocks disconnect due to Vortex interferences, calculate the active security challenge nonce to bypass restrictions.
            </p>

            <div className="bg-slate-950 border border-slate-850 p-2.5 rounded space-y-3">
              <div>
                <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1">DYNAMIC CHALLENGE NONCE:</span>
                <span className="text-amber-400 font-extrabold text-[12px] block select-all tracking-wider animate-pulse">
                  {clientNonce}
                </span>
              </div>

              <div>
                <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1.5">ENTER RESPONSE NONCE SIGNATURE:</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={enteredNonce}
                    onChange={(e) => setEnteredNonce(e.target.value)}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-750 focus:border-indigo-600 focus:outline-none rounded px-2.5 py-1 text-slate-200 text-[10px] w-full font-mono font-bold"
                    placeholder="Enter nonce"
                  />
                  <button
                    onClick={handleValidateKey}
                    className="px-3 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded transition text-[9px] whitespace-nowrap uppercase"
                  >
                    VERIFY
                  </button>
                </div>
              </div>

              {lastBypassResults && (
                <div className={`text-[8px] p-2 leading-relaxed font-bold rounded border ${nonceValid ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60" : "bg-red-950/40 text-red-400 border-red-900/60"}`}>
                  {lastBypassResults}
                </div>
              )}
            </div>

            {/* VHDL Ports mapping description */}
            <div className="bg-slate-950 border border-slate-850 p-2.5 rounded text-[8.5px] leading-normal space-y-1.5">
              <span className="text-slate-450 block font-bold uppercase border-b border-slate-900 pb-0.5">VHDL SIGNAL MAP & TRADEOFF REGISTER:</span>
              <div className="space-y-1 text-slate-400 leading-normal">
                <p>• <strong>ps_knock_nonce</strong>: Gated override. Matches dynamic challenge counter validation register (0=No effect, match=Unlocked bypass state).</p>
                <p>• <strong>imu_decoherence</strong>: If spike occurs (Γ &gt; 5.0 °/s), the state machine combinatorial block overrides everything to LIMP_MODE instantly.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 text-[8px] font-mono text-slate-500 uppercase select-none font-bold flex justify-between items-center">
            <span>BITSTREAM ENVELOPE: MHD_RSC_SUBSTRATE</span>
            <span className="text-indigo-400 animate-pulse">ALIGNED</span>
          </div>
        </div>

      </div>
    </div>
  );
}
