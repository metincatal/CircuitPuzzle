import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, SafeAreaView, Dimensions, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Zap, Play, RotateCcw, X, Clock } from 'lucide-react-native';

import { CircuitCanvas } from './src/components/CircuitCanvas';
import { Starfield } from './src/components/Starfield';
import SoundManager from './src/utils/SoundManager';
import {
  Level,
  generateGridLevel,
  calculatePowerFlow,
  isLevelSolved,
} from './src/types/circuit';

const { width, height } = Dimensions.get('window');

// --- ŞIK WIN MODAL (Kapatılabilir) ---
const WinModal = ({ moves, timeStr, onNextLevel, onRetry, onClose }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.modalOverlay}>
      <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
        {/* Kapat Butonu */}
        <Pressable style={styles.closeButton} onPress={onClose}>
          <X size={24} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <View style={styles.successIconContainer}>
          <Zap size={40} color="#2ecc71" fill="#2ecc71" />
        </View>

        <Text style={styles.modalTitle}>LEVEL COMPLETE</Text>

        {/* Skorlar: Süre ön planda */}
        <View style={styles.scoreRow}>
          <Clock size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.modalScore}>{timeStr}</Text>
        </View>

        <View style={styles.modalLine} />

        <Pressable
          style={({ pressed }) => [styles.btnNext, pressed && styles.btnPressed]}
          onPress={onNextLevel}
        >
          <Text style={styles.btnNextText}>SONRAKİ BÖLÜM</Text>
          <Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 10 }} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnRetry, pressed && styles.btnPressed]}
          onPress={onRetry}
        >
          <RotateCcw size={16} color="rgba(255,255,255,0.5)" />
          <Text style={styles.btnRetryText}>TEKRAR OYNA</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

