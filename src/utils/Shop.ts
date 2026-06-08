/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Item } from "./Bank";

// default to coins (ID: 10) as shop currency
export const DEFAULT_CURRENCY = 10;

// maximum amount a stack of items can hold
export const ITEM_STACK_CAPACITY = Math.pow(2, 16) - 1;

// maximum number of items a shop can hold
export const ITEM_CAPACITY = 40;

// Authentic RSC Shops Preset
export const shopsConfig: Record<string, any> = {
  general: {
    name: "General Store",
    general: true,
    buyMultiplier: 100,
    sellMultiplier: 40,
    delta: 1,
    restock: 10000,
    items: [
      { id: 135, amount: 5 }, // Bronze Axe
      { id: 1263, amount: 2 }, // Sleeping Bag
      { id: 10, amount: 1000 } // Coins
    ]
  },
  sword: {
    name: "Sword Shop",
    general: false,
    buyMultiplier: 100,
    sellMultiplier: 45,
    delta: 1,
    restock: 15000,
    items: [
      { id: 16, amount: 10 }, // Bronze Longsword
    ]
  },
  magic: {
    name: "Magic Shop",
    general: false,
    buyMultiplier: 100,
    sellMultiplier: 50,
    delta: 1,
    restock: 8000,
    items: [
      { id: 38, amount: 200 }, // Fire Rune
      { id: 546, amount: 50 }, // Death Rune
    ]
  }
};

export class Shop {
  public world: any;
  public name: string;
  public definition: any;
  public occupants: Set<any>;
  public items: Item[];
  public currency: number;
  public updateTimeout: number | any | null = null;
  public restockIntervalId: any | null = null;

  public boundRestock: () => void;
  public boundUpdate: () => void;

  constructor(world: any, name: string) {
    this.world = world;
    this.name = name;

    this.definition = shopsConfig[name] || shopsConfig.general;

    if (!this.definition) {
      throw new Error(`invalid shop name: "${this.name}"`);
    }

    // players viewing the shop
    this.occupants = new Set();

    // the items being sold and current prices
    this.items = this.definition.items.map((item: any) => new Item(item));

    if (world && !world.members) {
      this.items = this.items.filter((item) => {
        return !item.definition?.members;
      });
    }

    this.currency = this.definition.currency || DEFAULT_CURRENCY;

    this.boundRestock = this.restock.bind(this);
    this.boundUpdate = this.update.bind(this);

    // Initial restock timer activation
    if (typeof window !== "undefined") {
      this.restockIntervalId = window.setInterval(this.boundRestock, this.definition.restock);
    }
  }

  // determines whether or not an item is part of a shop's "regular" inventory
  getShopInventory(item: { id: number }) {
    if (!this.definition?.items) return undefined;
    return this.definition.items.find((i: any) => i.id === item.id);
  }

  getItemDeltaPrice(item: any) {
    const shopItem = this.getShopInventory(item);
    let stockAmount = 0;

    if (shopItem) {
      stockAmount = shopItem.amount;
    }

    return (stockAmount - item.amount) * this.definition.delta;
  }

  getItemPrice(item: any, isSelling: boolean) {
    const multiplier = this.definition[
      `${isSelling ? 'buy' : 'sell'}Multiplier`
    ];

    let priceMod = multiplier + this.getItemDeltaPrice(item);

    if (priceMod < 10) {
      priceMod = 10;
    }

    const basePrice = item.definition?.price ?? 1;
    return Math.max(1, Math.floor((priceMod * basePrice) / 100));
  }

  restock() {
    let updated = false;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const shopInventory = this.getShopInventory(item);

      if (shopInventory) {
        // regular shop item
        if (item.amount > shopInventory.amount) {
          item.amount -= 1;
          updated = true;
        } else if (item.amount < shopInventory.amount) {
          item.amount += 1;
          updated = true;
        }
      } else {
        // non-shop item, decrease its amount by one
        if (item.amount <= 1) {
          // remove the item if theres 1 or less
          this.items.splice(i, 1);
        } else {
          item.amount -= 1;
        }
        updated = true;
      }
    }

    if (updated) {
      this.updateOccupants();
    }
  }

  updateOccupants() {
    for (const occupant of this.occupants) {
      if (typeof occupant.openShop === "function") {
        occupant.openShop(this.name);
      }
    }
  }

  buy(player: any, id: number, price: number) {
    if (!this.occupants.has(player)) {
      return;
    }

    const shopItem = this.items.find((i) => i.id === id);

    // trying to buy non-existent item
    if (!shopItem) {
      return;
    }

    if (shopItem.amount <= 0) {
      player.message?.('The shop has ran out of stock');
      return;
    }

    const itemPrice = this.getItemPrice(shopItem, false);

    if (price !== itemPrice) {
      return;
    }

    if (!player.inventory?.has?.(10, itemPrice)) {
      player.message?.("You don't have enough coins");
      return;
    }

    shopItem.amount -= 1;

    const inInventory = !!this.getShopInventory(shopItem);

    if (shopItem.amount <= 0 && !inInventory) {
      this.items.splice(this.items.indexOf(shopItem), 1);
    }

    player.inventory.remove(this.currency, price);
    player.inventory.add(shopItem.id);
    player.sendSound?.('coins');

    // trigger tick update
    if (this.updateTimeout) {
      this.world?.clearTickTimeout?.(this.updateTimeout);
    }

    if (this.world?.nextTick) {
      this.updateTimeout = this.world.nextTick(this.boundUpdate);
    } else {
      this.boundUpdate();
    }
  }

  sell(player: any, id: number, price: number) {
    if (!this.occupants.has(player)) {
      return;
    }

    if (!player.inventory?.has?.(id)) {
      return;
    }

    const item = new Item({ id, amount: 0 });

    if (this.world && !this.world.members && item.definition?.members) {
      return;
    }

    const shopInventoryItem = this.getShopInventory(item);

    if (!this.definition.general && !shopInventoryItem) {
      player.message?.('You cannot sell this item to this shop');
      return;
    }

    const shopItem = this.items.find((i) => i.id === id);

    item.amount = 0;

    // get the price of the shop item with amount, otherwise
    const itemPrice = shopItem
      ? this.getItemPrice(shopItem, true)
      : this.getItemPrice(item, true);

    if (price !== itemPrice) {
      return;
    }

    item.amount = 1;

    if (shopItem) {
      if (shopItem.amount < ITEM_STACK_CAPACITY) {
        shopItem.amount += 1;
      } else {
        player.message?.('This shop has enough of that item');
        return;
      }
    } else {
      if (this.items.length < ITEM_CAPACITY) {
        this.items.push(item);
      } else {
        player.message?.('This shop is full');
        return;
      }
    }

    player.inventory.remove(id);
    player.inventory.add(this.currency, price);
    player.sendSound?.('coins');

    if (this.updateTimeout) {
      this.world?.clearTickTimeout?.(this.updateTimeout);
    }

    if (this.world?.nextTick) {
      this.updateTimeout = this.world.nextTick(this.boundUpdate);
    } else {
      this.boundUpdate();
    }
  }

  update() {
    this.updateOccupants();
    this.updateTimeout = null;
  }

  destroy() {
    if (this.restockIntervalId) {
      clearInterval(this.restockIntervalId);
    }
  }
}
