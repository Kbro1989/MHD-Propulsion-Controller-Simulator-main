/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function getNPC(player: any, index: number): Promise<any> {
  if (player.locked) {
    return undefined;
  }

  const { world } = player;
  if (!world?.npcs?.getByIndex) return undefined;
  const npc = world.npcs.getByIndex(index);

  if (!npc) {
    throw new RangeError(`invalid npc index ${index}`);
  }

  const inCloseRange = typeof npc.withinRange === 'function'
    ? npc.withinRange(player, 3)
    : player.withinRange?.(npc, 3);

  if (!inCloseRange) {
    const inChasingRange = typeof npc.withinRange === 'function'
      ? npc.withinRange(player, 8)
      : player.withinRange?.(npc, 8);

    if (inChasingRange) {
      if (typeof player.chase === 'function') {
        await player.chase(npc);
      }
    } else {
      return undefined;
    }

    const inRangeAgain = typeof npc.withinRange === 'function'
      ? npc.withinRange(player, 3)
      : player.withinRange?.(npc, 3);

    if (!inRangeAgain) {
      return undefined;
    }
  }

  npc.stepsLeft = 0;
  player.lock?.();

  return npc;
}

export async function npcTalk({ player }: { player: any }, { index }: { index: number }): Promise<void> {
  if (player.locked) {
    return;
  }

  player.walkAction = false;

  player.endWalkFunction = async () => {
    const { world } = player;
    const npc = await getNPC(player, index);

    if (!npc) {
      return;
    }

    if (npc.interlocutor) {
      player.unlock?.();
      player.message?.(`The ${npc.definition?.name || npc.name || 'NPC'} is busy at the moment`);
      return;
    }

    if (npc.opponent || npc.locked) {
      player.unlock?.();
      return;
    }

    npc.lock?.();

    let blocked = false;
    if (world?.callPlugin) {
      blocked = await world.callPlugin('onTalkToNPC', player, npc);
    }

    if (blocked) {
      return;
    }

    player.unlock?.();
    npc.unlock?.();

    const npcName = npc.definition?.name || npc.name || 'NPC';
    player.message?.(
      `The ${npcName} does not appear interested in talking`
    );
  };
}

export async function useWithNPC({ player }: { player: any }, { npcIndex, index }: { npcIndex: number; index: number }): Promise<void> {
  if (player.locked) {
    return;
  }

  player.walkAction = false;

  player.endWalkFunction = async () => {
    const item = player.inventory?.items?.[index];

    if (!item) {
      throw new RangeError(`invalid item index ${index}`);
    }

    const { world } = player;
    const npc = await getNPC(player, npcIndex);

    if (!npc) {
      player.unlock?.();
      return;
    }

    if (world && !world.members && item.definition?.members) {
      player.message?.('Nothing interesting happens');
      return;
    }

    npc.lock?.();

    let blocked = false;
    if (world?.callPlugin) {
      blocked = await world.callPlugin(
        'onUseWithNPC',
        player,
        npc,
        item
      );
    }

    player.unlock?.();
    npc.unlock?.();

    if (!blocked) {
      player.message?.('Nothing interesting happens');
    }
  };
}

export async function npcAttack({ player }: { player: any }, { index }: { index: number }): Promise<void> {
  if (player.opponent) {
    player.message?.('You are already busy fighting!');
    return;
  }

  if (player.locked) {
    return;
  }

  const { world } = player;
  if (!world?.npcs?.getByIndex) return;
  const npc = world.npcs.getByIndex(index);

  if (!npc) {
    throw new RangeError(`invalid npc index ${index}`);
  }

  if (player.rangedTimeout || player.magicTimeout) {
    return;
  }

  if (player.inventory?.getRangedWeapon?.()) {
    if (typeof player.shootRanged === 'function') {
      await player.shootRanged(npc);
    }
    return;
  }

  // Check if player has combat spell selected (autocast spell ID stored on player)
  if (player.autocastSpellId && player.hasSufficientRunes?.(player.autocastSpellId, false)) {
    if (typeof player.shootMagic === 'function') {
      await player.shootMagic(npc, player.autocastSpellId);
    }
    return;
  }

  player.toAttack = npc;

  player.endWalkFunction = async () => {
    const { world: secondaryWorld } = player;

    const activeNPC = await getNPC(player, index);

    if (!activeNPC) {
      player.toAttack = null;
      return;
    }

    if (activeNPC.definition && !activeNPC.definition.hostility) {
      player.unlock?.();
      throw new Error(`${player} trying to attack unattackable NPC`);
    }

    if (activeNPC.locked) {
      player.toAttack = null;
      player.unlock?.();
      return;
    }

    activeNPC.lock?.();

    let blocked = false;
    if (secondaryWorld?.callPlugin) {
      blocked = await secondaryWorld.callPlugin('onNPCAttack', player, activeNPC);
    }

    if (!blocked) {
      activeNPC.unlock?.();

      let success = false;
      if (typeof player.attack === 'function') {
        success = await player.attack(activeNPC);
      }
      if (!success) {
        player.message?.("I can't reach that!");
      }
    } else {
      player.unlock?.();
      activeNPC.unlock?.();
    }
  };
}

export async function npcCommand({ player }: { player: any }, { index, command }: { index: number; command?: string }): Promise<void> {
  if (player.locked) {
    return;
  }

  player.walkAction = false;

  player.endWalkFunction = async () => {
    const { world } = player;
    const npc = await getNPC(player, index);

    if (!npc) {
      return;
    }

    // Extract command from NPC definition if not provided in packet
    let activeCommand = command;
    if (!activeCommand && npc.definition && npc.definition.command) {
      activeCommand = npc.definition.command;
    }

    if (npc.interlocutor || npc.opponent || npc.locked) {
      player.unlock?.();
      return;
    }

    npc.lock?.();

    let blocked = false;
    if (world?.callPlugin) {
      blocked = await world.callPlugin(
        'onNPCCommand',
        player,
        npc,
        activeCommand
      );
    }

    if (blocked) {
      player.unlock?.();
      npc.unlock?.();
      return;
    }

    player.unlock?.();
    npc.unlock?.();

    player.message?.('Nothing interesting happens');
  };
}
