import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Pressable, SafeAreaView, Text,
  Dimensions, Platform, Animated, Easing, GestureResponderEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { EyeOff, Eye, Camera, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react-native';
let MediaLibrary: any = null;
let ViewShot: any = null;
if (Platform.OS !== 'web') {
  MediaLibrary = require('expo-media-library');
  ViewShot = require('react-native-view-shot').default;
}

import { CircuitCanvas, COLORS } from '../components/CircuitCanvas';
import { MiniPreview } from '../components/MiniPreview';
import SoundManager from '../utils/SoundManager';
import HapticManager from '../utils/HapticManager';
import StorageManager from '../utils/StorageManager';
import {
  Level,
  generateGridLevel,
  calculatePowerFlow,
  isLevelSolved,
} from '../types/circuit';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ClassicGameScreenProps {
  onBack: () => void;
  initialLevel?: number;
}

export const ClassicGameScreen: React.FC<ClassicGameScreenProps> = ({
  onBack,
  initialLevel = 1,
}) => {
  const [level, setLevel] = useState<Level | null>(null);
  const levelHistory = useRef<Record<number, { level: Level, initialTiles: any[] }>>({});
  const [initialTiles, setInitialTiles] = useState<any[]>([]);

  const [showPreview, setShowPreview] = useState(false);
  const [levelNumber, setLevelNumber] = useState(0);

  // Win renk animasyonu
  const bgColorAnim = useRef(new Animated.Value(0)).current;

  // Circle reveal geçiş animasyonu
  const circleScale = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [tapPos, setTapPos] = useState({ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 });

  // Screenshot ref
  const viewShotRef = useRef<any>(null);

  useEffect(() => {
    goToLevel(initialLevel);
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
      StorageManager.saveLastClassicLevel(levelNumber);
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
    StorageManager.saveLastClassicLevel(targetLevelNum);
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

  // Win durumunda ekrana tıklama -> circle reveal geçiş
  const handleWinTap = (event: GestureResponderEvent) => {
    if (!level?.isSolved || isTransitioning) return;

    const { pageX, pageY } = event.nativeEvent;
    setTapPos({ x: pageX, y: pageY });
    setIsTransitioning(true);

    circleScale.setValue(0);
    circleOpacity.setValue(1);

    const maxDist = Math.sqrt(
      Math.pow(Math.max(pageX, SCREEN_WIDTH - pageX), 2) +
      Math.pow(Math.max(pageY, SCREEN_HEIGHT - pageY), 2)
    );
    const CIRCLE_RADIUS = 10;
    const targetScale = Math.ceil(maxDist / CIRCLE_RADIUS) + 2;

    Animated.timing(circleScale, {
      toValue: targetScale,
      duration: 700,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      startNewLevel();

      setTimeout(() => {
        Animated.timing(circleOpacity, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          setIsTransitioning(false);
          circleScale.setValue(0);
          circleOpacity.setValue(1);
        });
      }, 250);
    });
  };

  // Screenshot
  const handleScreenshot = async () => {
    if (Platform.OS === 'web' || !MediaLibrary) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;

      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();
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
        if (t.id !== tileId) return t;
        if (t.type === 'blocker') return t;
        if (t.type === 'switch') return { ...t, switchState: !t.switchState };
        return { ...t, rotation: (t.rotation + 1) % 4 };
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
          {/* Geri butonu */}
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            onPress={onBack}
          >
            <ArrowLeft size={20} color="rgba(107,123,58,0.6)" />
          </Pressable>

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

          {/* Göz butonu */}
          {!level.isSolved ? (
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
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* MERKEZ ALAN */}
        <View style={styles.centerArea}>
          {Platform.OS !== 'web' && ViewShot ? (
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
              <View
                collapsable={false}
                style={{ backgroundColor: level.isSolved ? COLORS.solvedBg : COLORS.background }}
              >
                <CircuitCanvas
                  level={level}
                  onTilePress={handleTilePress}
                  isSolved={level.isSolved}
                />
              </View>
            </ViewShot>
          ) : (
            <View
              style={{ backgroundColor: level.isSolved ? COLORS.solvedBg : COLORS.background }}
            >
              <CircuitCanvas
                level={level}
                onTilePress={handleTilePress}
                isSolved={level.isSolved}
              />
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* MINI ÖNIZLEME */}
      {showPreview && !level.isSolved && (
        <View style={styles.previewContainer}>
          <MiniPreview level={level} />
        </View>
      )}

      {/* WIN TAP OVERLAY */}
      {level.isSolved && !isTransitioning && (
        <Pressable
          style={styles.winTapOverlay}
          onPress={handleWinTap}
        />
      )}

      {/* SCREENSHOT BUTONU */}
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

      {/* CIRCLE REVEAL */}
      {isTransitioning && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: tapPos.x - 10,
            top: tapPos.y - 10,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#5A6B32',
            transform: [{ scale: circleScale }],
            opacity: circleOpacity,
            zIndex: 100,
          }}
        />
      )}
    </Animated.View>
  );
};

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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107,123,58,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
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
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  previewContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 30 : 50,
    alignSelf: 'center',
    zIndex: 10,
  },
  screenshotContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 40 : 60,
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
});
