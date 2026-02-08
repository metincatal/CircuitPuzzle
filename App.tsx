import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, View, Pressable, SafeAreaView, Text,
  Dimensions, Platform, Animated, Easing,
} from 'react-native';
import { EyeOff, Eye, Camera, ChevronLeft, ChevronRight } from 'lucide-react-native';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function App() {
  const [level, setLevel] = useState<Level | null>(null);
  const levelHistory = useRef<Record<number, { level: Level, initialTiles: any[] }>>({});
  const [initialTiles, setInitialTiles] = useState<any[]>([]);

  const [showPreview, setShowPreview] = useState(false);
  const [levelNumber, setLevelNumber] = useState(0);

  // Win renk animasyonu
  const bgColorAnim = useRef(new Animated.Value(0)).current;

  // Geçiş animasyonu (fade)
  const transitionAnim = useRef(new Animated.Value(0)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

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

      StorageManager.saveLevelCompletion(`level-${levelNumber}`, 0, 3);
    } else {
      bgColorAnim.setValue(0);
    }
  }, [level?.isSolved]);

  const goToLevel = (targetLevelNum: number) => {
    if (targetLevelNum < 1) return;

    setShowPreview(false);
    bgColorAnim.setValue(0);

    if (levelHistory.current[targetLevelNum]) {
      const cached = levelHistory.current[targetLevelNum];
      const newTiles = JSON.parse(JSON.stringify(cached.initialTiles));
      calculatePowerFlow(newTiles);
      setLevel({ ...cached.level, tiles: newTiles, isSolved: false });
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

  const handlePrevLevel = () => {
    if (levelNumber > 1) goToLevel(levelNumber - 1);
  };
  const handleNextLevel = () => {
    goToLevel(levelNumber + 1);
  };

  // Win durumunda ekrana tıklama -> fade geçiş
  const handleWinTap = () => {
    if (!level?.isSolved || isTransitioning) return;
    setIsTransitioning(true);
    transitionAnim.setValue(0);

    // Fade in (perde kapanır)
    Animated.timing(transitionAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      // Perde tam kapandı - yeni level yükle
      startNewLevel();

      // Kısa bekleme sonra fade out
      setTimeout(() => {
        Animated.timing(transitionAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          setIsTransitioning(false);
        });
      }, 100);
    });
  };

  // Screenshot
  const handleScreenshot = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Media library permission denied');
        return;
      }

      if (canvasRef.current) {
        const uri = await captureRef(canvasRef, {
          format: 'png',
          quality: 1,
        });
        await MediaLibrary.saveToLibraryAsync(uri);
        HapticManager.successNotification();
      }
    } catch (e) {
      console.log('Screenshot error:', e);
    }
  };

  const handleTilePress = useCallback((tileId: string) => {
    if (!level || level.isSolved) return;

    const tile = level.tiles.find(t => t.id === tileId);
    if (tile?.fixed) return;

    HapticManager.lightTap();
    SoundManager.playClick();

    setLevel(prevLevel => {
      if (!prevLevel) return null;
      const newTiles = prevLevel.tiles.map(t => {
        if (t.id === tileId) return { ...t, rotation: (t.rotation + 1) % 4 };
        return t;
      });
      calculatePowerFlow(newTiles);
      return { ...prevLevel, tiles: newTiles, isSolved: isLevelSolved(newTiles) };
    });
  }, [level]);

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
        {/* HEADER */}
        <View style={styles.header}>
          {/* Level navigasyonu */}
          <View style={styles.levelNav}>
            <Pressable
              onPress={handlePrevLevel}
              style={({ pressed }) => [styles.navBtn, pressed && styles.btnPressed, levelNumber <= 1 && { opacity: 0.2 }]}
              disabled={levelNumber <= 1}
            >
              <ChevronLeft size={20} color="rgba(107,123,58,0.6)" />
            </Pressable>

            <Text style={styles.levelText}>{levelNumber}</Text>

            <Pressable
              onPress={handleNextLevel}
              style={({ pressed }) => [styles.navBtn, pressed && styles.btnPressed]}
            >
              <ChevronRight size={20} color="rgba(107,123,58,0.6)" />
            </Pressable>
          </View>

          <View style={{ flex: 1 }} />

          {/* Göz butonu */}
          {!level.isSolved && (
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.btnPressed, showPreview && styles.activeButton]}
              onPress={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <EyeOff size={20} color="#6B7B3A" />
              ) : (
                <Eye size={20} color="rgba(107,123,58,0.5)" />
              )}
            </Pressable>
          )}
        </View>

        {/* GAME CANVAS */}
        <View style={styles.canvasContainer}>
          <View
            ref={canvasRef}
            collapsable={false}
            style={{ backgroundColor: level.isSolved ? COLORS.solvedBg : COLORS.background }}
          >
            <CircuitCanvas
              level={level}
              onTilePress={handleTilePress}
              isSolved={level.isSolved}
            />
          </View>
        </View>

        {/* MİNİ ÖNİZLEME - Puzzle altında */}
        {showPreview && !level.isSolved && (
          <MiniPreview level={level} />
        )}

        {/* FOOTER SPACER */}
        <View style={styles.footer} />
      </SafeAreaView>

      {/* WIN TAP OVERLAY - çözülünce ekrana dokunarak sonraki seviyeye geç */}
      {level.isSolved && !isTransitioning && (
        <Pressable
          style={styles.winTapOverlay}
          onPress={handleWinTap}
        />
      )}

      {/* SCREENSHOT BUTONU - overlay'in üstünde */}
      {level.isSolved && !isTransitioning && (
        <View style={styles.screenshotContainer}>
          <Pressable
            style={({ pressed }) => [styles.screenshotBtn, pressed && styles.btnPressed]}
            onPress={handleScreenshot}
          >
            <Camera size={22} color="#4A8B5C" />
          </Pressable>
        </View>
      )}

      {/* FADE GEÇİŞ EFEKTİ */}
      {isTransitioning && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.transitionOverlay,
            { opacity: transitionAnim },
          ]}
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
    justifyContent: 'flex-start',
    paddingVertical: Platform.OS === 'android' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  levelNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtn: {
    padding: 6,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(107,123,58,0.7)',
    minWidth: 30,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
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
  btnPressed: {
    opacity: 0.5,
  },
  canvasContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  footer: {
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  screenshotContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 50 : 60,
    alignSelf: 'center',
    zIndex: 60,
  },
  screenshotBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74,139,92,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'transparent',
  },
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 100,
  },
});
