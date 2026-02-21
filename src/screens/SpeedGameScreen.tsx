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

// ─── Sabitler ────────────────────────────────────────────────

const INITIAL_TIME = 60;
const PUZZLES_PER_WAVE = 3;
const WAVE_BONUS_TIME = 5;
const CESUR_LEVEL_BOOST = 8;
const MAX_TIME = 120;

type GamePhase = 'countdown' | 'playing' | 'waveComplete' | 'gameOver';

// ─── Dalga → Klasik seviye eşlemesi ─────────────────────────

const WAVE_LEVELS = [2, 5, 9, 14, 20, 27, 35, 44, 55, 67];

const getWaveBaseLevel = (wave: number): number => {
  if (wave <= WAVE_LEVELS.length) return WAVE_LEVELS[wave - 1];
  return WAVE_LEVELS[WAVE_LEVELS.length - 1] + (wave - WAVE_LEVELS.length) * 13;
};

// ─── Zaman bonusu (grid boyutuna göre) ──────────────────────

const getTimeBonus = (rows: number, cols: number): number => {
  const tileCount = rows * cols;
  if (tileCount <= 20) return 10;
  if (tileCount <= 30) return 14;
  if (tileCount <= 42) return 18;
  if (tileCount <= 56) return 22;
  return 25;
};

// ─── Combo süre limiti (grid boyutuna göre ölçekleniyor) ────

const getComboTimeLimit = (rows: number, cols: number): number => {
  const tileCount = rows * cols;
  if (tileCount <= 20) return 12;
  if (tileCount <= 30) return 18;
  if (tileCount <= 42) return 25;
  if (tileCount <= 56) return 35;
  return 45;
};

// ─── Puan hesaplama ─────────────────────────────────────────

const calculatePuzzleScore = (
  wave: number,
  isCesur: boolean,
  solveTimeSec: number,
  combo: number,
): number => {
  const base = 100;
  const waveMult = 1 + (wave - 1) * 0.15;
  const cesurMult = isCesur ? 2 : 1;
  const comboMult = combo >= 4 ? 2.0 : combo >= 3 ? 1.5 : combo >= 2 ? 1.2 : 1.0;
  const speedBonus = Math.max(0, 50 - Math.floor(solveTimeSec * 2));
  return Math.round(base * waveMult * cesurMult * comboMult + speedBonus);
};

// ─── Milestone ──────────────────────────────────────────────

type Milestone = 'Bronz' | 'Gümüş' | 'Altın' | 'Elmas';

const getMilestone = (wave: number): Milestone | null => {
  if (wave >= 12) return 'Elmas';
  if (wave >= 8) return 'Altın';
  if (wave >= 5) return 'Gümüş';
  if (wave >= 3) return 'Bronz';
  return null;
};

const MILESTONE_COLORS: Record<Milestone, string> = {
  Bronz: '#A0724E',
  Gümüş: '#8A8A8A',
  Altın: '#C19A3A',
  Elmas: '#5A8FC1',
};

// ─── Skor formatlama ────────────────────────────────────────

const formatScore = (s: number): string =>
  s.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ─── Bileşen ────────────────────────────────────────────────

interface SpeedGameScreenProps {
  onBack: () => void;
}

