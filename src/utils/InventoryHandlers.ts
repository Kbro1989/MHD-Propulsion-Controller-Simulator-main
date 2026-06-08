/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function getGroundItem(player: any, id: number, x: number, y: number): any {
  const world = player.world;
  if (!world?.groundItems?.getAtPoint) return undefined;

  const groundItems = world.groundItems.getAtPoint(x, y);

  for (const groundItem of groundItems) {
    const inRange = typeof groundItem.withinRange === 'function'
      ? groundItem.withinRange(player, 2)
      : player.withinRange?.(groundItem, 2);

    if (!inRange) {
      player.message?.("I can't reach that!");
      return undefined;
    }

    if (
      groundItem.id === id &&
      (!groundItem.owner || groundItem.owner === player.id)
    ) {
      return groundItem;
    }
  }
  return undefined;
}

export async function groundItemTake({ player }: { player: any }, { x, y, id }: { x: number; y: number; id: number }): Promise<void> {
  if (player.locked) {
    return;
  }

  player.endWalkFunction = async () => {
    if (player.locked) {
      return;
    }

    const world = player.world;
    const groundItem = getGroundItem(player, id, x, y);

    if (!groundItem) {
      return;
    }

    const isFull = typeof player.inventory?.isFull === 'function' ? player.inventory.isFull() : false;
    const inventoryHas = typeof player.inventory?.has === 'function' ? player.inventory.has(groundItem.id) : false;

    if (
      isFull &&
      (!groundItem.definition?.stackable || !inventoryHas)
    ) {
      return;
    }

    player.lock?.();
    player.faceEntity?.(groundItem);

    let blocked = false;
    if (world?.callPlugin) {
      blocked = await world.callPlugin(
        'onGroundItemTake',
        player,
        groundItem
      );
    }

    player.unlock?.();

    if (blocked) {
      return;
    }

    world?.removeEntity?.('groundItems', groundItem);
    player.inventory?.add?.(groundItem.id, groundItem.amount ?? 1);
    player.sendSound?.('takeobject');
  };
}

export async function inventoryDrop({ player }: { player: any }, { index }: { index: number }): Promise<void> {
  player.endWalkFunction = async () => {
    const world = player.world;
    const item = player.inventory?.items?.[index];
    if (!item) return;

    let blocked = false;
    if (world?.callPlugin) {
      blocked = await world.callPlugin(
        'onDropItem',
        player,
        item
      );
    }

    if (!blocked) {
      player.inventory?.drop?.(index);
    }
  };
}

export async function inventoryWear({ player }: { player: any }, { index }: { index: number }): Promise<void> {
  player.sendSound?.('click');
  player.inventory?.equip?.(index);
}

export async function inventoryUnequip({ player }: { player: any }, { index }: { index: number }): Promise<void> {
  player.sendSound?.('click');
  player.inventory?.unequip?.(index);
}

export async function useWithGroundItem(
  { player }: { player: any },
  { x, y, groundItemID, index }: { x: number; y: number; groundItemID: number; index: number }
): Promise<void> {
  if (player.locked) {
    return;
  }

  player.endWalkFunction = async () => {
    if (player.locked) {
      return;
    }

    const item = player.inventory?.items?.[index];

    if (!item) {
      throw new RangeError(
        `${player} used invalid item index on ground item`
      );
    }

    const world = player.world;

    if (item.definition?.members && world && !world.members) {
      return;
    }

    const groundItem = getGroundItem(player, groundItemID, x, y);

    if (!groundItem) {
      return;
    }

    player.lock?.();
    player.faceEntity?.(groundItem);

    let blocked = false;
    if (world?.callPlugin) {
      blocked = await world.callPlugin(
        'onUseWithGroundItem',
        player,
        groundItem,
        item
      );
    }

    player.unlock?.();

    if (blocked) {
      return;
    }

    player.message?.('Nothing interesting happens');
  };
}

export async function inventoryCommand({ player }: { player: any }, { index }: { index: number }): Promise<void> {
  if (player.locked) {
    return;
  }

  const item = player.inventory?.items?.[index];

  if (!item) {
    throw new RangeError(`${player} used invalid item index for command`);
  }

  const world = player.world;

  // prevent burying dragon bones on f2p worlds etc.
  if (item.definition?.members && world && !world.members) {
    return;
  }

  player.lock?.();
  if (world?.callPlugin) {
    await world.callPlugin('onInventoryCommand', player, item);
  }
  player.unlock?.();
}

export async function useWithInventoryItem(
  { player }: { player: any },
  { index, withIndex }: { index: number; withIndex: number }
): Promise<void> {
  if (player.locked) {
    return;
  }

  const item = player.inventory?.items?.[index];

  if (!item) {
    throw new RangeError(`${player} used invalid item index for useWith`);
  }

  const target = player.inventory?.items?.[withIndex];

  if (!target) {
    throw new RangeError(`${player} used invalid target index for useWith`);
  }

  const world = player.world;

  if (
    world && !world.members &&
    (item.definition?.members || target.definition?.members)
  ) {
    player.message?.('Nothing interesting happens');
    return;
  }

  player.lock?.();

  let blocked = false;
  if (world?.callPlugin) {
    blocked = await world.callPlugin(
      'onUseWithInventory',
      player,
      item,
      target
    );
  }

  if (!blocked) {
    player.message?.('Nothing interesting happens');
  }

  player.unlock?.();
}
