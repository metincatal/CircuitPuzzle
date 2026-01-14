/**
 * StorageManager - Oyun İlerlemesi ve Rekor Yönetimi
 * 
 * AsyncStorage kullanarak:
 * - Her seviyenin en iyi süresini (rekor)
 * - En iyi yıldız sayısını
 * - Toplam istatistikleri kaydeder
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Seviye kaydı tipi
export interface LevelRecord {
    levelId: string;
    bestTime: number; // saniye cinsinden
    bestStars: number; // 1-3 arası
    completedAt: string; // ISO tarih
}

// Oyun istatistikleri
export interface GameStats {
    totalLevelsCompleted: number;
    totalStarsEarned: number;
    totalTimePlayed: number; // saniye
    bestOverallTime: number; // en hızlı tamamlama
}

const STORAGE_KEYS = {
    LEVEL_RECORDS: '@circuit_level_records',
    GAME_STATS: '@circuit_game_stats',
};

class StorageManager {
    private static levelRecords: Map<string, LevelRecord> = new Map();
    private static gameStats: GameStats = {
        totalLevelsCompleted: 0,
        totalStarsEarned: 0,
        totalTimePlayed: 0,
        bestOverallTime: Infinity,
    };
    private static isInitialized = false;

    /**
     * Storage'ı başlat ve verilerı yükle
     */
    static async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Level kayıtlarını yükle
            const recordsJson = await AsyncStorage.getItem(STORAGE_KEYS.LEVEL_RECORDS);
            if (recordsJson) {
                const records: LevelRecord[] = JSON.parse(recordsJson);
                records.forEach(r => this.levelRecords.set(r.levelId, r));
            }

            // İstatistikleri yükle
            const statsJson = await AsyncStorage.getItem(STORAGE_KEYS.GAME_STATS);
            if (statsJson) {
                this.gameStats = JSON.parse(statsJson);
            }

            this.isInitialized = true;
        } catch (error) {
            console.error('StorageManager initialization error:', error);
        }
    }

    /**
     * Seviye tamamlandığında kaydet
     * @returns Yeni rekor kırıldıysa true
     */
    static async saveLevelCompletion(
        levelId: string,
        time: number,
        stars: number
    ): Promise<{ isNewRecord: boolean; previousBest: number | null }> {
        await this.initialize();

        const existing = this.levelRecords.get(levelId);
        const previousBest = existing?.bestTime ?? null;
        const isNewRecord = !existing || time < existing.bestTime;

        // Yeni veya daha iyi kayıt
        if (!existing || time < existing.bestTime || stars > existing.bestStars) {
            const newRecord: LevelRecord = {
                levelId,
                bestTime: existing ? Math.min(existing.bestTime, time) : time,
                bestStars: existing ? Math.max(existing.bestStars, stars) : stars,
                completedAt: new Date().toISOString(),
            };

            this.levelRecords.set(levelId, newRecord);
            await this.persistLevelRecords();
        }

        // İstatistikleri güncelle
        if (!existing) {
            this.gameStats.totalLevelsCompleted++;
        }
        this.gameStats.totalStarsEarned += stars;
        this.gameStats.totalTimePlayed += time;
        if (time < this.gameStats.bestOverallTime) {
            this.gameStats.bestOverallTime = time;
        }
        await this.persistGameStats();

        return { isNewRecord, previousBest };
    }

    /**
     * Belirli bir seviyenin rekorunu getir
     */
    static async getLevelRecord(levelId: string): Promise<LevelRecord | null> {
        await this.initialize();
        return this.levelRecords.get(levelId) ?? null;
    }

    /**
     * Tüm seviye rekorlarını getir
     */
    static async getAllLevelRecords(): Promise<LevelRecord[]> {
        await this.initialize();
        return Array.from(this.levelRecords.values());
    }

    /**
     * Oyun istatistiklerini getir
     */
    static async getGameStats(): Promise<GameStats> {
        await this.initialize();
        return { ...this.gameStats };
    }

    /**
     * Genel bir "en iyi süre" kaydı var mı?
     */
    static async hasBestTime(): Promise<boolean> {
        await this.initialize();
        return this.gameStats.bestOverallTime !== Infinity;
    }

    /**
     * Tüm verileri sıfırla (debug için)
     */
    static async resetAllData(): Promise<void> {
        this.levelRecords.clear();
        this.gameStats = {
            totalLevelsCompleted: 0,
            totalStarsEarned: 0,
            totalTimePlayed: 0,
            bestOverallTime: Infinity,
        };

        await AsyncStorage.multiRemove([
            STORAGE_KEYS.LEVEL_RECORDS,
            STORAGE_KEYS.GAME_STATS,
        ]);
    }

    // Private: Level kayıtlarını persist et
    private static async persistLevelRecords(): Promise<void> {
        try {
            const records = Array.from(this.levelRecords.values());
            await AsyncStorage.setItem(
                STORAGE_KEYS.LEVEL_RECORDS,
                JSON.stringify(records)
            );
        } catch (error) {
            console.error('Error persisting level records:', error);
        }
    }

    // Private: İstatistikleri persist et
    private static async persistGameStats(): Promise<void> {
        try {
            await AsyncStorage.setItem(
                STORAGE_KEYS.GAME_STATS,
                JSON.stringify(this.gameStats)
            );
        } catch (error) {
            console.error('Error persisting game stats:', error);
        }
    }
}

export default StorageManager;