export default function App() {
  const [level, setLevel] = useState<Level | null>(null);

  // Başlangıç Level'ını Sakla (Reset için)
  const [initialTiles, setInitialTiles] = useState<any[]>([]);

  // Timer State
  const [seconds, setSeconds] = useState(0);
  const [isActiveTimer, setIsActiveTimer] = useState(false);

  // Modal State
  const [showWinModal, setShowWinModal] = useState(false);

  useEffect(() => {
    SoundManager.loadSounds();
  }, []);

  useEffect(() => {
    startNewLevel();
  }, []);

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActiveTimer) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else if (!isActiveTimer && seconds !== 0) {
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActiveTimer]);

  // Format Timer (MM:SS)
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Level Win Logic
  useEffect(() => {
    if (level?.isSolved) {
      setIsActiveTimer(false); // Süreyi Durdur
      SoundManager.playWin();

      // 2 Saniye Gecikmeli Modal
      const timer = setTimeout(() => {
        setShowWinModal(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [level?.isSolved]);

  const startNewLevel = () => {
    setShowWinModal(false);
    const newLevel = generateGridLevel();

    // Yeni Level'ı ve Initial State'i kaydet (Deep Copy önemli)
    setLevel(newLevel);
    setInitialTiles(JSON.parse(JSON.stringify(newLevel.tiles)));

    // Timer Sıfırla ve Başlat
    setSeconds(0);
    setIsActiveTimer(true);
  };

  // SIFIRLA (RESET) Fonksiyonu
  const handleReset = () => {
    if (!level || initialTiles.length === 0) return;

    setShowWinModal(false); // Modalı kapa

    // Mevcut tile'ları initial state'e döndür
    // Ancak level objesinin diğer özellikleri (rows, cols) aynı kalmalı
    // Deep copy ile state'e ata ki referans sorunu olmasın
    const resetTiles = JSON.parse(JSON.stringify(initialTiles));

    // Güç akışını başlangıç haline göre tekrar hesapla (belki gerekmez ama güvenli)
    calculatePowerFlow(resetTiles);

    setLevel({
      ...level,
      tiles: resetTiles,
      isSolved: false // Çözülmemiş hale dön
    });

    // Timer'ı Sıfırla
    setSeconds(0);
    setIsActiveTimer(true);
  };

  const handleTilePress = useCallback((tileId: string) => {
    if (!level || level.isSolved) return;

    SoundManager.playClick();

    setLevel(prevLevel => {
      if (!prevLevel) return null;

      const newTiles = prevLevel.tiles.map(tile => {
        if (tile.id === tileId) {
          return {
            ...tile,
            rotation: (tile.rotation + 1) % 4
          };
        }
        return tile;
      });

      calculatePowerFlow(newTiles);

      return {
        ...prevLevel,
        tiles: newTiles,
        isSolved: isLevelSolved(newTiles)
      };
    });
  }, [level]);

  if (!level) return <View style={styles.loading}><Text style={{ color: '#fff' }}>Yükleniyor...</Text></View>;

  return (
    <LinearGradient
      colors={['#0b1021', '#1a2a3a', '#2c5364']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />
      <Starfield />

      <SafeAreaView style={styles.safeArea}>

        {/* HEADER: Sadeleştirilmiş */}
        <View style={styles.header}>
          {/* Timer Rozeti */}
          <View style={[styles.timerBadge, level.isSolved && styles.timerBadgeSuccess]}>
            <Clock size={14} color={level.isSolved ? "#2ecc71" : "rgba(255,255,255,0.6)"} />
            <Text style={[styles.timerText, level.isSolved && { color: '#2ecc71' }]}>
              {formatTime(seconds)}
            </Text>
          </View>
        </View>

        {/* GAME CANVAS */}
        <View style={[
          styles.canvasContainer,
          { shadowOpacity: level.isSolved ? 0.6 : 0.1 }
        ]}>
          <CircuitCanvas
            level={level}
            onTilePress={handleTilePress}
          />
        </View>

        {/* FOOTER & CONTROLS */}
        <View style={styles.footer}>
          {/* Oyun Devam Ediyorsa */}
          {!level.isSolved && (
            <>
              <Text style={styles.instruction}>
                Akışı sağlamak için parçaları döndür.
              </Text>

              {/* SIFIRLA BUTONU */}
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleReset}
              >
                <RotateCcw size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>SIFIRLA</Text>
              </Pressable>
            </>
          )}

          {/* Oyun Bitti ve Modal Kapalıysa -> Alt Buton Grubu */}
          {level.isSolved && !showWinModal && (
            <View style={styles.winControls}>
              <Pressable
                style={({ pressed }) => [styles.btnRetrySmall, pressed && styles.buttonPressed]}
                onPress={handleReset}
              >
                <RotateCcw size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.btnNextWide, pressed && styles.buttonPressed]}
                onPress={startNewLevel}
              >
                <Text style={styles.btnNextWideText}>SONRAKİ BÖLÜM</Text>
                <Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 8 }} />
              </Pressable>
            </View>
          )}
        </View>

      </SafeAreaView>

      {/* WIN MODAL OVERLAY */}
      {showWinModal && (
        <WinModal
          moves={0}
          timeStr={formatTime(seconds)}
          onNextLevel={startNewLevel}
          onRetry={handleReset} // Modal içinden de reset çağrılıyor
          onClose={() => setShowWinModal(false)}
        />
      )}

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: '#0f2027',
    alignItems: 'center',
    justifyContent: 'center'
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'android' ? 40 : 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    width: '100%',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  timerBadgeSuccess: {
    borderColor: '#2ecc71',
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
  },
  timerText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  canvasContainer: {
    shadowColor: '#00fff2',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 50,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  instruction: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  buttonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  buttonPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    opacity: 0.8,
  },

  // --- WIN CONTROLS (Footer) ---
  winControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  btnRetrySmall: {
    width: 50, height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  btnNextWide: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  btnNextWideText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },

  // --- MODAL SYTLES ---
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: 'rgba(15, 23, 35, 0.95)',
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#00fff2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
  successIconContainer: {
    width: 70, height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginBottom: 20,
  },
  modalScore: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  modalLine: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 25,
  },
  btnNext: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    width: '100%',
    justifyContent: 'center',
  },
  btnNextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  btnRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  btnRetryText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginLeft: 5,
  },
});
