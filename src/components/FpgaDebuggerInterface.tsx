/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { Cpu, Terminal, RefreshCw, Zap, Sliders, Play, Database, FileText, CheckCircle, AlertTriangle, Activity, Workflow } from "lucide-react";
import { HexagramState, HexagramStateLabels, ContactorState, ChokeState } from "../types";
import { useTheme } from "../ThemeContext";
import AxiMonitorScoreboard from "./AxiMonitorScoreboard";

// Standard IEEE 1149.1 TAP Controller State Machine enum
export enum JtagTapState {
  TEST_LOGIC_RESET = "Test-Logic-Reset",
  RUN_TEST_IDLE = "Run-Test/Idle",
  SELECT_DR_SCAN = "Select-DR-Scan",
  CAPTURE_DR = "Capture-DR",
  SHIFT_DR = "Shift-DR",
  EXIT1_DR = "Exit1-DR",
  PAUSE_DR = "Pause-DR",
  EXIT2_DR = "Exit2-DR",
  UPDATE_DR = "Update-DR",
  SELECT_IR_SCAN = "Select-IR-Scan",
  CAPTURE_IR = "Capture-IR",
  SHIFT_IR = "Shift-IR",
  EXIT1_IR = "Exit1-IR",
  PAUSE_IR = "Pause-IR",
  EXIT2_IR = "Exit2-IR",
  UPDATE_IR = "Update-IR"
}

// TAP instruction set
export type JtagInstruction = "BYPASS" | "IDCODE" | "EXTEST" | "SAMPLE_PRELOAD" | "USERCODE";

interface FpgaDebuggerInterfaceProps {
  currentHexagram: HexagramState;
  chokeState: ChokeState;
  tickCounter: number;
  contactorStates: ContactorState[];
  avgElectrodeTemp: number;
  busCurrentA: number;
  plenumPressure: number;
  isHwAccelerated: boolean;
  setIsHwAccelerated: (accel: boolean) => void;
  onAddLogEntry?: (subsystem: any, level: any, msg: string) => void;
  onInjectInlinedFault?: (faultCode: string) => void;
  systemLogs?: any[];

  // AXI performance counters props
  statWriteCount?: number;
  statReadCount?: number;
  avgWriteLatency?: number;
  avgReadLatency?: number;
  statHexagramWriteCount?: number;
  statTickWriteCount?: number;
  statAxiErrorCount?: number;
  axiLatencyHistory?: Array<{ read: number; write: number }>;
}

