/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function logout(socket: any): Promise<void> {
  if (socket.player?.logout) {
    await socket.player.logout();
  }
  delete socket.player;
}

export async function closeConnection(): Promise<void> {
  // Gracefully handles sudden client socket disconnection events
}
