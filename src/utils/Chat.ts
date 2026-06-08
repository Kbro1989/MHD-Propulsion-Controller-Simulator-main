/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function chat({ player }: { player: any }, { message }: { message: string }): Promise<void> {
  const canChat = typeof player.canChat === 'function' ? player.canChat() : true;
  if (canChat) {
    player.lastChat = Date.now();
    player.broadcastChat?.(message);
  }
}
