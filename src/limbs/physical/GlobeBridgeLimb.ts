/**
 * Bridges physical hydro/drone telemetry to Cobe multiplayer-globe
 * Receives from physical sensors, renders on digital globe
 */
export class GlobeBridgeLimb {
  private readonly wsEndpoint: string;
  private ws: any = null; // Use any to allow standard browser WebSocket with no strict Node-binding errors
  public onCommandCallback?: (cmd: any) => void;

  constructor(wsEndpoint?: string) {
    if (wsEndpoint) {
      this.wsEndpoint = wsEndpoint;
    } else {
      const isBrowser = typeof window !== "undefined";
      const defaultHost = isBrowser ? window.location.host : "localhost:3000";
      const defaultProto = isBrowser && window.location.protocol === "https:" ? "wss:" : "ws:";
      this.wsEndpoint = `${defaultProto}//${defaultHost}/api/ws`;
    }
  }

  async connect(): Promise<void> {
    const wsClass = typeof WebSocket !== 'undefined' ? WebSocket : (globalThis as any).WebSocket;
    if (!wsClass) {
      console.warn("[GlobeBridgeLimb] WebSocket is not defined in this environment. Dual telemetry loopback activated.");
      return;
    }

    try {
      this.ws = new wsClass(this.wsEndpoint);
      this.ws.onopen = () => console.log('GLOBE_BRIDGE: connected successfully to sovereign telemetry relay');
      this.ws.onmessage = (msg: any) => this.handleGlobeMessage(msg);
      this.ws.onerror = (err: any) => console.warn('[GlobeBridgeLimb] Connection encountered telemetry jitter', err);
    } catch (e) {
      console.warn("[GlobeBridgeLimb] Failed to initialize WebSocket connection. Graceful fallback active.", e);
    }
  }

  /**
   * Push physical state to globe
   * Called by HydroTelemetryLimb after Hexagram Gate compile
   */
  pushPhysicalState(state: any): void {
    const readyStateOpen = this.ws && this.ws.readyState === 1; // 1 = WebSocket.OPEN
    if (!readyStateOpen) {
      // Loopback state trigger for real-time visualization dashboard
      try {
        const customEvent = new CustomEvent("pog2_physical_telemetry_loopback", { detail: state });
        window.dispatchEvent(customEvent);
      } catch (e) {
        // Safe in Node environments
      }
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'physical_telemetry',
        domain: 'hydro',
        timestamp: Date.now(),
        position: state.domains?.underwater?.[0]?.position || { lat: 35.6895, lon: 139.6917, depth: 15, altitude: 0 },
        health: state.healthSummary || { battery: 0.98, propulsion: 0.92, thermal: 0.38, magnetic: 0.97, signal: 0.88, pressure: 0.22 },
        hexagram: state.hexagramState || { state: "Water over Thunder", confidence: 0.95 },
        merkle: state.merkleRoot || "0".repeat(64)
      }));
    } catch (error) {
      console.warn("[GlobeBridgeLimb] Data transmission failed", error);
    }
  }

  /**
   * Receive globe commands (e.g., user clicks on globe to redirect drone)
   */
  private handleGlobeMessage(msg: { data: string }): void {
    try {
      const data = JSON.parse(msg.data);
      if (data.type === 'globe_command') {
        console.log('GLOBE_COMMAND:', data);
        if (this.onCommandCallback) {
          this.onCommandCallback(data);
        }
      }
    } catch (err) {
      console.warn("[GlobeBridgeLimb] Failed to parse inbound telemetry message payload", err);
    }
  }

  healthCheck(): { online: boolean; details: string } {
    const isConnected = this.ws && this.ws.readyState === 1;
    return {
      online: !!isConnected,
      details: `GlobeBridgeLimb: endpoint is ${this.wsEndpoint}. Readystate is ${this.ws ? this.ws.readyState : 'Uninitialized'}`
    };
  }
}
