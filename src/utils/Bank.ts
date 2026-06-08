/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { itemsConfig } from "./items";

// ============================================================================
// TYPING AND STATICS
// ============================================================================

export const EQUIPMENT_BONUS_NAMES = [
  'armour',
  'weaponAim',
  'weaponPower',
  'magic',
  'prayer'
];

export const EQUIPMENT_ANIMATION_INDEXES = [
  { type: 'replace-head', index: 0 },
  { type: 'replace-body', index: 1 },
  { type: 'replace-legs', index: 2 },
  { type: '2-handed', index: 4 },
  { type: 'left-hand', index: 3 },
  { type: 'right-hand', index: 4 },
  { type: 'head', index: 5 },
  { type: 'body', index: 6 },
  { type: 'legs', index: 7 },
  { type: 'hands', index: 8 },
  { type: 'feet', index: 9 },
  { type: 'chest', index: 10 },
  { type: 'cape', index: 11 }
];

export function getAnimationIndex(equip: string[]): number {
  for (const { type, index } of EQUIPMENT_ANIMATION_INDEXES) {
    if (equip.indexOf(type) > -1) {
      return index;
    }
  }
  throw new RangeError(`unable to find animation index for ${equip}`);
}

// ============================================================================
// CONSTRUCTORS
// ============================================================================

export class Item {
  id: number;
  amount: number;
  equipped?: boolean;

  constructor(config: { id: number; amount: number; equipped?: boolean }) {
    this.id = config.id;
    this.amount = config.amount ?? 1;
    this.equipped = config.equipped ?? false;
  }

  get definition() {
    return itemsConfig[this.id] || {
      id: this.id,
      name: `Item #${this.id}`,
      stackable: false,
      members: false,
      icon: "📦",
      equip: [],
      price: 0
    };
  }
}

export class Inventory {
  player: any;
  items: Item[];
  equipmentSlots: Record<string, number>;

  constructor(player: any, initialItems: any[] = []) {
    this.player = player;
    this.items = (Array.isArray(initialItems) ? initialItems : []).map(item => new Item(item));

    this.equipmentSlots = {
      '2-handed': -1,
      'replace-head': -1,
      'replace-body': -1,
      'replace-legs': -1,
      'right-hand': -1,
      'left-hand': -1,
      head: -1,
      body: -1,
      legs: -1,
      hands: -1,
      feet: -1,
      chest: -1,
      cape: -1
    };

    this.updateEquipmentSlots();
  }

  add(id: number, amount = 1) {
    if (!this.player.world?.members && itemsConfig[id]?.members) {
      return;
    }

    const isStackable = itemsConfig[id]?.stackable ?? false;

    if (isStackable) {
      for (let i = 0; i < this.items.length; i += 1) {
        const item = this.items[i];
        if (item.id === id) {
          item.amount += amount;
          this.sendUpdate(i, item);
          return;
        }
      }
    }

    if (this.isFull()) {
      this.player.message?.(
        `Your Inventory is full, the ${itemsConfig[id]?.name ?? `Item #${id}`} drops to ground!`
      );
      this.player.world?.addPlayerDrop?.(this.player, { id, amount });
      this.player.sendSound?.('dropobject');
      return;
    }

    const item = new Item({ id, amount });
    const index = this.items.push(item) - 1;

    this.sendUpdate(index, item);

    if (!isStackable && amount > 1) {
      this.add(id, amount - 1);
    }
  }

  has(id: number, amount = 1): boolean {
    if (!this.player.world?.members && itemsConfig[id]?.members) {
      return false;
    }

    let inventoryAmount = 0;
    const stackable = itemsConfig[id]?.stackable ?? false;

    for (const item of this.items) {
      if (item.id === id) {
        if (stackable && item.amount >= amount) {
          return true;
        } else {
          inventoryAmount += 1;
        }
      }
    }

    if (inventoryAmount >= amount) {
      return true;
    }

    return false;
  }

