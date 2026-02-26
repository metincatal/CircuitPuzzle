import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { HomeScreen } from './src/screens/HomeScreen';
import { ClassicGameScreen } from './src/screens/ClassicGameScreen';
import { SpeedGameScreen } from './src/screens/SpeedGameScreen';
import { DuelGameScreen } from './src/screens/DuelGameScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import SoundManager from './src/utils/SoundManager';
import StorageManager from './src/utils/StorageManager';
import PresenceManager from './src/utils/PresenceManager';
import { COLORS } from './src/components/CircuitCanvas';

type Screen = 'home' | 'classic' | 'speed' | 'duel';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [lastClassicLevel, setLastClassicLevel] = useState(1);
  const [speedHighScore, setSpeedHighScore] = useState(0);
  const [speedBestWave, setSpeedBestWave] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const presenceUnsub = useRef<(() => void) | null>(null);

  useEffect(() => {
    const init = async () => {
      await StorageManager.initialize();
      SoundManager.loadSounds();

      const lastLevel = await StorageManager.getLastClassicLevel();
      setLastClassicLevel(lastLevel);

      const hs = await StorageManager.getSpeedHighScore();
      setSpeedHighScore(hs);
      const bw = await StorageManager.getSpeedBestWave();
      setSpeedBestWave(bw);

      const onboardingDone = await StorageManager.isOnboardingDone();
      if (!onboardingDone) setShowOnboarding(true);

      // Presence: kayıt ol ve canlı sayacı dinle
      PresenceManager.register();
      presenceUnsub.current = PresenceManager.subscribe(setOnlineCount);

      // Arka plana geçince / ön plana gelince güncelle
      const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') PresenceManager.register();
        else PresenceManager.unregister();
      });

      setIsReady(true);

      return () => {
        PresenceManager.unregister();
        presenceUnsub.current?.();
        appStateSub.remove();
      };
    };
    init();
  }, []);

  // Ekranlar arası geçişte verileri güncelle
  const handleGoHome = async () => {
    const lastLevel = await StorageManager.getLastClassicLevel();
    setLastClassicLevel(lastLevel);

    const hs = await StorageManager.getSpeedHighScore();
    setSpeedHighScore(hs);
    const bw = await StorageManager.getSpeedBestWave();
    setSpeedBestWave(bw);

    setScreen('home');
  };

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <StatusBar style="dark" />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen
        onDone={() => {
          StorageManager.setOnboardingDone();
          setShowOnboarding(false);
        }}
      />
    );
  }

  switch (screen) {
    case 'home':
      return (
        <HomeScreen
          onSelectMode={(mode) => setScreen(mode)}
          lastClassicLevel={lastClassicLevel}
          speedHighScore={speedHighScore}
          speedBestWave={speedBestWave}
          onlineCount={onlineCount}
        />
      );
    case 'classic':
      return (
        <ClassicGameScreen
          onBack={handleGoHome}
          initialLevel={lastClassicLevel}
        />
      );
    case 'speed':
      return (
        <SpeedGameScreen
          onBack={handleGoHome}
        />
      );
    case 'duel':
      return (
        <DuelGameScreen
          onBack={handleGoHome}
        />
      );
  }
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
