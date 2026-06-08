/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function playerFollow({ player }: { player: any }, { index }: { index: number }): Promise<void> {
  const world = player.world;
  const otherPlayer = world?.players?.getByIndex ? world.players.getByIndex(index) : null;

  if (!otherPlayer) {
    throw new RangeError(`invalid player index ${index}`);
  }

  const knownPlayers = player.localEntities?.known?.players;
  if (!knownPlayers || !knownPlayers.has(otherPlayer)) {
    throw new RangeError(`player trying to follow unknown target player`);
  }

  player.following = otherPlayer;
  const username = typeof otherPlayer.getFormattedUsername === 'function' 
    ? otherPlayer.getFormattedUsername() 
    : (otherPlayer.username || `Player ${index}`);
    
  player.message?.(`Following ${username}`);
}
