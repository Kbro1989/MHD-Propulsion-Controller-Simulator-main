/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * playerSync.ts
 *
 * Player update helper functions for OpenRSC-style delta synchronization.
 * These can be added as methods to a Player class or executed as independent utilities.
 */

export interface OpenRscPlayer {
  x: number;
  y: number;
  lastX?: number;
  lastY?: number;
  direction?: string;
  lastSprite?: string;
  lastClientActivity?: number;
  currentRegion?: {
    getPlayersInView: (manager: any) => OpenRscPlayer[];
    getNpcsInView: (manager: any) => OpenRscNpc[];
  };
  world?: {
    regionManager: any;
  };
  getNearbyEntities?: (type: "players" | "npcs", range: number) => any[];
}

export interface OpenRscNpc {
  x: number;
  y: number;
}

/** Check if player moved this tick (OpenRSC pattern) */
export function hasMoved(this: OpenRscPlayer) {
  return this.x !== this.lastX || this.y !== this.lastY;
}

/** Check if player's sprite/direction changed */
export function spriteChanged(this: OpenRscPlayer) {
  return this.direction !== this.lastSprite;
}

/** Update last position/sprite after processing (call at end of tick) */
export function updateFlags(this: OpenRscPlayer) {
  this.lastX = this.x;
  this.lastY = this.y;
  this.lastSprite = this.direction;
}

/** Get players within view range (uses regions when available) */
export function getPlayersInViewRange(this: OpenRscPlayer, range = 16) {
  if (this.currentRegion && this.world?.regionManager) {
    return this.currentRegion.getPlayersInView(this.world.regionManager)
      .filter((p) => withinRange.call(this, p, range));
  }
  if (typeof this.getNearbyEntities === "function") {
    return this.getNearbyEntities("players", range);
  }
  return [];
}

/** Get NPCs within view range (uses regions when available) */
export function getNpcsInViewRange(this: OpenRscPlayer, range = 16) {
  if (this.currentRegion && this.world?.regionManager) {
    return this.currentRegion.getNpcsInView(this.world.regionManager)
      .filter((n) => withinRange.call(this, n, range));
  }
  if (typeof this.getNearbyEntities === "function") {
    return this.getNearbyEntities("npcs", range);
  }
  return [];
}

/** Update heartbeat activity (prevents timeout) */
export function updateActivity(this: OpenRscPlayer) {
  this.lastClientActivity = Date.now();
}

/** Check if player is within authentic range (16 tiles) */
export function withinRange(this: OpenRscPlayer, other: { x: number; y: number }, range = 16) {
  const deltaX = Math.abs(this.x - other.x);
  const deltaY = Math.abs(this.y - other.y);
  return deltaX <= range && deltaY <= range;
}

// CJS compatibility so that require() or system hooks work as requested
export default {
  hasMoved,
  spriteChanged,
  updateFlags,
  getPlayersInViewRange,
  getNpcsInViewRange,
  updateActivity,
  withinRange
};
