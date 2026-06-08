// --- CLOUDFLARE WORKER ENTRY POINT ---
// This section handles high-performance edge execution and WebSocket upgrades.
const isCloudflare = typeof (globalThis as any).WebSocketPair !== "undefined";

const cfExport = isCloudflare ? {
  async fetch(request: any, env: any) {
    const url = new URL(request.url);

    // Handle WebSocket Upgrades for /api/ws and Multiplayer Globe endpoints
    if (url.pathname === "/api/ws" || url.pathname.includes("/parties/globe")) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const [client, server] = new (globalThis as any).WebSocketPair();
      (server as any).accept();

      // Simple relay logic for edge isolates
      (server as any).addEventListener("message", (event: any) => {
        // Broadcast on edge would require Durable Objects, 
        // for now we provide a functional loopback/echo to prevent connection failure.
        server.send(event.data);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Serve static assets from the binding
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
} : {};

export default cfExport;

// --- NODE.JS / LOCAL DEVELOPMENT SERVER ---
// Only imported and executed if NOT in the Cloudflare Worker environment.
if (!isCloudflare) {
  (async () => {
    // Dynamic imports to prevent Cloudflare Worker build from failing on Node-only libs
    const express = (await import("express")).default;
    const path = (await import("node:path")).default;
    const { createServer: createHttpServer } = await import("node:http");
    const { WebSocketServer, WebSocket } = await import("ws");
    const { createServer: createViteServer } = await import("vite");

    const app = express();
    const PORT = 3000;

    const server = createHttpServer(app);
    const wss = new WebSocketServer({ noServer: true });
    const clients = new Set<WebSocket>();

    wss.on("connection", (ws) => {
      clients.add(ws);
      console.log(`[WebSocket Server] New telemetry client connected. Total peers: ${clients.size}`);

      ws.send(JSON.stringify({
        type: "presence",
        nodeId: "relay_edge_quantum_001",
        nodeName: "Sovereign Relay Gateway",
        x: 50,
        y: 50,
        tempK: 2.73,
        timestamp: Date.now()
      }));

      ws.on("message", (messageData) => {
        try {
          const raw = messageData.toString();
          const payload = JSON.parse(raw);
          const broadcastStr = JSON.stringify(payload);
          for (const client of clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(broadcastStr);
            }
          }
        } catch (err) {
          console.warn("[WebSocket Server] Non-JSON or corrupt packet received:", err);
        }
      });

      ws.on("close", () => {
        clients.delete(ws);
      });

      ws.on("error", (err) => {
        console.error("[WebSocket Server] WebSocket error:", err);
      });
    });

    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
      if (pathname.includes("/api/ws") || pathname.includes("/parties/globe")) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else if (process.env.NODE_ENV === "production") {
        socket.destroy();
      }
    });

    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { server } },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    server.listen(PORT, "localhost", () => {
      console.log(`========================================================================`);
      console.log(`Quantum-Grade Sovereign Telemetry Router listening on http://localhost:${PORT}`);
      console.log(`========================================================================`);
    });
  })().catch(err => {
    console.error("FATAL: Failed to bootstrap Node.js server", err);
  });
}
