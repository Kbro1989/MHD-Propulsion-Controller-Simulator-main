/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function bankOpen(player: any): boolean {
  if (!player.interfaceOpen?.bank) {
    player.bank?.close?.();
    return false;
  }
  return true;
}

export async function bankDeposit({ player }: { player: any }, { id, amount }: { id: number; amount: number }): Promise<void> {
  if (bankOpen(player)) {
    player.bank?.deposit?.(id, amount);
  }
}

export async function bankWithdraw({ player }: { player: any }, { id, amount }: { id: number; amount: number }): Promise<void> {
  if (bankOpen(player)) {
    player.bank?.withdraw?.(id, amount);
  }
}

export async function bankClose({ player }: { player: any }): Promise<void> {
  if (player.interfaceOpen?.bank) {
    player.bank?.close?.();
  }
}
