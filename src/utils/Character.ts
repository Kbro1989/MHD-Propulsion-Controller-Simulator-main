/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { World } from "./WorldSync";

export class Character {
  world: World;
  x: number = 0;
  y: number = 0;
  index: number = 1;
  id: number = 1;
  locked: boolean = false;
  opponent: Character | null = null;
  interlocutor: any = null;
  fightStage: number = 0;
  combatRounds: number = 0;
  playerDamage: Map<number, number> = new Map();
  isWalking: boolean = false;
  chasing: boolean = false;
  combatStyle: number = 0; // controlled, aggressive, accurate, defensive
  prayers: Record<number, boolean> = {};
  loggedIn: boolean = true;
  lastDeltaX?: number;
  lastDeltaY?: number;
  plane: number = 0;

  constructor(world: World) {
    this.world = world;
    this.index = Math.floor(Math.random() * 1000) + 1;
  }

  climb(gameObject: any, up: boolean): void {
    console.log(`[CLIMB] Character ${this.index} climbed ${up ? 'up' : 'down'} ladder: x=${this.x}, y=${this.y}`);
    this.plane += up ? 1 : -1;
    this.plane = Math.max(0, Math.min(3, this.plane));
  }

  withinRegion(regionName: string): boolean {
    // Wilderness bounds or custom matching
    if (regionName === 'wilderness') {
      return this.y > 500;
    }
    return false;
  }

  canWalk(deltaX: number, deltaY: number): boolean {
    const destX = this.x + deltaX;
    const destY = this.y + deltaY;
    if (this.world.pathFinder) {
      return this.world.pathFinder.isValidGameStep(destX, destY);
    }
    return true;
  }

  walkTo(deltaX: number, deltaY: number): void {
    this.x += deltaX;
    this.y += deltaY;
    this.isWalking = true;
    this.broadcastMove();
  }

  broadcastMove(): void {
    // Overridden by subclass or simulated
  }

  async retreat(): Promise<void> {
    this.opponent = null;
    this.chasing = false;
  }

  sendSound(soundName: string): void {
    console.log(`[Sound Played] ${soundName} on Character ${this.index}`);
  }

  addExperience(skillName: string, exp: number): void {
    console.log(`[Experience Gained] ${skillName}: +${exp} xp`);
  }

  damage(damageTaken: number): void {
    const hits = (this as any).skills?.hits;
    if (hits) {
      hits.current = Math.max(0, hits.current - damageTaken);
      this.broadcastDamage(damageTaken);
      if (hits.current <= 0) {
        (this as any).die?.();
      }
    }
  }

  broadcastDamage(damage: number): void {
    // Overridden by subclass
  }

  attack(target: any): void {
    this.opponent = target;
    target.opponent = this;
  }

  message(msg: string): void {
    console.log(`[Message] ${msg}`);
  }

  withinRange(other: Character, range: number): boolean {
    const dist = Math.max(Math.abs(this.x - other.x), Math.abs(this.y - other.y));
    return dist <= range;
  }

  withinLineOfSight(other: Character): boolean {
    // Simulating true Raycasting line of sight
    return true;
  }

  getFreeDirection(visitedTiles: Set<string>, ignoreUnvisited = false): { deltaX: number, deltaY: number } | null {
    const directions = [
      { deltaX: 0, deltaY: 1 },
      { deltaX: 1, deltaY: 0 },
      { deltaX: 0, deltaY: -1 },
      { deltaX: -1, deltaY: 0 },
      { deltaX: 1, deltaY: 1 },
      { deltaX: 1, deltaY: -1 },
      { deltaX: -1, deltaY: 1 },
      { deltaX: -1, deltaY: -1 }
    ];

    // Filter valid steps
    const valid = directions.filter(dir => this.canWalk(dir.deltaX, dir.deltaY));
    if (valid.length === 0) return null;

    if (!ignoreUnvisited) {
      // Prioritize unvisited tiles to mimic RSC wandering
      const unvisited = valid.filter(dir => !visitedTiles.has(`${this.x + dir.deltaX},${this.y + dir.deltaY}`));
      if (unvisited.length > 0) {
        return unvisited[Math.floor(Math.random() * unvisited.length)];
      }
    }

    return valid[Math.floor(Math.random() * valid.length)];
  }

  getNearbyEntities(type: 'players' | 'npcs', range: number = 16): any[] {
    const entityList = type === 'players' ? this.world.players : this.world.npcs;
    if (!entityList) return [];
    return entityList.getAll().filter((entry: any) => this.withinRange(entry, range));
  }

  getCombatExperience(): number {
    return ((this as any).skills?.hits?.base || 10) * 10;
  }

  disengage(): void {
    this.opponent = null;
  }

  unlock(): void {
    this.locked = false;
  }
}
