import { StateTransition } from "../types";

const DB_NAME = "MhdTelemetryArchiverDB";
const STORE_NAME = "telemetry_archive";
const DB_VERSION = 1;

export class TelemetryArchiverLimb {
  private static db: IDBDatabase | null = null;

  public static async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  public static async save(
    packetHistory: string[],
    transitionHistory: StateTransition[]
  ): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        store.put(packetHistory, "packetHistory");
        store.put(transitionHistory, "transitionHistory");

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(transaction.error);
      });
    } catch (e) {
      console.error("Failed to save to TelemetryArchiverLimb:", e);
    }
  }

  public static async load(): Promise<{
    packetHistory: string[];
    transitionHistory: StateTransition[];
  } | null> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);

        const packetsReq = store.get("packetHistory");
        const transitionsReq = store.get("transitionHistory");

        transaction.oncomplete = () => {
          resolve({
            packetHistory: packetsReq.result || [],
            transitionHistory: transitionsReq.result || [],
          });
        };

        transaction.onerror = (event) => reject(transaction.error);
      });
    } catch (e) {
      console.error("Failed to load from TelemetryArchiverLimb:", e);
      return null;
    }
  }

  public static async clear(): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        store.clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(transaction.error);
      });
    } catch (e) {
      console.error("Failed to clear TelemetryArchiverLimb:", e);
    }
  }
}
