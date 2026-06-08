/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class Box {
  public x: number;
  public y: number;
  public w: number;
  public h: number;
  public width: number;
  public height: number;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.width = w;
    this.height = h;
  }

  contains(point: { x: number; y: number }): boolean {
    return (
      point.x >= this.x &&
      point.x <= this.x + this.w &&
      point.y >= this.y &&
      point.y <= this.y + this.h
    );
  }

  intersects(range: Box): boolean {
    return !(
      range.x > this.x + this.w ||
      range.x + range.w < this.x ||
      range.y > this.y + this.h ||
      range.y + range.h < this.y
    );
  }
}

export class QuadTree {
  public boundary: Box;
  public capacity: number;
  public points: any[] = [];
  public divided: boolean = false;

  public northeast!: QuadTree;
  public northwest!: QuadTree;
  public southeast!: QuadTree;
  public southwest!: QuadTree;
  public arePointsEqual: (p1: any, p2: any) => boolean;

  constructor(boundary: Box, options: { capacity?: number; arePointsEqual?: (p1: any, p2: any) => boolean } = {}) {
    this.boundary = boundary;
    this.capacity = options.capacity || 64;
    this.arePointsEqual = options.arePointsEqual || ((p1, p2) => p1 === p2);
  }

  subdivide() {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.w / 2;
    const h = this.boundary.h / 2;

    const nw = new Box(x, y, w, h);
    this.northwest = new QuadTree(nw, { capacity: this.capacity, arePointsEqual: this.arePointsEqual });

    const ne = new Box(x + w, y, w, h);
    this.northeast = new QuadTree(ne, { capacity: this.capacity, arePointsEqual: this.arePointsEqual });

    const sw = new Box(x, y + h, w, h);
    this.southwest = new QuadTree(sw, { capacity: this.capacity, arePointsEqual: this.arePointsEqual });

    const se = new Box(x + w, y + h, w, h);
    this.southeast = new QuadTree(se, { capacity: this.capacity, arePointsEqual: this.arePointsEqual });

    this.divided = true;

    // Distribute existing points
    for (const point of this.points) {
      this.insertToChildren(point);
    }
    this.points = [];
  }

  private insertToChildren(point: any): boolean {
    if (this.northwest.insert(point)) return true;
    if (this.northeast.insert(point)) return true;
    if (this.southwest.insert(point)) return true;
    if (this.southeast.insert(point)) return true;
    return false;
  }

  insert(point: any): boolean {
    if (!this.boundary.contains(point)) {
      return false;
    }

    if (!this.divided) {
      if (this.points.length < this.capacity) {
        this.points.push(point);
        return true;
      }
      this.subdivide();
    }

    return this.insertToChildren(point);
  }

  remove(point: any): boolean {
    if (!this.boundary.contains(point)) {
      return false;
    }

    if (!this.divided) {
      const idx = this.points.findIndex(p => this.arePointsEqual(p, point));
      if (idx !== -1) {
        this.points.splice(idx, 1);
        return true;
      }
      return false;
    }

    if (this.northwest.remove(point)) return true;
    if (this.northeast.remove(point)) return true;
    if (this.southwest.remove(point)) return true;
    if (this.southeast.remove(point)) return true;

    return false;
  }

  query(range: Box, found: any[] = []): any[] {
    if (!this.boundary.intersects(range)) {
      return found;
    }

    if (!this.divided) {
      for (const p of this.points) {
        if (range.contains(p)) {
          found.push(p);
        }
      }
    } else {
      this.northwest.query(range, found);
      this.northeast.query(range, found);
      this.southwest.query(range, found);
      this.southeast.query(range, found);
    }

    return found;
  }
}

export class EntityList<T extends { x: number; y: number; index?: number; id?: number } = any> {
  public entities: Array<T | null> = [];
  public length: number = 0;
  public quadTree: QuadTree;

  constructor(width: number, height: number) {
    this.quadTree = new QuadTree(new Box(0, 0, width, height), {
      capacity: 64,
      arePointsEqual: (point1: any, point2: any) => {
        return (
          point1.index === point2.index &&
          point1.x === point2.x &&
          point1.y === point2.y
        );
      }
    });
  }

  add(entity: T): number {
    this.quadTree.insert(entity);
    this.length += 1;

    for (let i = 0; i < this.entities.length; i += 1) {
      if (!this.entities[i]) {
        entity.index = i;
        this.entities[i] = entity;
        return i;
      }
    }

    const index = this.entities.push(entity) - 1;
    entity.index = index;
    return index;
  }

  remove(entity: T): boolean {
    if (entity.index === undefined || this.entities[entity.index] !== entity) {
      return false;
    }

    this.entities[entity.index] = null;
    this.quadTree.remove(entity);
    this.length -= 1;

    return true;
  }

  getAll(): T[] {
    return this.entities.filter((entity): entity is T => entity !== null);
  }

  *getAllGenerator() {
    for (const entity of this.entities) {
      if (entity) {
        yield entity;
      }
    }
  }

  get size(): number {
    return this.length;
  }

  getByIndex(index: number): T | null {
    return this.entities[index] || null;
  }

  getInArea(x: number, y: number, range: number): T[] {
    const minX = x - Math.floor(range / 2);
    const minY = y - Math.floor(range / 2);
    return this.quadTree.query(new Box(minX, minY, range, range));
  }

  getAtPoint(x: number, y: number): T[] {
    return this.quadTree.query(new Box(x, y, 0, 0));
  }

  *getAllByID(id: number) {
    for (const entity of this.getAll()) {
      if (entity.id === id) {
        yield entity;
      }
    }
  }

  getByID(id: number): T | undefined {
    for (const entity of this.getAll()) {
      if (entity.id === id) {
        return entity;
      }
    }
    return undefined;
  }
}
