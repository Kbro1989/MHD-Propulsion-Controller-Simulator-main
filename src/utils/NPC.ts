/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Character } from "./Character";
import { World } from "./WorldSync";

// Mock drops, respawn and definitions matching authentic RSC data structure
export const dropDefinitions = {
  herb: [
    { id: 10, amount: 10 }
  ]
};

export const items: Record<number, { name: string; members: boolean }> = {
  10: { name: "Coins", members: false }
};

export const npcRespawn: Record<number, number> = {
  1: 10000,
  2: 12000,
  3: 15000
};

export const npcs: Record<number, { name: string; attack: number; strength: number; hits: number; defense: number; hostility?: 'aggressive' | 'retreats' | 'none' }> = {
  1: { name: "Goblin", attack: 5, strength: 5, hits: 8, defense: 4, hostility: "aggressive" },
  2: { name: "Rat", attack: 1, strength: 2, hits: 4, defense: 1 },
  3: { name: "King", attack: 10, strength: 12, hits: 15, defense: 10, hostility: "retreats" }
};

export function rollItemDrop(dropsObj: any, npcId: number) {
  // Simple simulator: returns some standard RSC drops
  return [{ id: 10, amount: 10 }];
}

export function rollNPCDamage(npc: any, opponent: any) {
  const maxHit = Math.max(1, Math.floor((npc.skills?.strength?.current || 5) * 0.5));
  return Math.floor(Math.random() * maxHit);
}

const HERB_IDS = new Set(dropDefinitions.herb.map((entry) => entry.id));
const PARALYZE_MONSTER_ID = 12;

const RESTORE_TICKS = 100;

// Simple logger replacement
const log = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

