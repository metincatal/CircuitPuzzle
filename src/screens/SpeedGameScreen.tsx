import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing,
  Platform, SafeAreaView, Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, RotateCcw, Trophy, Zap } from 'lucide-react-native';

import { CircuitCanvas, COLORS } from '../components/CircuitCanvas';
import SoundManager from '../utils/SoundManager';
import HapticManager from '../utils/HapticManager';
import StorageManager from '../utils/StorageManager';
import {
  Level,
  generateGridLevel,
  calculatePowerFlow,
  isLevelSolved,
} from '../types/circuit';

const INITIAL_TIME = 60; // saniye

// Speed puzzle numarasını klasik seviye numarasına çevir
// Progresif zorluk: hızlı artan, sınırsız
const speedToClassicLevel = (puzzleNum: number): number => {
  if (puzzleNum <= 3) return puzzleNum + 1;                    // Isınma: 2, 3, 4 → 5×4
  if (puzzleNum <= 6) return puzzleNum * 3;                    // Kolay: 9, 12, 15, 18 → 5×5, 6×5
  if (puzzleNum <= 10) return 18 + (puzzleNum - 6) * 5;       // Orta: 23, 28, 33, 38 → 7×6
  if (puzzleNum <= 15) return 38 + (puzzleNum - 10) * 7;      // Zor: 45, 52, 59, 66, 73 → 8×7
  return 73 + (puzzleNum - 15) * 10;                           // Çok zor: 83, 93, 103... → 9×8+
};

const COMBO_TIME_LIMIT = 15; // saniye - bu sürede çöz, combo devam etsin

// Grid boyutuna göre zaman bonusu
const getTimeBonus = (rows: number, cols: number): number => {
  const tileCount = rows * cols;
  if (tileCount <= 20) return 10;  // 5x4
  if (tileCount <= 30) return 14;  // 6x5
  if (tileCount <= 42) return 18;  // 7x6
  if (tileCount <= 56) return 22;  // 7x7, 8x7
  return 25;                        // 8x8+
};

interface SpeedGameScreenProps {
  onBack: () => void;
}