export default function FpgaDebuggerInterface({
  currentHexagram,
  chokeState,
  tickCounter,
  contactorStates,
  avgElectrodeTemp,
  busCurrentA,
  plenumPressure,
  isHwAccelerated,
  setIsHwAccelerated,
  onAddLogEntry,
  onInjectInlinedFault,
  systemLogs = [],
  statWriteCount = 0,
  statReadCount = 0,
  avgWriteLatency = 0,
  avgReadLatency = 0,
  statHexagramWriteCount = 0,
  statTickWriteCount = 0,
  statAxiErrorCount = 0,
  axiLatencyHistory = []
}: FpgaDebuggerInterfaceProps) {
  const { theme: appTheme } = useTheme();
  const subTheme = appTheme === "High-Contrast Blueprint" ? "blueprint" : "dark";

  // Tab State: CLASSIC debugger vs AXI_VIP verifier
  const [debuggerSubTab, setDebuggerSubTab] = useState<"CLASSIC" | "AXI_VIP">("CLASSIC");
  
  // ==========================================================================
  // JTAG-TAP STATE MACHINE SIMULATOR
  // ==========================================================================
  const [jtagState, setJtagState] = useState<JtagTapState>(JtagTapState.TEST_LOGIC_RESET);
  const [jtagInstruction, setJtagInstruction] = useState<JtagInstruction>("IDCODE");
  const [jtagDrRegister, setJtagDrRegister] = useState<string>("01010000010011110100011100110010"); // Magic ID "POG2" (0x504F4732)
  const [jtagHistory, setJtagHistory] = useState<string[]>(["TAP Controller reset."]);
  const [jtagTdi, setJtagTdi] = useState<number>(1);
  const [jtagTdo, setJtagTdo] = useState<number>(0);

  // Transition JTAG State Machine
  const handleJtagTick = (tms: number) => {
    let next: JtagTapState = JtagTapState.TEST_LOGIC_RESET;
    switch (jtagState) {
      case JtagTapState.TEST_LOGIC_RESET:
        next = tms ? JtagTapState.TEST_LOGIC_RESET : JtagTapState.RUN_TEST_IDLE;
        break;
      case JtagTapState.RUN_TEST_IDLE:
        next = tms ? JtagTapState.SELECT_DR_SCAN : JtagTapState.RUN_TEST_IDLE;
        break;
      case JtagTapState.SELECT_DR_SCAN:
        next = tms ? JtagTapState.SELECT_IR_SCAN : JtagTapState.CAPTURE_DR;
        break;
      case JtagTapState.CAPTURE_DR:
        next = tms ? JtagTapState.EXIT1_DR : JtagTapState.SHIFT_DR;
        break;
      case JtagTapState.SHIFT_DR:
        next = tms ? JtagTapState.EXIT1_DR : JtagTapState.SHIFT_DR;
        break;
      case JtagTapState.EXIT1_DR:
        next = tms ? JtagTapState.UPDATE_DR : JtagTapState.PAUSE_DR;
        break;
      case JtagTapState.PAUSE_DR:
        next = tms ? JtagTapState.EXIT2_DR : JtagTapState.PAUSE_DR;
        break;
      case JtagTapState.EXIT2_DR:
        next = tms ? JtagTapState.UPDATE_DR : JtagTapState.SHIFT_DR;
        break;
      case JtagTapState.UPDATE_DR:
        next = tms ? JtagTapState.SELECT_DR_SCAN : JtagTapState.RUN_TEST_IDLE;
        break;
      case JtagTapState.SELECT_IR_SCAN:
        next = tms ? JtagTapState.TEST_LOGIC_RESET : JtagTapState.CAPTURE_IR;
        break;
      case JtagTapState.CAPTURE_IR:
        next = tms ? JtagTapState.EXIT1_IR : JtagTapState.SHIFT_IR;
        break;
      case JtagTapState.SHIFT_IR:
        next = tms ? JtagTapState.EXIT1_IR : JtagTapState.SHIFT_IR;
        break;
      case JtagTapState.EXIT1_IR:
        next = tms ? JtagTapState.UPDATE_IR : JtagTapState.PAUSE_IR;
        break;
      case JtagTapState.PAUSE_IR:
        next = tms ? JtagTapState.EXIT2_IR : JtagTapState.PAUSE_IR;
        break;
      case JtagTapState.EXIT2_IR:
        next = tms ? JtagTapState.UPDATE_IR : JtagTapState.SHIFT_IR;
        break;
      case JtagTapState.UPDATE_IR:
        next = tms ? JtagTapState.SELECT_DR_SCAN : JtagTapState.RUN_TEST_IDLE;
        break;
    }

    setJtagState(next);
    
    // Core actions on Tap State changes
    let tdoVal = 0;
    if (next === JtagTapState.SHIFT_DR) {
      // Shift TDI bit into DR register representation
      setJtagDrRegister((prev) => {
        const nextReg = tdiScalar() + prev.slice(0, 31);
        tdoVal = parseInt(prev[31]);
        return nextReg;
      });
      setJtagTdo(tdoVal);
    } else if (next === JtagTapState.UPDATE_DR) {
      if (onAddLogEntry) {
        onAddLogEntry("INTERLOCK_SEQUENCE", "SUCCESS", `JTAG TAP Update-DR complete. Loaded DR latch: 0x${parseInt(jtagDrRegister, 2).toString(16).toUpperCase()}`);
      }
    } else if (next === JtagTapState.UPDATE_IR) {
      if (onAddLogEntry) {
        onAddLogEntry("INTERLOCK_SEQUENCE", "SUCCESS", `JTAG TAP instruction latched: ${jtagInstruction}`);
      }
    } else if (next === JtagTapState.CAPTURE_DR) {
      // Load selected register value into register boundaryscan cells representation
      if (jtagInstruction === "IDCODE") {
        setJtagDrRegister("01010000010011110100011100110010"); // Magic 0x504F4732
      } else {
        const currentHexRegVal = currentHexagram.toString(2).padStart(32, "0");
        setJtagDrRegister(currentHexRegVal);
      }
    }

    setJtagHistory((prev) => [
      `[TMS=${tms}] Transition: ${jtagState} ➔ ${next}`,
      ...prev.slice(0, 7)
    ]);
  };

  const tdiScalar = () => jtagTdi.toString();

  // Reset JTAG
  const handleJtagReset = () => {
    setJtagState(JtagTapState.TEST_LOGIC_RESET);
    setJtagHistory(["JTAG-TAP forced transition to Test-Logic-Reset."]);
    if (onAddLogEntry) {
      onAddLogEntry("INTERLOCK_SEQUENCE", "WARNING", "JTAG physical tap: Forced TLR synchronization (TMS high-burst sequence).");
    }
  };

  // ==========================================================================
  // AXI4-LITE REGISTERS & VIRTUAL CONSOLE ACTIONS
  // ==========================================================================
  const [terminalOffset, setTerminalOffset] = useState<string>("0x10");
  const [terminalValue, setTerminalValue] = useState<string>("0x00000038");
  const [terminalLog, setTerminalLog] = useState<string[]>([
    "AXI4-Lite address decoder bound: Base 0x43C00000",
    "Type 'read' or 'write' offset values to command simulation registers directly."
  ]);

  // ==========================================================================
  // DEEP UART DIAGNOSTICS & TELEMETRY INGESTION STATES
  // ==========================================================================
  const [uartCommand, setUartCommand] = useState<string>("");
  const [uartLogs, setUartLogs] = useState<string[]>([
    "POG2 Diagnostics UART Console [Baud: 115200 bps | Data bits: 8 | Parity: None | Flow: Off]",
    "System Sovereign 'One Limb' telemetry bus active. Type 'help' for PLC query options.",
  ]);
  const [queryLevel, setQueryLevel] = useState<string>("ALL");
  const [querySubsystem, setQuerySubsystem] = useState<string>("ALL");
  const [querySearch, setQuerySearch] = useState<string>("");
  const [showPayloadJson, setShowPayloadJson] = useState<boolean>(true);
  const [lastIngestedTelemetry, setLastIngestedTelemetry] = useState<{
    domain: string;
    source: string;
    data: string;
    timestamp: string;
    payload?: any;
  } | null>({
    domain: "NETWORK",
    source: "Globalping API Node #DE-725",
    data: "Probe HTTP validation match 'CF-IPCountry=DE' (Latency: 18.2ms, SNR=Good)",
    timestamp: new Date().toISOString().substring(11, 19),
    payload: {
      "id": "m_gping_725",
      "type": "ping",
      "status": "finished",
      "target": "cobe-globe.workers.dev",
      "probesCount": 1,
      "results": [
        {
          "probe": { "continent": "EU", "country": "DE", "city": "Berlin", "asn": 3320 },
          "result": { "status": "finished", "stats": { "min": 18.1, "avg": 18.2, "max": 18.5, "rcv": 3, "drop": 0 } }
        }
      ]
    }
  });
  const [fifoIndex, setFifoIndex] = useState<number>(0);

  // Compute live values for registers dynamically mirroring core simulation parameters
  const computedRegMap = useMemo<Record<string, { name: string; access: string; desc: string; value: string }>>(() => {
    return {
      "0x00": { name: "ID", access: "RO", desc: "Magic Header 'POG2'", value: "0x504F4732" },
      "0x04": { name: "REV", access: "RO", desc: "FPGA revision 1.0.0", value: "0x00010000" },
      "0x08": { name: "STATUS", access: "RO", desc: "Global status flags", value: `0x${((currentHexagram > 0 ? 1 : 0) | (chokeState > JokeStateInactive() ? 8 : 0) | (tickCounter > 0 ? 64 : 0)).toString(16).padStart(8, "0").toUpperCase()}` },
      "0x0C": { name: "CONTROL", access: "RW", desc: "Global module enable lines", value: "0x0000007F" },
      "0x10": { name: "HEXAGRAM_STATE", access: "RO", desc: "Active 6-bit state index", value: `0x${currentHexagram.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x14": { name: "YAO_LINES", access: "RW", desc: "Active overridden lines bitmask", value: `0x${currentHexagram.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x20": { name: "STAT_WRITE_COUNT", access: "RO", desc: "AXI performance: Total write transaction count", value: `0x${statWriteCount.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x24": { name: "STAT_READ_COUNT", access: "RO", desc: "AXI performance: Total read transaction count", value: `0x${statReadCount.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x28": { name: "AVG_WRITE_LATENCY", access: "RO", desc: "AXI performance: Average write latency (cycles)", value: `0x${avgWriteLatency.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x30": { name: "AVG_READ_LATENCY", access: "RO", desc: "AXI performance: Average read latency (cycles)", value: `0x${avgReadLatency.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x34": { name: "STAT_HEX_WRITE_COUNT", access: "RO", desc: "AXI performance: write trigger count to reg_hexagram_target", value: `0x${statHexagramWriteCount.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x38": { name: "STAT_TICK_WRITE_COUNT", access: "RO", desc: "AXI performance: write trigger count to reg_tick_period", value: `0x${statTickWriteCount.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x40": { name: "STAT_AXI_ERR_COUNT", access: "RO", desc: "AXI performance: Total bus transaction error count", value: `0x${statAxiErrorCount.toString(16).padStart(8, "0").toUpperCase()}` },
      "0x3C": { name: "TICK_DURATION_MS", access: "RW", desc: "Canonical metabolic clock ticks period", value: "0x00000258" },
      "0x44": { name: "CONTACTOR_STATUS", access: "RO", desc: "10-CH feedback bitfield status", value: `0x${contactorStates.reduce((acc, current, idx) => acc | (current << (idx * 3)), 0).toString(16).toUpperCase()}` },
      "0x54": { name: "CHOKE_FREQUENCY", access: "RW", desc: "Coil driving resonance freq (Hz)", value: "0x00001964" },
      "0x58": { name: "SENSOR_ADC_0", access: "RO", desc: "Primary electrode heat raw data", value: `0x${Math.round(avgElectrodeTemp * 16).toString(16).padStart(8, "0").toUpperCase()}` },
      "0x70": { name: "SENSOR_BUS_I", access: "RO", desc: "Induction line flow (x0.1A)", value: `0x${Math.round(busCurrentA * 10).toString(16).padStart(8, "0").toUpperCase()}` },
      "0x74": { name: "SENSOR_PLENUM_P", access: "RO", desc: "Reactor casing chamber compression", value: `0x${Math.round(plenumPressure * 100).toString(16).padStart(8, "0").toUpperCase()}` },
      "0xB8": { name: "FAULT_INJECT", access: "WO", desc: "Write offset inject triggers", value: "0x00000000" },
      "0xBC": { name: "FAULT_LOG", access: "RC", desc: "Diagnostic event tracking buffer (FIFO)", value: "0x00012004" },
      "0xCC": { name: "INTERRUPT_MASK", access: "RW", desc: "Global PLC interrupt lines mask", value: "0x000007FF" }
    };
  }, [currentHexagram, chokeState, tickCounter, contactorStates, avgElectrodeTemp, busCurrentA, plenumPressure, statWriteCount, statReadCount, avgWriteLatency, avgReadLatency, statHexagramWriteCount, statTickWriteCount, statAxiErrorCount]);

  function JokeStateInactive() {
    return 0;
  }

  // AXI Register read execution
  const executeAxiRead = () => {
    const rawOffset = terminalOffset.trim();
    const offset = normalizeHexOffset(rawOffset);
    
    // Dequeue logs sequentially from FAULT_LOG 0xBC FIFO
    if (offset === "0xBC") {
      const faults = systemLogs.filter(l => l.level === "CRITICAL" || l.level === "WARNING");
      if (faults.length > 0) {
        const targetLog = faults[fifoIndex % faults.length];
        const nextIndex = fifoIndex + 1;
        setFifoIndex(nextIndex);
        
        const levelCode = targetLog.level === "CRITICAL" ? 3 : 2;
        const subIndex = 4; // Mock subsystem index code
        const encodedRegValue = `0x${((levelCode << 24) | (subIndex << 16) | (targetLog.tick & 0xFFFF)).toString(16).padEnd(8, "0").toUpperCase()}`;
        
        appendTerminalLog(`AXI_READ [FIFO Address: 0x43C000BC] ➔ FAULT_LOG [Msg ${nextIndex}/${faults.length}]: ${encodedRegValue}`);
        appendTerminalLog(`  ➔ DECODED: Subid: ${targetLog.subsystem} | Lvl: ${targetLog.level} | Tick Trigger: ${targetLog.tick}`);
        appendTerminalLog(`  ➔ PAYLOAD: "${targetLog.message}"`);
      } else {
        appendTerminalLog(`AXI_READ [FIFO Address: 0x43C000BC] ➔ FAULT_LOG: Value = 0x00000000 (FIFO Queue Empty)`);
      }
      return;
    }

    const reg = (computedRegMap as any)[offset];

    if (reg) {
      appendTerminalLog(`AXI_READ [Address: 0x43C000${offset.replace("0x", "")}] ➔ ${reg.name}: Value = ${reg.value} (${reg.desc})`);
    } else {
      appendTerminalLog(`AXI_DECERR [Address: 0x43C000${offset.replace("0x", "") || "DEAD"}] ➔ Interconnect Master Decode Error (unmapped address SLVERR)`);
      if (onAddLogEntry) {
        onAddLogEntry("SECURE_LOCK", "CRITICAL", `AXI DECERR interface failure seeking offset ${offset}`);
      }
    }
  };

  // UART Command Executor
  const executeUartCommand = (e?: React.FormEvent, customCmd?: string) => {
    if (e) e.preventDefault();
    const cmdInput = customCmd !== undefined ? customCmd : uartCommand;
    const cmdClean = cmdInput.trim();
    if (!cmdClean) return;

    setUartLogs(prev => [...prev, `POG2_MHD_UART$ ${cmdClean}`]);
    if (customCmd === undefined) {
      setUartCommand("");
    }

    const parts = cmdClean.split(" ");
    const verb = parts[0].toLowerCase();

    if (verb === "help") {
      setUartLogs(prev => [
        ...prev,
        "Available CLI commands:",
        "  help                               - View this helper guide",
        "  clear                              - Clear the command stream history",
        "  status                             - Request MCU environment telemetry status",
        "  get_logs [search_term]             - Fetch on-board flash logs matching search string",
        "  get_logs --level=[CRITICAL|WARN]   - Query diagnostic logs filtered by constraint",
        "  ingest --domain=[domain_name]      - Stream simulated external SITL telemetry frame",
        "         (Domains: network, underwater, land, sonar, satellite, air, maritime)",
      ]);
    } else if (verb === "clear") {
      setUartLogs([]);
    } else if (verb === "status") {
      setUartLogs(prev => [
        ...prev,
        `[STATUS_QUERY] Core Clock: ${isHwAccelerated ? "250.0Mhz" : "200.0Mhz (Degraded)"}`,
        `[STATUS_QUERY] Active state: Hexagram [State: ${currentHexagram}]`,
        `[STATUS_QUERY] Electrodes nominal heat: ${avgElectrodeTemp.toFixed(1)}K`,
        `[STATUS_QUERY] Current flow: ${busCurrentA.toFixed(1)}A | Pressure: ${plenumPressure.toFixed(2)}atm`,
        `[STATUS_QUERY] AXI Diagnostic FIFO Queue count index: ${fifoIndex}`
      ]);
    } else if (verb === "get_logs") {
      const arg = parts[1] || "";
      let filtered = [...systemLogs];
      
      if (arg.startsWith("--level=")) {
        const lvl = arg.substring(8).toUpperCase();
        filtered = systemLogs.filter(l => l.level.includes(lvl) || (lvl === "WARN" && l.level === "WARNING"));
      } else if (arg) {
        filtered = systemLogs.filter(l => 
          l.message.toLowerCase().includes(arg.toLowerCase()) || 
          String(l.subsystem).toLowerCase().includes(arg.toLowerCase())
        );
      }

      if (filtered.length === 0) {
        setUartLogs(prev => [...prev, "  ➔ Query returned 0 matching records."]);
      } else {
        setUartLogs(prev => [
          ...prev,
          `  ➔ Query returned ${filtered.length} entries out of total ${systemLogs.length} logs:`,
          ...filtered.map(l => `    [${l.timestamp}] [Tick #${l.tick}] [${l.subsystem}] [${l.level}] ${l.message}`)
        ]);
      }
    } else if (verb === "ingest") {
      const option = parts[1] || "--domain=all";
      let domain = "network";
      if (option.startsWith("--domain=")) {
        domain = option.substring(9).toLowerCase();
      }

      const simTelems: Record<string, { source: string; data: string; payload: any }> = {
        network: {
          source: "Globalping API Node #FR-901 (Paris, FR)",
          data: `External Validation Ping response to Cobe globe endpoint. Rtt: 14.5ms, geolocation matched CF-IPCountry=FR. Delta verification status: Verified OK.`,
          payload: {
            id: "m_gping_901a8f",
            type: "ping",
            status: "finished",
            target: "cobe-globe.workers.dev",
            probesCount: 10,
            results: [
              {
                probe: { continent: "EU", country: "FR", city: "Paris", asn: 29241, provider: "OVH SAS" },
                result: { status: "finished", stats: { min: 14.2, avg: 14.5, max: 15.1, rcv: 3, drop: 0 } }
              },
              {
                probe: { continent: "EU", country: "DE", city: "Frankfurt", asn: 31333, provider: "DigitalOcean" },
                result: { status: "finished", stats: { min: 18.2, avg: 18.4, max: 18.9, rcv: 3, drop: 0 } }
              }
            ]
          }
        },
        underwater: {
          source: "Stonefish ROS 2 Autonomous Sub",
          data: `Depth Pressure msg (sensor_msgs/FluidPressure): ${plenumPressure.toFixed(2)} atm | Range DVL Sonar (sensor_msgs/Range): ${(4.0 + Math.random() * 2).toFixed(2)}m | Water temperature Nom: 284K.`,
          payload: {
            topic: "/auv/state/fluid_pressure",
            msg_type: "sensor_msgs/FluidPressure",
            header: { seq: 2841, stamp: { secs: Math.floor(Date.now() / 1000), nsecs: 420000 }, frame_id: "stonefish_dvl_link" },
            fluid_pressure: Number(plenumPressure.toFixed(2)),
            variance: 0.005,
            dvl_range: Number((4.0 + Math.random() * 2).toFixed(2)),
            water_temp_kelvin: 284.15
          }
        },
        land: {
          source: "ArduPilot SITL Rover (Skid-steer mode)",
          data: `MAVLink GLOBAL_POSITION_INT received: latitude=37.77492, longitude=-122.41941, GPS heading=181.5°, Battery status=92% (Nominal voltage 12.6V).`,
          payload: {
            mavpackettype: "GLOBAL_POSITION_INT",
            time_boot_ms: 1948810,
            lat: 377749200,
            lon: -1224194100,
            alt: 12200,
            relative_alt: 150,
            vx: 12,
            vy: -3,
            vz: 0,
            hdg: 18150,
            battery_remaining_percent: 92
          }
        },
        sonar: {
          source: "Ultrasonic Acoustic Bus",
          data: `Sonar Array Forward Arc rangefinder scan: /auv/sonar range=3.14m, /ugv/sonar range=0.00m (Not deployed), /uav/sonar range=12.2m.`,
          payload: {
            topic: "/auv/sonar/scan",
            msg_type: "sensor_msgs/Range",
            header: { seq: 1422, stamp: { secs: Math.floor(Date.now() / 1000), nsecs: 110000 }, frame_id: "sonar_front_pog2" },
            radiation_type: 0,
            field_of_view: 0.523,
            min_range: 0.2,
            max_range: 20.0,
            range: 3.14
          }
        },
        satellite: {
          source: "SatNOGS Downlink Receiver #3315",
          data: `LEO CubeSat VHF decoded beacon: SNR=12.8dB, Orbit lock state: Confirmed. TLE Elements updated from Celestrak DB. Parity CRC checks: Passed.`,
          payload: {
            id: 99281,
            satellite_name: "COBE-SAT-1",
            tle: [
              "1 25544U 98067A   26158.88234321  .00016717  00000-0  30123-3 0  9011",
              "2 25544  51.6421 123.1112 0002130  82.1123 278.4321 15.50021312  4231"
            ],
            frequency_hz: 145920000,
            snr_db: 12.8,
            orbit_lock: true,
            downlink_status: "sync_ok",
            frame_hex: "FF:A8:12:0C:0E:99"
          }
        },
        air: {
          source: "OpenSky Live ADS-B stream",
          data: "Transit trajectory safety bounds validation: Atmospheric humidity 46%, Go/No-Go launcher status: GO.",
          payload: {
            transit_safety_status: "GO",
            opensky_air_traffic: {
              states: [
                { icao24: "3c49a2", callsign: "DLH114 ", origin_country: "Germany", time_position: 1782410, longitude: 8.56, latitude: 50.05, baro_altitude: 2450.0, on_ground: false, velocity: 124.5 }
              ]
            },
            meteorology: {
              latitude: 52.52,
              longitude: 13.41,
              elevation: 34.0,
              temperature_2m: 18.5,
              relative_humidity_2m: 46.0,
              surface_pressure: 1011.5
            }
          }
        },
        maritime: {
          source: "aprs.fi vessel tracking AIS",
          data: "Port area tracking active. Vessel: POG2_MHD_RESCUE, Speed over ground: 4.5kt, position locked.",
          payload: {
            mmsi: 211239922,
            vessel_name: "POG2_MHD_RESCUE",
            speed_over_ground_kts: 4.5,
            course_over_ground_deg: 241.0,
            latitude: 54.128,
            longitude: 11.942,
            navigation_status: "under_way_using_engine"
          }
        }
      };

      const selected = simTelems[domain] || simTelems["network"];
      const ts = new Date().toISOString().substring(11, 19);
      setLastIngestedTelemetry({
        domain: domain.toUpperCase(),
        source: selected.source,
        data: selected.data,
        timestamp: ts,
        payload: selected.payload
      });

      if (onAddLogEntry) {
        onAddLogEntry(
          "SYSTEM" as any, 
          "SUCCESS", 
          `TELEMETRY INGESTED: [${domain.toUpperCase()}] Sovereign data limb sync from ${selected.source}.`
        );
      }

      setUartLogs(prev => [
        ...prev,
        `[INGEST] Ingestion sequence trigger [Topic: /telemetry/${domain}]`,
        `  ➔ Source: ${selected.source}`,
        `  ➔ Data: ${selected.data}`,
        `  ➔ Status: Sovereign dynamic hexagram constitutional validation: Normal.`
      ]);
    } else {
      setUartLogs(prev => [...prev, `Unknown command '${verb}'. Type 'help' for guidance.`]);
    }
  };

  // AXI Register write execution
  const executeAxiWrite = () => {
    const rawOffset = terminalOffset.trim();
    const offset = normalizeHexOffset(rawOffset);
    const rawVal = terminalValue.trim();
    const valHex = rawVal.startsWith("0x") ? rawVal : `0x${rawVal}`;
    const valueInt = parseInt(valHex, 16);

    const reg = (computedRegMap as any)[offset];
    if (reg) {
      if (reg.access === "RO") {
        appendTerminalLog(`AXI_SLVERR: Target register '${reg.name}' is read-only. Write cycle rejected by slave.`);
        return;
      }

      appendTerminalLog(`AXI_WRITE [Address: 0x43C000${offset.replace("0x", "")}] ➔ Written ${reg.name} = ${valHex} (OK)`);
      
      // Dynamic logic triggers inside our debugger simulation from custom writes
      if (offset === "0xB8" && onInjectInlinedFault) {
        // Trigger simulated fault mapping based on register spec
        if (valueInt === 0x4000) {
          onInjectInlinedFault("E-01"); // Bus transient trigger
        } else if (valueInt === 0x8000) {
          onInjectInlinedFault("E-02"); // Regulator Command Mismatch
        } else if (valueInt === 0x0800) {
          onInjectInlinedFault("T-01"); // Segment overheating
        } else if (valueInt === 0x20000) {
          onInjectInlinedFault("C-01"); // Metastability
        } else {
          appendTerminalLog(`AXI_INFO: Custom payload register write captured. No predefined interlock script.`);
        }
      }
    } else {
      appendTerminalLog(`AXI_DECERR: Target address unmapped.`);
    }
  };

  const normalizeHexOffset = (str: string) => {
    let out = str;
    if (!out.startsWith("0x")) {
      out = `0x${out}`;
    }
    return out.toUpperCase();
  };

  const appendTerminalLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTerminalLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  };

  // ==========================================================================
  // ACCELERATOR MATRIX METRICS (DSP48E1 VHDL OFFLOADING)
  // ==========================================================================
  // Calculations comparison for Taylor sequence derivative prediction 5th-order steps and CRC-8 bitwise loops
  const hwLatencyUs = 0.32;
  const swLatencyUs = 35.20;

  const hwThroughput = "2.40M packets/sec";
  const swThroughput = "45.0k packets/sec";

  const timingSlackHw = "+2.45 ns";
  const timingSlackSw = "+0.01 ns";

  const powerHw = "140 mW";
  const powerSw = "360 mW";

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between relative overflow-hidden" id="fpga-debugger-interface-subsystem-wrapper">
      <div className="absolute top-0 right-0 p-1.5 bg-yellow-955 border-b border-l border-yellow-905 rounded-bl font-mono text-[8.5px] text-yellow-405 select-none font-bold uppercase tracking-widest z-10 animate-pulse">
        REAL-TIME FPGA MONITOR
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b border-slate-900 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-yellow-400" />
          <h3 className="text-xs font-bold text-slate-300 font-mono tracking-wider">
            FPGA LOW-LEVEL DEBUGGER & CO-PROCESSOR HARMONICS
          </h3>
        </div>

        {/* Tab Controls to toggle JTAG classical vs AXI4-Lite VIP Verification Scoreboard */}
        <div className="flex items-center bg-slate-950 border border-slate-900 rounded p-1 gap-1 select-none font-mono">
          <button
            onClick={() => setDebuggerSubTab("CLASSIC")}
            className={`px-3 py-1 text-[8.5px] font-bold rounded cursor-pointer transition flex items-center gap-1.5 ${
              debuggerSubTab === "CLASSIC" 
                ? "bg-yellow-955 text-yellow-400 border border-yellow-900" 
                : "text-slate-500 hover:text-slate-350 bg-transparent border border-transparent"
            }`}
          >
            <Cpu className="w-3 h-3" />
            CLASSIC JTAG TAP & REGISTERS
          </button>
          
          <button
            onClick={() => setDebuggerSubTab("AXI_VIP")}
            className={`px-3 py-1 text-[8.5px] font-bold rounded cursor-pointer transition flex items-center gap-1.5 ${
              debuggerSubTab === "AXI_VIP" 
                ? "bg-cyan-955 text-cyan-400 border border-cyan-800" 
                : "text-slate-500 hover:text-slate-350 bg-transparent border border-transparent"
            }`}
          >
            <Activity className="w-3 h-3 animate-pulse" />
            AXI4-LITE VIP & SCOREBOARD
          </button>
        </div>
      </div>

      <div>
        {debuggerSubTab === "AXI_VIP" ? (
          <AxiMonitorScoreboard
            currentHexagram={currentHexagram}
            chokeState={chokeState}
            tickCounter={tickCounter}
            contactorStates={contactorStates}
            avgElectrodeTemp={avgElectrodeTemp}
            busCurrentI={busCurrentA}
            plenumPressure={plenumPressure}
            theme={subTheme}
            onAddLog={(subsys, level, msg) => {
              if (onAddLogEntry) {
                onAddLogEntry(subsys as any, level as any, msg);
              }
            }}
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* ====================================================================
            PANEL 1: JTAG-TAP STATE MACHINE CONTROLLER (xl:col-span-5)
            ==================================================================== */}
        <div className="xl:col-span-5 bg-slate-900/40 border border-slate-850 p-4 rounded-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 select-none">
              <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-widest flex items-center gap-1">
                IEEE 1149.1 JTAG TAP State Controller
              </span>
              <button 
                onClick={handleJtagReset}
                className="text-[7.5px] font-mono px-1 border border-yellow-900/60 bg-yellow-950/20 text-yellow-400 hover:bg-yellow-950 hover:text-white rounded transition cursor-pointer"
              >
                HARD RESET TAP
              </button>
            </div>

            <p className="text-[9px] font-mono text-slate-500 leading-normal mb-3 leading-relaxed">
              Active JTAG TAP state machine emulator. Click TMS lines to transition or inject TAP boundary scan directives.
            </p>

            {/* Micro visual map of IEEE TAP Controller States */}
            <div className="grid grid-cols-4 gap-1.5 p-2 bg-slate-950/40 border border-slate-900 rounded font-mono text-[7px] max-h-[170px] overflow-y-auto mb-3">
              {Object.values(JtagTapState).map((st) => {
                const isActive = jtagState === st;
                return (
                  <div 
                    key={st}
                    className={`p-1 border rounded text-center truncate ${
                      isActive 
                        ? "bg-yellow-950 border-yellow-500 text-yellow-300 font-extrabold animate-pulse ring-1 ring-yellow-500/30" 
                        : "bg-slate-900/30 border-slate-850 text-slate-650"
                    }`}
                    title={st}
                  >
                    {st.replace("-Reset", "").replace("-DR-Scan", "").replace("-IR-Scan", "")}
                  </div>
                );
              })}
            </div>

            {/* Controls for TDI / TDO / TMS */}
            <div className="border border-slate-850 bg-slate-950 rounded p-2.5 font-mono text-[9px] text-slate-400 space-y-1.5">
              <div className="flex justify-between border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">TAP Current Instruction:</span>
                <select 
                  value={jtagInstruction}
                  onChange={(e) => setJtagInstruction(e.target.value as JtagInstruction)}
                  className="bg-slate-900 border border-slate-800 text-yellow-400 font-bold px-1 py-0.2 rounded font-mono text-[9px] focus:outline-none"
                >
                  <option value="IDCODE">IDCODE (0x01)</option>
                  <option value="BYPASS">BYPASS (0xFF)</option>
                  <option value="EXTEST">EXTEST (0x02)</option>
                  <option value="SAMPLE_PRELOAD">SAMPLE (0x03)</option>
                  <option value="USERCODE">USER (0x08)</option>
                </select>
              </div>

              <div className="flex justify-between items-center text-[8.5px] border-b border-slate-900 pb-1.5">
                <span className="text-slate-500">Physical Probe lines status:</span>
                <div className="flex gap-4">
                  <span>TDI: <strong className="text-indigo-400">{jtagTdi}</strong></span>
                  <span>TDO: <strong className="text-emerald-400">{jtagTdo}</strong></span>
                  <span>TMS: <strong className="text-yellow-400">CLK</strong></span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[8px]">
                <span className="text-slate-500">Captured Data Register:</span>
                <span className="text-slate-400 tracking-tighter text-[7.5px] truncate max-w-[190px]" title={jtagDrRegister}>
                  {jtagDrRegister}
                </span>
              </div>
            </div>

            {/* Direct TMS transition clock lines */}
            <div className="flex gap-2 mt-3 text-[9px]">
              <button 
                onClick={() => handleJtagTick(0)}
                className="flex-1 py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white rounded font-mono text-center cursor-pointer transition"
              >
                Pulse TMS = <strong className="text-emerald-400">0</strong>
              </button>
              <button 
                onClick={() => handleJtagTick(1)}
                className="flex-1 py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white rounded font-mono text-center cursor-pointer transition"
              >
                Pulse TMS = <strong className="text-yellow-400">1</strong>
              </button>
            </div>
          </div>

          <div className="mt-3.5 border-t border-slate-900 pt-2.5">
            <span className="block text-[7.5px] font-mono text-slate-550 uppercase tracking-widest mb-1">TAP SEQUENCE LOGS</span>
            <div className="bg-slate-950/80 p-2 border border-slate-900 rounded font-mono text-[7.5px] text-slate-500 h-[68px] overflow-y-auto space-y-0.5">
              {jtagHistory.map((h, i) => (
                <div key={i} className="truncate select-none leading-relaxed">
                  <span className="text-slate-700">➔</span> {h}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ====================================================================
            PANEL 2: AXI4-LITE INTERFACING REGISTER MAP TERMINAL (xl:col-span-4)
            ==================================================================== */}
        <div className="xl:col-span-4 bg-slate-900/40 border border-slate-850 p-4 rounded-md flex flex-col justify-between">
          <div>
            <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-widest block mb-2">
              AXI4-Lite Address Register Decoder
            </span>

            {/* Mini register map table */}
            <div className="border border-slate-900 rounded bg-slate-950/40 max-h-[145px] overflow-y-auto font-mono text-[7.5px] mb-3">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-955 border-b border-slate-900 sticky top-0 text-slate-500 select-none z-10">
                  <tr>
                    <th className="p-1 pl-2">Offset</th>
                    <th className="p-1">Name</th>
                    <th className="p-1 text-center">Dir</th>
                    <th className="p-1 text-right pr-2">HexValue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-950 text-slate-400">
                  {(Object.entries(computedRegMap) as [string, { name: string; access: string; desc: string; value: string }][]).map(([offset, item]) => (
                    <tr 
                      key={offset} 
                      className="hover:bg-slate-900/60 cursor-pointer"
                      onClick={() => {
                        setTerminalOffset(offset);
                        setTerminalValue(item.value);
                      }}
                      title={item.desc}
                    >
                      <td className="p-1 pl-2 text-slate-500">{offset}</td>
                      <td className="p-1 text-slate-350 truncate max-w-[80px]">{item.name}</td>
                      <td className="p-1 text-center">
                        <span className={`px-0.5 rounded text-[6.5px] ${item.access === "RO" ? "text-cyan-400" : item.access === "WO" ? "text-yellow-400" : "text-amber-500"}`}>
                          {item.access}
                        </span>
                      </td>
                      <td className="p-1 text-right pr-2 text-yellow-400 font-bold">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Direct write emulator form */}
            <div className="space-y-1.5 border-t border-slate-900 pt-2 text-[9px] font-mono">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide block">AXI REG CONSOLE ACCESS</span>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[7.5px] text-slate-655 block">Offset:</label>
                  <input 
                    type="text" 
                    value={terminalOffset}
                    onChange={(e) => setTerminalOffset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[9px] focus:outline-none"
                    placeholder="0x10"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[7.5px] text-slate-655 block">Value (write):</label>
                  <input 
                    type="text" 
                    value={terminalValue}
                    onChange={(e) => setTerminalValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[9px] focus:outline-none"
                    placeholder="0x00000001"
                  />
                </div>
              </div>

              <div className="flex gap-1.5 pt-1">
                <button 
                  onClick={executeAxiRead}
                  className="flex-1 py-0.8 bg-cyan-950 hover:bg-cyan-900 text-cyan-400 rounded text-[8.5px] border border-cyan-850 cursor-pointer font-bold text-center"
                >
                  READ REG
                </button>
                <button 
                  onClick={executeAxiWrite}
                  className="flex-1 py-0.8 bg-amber-955/30 hover:bg-amber-900 text-amber-400 rounded text-[8.5px] border border-amber-900/60 cursor-pointer font-bold text-center"
                >
                  WRITE REG
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 bg-slate-950/70 p-2 rounded border border-slate-900">
            <span className="block text-[7.5px] font-mono text-slate-550 uppercase tracking-widest mb-1">AXI DECODER CONSOLE STREAM</span>
            <div className="font-mono text-[7.5px] text-slate-450 h-[68px] overflow-y-auto space-y-0.8 leading-normal select-text">
              {terminalLog.map((log, idx) => (
                <div key={idx} className="truncate">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ====================================================================
            PANEL 3: HARDWARE ACCELERATION / DSP OFFLOADING ANALYTICS (xl:col-span-3)
            ==================================================================== */}
        <div className="xl:col-span-3 bg-slate-900/40 border border-slate-850 p-4 rounded-md flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1.5 select-none">
              <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-widest flex items-center gap-1">
                DSP48E1 Math Acceleration
              </span>
              <span className={`text-[7px] font-bold px-1 py-0.1 border rounded ${
                isHwAccelerated 
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900 animate-pulse" 
                  : "bg-slate-900 text-slate-500 border-slate-800"
              }`}>
                {isHwAccelerated ? "DSP_ON" : "DSP_OFF"}
              </span>
            </div>

            <p className="text-[9px] font-mono text-slate-500 leading-normal mb-3.5 leading-relaxed">
              Provides offloading comparison for multi-cycle arithmetic tasks (Taylor polynomial predictions & CRC-8 packets parity encoding).
            </p>

            {/* Slider Switch Accelerator Card */}
            <div className="bg-slate-950 border border-slate-850 p-2.5 rounded mb-3.5 flex items-center justify-between font-mono select-none">
              <span className="text-[9.5px] text-slate-350 font-bold">ACCELERATOR BYPASS:</span>
              <button 
                onClick={() => {
                  setIsHwAccelerated(!isHwAccelerated);
                  if (onAddLogEntry) {
                    onAddLogEntry(
                      "CDC_CLOCKING", 
                      !isHwAccelerated ? "SUCCESS" : "WARNING", 
                      `FPGA Core reconfiguration: DSP Hard IP blocks ${!isHwAccelerated ? "Engaged" : "Disengaged (Bypassed)"}.`
                    );
                  }
                }}
                className={`px-3 py-1 text-[8.5px] font-extrabold rounded border transition cursor-pointer ${
                  isHwAccelerated 
                    ? "bg-emerald-950 text-emerald-400 border-emerald-800" 
                    : "bg-red-955/20 text-red-400 border-red-900/60"
                }`}
              >
                {isHwAccelerated ? "CO-PROC ACTIVE" : "SOFT SOFT-CORE MODE"}
              </button>
            </div>

            {/* Visual metrics comparison bars */}
            <div className="font-mono text-[8px] space-y-2 border-t border-slate-900 pt-3">
              <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block mb-1">LATENCY CRITICAL PATH (Predictor)</span>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>DSP48E1 Offloaded:</span>
                  <span className="font-bold text-emerald-400">{hwLatencyUs} µs</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1 relative overflow-hidden">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: "2%" }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-slate-500">
                  <span>General Micro-CPU Logic:</span>
                  <span className="font-bold text-red-400">{swLatencyUs} µs</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1 relative overflow-hidden">
                  <div className="bg-red-500 h-1 rounded-full" style={{ width: "95%" }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-900 pt-3 space-y-1.5 font-mono text-[8.5px] text-slate-450 leading-relaxed">
            <div className="flex justify-between">
              <span className="text-slate-500">Peak Telemetry Throughput:</span>
              <strong className={isHwAccelerated ? "text-emerald-400" : "text-amber-500"}>
                {isHwAccelerated ? hwThroughput : swThroughput}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Worst negative slack timing:</span>
              <strong className={isHwAccelerated ? "text-emerald-400" : "text-red-400 animate-pulse"}>
                {isHwAccelerated ? timingSlackHw : timingSlackSw}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Estimated Core Heat Loss reduction:</span>
              <strong className="text-slate-350">{isHwAccelerated ? "-61.1% (Low Power)" : "0% (Dissipating heat)"}</strong>
            </div>
          </div>
        </div>

        {/* ====================================================================
            PANEL 5: AXI4-LITE HI-FI PERFORMANCE DIAGNOSTICS (xl:col-span-12)
            ==================================================================== */}
        <div className="xl:col-span-12 bg-slate-950/80 border border-slate-850 p-4 rounded-md space-y-4 font-mono select-none" id="axi-performance-panel">
          <div className="flex justify-between items-center border-b border-slate-900 pb-2 select-none">
            <span className="text-[10px] text-slate-350 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
              AXI4-Lite Co-Processor Performance Diagnostics & Profile Monitor
            </span>
            <span className="text-[7.5px] text-slate-550 uppercase tracking-widest">
              BASE ADDRESS OFFSET: 0x43C0_0000
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-[9.5px]">
            {/* Metric 1 */}
            <div className="bg-slate-900/60 p-3 rounded border border-slate-850">
              <span className="text-slate-500 uppercase block text-[8px] tracking-wide">TOTAL AXI WRITE TXs</span>
              <div className="font-extrabold text-slate-100 text-base mt-0.5 flex justify-between items-end">
                <span>{statWriteCount}</span>
                <span className="text-[9px] text-cyan-500 font-normal">0x20 [RO]</span>
              </div>
            </div>
            
            {/* Metric 2 */}
            <div className="bg-slate-900/60 p-3 rounded border border-slate-850">
              <span className="text-slate-500 uppercase block text-[8px] tracking-wide">TOTAL AXI READ TXs</span>
              <div className="font-extrabold text-slate-100 text-base mt-0.5 flex justify-between items-end">
                <span>{statReadCount}</span>
                <span className="text-[9px] text-cyan-500 font-normal">0x24 [RO]</span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-slate-900/60 p-3 rounded border border-slate-850">
              <span className="text-slate-500 uppercase block text-[8px] tracking-wide">AVERAGE WRITE LATENCY</span>
              <div className="font-extrabold text-slate-100 text-base mt-0.5 flex justify-between items-end">
                <span className={avgWriteLatency > 15 ? "text-amber-500 animate-pulse" : "text-emerald-450"}>
                  {avgWriteLatency} cycles
                </span>
                <span className="text-[9px] text-cyan-500 font-normal">0x28 [RO]</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="bg-slate-900/60 p-3 rounded border border-slate-850">
              <span className="text-slate-500 uppercase block text-[8px] tracking-wide">AVERAGE READ LATENCY</span>
              <div className="font-extrabold text-slate-100 text-base mt-0.5 flex justify-between items-end">
                <span className={avgReadLatency > 15 ? "text-amber-500 animate-pulse" : "text-emerald-450"}>
                  {avgReadLatency} cycles
                </span>
                <span className="text-[9px] text-cyan-500 font-normal">0x30 [RO]</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch pt-1">
            {/* Registers and distribution bar charts */}
            <div className="lg:col-span-12 bg-slate-900/40 p-3.5 rounded border border-slate-850 space-y-4">
              <span className="text-[9.5px] text-slate-400 uppercase tracking-widest font-bold block pb-2 border-b border-slate-900/40">
                Key Control Registers Write Frequency Distribution
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Visual Bar Graph */}
                <div className="space-y-4">
                  {/* Register 1 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-350 font-bold">reg_hexagram_target (Offset 0x10)</span>
                      <span className="text-cyan-400 font-semibold">{statHexagramWriteCount} writes</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-950 h-5 border border-slate-850 rounded relative overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-350"
                          style={{ width: `${Math.min(100, (statHexagramWriteCount / (statHexagramWriteCount + statTickWriteCount || 1)) * 100)}%` }}
                        />
                        <span className="absolute left-2 top-1 text-[7.5px] text-slate-300 font-bold select-none drop-shadow">
                          {((statHexagramWriteCount / (statHexagramWriteCount + statTickWriteCount || 1)) * 100).toFixed(1)}% write frequency
                        </span>
                      </div>
                      <span className="text-[8px] text-slate-500 w-10 text-right">0x34 [RO]</span>
                    </div>
                  </div>

                  {/* Register 2 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-350 font-bold">reg_tick_period / duration (Offset 0x3C)</span>
                      <span className="text-cyan-400 font-semibold">{statTickWriteCount} writes</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-950 h-5 border border-slate-850 rounded relative overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-350"
                          style={{ width: `${Math.min(100, (statTickWriteCount / (statHexagramWriteCount + statTickWriteCount || 1)) * 100)}%` }}
                        />
                        <span className="absolute left-2 top-1 text-[7.5px] text-slate-300 font-bold select-none drop-shadow">
                          {((statTickWriteCount / (statHexagramWriteCount + statTickWriteCount || 1)) * 100).toFixed(1)}% write frequency
                        </span>
                      </div>
                      <span className="text-[8px] text-slate-500 w-10 text-right">0x38 [RO]</span>
                    </div>
                  </div>
                </div>

                {/* Legend and explanation */}
                <div className="p-3 rounded bg-slate-950/80 border border-slate-900 leading-normal text-[8.5px] text-slate-450 space-y-2">
                  <span className="text-[8.5px] text-slate-300 font-bold uppercase tracking-wider block">Co-Processor State Analytics</span>
                  <p>
                    These control registers represent core interlocks. The <strong>reg_hexagram_target</strong> controls operational transitions, while <strong>reg_tick_period</strong> sets the metabolic loop period dynamically.
                  </p>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-900 font-bold text-slate-350 select-none">
                    <span>Active Hexagram write count (RO 0x34):</span>
                    <span className="text-cyan-400">0x{statHexagramWriteCount.toString(16).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-slate-350 select-none">
                    <span>Active Tick write count (RO 0x38):</span>
                    <span className="text-cyan-400">0x{statTickWriteCount.toString(16).toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================================
            PANEL 4: DEEP DIAGNOSTICS LOG QUERY & SOVEREIGN TELEMETRY INGESTION BUS (xl:col-span-12)
            ==================================================================== */}
        <div className="xl:col-span-12 bg-slate-900/40 border border-slate-850 p-4 rounded-md space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-850 pb-3 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                <Database className="w-3.5 h-3.5 text-cyan-500" />
                Sovereign "One Limb" telemetry ingestion bus & JTAG query engine
              </span>
              <p className="text-[9px] font-mono text-slate-500 mt-1">
                Zero-cost system diagnostics tracking. Normalizes incoming payloads from 6 distinct domains into a unified hexagram constitution.
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[8px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1 select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Globalping API: Ready (500/hr)
              </span>
              <span className="text-[8px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1 select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                Stonefish SIM: Connected
              </span>
              <span className="text-[8px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1 select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                ArduPilot Rover: SITL ARM
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* L-Column - Telemetry channels simulator & real-time monitoring map */}
            <div className="lg:col-span-5 space-y-3 font-mono">
              <div className="flex justify-between items-center bg-slate-950/60 p-2 border border-slate-850 rounded">
                <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Active Domain Feeds Matrix</span>
                <span className="text-[7px] text-slate-550">SELECT A TEST DEVICE TO INGEST SIMULATED TELEMETRY</span>
              </div>

              {/* Grid of the 6 Zero-Cost domains */}
              <div className="grid grid-cols-2 gap-2 text-[8px]">
                <button 
                  onClick={() => executeUartCommand(undefined, "ingest --domain=network")}
                  className="p-2 bg-slate-950 hover:bg-slate-900 border border-indigo-950/60 hover:border-indigo-800 rounded text-left transition text-slate-350 cursor-pointer"
                  title="Query Globalping API probe measurement locations vs DNS hops"
                >
                  <div className="flex justify-between font-bold text-indigo-400 mb-0.5">
                    <span>1. NETWORK / GLOBE</span>
                    <span>$0</span>
                  </div>
                  <div className="text-[7.5px] text-slate-500 leading-normal">Globalping JSON ping probe validation tracking.</div>
                </button>

                <button 
                  onClick={() => executeUartCommand(undefined, "ingest --domain=underwater")}
                  className="p-2 bg-slate-950 hover:bg-slate-900 border border-sky-950/80 hover:border-sky-800 rounded text-left transition text-slate-350 cursor-pointer"
                  title="Stream simulated pressure and acoustic ranging values"
                >
                  <div className="flex justify-between font-bold text-sky-400 mb-0.5">
                    <span>2. UNDERWATER ROV</span>
                    <span>$0</span>
                  </div>
                  <div className="text-[7.5px] text-slate-500 leading-normal">Stonefish fluid_pressure /rosbridge WebSocket node.</div>
                </button>

                <button 
                  onClick={() => executeUartCommand(undefined, "ingest --domain=land")}
                  className="p-2 bg-slate-950 hover:bg-slate-900 border border-emerald-950/80 hover:border-emerald-800 rounded text-left transition text-slate-350 cursor-pointer"
                  title="Decodes MAVLink positioning packets directly to JSON"
                >
                  <div className="flex justify-between font-bold text-emerald-400 mb-0.5">
                    <span>3. LAND / ROVER</span>
                    <span>$0</span>
                  </div>
                  <div className="text-[7.5px] text-slate-500 leading-normal">ArduPilot SITL GPS stream payload with battery flags.</div>
                </button>

                <button 
                  onClick={() => executeUartCommand(undefined, "ingest --domain=sonar")}
                  className="p-2 bg-slate-900/60 hover:bg-slate-900 border border-cyan-950 hover:border-cyan-800 rounded text-left transition text-slate-350 cursor-pointer"
                  title="Unified range message bus across all autonomous crafts"
                >
                  <div className="flex justify-between font-bold text-cyan-400 mb-0.5">
                    <span>4. SONAR ACOUSTICS</span>
                    <span>$0</span>
                  </div>
                  <div className="text-[7.5px] text-slate-500 leading-normal">Ranging sensor_msgs/Range unified sonic scan levels.</div>
                </button>

                <button 
                  onClick={() => executeUartCommand(undefined, "ingest --domain=satellite")}
                  className="p-2 bg-slate-950 hover:bg-slate-900 border border-pink-950/80 hover:border-pink-800 rounded text-left transition text-slate-350 cursor-pointer"
                  title="Schedule ground observations to retrieve decoded downlink metrics"
                >
                  <div className="flex justify-between font-bold text-pink-400 mb-0.5">
                    <span>5. SATELLITE (LEO)</span>
                    <span>$0</span>
                  </div>
                  <div className="text-[7.5px] text-slate-500 leading-normal">SatNOGS scheduler beacon telemetry payload.</div>
                </button>

                <button 
                  onClick={() => executeUartCommand(undefined, "ingest --domain=air")}
                  className="p-2 bg-slate-950 hover:bg-slate-900 border border-amber-950/60 hover:border-amber-800 rounded text-left transition text-slate-350 cursor-pointer"
                  title="Live altitude & meteorological telemetry verification"
                >
                  <div className="flex justify-between font-bold text-amber-400 mb-0.5">
                    <span>6. AIR & MARITIME</span>
                    <span>$0</span>
                  </div>
                  <div className="text-[7.5px] text-slate-500 leading-normal">OpenSky Network + Open-Meteo launcher go/no-go status.</div>
                </button>
              </div>

              {/* Status feed showing last ingested values */}
              <div className="border border-slate-900 bg-slate-955 rounded p-3 relative text-[8px] leading-relaxed">
                <div className="flex justify-between items-center mb-1.5 border-b border-slate-900 pb-1">
                  <span className="text-[7.5px] text-slate-550 uppercase tracking-widest font-bold">Last Ingested Sovereign Frame</span>
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => setShowPayloadJson(false)}
                      className={`px-1.5 py-0.5 rounded text-[7px] font-bold cursor-pointer transition ${!showPayloadJson ? 'bg-cyan-955 text-cyan-400 border border-cyan-800' : 'text-slate-500 hover:text-slate-350 bg-slate-950/40'}`}
                    >
                      SUMMARY
                    </button>
                    <button
                      onClick={() => setShowPayloadJson(true)}
                      className={`px-1.5 py-0.5 rounded text-[7px] font-bold cursor-pointer transition ${showPayloadJson ? 'bg-cyan-955 text-cyan-400 border border-cyan-800' : 'text-slate-500 hover:text-slate-350 bg-slate-950/40'}`}
                    >
                      JSON PAYLOAD
                    </button>
                    <span className="text-[6.5px] text-emerald-500 px-1 border border-emerald-950 bg-emerald-955/35 rounded animate-pulse font-bold uppercase">Active Feed</span>
                  </div>
                </div>
                
                {lastIngestedTelemetry ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 bg-slate-950/55 p-1.5 rounded border border-slate-900">
                      <div>
                        <span className="text-slate-550 block text-[6.5px] uppercase">Timestamp</span>
                        <strong className="text-amber-500 font-bold">{lastIngestedTelemetry.timestamp}</strong>
                      </div>
                      <div>
                        <span className="text-slate-550 block text-[6.5px] uppercase">Domain Group</span>
                        <strong className="text-cyan-400 font-bold">{lastIngestedTelemetry.domain}</strong>
                      </div>
                      <div>
                        <span className="text-slate-550 block text-[6.5px] uppercase">Edge Device Source</span>
                        <strong className="text-slate-350 font-semibold truncate block" title={lastIngestedTelemetry.source}>{lastIngestedTelemetry.source}</strong>
                      </div>
                    </div>

                    {!showPayloadJson ? (
                      <div className="text-slate-350 bg-slate-950/90 border border-slate-900/40 rounded p-2 font-mono leading-normal min-h-[90px] max-h-[140px] overflow-y-auto">
                        <span className="text-slate-650 block text-[7px] tracking-wider uppercase font-bold mb-1">Human Narrative Translation</span>
                        {lastIngestedTelemetry.data}
                      </div>
                    ) : (
                      <div className="bg-slate-950/90 border border-slate-900 rounded p-2 text-[7.5px] font-mono leading-relaxed min-h-[90px] max-h-[140px] overflow-y-auto text-cyan-305/90 select-text">
                        <span className="text-slate-650 block text-[7px] tracking-wider uppercase font-bold mb-1 select-none">Normalized Ingest Schema (JSON)</span>
                        <pre className="select-text whitespace-pre-wrap font-mono">
                          {JSON.stringify(lastIngestedTelemetry.payload || { message: lastIngestedTelemetry.data }, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-600">No active frames in memory. Select a feed above to query.</div>
                )}
              </div>
            </div>

            {/* R-Column - Debug UART Shell console and CLI query input */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-2 font-mono">
              <div className="flex justify-between items-center pb-1 border-b border-slate-900">
                <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-yellow-500" />
                  DIAGNOSTICS CLI SERIAL LOGGER SHELL
                </span>
                <button 
                  onClick={() => setUartLogs([])}
                  className="text-[7.5px] px-1 border border-slate-800 bg-slate-950 text-slate-400 hover:text-white rounded transition cursor-pointer font-bold font-mono"
                >
                  CLEAR TERMINAL
                </button>
              </div>

              {/* Output log */}
              <div 
                className="bg-slate-950/90 border border-slate-900 p-2.5 rounded h-[180px] overflow-y-auto text-[7.5px] text-slate-400 font-mono space-y-1 leading-normal select-text"
              >
                {uartLogs.map((log, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed select-text font-mono">
                    {log}
                  </div>
                ))}
              </div>

              {/* Hot Queries Command Bar */}
              <div className="flex gap-1 items-center flex-wrap">
                <span className="text-[7px] text-slate-600 uppercase font-bold mr-1">QUICK SHORTCUTS:</span>
                <button 
                  onClick={() => executeUartCommand(undefined, "help")}
                  className="px-1.5 py-0.5 text-[7px] bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white rounded transition cursor-pointer"
                >
                  help
                </button>
                <button 
                  onClick={() => executeUartCommand(undefined, "status")}
                  className="px-1.5 py-0.5 text-[7px] bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white rounded transition cursor-pointer"
                >
                  status
                </button>
                <button 
                  onClick={() => executeUartCommand(undefined, "get_logs --level=CRITICAL")}
                  className="px-1.5 py-0.5 text-[7px] bg-amber-955/35 border border-amber-900/60 text-amber-400 hover:text-white rounded transition cursor-pointer font-bold"
                >
                  get CRIT faults
                </button>
                <button 
                  onClick={() => executeUartCommand(undefined, "get_logs SECURE")}
                  className="px-1.5 py-0.5 text-[7px] bg-cyan-955/35 border border-cyan-900/60 text-cyan-400 hover:text-white rounded transition cursor-pointer font-bold"
                >
                  query SECURE_LOCK
                </button>
                <button 
                  onClick={() => executeUartCommand(undefined, "get_logs")}
                  className="px-1.5 py-0.5 text-[7px] bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white rounded transition cursor-pointer"
                >
                  list all logs
                </button>
              </div>

              {/* Form Input submit */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  executeUartCommand();
                }} 
                className="flex gap-2 text-[9px] pt-1 select-none"
              >
                <input 
                  type="text" 
                  value={uartCommand}
                  onChange={(e) => setUartCommand(e.target.value)}
                  placeholder="Type UART command here... (e.g. status)"
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-250 px-2 py-1.2 rounded font-mono text-[9px] focus:outline-none"
                />
                <button 
                  type="submit"
                  className="px-4 py-1.2 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-slate-200 hover:text-white hover:shadow-lg border border-indigo-700 rounded text-[9px] font-bold cursor-pointer transition uppercase tracking-wider"
                >
                  RUN CMD
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
      )}
      </div>
    </div>
  );
}