export const SpeedGameScreen: React.FC<SpeedGameScreenProps> = ({ onBack }) => {
  // Durum
  const [phase, setPhase] = useState<GamePhase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [wave, setWave] = useState(1);
  const [puzzleInWave, setPuzzleInWave] = useState(0);
  const [level, setLevel] = useState<Level | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [combo, setCombo] = useState(0);
  const [isCesurWave, setIsCesurWave] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [bestWave, setBestWave] = useState(0);

  // Animasyonlar
  const timerBarWidth = useRef(new Animated.Value(1)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;
  const bonusOpacity = useRef(new Animated.Value(0)).current;
  const bonusTranslateY = useRef(new Animated.Value(0)).current;
  const [bonusText, setBonusText] = useState('');
  const solveFlash = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const comboScale = useRef(new Animated.Value(0)).current;
  const waveCompleteAnim = useRef(new Animated.Value(0)).current;

  // Ref'ler (closure güvenliği)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<GamePhase>('countdown');
  const timeLeftRef = useRef(INITIAL_TIME);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const puzzleInWaveRef = useRef(0);
  const comboRef = useRef(0);
  const levelRef = useRef<Level | null>(null);
  const isCesurWaveRef = useRef(false);
  const puzzleStartTimeRef = useRef(0);

  // ─── Başlatma ───────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const hs = await StorageManager.getSpeedHighScore();
      setHighScore(hs);
      const bw = await StorageManager.getSpeedBestWave();
      setBestWave(bw);
    };
    init();
  }, []);

  // ─── Geri sayım ────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'countdown') return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          startGame();
          return 0;
        }
        return prev - 1;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [phase]);

  // ─── Temizlik ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─── Düşük süre nabız efekti ──────────────────────────

  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0 && phase === 'playing') {
      Animated.sequence([
        Animated.timing(timerPulse, {
          toValue: 1.1, duration: 200, useNativeDriver: true,
        }),
        Animated.timing(timerPulse, {
          toValue: 1, duration: 200, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [Math.floor(timeLeft)]);

  // ─── Oyun başlat ──────────────────────────────────────

  const startGame = () => {
    phaseRef.current = 'playing';
    setPhase('playing');
    scoreRef.current = 0;
    setScore(0);
    waveRef.current = 1;
    setWave(1);
    puzzleInWaveRef.current = 0;
    setPuzzleInWave(0);
    timeLeftRef.current = INITIAL_TIME;
    setTimeLeft(INITIAL_TIME);
    comboRef.current = 0;
    setCombo(0);
    isCesurWaveRef.current = false;
    setIsCesurWave(false);
    timerBarWidth.setValue(1);

    loadPuzzle(1, false);
    startTimer();
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (phaseRef.current !== 'playing') return;

      timeLeftRef.current -= 0.1;
      const t = Math.max(0, timeLeftRef.current);
      setTimeLeft(t);
      timerBarWidth.setValue(Math.min(t / INITIAL_TIME, 1));

      if (t <= 0) gameOver();
    }, 100);
  };

  // ─── Puzzle yükleme ───────────────────────────────────

  const loadPuzzle = (waveNum: number, cesur: boolean) => {
    const baseLevel = getWaveBaseLevel(waveNum);
    const actualLevel = cesur ? baseLevel + CESUR_LEVEL_BOOST : baseLevel;
    const newLevel = generateGridLevel(actualLevel);
    setLevel(newLevel);
    levelRef.current = newLevel;
    puzzleStartTimeRef.current = Date.now();
  };

  // ─── Tile tıklama ─────────────────────────────────────

  const handleTilePress = useCallback((tileId: string) => {
    const currentLevel = levelRef.current;
    if (!currentLevel || currentLevel.isSolved) return;
    if (phaseRef.current !== 'playing') return;

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
        handlePuzzleSolved(prevLevel.rows, prevLevel.cols);
      }

      const updatedLevel = { ...prevLevel, tiles: newTiles, isSolved: solved };
      levelRef.current = updatedLevel;
      return updatedLevel;
    });
  }, []);

  // ─── Puzzle çözüldü ───────────────────────────────────

  const handlePuzzleSolved = (rows: number, cols: number) => {
    SoundManager.playWin();
    HapticManager.celebrationBurst();

    // Combo
    const solveTime = (Date.now() - puzzleStartTimeRef.current) / 1000;
    const comboLimit = getComboTimeLimit(rows, cols);
    if (solveTime <= comboLimit) {
      comboRef.current += 1;
    } else {
      comboRef.current = 0;
    }
    setCombo(comboRef.current);
    showComboIndicator(comboRef.current);

    // Skor
    const points = calculatePuzzleScore(
      waveRef.current, isCesurWaveRef.current, solveTime, comboRef.current,
    );
    scoreRef.current += points;
    setScore(scoreRef.current);
    showScorePop();
    showSolveFlash();

    // Zaman bonusu
    const baseBonus = getTimeBonus(rows, cols);
    const comboBonus = Math.min(comboRef.current, 5) * 2;
    const cesurPenalty = isCesurWaveRef.current ? 0.6 : 1;
    const totalBonus = Math.round((baseBonus + comboBonus) * cesurPenalty);
    timeLeftRef.current = Math.min(timeLeftRef.current + totalBonus, MAX_TIME);
    setTimeLeft(timeLeftRef.current);
    timerBarWidth.setValue(Math.min(timeLeftRef.current / INITIAL_TIME, 1));
    showTimeBonus(totalBonus);

    // Dalga ilerleme
    const nextPuzzleInWave = puzzleInWaveRef.current + 1;

    if (nextPuzzleInWave >= PUZZLES_PER_WAVE) {
      // Dalga tamamlandı — dalga bonus zamanı ekle
      timeLeftRef.current = Math.min(timeLeftRef.current + WAVE_BONUS_TIME, MAX_TIME);
      setTimeLeft(timeLeftRef.current);

      setTimeout(() => {
        phaseRef.current = 'waveComplete';
        setPhase('waveComplete');
        waveCompleteAnim.setValue(0);
        Animated.timing(waveCompleteAnim, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }).start();
      }, 700);
    } else {
      puzzleInWaveRef.current = nextPuzzleInWave;
      setPuzzleInWave(nextPuzzleInWave);

      setTimeout(() => {
        loadPuzzle(waveRef.current, isCesurWaveRef.current);
      }, 600);
    }
  };

  // ─── Dalga seçimi ─────────────────────────────────────

  const handleWaveChoice = (cesur: boolean) => {
    const nextWave = waveRef.current + 1;
    waveRef.current = nextWave;
    setWave(nextWave);
    puzzleInWaveRef.current = 0;
    setPuzzleInWave(0);
    isCesurWaveRef.current = cesur;
    setIsCesurWave(cesur);

    phaseRef.current = 'playing';
    setPhase('playing');

    loadPuzzle(nextWave, cesur);
  };

  // ─── Oyun bitti ───────────────────────────────────────

  const gameOver = async () => {
    if (phaseRef.current === 'gameOver') return;
    phaseRef.current = 'gameOver';
    setPhase('gameOver');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    HapticManager.mediumTap();

    const currentScore = scoreRef.current;
    const currentWave = waveRef.current;

    const isNew = await StorageManager.saveSpeedHighScore(currentScore);
    if (isNew) setIsNewRecord(true);
    await StorageManager.saveSpeedBestWave(currentWave);

    const hs = await StorageManager.getSpeedHighScore();
    setHighScore(hs);
    const bw = await StorageManager.getSpeedBestWave();
    setBestWave(bw);
  };

  // ─── Tekrar oyna ──────────────────────────────────────

  const handlePlayAgain = () => {
    setIsNewRecord(false);
    phaseRef.current = 'countdown';
    setPhase('countdown');
    setCountdown(3);
    scoreRef.current = 0;
    setScore(0);
    waveRef.current = 1;
    setWave(1);
    puzzleInWaveRef.current = 0;
    setPuzzleInWave(0);
    comboRef.current = 0;
    setCombo(0);
    isCesurWaveRef.current = false;
    setIsCesurWave(false);
    timeLeftRef.current = INITIAL_TIME;
    setTimeLeft(INITIAL_TIME);
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

  // ─── Animasyon yardımcıları ───────────────────────────

  const showTimeBonus = (bonus: number) => {
    setBonusText(`+${bonus}s`);
    bonusOpacity.setValue(1);
    bonusTranslateY.setValue(0);
    Animated.parallel([
      Animated.timing(bonusOpacity, {
        toValue: 0, duration: 1200, useNativeDriver: true,
      }),
      Animated.timing(bonusTranslateY, {
        toValue: -50, duration: 1200,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  };

  const showSolveFlash = () => {
    solveFlash.setValue(1);
    Animated.timing(solveFlash, {
      toValue: 0, duration: 400, useNativeDriver: true,
    }).start();
  };

  const showScorePop = () => {
    scoreScale.setValue(1.3);
    Animated.spring(scoreScale, {
      toValue: 1, friction: 4, useNativeDriver: true,
    }).start();
  };

  const showComboIndicator = (c: number) => {
    if (c >= 2) {
      comboScale.setValue(1.4);
      Animated.spring(comboScale, {
        toValue: 1, friction: 4, useNativeDriver: true,
      }).start();
    }
  };

  // ─── Yardımcı render ──────────────────────────────────

  const getTimerColor = () => {
    if (timeLeft > 30) return COLORS.active;
    if (timeLeft > 10) return '#B8A634';
    return '#B84634';
  };

  const formatTime = (t: number): string => {
    const secs = Math.floor(t);
    const tenths = Math.floor((t % 1) * 10);
    return `${secs}.${tenths}`;
  };

  const milestone = getMilestone(wave);

  // ─── Geri sayım ekranı ────────────────────────────────

  if (phase === 'countdown') {
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

  // ─── Dalga ilerleme noktaları ─────────────────────────

  const renderWaveDots = () => {
    const dots = [];
    for (let i = 0; i < PUZZLES_PER_WAVE; i++) {
      const filled = i < puzzleInWave || (level.isSolved && i === puzzleInWave);
      dots.push(
        <View
          key={i}
          style={[
            styles.waveDot,
            filled ? styles.waveDotFilled : styles.waveDotEmpty,
            isCesurWave && filled && styles.waveDotCesur,
          ]}
        />,
      );
    }
    return dots;
  };

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
            <Text style={styles.scoreText}>{formatScore(score)}</Text>
          </Animated.View>

          <View style={styles.waveInfo}>
            <Text style={styles.waveText}>D.{wave}</Text>
            <View style={styles.waveDotsRow}>{renderWaveDots()}</View>
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

        {/* COMBO */}
        {combo >= 2 && (
          <Animated.View style={[
            styles.comboContainer,
            { transform: [{ scale: comboScale }] },
          ]}>
            <Zap size={14} color="#C17A3A" />
            <Text style={styles.comboText}>x{combo}</Text>
          </Animated.View>
        )}

        {/* CESUR göstergesi */}
        {isCesurWave && phase === 'playing' && (
          <View style={styles.cesurBadge}>
            <Text style={styles.cesurBadgeText}>CESUR ×2</Text>
          </View>
        )}

        {/* PUZZLE */}
        <View style={styles.centerArea}>
          <CircuitCanvas
            level={level}
            onTilePress={handleTilePress}
            isSolved={level.isSolved}
          />
        </View>
      </SafeAreaView>

      {/* ─── DALGA TAMAMLANDI OVERLAY ──────────────────── */}
      {phase === 'waveComplete' && (
        <Animated.View
          style={[
            styles.waveOverlay,
            { opacity: waveCompleteAnim },
          ]}
        >
          <View style={styles.waveOverlayContent}>
            <Text style={styles.waveCompleteTitle}>DALGA {wave}</Text>
            <View style={styles.waveCompleteLine} />

            <View style={styles.waveChoiceRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.waveChoiceBtn,
                  styles.waveChoiceNormal,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => handleWaveChoice(false)}
              >
                <Text style={styles.waveChoiceLabel}>Devam</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.waveChoiceBtn,
                  styles.waveChoiceCesur,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => handleWaveChoice(true)}
              >
                <Text style={styles.waveChoiceCesurLabel}>Cesur ×2</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ─── GAME OVER MODAL ──────────────────────────── */}
      <Modal visible={phase === 'gameOver'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {isNewRecord && (
              <View style={styles.newRecordBadge}>
                <Trophy size={16} color="#C17A3A" />
                <Text style={styles.newRecordText}>YENİ REKOR!</Text>
              </View>
            )}

            {milestone && (
              <Text style={[
                styles.milestoneText,
                { color: MILESTONE_COLORS[milestone] },
              ]}>
                {milestone}
              </Text>
            )}

            <Text style={styles.gameOverTitle}>Süre Doldu!</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Skor</Text>
                <Text style={styles.statValue}>{formatScore(score)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Dalga</Text>
                <Text style={styles.statValue}>{wave}</Text>
              </View>
            </View>

            <View style={styles.bestStatsContainer}>
              <Text style={styles.bestStatText}>
                En iyi: {formatScore(highScore)} • Dalga {bestWave}
              </Text>
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

// ─── Stiller ─────────────────────────────────────────────────

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
  scoreText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.active,
    fontVariant: ['tabular-nums'],
  },
  waveInfo: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  waveText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(193,122,58,0.7)',
    fontVariant: ['tabular-nums'],
  },
  waveDotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  waveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  waveDotFilled: {
    backgroundColor: 'rgba(107,123,58,0.6)',
  },
  waveDotEmpty: {
    backgroundColor: 'rgba(107,123,58,0.15)',
  },
  waveDotCesur: {
    backgroundColor: 'rgba(193,122,58,0.7)',
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
    gap: 4,
    paddingVertical: 2,
  },
  comboText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#C17A3A',
    letterSpacing: 1,
  },

  // Cesur badge
  cesurBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(193,122,58,0.12)',
  },
  cesurBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C17A3A',
    letterSpacing: 1,
  },

  // Puzzle alanı
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },

  // ─── Dalga tamamlandı overlay ──────────────────────────
  waveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 32,
  },
  waveOverlayContent: {
    backgroundColor: COLORS.background,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  waveCompleteTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: '#C17A3A',
    letterSpacing: 3,
  },
  waveCompleteLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(193,122,58,0.25)',
    marginVertical: 20,
  },
  waveChoiceRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  waveChoiceBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveChoiceNormal: {
    backgroundColor: 'rgba(107,123,58,0.1)',
  },
  waveChoiceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.active,
  },
  waveChoiceCesur: {
    backgroundColor: '#C17A3A',
  },
  waveChoiceCesurLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // ─── Game Over Modal ──────────────────────────────────
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
    marginBottom: 12,
  },
  newRecordText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C17A3A',
    letterSpacing: 1,
  },
  milestoneText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
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
    marginBottom: 12,
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
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.active,
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(107,123,58,0.15)',
  },
  bestStatsContainer: {
    marginBottom: 24,
  },
  bestStatText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(107,123,58,0.4)',
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
