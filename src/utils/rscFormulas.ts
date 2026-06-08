/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Authentic RSC Production and Gathering Success Formulas
 * Used historically for Fishing, Mining, Cooking, Crafting, and item drops.
 */

export interface DropEntry {
  id?: number | number[];
  amount?: number | number[];
  weight?: number;
  reference?: number;
}

export type DropsTable = Record<number, DropEntry[]>;

export interface RolledDrop {
  id: number;
  amount: number;
}

// recursively add item drops
export function addItemDrop(
  drops: DropsTable,
  currentDrops: RolledDrop[],
  entry: DropEntry
): void {
  if (entry.reference !== undefined) {
    const rolled = rollItemDrop(drops, entry.reference);
    currentDrops.push(...rolled);
  } else {
    // if id is an array, drop multiple items in one entry
    if (Array.isArray(entry.id)) {
      for (let i = 0; i < entry.id.length; i += 1) {
        const amt = Array.isArray(entry.amount) ? entry.amount[i] : (entry.amount || 1);
        currentDrops.push({
          id: entry.id[i],
          amount: typeof amt === "number" ? amt : 1
        });
      }
    } else if (typeof entry.id === "number") {
      const amt = Array.isArray(entry.amount) ? entry.amount[0] : (entry.amount || 1);
      currentDrops.push({
        id: entry.id,
        amount: typeof amt === "number" ? amt : 1
      });
    }
  }
}

// roll an entry from a weighted (out of 128) drop table. see
// https://github.com/2003scape/rsc-data#rolls/
export function rollItemDrop(drops: DropsTable, index: number): RolledDrop[] {
  const npcDrops = drops[index];

  if (!npcDrops) {
    return [];
  }

  const currentDrops: RolledDrop[] = [];
  const roll = Math.floor(Math.random() * 129);
  let currentWeight = 0;

  for (let i = 0; i < npcDrops.length; i += 1) {
    const entry = npcDrops[i];

    if (!entry.weight || entry.weight === 0) {
      addItemDrop(drops, currentDrops, entry);
      continue;
    }

    const nextWeight = currentWeight + entry.weight;

    if (roll >= currentWeight && roll < nextWeight) {
      addItemDrop(drops, currentDrops, entry);
    }

    currentWeight += entry.weight;
  }

  return currentDrops;
}

// get the x from the x/256 chance of rolling a success
export function getSkillThreshold(low: number, high: number, level: number): number {
  return (
    Math.floor((low * (99 - level)) / 98) +
    Math.floor((high * (level - 1)) / 98) +
    1
  );
}

// decide whether or not a skilling action should be successful.
// low is x/256 for success at level 1 (even if the action can't be performed),
// and high is x/256 for success at level 99.
// https://oldschool.runescape.wiki/w/Template:Skilling_success_chart
export function rollSkillSuccess(low: number, high: number, level: number): boolean {
  const threshold = getSkillThreshold(low, high, level);
  const roll = Math.floor(Math.random() * 257);
  return roll <= threshold;
}

// for fishing spots and other processes that can provide multiple resources
// at different levels within the same action.
// rolls is an array of [low, high], sorted by highest skill requirement first
// returns the index of the roll it chose, or -1 if fail
export function rollCascadedSkillSuccess(rolls: [number, number][], level: number): number {
  const thresholds = rolls.map(([low, high]) => {
    return getSkillThreshold(low, high, level);
  });

  for (let i = thresholds.length - 1; i > 0; i -= 1) {
    thresholds[i] = Math.floor(
      thresholds[i] * (1 - thresholds[i - 1] / 256)
    );
  }

  const roll = Math.floor(Math.random() * 257);
  let threshold = 0;

  for (let i = 0; i < thresholds.length; i += 1) {
    threshold += thresholds[i];

    if (roll <= threshold) {
      return i;
    }
  }

  return -1;
}

// Authentic RSC production success formula
// Used for Cooking, Crafting, Firemaking, Woodcutting
export function calcProductionSuccessfulLegacy(
  levelReq: number,
  skillLevel: number,
  stopsFailing: boolean,
  levelStopFail: number,
  minFailChance = 1
): boolean {
  const roll = Math.floor(Math.random() * 256) + 1; // 1-256

  if (skillLevel < levelReq) {
    return false;
  }

  // min chance is 64/256
  const maxThreshold = stopsFailing ? 256 : 256 - minFailChance;

  // Formula from OpenRSC Formulae.java
  const threshold = Math.min(
    maxThreshold,
    Math.floor(64 + (skillLevel - 1) * (19200.0 / (levelStopFail * 98)))
  );

  return roll <= threshold;
}

// Authentic RSC gathering success formula
// Used for Mining, Fishing
export function calcGatheringSuccessfulLegacy(
  levelReq: number,
  skillLevel: number,
  equipmentBonus = 0
): boolean {
  const roll = Math.floor(Math.random() * 128) + 1; // 1-128

  if (skillLevel < levelReq) {
    return false;
  }

  // 128 is already guaranteed to fail (roll <= threshold check)
  // 1 is already guaranteed to be successful
  // using 127 as the min in order for threshold to not be able to hit 128 for a guaranteed chance to fail
  const threshold = Math.min(
    127,
    Math.max(1, skillLevel + equipmentBonus + 40 - Math.floor(levelReq * 1.5))
  );
  return roll <= threshold;
}
