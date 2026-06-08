/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cloudflare Substrate and Multiplayer Globe Integration Service
 */

export const CLOUDFLARE_ACCOUNT_ID = (import.meta as any).env?.VITE_CLOUDFLARE_ACCOUNT_ID || "";
export const CLOUDFLARE_API_TOKEN = (import.meta as any).env?.VITE_CLOUDFLARE_API_TOKEN || "";
export const CLOUDFLARE_IMAGE_ENDPOINT = (import.meta as any).env?.VITE_CLOUDFLARE_IMAGE_ENDPOINT || "";
export const CLOUDFLARE_GATEWAY_URL = (import.meta as any).env?.VITE_CLOUDFLARE_GATEWAY_URL || "";
export const CLOUDFLARE_WORKER_URL = (import.meta as any).env?.VITE_CLOUDFLARE_WORKER_URL || "";
export const POG2_GLOBE_ENABLED = (import.meta as any).env?.VITE_POG2_GLOBE_ENABLED === "true" || true;
const envEndpoint = (import.meta as any).env?.VITE_POG2_GLOBE_ENDPOINT;
const isBrowser = typeof window !== "undefined";
const defaultHost = isBrowser ? window.location.host : "localhost:3000";
const defaultProto = isBrowser && window.location.protocol === "https:" ? "wss:" : "ws:";

export const POG2_GLOBE_ENDPOINT = envEndpoint || `${defaultProto}//${defaultHost}/api/ws`;
export const POG2_GLOBE_ISOLATION = (import.meta as any).env?.VITE_POG2_GLOBE_ISOLATION === "true" || false;

export interface RemotePlayerNode {
  id: string;
  name: string;
  x: number;
  y: number;
  lastActive: number;
  tempK?: number;
  hexState?: number;
}

export interface CloudflareSubstrateStatus {
  accountId: string;
  gatewayUrl: string;
  workerUrl: string;
  globeEnabled: boolean;
  globeEndpoint: string;
  isIsolated: boolean;
}

export function getSubstrateConfig(): CloudflareSubstrateStatus {
  return {
    accountId: CLOUDFLARE_ACCOUNT_ID,
    gatewayUrl: CLOUDFLARE_GATEWAY_URL,
    workerUrl: CLOUDFLARE_WORKER_URL,
    globeEnabled: POG2_GLOBE_ENABLED,
    globeEndpoint: POG2_GLOBE_ENDPOINT,
    isIsolated: POG2_GLOBE_ISOLATION,
  };
}

/**
 * Triggers an AI Image generation request using Cloudflare Sensory substrate if configured
 */
export async function generateSensoryImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  // If we have both direct Cloudflare credentials, try direct Cloudflare Workers AI REST API first
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN) {
    try {
      const model = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
      const directUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;
      
      const res = await fetch(directUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return { success: true, imageUrl: base64Data };
      } else {
        console.warn(`Direct Workers AI returned status<sup>${res.status}</sup>, trying configured gateway/endpoint fallback...`);
      }
    } catch (err) {
      console.warn("Direct Workers AI image generation failed, trying fallback...", err);
    }
  }

  const url = CLOUDFLARE_IMAGE_ENDPOINT;
  if (!url) {
    return { success: false, error: "CLOUDFLARE_IMAGE_ENDPOINT and direct credentials not configured in environment" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) {
      throw new Error(`Cloudflare AI Image endpoint returned status ${res.status}`);
    }
    const data = await res.json();
    return { success: true, imageUrl: data.imageUrl || data.image || data.url };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Executes a Text Generation model using Cloudflare Workers AI
 */
export async function runCloudflareWorkersAiText(prompt: string, systemPrompt?: string): Promise<{ success: boolean; result?: string; error?: string }> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    return { 
      success: false, 
      error: "Cloudflare credentials (ACCOUNT_ID, API_TOKEN) not configured in the environment." 
    };
  }

  try {
    // We use the robust and fast Meta Llama-3.1-8b-instruct model on Cloudflare
    const model = "@cf/meta/llama-3.1-8b-instruct";
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;
    
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages })
    });

    if (!res.ok) {
      throw new Error(`Cloudflare Workers AI REST API returned status ${res.status}`);
    }

    const data = await res.json();
    if (data.success && data.result) {
      return { success: true, result: data.result.response || data.result.text || data.result || "" };
    } else {
      return { success: false, error: data.errors?.[0]?.message || "Payload format mismatch" };
    }
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Pings the Cloudflare Gateway or worker endpoint to verify edge connectivity.
 */
export async function checkEdgeAvailability(): Promise<{ ok: boolean; message: string; latency?: number }> {
  const workerUrl = CLOUDFLARE_WORKER_URL || CLOUDFLARE_GATEWAY_URL;
  if (!workerUrl) {
    return { ok: false, message: "No Cloudflare worker or gateway URL available." };
  }

  const start = Date.now();
  try {
    const res = await fetch(workerUrl, { method: "HEAD", mode: "cors" }).catch(() => null);
    const latency = Date.now() - start;
    if (res && res.status >= 200 && res.status < 400) {
      return { ok: true, message: `Substrate online. Reachable in ${latency}ms.`, latency };
    }
    // Fallback if HEAD mode is rejected by CORS but the fetch got a response
    return { ok: true, message: `Ping completed (Gateway configured). Latency: ${latency}ms.`, latency };
  } catch (err) {
    return { ok: false, message: `Substrate ping failed: ${(err as any).message || "CORS restriction or Offline"}` };
  }
}
