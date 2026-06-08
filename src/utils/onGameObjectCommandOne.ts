/**
 * SPDX-License-Identifier: Apache-2.0
 */

const EXCLUDE_IDS = new Set([130, 198, 223, 227]);

export async function onGameObjectCommandOne(player: any, gameObject: any): Promise<boolean> {
  if (gameObject && EXCLUDE_IDS.has(gameObject.id)) {
    return false;
  }

  const commands = gameObject?.definition?.commands || [];
  const firstCommand = commands[0] || '';

  if (/go up|climb(-| )up/i.test(firstCommand)) {
    const world = player?.world;

    if (/ladder/i.test(gameObject?.definition?.name || '')) {
      player?.message?.('You climb up the ladder');
    }

    player?.climb?.(gameObject, true);
    if (world?.sleepTicks) {
      await world.sleepTicks(1);
    }
    return true;
  } else if (/go down|climb(-| )down/i.test(firstCommand)) {
    const world = player?.world;

    if (/ladder/i.test(gameObject?.definition?.name || '')) {
      player?.message?.('You climb down the ladder');
    }

    player?.climb?.(gameObject, false);
    if (world?.sleepTicks) {
      await world.sleepTicks(1);
    }
    return true;
  }

  return false;
}

// Support CommonJS export mapping if node/test environment requires it
declare var module: any;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { onGameObjectCommandOne };
}
