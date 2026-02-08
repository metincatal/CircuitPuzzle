import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Pressable, SafeAreaView, Dimensions, Platform, Animated } from 'react-native';
import { EyeOff, Eye, Camera } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';

import { CircuitCanvas, COLORS } from './src/components/CircuitCanvas';
import { MiniPreview } from './src/components/MiniPreview';
import SoundManager from './src/utils/SoundManager';
import HapticManager from './src/utils/HapticManager';
import StorageManager from './src/utils/StorageManager';
import {
  Level,
  generateGridLevel,
  calculatePowerFlow,
  isLevelSolved,
} from './src/types/circuit';

const { width, height } = Dimensions.get('window');

export default function App() {
  const [level, setLevel] = useState<Level | null>(null);
  const levelHistory = useRef<Record<number, { level: Level, initialTiles: any[] }>>({});
  const [initialTiles, setInitialTiles] = useState<any[]>([]);

  // Mini preview (göz butonu)
  const [showPreview, setShowPreview] = useState(false);

  // Level numarası
  const [levelNumber, setLevelNumber] = useState(0);

  // Win renk animasyonu
  const bgColorAnim = useRef(new Animated.Value(0)).current;

  // Screenshot ref
  const canvasRef = useRef<View>(null);

  useEffect(() => {
    const init = async () => {
      await StorageManager.initialize();
      SoundManager.loadSounds();
    };
    init();
  }, []);

  useEffect(() => {
    startNewLevel();
  }, []);

  // Win renk geçişi
  useEffect(() => {
    if (level?.isSolved) {
      SoundManager.playWin();
      HapticManager.celebrationBurst();

      Animated.timing(bgColorAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }).start();

      // Kaydet
      StorageManager.saveLevelCompletion(
        `level-${levelNumber}`,
        0,
        3
      );
    } else {
      bgColorAnim.setValue(0);
    }
  }, [level?.isSolved]);

  const goToLevel = async (targetLevelNum: number) => {
    if (targetLevelNum < 1) return;

    setShowPreview(false);
    bgColorAnim.setValue(0);

    if (levelHistory.current[targetLevelNum]) {
      const cached = levelHistory.current[targetLevelNum];
      const newTiles = JSON.parse(JSON.stringify(cached.initialTiles));
      calculatePowerFlow(newTiles);

      setLevel({
        ...cached.level,
        tiles: newTiles,
        isSolved: false
      });
      setInitialTiles(JSON.parse(JSON.stringify(cached.initialTiles)));
    } else {
      const newLevel = generateGridLevel(targetLevelNum);

      levelHistory.current[targetLevelNum] = {
        level: newLevel,
        initialTiles: JSON.parse(JSON.stringify(newLevel.tiles))
      };

      setLevel(newLevel);
      setInitialTiles(JSON.parse(JSON.stringify(newLevel.tiles)));
    }

    setLevelNumber(targetLevelNum);
  };

  const startNewLevel = () => {
    goToLevel(levelNumber + 1);
  };

  // Win durumunda ekrana dokunma -> sonraki level
  const handleScreenTap = () => {
    if (level?.isSolved) {
      startNewLevel();
    }
  };

  // Screenshot
  const handleScreenshot = async () => {
    if (!canvasRef.current) return;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;

      const uri = await captureRef(canvasRef.current, {
        format: 'png',
        quality: 1,
      });

      await MediaLibrary.saveToLibraryAsync(uri);
      HapticManager.successNotification();
    } catch (e) {
      console.log('Screenshot error:', e);
    }
  };

  const handleTilePress = useCallback((tileId: string) => {
    if (!level || level.isSolved || showPreview) return;

    // Fixed parçalar döndürülemez
    const tile = level.tiles.find(t => t.id === tileId);
    if (tile?.fixed) return;

    HapticManager.lightTap();
    SoundManager.playClick();

    setLevel(prevLevel => {
      if (!prevLevel) return null;

      const newTiles = prevLevel.tiles.map(t => {
        if (t.id === tileId) {
          return { ...t, rotation: (t.rotation + 1) % 4 };
        }
        return t;
      });

      calculatePowerFlow(newTiles);

      return {
        ...prevLevel,
        tiles: newTiles,
        isSolved: isLevelSolved(newTiles)
      };
    });
  }, [level, showPreview]);

  if (!level) {
    return (
      <View style={styles.loading}>
        <StatusBar style="dark" />
      </View>
    );
  }

  const animatedBg = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.background, COLORS.solvedBg],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: animatedBg }]}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        {/* HEADER - Göz butonu sağ üstte */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />

          {/* Boş merkez */}
          <View style={{ flex: 1 }} />

          {/* Göz butonu - sadece çözülmemişken */}
          {!level.isSolved ? (
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed, showPreview && styles.activeButton]}
              onPress={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <EyeOff size={20} color="#6B7B3A" />
              ) : (
                <Eye size={20} color="rgba(107,123,58,0.5)" />
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={handleScreenshot}
            >
              <Camera size={20} color="#4A8B5C" />
            </Pressable>
          )}
        </View>

        {/* GAME CANVAS */}
        <Pressable
          style={styles.canvasContainer}
          onPress={handleScreenTap}
          disabled={!level.isSolved}
        >
          <View ref={canvasRef} collapsable={false}>
            <CircuitCanvas
              level={level}
              onTilePress={handleTilePress}
              isSolved={level.isSolved}
            />
          </View>
        </Pressable>

        {/* FOOTER - boş alan */}
        <View style={styles.footer} />
      </SafeAreaView>

      {/* MINI PREVIEW OVERLAY */}
      {showPreview && !level.isSolved && (
        <MiniPreview
          level={level}
          onClose={() => setShowPreview(false)}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'android' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107,123,58,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: 'rgba(107,123,58,0.15)',
  },
  buttonPressed: {
    opacity: 0.6,
  },
  canvasContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    height: 60,
  },
});
