/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BrowserSocket simulation for virtual worker-to-server networks
 */

type Listener = (...args: any[]) => void;

export class CustomEventEmitter {
  private events: Record<string, Listener[]> = {};

  on(event: string, listener: Listener): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  once(event: string, listener: Listener): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  off(event: string, listener: Listener): this {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;
    this.events[event].forEach(l => {
      try {
        l(...args);
      } catch (e) {
        console.error("EventEmitter callback error:", e);
      }
    });
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}

export class BrowserSocket extends CustomEventEmitter {
  id: string;
  remoteAddress: string;

  constructor(id: string, ip: string = "127.0.0.1") {
    super();
    this.id = id;
    this.remoteAddress = ip;
  }

  write(data: any): void {
    if (typeof postMessage !== "undefined") {
      postMessage({
        id: this.id,
        type: "data",
        data
      }, "*");
    } else {
      console.log(`[BrowserSocket ${this.id}] TX Data:`, data);
    }
  }

  connect(): void {
    console.log(`[BrowserSocket ${this.id}] connect invoked`);
  }

  destroy(): void {
    console.log(`[BrowserSocket ${this.id}] destroy invoked`);
  }

  end(): void {
    console.log(`[BrowserSocket ${this.id}] end invoked`);
  }

  setKeepAlive(): void {
    console.log(`[BrowserSocket ${this.id}] setKeepAlive invoked`);
  }

  setTimeout(): void {
    console.log(`[BrowserSocket ${this.id}] setTimeout invoked`);
  }
}
