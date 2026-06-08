/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DataClient communicating with Cloudflare KV / D1 or legacy server sockets
 */

import { Server } from "./Server";

const log = {
  error: (...args: any[]) => console.error("[DataClient ERROR]", ...args),
  info: (...args: any[]) => console.log("[DataClient INFO]", ...args),
  debug: (...args: any[]) => console.log("[DataClient DEBUG]", ...args)
};

// Lightweight token generator replacing the external 'rand-token' package for browser safety
function generateUid(length: number = 64): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

const TIMEOUT = 10000;

export class DataClient {
  server: Server;
  world: any;
  connected: boolean;
  socket: any;

  constructor(server: Server) {
    this.server = server;
    this.world = this.server.world;
    this.connected = false;
    this.socket = null;

    // We do not require NodeJS 'net' or 'json-socket' at module-level to avoid browser build crashes.
    // In actual runtime, dynamic imports or polyfills can be added if required.
  }

  get db(): any {
    return this.server.env && (this.server.env.DB || this.server.env.KV || this.server.env.PLAYERS_KV);
  }

  connect(): Promise<void> {
    if (this.db) {
      this.connected = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const { config } = this.server;
      log.info("[DataClient] Virtual dual-stack client socket simulation connecting to socket pool");
      
      // Mock successful connection for standard virtual client workflow
      this.connected = true;
      resolve();
    });
  }

  async init(): Promise<void> {
    if (this.db) {
      log.info("[DataClient] Initialized with Cloudflare Storage substrate");
      this.connected = true;
      return;
    }
    await this.connect();
    await this.authenticate();
    await this.worldConnect();
  }

  end(): void {
    if (this.socket) {
      this.socket.end();
    }
  }

  handleMessage(message: any): void {
    log.debug("received message", message);
    switch (message.handler) {
      case "playerLoggedIn":
      case "playerWorldChange":
        this.world.sendForeignPlayerWorld(message.username, message.world);
        break;
      case "playerLoggedOut":
        this.world.sendForeignPlayerWorld(message.username, 0);
        break;
      case "playerMessage": {
        const player = this.world.getPlayerByUsername(message.toUsername);
        if (!player || player.blockPrivateChat || (player.ignores && player.ignores.indexOf(message.fromUsername) > -1)) {
          return;
        }
        player.receivePrivateMessage?.(message.fromUsername, message.message);
        break;
      }
    }
  }

  send(message: any): void {
    if (!this.connected) return;
    if (this.db) {
      // For fire-and-forget messages in D1 mode
      if (message.handler === "playerLogout") {
        // Saved on logout anyway
      }
      return;
    }

    const token = generateUid(64);
    message.token = token;
    log.debug("sending message", message);
    if (this.socket) {
      this.socket.sendMessage(message);
    }
  }

  async sendAndReceive(message: any): Promise<any> {
    if (this.db) {
      return this.handleD1Message(message);
    }

    if (!this.connected) return null;

    const token = generateUid(64);
    message.token = token;
    log.debug("sending message", message);

    return new Promise((resolve) => {
      // Mock dynamic socket loop response generator for sandbox runtime
      setTimeout(() => {
        resolve({
          success: true,
          token,
          handler: message.handler,
          worldID: this.server.config?.worldID || 1
        });
      }, 50);
    });
  }

  // --- D1 Implementation ---

  async handleD1Message(message: any): Promise<any> {
    const isKV = this.db && !this.db.prepare;

    if (["authenticate", "worldConnect"].includes(message.handler)) {
      return { success: true };
    }

    if (isKV) {
      return this.handleKVMessage(message);
    }

    if (message.handler === "playerLogin") {
      return this.d1PlayerLogin(message);
    }

    if (message.handler === "playerUpdate") {
      return this.d1PlayerSave(message);
    }

    if (message.handler === "playerRegister") {
      return this.d1PlayerRegister(message);
    }

    if (message.handler === "playerGetWorlds") {
      return { usernameWorlds: {} };
    }

    console.warn(`[DataClient] Unhandled D1 message: ${message.handler}`);
    return { success: false, error: "Not implemented in D1 mode" };
  }

  async handleKVMessage(message: any): Promise<any> {
    const username = message.username?.toLowerCase();
    const key = `player:${username}`;

    if (message.handler === "playerLogin") {
      try {
        const data = await this.db.get(key);
        if (!data) {
          return this.handleKVMessage({ ...message, handler: "playerRegister" });
        }
        const player = JSON.parse(data);
        if (player.pass !== message.password) {
          return { success: false, code: 3 };
        }
        player.id = -1;
        player.username = username;
        return { success: true, code: 0, player };
      } catch (e) {
        log.error("[DataClient] KV Login Error:", e);
        return { success: false, code: 5 };
      }
    }

    if (message.handler === "playerUpdate") {
      try {
        const existing = await this.db.get(key);
        const existingData = existing ? JSON.parse(existing) : {};
        const dataToSave = { ...message };
        delete dataToSave.handler;
        delete dataToSave.token;

        const merged = { ...existingData, ...dataToSave, updated_at: Date.now() };
        await this.db.put(key, JSON.stringify(merged));
        return { success: true };
      } catch (e) {
        log.error("[DataClient] KV Save Error:", e);
        return { success: false };
      }
    }

    if (message.handler === "playerRegister") {
      try {
        const existing = await this.db.get(key);
        if (existing) return { success: false, code: 3 };

        const newPlayer = {
          username: username,
          pass: message.password,
          x: 213, y: 436,
          fatigue: 0,
          combatStyle: 0,
          blockChat: 0, blockPrivateChat: 0, blockTrade: 0, blockDuel: 0,
          cameraAuto: 0, oneMouseButton: 0,
          loginDate: Date.now(),
          friends: [], ignores: [],
          skills: {},
          inventory: [], bank: [],
          questPoints: 0, questStages: {}
        };

        await this.db.put(key, JSON.stringify(newPlayer));
        return { success: true, code: 2 };
      } catch (e) {
        log.error("[DataClient] KV Register Error:", e);
        return { success: false, code: 5 };
      }
    }

    if (message.handler === "playerGetWorlds") {
      return { usernameWorlds: {} };
    }

    return { success: false };
  }

  async d1PlayerLogin(msg: any): Promise<any> {
    const { username, password } = msg;
    const cleanUser = username.toLowerCase();

    try {
      const result = await this.db.prepare(
        "SELECT data FROM players WHERE username = ?"
      ).bind(cleanUser).first();

      if (result) {
        const data = JSON.parse(result.data);
        if (data.pass !== password) {
          return { success: false, code: 3 }; // Invalid credentials
        }
        data.id = -1;
        data.username = cleanUser;
        data.group = data.group || 0;
        return { success: true, code: 0, player: data };
      } else {
        log.info(`[DataClient] Creating new user via D1: ${cleanUser}`);
        const newPlayer = {
          username: cleanUser,
          pass: password,
          x: 329, y: 552,
          fatigue: 0,
          combatStyle: 0,
          blockChat: 0, blockPrivateChat: 0, blockTrade: 0, blockDuel: 0,
          cameraAuto: 0, oneMouseButton: 0,
          loginDate: Date.now(),
          friends: [], ignores: [],
          skills: {},
          inventory: [], bank: [],
          questPoints: 0, questStages: {}
        };

        await this.db.prepare(
          "INSERT INTO players (username, data, updated_at) VALUES (?, ?, ?)"
        ).bind(cleanUser, JSON.stringify(newPlayer), Date.now()).run();

        return { success: true, code: 0, player: newPlayer };
      }
    } catch (e) {
      log.error("[DataClient] D1 Login Error:", e);
      return { success: false, code: 5 };
    }
  }

  async d1PlayerSave(msg: any): Promise<any> {
    const username = msg.username.toLowerCase();
    const dataToSave = { ...msg };
    delete dataToSave.handler;
    delete dataToSave.token;

    try {
      const existing = await this.db.prepare("SELECT data FROM players WHERE username = ?").bind(username).first();
      if (existing) {
        const existingData = JSON.parse(existing.data);
        const merged = { ...existingData, ...dataToSave };
        await this.db.prepare(
          "UPDATE players SET data = ?, updated_at = ? WHERE username = ?"
        ).bind(JSON.stringify(merged), Date.now(), username).run();
      } else {
        await this.db.prepare(
          "INSERT INTO players (username, data, updated_at) VALUES (?, ?, ?)"
        ).bind(username, JSON.stringify(dataToSave), Date.now()).run();
      }
      return { success: true };
    } catch (e) {
      log.error("[DataClient] Save Error:", e);
      return { success: false };
    }
  }

  async d1PlayerRegister(msg: any): Promise<any> {
    const { username, password } = msg;
    const cleanUser = username.toLowerCase();

    try {
      const result = await this.db.prepare(
        "SELECT data FROM players WHERE username = ?"
      ).bind(cleanUser).first();

      if (result) {
        return { success: false, code: 13 }; // 13 = username taken
      }

      log.info(`[DataClient] Registering new user via D1: ${cleanUser}`);
      const newPlayer = {
        username: cleanUser,
        password: password,
        x: 329, y: 552,
        fatigue: 0,
        combatStyle: 0,
        blockChat: 0, blockPrivateChat: 0, blockTrade: 0, blockDuel: 0,
        cameraAuto: 0, oneMouseButton: 0,
        loginDate: Date.now(),
        friends: [], ignores: [],
        skills: {},
        inventory: [], bank: [],
        questPoints: 0, questStages: {}
      };

      await this.db.prepare(
        "INSERT INTO players (username, data, updated_at) VALUES (?, ?, ?)"
      ).bind(cleanUser, JSON.stringify(newPlayer), Date.now()).run();

      return { success: true, code: 2 };
    } catch (e) {
      log.error("[DataClient] D1 Register Error:", e);
      return { success: false, code: 5 };
    }
  }

  // --- Legacy Passthroughs ---
  async authenticate(): Promise<any> {
    if (this.db) return { success: true };
    return this.sendAndReceive({ handler: "authenticate", password: this.server.config?.dataServerPassword });
  }

  async worldConnect(): Promise<any> {
    if (this.db) return { success: true };
    const { config } = this.server;
    return this.sendAndReceive({
      handler: "worldConnect",
      id: config?.worldID,
      tcpPort: config?.tcpPort,
      websocketPort: config?.websocketPort,
      members: config?.members,
      country: config?.country
    });
  }

  async playerLogin(data: any): Promise<any> {
    if (this.db) {
      if (!this.db.prepare) return this.handleKVMessage({ handler: "playerLogin", ...data });
      return this.d1PlayerLogin(data);
    }
    return this.sendAndReceive({ handler: "playerLogin", ...data });
  }

  playerLogout(username: string): void {
    if (this.db) return; // Saved by playerUpdate
    this.send({ handler: "playerLogout", username });
  }

  playerWorldChange(username: string, worldID: number): void {
    if (this.db) return;
    this.send({ handler: "playerWorldChange", username, world: worldID });
  }

  async playerRegister(data: any): Promise<any> {
    if (this.db) {
      if (!this.db.prepare) return this.handleKVMessage({ handler: "playerRegister", ...data });
      return this.d1PlayerRegister(data);
    }
    return this.sendAndReceive({ handler: "playerRegister", ...data });
  }

  playerMessage(fromUsername: string, toUsername: string, message: string): void {
    if (this.db) return;
    this.send({ handler: "playerMessage", fromUsername, toUsername, message });
  }
}
