import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing,
  Platform, SafeAreaView, Modal, Dimensions,
  StatusBar as RNStatusBar, GestureResponderEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, RotateCcw, Trophy, Users, ChevronRight, Shuffle, EyeOff, Snowflake, Zap } from 'lucide-react-native';

import { CircuitCanvas, COLORS } from '../components/CircuitCanvas';
import SoundManager from '../utils/SoundManager';
import HapticManager from '../utils/HapticManager';
import StorageManager from '../utils/StorageManager';
import {
  Level,
  Tile,
  generateGridLevel,
  calculatePowerFlow,
  isLevelSolved,
} from '../types/circuit';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DUEL_COLOR = '#7B5EA7';
const P2_COLOR = '#C17A3A';
const STATUS_BAR_HEIGHT = Platform.OS === 'web'
  ? 0
  : Platform.OS === 'android'
    ? (RNStatusBar.currentHeight || 40)
    : 54;

const MAX_ENERGY = 5;
const ENERGY_PER_WIN = 2;
const MOVES_PER_ENERGY = 5;

const SABOTAGE_TYPES = {
  shuffle: { cost: 2, icon: 'shuffle', label: 'Karıştır' },
  blackout: { cost: 3, icon: 'eye-off', label: 'Karartma', duration: 4000 },
  freeze: { cost: 3, icon: 'snowflake', label: 'Dondurma', duration: 3000 },
} as const;

type SabotageType = keyof typeof SABOTAGE_TYPES;
type GamePhase = 'setup' | 'countdown' | 'playing' | 'roundEnd' | 'gameOver';

const DIFFICULTY_PRESETS = [
  { key: 'easy', label: 'Kolay', sublabel: '5×4', levelNum: 3, color: '#6B7B3A' },
  { key: 'medium', label: 'Orta', sublabel: '6×5', levelNum: 12, color: '#B8A634' },
  { key: 'hard', label: 'Zor', sublabel: '7×6', levelNum: 30, color: '#C17A3A' },
  { key: 'expert', label: 'Uzman', sublabel: '7×6+', levelNum: 50, color: '#B84634' },
];

interface DuelGameScreenProps {
  onBack: () => void;
}

