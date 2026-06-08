/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function appearance({ player }: { player: any }, message: any): Promise<void> {
  player.unlock?.();
  if (player.interfaceOpen) {
    player.interfaceOpen.appearance = false;
  }

  player.setAppearance?.(message);
  player.broadcastPlayerAppearance?.();

  if (player.localEntities?.characterUpdates?.playerAppearances) {
    player.localEntities.characterUpdates.playerAppearances.push(
      player.getAppearanceUpdate ? player.getAppearanceUpdate() : { index: player.index, appearance: message }
    );
  }

  if (player.cache) {
    delete player.cache.sendAppearance;
  }
}
