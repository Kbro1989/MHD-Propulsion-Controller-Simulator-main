/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Sliders, HelpCircle, Thermometer, Gauge, Compass, AlertCircle, ShieldAlert, Activity } from "lucide-react";

interface HILSimulatorControlsProps {
  temperatureBias: number; // Offsets temperature from nominal 300K
  setTemperatureBias: (val: number) => void;
  plenumPressure: number;  // Nominally 1.3 atm
  setPlenumPressure: (val: number) => void;
  imuGyroRate: number;     // IMU Turn Rate
  setImuGyroRate: (val: number) => void;
  taylorOrder: number;     // 2 to 5
  setTaylorOrder: (val: number) => void;
  contactorFaultMask: boolean[]; // Array of 10 booleans (healthy or faulted)
  setContactorFaultMask: (val: boolean[]) => void;
  busCurrentBias: number;  // Nominal current around 1880A
  setBusCurrentBias: (val: number) => void;
  onResetSimulator: () => void;
  chokeFreqOffset: number; // Offsets Choke resonance freq from 6500Hz nominal
  setChokeFreqOffset: (val: number) => void;

  // New AXI Fault Injection properties
  faultInjectTempBitFlip?: boolean;
  setFaultInjectTempBitFlip?: (val: boolean) => void;
  faultInjectTempStuck?: boolean;
  setFaultInjectTempStuck?: (val: boolean) => void;
  faultInjectPressStuck?: boolean;
  setFaultInjectPressStuck?: (val: boolean) => void;
  faultInjectStateCorrupt?: boolean;
  setFaultInjectStateCorrupt?: (val: boolean) => void;
  faultInjectCrcCorrupt?: boolean;
  setFaultInjectCrcCorrupt?: (val: boolean) => void;

  // Advanced VHDL/FPGA Fault Injections
  faultInjectAxiTimeout?: boolean;
  setFaultInjectAxiTimeout?: (val: boolean) => void;
  faultInjectAxiReadbackMismatch?: boolean;
  setFaultInjectAxiReadbackMismatch?: (val: boolean) => void;
  faultInjectCdcDesync?: boolean;
  setFaultInjectCdcDesync?: (val: boolean) => void;
  faultInjectCdcDrift?: boolean;
  setFaultInjectCdcDrift?: (val: boolean) => void;
  faultInjectThermalRateExceeded?: boolean;
  setFaultInjectThermalRateExceeded?: (val: boolean) => void;
  faultInjectSensorDivergence?: boolean;
  setFaultInjectSensorDivergence?: (val: boolean) => void;

  // Interlock auto-dismiss properties
  warningAutoDismiss?: boolean;
  setWarningAutoDismiss?: (val: boolean) => void;
}