  remove(id: number, amount = 1) {
    let foundIndex = -1;

    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      if (this.items[i].id === id) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex > -1) {
      const item = this.items[foundIndex];

      if (item.equipped) {
        this.unequip(foundIndex);
      }

      if (!item.definition.stackable || item.amount === amount) {
        this.items.splice(foundIndex, 1);
        this.updateEquipmentIndexes(foundIndex);
        this.sendRemove(foundIndex);

        amount -= 1;

        if (amount > 0) {
          this.remove(id, amount);
        }
      } else {
        item.amount -= amount;
        this.sendUpdate(foundIndex, item);
      }
    }
  }

  drop(index: number) {
    const item = this.items[index];

    if (!item) {
      throw new RangeError(`invalid item index ${index}`);
    }

    if (item.equipped) {
      this.unequip(index);
    }

    this.items.splice(index, 1);
    this.updateEquipmentIndexes(index);

    this.player.world?.addPlayerDrop?.(this.player, item);
    this.player.sendSound?.('dropobject');

    this.sendRemove(index);
  }

  unequip(index: number) {
    const item = this.items[index];

    if (!item) {
      throw new RangeError(`invalid item index ${index}`);
    }

    if (!item.equipped) {
      throw new Error(`item index ${index} not equipped`);
    }

    const equipTypes = item.definition.equip || [];
    for (const type of equipTypes) {
      this.equipmentSlots[type] = -1;
    }

    let animationIndex = 4;
    try {
      animationIndex = getAnimationIndex(equipTypes);
    } catch (e) {}

    if (this.player.animations) {
      if (animationIndex === 0) {
        this.player.animations[0] = this.player.appearance?.headSprite ?? 1;
      } else if (animationIndex === 1) {
        this.player.animations[1] = this.player.appearance?.bodySprite ?? 2;
      } else if (animationIndex === 2) {
        this.player.animations[2] = 3;
      } else {
        this.player.animations[animationIndex] = 0;
      }
    }

    item.equipped = false;
    this.sendUpdate(index, item);

    this.updateEquipmentBonuses();
    this.player.broadcastPlayerAppearance?.(true);
  }

  equip(index: number) {
    const item = this.items[index];

    if (!item) {
      throw new RangeError(`invalid item index ${index}`);
    }

    if (!item.definition.wieldable) {
      throw new RangeError(`equipping unequipable item index ${index}`);
    }

    const requirements = item.definition.wieldable.requirements;

    if (requirements) {
      for (const [skillName, level] of Object.entries(requirements)) {
        const curLevel = this.player.skills?.[skillName]?.base ?? this.player.skills?.[skillName]?.current ?? 1;
        if (curLevel < level) {
          const formattedSkill = skillName.toUpperCase();
          this.player.message?.(
            `You are not a high enough level to use this item! You need ${formattedSkill} level ${level}.`
          );
          return;
        }
      }
    }

    const equipTypes = item.definition.equip || [];
    for (const type of equipTypes) {
      const equippedIndex = this.equipmentSlots[type];

      if (equippedIndex !== -1) {
        this.unequip(equippedIndex);
      }

      this.equipmentSlots[type] = index;
    }

    let animationIndex = 4;
    try {
      animationIndex = getAnimationIndex(equipTypes);
    } catch (e) {}

    if (this.player.animations) {
      this.player.animations[animationIndex] = item.definition.wieldable.animation;
    }

    item.equipped = true;
    this.sendUpdate(index, item);

    this.updateEquipmentBonuses();
    this.player.broadcastPlayerAppearance?.(true);
  }

  updateEquipmentSlots() {
    for (const type of Object.keys(this.equipmentSlots)) {
      this.equipmentSlots[type] = -1;
    }

    for (let i = 0; i < this.items.length; i += 1) {
      const item = this.items[i];

      if (!item.equipped) {
        continue;
      }

      const equipTypes = item.definition.equip || [];
      for (const type of equipTypes) {
        this.equipmentSlots[type] = i;
      }

      let animationIndex = 4;
      try {
        animationIndex = getAnimationIndex(equipTypes);
      } catch (e) {}

      if (this.player.animations) {
        this.player.animations[animationIndex] = item.definition.wieldable?.animation ?? 0;
      }
    }
  }

  updateEquipmentBonuses() {
    if (!this.player.equipmentBonuses) {
      this.player.equipmentBonuses = {
        armour: 1,
        weaponAim: 1,
        weaponPower: 1,
        magic: 1,
        prayer: 1
      };
    } else {
      for (const bonus of EQUIPMENT_BONUS_NAMES) {
        this.player.equipmentBonuses[bonus] = 1;
      }
    }

    for (const item of this.items) {
      if (item.equipped && item.definition.wieldable) {
        for (const bonus of EQUIPMENT_BONUS_NAMES) {
          const val = item.definition.wieldable[bonus] ?? 0;
          this.player.equipmentBonuses[bonus] += val;
        }
      }
    }

    this.player.sendEquipmentBonuses?.();
  }

  updateEquipmentIndexes(fromIndex: number) {
    for (const type of Object.keys(this.equipmentSlots)) {
      if (this.equipmentSlots[type] > fromIndex) {
        this.equipmentSlots[type] -= 1;
      } else if (this.equipmentSlots[type] === fromIndex) {
        this.equipmentSlots[type] = -1;
      }
    }
  }

  sendAll() {
    this.player.send?.({
      type: 'inventoryItems',
      items: this.items.map((item) => {
        const i: any = { id: item.id, amount: item.amount, equipped: item.equipped };
        if (!item.definition.stackable) {
          delete i.amount;
        }
        return i;
      })
    });
  }

  sendUpdate(index: number, { id, amount, equipped }: Item) {
    const message: any = {
      type: 'inventoryItemUpdate',
      index,
      id,
      amount,
      equipped
    };

    if (!itemsConfig[id]?.stackable) {
      delete message.amount;
    }

    this.player.send?.(message);
  }

  sendRemove(index: number) {
    this.player.send?.({ type: 'inventoryItemRemove', index });
  }

  isEquipped(id: number) {
    if (!this.has(id)) {
      return false;
    }

    for (const index of Object.values(this.equipmentSlots)) {
      if (index < 0) {
        continue;
      }

      const item = this.items[index];
      if (item && item.id === id) {
        return true;
      }
    }

    return false;
  }

  getRangedWeapon() {
    const index = this.equipmentSlots['right-hand'];
    if (index < 0) return;
    const item = this.items[index];
    if (item && (item.id === 59 || item.id === 60)) {
      return item;
    }
  }

  getAmmunitionID(messages = true) {
    const index = this.equipmentSlots['right-hand'];
    if (index < 0) {
      if (messages) this.player.message?.("You don't have enough ammo in your quiver");
      return -1;
    }
    return -1;
  }

  isFull() {
    return this.items.length >= 30;
  }

  toJSON() {
    return this.items;
  }
}

