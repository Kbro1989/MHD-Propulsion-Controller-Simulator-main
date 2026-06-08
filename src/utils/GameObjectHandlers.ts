/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function getGameObject(player: any, x: number, y: number): any {
  const world = player.world;
  if (!world?.gameObjects?.getAtPoint) {
    return null;
  }
  const [gameObject] = world.gameObjects.getAtPoint(x, y);

  if (!gameObject) {
    throw new RangeError(`invalid gameObject at point ${x}, ${y}`);
  }

  const inRange = typeof gameObject.withinRange === 'function'
    ? gameObject.withinRange(player, 2)
    : player.withinRange?.(gameObject, 2);

  if (!inRange) {
    return undefined;
  }

  return gameObject;
}

export function gameObjectCommand(pluginHandler: string, socket: { player: any }, { x, y }: { x: number; y: number }): void {
  const { player } = socket;
  if (player.locked) {
    return;
  }

  player.endWalkFunction = async () => {
    if (player.locked) {
      return;
    }

    const gameObject = getGameObject(player, x, y);

    if (!gameObject || player.locked) {
      return;
    }

    const world = player.world;

    player.lock?.();

    if (world?.sleepTicks) {
      await world.sleepTicks(1);
    }

    if (player.opponent) {
      return;
    }

    if (world?.callPlugin) {
      await world.callPlugin(pluginHandler, player, gameObject);
    }

    player.unlock?.();
  };
}

export async function objectCommandOne(socket: { player: any }, message: { x: number; y: number }): Promise<void> {
  gameObjectCommand('onGameObjectCommandOne', socket, message);
}

export async function objectCommandTwo(socket: { player: any }, message: { x: number; y: number }): Promise<void> {
  gameObjectCommand('onGameObjectCommandTwo', socket, message);
}

export async function useWithObject({ player }: { player: any }, { x, y, index }: { x: number; y: number; index: number }): Promise<void> {
  if (player.locked) {
    return;
  }

  player.endWalkFunction = async () => {
    if (player.locked) {
      return;
    }

    const item = player.inventory?.items?.[index];

    if (!item) {
      throw new RangeError(`invalid inventory index ${index}`);
    }

    const gameObject = getGameObject(player, x, y);

    if (!gameObject) {
      return;
    }

    const world = player.world;

    if (world && !world.members && item.definition?.members) {
      player.message?.('Nothing interesting happens');
      return;
    }

    player.lock?.();
    if (world?.sleepTicks) {
      await world.sleepTicks(1);
    }

    let blocked = false;
    if (world?.callPlugin) {
      blocked = await world.callPlugin(
        'onUseWithGameObject',
        player,
        gameObject,
        item
      );
    }

    if (!blocked) {
      player.message?.('Nothing interesting happens');
    }

    player.unlock?.();
  };
}
