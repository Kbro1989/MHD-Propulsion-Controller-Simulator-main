/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as appearance from "./Appearance";
import * as bank from "./BankHandlers";
import * as chat from "./Chat";
import * as combatStyle from "./CombatStyle";
import * as command from "./Command";
import * as follow from "./Follow";
import * as gameObject from "./GameObjectHandlers";
import * as inventory from "./InventoryHandlers";
import * as knownPlayers from "./KnownPlayers";
import * as login from "./Login";
import * as logout from "./Logout";
import * as npc from "./NPCHandlers";
import * as option from "./Option";
import * as walk from "./Walk";

export const HandlersIndex: Record<string, any> = {
  "appearance": appearance,
  "bank": bank,
  "chat": chat,
  "combat-style": combatStyle,
  "command": command,
  "follow": follow,
  "game-object": gameObject,
  "inventory": inventory,
  "known-players": knownPlayers,
  "login": login,
  "logout": logout,
  "npc": npc,
  "option": option,
  "walk": walk
};

export default HandlersIndex;
