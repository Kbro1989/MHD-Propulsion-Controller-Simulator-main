/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function combatStyle({ player }: { player: any }, { combatStyle: newStyle }: { combatStyle: number }): Promise<void> {
  player.combatStyle = newStyle;
}