export default function HILSimulatorControls({
  temperatureBias,
  setTemperatureBias,
  plenumPressure,
  setPlenumPressure,
  imuGyroRate,
  setImuGyroRate,
  taylorOrder,
  setTaylorOrder,
  contactorFaultMask,
  setContactorFaultMask,
  busCurrentBias,
  setBusCurrentBias,
  onResetSimulator,
  chokeFreqOffset = 0,
  setChokeFreqOffset,

  faultInjectTempBitFlip = false,
  setFaultInjectTempBitFlip,
  faultInjectTempStuck = false,
  setFaultInjectTempStuck,
  faultInjectPressStuck = false,
  setFaultInjectPressStuck,
  faultInjectStateCorrupt = false,
  setFaultInjectStateCorrupt,
  faultInjectCrcCorrupt = false,
  setFaultInjectCrcCorrupt,

  faultInjectAxiTimeout = false,
  setFaultInjectAxiTimeout,
  faultInjectAxiReadbackMismatch = false,
  setFaultInjectAxiReadbackMismatch,
  faultInjectCdcDesync = false,
  setFaultInjectCdcDesync,
  faultInjectCdcDrift = false,
  setFaultInjectCdcDrift,
  faultInjectThermalRateExceeded = false,
  setFaultInjectThermalRateExceeded,
  faultInjectSensorDivergence = false,
  setFaultInjectSensorDivergence,

  warningAutoDismiss = false,
  setWarningAutoDismiss,
}: HILSimulatorControlsProps) {

  // Local state for the custom preset creation
  const [newPresetName, setNewPresetName] = React.useState("");
  const [faultPresets, setFaultPresets] = React.useState<{ name: string; states: Record<string, boolean> }[]>(() => {
    try {
      const saved = localStorage.getItem("mhd_fault_presets_list");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Local storage error parsing presets", e);
    }
    // Default high-fidelity scenarios
    return [
      {
        name: "Thermal Runaway Sequence",
        states: {
          faultInjectTempStuck: true,
          faultInjectThermalRateExceeded: true,
          faultInjectSensorDivergence: true,
        },
      },
      {
        name: "AXI Bus Pipeline Failure",
        states: {
          faultInjectCrcCorrupt: true,
          faultInjectAxiTimeout: true,
          faultInjectAxiReadbackMismatch: true,
        },
      },
      {
        name: "Clock Domain Drift Cycle",
        states: {
          faultInjectCdcDesync: true,
          faultInjectCdcDrift: true,
        },
      },
    ];
  });

  const saveFaultPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPresetName.trim();
    if (!trimmed) return;

    // Snapshot current active state
    const snapshot: Record<string, boolean> = {};
    if (faultInjectTempBitFlip) snapshot.faultInjectTempBitFlip = true;
    if (faultInjectTempStuck) snapshot.faultInjectTempStuck = true;
    if (faultInjectPressStuck) snapshot.faultInjectPressStuck = true;
    if (faultInjectStateCorrupt) snapshot.faultInjectStateCorrupt = true;
    if (faultInjectCrcCorrupt) snapshot.faultInjectCrcCorrupt = true;
    if (faultInjectAxiTimeout) snapshot.faultInjectAxiTimeout = true;
    if (faultInjectAxiReadbackMismatch) snapshot.faultInjectAxiReadbackMismatch = true;
    if (faultInjectCdcDesync) snapshot.faultInjectCdcDesync = true;
    if (faultInjectCdcDrift) snapshot.faultInjectCdcDrift = true;
    if (faultInjectThermalRateExceeded) snapshot.faultInjectThermalRateExceeded = true;
    if (faultInjectSensorDivergence) snapshot.faultInjectSensorDivergence = true;

    const nextPresets = [...faultPresets, { name: trimmed, states: snapshot }];
    setFaultPresets(nextPresets);
    localStorage.setItem("mhd_fault_presets_list", JSON.stringify(nextPresets));
    setNewPresetName("");
  };

  const deleteFaultPreset = (indexToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent applying
    const nextPresets = faultPresets.filter((_, idx) => idx !== indexToDelete);
    setFaultPresets(nextPresets);
    localStorage.setItem("mhd_fault_presets_list", JSON.stringify(nextPresets));
  };

  const applyFaultPreset = (presetStates: Record<string, boolean>) => {
    // Reset all faults to healthy (false)
    setFaultInjectTempBitFlip?.(false);
    setFaultInjectTempStuck?.(false);
    setFaultInjectPressStuck?.(false);
    setFaultInjectStateCorrupt?.(false);
    setFaultInjectCrcCorrupt?.(false);
    setFaultInjectAxiTimeout?.(false);
    setFaultInjectAxiReadbackMismatch?.(false);
    setFaultInjectCdcDesync?.(false);
    setFaultInjectCdcDrift?.(false);
    setFaultInjectThermalRateExceeded?.(false);
    setFaultInjectSensorDivergence?.(false);

    // Apply specific preset targets
    if (presetStates.faultInjectTempBitFlip) setFaultInjectTempBitFlip?.(true);
    if (presetStates.faultInjectTempStuck) setFaultInjectTempStuck?.(true);
    if (presetStates.faultInjectPressStuck) setFaultInjectPressStuck?.(true);
    if (presetStates.faultInjectStateCorrupt) setFaultInjectStateCorrupt?.(true);
    if (presetStates.faultInjectCrcCorrupt) setFaultInjectCrcCorrupt?.(true);
    if (presetStates.faultInjectAxiTimeout) setFaultInjectAxiTimeout?.(true);
    if (presetStates.faultInjectAxiReadbackMismatch) setFaultInjectAxiReadbackMismatch?.(true);
    if (presetStates.faultInjectCdcDesync) setFaultInjectCdcDesync?.(true);
    if (presetStates.faultInjectCdcDrift) setFaultInjectCdcDrift?.(true);
    if (presetStates.faultInjectThermalRateExceeded) setFaultInjectThermalRateExceeded?.(true);
    if (presetStates.faultInjectSensorDivergence) setFaultInjectSensorDivergence?.(true);
  };

  const toggleContactorFault = (idx: number) => {
    const copy = [...contactorFaultMask];
    copy[idx] = !copy[idx];
    setContactorFaultMask(copy);
  };

  const hasAnyContactorFault = contactorFaultMask.some((healthy) => !healthy);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 font-sans" id="hil-simulator-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 mb-4 gap-2">
        <div className="flex items-center gap-2 select-none">
          <Sliders className="h-5 w-5 text-cyan-400" />
          <h3 className="text-sm font-display font-medium text-slate-200 tracking-wide uppercase">
            HIL Hardware-In-the-loop simulator panel
          </h3>
        </div>
        <button
          onClick={onResetSimulator}
          className="text-[10px] font-mono text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded select-none cursor-pointer hover:border-slate-700 hover:bg-slate-950 active:scale-95 transition"
        >
          RESET NOMINAL PARAMS
        </button>
      </div>

      <p className="text-[11px] text-slate-500 font-mono mb-5 leading-normal">
        Inject electrical, mechanical, rotational and thermal stress vectors directly into the running co-simulator pipeline below to test FPGA safety response.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Module 1: Thermal & Pressure Enclosures */}
        <div className="space-y-4">
          <span className="text-[10px] text-slate-400 font-mono font-bold block pb-1 border-b border-slate-850 uppercase tracking-wide">
            1. THERMAL & PRESSURES
          </span>

          {/* Temperature Slider */}
          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between select-none">
              <span className="text-slate-400 flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5 text-orange-400" />
                Electrode Temp Bias
              </span>
              <span className="text-slate-300 font-bold">+{temperatureBias.toFixed(1)} K</span>
            </div>
            <input
              type="range"
              min={-50}
              max={100}
              step={1}
              value={temperatureBias}
              onChange={(e) => setTemperatureBias(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-900 outline-none rounded appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400"
            />
            <div className="flex justify-between text-[8px] text-slate-550 select-none">
              <span>Cooler (-50 K)</span>
              <span className="text-red-500 font-bold">Shutoff Threshold (&gt;320 K)</span>
            </div>
          </div>

          {/* Plenum Pressure Slider */}
          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between select-none">
              <span className="text-slate-400 flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5 text-blue-400" />
                Plenum Gas Pressure
              </span>
              <span className="text-slate-300 font-bold">{plenumPressure.toFixed(2)} atm</span>
            </div>
            <input
              type="range"
              min={1.1}
              max={1.5}
              step={0.01}
              value={plenumPressure}
              onChange={(e) => setPlenumPressure(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-900 outline-none rounded appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
            />
            <div className="flex justify-between text-[8px] text-slate-550 select-none">
              <span className="text-red-400">Under (1.25 atm)</span>
              <span>Nominal (1.30 atm)</span>
              <span className="text-red-400">Over (1.35 atm)</span>
            </div>
          </div>
        </div>

        {/* Module 2: IMU Rotational Accelerometer */}
        <div className="space-y-4">
          <span className="text-[10px] text-slate-400 font-mono font-bold block pb-1 border-b border-slate-850 uppercase tracking-wide">
            2. FLIGHT DECOHERENCE & LOADS
          </span>

          {/* Gyro Slider (IMU interrupt test) */}
          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between select-none">
              <span className="text-slate-400 flex items-center gap-1">
                <Compass className="h-3.5 w-3.5 text-emerald-400" />
                IMU Gyro Rate (Yaw/Roll)
              </span>
              <span className="text-slate-300 font-bold">{(imuGyroRate / 1000).toFixed(2)} °/s</span>
            </div>
            <input
              type="range"
              min={0}
              max={8000}
              step={100}
              value={imuGyroRate}
              onChange={(e) => setImuGyroRate(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-900 outline-none rounded appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
            />
            <div className="flex justify-between text-[8px] text-slate-550 select-none">
              <span>Nominal (0°/s)</span>
              <span className="text-red-500 font-bold">Decoherence IRQ Threshold (&gt;5.0 °/s)</span>
            </div>
          </div>

          {/* Bus Current Bias Slider */}
          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between select-none">
              <span className="text-slate-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                Bus Current Stress
              </span>
              <span className="text-slate-300 font-bold">{(1880 + busCurrentBias).toFixed(0)} A</span>
            </div>
            <input
              type="range"
              min={-500}
              max={500}
              step={10}
              value={busCurrentBias}
              onChange={(e) => setBusCurrentBias(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-900 outline-none rounded appearance-none cursor-pointer accent-yellow-550 hover:accent-yellow-400"
            />
            <div className="flex justify-between text-[8px] text-slate-550 select-none">
              <span>Normal (1880 A)</span>
              <span className="text-red-500 font-bold">Arc Threshold (&gt;2,000 A)</span>
            </div>
          </div>

          {/* Choke Resonance Frequency Drift Slider */}
          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between select-none">
              <span className="text-slate-400 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                Choke Frequency Drift
              </span>
              <span className={`font-bold ${Math.abs(chokeFreqOffset) > 325 ? "text-amber-550 animate-pulse font-medium" : "text-slate-300"}`}>
                {chokeFreqOffset >= 0 ? "+" : ""}{chokeFreqOffset.toFixed(0)} Hz
              </span>
            </div>
            <input
              type="range"
              min={-1000}
              max={1000}
              step={10}
              value={chokeFreqOffset}
              onChange={(e) => setChokeFreqOffset(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-900 outline-none rounded appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
            />
            <div className="flex justify-between text-[8px] text-slate-550 select-none">
              <span className="text-amber-500 font-bold">Drift &lt;-325 Hz (-5%)</span>
              <span>Nominal (0 Hz)</span>
              <span className="text-amber-500 font-bold">Drift &gt;325 Hz (+5%)</span>
            </div>
          </div>
        </div>

        {/* Module 3: HW Diagnostic Maskings */}
        <div className="space-y-4">
          <span className="text-[10px] text-slate-400 font-mono font-bold block pb-1 border-b border-slate-850 uppercase tracking-wide">
            3. HARDWARE INJECTS & RECTIFIERS
          </span>

          {/* Taylor Predictor Order Setting */}
          <div className="font-mono text-[10px] space-y-1.5">
            <span className="text-slate-400 block pb-1 select-none">GhostSplat Adaptive Order (N)</span>
            <div className="grid grid-cols-4 gap-1.5">
              {[2, 3, 4, 5].map((order) => (
                <button
                  key={order}
                  onClick={() => setTaylorOrder(order)}
                  className={`py-1.5 font-bold rounded text-center text-xs select-none cursor-pointer transition ${
                    taylorOrder === order
                      ? "bg-cyan-500/10 border border-cyan-500 text-cyan-400"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  N={order}
                </button>
              ))}
            </div>
          </div>

          {/* Contactors Interlocks breakdown mapping */}
          <div className="font-mono text-[10px] space-y-1.5">
            <span className="text-slate-400 block pb-1 flex justify-between select-none">
              <span>Active Contactor Fault_N Pins</span>
              {hasAnyContactorFault && (
                <span className="text-red-400 text-[8px] animate-pulse">FAULT TRIGGERED</span>
              )}
            </span>
            <div className="grid grid-cols-5 gap-1 text-center font-bold">
              {contactorFaultMask.map((healthy, i) => (
                <button
                  key={i}
                  onClick={() => toggleContactorFault(i)}
                  className={`py-1.5 text-[9px] rounded border select-none cursor-pointer hover:scale-105 active:scale-95 transition ${
                    healthy
                      ? "bg-slate-900 border-slate-800 text-slate-400"
                      : "bg-red-950/20 border-red-900 text-red-400"
                  }`}
                  title={`${healthy ? "Contactor healthy" : "Force fault on Contactor"}`}
                >
                  CT_{i}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Expanded Custom Segment for AXI-Slave Signal Integrity and Fault Control */}
      <div className="mt-6 pt-5 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3 select-none">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400 font-bold" />
            <h4 className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider">
              AXI4-Lite Fault Injection Register Control (0x43C00094)
            </h4>
          </div>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-rose-950/40 border border-rose-900/40 text-rose-350">
            INTEGRITY TEST CO-PROCESSOR ACTIVE
          </span>
        </div>

        <p className="text-[10px] text-slate-500 font-mono mb-4 leading-relaxed">
          AXI Register <code className="text-rose-400 font-bold">0x94 (FAULT_INJECT)</code> allows the simulated flight computer to inject diagnostic corruptions into sensor lines and package framing to verify fail-safe recovery logic.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {/* Temperature Bit-flip */}
          <button
            onClick={() => setFaultInjectTempBitFlip?.(!faultInjectTempBitFlip)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectTempBitFlip
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
          >
            <span className="text-[10px] font-bold uppercase mb-1">Temp Bit-Flip</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">ADC parity offset flip (+80K)</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectTempBitFlip ? "ACTIVE" : "INACTIVE"}
            </div>
          </button>

          {/* Temperature Stuck-at-max */}
          <button
            onClick={() => setFaultInjectTempStuck?.(!faultInjectTempStuck)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectTempStuck
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
          >
            <span className="text-[10px] font-bold uppercase mb-1">Temp Stuck Max</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">Locks Electrode temp to 425 K</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectTempStuck ? "OVERTEMP" : "INACTIVE"}
            </div>
          </button>

          {/* Pressure Stuck-at-zero */}
          <button
            onClick={() => setFaultInjectPressStuck?.(!faultInjectPressStuck)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectPressStuck
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
          >
            <span className="text-[10px] font-bold uppercase mb-1">Press Stuck Zero</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">Forces gas plenum to 0.0 atm</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectPressStuck ? "TRIPPED" : "INACTIVE"}
            </div>
          </button>

          {/* Yao State machine corruption */}
          <button
            onClick={() => setFaultInjectStateCorrupt?.(!faultInjectStateCorrupt)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectStateCorrupt
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
          >
            <span className="text-[10px] font-bold uppercase mb-1">State Corrupt</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">Generates invalid state index (0x3F)</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectStateCorrupt ? "CORRUPT" : "INACTIVE"}
            </div>
          </button>

          {/* Telemetry CRC corruption */}
          <button
            onClick={() => setFaultInjectCrcCorrupt?.(!faultInjectCrcCorrupt)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectCrcCorrupt
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
          >
            <span className="text-[10px] font-bold uppercase mb-1">CRC-8 Corrupt</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">Manipulates frame checksum bit CRC</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectCrcCorrupt ? "CRC_FAIL" : "INACTIVE"}
            </div>
          </button>

          {/* AXI Address Decoding fault */}
          <button
            onClick={() => setFaultInjectAxiTimeout?.(!faultInjectAxiTimeout)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectAxiTimeout
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
            title="Simulate illegal address write to trigger AXI DECERR system timeout"
          >
            <span className="text-[10px] font-bold uppercase mb-1">AXI Address DECERR</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">Write targeted on illegal address 0xDEAD</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectAxiTimeout ? "A-01 DECERR" : "INACTIVE"}
            </div>
          </button>

          {/* AXI Register Readback mismatch */}
          <button
            onClick={() => setFaultInjectAxiReadbackMismatch?.(!faultInjectAxiReadbackMismatch)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectAxiReadbackMismatch
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
            title="Simulate hardware write-read mismatch to trigger SLVERR status"
          >
            <span className="text-[10px] font-bold uppercase mb-1">AXI Readback SLVERR</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">Forces post-write verification mismatch</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectAxiReadbackMismatch ? "A-02 SLVERR" : "INACTIVE"}
            </div>
          </button>

          {/* CDC Handshake Sync loss */}
          <button
            onClick={() => setFaultInjectCdcDesync?.(!faultInjectCdcDesync)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectCdcDesync
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
            title="Simulate multi-stage synchronizer gate timing race-condition errors"
          >
            <span className="text-[10px] font-bold uppercase mb-1">CDC Sync Glitch</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">Glitch in Gray-code domain boundaries</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectCdcDesync ? "C-02 GLITCH" : "INACTIVE"}
            </div>
          </button>

          {/* CDC Phase clock drift */}
          <button
            onClick={() => setFaultInjectCdcDrift?.(!faultInjectCdcDrift)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectCdcDrift
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
            title="Simulate extreme dynamic clock phase drift of Programmable Logic crossing lines"
          >
            <span className="text-[10px] font-bold uppercase mb-1">CDC Clock Drift</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">PL dynamic clock skew drifts beyond limits</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectCdcDrift ? "C-03 Skew" : "INACTIVE"}
            </div>
          </button>

          {/* Thermal Runway Acceleration dT/dt */}
          <button
            onClick={() => setFaultInjectThermalRateExceeded?.(!faultInjectThermalRateExceeded)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectThermalRateExceeded
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
            title="Simulate explosive physical thermal acceleration runaway gradient trip"
          >
            <span className="text-[10px] font-bold uppercase mb-1">Thermal dT/dt trip</span>
            <span className="text-[8px] text-slate-550 leading-tight mb-auto">Triggers high rise gradient (&gt;4.5 K/s)</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectThermalRateExceeded ? "T-03 Runaway" : "INACTIVE"}
            </div>
          </button>

          {/* Sensor ADC Dual-Channel mismatch */}
          <button
            onClick={() => setFaultInjectSensorDivergence?.(!faultInjectSensorDivergence)}
            className={`flex flex-col items-center justify-center p-3 rounded border text-center font-mono select-none cursor-pointer transition h-24 ${
              faultInjectSensorDivergence
                ? "bg-rose-950/20 border-rose-800 text-rose-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750"
            }`}
            title="Introduce 25K offset between primary and secondary thermocouples to check redundancy"
          >
            <span className="text-[10px] font-bold uppercase mb-1">ADC Divergence</span>
            <span className="text-[8px] text-slate-505 leading-tight mb-auto">25 Kelvin offset on redundant ADC 1 channel</span>
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-rose-900 bg-rose-950/20 w-fit mt-1">
              {faultInjectSensorDivergence ? "T-04 DIV-ERR" : "INACTIVE"}
            </div>
          </button>
        </div>

      </div>

      {/* 4. PRESETS & INTERLOCK SETTINGS */}
      <div className="mt-6 pt-5 border-t border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Settings Section */}
          <div className="space-y-4">
            <span className="text-[10px] text-slate-400 font-mono font-bold block pb-1 border-b border-slate-850 uppercase tracking-wide">
              4A. VHDL INTERLOCK INTERFACE
            </span>
            <div className="bg-slate-900 border border-slate-850 p-4 rounded space-y-3 font-mono text-[10px]">
              <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={warningAutoDismiss}
                  onChange={(e) => setWarningAutoDismiss?.(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500 h-3.5 w-3.5"
                />
                <div>
                  <span className="text-slate-200 font-bold uppercase transition group-hover:text-cyan-400">
                    Auto-Dismiss Efficiency Warnings
                  </span>
                  <p className="text-[9.5px] text-slate-500 mt-1 leading-relaxed animate-fade-in">
                    Automatically dismisses power trajectory efficiency warning overlays precisely after 10 seconds of simulation ticks.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Presets Creator */}
          <div className="space-y-4">
            <span className="text-[10px] text-slate-400 font-mono font-bold block pb-1 border-b border-slate-850 uppercase tracking-wide">
              4B. CUSTOM MULTI-FAULT SCENARIO PRESETS
            </span>
            <div className="space-y-3">
              <form onSubmit={saveFaultPreset} className="flex gap-2">
                <input
                  type="text"
                  maxLength={36}
                  placeholder="e.g. Avionics Decouple"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="bg-slate-900 border border-slate-850 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 flex-1 min-w-0"
                />
                <button
                  type="submit"
                  className="bg-cyan-950/40 border border-cyan-800 hover:bg-cyan-900/60 transition text-cyan-400 font-mono font-bold text-[9px] px-3.5 rounded cursor-pointer whitespace-nowrap"
                >
                  SAVE OVERRIDES
                </button>
              </form>

              {/* Active Presets list */}
              <div className="bg-slate-900/40 border border-slate-850/60 rounded p-2.5 max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                {faultPresets.length === 0 ? (
                  <span className="text-slate-600 font-mono text-[9px] block text-center italic py-4 select-none">
                    No custom presets logged. Type a name to capture active switches.
                  </span>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {faultPresets.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => applyFaultPreset(p.states)}
                        className="flex justify-between items-center bg-slate-950 border border-slate-850 hover:bg-slate-900 hover:border-slate-700 p-2 rounded cursor-pointer group/item transition select-none"
                      >
                        <div className="font-mono text-[10px] flex items-center gap-1.5">
                          <span className="text-cyan-400 font-bold">⚙️</span>
                          <span className="text-slate-350 font-bold font-display group-hover/item:text-slate-100">{p.name}</span>
                          <span className="text-[8px] text-slate-550">
                            ({Object.keys(p.states).length} active)
                          </span>
                        </div>
                        <button
                          onClick={(e) => deleteFaultPreset(idx, e)}
                          title="Purge preset blueprint"
                          className="text-slate-500 hover:text-red-400 font-extrabold text-[11px] px-1.5 py-0.5 rounded transition cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="block text-[8px] text-slate-500 font-mono leading-normal select-none">
                💡 Tip: Turn on the exact checklist of registers above (e.g. Temp Stuck, CDC desync), input a blueprint name, and save to configure instantaneous multi-wire trips.
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