export const SpeedGameScreen: React.FC<SpeedGameScreenProps> = ({ onBack }) => {
  const [level, setLevel] = useState<Level | null>(null);
  const [puzzleNumber, setPuzzleNumber] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [isStarting, setIsStarting] = useState(true);
  const [countdown, setCountdown] = useState(3);

  // Zaman bonusu animasyonu
  const bonusOpacity = useRef(new Animated.Value(0)).current;
  const bonusTranslateY = useRef(new Animated.Value(0)).current;
  const [bonusText, setBonusText] = useState('');

  // Timer bar animasyonu
  const timerBarWidth = useRef(new Animated.Value(1)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;

  // Çözüm flash animasyonu
  const solveFlash = useRef(new Animated.Value(0)).current;

  // Score animasyonu
  const scoreScale = useRef(new Animated.Value(1)).current;

  // Combo sistemi
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const puzzleStartTimeRef = useRef(0);
  const comboScale = useRef(new Animated.Value(0)).current;

  // Ref'ler (closure sorunlarını önlemek için)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef(INITIAL_TIME);
  const isGameOverRef = useRef(false);
  const isStartingRef = useRef(true);
  const scoreRef = useRef(0);
  const puzzleNumberRef = useRef(0);
  const levelRef = useRef<Level | null>(null);

  // Yükleme
  useEffect(() => {
    const init = async () => {
      const hs = await StorageManager.getSpeedHighScore();
      setHighScore(hs);
    };
    init();
  }, []);

  // Geri sayım
  useEffect(() => {
    if (!isStarting) return;

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsStarting(false);
          isStartingRef.current = false;
          startGame();
          return 0;
        }
        return prev - 1;
      });
    }, 800);

    return () => clearInterval(countdownInterval);
  }, [isStarting]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(INITIAL_TIME);
    timeLeftRef.current = INITIAL_TIME;
    setIsGameOver(false);
    isGameOverRef.current = false;
    setPuzzleNumber(0);
    timerBarWidth.setValue(1);

    // İlk bulmacayı oluştur
    loadNextPuzzle(1);

    // Timer başlat
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (isGameOverRef.current || isStartingRef.current) return;

      timeLeftRef.current -= 0.1;
      const newTime = Math.max(0, timeLeftRef.current);

      setTimeLeft(newTime);

      // Timer bar güncelle
      timerBarWidth.setValue(newTime / INITIAL_TIME);

      if (newTime <= 0) {
        gameOver();
      }
    }, 100);
  };

  const loadNextPuzzle = (nextPuzzleNum: number) => {
    const classicLevel = speedToClassicLevel(nextPuzzleNum);
    const newLevel = generateGridLevel(classicLevel);
    setLevel(newLevel);
    levelRef.current = newLevel;
    setPuzzleNumber(nextPuzzleNum);
    puzzleNumberRef.current = nextPuzzleNum;
    puzzleStartTimeRef.current = Date.now();
  };

  const gameOver = async () => {
    if (isGameOverRef.current) return;
    isGameOverRef.current = true;
    setIsGameOver(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    HapticManager.mediumTap();

    // Rekor kontrol (ref kullan, stale closure önleme)
    const currentScore = scoreRef.current;
    const isNew = await StorageManager.saveSpeedHighScore(currentScore);
    if (isNew) {
      setIsNewRecord(true);
    }
    const hs = await StorageManager.getSpeedHighScore();
    setHighScore(hs);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Düşük süre pulse efekti
  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0 && !isGameOver && !isStarting) {
      Animated.sequence([
        Animated.timing(timerPulse, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(timerPulse, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [Math.floor(timeLeft)]);

  const showTimeBonus = (bonus: number) => {
    setBonusText(`+${bonus}s`);
    bonusOpacity.setValue(1);
    bonusTranslateY.setValue(0);

    Animated.parallel([
      Animated.timing(bonusOpacity, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(bonusTranslateY, {
        toValue: -50,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const showSolveFlash = () => {
    solveFlash.setValue(1);
    Animated.timing(solveFlash, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const showScorePop = () => {
    scoreScale.setValue(1.3);
    Animated.spring(scoreScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const handleTilePress = useCallback((tileId: string) => {
    const currentLevel = levelRef.current;
    if (!currentLevel || currentLevel.isSolved || isGameOverRef.current || isStartingRef.current) return;

    const tile = currentLevel.tiles.find(t => t.id === tileId);
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
      const solved = isLevelSolved(newTiles);

      if (solved) {
        // Bulmaca çözüldü!
        handlePuzzleSolved(prevLevel.rows, prevLevel.cols);
      }

      const updatedLevel = { ...prevLevel, tiles: newTiles, isSolved: solved };
      levelRef.current = updatedLevel;
      return updatedLevel;
    });
  }, []);

  const showComboIndicator = (comboCount: number) => {
    if (comboCount >= 2) {
      comboScale.setValue(1.4);
      Animated.spring(comboScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePuzzleSolved = (rows: number, cols: number) => {
    SoundManager.playWin();
    HapticManager.celebrationBurst();

    // Combo kontrolü: hızlı çözdün mü?
    const solveTime = (Date.now() - puzzleStartTimeRef.current) / 1000;
    if (solveTime <= COMBO_TIME_LIMIT && comboRef.current >= 0) {
      comboRef.current += 1;
    } else {
      comboRef.current = 0;
    }
    setCombo(comboRef.current);
    showComboIndicator(comboRef.current);

    // Skor artır
    const newScore = scoreRef.current + 1;
    scoreRef.current = newScore;
    setScore(newScore);
    showScorePop();
    showSolveFlash();

    // Zaman bonusu: combo ile artan
    const baseBonus = getTimeBonus(rows, cols);
    const comboBonus = Math.min(comboRef.current, 5) * 2; // max +10s ekstra
    const totalBonus = baseBonus + comboBonus;
    timeLeftRef.current = Math.min(timeLeftRef.current + totalBonus, 99.9);
    setTimeLeft(timeLeftRef.current);
    timerBarWidth.setValue(timeLeftRef.current / INITIAL_TIME);
    showTimeBonus(totalBonus);

    // Kısa gecikme sonra sonraki bulmaca
    const nextPuzzle = puzzleNumberRef.current + 1;
    setTimeout(() => {
      loadNextPuzzle(nextPuzzle);
    }, 600);
  };

  const handlePlayAgain = () => {
    setIsNewRecord(false);
    setIsGameOver(false);
    isGameOverRef.current = false;
    setIsStarting(true);
    isStartingRef.current = true;
    setCountdown(3);
    setScore(0);
    scoreRef.current = 0;
    setPuzzleNumber(0);
    puzzleNumberRef.current = 0;
    setCombo(0);
    comboRef.current = 0;
    setTimeLeft(INITIAL_TIME);
    timeLeftRef.current = INITIAL_TIME;
    timerBarWidth.setValue(1);
    levelRef.current = null;
  };

  const handleBackToMenu = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onBack();
  };

  // Timer rengi
  const getTimerColor = () => {
    if (timeLeft > 30) return COLORS.active;
    if (timeLeft > 10) return '#B8A634';
    return '#B84634';
  };

  // Süre formatla
  const formatTime = (t: number): string => {
    const secs = Math.floor(t);
    const tenths = Math.floor((t % 1) * 10);
    return `${secs}.${tenths}`;
  };

  // Geri sayım ekranı
  if (isStarting) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>
              {countdown > 0 ? countdown : 'BAŞLA!'}
            </Text>
            <Text style={styles.countdownSubtext}>Zamana Karşı</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!level) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
      </View>
    );
  }

  const timerColor = getTimerColor();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Çözüm flash efekti */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: COLORS.solvedActive,
            opacity: solveFlash.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.15],
            }),
            zIndex: 90,
          },
        ]}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            onPress={handleBackToMenu}
          >
            <ArrowLeft size={22} color={COLORS.active} />
          </Pressable>

          <Animated.View style={[styles.scoreContainer, { transform: [{ scale: scoreScale }] }]}>
            <Text style={styles.scoreLabel}>SKOR</Text>
            <Text style={styles.scoreText}>{score}</Text>
          </Animated.View>

          <View style={styles.puzzleNumContainer}>
            <Text style={styles.puzzleNumText}>#{puzzleNumber}</Text>
          </View>
        </View>

        {/* TIMER BAR */}
        <Animated.View style={[styles.timerContainer, { transform: [{ scale: timerPulse }] }]}>
          <View style={styles.timerBarBg}>
            <Animated.View
              style={[
                styles.timerBarFill,
                {
                  backgroundColor: timerColor,
                  width: timerBarWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={[styles.timerText, { color: timerColor }]}>
            {formatTime(timeLeft)}
          </Text>

          {/* Zaman bonusu animasyonu */}
          <Animated.Text
            style={[
              styles.bonusText,
              {
                opacity: bonusOpacity,
                transform: [{ translateY: bonusTranslateY }],
              },
            ]}
          >
            {bonusText}
          </Animated.Text>
        </Animated.View>

        {/* COMBO GÖSTERGESI */}
        {combo >= 2 && (
          <Animated.View style={[
            styles.comboContainer,
            { transform: [{ scale: comboScale }] },
          ]}>
            <Zap size={14} color="#C17A3A" />
            <Text style={styles.comboText}>x{combo} COMBO</Text>
            <Text style={styles.comboBonusHint}>+{Math.min(combo, 5) * 2}s bonus</Text>
          </Animated.View>
        )}

        {/* PUZZLE ALANI */}
        <View style={styles.centerArea}>
          <CircuitCanvas
            level={level}
            onTilePress={handleTilePress}
            isSolved={level.isSolved}
          />
        </View>
      </SafeAreaView>

      {/* GAME OVER MODAL */}
      <Modal
        visible={isGameOver}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {isNewRecord && (
              <View style={styles.newRecordBadge}>
                <Trophy size={16} color="#C17A3A" />
                <Text style={styles.newRecordText}>YENİ REKOR!</Text>
              </View>
            )}

            <Text style={styles.gameOverTitle}>Süre Doldu!</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Çözülen</Text>
                <Text style={styles.statValue}>{score}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>En İyi</Text>
                <Text style={styles.statValue}>{highScore}</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.playAgainBtn,
                  pressed && styles.btnPressed,
                ]}
                onPress={handlePlayAgain}
              >
                <RotateCcw size={18} color="#fff" />
                <Text style={styles.playAgainText}>Tekrar Oyna</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.menuBtn,
                  pressed && styles.btnPressed,
                ]}
                onPress={handleBackToMenu}
              >
                <Text style={styles.menuBtnText}>Ana Menü</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  // Geri sayım
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 72,
    fontWeight: '200',
    color: '#C17A3A',
  },
  countdownSubtext: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(193,122,58,0.5)',
    marginTop: 16,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 6,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107,123,58,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.5,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(107,123,58,0.4)',
    letterSpacing: 2,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.active,
    fontVariant: ['tabular-nums'],
  },
  puzzleNumContainer: {
    width: 40,
    alignItems: 'flex-end',
  },
  puzzleNumText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(107,123,58,0.3)',
    fontVariant: ['tabular-nums'],
  },
  // Timer
  timerContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timerBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(107,123,58,0.1)',
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
  bonusText: {
    position: 'absolute',
    right: 20,
    top: -16,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.solvedActive,
  },
  // Combo
  comboContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  comboText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#C17A3A',
    letterSpacing: 1,
  },
  comboBonusHint: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(193,122,58,0.5)',
  },
  // Center
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  // Game Over Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  newRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(193,122,58,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  newRecordText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C17A3A',
    letterSpacing: 1,
  },
  gameOverTitle: {
    fontSize: 28,
    fontWeight: '300',
    color: COLORS.active,
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 24,
  },
  statRow: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(107,123,58,0.4)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.active,
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(107,123,58,0.15)',
  },
  modalButtons: {
    width: '100%',
    gap: 10,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  playAgainBtn: {
    backgroundColor: COLORS.active,
  },
  playAgainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  menuBtn: {
    backgroundColor: 'rgba(107,123,58,0.08)',
  },
  menuBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.active,
  },
});
