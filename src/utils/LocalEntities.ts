/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class LocalEntities {
  public player: any;

  // side length of the square for entity viewports
  public viewports: Record<string, number> = {
    players: 16,
    npcs: 16,
    gameObjects: 48,
    wallObjects: 48,
    groundItems: 48
  };

  // all the entities player is currently aware of
  public known: Record<string, Set<any>> = {
    players: new Set(),
    npcs: new Set(),
    gameObjects: new Set(),
    wallObjects: new Set(),
    groundItems: new Set()
  };

  // entities player will know about next tick
  public added: Record<string, Set<any>> = {
    players: new Set(),
    npcs: new Set(),
    gameObjects: new Set(),
    wallObjects: new Set(),
    groundItems: new Set()
  };

  // entity instances player can't see anymore
  public removed: Record<string, Set<any>> = {
    players: new Set(),
    npcs: new Set(),
    gameObjects: new Set(),
    wallObjects: new Set(),
    groundItems: new Set()
  };

  // characters that have changed position
  public moved: Record<string, Set<any>> = {
    players: new Set(),
    npcs: new Set()
  };

  // used when character changes sprite angle but not direction
  public spriteChanged: Record<string, Set<any>> = {
    players: new Set(),
    npcs: new Set()
  };

  public characterUpdates: Record<string, any[]> = {
    playerAppearances: [],
    playerChat: [],
    playerBubbles: [],
    playerHits: [],
    npcChat: [],
    npcHits: [],
    projectiles: []
  };

  constructor(player: any) {
    this.player = player;
  }

  // used when world wants to add an entity that may or may not be in our viewport
  add(type: string, entity: any) {
    if (!this.viewports[type]) return;

    if (
      typeof entity.withinRange === "function"
        ? entity.withinRange(this.player, this.viewports[type])
        : this.player.withinRange?.(entity, this.viewports[type])
    ) {
      if (type === 'groundItems') {
        if (entity.owner && entity.owner !== this.player.id) {
          return;
        }

        // add gameobjects before the grounditem so they appear on top
        if (this.player.world?.gameObjects) {
          const gameObjectsAtPoint = this.player.world.gameObjects.getAtPoint(
            entity.x,
            entity.y
          );

          if (Array.isArray(gameObjectsAtPoint)) {
            const [gameObject] = gameObjectsAtPoint;
            if (gameObject && !this.known.gameObjects.has(gameObject)) {
              this.add('gameObjects', gameObject);
            }
          }
        }
      }

      this.added[type].add(entity);
    }
  }

  // used for teleporting or going up/down stairs
  clear() {
    for (const type of Object.keys(this.known)) {
      if (!this.known[type]) continue;
      for (const entity of this.known[type]) {
        this.removed[type].add(entity);
      }
    }
  }

  // mark out-of-range entities as removed and queue new ones
  updateNearby(type: string) {
    if (!this.known[type] || !this.removed[type]) return;

    for (const entity of this.known[type]) {
      const inRange = typeof entity.withinRange === "function"
        ? entity.withinRange(this.player, this.viewports[type])
        : this.player.withinRange?.(entity, this.viewports[type]);

      if (!inRange) {
        this.removed[type].add(entity);
      }
    }

    if (typeof this.player.getNearbyEntities === 'function') {
      const nearby = this.player.getNearbyEntities(type, this.viewports[type]) || [];
      for (const entity of nearby) {
        if (!this.known[type].has(entity)) {
          this.add(type, entity);

          if (type === 'players') {
            if (typeof entity.getAppearanceUpdate === 'function') {
              this.characterUpdates.playerAppearances.push(
                entity.getAppearanceUpdate()
              );
            } else {
              this.characterUpdates.playerAppearances.push({
                index: entity.index,
                id: entity.id,
                appearance: entity.appearance || {}
              });
            }
          }
        }
      }
    }
  }

  // move entities from added to known, and clear removed from known
  updateKnown(type: string) {
    if (!this.added[type] || !this.known[type] || !this.removed[type]) return;

    for (const entity of this.added[type]) {
      this.known[type].add(entity);
    }

    this.added[type].clear();

    for (const entity of this.removed[type]) {
      this.known[type].delete(entity);
    }

    this.removed[type].clear();
  }

  // format the message for sendRegionEntity
  formatAdded(type: string): any[] {
    const added: any[] = [];
    if (!this.added[type]) return added;

    for (const entity of this.added[type]) {
      const offsets = typeof this.player.getEntityOffsets === 'function'
        ? this.player.getEntityOffsets(entity)
        : { offsetX: entity.x - this.player.x, offsetY: entity.y - this.player.y };

      added.push({
        index: entity.index,
        x: offsets.offsetX,
        y: offsets.offsetY,
        sprite: entity.direction || 0,
        id: entity.id,
        direction: entity.direction || 0
      });
    }

    return added;
  }

  // format the message for sendRegionNPCs and sendRegionPlayers
  formatKnownCharacters(type: string): any[] {
    const knownList: any[] = [];
    if (!this.known[type]) return knownList;

    for (const entity of this.known[type]) {
      if (this.removed[type]?.has(entity)) {
        knownList.push({ removing: true });
      } else if (this.moved[type]?.has(entity)) {
        knownList.push({
          moved: true,
          sprite: entity.direction || 0
        });
      } else if (this.spriteChanged[type]?.has(entity)) {
        knownList.push({ spriteChanged: true, sprite: entity.direction || 0 });
      } else {
        knownList.push({});
      }
    }

    return knownList;
  }

  // send the positions of this player and the new/removed players
  sendRegionPlayers() {
    this.player.send?.({
      type: 'regionPlayers',
      player: {
        x: this.player.x,
        y: this.player.y,
        sprite: this.player.direction || 0
      },
      adding: this.formatAdded('players'),
      known: this.formatKnownCharacters('players')
    });

    this.updateKnown('players');

    this.moved.players?.clear();
    this.spriteChanged.players?.clear();
  }

  // send updates regarding the currently known player entities
  sendRegionPlayerUpdate() {
    const updates = this.characterUpdates;

    if (
      !updates.playerAppearances.length &&
      !updates.playerChat.length &&
      !updates.playerHits.length &&
      !updates.playerBubbles.length &&
      !updates.projectiles.length
    ) {
      return;
    }

    const { world } = this.player;

    this.player.send?.({
      type: 'regionPlayerUpdate',
      bubbles: updates.playerBubbles,
      chats: updates.playerChat,
      hits: updates.playerHits,
      projectiles: updates.projectiles,
      appearances: updates.playerAppearances
    });

    if (world && typeof world.nextTick === "function") {
      world.nextTick(() => {
        updates.playerBubbles.length = 0;
        updates.playerChat.length = 0;
        updates.playerAppearances.length = 0;
        updates.playerHits.length = 0;
        updates.projectiles.length = 0;
      });
    } else {
      updates.playerBubbles.length = 0;
      updates.playerChat.length = 0;
      updates.playerAppearances.length = 0;
      updates.playerHits.length = 0;
      updates.projectiles.length = 0;
    }
  }

  // send the position of new and removed NPCs
  sendRegionNPCs() {
    this.player.send?.({
      type: 'regionNPCs',
      adding: this.formatAdded('npcs'),
      known: this.formatKnownCharacters('npcs')
    });

    if (this.added.npcs) {
      for (const addedNPC of this.added.npcs) {
        if (addedNPC.knownPlayers instanceof Set) {
          addedNPC.knownPlayers.add(this.player);
        }
      }
    }

    if (this.removed.npcs) {
      for (const removedNPC of this.removed.npcs) {
        if (removedNPC.knownPlayers instanceof Set) {
          removedNPC.knownPlayers.delete(this.player);
        }
      }
    }

    this.updateKnown('npcs');
    this.moved.npcs?.clear();
    this.spriteChanged.npcs?.clear();
  }

  sendRegionNPCUpdates() {
    const updates = this.characterUpdates;

    if (!updates.npcChat.length && !updates.npcHits.length) {
      return;
    }

    const { world } = this.player;

    this.player.send?.({
      type: 'regionNPCUpdate',
      chats: updates.npcChat,
      hits: updates.npcHits
    });

    if (world && typeof world.nextTick === "function") {
      world.nextTick(() => {
        updates.npcChat.length = 0;
        updates.npcHits.length = 0;
      });
    } else {
      updates.npcChat.length = 0;
      updates.npcHits.length = 0;
    }
  }

  sendRegionObjects() {
    if (!this.added.gameObjects?.size && !this.removed.gameObjects?.size) {
      return;
    }

    const removing: any[] = [];

    if (this.removed.gameObjects) {
      for (const gameObject of this.removed.gameObjects) {
        const offsets = typeof this.player.getEntityOffsets === 'function'
          ? this.player.getEntityOffsets(gameObject)
          : { offsetX: gameObject.x - this.player.x, offsetY: gameObject.y - this.player.y };

        removing.push({ x: offsets.offsetX, y: offsets.offsetY });
      }
    }

    this.player.send?.({
      type: 'regionObjects',
      removing,
      adding: this.formatAdded('gameObjects')
    });

    this.updateKnown('gameObjects');
  }

  sendRegionWallObjects() {
    if (!this.added.wallObjects?.size && !this.removed.wallObjects?.size) {
      return;
    }

    this.player.send?.({
      type: 'regionWallObjects',
      removing: [],
      adding: this.formatAdded('wallObjects')
    });

    this.updateKnown('wallObjects');
  }

  sendRegionGroundItems() {
    if (!this.added.groundItems?.size && !this.removed.groundItems?.size) {
      return;
    }

    const removing: any[] = [];

    if (this.removed.groundItems) {
      for (const groundItem of this.removed.groundItems) {
        const offsets = typeof this.player.getEntityOffsets === 'function'
          ? this.player.getEntityOffsets(groundItem)
          : { offsetX: groundItem.x - this.player.x, offsetY: groundItem.y - this.player.y };

        removing.push({ id: groundItem.id, x: offsets.offsetX, y: offsets.offsetY });
      }
    }

    this.player.send?.({
      type: 'regionGroundItems',
      removing,
      adding: this.formatAdded('groundItems')
    });

    this.updateKnown('groundItems');
  }

  sendRegions() {
    this.sendRegionPlayers();
    this.sendRegionObjects();
    this.sendRegionWallObjects();
    this.sendRegionNPCs();
    this.sendRegionNPCUpdates();
    this.sendRegionGroundItems();
    this.sendRegionPlayerUpdate();
  }
}
