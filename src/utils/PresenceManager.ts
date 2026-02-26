/**
 * PresenceManager - Gerçek zamanlı aktif oyuncu takibi
 * Firebase Realtime Database kullanır.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  onDisconnect,
} from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG, PRESENCE_ENABLED } from '../config/firebase';

const STALE_MS = 5 * 60 * 1000; // 5 dakika — bu süre sonrası stale sayılır
let cachedDeviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const stored = await AsyncStorage.getItem('@circuit_device_id');
  if (stored) { cachedDeviceId = stored; return stored; }
  const newId = Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  await AsyncStorage.setItem('@circuit_device_id', newId);
  cachedDeviceId = newId;
  return newId;
}

class PresenceManager {
  private static db: ReturnType<typeof getDatabase> | null = null;

  private static getDb() {
    if (this.db) return this.db;
    const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
    this.db = getDatabase(app);
    return this.db;
  }

  /** Uygulamayı açınca / ön plana gelince çağrıl */
  static async register(): Promise<void> {
    if (!PRESENCE_ENABLED) return;
    try {
      const db = this.getDb();
      const id = await getDeviceId();
      const presenceRef = ref(db, `presence/${id}`);
      await set(presenceRef, { t: Date.now() });
      // Bağlantı kopar kopamaz Firebase sunucusu bu kaydı siler
      onDisconnect(presenceRef).remove();
    } catch {}
  }

  /** Uygulama arka plana geçince / kapanınca çağrıl */
  static async unregister(): Promise<void> {
    if (!PRESENCE_ENABLED) return;
    try {
      const db = this.getDb();
      const id = await getDeviceId();
      await remove(ref(db, `presence/${id}`));
    } catch {}
  }

  /**
   * Aktif oyuncu sayısını gerçek zamanlı dinle.
   * @returns unsubscribe fonksiyonu
   */
  static subscribe(callback: (count: number) => void): () => void {
    if (!PRESENCE_ENABLED) { callback(0); return () => {}; }
    try {
      const db = this.getDb();
      const listRef = ref(db, 'presence');
      const unsub = onValue(listRef, (snapshot) => {
        if (!snapshot.exists()) { callback(0); return; }
        const now = Date.now();
        const entries = snapshot.val() as Record<string, { t: number }>;
        const active = Object.values(entries).filter(v => now - v.t < STALE_MS).length;
        callback(active);
      });
      return unsub;
    } catch {
      callback(0);
      return () => {};
    }
  }
}

export default PresenceManager;
