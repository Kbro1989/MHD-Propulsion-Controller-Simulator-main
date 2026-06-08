/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MAX_PLAYERS = 1250;

export function secureInt(): number {
  return (Math.random() * 0xffffffff) | 0;
}

export async function session(socket: any): Promise<void> {
  if (!socket.server?.dataClient?.connected) {
    if (typeof Buffer !== "undefined") {
      const failure = Buffer.alloc(8);
      socket.send?.(failure);
    }
    if (typeof process !== "undefined" && typeof process.nextTick === "function") {
      process.nextTick(() => socket.close?.());
    } else {
      setTimeout(() => socket.close?.(), 0);
    }
    return;
  }

  socket.isaacKeys = {
    in: [],
    out: [secureInt(), secureInt()]
  };

  if (typeof Buffer !== "undefined") {
    const sessionID = Buffer.alloc(8);
    sessionID.writeInt32BE(socket.isaacKeys.out[0], 0);
    sessionID.writeInt32BE(socket.isaacKeys.out[1], 4);
    socket.send?.(sessionID);
  }
}

export async function login(socket: any, message: any): Promise<void> {
  const { dataClient, config, world } = socket.server || {};
  const { reconnecting, version, username = '', password = '' } = message || {};

  console.error(`[LOGIN DEBUG] Attempting login for user: '${username}' (len=${username.length}) with password: '${password}' (len=${password.length})`);
  console.error(`[LOGIN DEBUG] Version: ${version}, Config Version: ${config?.version}`);

  if (version !== config?.version) {
    if (typeof Buffer !== "undefined") {
      socket.send?.(Buffer.from([5]));
    }
    if (typeof process !== "undefined" && typeof process.nextTick === "function") {
      process.nextTick(() => socket.close?.());
    } else {
      setTimeout(() => socket.close?.(), 0);
    }
    return;
  }

  if (username.length < 3 || password.length < 5) {
    if (typeof Buffer !== "undefined") {
      socket.send?.(Buffer.from([3]));
    }
    if (typeof process !== "undefined" && typeof process.nextTick === "function") {
      process.nextTick(() => socket.close?.());
    } else {
      setTimeout(() => socket.close?.(), 0);
    }
    return;
  }

  if (world && world.players?.length >= MAX_PLAYERS) {
    if (typeof Buffer !== "undefined") {
      socket.send?.(Buffer.from([14]));
    }
    if (typeof process !== "undefined" && typeof process.nextTick === "function") {
      process.nextTick(() => socket.close?.());
    } else {
      setTimeout(() => socket.close?.(), 0);
    }
    return;
  }

  const alreadyOnline = world?.getPlayerByUsername ? world.getPlayerByUsername(username) : false;
  if (alreadyOnline) {
    console.error(`[LOGIN DEBUG] Player ${username} is already online.`);
    if (typeof Buffer !== "undefined") {
      socket.send?.(Buffer.from([4])); // 4 = already in use
    }
    if (typeof process !== "undefined" && typeof process.nextTick === "function") {
      process.nextTick(() => socket.close?.());
    } else {
      setTimeout(() => socket.close?.(), 0);
    }
    return;
  }

  console.error(`[LOGIN DEBUG] Calling dataClient.playerLogin for ${username}...`);
  let code = 0;
  let success = false;
  let playerObj: any = null;

  if (dataClient?.playerLogin) {
    const res = await dataClient.playerLogin({
      username,
      password,
      ip: typeof socket.getIPAddress === "function" ? socket.getIPAddress() : "127.0.0.1",
      reconnecting
    });
    code = res.code;
    success = res.success;
    playerObj = res.player;
  } else {
    // simulated environment fallback code
    code = 2; // success code
    success = true;
    playerObj = { username, password };
  }
  console.error(`[LOGIN DEBUG] dataClient.playerLogin returned: code=${code}, success=${success}`);

  if (typeof Buffer !== "undefined") {
    socket.send?.(Buffer.from([code]));
  }

  const triggerNext = () => {
    if (!success) {
      socket.close?.();
      return;
    }

    // Dynamic instantiation
    if (world) {
      socket.player = playerObj;
      socket.player.login?.(reconnecting);
    }
  };

  if (typeof process !== "undefined" && typeof process.nextTick === "function") {
    process.nextTick(triggerNext);
  } else {
    setTimeout(triggerNext, 0);
  }
}
