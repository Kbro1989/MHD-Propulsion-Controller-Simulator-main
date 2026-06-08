/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// MHD PROPULSION SYSTEM UTILITIES & SIMULATION LOGIC
// ============================================================================

/**
 * Fits a polynomial using Taylor series approximation / forward-backward finite differences
 * based on the active Taylor Order (2 to 5) to predict temp at t+3 ticks.
 *
 * T(t+3) = T(t) + 3*T'(t) + (9/2)*T''(t) + (27/6)*T'''(t) + (81/24)*T''''(t) + ...
 *
 * @param history List of recent temperatures (newest first, i.e. index 0 is T(t))
 * @param order Degree of approximation (2 to 5)
 * @returns Predicted temperature value
 */
export function calculateTaylorPrediction(history: number[], order: number): {
  prediction: number;
  derivatives: number[];
} {
  const h = 1.0; // Assume time step is 1 metabolic tick of 600ms
  const steps = 3; // Predict 3 ticks into the future (1.8 seconds)

  // Default fallback if we don't have enough history
  if (history.length < 5) {
    const lastTemp = history[0] || 300.0;
    return { prediction: lastTemp + 1.2, derivatives: [0, 0, 0, 0] };
  }

  const t0 = history[0];
  const t1 = history[1];
  const t2 = history[2];
  const t3 = history[3];
  const t4 = history[4];

  // Finite backward differences to approximate derivatives (scaled by steps units)
  // dt1 = T'(t) * h ≈ T(t) - T(t-1)
  const dt1 = t0 - t1;
  // dt2 = T''(t) * h^2 ≈ T(t) - 2*T(t-1) + T(t-2)
  const dt2 = t0 - 2 * t1 + t2;
  // dt3 = T'''(t) * h^3 ≈ T(t) - 3*T(t-1) + 3*T(t-2) - T(t-3)
  const dt3 = t0 - 3 * t1 + 3 * t2 - t3;
  // dt4 = T''''(t) * h^4 ≈ T(t) - 4*T(t-1) + 6*T(t-2) - 4*T(t-3) + t4
  const dt4 = t0 - 4 * t1 + 6 * t2 - 4 * t3 + t4;

  let prediction = t0;
  const derivatives = [dt1, dt2, dt3, dt4];

  if (order >= 2) {
    // 1st order term: T'(t) * 3
    prediction += 3 * dt1;
  }
  if (order >= 3) {
    // 2nd order term: T''(t) / 2! * 3^2 = 4.5 * dt2
    prediction += 4.5 * dt2;
  }
  if (order >= 4) {
    // 3rd order term: T'''(t) / 3! * 3^3 = 4.5 * dt3
    prediction += 4.5 * dt3;
  }
  if (order >= 5) {
    // 4th order term: T''''(t) / 4! * 3^4 = 3.375 * dt4
    prediction += 3.375 * dt4;
  }

  return {
    prediction,
    derivatives,
  };
}

/**
 * Fits a polynomial using Taylor series approximation based on the active Taylor Order (2 to 5)
 * to predict temperature at t + steps ticks in the future.
 */
export function calculateTaylorPredictionForSteps(history: number[], order: number, steps: number): number {
  if (history.length < 5) {
    const lastTemp = history[0] || 300.0;
    // Fallback if not enough history
    return lastTemp + steps * 0.4;
  }

  const t0 = history[0];
  const t1 = history[1];
  const t2 = history[2];
  const t3 = history[3];
  const t4 = history[4];

  const dt1 = t0 - t1;
  const dt2 = t0 - 2 * t1 + t2;
  const dt3 = t0 - 3 * t1 + 3 * t2 - t3;
  const dt4 = t0 - 4 * t1 + 6 * t2 - 4 * t3 + t4;

  let prediction = t0;

  if (order >= 2) {
    prediction += steps * dt1;
  }
  if (order >= 3) {
    prediction += (Math.pow(steps, 2) / 2) * dt2;
  }
  if (order >= 4) {
    prediction += (Math.pow(steps, 3) / 6) * dt3;
  }
  if (order >= 5) {
    prediction += (Math.pow(steps, 4) / 24) * dt4;
  }

  return prediction;
}

/**
 * Calculated Variance of the prediction over historical values.
 */
export function calculatePredictionVariance(history: number[], prediction: number): number {
  if (history.length === 0) return 0.05;
  const sample = history.slice(0, 4);
  const sumOfDiffs = sample.reduce((sum, val) => sum + Math.pow(val - prediction, 2), 0);
  return Math.sqrt(sumOfDiffs / Math.max(1, sample.length));
}

/**
 * Validates state pathways using the transition table.
 * Returns true if the transition path exists.
 */
import { HexagramState, VALID_TRANSITIONS } from "./types";

export function checkTransitionValid(from: HexagramState, to: HexagramState): boolean {
  return VALID_TRANSITIONS.some((path) => path.from === from && path.to === to);
}

/**
 * Simulates the 32-bit Knock-Lock Challenge Hash function.
 * Given an integer nonce counter and the secret authorization key, it computes
 * a pseudo-cryptographic 64-bit signature split into signature_0 and signature_1 (each 32-bit hex)
 * that the FPGA Slave requires.
 */
export function computeKnockSignature(nonce: number, secretKey: string): {
  sig0: string; // 32-bit hex string (uint32)
  sig1: string; // 32-bit hex string (uint32)
} {
  // A simple deterministic hashes for demonstration matching Zynq PS side
  let hash0 = (nonce ^ 0xDEADBEEF) + secretKey.split("").reduce((sum, char) => sum + char.charCodeAt(0), 101);
  let hash1 = (nonce ^ 0x600DCAFE) * 17 + secretKey.length;

  // Make sure they fit inside 32-bit unsigned integers
  hash0 = (hash0 >>> 0);
  hash1 = (hash1 >>> 0);

  return {
    sig0: hash0.toString(16).toUpperCase().padStart(8, "0"),
    sig1: hash1.toString(16).toUpperCase().padStart(8, "0"),
  };
}
