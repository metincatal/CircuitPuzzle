import { Platform } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';

const BGM_PLAYLIST = [
    require('../../assets/sounds/bgm/furkanms-ambient-1cinematic-relaxing-optimistic-inspirational-ambient-237949.mp3'),
    require('../../assets/sounds/bgm/furkanms-ambient-5cinematic-relaxing-optimistic-inspirational-ambient-238174.mp3'),
    require('../../assets/sounds/bgm/furkanms-ambient-8cinematic-relaxing-optimistic-inspirational-ambient-238171.mp3'),
    require('../../assets/sounds/bgm/furkanms-ambient-9cinematic-relaxing-optimistic-inspirational-ambient-238170.mp3'),
    require('../../assets/sounds/bgm/furkanms-ambient-11cinematic-relaxing-optimistic-inspirational-ambient-238169.mp3'),
    require('../../assets/sounds/bgm/furkanms-ambient-14cinematic-relaxing-optimistic-inspirational-ambient-238165.mp3'),
    require('../../assets/sounds/bgm/furkanms-energetic-6instrument-enthusiastic-background-243296.mp3'),
    require('../../assets/sounds/bgm/sigmaeffect-cinematic-ambient-atmosphere-463222.mp3'),
];

class SoundManager {
    static clickSound: Audio.Sound | null = null;
    static winSound: Audio.Sound | null = null;
    static bgmSound: Audio.Sound | null = null;
    static currentTrackIndex = 0;

    static async loadSounds() {
        if (Platform.OS === 'web') return;

        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
        });

        try {
            const { sound: click } = await Audio.Sound.createAsync(require('../../assets/sounds/click2.mp3'));
            this.clickSound = click;
            await this.clickSound.setVolumeAsync(0.3);

            const { sound: win } = await Audio.Sound.createAsync(require('../../assets/sounds/win2.mp3'));
            this.winSound = win;

            this.playNextBGM();
        } catch (error) {
            console.log("Ses yükleme hatası:", error);
        }
    }

    static async playNextBGM() {
        if (Platform.OS === 'web') return;
        try {
            if (this.bgmSound) {
                await this.bgmSound.unloadAsync();
                this.bgmSound = null;
            }

            const source = BGM_PLAYLIST[this.currentTrackIndex];
            const { sound } = await Audio.Sound.createAsync(source);
            this.bgmSound = sound;
            this.bgmSound.setOnPlaybackStatusUpdate(this.onBgmStatusUpdate);
            await this.bgmSound.setVolumeAsync(0.15);
            await this.bgmSound.playAsync();
            this.currentTrackIndex = (this.currentTrackIndex + 1) % BGM_PLAYLIST.length;
        } catch (e) {
            console.log("BGM Oynatma hatası:", e);
        }
    }

    static onBgmStatusUpdate = (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
            SoundManager.playNextBGM();
        }
    }

    static async playClick() {
        if (Platform.OS === 'web') return;
        try {
            if (this.clickSound) await this.clickSound.replayAsync();
        } catch (e) { }
    }

    static async playWin() {
        if (Platform.OS === 'web') return;
        try {
            if (this.winSound) await this.winSound.replayAsync();
        } catch (e) { }
    }
}

export default SoundManager;
