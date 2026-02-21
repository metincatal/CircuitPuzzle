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

export interface DuelStats {
    totalGames: number;
    p1Wins: number;
    p2Wins: number;
}

const STORAGE_KEYS = {
    LEVEL_RECORDS: '@circuit_level_records',
    GAME_STATS: '@circuit_game_stats',
    SPEED_HIGH_SCORE: '@circuit_speed_high_score',
    SPEED_BEST_WAVE: '@circuit_speed_best_wave',
    LAST_CLASSIC_LEVEL: '@circuit_last_classic_level',
    DUEL_STATS: '@circuit_duel_stats',
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

    // ============= SPEED MODE =============

    /**
     * Speed mode en iyi skoru kaydet
     * @returns Yeni rekor kırıldıysa true
     */
    static async saveSpeedHighScore(score: number): Promise<boolean> {
        await this.initialize();
        try {
            const current = await this.getSpeedHighScore();
            if (score > current) {
                await AsyncStorage.setItem(STORAGE_KEYS.SPEED_HIGH_SCORE, score.toString());
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error saving speed high score:', error);
            return false;
        }
    }

    /**
     * Speed mode en iyi skoru getir
     */
    static async getSpeedHighScore(): Promise<number> {
        try {
            const val = await AsyncStorage.getItem(STORAGE_KEYS.SPEED_HIGH_SCORE);
            return val ? parseInt(val, 10) : 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Speed mode en iyi dalga kaydı
     */
    static async saveSpeedBestWave(wave: number): Promise<boolean> {
        try {
            const current = await this.getSpeedBestWave();
            if (wave > current) {
                await AsyncStorage.setItem(STORAGE_KEYS.SPEED_BEST_WAVE, wave.toString());
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    static async getSpeedBestWave(): Promise<number> {
        try {
            const val = await AsyncStorage.getItem(STORAGE_KEYS.SPEED_BEST_WAVE);
            return val ? parseInt(val, 10) : 0;
        } catch (error) {
            return 0;
        }
    }

    // ============= CLASSIC MODE LAST LEVEL =============

    /**
     * Klasik modda son oynanan seviyeyi kaydet
     */
    static async saveLastClassicLevel(level: number): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.LAST_CLASSIC_LEVEL, level.toString());
        } catch (error) {
            console.error('Error saving last classic level:', error);
        }
    }

    /**
     * Klasik modda son oynanan seviyeyi getir
     */
    static async getLastClassicLevel(): Promise<number> {
        try {
            const val = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CLASSIC_LEVEL);
            return val ? parseInt(val, 10) : 1;
        } catch (error) {
            return 1;
        }
    }

    // ============= DUEL MODE =============

    /**
     * Duel sonucunu kaydet
     */
    static async saveDuelResult(winner: 1 | 2): Promise<void> {
        try {
            const stats = await this.getDuelStats();
            stats.totalGames += 1;
            if (winner === 1) {
                stats.p1Wins += 1;
            } else {
                stats.p2Wins += 1;
            }
            await AsyncStorage.setItem(STORAGE_KEYS.DUEL_STATS, JSON.stringify(stats));
        } catch (error) {
            console.error('Error saving duel result:', error);
        }
    }

    /**
     * Duel istatistiklerini getir
     */
    static async getDuelStats(): Promise<DuelStats> {
        try {
            const val = await AsyncStorage.getItem(STORAGE_KEYS.DUEL_STATS);
            if (val) return JSON.parse(val);
            return { totalGames: 0, p1Wins: 0, p2Wins: 0 };
        } catch (error) {
            return { totalGames: 0, p1Wins: 0, p2Wins: 0 };
        }
    }
}

export default StorageManager;
