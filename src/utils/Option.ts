/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function chooseOption({ player }: { player: any }, { option }: { option: number }): Promise<void> {
  if (player.answer) {
    player.answer(option);
  }
}
