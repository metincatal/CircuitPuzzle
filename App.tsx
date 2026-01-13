import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CircuitCanvas } from './src/components/CircuitCanvas';
import {
  Level,
  generateGridLevel,
  calculatePowerFlow,
  isLevelSolved,
} from './src/types/circuit';

export default function App() {
  const [level, setLevel] = useState<Level | null>(null);
  const [moveCount, setMoveCount] = useState(0);

  useEffect(() => {
    startNewLevel();
  }, []);

  const startNewLevel = () => {
    const newLevel = generateGridLevel();
    setLevel(newLevel);
    setMoveCount(0);
  };

  const handleTilePress = useCallback((tileId: string) => {
    if (!level) return;

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

    setMoveCount(prev => prev + 1);
  }, [level]);

  if (!level) return <View style={styles.loading}><Text style={{ color: '#fff' }}>Yükleniyor...</Text></View>;

  return (
    <LinearGradient
      colors={['#0f2027', '#203a43', '#2c5364']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <Text style={styles.title}>NEON FLOW</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{level.isSolved ? 'TAMAMLANDI' : `HAMLE: ${moveCount}`}</Text>
          </View>
        </View>

        {/* Dinamik stil buraya eklendi */}
        <View style={[
          styles.canvasContainer,
          { shadowOpacity: level.isSolved ? 0.3 : 0.1 }
        ]}>
          <CircuitCanvas
            level={level}
            onTilePress={handleTilePress}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.instruction}>
            Enerjiyi lambalara ulaştırmak için dokunun.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed
            ]}
            onPress={startNewLevel}
          >
            <Text style={styles.buttonText}>YENİ AKIŞ</Text>
          </Pressable>
        </View>

      </SafeAreaView>
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
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '200',
    color: '#ffffff',
    letterSpacing: 6,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '600'
  },
  canvasContainer: {
    shadowColor: '#00fff2',
    shadowOffset: { width: 0, height: 0 },
    // shadowOpacity burada kaldırıldı
    shadowRadius: 40,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  instruction: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  }
});
