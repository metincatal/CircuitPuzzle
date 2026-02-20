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

    // Web Audio öğeleri
    static webClickAudio: HTMLAudioElement | null = null;
    static webWinAudio: HTMLAudioElement | null = null;
    static webBgmAudio: HTMLAudioElement | null = null;

    static async loadSounds() {
        if (Platform.OS === 'web') {
            try {
                // Web için HTML5 Audio kullan
                // Metro bundler, require() ile asset URI'lerini döner
                const clickSrc = require('../../assets/sounds/click2.mp3');
                const winSrc = require('../../assets/sounds/win2.mp3');

                this.webClickAudio = new window.Audio(typeof clickSrc === 'string' ? clickSrc : clickSrc.uri || clickSrc.default || clickSrc);
                this.webClickAudio.volume = 0.3;

                this.webWinAudio = new window.Audio(typeof winSrc === 'string' ? winSrc : winSrc.uri || winSrc.default || winSrc);
                this.webWinAudio.volume = 1.0;

                this.playNextBGMWeb();
            } catch (e) {
                console.log('Web ses yükleme hatası:', e);
            }
            return;
        }

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

    static async playNextBGMWeb() {
        try {
            if (this.webBgmAudio) {
                this.webBgmAudio.pause();
                this.webBgmAudio.src = '';
            }

            const source = BGM_PLAYLIST[this.currentTrackIndex];
            const src = typeof source === 'string' ? source : source.uri || source.default || source;
            this.webBgmAudio = new window.Audio(src);
            this.webBgmAudio.volume = 0.15;
            this.webBgmAudio.addEventListener('ended', () => {
                this.currentTrackIndex = (this.currentTrackIndex + 1) % BGM_PLAYLIST.length;
                this.playNextBGMWeb();
            });
            // Web'de autoplay engellenebilir, kullanıcı etkileşimi gerekebilir
            this.webBgmAudio.play().catch(() => {
                // Autoplay engellenmiş, ilk tıklamada tekrar dene
                const resumeBGM = () => {
                    if (this.webBgmAudio) {
                        this.webBgmAudio.play().catch(() => { });
                    }
                    document.removeEventListener('click', resumeBGM);
                    document.removeEventListener('touchstart', resumeBGM);
                };
                document.addEventListener('click', resumeBGM);
                document.addEventListener('touchstart', resumeBGM);
            });
            this.currentTrackIndex = (this.currentTrackIndex + 1) % BGM_PLAYLIST.length;
        } catch (e) {
            console.log('Web BGM hatası:', e);
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
