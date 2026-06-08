/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NPC } from "./NPC";
import { itemsConfig } from "./items";

// Authentic Runescape logic for level to experience conversion
export function levelToExperience(level: number): number {
  let points = 0;
  for (let m = 1; m < level; m++) {
    points += Math.floor(m + 300.0 * Math.pow(2.0, m / 7.0));
  }
  return Math.floor(points / 4);
}

// Lightweight authentic integration hooks for dependencies mapped into system scope
export function handleClanCommand(player: any, commandName: string, args: string[]) {
  player.message?.(`Clan command "${commandName}" executed with args: ${args.join(", ")}`);
}

export function handleClanChat(player: any, args: string[]) {
  player.message?.(`[Clan Chat] ${player.username || "Player"}: ${args.join(" ")}`);
}

export function handleBankPinCommand(player: any, commandName: string, args: string[]) {
  player.message?.(`Bank pin command "${commandName}" called with args: ${args.join(", ")}`);
}

export function handlePartyCommand(player: any, commandName: string, args: string[]) {
  player.message?.(`Party command "${commandName}" called with args: ${args.join(", ")}`);
}

export function handlePartyChat(player: any, args: string[]) {
  player.message?.(`[Party Chat] ${player.username || "Player"}: ${args.join(" ")}`);
}

export function handleBarCrawlCommand(player: any, args: string[]) {
  player.message?.(`Bar crawl command called: ${args.join(" ")}`);
}

export function handleMageArenaCommand(player: any, args: string[]) {
  player.message?.(`Mage arena command called: ${args.join(" ")}`);
}

