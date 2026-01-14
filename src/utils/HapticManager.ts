/**
 * HapticManager - Dokunsal Geri Bildirim Yöneticisi
 * 
 * Zen ve rahatlatıcı havayı koruyarak hafif dokunsal geri bildirimler sağlar.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

class HapticManager {
    private static isEnabled = true;

    /**
     * Hafif tıklama hissi - Parça döndürme
     * Yumuşak ve minimal, zen havasını bozmaz
     */
    static async lightTap() {
        if (!this.isEnabled || Platform.OS === 'web') return;

        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
            // Haptics not available
        }
    }

    /**
     * Orta düzey tıklama - Enerji bağlantısı kurulduğunda
     */
    static async mediumTap() {
        if (!this.isEnabled || Platform.OS === 'web') return;

        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (e) {
            // Haptics not available
        }
    }

    /**
     * Kutlama titreşimi dizisi - Bölüm tamamlandığında
     * Üç aşamalı, yükselen bir kutlama hissi
     */
    static async celebrationBurst() {
        if (!this.isEnabled || Platform.OS === 'web') return;

        try {
            // İlk hafif darbe
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await this.delay(80);

            // İkinci orta darbe
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await this.delay(80);

            // Final güçlü darbe
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await this.delay(100);

            // Başarı bildirimi
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            // Haptics not available
        }
    }

    /**
     * Başarı bildirimi - Alternatif basit kutlama
     */
    static async successNotification() {
        if (!this.isEnabled || Platform.OS === 'web') return;

        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            // Haptics not available
        }
    }

    /**
     * Selection feedback - En hafif geri bildirim
     */
    static async selectionTap() {
        if (!this.isEnabled || Platform.OS === 'web') return;

        try {
            await Haptics.selectionAsync();
        } catch (e) {
            // Haptics not available
        }
    }

    /**
     * Haptic'leri aç/kapat
     */
    static setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
    }

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default HapticManager;
