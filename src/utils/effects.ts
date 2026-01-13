import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';

/**
 * Ses ve titreşim efektleri yöneticisi
 */

// Ses önbelleği
let sounds: {
    click?: Sound;
    rotate?: Sound;
    success?: Sound;
    levelUp?: Sound;
} = {};

// Ses yükleme durumu
let soundsLoaded = false;

/**
 * Sesleri yükle (uygulama başlangıcında çağrılmalı)
 */
export const loadSounds = async (): Promise<void> => {
    if (soundsLoaded) return;

    try {
        // Audio modunu ayarla
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
        });

        soundsLoaded = true;
        console.log('Ses sistemi hazır');
    } catch (error) {
        console.warn('Ses yüklenemedi:', error);
    }
};

/**
 * Sesleri temizle (uygulama kapatılırken)
 */
export const unloadSounds = async (): Promise<void> => {
    try {
        if (sounds.click) await sounds.click.unloadAsync();
        if (sounds.rotate) await sounds.rotate.unloadAsync();
        if (sounds.success) await sounds.success.unloadAsync();
        if (sounds.levelUp) await sounds.levelUp.unloadAsync();
        sounds = {};
        soundsLoaded = false;
    } catch (error) {
        console.warn('Ses temizleme hatası:', error);
    }
};

/**
 * Hafif tıklama titreşimi
 */
export const lightHaptic = async (): Promise<void> => {
    try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
        // Haptics desteklenmiyor olabilir
    }
};

/**
 * Orta şiddette titreşim
 */
export const mediumHaptic = async (): Promise<void> => {
    try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
        // Haptics desteklenmiyor olabilir
    }
};

/**
 * Ağır titreşim (başarı için)
 */
export const heavyHaptic = async (): Promise<void> => {
    try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
        // Haptics desteklenmiyor olabilir
    }
};

/**
 * Başarı titreşim paterni
 */
export const successHapticPattern = async (): Promise<void> => {
    try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Ekstra kutlama titreşimleri
        setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 100);

        setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }, 200);

        setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 300);
    } catch (error) {
        // Haptics desteklenmiyor olabilir
    }
};

/**
 * Parça döndürme efekti
 */
export const rotateEffect = async (): Promise<void> => {
    await lightHaptic();
};

/**
 * Bağlantı kuruldu efekti
 */
export const connectionEffect = async (): Promise<void> => {
    await mediumHaptic();
};

/**
 * Puzzle çözüldü efekti
 */
export const solvedEffect = async (): Promise<void> => {
    await successHapticPattern();
};

/**
 * Yeni seviye efekti
 */
export const newLevelEffect = async (): Promise<void> => {
    await heavyHaptic();
};

/**
 * Zorluk değişikliği efekti
 */
export const difficultyChangeEffect = async (): Promise<void> => {
    await mediumHaptic();
};