export async function command({ player }: { player: any }, { command: cmd, args }: { command: string; args: string[] }): Promise<void> {
  const world = player.world;
  if (!world) return;

  // Handle clan/party/bank commands
  if (cmd === 'clan') {
    handleClanCommand(player, cmd, args);
    return;
  }
  if (cmd === 'c' || cmd === 'clanchat') {
    handleClanChat(player, args);
    return;
  }
  if (cmd === 'bankpin') {
    handleBankPinCommand(player, cmd, args);
    return;
  }
  if (cmd === 'party') {
    handlePartyCommand(player, cmd, args);
    return;
  }
  if (cmd === 'p' || cmd === 'partychat') {
    handlePartyChat(player, args);
    return;
  }
  if (cmd === 'barcrawl') {
    handleBarCrawlCommand(player, args);
    return;
  }
  if (cmd === 'magearena') {
    handleMageArenaCommand(player, args);
    return;
  }

  switch (cmd) {
    case 'setqp':
      if (!args[0] || Number.isNaN(+args[0])) {
        player.message?.('invalid argument');
        break;
      }
      player.questPoints = +args[0];
      break;

    case 'kick': {
      if (!args[0]) {
        player.message?.('invalid player');
        break;
      }

      const playerKicked = world.getPlayerByUsername ? world.getPlayerByUsername(args[0]) : null;

      if (!playerKicked) {
        player.message?.('no such player: ' + args[0]);
        break;
      }

      await playerKicked.logout?.();
      player.message?.('kicked player: ' + args[0]);
      break;
    }

    case 'appearance':
      player.sendAppearance?.();
      break;

    case 'step': {
      const deltaX = +args[0] || 0;
      const deltaY = +args[1] || 0;

      const walkable = player.canWalk ? player.canWalk(deltaX, deltaY) : true;
      player.message?.(walkable.toString());
      player.walkTo?.(deltaX, deltaY);
      break;
    }

    case 'npc': {
      const npcId = +args[0] || 1;
      const npc = new NPC(world, {
        id: npcId,
        x: player.x,
        y: player.y,
        minX: player.x - 4,
        maxX: player.x + 4,
        minY: player.y - 4,
        maxY: player.y + 4
      });
      
      // Override respawning properties so it's temporary
      delete (npc as any).respawn;

      world.addEntity?.('npcs', npc);
      break;
    }

    case 'face': {
      const targetX = +args[0] || 0;
      const targetY = +args[1] || 0;
      player.faceDirection?.(targetX, targetY);
      break;
    }

    case 'item': {
      const itemId = +args[0] || 10;
      const amount = +args[1] || 1;
      player.inventory?.add?.(itemId, amount);
      break;
    }

    case 'sound':
      player.sendSound?.(args[0]);
      break;

    case 'bubble':
      player.sendBubble?.(+args[0] || 1);
      break;

    case 'addexp': {
      const skillName = args[0];
      const xpVal = (+args[1] || 0) * 4;
      player.addExperience?.(skillName, xpVal, false);
      break;
    }

    case 'clearentities':
      player.localEntities?.clear?.();
      break;

    case 'coords':
      player.message?.(`${player.x}, ${player.y}, facing=${player.direction}`);
      break;

    case 'teleport': {
      if (!args[0]) {
        player.message?.('invalid teleport coords');
        break;
      }
      if (Number.isNaN(+args[0])) {
        // Mock region spawn positions
        const regions: Record<string, { spawnX: number; spawnY: number }> = {
          varrock: { spawnX: 120, spawnY: 504 },
          falador: { spawnX: 312, spawnY: 552 },
          lumbridge: { spawnX: 120, spawnY: 648 }
        };
        const rName = args[0].toLowerCase();
        const spawnRegion = regions[rName];

        if (spawnRegion && spawnRegion.spawnX && spawnRegion.spawnY) {
          player.teleport?.(spawnRegion.spawnX, spawnRegion.spawnY, true);
        }
        break;
      }

      const tx = +args[0];
      const ty = +args[1] || 0;
      player.teleport?.(tx, ty, true);
      break;
    }

    case 'ask': {
      if (player.ask) {
        const choice = await player.ask(
          ['hey?', 'sup?', 'more', 'test', 'again'],
          true
        );
        player.message?.(`you chose ${choice}`);
      }
      break;
    }

    case 'say':
      if (player.say) {
        await player.say(...args);
      }
      break;

    case 'dmg':
      player.damage?.(+args[0] || 1);
      break;

    case 'shop':
      player.openShop?.(args[0]);
      break;

    case 'give': {
      const other = world.getPlayerByUsername ? world.getPlayerByUsername(args[0]) : null;

      if (other) {
        other.inventory?.add?.(+args[1], +args[2] || 1);
        other.message?.(`${player.username} gave you an item`);
        player.message?.(`gave ${args[0]} item ${args[1]}`);
      } else {
        player.message?.(`unable to find player ${args[0]}`);
      }
      break;
    }

    case 'bank':
      player.bank?.open?.();
      break;

    case 'fatigue':
      player.fatigue = 75000;
      player.sendFatigue?.();
      break;

    case 'chaseobj': {
      const targetObj = world.gameObjects?.getByID ? world.gameObjects.getByID(+args[0]) : null;
      if (targetObj) {
        await player.chase?.(targetObj, false);
      }
      break;
    }

    case 'gotoentity': {
      const entities = world[args[0]];
      const entity = entities?.getByID ? entities.getByID(+args[1]) : null;

      if (entity) {
        player.teleport?.(entity.x, entity.y, true);
      }
      break;
    }

    case 'setquest': {
      let questID = -1;
      const quests = ['Cook\'s Assistant', 'Demon Slayer', 'Sheep Shearer', 'The Restless Ghost'];

      if (Number.isNaN(+args[0])) {
        questID = quests
          .map((name) => name.toLowerCase())
          .indexOf(args[0].toLowerCase());
      } else {
        questID = +args[0];
      }

      if (questID > -1 && player.questStages) {
        player.questStages[quests[questID]] = +args[1] || 0;
      }
      break;
    }

    case 'setcache':
      if (player.cache) {
        player.cache[args[0]] = JSON.parse(args[1] || "{}");
      }
      break;

    case 'droprandom': {
      const count = +args[0] || 1;
      for (let i = 0; i < count; i += 1) {
        const randomID = Math.floor(Math.random() * 1290);
        const itemDef = itemsConfig[randomID];

        if (itemDef?.members) {
          continue;
        }

        if (itemDef?.stackable) {
          world.addPlayerDrop?.(player, {
            id: randomID,
            amount: Math.floor(Math.random() * 10000)
          });
        } else {
          world.addPlayerDrop?.(player, { id: randomID });
        }
      }
      break;
    }

    case 'goto': {
      const otherPlayer = world.getPlayerByUsername ? world.getPlayerByUsername(args[0]) : null;
      if (otherPlayer) {
        player.teleport?.(otherPlayer.x, otherPlayer.y);
      }
      break;
    }

    case 'clearinventory': {
      if (player.inventory) {
        player.inventory.items = [];
        player.inventory.sendAll?.();
      }
      break;
    }

    case 'npcchase': {
      const npc = Array.from(player.localEntities?.known?.npcs || []).find(
        (n: any) => n.id === (+args[0] || 1)
      ) as any;

      if (npc && typeof npc.attack === "function") {
        await npc.attack(player);
      }
      break;
    }

    case 'npccoords': {
      const itemsAtPoint = world.npcs?.getAtPoint ? world.npcs.getAtPoint(+args[0], +args[1]) : [];
      player.message?.(itemsAtPoint.length.toString());
      break;
    }

    case 'finditem': {
      if (!args.length) {
        player.message?.('Usage: ::finditem <name>');
        break;
      }
      const query = args.join(' ').toLowerCase();
      const matches: any[] = [];
      Object.keys(itemsConfig).forEach((idStr) => {
        const item = itemsConfig[+idStr];
        if (item.name.toLowerCase().includes(query)) {
          matches.push({ id: item.id, name: item.name });
        }
      });
      if (matches.length === 0) {
        player.message?.(`No items found matching "${query}"`);
      } else {
        player.message?.(`Found ${matches.length} items:`);
        matches.slice(0, 10).forEach(m => player.message?.(`ID ${m.id}: ${m.name}`));
        if (matches.length > 10) player.message?.(`...and ${matches.length - 10} more`);
      }
      break;
    }

    case 'findnpc': {
      if (!args.length) {
        player.message?.('Usage: ::findnpc <name>');
        break;
      }
      const query = args.join(' ').toLowerCase();
      const matches: any[] = [];
      const npcConfigs: Record<number, { name: string }> = {
        1: { name: "Goblin" },
        2: { name: "Rat" },
        3: { name: "King" }
      }; // fallback matches
      Object.keys(npcConfigs).forEach((idStr) => {
        const npc = npcConfigs[+idStr];
        if (npc.name.toLowerCase().includes(query)) {
          matches.push({ id: +idStr, name: npc.name });
        }
      });
      if (matches.length === 0) {
        player.message?.(`No NPCs found matching "${query}"`);
      } else {
        player.message?.(`Found ${matches.length} NPCs:`);
        matches.slice(0, 10).forEach(m => player.message?.(`ID ${m.id}: ${m.name}`));
        if (matches.length > 10) player.message?.(`...and ${matches.length - 10} more`);
      }
      break;
    }

    case 'online': {
      const playerCount = world.players?.size ?? 1;
      player.message?.(`Players online: ${playerCount}`);
      break;
    }

    case 'summon': {
      if (!args[0]) {
        player.message?.('Usage: ::summon <username>');
        break;
      }
      const targetPlayer = world.getPlayerByUsername ? world.getPlayerByUsername(args[0]) : null;
      if (targetPlayer) {
        targetPlayer.teleport?.(player.x, player.y, true);
        player.message?.(`Summoned ${args[0]} to your location`);
        targetPlayer.message?.(`You have been summoned by ${player.username}`);
      } else {
        player.message?.(`Player not found: ${args[0]}`);
      }
      break;
    }

    case 'set': {
      if (!args[0] || !args[1]) {
        player.message?.('Usage: ::set <skill> <level>');
        break;
      }
      const skillNames = ['attack', 'defense', 'strength', 'hits', 'ranged',
        'prayer', 'magic', 'cooking', 'woodcutting', 'fletching',
        'fishing', 'firemaking', 'crafting', 'smithing', 'mining',
        'herblaw', 'agility', 'thieving'];
      const skillIndex = skillNames.indexOf(args[0].toLowerCase());
      if (skillIndex === -1) {
        player.message?.(`Unknown skill: ${args[0]}`);
        break;
      }
      const level = Math.min(99, Math.max(1, +args[1]));
      if (player.skills) {
        const skillName = Object.keys(player.skills)[skillIndex];
        if (skillName && player.skills[skillName]) {
          player.skills[skillName].current = level;
          player.skills[skillName].base = level;
          player.skills[skillName].experience = levelToExperience(level);
          player.sendStats?.();
          player.message?.(`Set ${args[0]} to level ${level}`);
        }
      }
      break;
    }

    case 'commands':
    case 'help': {
      try {
        if (!player.ask) break;
        const mainChoice = await player.ask([
          'Search Items >>',
          'Spawn Items >>',
          'Teleport >>',
          '::coords - Show location',
          'Admin Tools >>',
          '::set <skill> <lvl>',
          '::heal - Restore HP',
          '::save - Save char',
          '[Close]'
        ]);

        if (mainChoice === 0) {
          if (!player.prompt) break;
          const searchName = await player.prompt('Enter item name to search:');
          if (searchName) {
            const matches = Object.keys(itemsConfig).map((idStr) => {
              const item = itemsConfig[+idStr];
              const score = item.name.toLowerCase().includes(searchName.toLowerCase()) ? (item.name.toLowerCase().startsWith(searchName.toLowerCase()) ? 2 : 1) : 0;
              return { name: item.name, id: item.id, score };
            }).filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);

            if (matches.length > 0) {
              const itemNames = matches.map(m => m.name);
              itemNames.push('[Back]');
              const itemChoice = await player.ask(itemNames);
              if (itemChoice < matches.length) {
                const item = matches[itemChoice];
                const quantity = await player.prompt('Enter quantity:');
                const qty = parseInt(quantity) || 1;
                const destChoice = await player.ask(['Inventory', 'Bank', 'Ground', '[Back]']);

                if (destChoice === 0) {
                  player.inventory?.add?.(item.id, qty);
                  player.message?.(`Added ${qty}x ${item.name} to inventory.`);
                } else if (destChoice === 1) {
                  player.bank?.add?.(item.id, qty);
                  player.message?.(`Added ${qty}x ${item.name} to bank.`);
                } else if (destChoice === 2) {
                  world.addPlayerDrop?.(player, { id: item.id, amount: qty });
                  player.message?.(`Dropped ${qty}x ${item.name} on ground.`);
                }
              }
            } else {
              player.message?.('No items found.');
            }
          }
        } else if (mainChoice === 1) {
          const catChoice = await player.ask([
            'Consumables >>',
            'Armour >>',
            'Weapons >>',
            'Rares >>',
            'Resources >>',
            '[Back]'
          ]);

          let itemsToShow: Array<{ id: number; name: string; amount?: number }> = [];

          if (catChoice === 0) {
            const consumeChoice = await player.ask(['Food >>', 'Potions >>', 'Drinks >>', '[Back]']);
            if (consumeChoice === 0) {
              itemsToShow = [
                { id: 373, name: 'Lobster' }, { id: 370, name: 'Swordfish' },
                { id: 546, name: 'Shark' }, { id: 326, name: 'Meat Pizza' },
                { id: 330, name: 'Cake' }, { id: 346, name: 'Stew' }
              ];
            } else if (consumeChoice === 1) {
              itemsToShow = [
                { id: 221, name: 'Str Pot (4)' }, { id: 474, name: 'Atk Pot (3)' },
                { id: 480, name: 'Def Pot (3)' }, { id: 486, name: 'Super Atk (3)' },
                { id: 483, name: 'Prayer Pot (3)' }
              ];
            } else if (consumeChoice === 2) {
              itemsToShow = [
                { id: 142, name: 'Beer' }, { id: 193, name: 'Wine' },
                { id: 830, name: 'Grog' }, { id: 739, name: 'Dragon Bitter' }
              ];
            }
          } else if (catChoice === 1) {
            const armorChoice = await player.ask(['Helmets >>', 'Bodies >>', 'Legs >>', 'Shields >>', '[Back]']);
            if (armorChoice === 0) {
              itemsToShow = [
                { id: 104, name: 'Medium Bronze Helmet' }, { id: 105, name: 'Medium Steel Helmet' },
                { id: 107, name: 'Medium Adamantite Helmet' }, { id: 399, name: 'Medium Rune Helmet' },
                { id: 795, name: 'Dragon medium Helmet' }
              ];
            } else if (armorChoice === 1) {
              itemsToShow = [
                { id: 117, name: 'Bronze Plate Mail Body' }, { id: 118, name: 'Steel Plate Mail Body' },
                { id: 120, name: 'Adamantite Plate Mail Body' }, { id: 401, name: 'Rune Plate Mail Body' }
              ];
            } else if (armorChoice === 2) {
              itemsToShow = [
                { id: 206, name: 'Bronze Plate Legs' }, { id: 121, name: 'Steel Plate Legs' },
                { id: 125, name: 'Adamantite Plate Legs' }, { id: 402, name: 'Rune Plate Legs' }
              ];
            } else if (armorChoice === 3) {
              itemsToShow = [
                { id: 4, name: 'Wooden Shield' }, { id: 48, name: 'Steel Kite Shield' },
                { id: 56, name: 'Adamantite Kite Shield' }, { id: 403, name: 'Rune Kite Shield' },
                { id: 1276, name: 'Dragon Sq Shield' }
              ];
            }
          } else if (catChoice === 2) {
            const weaponChoice = await player.ask(['Swords >>', '2H Swords >>', 'Battleaxes >>', 'Bows >>', '[Back]']);
            if (weaponChoice === 0) {
              itemsToShow = [
                { id: 70, name: 'Bronze Sword' }, { id: 60, name: 'Steel Sword' },
                { id: 68, name: 'Addy Sword' }, { id: 396, name: 'Rune Sword' },
                { id: 593, name: 'Dragon Sword' }
              ];
            } else if (weaponChoice === 1) {
              itemsToShow = [
                { id: 76, name: 'Bronze 2H' }, { id: 77, name: 'Steel 2H' },
                { id: 79, name: 'Addy 2H' }, { id: 398, name: 'Rune 2H' }
              ];
            } else if (weaponChoice === 2) {
              itemsToShow = [
                { id: 12, name: 'Bronze Baxe' }, { id: 89, name: 'Steel Baxe' },
                { id: 97, name: 'Addy Baxe' }, { id: 405, name: 'Rune Baxe' },
                { id: 594, name: 'Dragon Baxe' }
              ];
            } else if (weaponChoice === 3) {
              itemsToShow = [
                { id: 188, name: 'Shortbow' }, { id: 189, name: 'Longbow' },
                { id: 654, name: 'Yew Short' }, { id: 655, name: 'Yew Long' },
                { id: 656, name: 'Magic Short' }, { id: 657, name: 'Magic Long' }
              ];
            }
          } else if (catChoice === 3) {
            const rareChoice = await player.ask(['Partyhats >>', 'H\'ween Masks >>', 'Other Rares >>', '[Back]']);
            if (rareChoice === 0) {
              itemsToShow = [
                { id: 576, name: 'Red Phat' }, { id: 577, name: 'Yellow Phat' },
                { id: 578, name: 'Blue Phat' }, { id: 579, name: 'Green Phat' },
                { id: 580, name: 'Purple Phat' }, { id: 581, name: 'White Phat' }
              ];
            } else if (rareChoice === 1) {
              itemsToShow = [
                { id: 831, name: 'Red Mask' }, { id: 832, name: 'Blue Mask' },
                { id: 828, name: 'Green Mask' }
              ];
            } else if (rareChoice === 2) {
              itemsToShow = [
                { id: 575, name: 'Xmas Cracker' }, { id: 422, name: 'Disk of Return' },
                { id: 1289, name: 'Scythe' }, { id: 971, name: 'Bunny Ears' },
                { id: 677, name: 'Easter Egg' }, { id: 1315, name: 'Santa Hat' }
              ];
            }
          } else if (catChoice === 4) {
            const resChoice = await player.ask(['Ores & Bars >>', 'Logs >>', 'Runes >>', 'Coins >>', '[Back]']);
            if (resChoice === 0) {
              itemsToShow = [
                { id: 150, name: 'Copper Ore' }, { id: 153, name: 'Coal' },
                { id: 409, name: 'Runite Ore' }, { id: 408, name: 'Runite Bar' }
              ];
            } else if (resChoice === 1) {
              itemsToShow = [
                { id: 14, name: 'Logs' }, { id: 633, name: 'Willow' },
                { id: 635, name: 'Yew Logs' }, { id: 636, name: 'Magic Logs' }
              ];
            } else if (resChoice === 2) {
              itemsToShow = [
                { id: 31, name: 'Air (1000)', amount: 1000 },
                { id: 38, name: 'Chaos (500)', amount: 500 },
                { id: 42, name: 'Death (500)', amount: 500 },
                { id: 825, name: 'Blood (500)', amount: 500 }
              ];
            } else if (resChoice === 3) {
              const coinChoice = await player.ask(['1,000', '10,000', '100,000', '1,000,000', '[Back]']);
              const amounts = [1000, 10000, 100000, 1000000];
              if (coinChoice < 4) {
                player.inventory?.add?.(10, amounts[coinChoice]);
                player.message?.(`Added ${amounts[coinChoice].toLocaleString()} coins`);
              }
            }
          }

          if (itemsToShow.length > 0) {
            const itemNames = itemsToShow.map(i => i.name);
            itemNames.push('[Back]');
            const itemChoice = await player.ask(itemNames);
            if (itemChoice < itemsToShow.length) {
              const item = itemsToShow[itemChoice];
              player.inventory?.add?.(item.id, item.amount || 1);
              player.message?.(`Added ${item.amount || 1}x ${item.name}`);
            }
          }
        } else if (mainChoice === 2) {
          const teleportChoice = await player.ask(['Towns >>', 'Wilderness >>', 'Points of Interest >>', '[Back]']);
          if (teleportChoice === 0) { // Towns
            const townChoice = await player.ask([
              'Varrock', 'Falador', 'Lumbridge', 'Edgeville',
              'Draynor', 'Al-Kharid', 'Port Sarim', 'Ardougne', '[Back]'
            ]);
            const towns = [
              { x: 120, y: 504 }, { x: 312, y: 552 }, { x: 120, y: 648 }, { x: 216, y: 451 },
              { x: 214, y: 632 }, { x: 72, y: 696 }, { x: 269, y: 648 }, { x: 588, y: 521 }
            ];
            if (townChoice < towns.length) {
              player.teleport?.(towns[townChoice].x, towns[townChoice].y, true);
            }
          } else if (teleportChoice === 1) { // Wilderness
            const wildChoice = await player.ask(['Edgeville (PvP)', 'Castle (Lvl 14)', 'Mage Arena (Lvl 50)', '[Back]']);
            if (wildChoice === 0) player.teleport?.(215, 436, true);
            if (wildChoice === 1) player.teleport?.(268, 342, true);
            if (wildChoice === 2) player.teleport?.(446, 3373, true); // Inside Arena
          } else if (teleportChoice === 2) { // POI
            const poiChoice = await player.ask(['Karamja', 'Draynor Manor', 'Guilds >>', 'Tutorial Island', '[Back]']);
            if (poiChoice === 0) player.teleport?.(324, 713, true);
            if (poiChoice === 1) player.teleport?.(210, 558, true);
            if (poiChoice === 3) player.teleport?.(216, 744, true);
          }
        } else if (mainChoice === 3) {
          player.message?.(`Location: ${player.x}, ${player.y}`);
        } else if (mainChoice === 4) { // Admin Tools
          const adminChoice = await player.ask(['Teleport to NPC >>', 'Player Tools >>', 'Quest Tools >>', '[Back]']);
          if (adminChoice === 0) {
            player.message?.('Use ::npc <id> to spawn, or ::gotoentity npcs <index>');
          } else if (adminChoice === 1) {
            const pToolChoice = await player.ask(['Summon Player', 'Goto Player', 'Kill Player', 'Kick Player', '[Back]']);
            if (pToolChoice < 4) {
              player.message?.('Please use chat commands: ::summon/goto/kill/kick <username>');
            }
          } else if (adminChoice === 2) {
            const qChoice = await player.ask(['Set Quest Stage >>', 'Complete Quest (Recursive) >>', '[Back]']);
            if (qChoice === 0) {
              player.message?.('Use ::setquest <questName> <stage>');
            } else if (qChoice === 1) {
              const questNames = ['demon slayer', 'cooks assistant', 'sheep shearer', 'the restless ghost', 'Dragon Slayer'];
              const uniqueQuests = [...new Set(questNames)];
              const targetQIdx = await player.ask(uniqueQuests);
              const targetQuest = uniqueQuests[targetQIdx];

              if (targetQuest && targetQuest !== '[Back]') {
                if (player.questStages) {
                  player.questStages[targetQuest] = 100;
                  player.message?.(`Completed: ${targetQuest}`);
                }
              }
            }
          }
        } else if (mainChoice === 6) {
          if (player.skills?.hits) {
            player.skills.hits.current = player.skills.hits.base;
            player.sendStats?.();
            player.message?.('You have been healed');
          }
        } else if (mainChoice === 7) {
          await player.save?.();
          player.message?.('Player data saved');
        }
      } catch (e) {}
      break;
    }

    case 'gang': {
      if (player.cache?.phoenixGang) {
        player.message?.('You are a member of the Phoenix Gang');
      } else if (player.cache?.blackArmGang) {
        player.message?.('You are a member of the Black Arm Gang');
      } else {
        player.message?.('You are not in a gang yet');
      }
      break;
    }

    case 'heal': {
      if (player.skills?.hits) {
        player.skills.hits.current = player.skills.hits.base;
        player.sendStats?.();
        player.message?.('You have been healed');
      }
      break;
    }

    case 'kill': {
      if (!args[0]) {
        player.message?.('Usage: ::kill <username>');
        break;
      }
      const victim = world.getPlayerByUsername ? world.getPlayerByUsername(args[0]) : null;
      if (victim) {
        victim.damage?.(victim.skills?.hits?.current || 10);
        player.message?.(`Killed ${args[0]}`);
      } else {
        player.message?.(`Player not found: ${args[0]}`);
      }
      break;
    }

    case 'broadcast': {
      if (!args.length) {
        player.message?.('Usage: ::broadcast <message>');
        break;
      }
      const broadcastMsg = args.join(' ');
      const recipients = world.players?.getAll ? world.players.getAll() : [];
      for (const p of recipients) {
        p.message?.(`[BROADCAST] ${broadcastMsg}`);
      }
      break;
    }

    case 'save': {
      await player.save?.();
      player.message?.('Player data saved');
      break;
    }
  }
}
