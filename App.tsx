import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { HomeScreen } from './src/screens/HomeScreen';
import { ClassicGameScreen } from './src/screens/ClassicGameScreen';
import { SpeedGameScreen } from './src/screens/SpeedGameScreen';
import { DuelGameScreen } from './src/screens/DuelGameScreen';
import SoundManager from './src/utils/SoundManager';
import StorageManager from './src/utils/StorageManager';
import { COLORS } from './src/components/CircuitCanvas';

type Screen = 'home' | 'classic' | 'speed' | 'duel';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [lastClassicLevel, setLastClassicLevel] = useState(1);
  const [speedHighScore, setSpeedHighScore] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await StorageManager.initialize();
      SoundManager.loadSounds();

      const lastLevel = await StorageManager.getLastClassicLevel();
      setLastClassicLevel(lastLevel);

      const hs = await StorageManager.getSpeedHighScore();
      setSpeedHighScore(hs);

      setIsReady(true);
    };
    init();
  }, []);

  // Ekranlar arası geçişte verileri güncelle
  const handleGoHome = async () => {
    const lastLevel = await StorageManager.getLastClassicLevel();
    setLastClassicLevel(lastLevel);

    const hs = await StorageManager.getSpeedHighScore();
    setSpeedHighScore(hs);

    setScreen('home');
  };

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <StatusBar style="dark" />
      </View>
    );
  }

  switch (screen) {
    case 'home':
      return (
        <HomeScreen
          onSelectMode={(mode) => setScreen(mode)}
          lastClassicLevel={lastClassicLevel}
          speedHighScore={speedHighScore}
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
