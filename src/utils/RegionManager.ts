/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class Region {
  public regionX: number; // Region coordinate (worldX / 64)
  public regionY: number; // Region coordinate (worldY / 64)

  // Entity collections
  public players = new Set<any>();
  public npcs = new Set<any>();
  public gameObjects = new Set<any>();
  public groundItems = new Set<any>();

  // Region bounds
  public minX: number;
  public maxX: number;
  public minY: number;
  public maxY: number;

  constructor(regionX: number, regionY: number) {
    this.regionX = regionX;
    this.regionY = regionY;

    this.minX = regionX * 64;
    this.maxX = (regionX + 1) * 64 - 1;
    this.minY = regionY * 64;
    this.maxY = (regionY + 1) * 64 - 1;
  }

  /**
   * Add an entity to this region
   */
  addEntity(type: string, entity: any) {
    switch (type) {
      case 'player':
        this.players.add(entity);
        break;
      case 'npc':
        this.npcs.add(entity);
        break;
      case 'gameObject':
        this.gameObjects.add(entity);
        break;
      case 'groundItem':
        this.groundItems.add(entity);
        break;
    }
  }

  /**
   * Remove an entity from this region
   */
  removeEntity(type: string, entity: any) {
    switch (type) {
      case 'player':
        this.players.delete(entity);
        break;
      case 'npc':
        this.npcs.delete(entity);
        break;
      case 'gameObject':
        this.gameObjects.delete(entity);
        break;
      case 'groundItem':
        this.groundItems.delete(entity);
        break;
    }
  }

  /**
   * Check if coordinates are within this region
   */
  contains(x: number, y: number): boolean {
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
  }

  /**
   * Get all players in this region and adjacent regions (for view area)
   */
  getPlayersInView(regionManager: RegionManager): any[] {
    const players = new Set<any>(this.players);

    // Add players from 8 surrounding regions
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const neighbor = regionManager.getRegionByRegionCoords(
          this.regionX + dx,
          this.regionY + dy
        );

        if (neighbor) {
          neighbor.players.forEach(p => players.add(p));
        }
      }
    }

    return Array.from(players);
  }

  /**
   * Get all NPCs in this region and adjacent regions
   */
  getNpcsInView(regionManager: RegionManager): any[] {
    const npcs = new Set<any>(this.npcs);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const neighbor = regionManager.getRegionByRegionCoords(
          this.regionX + dx,
          this.regionY + dy
        );

        if (neighbor) {
          neighbor.npcs.forEach(n => npcs.add(n));
        }
      }
    }

    return Array.from(npcs);
  }
}

export class RegionManager {
  public world: any;
  public regions = new Map<string, Region>(); // Key: "x,y" -> Region

  constructor(world: any) {
    this.world = world;
  }

  /**
   * Get or create a region at the given world coordinates
   */
  getRegion(x: number, y: number): Region {
    const regionX = Math.floor(x / 64);
    const regionY = Math.floor(y / 64);
    const key = `${regionX},${regionY}`;

    if (!this.regions.has(key)) {
      this.regions.set(key, new Region(regionX, regionY));
    }

    return this.regions.get(key)!;
  }

  /**
   * Get region by world coordinates
   */
  getRegionByWorldCoords(worldX: number, worldY: number): Region {
    return this.getRegion(worldX, worldY);
  }

  /**
   * Get region by region coordinates
   */
  getRegionByRegionCoords(regionX: number, regionY: number): Region | undefined {
    const key = `${regionX},${regionY}`;
    // dynamically create if it doesn't exist to prevent boundary query gaps
    if (!this.regions.has(key)) {
      if (regionX >= 0 && regionX < 16 && regionY >= 0 && regionY < 16) {
        this.regions.set(key, new Region(regionX, regionY));
      }
    }
    return this.regions.get(key);
  }

  /**
   * Add an entity to the appropriate region
   */
  addEntity(type: string, entity: any) {
    const region = this.getRegion(entity.x, entity.y);
    region.addEntity(type, entity);

    // Store region reference on entity for quick access
    entity.currentRegion = region;
  }

  /**
   * Remove an entity from its region
   */
  removeEntity(type: string, entity: any) {
    if (entity.currentRegion) {
      entity.currentRegion.removeEntity(type, entity);
      entity.currentRegion = null;
    }
  }

  /**
   * Update entity's region if it moved to a new region
   */
  updateEntityRegion(type: string, entity: any, oldX: number, oldY: number): boolean {
    const oldRegion = this.getRegion(oldX, oldY);
    const newRegion = this.getRegion(entity.x, entity.y);

    // Only update if entity moved to a different region
    if (oldRegion !== newRegion) {
      oldRegion.removeEntity(type, entity);
      newRegion.addEntity(type, entity);
      entity.currentRegion = newRegion;
      return true; // Changed regions
    }

    return false; // Same region
  }

  /**
   * Get all entities within a radius (in regions)
   */
  getEntitiesInRadius(type: string, centerX: number, centerY: number, radiusInRegions = 1): any[] {
    const entities = new Set<any>();
    const centerRegionX = Math.floor(centerX / 64);
    const centerRegionY = Math.floor(centerY / 64);

    for (let dx = -radiusInRegions; dx <= radiusInRegions; dx++) {
      for (let dy = -radiusInRegions; dy <= radiusInRegions; dy++) {
        const region = this.getRegionByRegionCoords(
          centerRegionX + dx,
          centerRegionY + dy
        );

        if (region) {
          const collection = type === 'player' ? region.players :
            type === 'npc' ? region.npcs :
              type === 'gameObject' ? region.gameObjects :
                region.groundItems;

          collection.forEach(e => entities.add(e));
        }
      }
    }

    return Array.from(entities);
  }

  /**
   * Check if world coordinates are valid
   */
  withinWorld(x: number, y: number): boolean {
    return x >= 0 && x < 944 && y >= 0 && y < 944;
  }

  /**
   * Clear all regions (for shutdown/reset)
   */
  clear() {
    this.regions.clear();
  }
}
