import { Audio, AVPlaybackStatus } from 'expo-av';

// BGM Listesi (Static Requires)
const BGM_PLAYLIST = [
    require('../../assets/sounds/bgm/space-ambient-background-music-462074.mp3'),
    require('../../assets/sounds/bgm/241020-techno-minimal-dark-noise-game-anime-video-255258.mp3'),
    require('../../assets/sounds/bgm/dopetronic-echoes-from-nowhere-original-mix-gift-track-321994.mp3'),
    require('../../assets/sounds/bgm/241029-techno-dark-minimal-experimental-game-anime-video-284019.mp3'),
];

class SoundManager {
    static clickSound: Audio.Sound | null = null;
    static winSound: Audio.Sound | null = null;
    static bgmSound: Audio.Sound | null = null;
    static currentTrackIndex = 0;

    static async loadSounds() {
        // Audio Mode Ayarla (iOS'te sessize alma tuşuna rağmen çalsın)
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
        });

        try {
            // SFX Yükle
            const { sound: click } = await Audio.Sound.createAsync(require('../../assets/sounds/click.wav'));
            this.clickSound = click;
            // Click sesi çok yüksekse kısılabilir
            await this.clickSound.setVolumeAsync(0.3);

            const { sound: win } = await Audio.Sound.createAsync(require('../../assets/sounds/win.mp3'));
            this.winSound = win;

            // BGM Başlat
            this.playNextBGM();

        } catch (error) {
            console.log("Ses yükleme hatası:", error);
        }
    }

    static async playNextBGM() {
        try {
            // Önceki varsa durdur ve unload et
            if (this.bgmSound) {
                await this.bgmSound.unloadAsync();
                this.bgmSound = null;
            }

            // Playlist'ten sıradakini al
            const source = BGM_PLAYLIST[this.currentTrackIndex];

            // Yükle ve Çal
            const { sound } = await Audio.Sound.createAsync(source);
            this.bgmSound = sound;

            // Bittiğinde sonrakine geçmesi için event listener ekleyemiyoruz (Sound objesinde yok)
            // Ama loop yerine onPlaybackStatusUpdate kullanabiliriz.
            this.bgmSound.setOnPlaybackStatusUpdate(this.onBgmStatusUpdate);

            await this.bgmSound.setVolumeAsync(0.15); // Arka plan müziği kısık
            await this.bgmSound.playAsync();

            // Index'i ilerlet
            this.currentTrackIndex = (this.currentTrackIndex + 1) % BGM_PLAYLIST.length;

        } catch (e) {
            console.log("BGM Oynatma hatası:", e);
        }
    }

    // BGM durumunu izle, biterse diğerine geç
    static onBgmStatusUpdate = (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
            SoundManager.playNextBGM();
        }
    }

    static async playClick() {
        try {
            if (this.clickSound) {
                await this.clickSound.replayAsync();
            }
        } catch (e) { }
    }

    static async playWin() {
        try {
            if (this.winSound) {
                await this.winSound.replayAsync();
            }
        } catch (e) { }
    }
}

export default SoundManager;