export const DuelGameScreen: React.FC<DuelGameScreenProps> = ({ onBack }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | null>(null);
  const selectedDifficultyRef = useRef<number | null>(null);
  const [totalRounds, setTotalRounds] = useState(3);
  const totalRoundsRef = useRef(3);
  const [previewModalIndex, setPreviewModalIndex] = useState<number | null>(null);

  const previewLevels = useMemo(() => {
    return DIFFICULTY_PRESETS.map(d => generateGridLevel(d.levelNum));
  }, []);

  // Oyun state
  const [round, setRound] = useState(1);
  const [p1Level, setP1Level] = useState<Level | null>(null);
  const [p2Level, setP2Level] = useState<Level | null>(null);
  const [p1Moves, setP1Moves] = useState(0);
  const [p2Moves, setP2Moves] = useState(0);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [roundWinner, setRoundWinner] = useState<1 | 2 | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [countdown, setCountdown] = useState(3);

  // Enerji sistemi
  const [p1Energy, setP1Energy] = useState(0);
  const [p2Energy, setP2Energy] = useState(0);
  const p1EnergyRef = useRef(0);
  const p2EnergyRef = useRef(0);
  const p1CorrectMovesRef = useRef(0);
  const p2CorrectMovesRef = useRef(0);

  // Sabotaj aktif state'leri
  const [p1Blackout, setP1Blackout] = useState(false);
  const [p2Blackout, setP2Blackout] = useState(false);
  const [p1Freeze, setP1Freeze] = useState(false);
  const [p2Freeze, setP2Freeze] = useState(false);
  const p1FreezeRef = useRef(false);
  const p2FreezeRef = useRef(false);
  const [p1BlackoutTimer, setP1BlackoutTimer] = useState(0);
  const [p2BlackoutTimer, setP2BlackoutTimer] = useState(0);
  const [p1FreezeTimer, setP1FreezeTimer] = useState(0);
  const [p2FreezeTimer, setP2FreezeTimer] = useState(0);

  // Sabotaj uyarı overlay
  const [p1SabotageAlert, setP1SabotageAlert] = useState<string | null>(null);
  const [p2SabotageAlert, setP2SabotageAlert] = useState<string | null>(null);
  const sabotagesUsedRef = useRef(0);

  // Canvas layout'ları (locationX/locationY tabanlı hesaplama)

  // Ref'ler
  const p1LevelRef = useRef<Level | null>(null);
  const p2LevelRef = useRef<Level | null>(null);
  const gamePhaseRef = useRef<GamePhase>('setup');
  const p1MovesRef = useRef(0);
  const p2MovesRef = useRef(0);
  const p1WinsRef = useRef(0);
  const p2WinsRef = useRef(0);
  const roundRef = useRef(1);

  // Animasyonlar
  const winnerFlash = useRef(new Animated.Value(0)).current;
  const p1SabotageFlash = useRef(new Animated.Value(0)).current;
  const p2SabotageFlash = useRef(new Animated.Value(0)).current;

  // Ekran hesaplamaları
  const dividerHeight = 26;
  const sabotageRowHeight = 28;
  const playerHeaderHeight = 40;
  // Her playerHalf flex:1 alır, gerçek piksel yüksekliği:
  const flexHeight = (SCREEN_HEIGHT - dividerHeight) / 2;
  // P1'in status bar padding'i var, bu yüzden P1 canvas daha küçük - onu baz alıyoruz
  const canvasMaxHeight = flexHeight - STATUS_BAR_HEIGHT - playerHeaderHeight - sabotageRowHeight - 8;

  const getCellSize = (level: Level) => {
    const canvasWidth = SCREEN_WIDTH - 20;
    const cellW = canvasWidth / level.cols;
    const cellH = canvasMaxHeight / level.rows;
    return Math.min(cellW, cellH);
  };

  // ======== ZORLUK SEÇİMİ ========
  const handleSelectDifficulty = (index: number) => {
    setSelectedDifficulty(index);
    selectedDifficultyRef.current = index;
    setCountdown(3);
    setGamePhase('countdown');
    gamePhaseRef.current = 'countdown';
  };

  // ======== GERİ SAYIM ========
  useEffect(() => {
    if (gamePhase !== 'countdown') return;
    if (countdown === 3) startRound();

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setGamePhase('playing');
          gamePhaseRef.current = 'playing';
          return 0;
        }
        return prev - 1;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [gamePhase]);

  // ======== ROUND BAŞLAT ========
  const startRound = () => {
    const diffIndex = selectedDifficultyRef.current ?? 0;
    const preset = DIFFICULTY_PRESETS[diffIndex];
    const levelNum = preset.levelNum + (roundRef.current - 1) * 2;

    // Her oyuncuya bağımsız puzzle üret
    const p1Level = generateGridLevel(levelNum);
    const p2Level = generateGridLevel(levelNum);

    calculatePowerFlow(p1Level.tiles);
    calculatePowerFlow(p2Level.tiles);

    setP1Level(p1Level);
    setP2Level(p2Level);
    p1LevelRef.current = p1Level;
    p2LevelRef.current = p2Level;
    setP1Moves(0);
    setP2Moves(0);
    p1MovesRef.current = 0;
    p2MovesRef.current = 0;
    p1CorrectMovesRef.current = 0;
    p2CorrectMovesRef.current = 0;
    setRoundWinner(null);
    setP1Blackout(false);
    setP2Blackout(false);
    setP1Freeze(false);
    setP2Freeze(false);
    p1FreezeRef.current = false;
    p2FreezeRef.current = false;
    setP1SabotageAlert(null);
    setP2SabotageAlert(null);
  };

  // ======== ROUND KAZANMA ========
  const handleRoundWin = (winner: 1 | 2) => {
    if (gamePhaseRef.current !== 'playing') return;
    setGamePhase('roundEnd');
    gamePhaseRef.current = 'roundEnd';
    setRoundWinner(winner);
    SoundManager.playWin();
    HapticManager.celebrationBurst();

    winnerFlash.setValue(1);
    Animated.timing(winnerFlash, { toValue: 0, duration: 600, useNativeDriver: true }).start();

    if (winner === 1) {
      const newWins = p1WinsRef.current + 1;
      p1WinsRef.current = newWins;
      setP1Wins(newWins);
      addEnergy(1, ENERGY_PER_WIN);
    } else {
      const newWins = p2WinsRef.current + 1;
      p2WinsRef.current = newWins;
      setP2Wins(newWins);
      addEnergy(2, ENERGY_PER_WIN);
    }

    const winsNeeded = Math.ceil(totalRoundsRef.current / 2);
    if (p1WinsRef.current >= winsNeeded || p2WinsRef.current >= winsNeeded) {
      setTimeout(() => handleGameOver(), 2000);
    } else {
      setTimeout(() => nextRound(), 2000);
    }
  };

  const nextRound = () => {
    const newRound = roundRef.current + 1;
    roundRef.current = newRound;
    setRound(newRound);
    setCountdown(3);
    setGamePhase('countdown');
    gamePhaseRef.current = 'countdown';
  };

  const handleGameOver = async () => {
    setGamePhase('gameOver');
    gamePhaseRef.current = 'gameOver';
    const overallWinner = p1WinsRef.current > p2WinsRef.current ? 1 : 2;
    await StorageManager.saveDuelResult(overallWinner as 1 | 2);
  };

  // ======== ENERJİ SİSTEMİ ========
  const addEnergy = (player: 1 | 2, amount: number) => {
    if (player === 1) {
      const e = Math.min(p1EnergyRef.current + amount, MAX_ENERGY);
      p1EnergyRef.current = e;
      setP1Energy(e);
    } else {
      const e = Math.min(p2EnergyRef.current + amount, MAX_ENERGY);
      p2EnergyRef.current = e;
      setP2Energy(e);
    }
  };

  const spendEnergy = (player: 1 | 2, amount: number): boolean => {
    const current = player === 1 ? p1EnergyRef.current : p2EnergyRef.current;
    if (current < amount) return false;
    if (player === 1) { p1EnergyRef.current -= amount; setP1Energy(p1EnergyRef.current); }
    else { p2EnergyRef.current -= amount; setP2Energy(p2EnergyRef.current); }
    return true;
  };

  const checkCorrectMove = (player: 1 | 2) => {
    const ref = player === 1 ? p1CorrectMovesRef : p2CorrectMovesRef;
    ref.current += 1;
    if (ref.current >= MOVES_PER_ENERGY) {
      ref.current = 0;
      addEnergy(player, 1);
    }
  };

  // ======== SABOTAJ SİSTEMİ ========
  const applySabotage = useCallback((attacker: 1 | 2, type: SabotageType) => {
    if (gamePhaseRef.current !== 'playing') return;
    const cost = SABOTAGE_TYPES[type].cost;
    if (!spendEnergy(attacker, cost)) return;

    const target: 1 | 2 = attacker === 1 ? 2 : 1;
    sabotagesUsedRef.current += 1;
    HapticManager.mediumTap();

    const alertText = SABOTAGE_TYPES[type].label.toUpperCase() + '!';
    if (target === 1) {
      setP1SabotageAlert(alertText);
      p1SabotageFlash.setValue(1);
      Animated.timing(p1SabotageFlash, { toValue: 0, duration: 1500, useNativeDriver: true }).start();
      setTimeout(() => setP1SabotageAlert(null), 1500);
    } else {
      setP2SabotageAlert(alertText);
      p2SabotageFlash.setValue(1);
      Animated.timing(p2SabotageFlash, { toValue: 0, duration: 1500, useNativeDriver: true }).start();
      setTimeout(() => setP2SabotageAlert(null), 1500);
    }

    if (type === 'shuffle') applyShuffle(target);
    else if (type === 'blackout') applyBlackout(target);
    else if (type === 'freeze') applyFreeze(target);
  }, []);

  const applyShuffle = (target: 1 | 2) => {
    const setLevel = target === 1 ? setP1Level : setP2Level;
    const levelRef = target === 1 ? p1LevelRef : p2LevelRef;
    setLevel(prevLevel => {
      if (!prevLevel) return null;
      const shuffleable = prevLevel.tiles.filter(t =>
        !t.fixed && t.type !== 'blocker' && t.type !== 'source'
      );
      const toShuffle = shuffleable.sort(() => Math.random() - 0.5).slice(0, 3);
      const newTiles = prevLevel.tiles.map(t => {
        const match = toShuffle.find(s => s.id === t.id);
        if (!match) return t;
        if (t.type === 'switch') return { ...t, switchState: !t.switchState };
        return { ...t, rotation: (t.rotation + Math.floor(Math.random() * 3) + 1) % 4 };
      });
      calculatePowerFlow(newTiles);
      const updated = { ...prevLevel, tiles: newTiles, isSolved: isLevelSolved(newTiles) };
      levelRef.current = updated;
      return updated;
    });
  };

  const applyBlackout = (target: 1 | 2) => {
    const dur = SABOTAGE_TYPES.blackout.duration;
    const setBlackout = target === 1 ? setP1Blackout : setP2Blackout;
    const setTimer = target === 1 ? setP1BlackoutTimer : setP2BlackoutTimer;
    setBlackout(true);
    setTimer(Math.ceil(dur / 1000));
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(interval); setBlackout(false); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const applyFreeze = (target: 1 | 2) => {
    const dur = SABOTAGE_TYPES.freeze.duration;
    const setFreeze = target === 1 ? setP1Freeze : setP2Freeze;
    const freezeRef = target === 1 ? p1FreezeRef : p2FreezeRef;
    const setTimer = target === 1 ? setP1FreezeTimer : setP2FreezeTimer;
    setFreeze(true);
    freezeRef.current = true;
    setTimer(Math.ceil(dur / 1000));
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(interval); setFreeze(false); freezeRef.current = false; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ======== TILE PRESS (her iki oyuncu için ortak) ========
  const processTilePress = useCallback((tileId: string, player: 1 | 2) => {
    if (gamePhaseRef.current !== 'playing') return;
    if (player === 1 && p1FreezeRef.current) return;
    if (player === 2 && p2FreezeRef.current) return;

    const levelRef = player === 1 ? p1LevelRef : p2LevelRef;
    const currentLevel = levelRef.current;
    if (!currentLevel || currentLevel.isSolved) return;

    const tile = currentLevel.tiles.find(t => t.id === tileId);
    if (!tile || tile.fixed) return;

    HapticManager.lightTap();
    SoundManager.playClick();

    if (player === 1) { p1MovesRef.current += 1; setP1Moves(p1MovesRef.current); }
    else { p2MovesRef.current += 1; setP2Moves(p2MovesRef.current); }

    const setLevel = player === 1 ? setP1Level : setP2Level;
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
      checkCorrectMove(player);
      if (solved) handleRoundWin(player);
      const updatedLevel = { ...prevLevel, tiles: newTiles, isSolved: solved };
      levelRef.current = updatedLevel;
      return updatedLevel;
    });
  }, []);

  // ======== TOUCH HANDLER: Tek root handler, pageX/pageY ile multi-touch ========
  const handleRootTouch = useCallback((e: GestureResponderEvent) => {
    if (gamePhaseRef.current !== 'playing') return;

    const nativeEvent = e.nativeEvent as any;
    const touches = nativeEvent.changedTouches?.length
      ? Array.from(nativeEvent.changedTouches) as any[]
      : [nativeEvent];

    // Aynı event'te bir oyuncuyu birden fazla işlemekten kaçın
    const processedPlayers = new Set<number>();

    // P1 canvas sınırları (ekran koordinatları)
    // P1: STATUS_BAR_HEIGHT + playerHeader + [ canvas ] + sabotageRow
    const p1CanvasContainerHeight = flexHeight - STATUS_BAR_HEIGHT - playerHeaderHeight - sabotageRowHeight;
    const p1CanvasTop = STATUS_BAR_HEIGHT + playerHeaderHeight;
    const p1CanvasBottom = p1CanvasTop + p1CanvasContainerHeight;

    // P2 canvas sınırları (ekran koordinatları, 180° dönüşüm hesaplı)
    // P2 half: flexHeight + dividerHeight -> SCREEN_HEIGHT
    // 180° döndürülmüş sıra (ekrana göre): sabotageRow | canvas | playerHeader
    const p2HalfTop = flexHeight + dividerHeight;
    const p2CanvasContainerHeight = flexHeight - playerHeaderHeight - sabotageRowHeight;
    const p2CanvasTop = p2HalfTop + sabotageRowHeight;
    const p2CanvasBottom = p2CanvasTop + p2CanvasContainerHeight;

    for (const touch of touches) {
      const { pageX, pageY } = touch;

      let player: 1 | 2 | null = null;
      let canvasX: number = 0;
      let canvasY: number = 0;
      let containerHeight: number = 0;

      if (pageY >= p1CanvasTop && pageY <= p1CanvasBottom) {
        player = 1;
        canvasX = pageX;
        canvasY = pageY - p1CanvasTop;
        containerHeight = p1CanvasContainerHeight;
      } else if (pageY >= p2CanvasTop && pageY <= p2CanvasBottom) {
        player = 2;
        // P2 180° döndürülmüş: koordinatları çevir
        canvasX = SCREEN_WIDTH - pageX;
        canvasY = p2CanvasBottom - pageY;
        containerHeight = p2CanvasContainerHeight;
      }

      if (!player || processedPlayers.has(player)) continue;
      processedPlayers.add(player);

      const levelRef = player === 1 ? p1LevelRef : p2LevelRef;
      const level = levelRef.current;
      if (!level || level.isSolved) continue;

      const cellSize = getCellSize(level);
      const actualCanvasWidth = cellSize * level.cols;
      const actualCanvasHeight = cellSize * level.rows;
      const offsetX = (SCREEN_WIDTH - actualCanvasWidth) / 2;
      const offsetY = (containerHeight - actualCanvasHeight) / 2;

      const col = Math.floor((canvasX - offsetX) / cellSize);
      const row = Math.floor((canvasY - offsetY) / cellSize);

      if (row >= 0 && row < level.rows && col >= 0 && col < level.cols) {
        const tile = level.tiles.find(t => t.position.row === row && t.position.col === col);
        if (tile) processTilePress(tile.id, player);
      }
    }
  }, [processTilePress]);

  // ======== TEKRAR OYNA ========
  const handlePlayAgain = () => {
    setRound(1); roundRef.current = 1;
    setP1Wins(0); setP2Wins(0); p1WinsRef.current = 0; p2WinsRef.current = 0;
    setP1Moves(0); setP2Moves(0); p1MovesRef.current = 0; p2MovesRef.current = 0;
    setP1Energy(0); setP2Energy(0); p1EnergyRef.current = 0; p2EnergyRef.current = 0;
    p1CorrectMovesRef.current = 0; p2CorrectMovesRef.current = 0;
    sabotagesUsedRef.current = 0;
    setSelectedDifficulty(null); selectedDifficultyRef.current = null;
    setGamePhase('setup'); gamePhaseRef.current = 'setup';
  };

  // ======== ENERJİ BARI ========
  const EnergyBar = ({ energy, color }: { energy: number; color: string }) => (
    <View style={styles.energyBar}>
      {Array.from({ length: MAX_ENERGY }).map((_, i) => (
        <View key={i} style={[styles.energyDot, {
          backgroundColor: i < energy ? color : `${color}20`,
          borderColor: `${color}40`,
        }]}>
          {i < energy && <Zap size={7} color="#fff" />}
        </View>
      ))}
    </View>
  );

  // ======== SABOTAJ BUTONU ========
  const SabotageButton = ({ type, player, energy, color }: {
    type: SabotageType; player: 1 | 2; energy: number; color: string;
  }) => {
    const info = SABOTAGE_TYPES[type];
    const canAfford = energy >= info.cost;
    const iconColor = canAfford ? color : `${color}30`;
    const Icon = type === 'shuffle' ? Shuffle : type === 'blackout' ? EyeOff : Snowflake;
    return (
      <Pressable
        style={[styles.sabotageBtn, !canAfford && styles.sabotageBtnDisabled]}
        onPress={() => canAfford && applySabotage(player, type)}
        disabled={!canAfford}
      >
        <Icon size={14} color={iconColor} />
        <Text style={[styles.sabotageCost, { color: iconColor }]}>{info.cost}</Text>
      </Pressable>
    );
  };

  // ======== SETUP EKRANI ========
  if (gamePhase === 'setup') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={[styles.setupContent, { paddingTop: STATUS_BAR_HEIGHT }]}>
          {/* Üst bar: Geri + Round seçimi */}
          <View style={styles.setupTopBar}>
            <Pressable
              style={({ pressed }) => [styles.setupBackBtn, pressed && styles.btnPressed]}
              onPress={onBack}
            >
              <ArrowLeft size={20} color={DUEL_COLOR} />
            </Pressable>
            <View style={styles.roundPill}>
              <Pressable
                style={[styles.roundPillOption, totalRounds === 3 && styles.roundPillOptionActive]}
                onPress={() => { setTotalRounds(3); totalRoundsRef.current = 3; }}
              >
                <Text style={[styles.roundPillText, totalRounds === 3 && styles.roundPillTextActive]}>BO3</Text>
              </Pressable>
              <Pressable
                style={[styles.roundPillOption, totalRounds === 5 && styles.roundPillOptionActive]}
                onPress={() => { setTotalRounds(5); totalRoundsRef.current = 5; }}
              >
                <Text style={[styles.roundPillText, totalRounds === 5 && styles.roundPillTextActive]}>BO5</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.setupHeader}>
            <Users size={28} color={DUEL_COLOR} />
            <Text style={styles.setupTitle}>DÜELLO</Text>
            <Text style={styles.setupSubtitle}>Zorluk Seçin</Text>
          </View>

          <View style={styles.difficultyGrid}>
            {DIFFICULTY_PRESETS.map((preset, index) => (
              <Pressable
                key={preset.key}
                style={({ pressed }) => [
                  styles.difficultyCard,
                  { borderColor: `${preset.color}30` },
                  pressed && styles.btnPressed,
                ]}
                onPress={() => handleSelectDifficulty(index)}
              >
                <Pressable
                  style={[styles.previewContainer, { backgroundColor: `${preset.color}08` }]}
                  onPress={() => setPreviewModalIndex(index)}
                >
                  {previewLevels[index] && (
                    <View pointerEvents="none" style={styles.previewCanvas}>
                      <CircuitCanvas
                        level={previewLevels[index]}
                        onTilePress={() => { }}
                        containerWidth={SCREEN_WIDTH * 0.35}
                        maxHeight={80}
                        strokeScale={0.5}
                      />
                    </View>
                  )}
                </Pressable>
                <View style={styles.difficultyInfo}>
                  <Text style={[styles.difficultyLabel, { color: preset.color }]}>{preset.label}</Text>
                  <Text style={[styles.difficultySublabel, { color: `${preset.color}80` }]}>{preset.sublabel}</Text>
                </View>
                <ChevronRight size={16} color={`${preset.color}40`} />
              </Pressable>
            ))}
          </View>
        </View>

        <Modal visible={previewModalIndex !== null} transparent animationType="fade" onRequestClose={() => setPreviewModalIndex(null)}>
          <Pressable style={styles.previewModalOverlay} onPress={() => setPreviewModalIndex(null)}>
            <View style={styles.previewModalContent}>
              {previewModalIndex !== null && previewLevels[previewModalIndex] && (
                <>
                  <Text style={[styles.previewModalTitle, { color: DIFFICULTY_PRESETS[previewModalIndex].color }]}>
                    {DIFFICULTY_PRESETS[previewModalIndex].label} ({DIFFICULTY_PRESETS[previewModalIndex].sublabel})
                  </Text>
                  <View pointerEvents="none">
                    <CircuitCanvas level={previewLevels[previewModalIndex]} onTilePress={() => { }} containerWidth={SCREEN_WIDTH - 64} strokeScale={0.8} />
                  </View>
                  <Text style={styles.previewModalHint}>Kapatmak için dokunun</Text>
                </>
              )}
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // ======== GERİ SAYIM EKRANI ========
  if (gamePhase === 'countdown') {
    const preset = selectedDifficulty !== null ? DIFFICULTY_PRESETS[selectedDifficulty] : null;
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.countdownContainer}>
            <Text style={styles.roundLabel}>ROUND {round}</Text>
            <Text style={styles.countdownText}>{countdown > 0 ? countdown : 'BAŞLA!'}</Text>
            {preset && (
              <Text style={[styles.countdownSubtext, { color: `${preset.color}80` }]}>
                {preset.label} ({preset.sublabel})
              </Text>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!p1Level || !p2Level) {
    return <View style={styles.container}><StatusBar style="dark" /></View>;
  }

  const overallWinner = p1Wins > p2Wins ? 1 : 2;
  const currentTotalRounds = totalRoundsRef.current;

  // ======== OYUN EKRANI ========
  return (
    <View style={styles.container} onTouchEnd={handleRootTouch}>
      <StatusBar style="dark" />

      {/* Flash efekti */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        backgroundColor: DUEL_COLOR,
        opacity: winnerFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }),
        zIndex: 90,
      }]} />

      {/* ÜST YARI - Oyuncu 1 */}
      <View style={[styles.playerHalf, { paddingTop: STATUS_BAR_HEIGHT }]}>
        <View style={styles.playerHeader}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            onPress={onBack}
          >
            <ArrowLeft size={18} color={DUEL_COLOR} />
          </Pressable>
          <View style={styles.playerInfo}>
            <Text style={styles.playerLabel}>OYUNCU 1</Text>
            <View style={styles.statsRow}>
              <Text style={styles.moveText}>{p1Moves} hamle</Text>
              <View style={styles.winsContainer}>
                {Array.from({ length: currentTotalRounds }).map((_, i) => (
                  <View key={i} style={[styles.winDot, i < p1Wins && styles.winDotActive]} />
                ))}
              </View>
            </View>
          </View>
          <EnergyBar energy={p1Energy} color={DUEL_COLOR} />
          <View style={styles.roundBadge}>
            <Text style={styles.roundBadgeText}>R{round}</Text>
          </View>
        </View>

        {/* P1 Canvas */}
        <View style={styles.canvasContainer}>
          <View pointerEvents="none">
            <CircuitCanvas
              level={p1Level}
              onTilePress={() => { }}
              isSolved={p1Level.isSolved}
              maxHeight={canvasMaxHeight}
              blackout={p1Blackout}
            />
          </View>
        </View>

        {/* P1 Sabotaj overlay'ler */}
        {p1Freeze && (
          <View pointerEvents="none" style={[styles.effectOverlay, { backgroundColor: 'rgba(100,180,255,0.25)' }]}>
            <Snowflake size={40} color="rgba(100,180,255,0.8)" />
            <Text style={styles.effectTimerText}>{p1FreezeTimer}</Text>
          </View>
        )}
        {p1Blackout && (
          <View pointerEvents="none" style={[styles.effectTimerBadge, { top: playerHeaderHeight + STATUS_BAR_HEIGHT + 4 }]}>
            <EyeOff size={12} color="rgba(0,0,0,0.6)" />
            <Text style={styles.effectTimerBadgeText}>{p1BlackoutTimer}</Text>
          </View>
        )}
        {p1SabotageAlert && (
          <Animated.View pointerEvents="none" style={[styles.sabotageAlertOverlay, { opacity: p1SabotageFlash }]}>
            <Text style={styles.sabotageAlertText}>{p1SabotageAlert}</Text>
          </Animated.View>
        )}
        {/* P1 Sabotaj Butonları - playerHalf içinde, overlay kapsamında */}
        <View style={styles.sabotageRow}>
          <SabotageButton type="shuffle" player={1} energy={p1Energy} color={DUEL_COLOR} />
          <SabotageButton type="blackout" player={1} energy={p1Energy} color={DUEL_COLOR} />
          <SabotageButton type="freeze" player={1} energy={p1Energy} color={DUEL_COLOR} />
        </View>

      </View>

      {/* ORTA BÖLÜCÜ - Sadece VS */}
      <View style={styles.divider}>
        <View style={styles.dividerCenter}>
          <View style={styles.dividerLine} />
          <View style={styles.vsContainer}><Text style={styles.vsText}>VS</Text></View>
          <View style={styles.dividerLine} />
        </View>
      </View>

      {/* ALT YARI - Oyuncu 2 (180° döndürülmüş) */}
      <View style={[styles.playerHalf, { transform: [{ rotate: '180deg' }] }]}>
        <View style={styles.playerHeader}>
          <View style={styles.backBtnPlaceholder} />
          <View style={styles.playerInfo}>
            <Text style={[styles.playerLabel, styles.p2Label]}>OYUNCU 2</Text>
            <View style={styles.statsRow}>
              <Text style={styles.moveText}>{p2Moves} hamle</Text>
              <View style={styles.winsContainer}>
                {Array.from({ length: currentTotalRounds }).map((_, i) => (
                  <View key={i} style={[styles.winDot, i < p2Wins && styles.winDotActiveP2]} />
                ))}
              </View>
            </View>
          </View>
          <EnergyBar energy={p2Energy} color={P2_COLOR} />
          <View style={[styles.roundBadge, styles.roundBadgeP2]}>
            <Text style={[styles.roundBadgeText, { color: P2_COLOR }]}>R{round}</Text>
          </View>
        </View>

        {/* P2 Canvas */}
        <View style={styles.canvasContainer}>
          <View pointerEvents="none">
            <CircuitCanvas
              level={p2Level}
              onTilePress={() => { }}
              isSolved={p2Level.isSolved}
              maxHeight={canvasMaxHeight}
              blackout={p2Blackout}
            />
          </View>
        </View>

        {/* P2 Sabotaj overlay'ler */}
        {p2Freeze && (
          <View pointerEvents="none" style={[styles.effectOverlay, { backgroundColor: 'rgba(100,180,255,0.25)' }]}>
            <Snowflake size={40} color="rgba(100,180,255,0.8)" />
            <Text style={styles.effectTimerText}>{p2FreezeTimer}</Text>
          </View>
        )}
        {p2Blackout && (
          <View pointerEvents="none" style={[styles.effectTimerBadge, { top: playerHeaderHeight + 4 }]}>
            <EyeOff size={12} color="rgba(0,0,0,0.6)" />
            <Text style={styles.effectTimerBadgeText}>{p2BlackoutTimer}</Text>
          </View>
        )}
        {p2SabotageAlert && (
          <Animated.View pointerEvents="none" style={[styles.sabotageAlertOverlay, { opacity: p2SabotageFlash }]}>
            <Text style={styles.sabotageAlertText}>{p2SabotageAlert}</Text>
          </Animated.View>
        )}

        {/* P2 Sabotaj Butonları - playerHalf içinde, overlay kapsamında */}
        <View style={styles.sabotageRow}>
          <SabotageButton type="shuffle" player={2} energy={p2Energy} color={P2_COLOR} />
          <SabotageButton type="blackout" player={2} energy={p2Energy} color={P2_COLOR} />
          <SabotageButton type="freeze" player={2} energy={p2Energy} color={P2_COLOR} />
        </View>

      </View>

      {/* KAZANDI OVERLAY - Ekranın tam yarısını kapsar (divider dahil) */}
      {roundWinner && gamePhase === 'roundEnd' && (
        <View
          pointerEvents="none"
          style={[
            styles.winOverlay,
            roundWinner === 1
              ? { top: 0, height: flexHeight + dividerHeight }
              : { bottom: 0, height: flexHeight + dividerHeight },
          ]}
        >
          <View style={roundWinner === 2 ? { transform: [{ rotate: '180deg' }] } : undefined}>
            <Text style={styles.winOverlayText}>KAZANDI!</Text>
          </View>
        </View>
      )}

      {/* GAME OVER MODAL */}
      <Modal visible={gamePhase === 'gameOver'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.trophyContainer}>
              <Trophy size={32} color={DUEL_COLOR} />
            </View>
            <Text style={styles.gameOverTitle}>Oyuncu {overallWinner} Kazandı!</Text>
            <View style={styles.finalScoreContainer}>
              <View style={styles.finalScorePlayer}>
                <Text style={styles.finalScoreLabel}>OYUNCU 1</Text>
                <Text style={[styles.finalScoreValue, overallWinner === 1 && styles.finalScoreWinner]}>{p1Wins}</Text>
              </View>
              <Text style={styles.finalScoreDash}>-</Text>
              <View style={styles.finalScorePlayer}>
                <Text style={styles.finalScoreLabel}>OYUNCU 2</Text>
                <Text style={[styles.finalScoreValue, overallWinner === 2 && styles.finalScoreWinner]}>{p2Wins}</Text>
              </View>
            </View>
            {sabotagesUsedRef.current > 0 && (
              <Text style={styles.sabotageStatText}>Toplam {sabotagesUsedRef.current} sabotaj kullanıldı</Text>
            )}
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.playAgainBtn, pressed && styles.btnPressed]}
                onPress={handlePlayAgain}
              >
                <RotateCcw size={18} color="#fff" />
                <Text style={styles.playAgainText}>Tekrar Oyna</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.menuBtn, pressed && styles.btnPressed]}
                onPress={onBack}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { flex: 1 },
  btnPressed: { opacity: 0.5 },

  // ======== SETUP ========
  setupContent: { flex: 1, paddingHorizontal: 24 },
  setupTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  setupBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(123,94,167,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  roundPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(123,94,167,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.12)',
    overflow: 'hidden',
  },
  roundPillOption: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  roundPillOptionActive: {
    backgroundColor: DUEL_COLOR,
  },
  roundPillText: {
    fontSize: 13, fontWeight: '700',
    color: 'rgba(123,94,167,0.4)',
  },
  roundPillTextActive: { color: '#fff' },
  setupHeader: {
    alignItems: 'center',
    marginTop: 20, marginBottom: 20,
  },
  setupTitle: {
    fontSize: 32, fontWeight: '700', color: DUEL_COLOR,
    letterSpacing: 6, marginTop: 12,
  },
  setupSubtitle: {
    fontSize: 16, fontWeight: '500',
    color: 'rgba(123,94,167,0.5)', marginTop: 8,
  },
  difficultyGrid: { gap: 12 },
  difficultyCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, padding: 12, gap: 12,
  },
  previewContainer: {
    width: SCREEN_WIDTH * 0.35, height: 80,
    borderRadius: 10, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  previewCanvas: { opacity: 0.5 },
  difficultyInfo: { flex: 1 },
  difficultyLabel: { fontSize: 18, fontWeight: '700' },
  difficultySublabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  // ======== GERİ SAYIM ========
  countdownContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  roundLabel: { fontSize: 16, fontWeight: '700', color: DUEL_COLOR, letterSpacing: 4, marginBottom: 12 },
  countdownText: { fontSize: 72, fontWeight: '200', color: DUEL_COLOR },
  countdownSubtext: { fontSize: 16, fontWeight: '600', marginTop: 16, letterSpacing: 2 },

  // ======== OYUN EKRANI ========
  playerHalf: { flex: 1, overflow: 'hidden' },
  playerHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, height: 40,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(123,94,167,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnPlaceholder: { width: 32, height: 32 },
  playerInfo: { flex: 1, marginLeft: 10 },
  playerLabel: { fontSize: 11, fontWeight: '800', color: DUEL_COLOR, letterSpacing: 2 },
  p2Label: { color: P2_COLOR },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moveText: { fontSize: 11, fontWeight: '600', color: 'rgba(107,123,58,0.4)', fontVariant: ['tabular-nums'] },
  winsContainer: { flexDirection: 'row', gap: 4 },
  winDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(123,94,167,0.15)' },
  winDotActive: { backgroundColor: DUEL_COLOR },
  winDotActiveP2: { backgroundColor: P2_COLOR },
  roundBadge: {
    backgroundColor: 'rgba(123,94,167,0.1)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, marginLeft: 6,
  },
  roundBadgeP2: { backgroundColor: 'rgba(193,122,58,0.1)' },
  roundBadgeText: { fontSize: 11, fontWeight: '700', color: DUEL_COLOR },
  canvasContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'visible',
  },

  // ======== ENERJİ ========
  energyBar: { flexDirection: 'row', gap: 3, marginRight: 6 },
  energyDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },

  // ======== BÖLÜCÜ & SABOTAJ ========
  divider: { height: 26, paddingHorizontal: 12, justifyContent: 'center' },
  dividerCenter: { flexDirection: 'row', alignItems: 'center', height: 26 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(123,94,167,0.2)' },
  vsContainer: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(123,94,167,0.1)',
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 6,
  },
  vsText: { fontSize: 10, fontWeight: '800', color: DUEL_COLOR, letterSpacing: 1 },
  sabotageRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, height: 28, alignItems: 'center' },
  sabotageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: 'rgba(123,94,167,0.06)',
  },
  sabotageBtnDisabled: { opacity: 0.4 },
  sabotageCost: { fontSize: 10, fontWeight: '800' },

  // ======== SABOTAJ EFEKT OVERLAY'LER ========
  effectOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', zIndex: 80,
  },
  effectTimerText: { fontSize: 32, fontWeight: '800', color: 'rgba(100,180,255,0.9)', marginTop: 8 },
  effectTimerBadge: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, zIndex: 85,
  },
  effectTimerBadgeText: { fontSize: 12, fontWeight: '700', color: 'rgba(0,0,0,0.5)' },
  sabotageAlertOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(184,70,52,0.15)', zIndex: 88,
  },
  sabotageAlertText: { fontSize: 28, fontWeight: '900', color: '#B84634', letterSpacing: 4 },

  // ======== WIN OVERLAY ========
  winOverlay: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: 'rgba(123,94,167,0.15)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 80,
  },
  winOverlayText: { fontSize: 28, fontWeight: '800', color: DUEL_COLOR, letterSpacing: 4 },

  // ======== GAME OVER MODAL ========
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: COLORS.background, borderRadius: 24, padding: 32,
    width: '100%', maxWidth: 340, alignItems: 'center',
  },
  trophyContainer: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(123,94,167,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  gameOverTitle: { fontSize: 26, fontWeight: '300', color: DUEL_COLOR, marginBottom: 24 },
  finalScoreContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 16 },
  finalScorePlayer: { alignItems: 'center' },
  finalScoreLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(107,123,58,0.4)',
    letterSpacing: 1, marginBottom: 4,
  },
  finalScoreValue: {
    fontSize: 40, fontWeight: '700', color: 'rgba(107,123,58,0.3)', fontVariant: ['tabular-nums'],
  },
  finalScoreWinner: { color: DUEL_COLOR },
  finalScoreDash: { fontSize: 28, fontWeight: '300', color: 'rgba(107,123,58,0.2)', marginTop: 16 },
  sabotageStatText: { fontSize: 13, fontWeight: '600', color: 'rgba(123,94,167,0.5)', marginBottom: 20 },
  modalButtons: { width: '100%', gap: 10 },
  modalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, gap: 8,
  },
  playAgainBtn: { backgroundColor: DUEL_COLOR },
  playAgainText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  menuBtn: { backgroundColor: 'rgba(123,94,167,0.08)' },
  menuBtnText: { fontSize: 16, fontWeight: '600', color: DUEL_COLOR },

  // ======== PREVIEW MODAL ========
  previewModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  previewModalContent: {
    backgroundColor: COLORS.background, borderRadius: 24, padding: 24,
    alignItems: 'center', maxWidth: SCREEN_WIDTH - 32,
  },
  previewModalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, letterSpacing: 1 },
  previewModalHint: { fontSize: 13, fontWeight: '500', color: 'rgba(107,123,58,0.4)', marginTop: 16 },
});
