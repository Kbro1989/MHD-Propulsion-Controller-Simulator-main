/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Container, StackPolicy, IDComparator, definitionStackable } from "./Container";

export const TRADE_CAPACITY = 12;

export function processTradeRequest(playerA: any, playerB: any) {
  if (playerA.trade) {
    playerA.trade.requests.delete(playerB);
    playerA.trade.tradingWith = playerB;
  }
  if (playerA.interfaceOpen) {
    playerA.interfaceOpen.trade = true;
  }
  playerA.send?.({ type: 'tradeOpen', index: playerB.index });
}

export function processTradeClose(player: any) {
  if (player.interfaceOpen) {
    player.interfaceOpen.trade = false;
  }
  if (player.trade) {
    player.trade.tradingWith = null;
    player.trade.clear();
  }
  player.send?.({ type: 'tradeClose' });
}

export class Trade extends Container {
  public player: any;
  public requests: Set<any>;
  public tradingWith: any | null;

  constructor(player: any) {
    super(
      TRADE_CAPACITY,
      StackPolicy.USE_FUNCTION,
      IDComparator,
      definitionStackable
    );

    this.player = player;
    this.requests = new Set();
    this.tradingWith = null;
  }

  request(otherPlayer: any) {
    if (typeof otherPlayer.hasInterfaceOpen === 'function' && otherPlayer.hasInterfaceOpen()) {
      this.player.message?.('That player is busy at the moment');
      return;
    }

    if (this.requests.has(otherPlayer)) {
      processTradeRequest(this.player, otherPlayer);
      processTradeRequest(otherPlayer, this.player);
    } else {
      this.player.message?.('Sending trade request');
      otherPlayer.message?.(`${this.player.username || 'A player'} wishes to trade with you`);
      otherPlayer.trade?.requests.add(this.player);
      this.tradingWith = otherPlayer;
    }
  }

  accept() {
    // Handled by game loop states
  }

  decline() {
    const other = this.tradingWith;
    if (other) {
      processTradeClose(this.player);
      processTradeClose(other);
      other.message?.('Other player has declined trade');
    }
  }

  confirmAccept() {
    // Handled by game loop states
  }

  updateItems(items: any[]) {
    // clear all previous items
    super.clear();

    for (const item of items) {
      if (!this.player.inventory?.has?.(item.id || item)) {
        this.player.message?.('You dont have that item');
        break;
      }
      if (!super.add(item, item.amount || 1)) {
        this.player.message?.('Failed to add item to trade');
        break;
      }
    }

    console.log('[Trade Update]', super.toJSON());

    if (this.tradingWith) {
      this.tradingWith.send?.({
        type: 'tradeItems',
        items: super.toJSON()
      });
    }
  }
}
