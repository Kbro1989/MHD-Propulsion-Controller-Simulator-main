/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ItemConfig {
  id: number;
  name: string;
  stackable: boolean;
  members: boolean;
  icon: string;
  price?: number;
  equip?: string[];
  wieldable?: {
    requirements?: Record<string, number>;
    female?: boolean;
    animation: number; // Animation index for sprite renderers
    armour?: number;
    weaponAim?: number;
    weaponPower?: number;
    magic?: number;
    prayer?: number;
    [key: string]: any;
  };
}

export const itemsConfig: Record<number, ItemConfig> = {
  10: { 
    id: 10, 
    name: "Coins", 
    stackable: true, 
    members: false, 
    icon: "🪙",
    price: 1
  },
  16: { 
    id: 16, 
    name: "Bronze Longsword", 
    stackable: false, 
    members: false, 
    icon: "🗡️",
    price: 15,
    equip: ["right-hand"],
    wieldable: {
      requirements: { attack: 1 },
      animation: 4,
      armour: 0,
      weaponAim: 4,
      weaponPower: 6,
      magic: 0,
      prayer: 0
    }
  },
  135: { 
    id: 135, 
    name: "Bronze Axe", 
    stackable: false, 
    members: false, 
    icon: "🪓",
    price: 10,
    equip: ["right-hand"],
    wieldable: {
      requirements: { attack: 1 },
      animation: 4,
      armour: 0,
      weaponAim: 2,
      weaponPower: 3,
      magic: 0,
      prayer: 0
    }
  },
  1263: { 
    id: 1263, 
    name: "Sleeping Bag", 
    stackable: false, 
    members: false, 
    icon: "🛏️",
    price: 5
  },
  546: { 
    id: 546, 
    name: "Death Rune", 
    stackable: true, 
    members: false, 
    icon: "🌀",
    price: 180
  },
  38: { 
    id: 38, 
    name: "Fire Rune", 
    stackable: true, 
    members: false, 
    icon: "🔥",
    price: 4
  },
  166: { 
    id: 166, 
    name: "Uncut Diamond", 
    stackable: false, 
    members: false, 
    icon: "💎",
    price: 2000
  },
  1251: { 
    id: 1251, 
    name: "Raw Lobster", 
    stackable: false, 
    members: false, 
    icon: "🦞",
    price: 150
  },
  152: { 
    id: 152, 
    name: "Cooked Lobster", 
    stackable: false, 
    members: false, 
    icon: "🦞",
    price: 240
  },
  143: { 
    id: 143, 
    name: "Raw Swordfish", 
    stackable: false, 
    members: false, 
    icon: "🐟",
    price: 220
  },
  367: { 
    id: 367, 
    name: "Swordfish", 
    stackable: false, 
    members: false, 
    icon: "🐟",
    price: 350
  },
  575: { 
    id: 575, 
    name: "Rune Large Shield", 
    stackable: false, 
    members: false, 
    icon: "🛡️",
    price: 32000,
    equip: ["left-hand"],
    wieldable: {
      requirements: { defense: 40 },
      animation: 3,
      armour: 32,
      weaponAim: -4,
      weaponPower: 0,
      magic: -6,
      prayer: 0
    }
  },
  400: { 
    id: 400, 
    name: "Rune Chain Mail", 
    stackable: false, 
    members: false, 
    icon: "👕",
    price: 52000,
    equip: ["body", "replace-body"],
    wieldable: {
      requirements: { defense: 40 },
      animation: 6,
      armour: 46,
      weaponAim: 0,
      weaponPower: 0,
      magic: -4,
      prayer: 0
    }
  },
  112: { 
    id: 112, 
    name: "Rune Plate Mail", 
    stackable: false, 
    members: false, 
    icon: "🥋",
    price: 65000,
    equip: ["body", "replace-body"],
    wieldable: {
      requirements: { defense: 40 },
      animation: 6,
      armour: 58,
      weaponAim: 0,
      weaponPower: 0,
      magic: -8,
      prayer: 0
    }
  },
  81: { 
    id: 81, 
    name: "Rune 2h Sword", 
    stackable: false, 
    members: false, 
    icon: "⚔️",
    price: 56000,
    equip: ["2-handed"],
    wieldable: {
      requirements: { attack: 40 },
      animation: 4,
      armour: 0,
      weaponAim: 38,
      weaponPower: 44,
      magic: -4,
      prayer: 0
    }
  },
  794: { 
    id: 794, 
    name: "Rune Battleaxe", 
    stackable: false, 
    members: false, 
    icon: "🪓",
    price: 48000,
    equip: ["right-hand"],
    wieldable: {
      requirements: { attack: 40 },
      animation: 4,
      armour: 0,
      weaponAim: 28,
      weaponPower: 32,
      magic: -3,
      prayer: 0
    }
  },
  822: { 
    id: 822, 
    name: "Dragon Med Helm", 
    stackable: false, 
    members: true, 
    icon: "🪖",
    price: 200000,
    equip: ["head", "replace-head"],
    wieldable: {
      requirements: { defense: 60 },
      animation: 5,
      armour: 34,
      weaponAim: 0,
      weaponPower: 0,
      magic: -2,
      prayer: 1
    }
  },
  795: { 
    id: 795, 
    name: "Dragon Sword", 
    stackable: false, 
    members: true, 
    icon: "🗡️",
    price: 350000,
    equip: ["right-hand"],
    wieldable: {
      requirements: { attack: 60 },
      animation: 4,
      armour: 0,
      weaponAim: 48,
      weaponPower: 52,
      magic: 0,
      prayer: 2
    }
  },
  1121: { 
    id: 1121, 
    name: "Dragon Square Shield", 
    stackable: false, 
    members: true, 
    icon: "🛡️",
    price: 450000,
    equip: ["left-hand"],
    wieldable: {
      requirements: { defense: 60 },
      animation: 3,
      armour: 40,
      weaponAim: -6,
      weaponPower: 0,
      magic: -10,
      prayer: 3
    }
  },
  545: { 
    id: 545, 
    name: "Chaos Rune", 
    stackable: true, 
    members: false, 
    icon: "🌀",
    price: 120
  }
};