export interface NPCConstructorArgs {
  id: number;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export class NPC extends Character {
  spawnX: number;
  spawnY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  definition: { name: string; attack: number; strength: number; hits: number; defense: number; hostility?: 'aggressive' | 'retreats' | 'none' };
  respawn: number;
  aggressive: boolean;
  retreats: boolean;
  skills: {
    attack: { current: number; base: number };
    strength: { current: number; base: number };
    hits: { current: number; base: number };
    defense: { current: number; base: number };
  };
  combatLevel: number;
  visitedTiles: Set<string>;
  stepsLeft: number;
  stationary: boolean;
  knownPlayers: Set<any>;
  restoreTicks: number;
  retreatTicks: number;

  constructor(world: World, { id, x, y, minX, maxX, minY, maxY }: NPCConstructorArgs) {
    super(world);

    this.id = id;
    this.spawnX = x;
    this.spawnY = y;
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;

    this.x = this.spawnX;
    this.y = this.spawnY;

    this.definition = npcs[id];

    if (!this.definition) {
      throw new RangeError(`invalid NPC id ${this.id}`);
    }

    this.respawn = npcRespawn[id] || 10000;

    this.aggressive =
      this.withinRegion('wilderness') ||
      this.definition.hostility === 'aggressive';

    this.retreats =
      !this.definition.hostility ||
      this.definition.hostility === 'retreats';

    this.skills = {
      attack: {
        current: this.definition.attack,
        base: this.definition.attack
      },
      strength: {
        current: this.definition.strength,
        base: this.definition.strength
      },
      hits: {
        current: this.definition.hits,
        base: this.definition.hits
      },
      defense: {
        current: this.definition.defense,
        base: this.definition.defense
      }
    };

    this.combatLevel = this.getCombatLevel();

    this.visitedTiles = new Set();
    this.stepsLeft = 0;

    this.stationary =
      this.x === minX &&
      this.x === maxX &&
      this.y === minY &&
      this.y === maxY;

    this.knownPlayers = new Set();
    this.restoreTicks = RESTORE_TICKS;
    this.retreatTicks = 0;
  }

  getDrops() {
    let drops = rollItemDrop(dropDefinitions, this.id);

    if (!this.world.members) {
      for (const drop of drops) {
        if (HERB_IDS.has(drop.id)) {
          drop.id = 10;
          drop.amount = 10;
        }
      }

      drops = drops.filter((drop) => !items[drop.id]?.members);
    }

    return drops;
  }

  getCombatLevel() {
    return (
      this.skills.attack.base +
      this.skills.defense.base +
      this.skills.strength.base +
      this.skills.hits.base
    ) / 4;
  }

  die() {
    const { world } = this;

    let maxDamage = 0;
    let victorID: number | string = -1;

    for (const [playerID, damage] of Array.from(this.playerDamage.entries())) {
      if (damage > maxDamage) {
        maxDamage = damage;
        victorID = playerID;
      }
    }

    let victor: any;

    if (victorID === -1) {
      victor = this.opponent;
    } else {
      victor = world.players.getAll().find((p: any) => p.id === victorID);
    }

    world
      .callPlugin('onNPCDeath', victor, this)
      .then((blocked) => {
        if (blocked) {
          return;
        }

        const drops = this.getDrops();

        for (const item of drops) {
          world.addPlayerDrop(victor, item, this.x, this.y);
        }

        world.removeEntity('npcs', this);

        if (!victor) {
          return;
        }

        victor.retreat?.();
        victor.sendSound?.('victory');

        const totalExperience = this.getCombatExperience();
        const quarterExperience = Math.floor(totalExperience / 4);

        victor.addExperience?.('hits', quarterExperience);

        switch (victor.combatStyle) {
          case 0: // controlled
            victor.addExperience?.('attack', quarterExperience);
            victor.addExperience?.('defense', quarterExperience);
            victor.addExperience?.('strength', quarterExperience);
            break;
          case 1: // aggressive
            victor.addExperience?.('strength', quarterExperience * 3);
            break;
          case 2: // accurate
            victor.addExperience?.('attack', quarterExperience * 3);
            break;
          case 3: // defensive
            victor.addExperience?.('defense', quarterExperience * 3);
            break;
        }

        this.opponent = null;
        victor.opponent = null;
      })
      .catch((e) => log.error(e));
  }

  async flee(ticks = 8) {
    const { world } = this;
    const visitedTiles = new Set<string>();

    this.retreatTicks = ticks;

    for (let i = 0; i < ticks; i += 1) {
      if (this.locked) {
        break;
      }

      const step = this.getFreeDirection(visitedTiles);

      if (step) {
        this.walkTo(step.deltaX, step.deltaY);
        await world.sleepTicks(1);
        visitedTiles.add(`${this.x},${this.y}`);
      } else {
        break;
      }
    }

    this.retreatTicks = 0;
  }

  updateKnownPlayers() {
    for (const player of Array.from(this.knownPlayers)) {
      if (!player.loggedIn || !player.withinRange?.(this, 16)) {
        if (player.localEntities?.removed?.npcs) {
          player.localEntities.removed.npcs.add(this);
        }
        if (player.localEntities?.moved?.npcs) {
          player.localEntities.moved.npcs.delete(this);
        }
        this.knownPlayers.delete(player);
      }
    }

    const playersInView = this.getNearbyEntities('players', 16);
    for (const player of playersInView) {
      if (!player.loggedIn) {
        break;
      }

      if (player.localEntities?.known?.npcs && !player.localEntities.known.npcs.has(this)) {
        player.localEntities.added?.npcs?.add?.(this);
      }

      this.knownPlayers.add(player);
    }
  }

  withinWalkBounds(destX: number, destY: number) {
    if (
      destX > this.maxX ||
      destX < this.minX ||
      destY > this.maxY ||
      destY < this.minY
    ) {
      return false;
    }

    return true;
  }

  canWalk(deltaX: number, deltaY: number) {
    const destX = this.x + deltaX;
    const destY = this.y + deltaY;

    if (!this.withinWalkBounds(destX, destY)) {
      return false;
    }

    return super.canWalk(deltaX, deltaY);
  }

  walkNextRandomStep() {
    if (this.stepsLeft > 0) {
      if (
        this.stepsLeft < 3 &&
        typeof this.lastDeltaX !== 'undefined' &&
        typeof this.lastDeltaY !== 'undefined' &&
        Math.random() >= 0.25 &&
        this.canWalk(this.lastDeltaX, this.lastDeltaY)
      ) {
        this.stepsLeft -= 1;
        this.walkTo(this.lastDeltaX, this.lastDeltaY);
      } else {
        const deltas = this.getFreeDirection(this.visitedTiles, true);

        if (deltas) {
          const { deltaX, deltaY } = deltas;

          this.lastDeltaX = deltaX;
          this.lastDeltaY = deltaY;
          this.stepsLeft -= 1;

          this.walkTo(deltaX, deltaY);
          this.visitedTiles.add(`${this.x},${this.y}`);
        }
      }
    } else if (!this.locked) {
      if (Math.random() <= 0.15) {
        this.visitedTiles.clear();
        this.visitedTiles.add(`${this.x},${this.y}`);
        this.stepsLeft = Math.floor(Math.random() * 8) + 1;
      }
    }
  }

  broadcastChat(message: string) {
    for (const player of Array.from(this.knownPlayers)) {
      if (player.localEntities?.characterUpdates?.npcChat) {
        player.localEntities.characterUpdates.npcChat.push({
          npcIndex: this.index,
          playerIndex: this.interlocutor?.index || 0,
          message
        });
      }
    }
  }

  broadcastDirection() {
    for (const player of Array.from(this.knownPlayers)) {
      if (player.localEntities?.spriteChanged?.npcs) {
        player.localEntities.spriteChanged.npcs.add(this);
      }
    }
  }

  broadcastMove() {
    for (const player of Array.from(this.knownPlayers)) {
      if (player.localEntities?.moved?.npcs) {
        player.localEntities.moved.npcs.add(this);
      }
    }
  }

  broadcastDamage(damage: number) {
    const message = {
      index: this.index,
      damageTaken: damage,
      currentHealth: this.skills.hits.current,
      maxHealth: this.skills.hits.base
    };

    for (const player of Array.from(this.knownPlayers)) {
      if (player.localEntities?.characterUpdates?.npcHits) {
        player.localEntities.characterUpdates.npcHits.push(message);
      }
    }
  }

  sendProjectile(victim: any, sprite = 0) {
    const message = {
      index: this.index,
      victimType: victim instanceof NPC ? 3 : 4,
      projectileType: sprite,
      victimIndex: victim.index
    };

    for (const player of Array.from(this.knownPlayers)) {
      if (player.localEntities?.characterUpdates?.projectiles) {
        player.localEntities.characterUpdates.projectiles.push(message);
      }
    }
  }

  async fight() {
    const blocked = await this.world.callPlugin(
      'offNPCCombat',
      this,
      this.opponent
    );

    if (blocked) {
      return;
    }

    if (this.fightStage % 3 === 0) {
      if (this.opponent && !this.opponent.prayers[PARALYZE_MONSTER_ID]) {
        const damage = rollNPCDamage(this, this.opponent);
        this.opponent.damage(damage);
      }

      this.fightStage = 1;
      this.combatRounds += 1;
    } else {
      this.fightStage += 1;
    }

    if (
      this.retreats &&
      this.combatRounds > 3 &&
      this.opponent &&
      this.skills.hits.current <= Math.ceil(this.skills.hits.base * 0.25)
    ) {
      this.opponent.message('Your opponent is retreating');

      this.retreat()
        .then(() => this.flee())
        .catch((err) => log.error(err));
    }
  }

  normalizeSkills() {
    if (this.restoreTicks > 0) {
      this.restoreTicks -= 1;
      return;
    }

    this.restoreTicks = RESTORE_TICKS;

    for (const [skillName, entry] of Object.entries(this.skills)) {
      const e = entry as { current: number; base: number };
      if (e.current < e.base) {
        e.current += 1;
      } else if (e.current > e.base) {
        e.current -= 1;
      }
    }
  }

  async tick() {
    this.normalizeSkills();

    if (this.opponent) {
      await this.fight();
    }

    if (!this.stationary && !this.locked && this.knownPlayers.size) {
      this.updateKnownPlayers();

      if (!this.chasing) {
        let foundPlayer = false;

        if (this.aggressive && this.retreatTicks <= 0) {
          for (const player of Array.from(this.knownPlayers)) {
            if (
              !player.opponent &&
              this.isAggressive(player) &&
              player.withinRange?.(this, 8) &&
              player.withinLineOfSight?.(this)
            ) {
              foundPlayer = true;
              this.attack(player);
              break;
            }
          }
        }

        if (!foundPlayer && this.retreatTicks === 0) {
          this.walkNextRandomStep();
        }
      }
    }

    if (this.retreatTicks > 0) {
      this.retreatTicks -= 1;
    }

    this.isWalking = false;
  }

  isAggressive(player: any) {
    return (
      player.combatLevel < this.combatLevel * 2 ||
      player.withinRegion?.('wilderness')
    );
  }

  toString() {
    return `[NPC (id=${this.id}, x=${this.x}, y=${this.y})]`;
  }
}
