import { Platform, Image } from 'react-native';
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
    // Native
    static clickSound: Audio.Sound | null = null;
    static winSound: Audio.Sound | null = null;
    static bgmSound: Audio.Sound | null = null;
    static currentTrackIndex = 0;

    // Web
    static webClickAudio: HTMLAudioElement | null = null;
    static webWinAudio: HTMLAudioElement | null = null;
    static webBgmAudio: HTMLAudioElement | null = null;
    static webBgmStarted = false;

    static resolveWebUri(source: any): string {
        try {
            const resolved = Image.resolveAssetSource(source);
            if (resolved?.uri) return resolved.uri;
        } catch (e) { }
        if (typeof source === 'string') return source;
        return source?.uri || source?.default || String(source);
    }

    static async loadSounds() {
        if (Platform.OS === 'web') {
            this.loadWebSounds();
            return;
        }

        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
        });

        try {
            const { sound: click } = await Audio.Sound.createAsync(
                require('../../assets/sounds/click2.mp3')
            );
            this.clickSound = click;
            await this.clickSound.setVolumeAsync(0.3);

            const { sound: win } = await Audio.Sound.createAsync(
                require('../../assets/sounds/win2.mp3')
            );
            this.winSound = win;

            this.playNextBGM();
        } catch (error) {
            console.log("Ses yükleme hatası:", error);
        }
    }

    private static loadWebSounds() {
        try {
            const clickUri = this.resolveWebUri(require('../../assets/sounds/click2.mp3'));
            this.webClickAudio = new window.Audio(clickUri);
            this.webClickAudio.volume = 0.3;

            const winUri = this.resolveWebUri(require('../../assets/sounds/win2.mp3'));
            this.webWinAudio = new window.Audio(winUri);
            this.webWinAudio.volume = 1.0;
        } catch (e) {
            console.log('Web ses yükleme hatası:', e);
        }

        const startBGM = () => {
            if (!this.webBgmStarted) {
                this.webBgmStarted = true;
                this.playNextWebBGM();
            }
            document.removeEventListener('click', startBGM);
            document.removeEventListener('touchstart', startBGM);
            document.removeEventListener('pointerdown', startBGM);
        };
        document.addEventListener('click', startBGM);
        document.addEventListener('touchstart', startBGM);
        document.addEventListener('pointerdown', startBGM);
    }

    private static playNextWebBGM() {
        try {
            if (this.webBgmAudio) {
                this.webBgmAudio.pause();
                this.webBgmAudio.removeAttribute('src');
                this.webBgmAudio = null;
            }

            const source = BGM_PLAYLIST[this.currentTrackIndex];
            this.currentTrackIndex = (this.currentTrackIndex + 1) % BGM_PLAYLIST.length;

            const uri = this.resolveWebUri(source);
            this.webBgmAudio = new window.Audio(uri);
            this.webBgmAudio.volume = 0.15;
            this.webBgmAudio.addEventListener('ended', () => {
                this.playNextWebBGM();
            });
            this.webBgmAudio.addEventListener('error', () => {
                setTimeout(() => this.playNextWebBGM(), 2000);
            });
            this.webBgmAudio.play().catch(() => { });
        } catch (e) {
            console.log('Web BGM hatası:', e);
        }
    }

    static async playNextBGM() {
        try {
            if (this.bgmSound) {
                await this.bgmSound.unloadAsync();
                this.bgmSound = null;
            }

            const source = BGM_PLAYLIST[this.currentTrackIndex];
            this.currentTrackIndex = (this.currentTrackIndex + 1) % BGM_PLAYLIST.length;

            const { sound } = await Audio.Sound.createAsync(source);
            this.bgmSound = sound;
            this.bgmSound.setOnPlaybackStatusUpdate(this.onBgmStatusUpdate);
            await this.bgmSound.setVolumeAsync(0.15);
            await this.bgmSound.playAsync();
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
        if (Platform.OS === 'web') {
            try {
                if (this.webClickAudio) {
                    this.webClickAudio.currentTime = 0;
                    this.webClickAudio.play().catch(() => { });
                }
            } catch (e) { }
            return;
        }
        try {
            if (this.clickSound) await this.clickSound.replayAsync();
        } catch (e) { }
    }

    static async playWin() {
        if (Platform.OS === 'web') {
            try {
                if (this.webWinAudio) {
                    this.webWinAudio.currentTime = 0;
                    this.webWinAudio.play().catch(() => { });
                }
            } catch (e) { }
            return;
        }
        try {
            if (this.winSound) await this.winSound.replayAsync();
        } catch (e) { }
    }
}

export default SoundManager;
