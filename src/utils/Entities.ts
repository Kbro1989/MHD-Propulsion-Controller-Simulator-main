/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { itemsConfig } from "./items";

export class Entity {
  public world: any;
  public x: number = 0;
  public y: number = 0;
  public currentRegion: any = null;
  public index: number = -1;

  constructor(world: any) {
    this.world = world;
  }

  withinRange(other: { x: number; y: number }, range: number): boolean {
    const deltaX = Math.abs(this.x - other.x);
    const deltaY = Math.abs(this.y - other.y);
    return deltaX <= range && deltaY <= range;
  }
}

// Dummy/Fallback object configs since config files might be mocked
export const objectsConfig: Record<number, { name: string; width: number; height: number }> = {
  1: { name: "Gate", width: 1, height: 1 },
  2: { name: "Door", width: 1, height: 1 },
  3: { name: "Chest", width: 1, height: 1 },
  4: { name: "Tree", width: 2, height: 2 },
  5: { name: "Mine Cart Switch", width: 1, height: 1 }
};

export const wallObjectsConfig: Record<number, { name: string }> = {
  1: { name: "Wooden Wall" },
  2: { name: "Stone Wall" }
};

export class GameObject extends Entity {
  public id: number;
  public direction: number;
  public definition: { name: string; width: number; height: number };
  public width: number;
  public height: number;

  constructor(world: any, { id, direction, x, y }: { id: number; direction: number; x: number; y: number }) {
    super(world);

    this.id = id;
    this.direction = direction;
    this.x = x;
    this.y = y;

    this.definition = objectsConfig[this.id] || { name: `GameObject #${this.id}`, width: 1, height: 1 };

    if (!this.definition) {
      throw new RangeError(`invalid GameObject id ${this.id}`);
    }

    this.width = this.definition.width;
    this.height = this.definition.height;

    if (this.direction === 2 || this.direction === 6) {
      // Coordinates swap for rotated dimensions
      const temp = this.width;
      this.width = this.height;
      this.height = temp;
    }
  }
}

export class GroundItem extends Entity {
  public id: number;
  public amount: number;
  public respawn: any;
  public definition: any;

  constructor(world: any, { id, amount = 1, respawn, x, y }: { id: number; amount?: number; respawn?: any; x: number; y: number }) {
    super(world);

    this.id = id;
    this.amount = amount;
    this.respawn = respawn;
    this.x = x;
    this.y = y;

    this.definition = itemsConfig[this.id];

    if (!this.definition) {
      this.definition = { id: this.id, name: `Item #${this.id}`, stackable: false, members: false, price: 0 };
    }
  }
}

export class WallObject extends Entity {
  public id: number;
  public direction: number;
  public definition: { name: string };

  constructor(world: any, { id, direction, x, y }: { id: number; direction: number; x: number; y: number }) {
    super(world);

    this.id = id;
    this.direction = direction;
    this.x = x;
    this.y = y;

    this.definition = wallObjectsConfig[this.id] || { name: `WallObject #${this.id}` };

    if (!this.definition) {
      throw new RangeError(`invalid WallObject id ${this.id}`);
    }
  }
}
