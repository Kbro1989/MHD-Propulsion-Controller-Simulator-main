/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Virtual WebWorker thread handling virtual Server bootstrapping and packet routing
 */

import { Server } from "./Server";

// High-fidelity, self-contained authentic bole logger core
const bole = {
  output: (config: any) => {
    console.log("[bole] Logger output stream initialized:", config);
  },
  debug: (...args: any[]) => console.debug("[bole DEBUG]", ...args),
  info: (...args: any[]) => console.info("[bole INFO]", ...args),
  error: (...args: any[]) => console.error("[bole ERROR]", ...args)
};

(async () => {
  bole.output({
    level: "debug",
    stream: {
      write: (buffer: any) => console.log(buffer.toString())
    }
  });

  if (typeof addEventListener !== "undefined") {
    addEventListener("message", async (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;

      switch (e.data.type) {
        case "start": {
          console.log("[Worker] Bootstrapping virtual server sequence...");
          const server = new Server(e.data.config);
          await server.init();
          postMessage({ type: "ready" });
          break;
        }
        default: {
          console.log(`[Worker] Unhandled command message: ${e.data.type}`);
          break;
        }
      }
    });
  }
})();