export class Bank {
  player: any;
  items: Item[];
  maxItems: number;

  constructor(player: any, itemsInput: any[] = []) {
    this.player = player;
    this.items = (Array.isArray(itemsInput) ? itemsInput : []).map(item => new Item(item));
    this.maxItems = 1500;
  }

  open() {
    this.player.lock?.();
    if (this.player.interfaceOpen) {
      this.player.interfaceOpen.bank = true;
    }
    this.sendOpen();
  }

  sendOpen() {
    this.player.send?.({
      type: "bankOpen",
      maxItems: this.maxItems,
      items: this.items
    });
  }

  close(send = true) {
    if (this.player.interfaceOpen) {
      this.player.interfaceOpen.bank = false;
    }
    this.player.unlock?.();

    if (send) {
      this.player.send?.({ type: "bankClose" });
    }
  }

  getItem({ id }: { id: number }) {
    return this.items.find(item => item.id === id);
  }

  deposit(id: number, amount: number) {
    if (!this.player.inventory.has(id, amount)) {
      throw new RangeError(`${this} depositing item they don't have`);
    }

    const bankItem = this.getItem({ id });

    if (this.isFull() && !bankItem) {
      this.player.message?.("You don't have room for that in your bank");
      return;
    }

    this.player.inventory.remove(id, amount);

    let index;

    if (bankItem) {
      bankItem.amount += amount;
      index = this.items.indexOf(bankItem);
    } else {
      index = this.items.push(new Item({ id, amount })) - 1;
    }

    this.update(index);
  }

  withdraw(id: number, amount: number) {
    const bankItem = this.getItem({ id });

    if (!bankItem || bankItem.amount < amount) {
      throw new RangeError(`${this} withdrawing item they don't have`);
    }

    const stackable = itemsConfig[id]?.stackable ?? false;
    const freeSlots = 30 - this.player.inventory.items.length;
    let amountToWithdraw = amount;

    if (stackable) {
      if (!this.player.inventory.has(id) && freeSlots < 1) {
        this.player.message?.("You don't have enough room in your inventory");
        return;
      }
    } else {
      if (freeSlots === 0) {
        this.player.message?.("You don't have enough room in your inventory");
        return;
      }

      if (amountToWithdraw > freeSlots) {
        amountToWithdraw = freeSlots;
        this.player.message?.("Your inventory is full");
      }
    }

    this.player.inventory.add(id, amountToWithdraw);
    const index = this.items.indexOf(bankItem);
    bankItem.amount -= amountToWithdraw;

    if (bankItem.amount === 0) {
      this.items.splice(index, 1);
      this.sendOpen();
    } else {
      this.update(index);
    }
  }

  update(index: number) {
    const item = this.items[index];
    this.player.send?.({ type: "bankUpdate", index, id: item.id, amount: item.amount });
  }

  has(id: number | { id: number; amount: number }, amount = 1) {
    let checkId: number;
    let checkAmount: number = amount;

    if (typeof id !== "number" && id !== null) {
      checkAmount = id.amount;
      checkId = id.id;
    } else {
      checkId = id as number;
    }

    if (!this.player.world?.members && itemsConfig[checkId]?.members) {
      return false;
    }

    for (const item of this.items) {
      if (item.id === checkId && item.amount >= checkAmount) {
        return true;
      }
    }

    return false;
  }

  isFull() {
    return this.items.length >= this.maxItems;
  }

  toJSON() {
    return this.items;
  }
}
