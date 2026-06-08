/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { itemsConfig } from "./items";

export const MAX_STACK_SIZE = Math.pow(2, 31);

export enum StackPolicy {
  NEVER = "StackPolicy_NEVER",
  ALWAYS = "StackPolicy_ALWAYS",
  USE_FUNCTION = "StackPolicy_USE_FUNCTION"
}

export function defaultComparator(a: any, b: any): boolean {
  return a === b;
}

export function IDComparator(a: any, b: any): boolean {
  return a !== null && a !== undefined && b !== null && b !== undefined && a.id === b.id;
}

export function defaultStackable(element: any): boolean {
  return false;
}

export function definitionStackable(element: any): boolean {
  return element !== null && element !== undefined && (itemsConfig[element.id]?.stackable ?? false);
}

export class Container {
  public slots: Array<[any, number] | undefined>;
  public size: number;
  public capacity: number;
  public stackPolicy: StackPolicy;
  public comparator: (a: any, b: any) => boolean;
  public stackable: (element: any) => boolean;

  constructor(
    capacity: number,
    stackPolicy: StackPolicy = StackPolicy.NEVER,
    comparator: (a: any, b: any) => boolean = defaultComparator,
    stackable: (element: any) => boolean = defaultStackable
  ) {
    this.slots = new Array(capacity);
    this.size = 0;
    this.capacity = capacity;
    this.stackPolicy = stackPolicy;
    this.comparator = comparator;
    this.stackable = stackable;
  }

  clear() {
    this.slots = new Array(this.capacity);
    this.size = 0;
  }

  add(element: any, amount = 1): boolean {
    if (element === null || element === undefined || amount < 0 || amount > MAX_STACK_SIZE) {
      return false;
    }

    switch (this.stackPolicy) {
      case StackPolicy.NEVER:
        if (this.size + amount > this.capacity) {
          return false;
        }

        for (let i = 0; i < amount; i++) {
          this.slots[this.size] = [element, 1];
          this.size += 1;
        }
        return true;

      case StackPolicy.ALWAYS:
        // check if the item already is in a slot
        for (let i = 0; i < this.size; i++) {
          const slot = this.slots[i];
          if (!slot) continue;
          const [elem, count] = slot;

          if (this.comparator(element, elem)) {
            const totalAmount = count + amount;

            if (totalAmount > MAX_STACK_SIZE) {
              // too large to hold
              return false;
            }

            this.slots[i] = [element, totalAmount];
            return true;
          }
        }

        // its not already in a slot, check if we can just add it
        if (this.size >= this.capacity) {
          return false;
        }

        this.slots[this.size] = [element, amount];
        this.size += 1;
        return true;

      case StackPolicy.USE_FUNCTION: {
        const canStack = this.stackable(element);

        for (let i = 0; canStack && i < this.size; i++) {
          const slot = this.slots[i];
          if (!slot) continue;
          const [elem, count] = slot;

          if (this.comparator(element, elem)) {
            const totalAmount = count + amount;

            if (totalAmount > MAX_STACK_SIZE) {
              return false;
            }

            this.slots[i] = [element, totalAmount];
            return true;
          }
        }

        if (this.size >= this.capacity) {
          return false;
        }

        this.slots[this.size] = [element, amount];
        this.size += 1;
        return true;
      }
    }
  }

  remove(element: any, amount = 1): boolean {
    if (element === null || element === undefined || amount < 0 || amount > MAX_STACK_SIZE) {
      return false;
    }

    const newSlots: Array<[any, number]> = [];
    let newSize = 0;

    switch (this.stackPolicy) {
      case StackPolicy.NEVER:
        if (this.size - amount < 0) {
          return false;
        }

        for (let i = 0; i < this.size; i++) {
          const slot = this.slots[i];
          if (!slot) continue;
          const [elem] = slot;

          if (amount > 0 && this.comparator(element, elem)) {
            amount -= 1;
          } else {
            newSlots.push([elem, 1]);
            newSize += 1;
          }
        }

        if (amount === 0) {
          // we removed all elements
          this.slots = newSlots;
          this.slots.length = this.capacity; // maintain capacity bounds
          this.size = newSize;
          return true;
        } else {
          // not enough elements to remove
          return false;
        }

      case StackPolicy.ALWAYS:
      case StackPolicy.USE_FUNCTION:
        for (let i = 0; i < this.size; i++) {
          const slot = this.slots[i];
          if (!slot) continue;
          const [elem, count] = slot;

          if (this.comparator(element, elem)) {
            const totalAmount = count - amount;

            if (totalAmount < 0) {
              // not large enough
              return false;
            }

            if (totalAmount === 0) {
              this.slots.splice(i, 1);
              this.slots.push(undefined); // maintain size/capacity padding
              this.slots.length = this.capacity;
              this.size -= 1;
            } else {
              this.slots[i] = [element, totalAmount];
            }
            return true;
          }
        }

        return false;
    }
  }

  has(element: any, amount = 1): boolean {
    return this.count(element) >= amount;
  }

  count(element: any): number {
    let elemCount = 0;

    for (let i = 0; i < this.size; i++) {
      const slot = this.slots[i];
      if (!slot) continue;
      const [elem, count] = slot;

      if (this.comparator(element, elem)) {
        elemCount += count;
      }
    }

    return elemCount;
  }

  toJSON() {
    return this.slots.filter(Boolean);
  }
}
