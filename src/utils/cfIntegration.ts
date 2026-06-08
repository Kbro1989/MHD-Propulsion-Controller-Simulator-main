/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cloud Function (CF) Co-processor Integration Utilities
 * Connects the local FPGA simulator telemetry and Taylor series predictive engine
 * to real-world cloud hosted microservices when endpoints are configured.
 */

import { TelemetryPacket } from "../types";

// Detect endpoints from Vite env
export const CF_PREDICTOR_URL = (import.meta as any).env?.VITE_CF_PREDICTOR_URL || "";
export const CF_TELEMETRY_URL = (import.meta as any).env?.VITE_CF_TELEMETRY_URL || "";
export const CF_HIL_SIM_URL = (import.meta as any).env?.VITE_CF_HIL_SIM_URL || "";

export interface CloudFunctionConfig {
  predictorUrl: string;
  telemetryUrl: string;
  hilSimUrl: string;
}

export interface CFResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  latencyMs?: number;
}

export const getCloudFunctionConfig = (): CloudFunctionConfig => {
  return {
    predictorUrl: CF_PREDICTOR_URL,
    telemetryUrl: CF_TELEMETRY_URL,
    hilSimUrl: CF_HIL_SIM_URL,
  };
};

/**
 * Checks if at least one Cloud Function co-processor is specified.
 */
export const hasActiveCloudFunctions = (): boolean => {
  return !!(CF_PREDICTOR_URL || CF_TELEMETRY_URL || CF_HIL_SIM_URL);
};

/**
 * Transmits real-time UART telemetry packet payload to the remote telemetry Cloud Function.
 */
export async function transmitTelemetryToRemote(
  packet: Omit<TelemetryPacket, "rawValueHex"> & { rawValueHex: string },
  addLogMessage?: (msg: string) => void
): Promise<CFResponse<{ receivedId: string; status: string }>> {
  if (!CF_TELEMETRY_URL) {
    return { success: false, error: "CF_TELEMETRY_URL not configured" };
  }

  const start = Date.now();
  try {
    const response = await fetch(CF_TELEMETRY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        packetHex: packet.rawValueHex,
        hexagramState: packet.hexagramState,
        electricalReg: packet.electricalReg,
        faultByte: packet.faultByte,
        predictedTempRaw: packet.predictedTempRaw,
        pressPlenumRaw: packet.pressPlenumRaw,
        currBusRaw: packet.currBusRaw,
        taylorOrder: packet.taylorOrder,
        highVariance: packet.highVariance,
        expectedCrc: packet.expectedCrc,
        decodedCrc: packet.decodedCrc,
        crcValid: packet.crcValid,
      }),
    });

    const latencyMs = Date.now() - start;
    if (!response.ok) {
      throw new Error(`Cloud Function returned status ${response.status}`);
    }

    const data = await response.json();
    if (addLogMessage) {
      addLogMessage(`[CF_TELEMETRY] Successfully exported telemetry payload to cloud sink (${latencyMs}ms)`);
    }
    return { success: true, data, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    if (addLogMessage) {
      addLogMessage(`[CF_TELEMETRY_ERR] Failed transmission to remote co-processor: ${err.message || err} (${latencyMs}ms)`);
    }
    return { success: false, error: err.message || String(err), latencyMs };
  }
}

/**
 * Delegates high-order Taylor series prediction computation to a remote Cloud Function co-processor.
 */
export async function fetchTaylorPredictionFromRemote(
  history: number[],
  order: number,
  addLogMessage?: (msg: string) => void
): Promise<CFResponse<{ prediction: number; confidence: number; series: number[] }>> {
  if (!CF_PREDICTOR_URL) {
    return { success: false, error: "CF_PREDICTOR_URL not configured" };
  }

  const start = Date.now();
  try {
    const response = await fetch(CF_PREDICTOR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        temperatureHistory: history,
        taylorOrder: order,
        horizonSteps: 10,
      }),
    });

    const latencyMs = Date.now() - start;
    if (!response.ok) {
      throw new Error(`Predictor Cloud Function returned status ${response.status}`);
    }

    const data = await response.json();
    if (addLogMessage) {
      addLogMessage(`[CF_PREDICTOR] Coprocessed Taylor extrapolation via remote GHOSTSPLAT server (${latencyMs}ms)`);
    }
    return { success: true, data, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    if (addLogMessage) {
      addLogMessage(`[CF_PREDICTOR_ERR] Dynamic cloud-inference failed: ${err.message || err}. Falling back to internal local FSM solver.`);
    }
    return { success: false, error: err.message || String(err), latencyMs };
  }
}

/**
 * Triggers hardware-in-the-loop (HIL) state verification or cycle stepping with remote co-processor.
 */
export async function invokeHILSimCoProcessor(
  tick: number,
  chokeFreq: number,
  activeContactorCount: number,
  addLogMessage?: (msg: string) => void
): Promise<CFResponse<{ responseCode: string; validated: boolean }>> {
  if (!CF_HIL_SIM_URL) {
    return { success: false, error: "CF_HIL_SIM_URL not configured" };
  }

  const start = Date.now();
  try {
    const response = await fetch(CF_HIL_SIM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tickCounter: tick,
        chokeResonantFrequencyHz: chokeFreq,
        engagedContactors: activeContactorCount,
      }),
    });

    const latencyMs = Date.now() - start;
    if (!response.ok) {
      throw new Error(`HIL co-processor returned status ${response.status}`);
    }

    const data = await response.json();
    if (addLogMessage) {
      addLogMessage(`[CF_HIL] Local hardware loop synchronized with cloud accelerator FSM. Latency: ${latencyMs}ms`);
    }
    return { success: true, data, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    if (addLogMessage) {
      addLogMessage(`[CF_HIL_ERR] Acceleration link bypassed: ${err.message || err} (${latencyMs}ms)`);
    }
    return { success: false, error: err.message || String(err), latencyMs };
  }
}
