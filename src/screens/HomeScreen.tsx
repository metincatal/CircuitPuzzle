import React, { useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing,
  Dimensions, Platform, SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Zap, Timer, Users, ChevronRight } from 'lucide-react-native';
import { COLORS } from '../components/CircuitCanvas';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HomeScreenProps {
  onSelectMode: (mode: 'classic' | 'speed' | 'duel') => void;
  lastClassicLevel: number;
  speedHighScore: number;
  speedBestWave: number;
}

const formatScore = (s: number): string =>
  s.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectMode,
  lastClassicLevel,
  speedHighScore,
  speedBestWave,
}) => {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(-20)).current;
  const card1Opacity = useRef(new Animated.Value(0)).current;
  const card1TranslateY = useRef(new Animated.Value(40)).current;
  const card2Opacity = useRef(new Animated.Value(0)).current;
  const card2TranslateY = useRef(new Animated.Value(40)).current;
  const card3Opacity = useRef(new Animated.Value(0)).current;
  const card3TranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Giriş animasyonları
    Animated.sequence([
      // Başlık
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Kartlar
      Animated.stagger(150, [
        Animated.parallel([
          Animated.timing(card1Opacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(card1TranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(card2Opacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(card2TranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(card3Opacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(card3TranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        {/* BAŞLIK */}
        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          <Text style={styles.titleMain}>CIRCUIT</Text>
          <Text style={styles.titleSub}>PUZZLE</Text>
          <View style={styles.titleLine} />
        </Animated.View>

        {/* MOD KARTLARI */}
        <View style={styles.cardsContainer}>
          {/* KLASİK MOD */}
          <Animated.View
            style={{
              opacity: card1Opacity,
              transform: [{ translateY: card1TranslateY }],
            }}
          >
            <Pressable
              style={({ pressed }) => [
                styles.card,
                styles.classicCard,
                pressed && styles.cardPressed,
              ]}
              onPress={() => onSelectMode('classic')}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                  <Zap size={24} color={COLORS.active} />
                </View>
                <Text style={styles.cardTitle}>Klasik</Text>
                <ChevronRight size={20} color="rgba(107,123,58,0.4)" style={styles.cardArrow} />
              </View>
              <Text style={styles.cardDescription}>
                Bulmacaları kendi hızında çöz.{'\n'}
                4000+ seviye seni bekliyor.
              </Text>
              {lastClassicLevel > 1 && (
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>
                    Seviye {lastClassicLevel}
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* ZAMANA KARŞI MOD */}
          <Animated.View
            style={{
              opacity: card2Opacity,
              transform: [{ translateY: card2TranslateY }],
            }}
          >
            <Pressable
              style={({ pressed }) => [
                styles.card,
                styles.speedCard,
                pressed && styles.cardPressed,
              ]}
              onPress={() => onSelectMode('speed')}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconContainer, styles.speedIconContainer]}>
                  <Timer size={24} color="#C17A3A" />
                </View>
                <Text style={[styles.cardTitle, styles.speedCardTitle]}>Zamana Karşı</Text>
                <ChevronRight size={20} color="rgba(193,122,58,0.4)" style={styles.cardArrow} />
              </View>
              <Text style={[styles.cardDescription, styles.speedCardDescription]}>
                Dalga dalga artan zorluk.{'\n'}
                Cesur ol, risk al!
              </Text>
              {speedBestWave > 0 && (
                <View style={[styles.cardFooter, styles.speedCardFooter]}>
                  <Text style={[styles.cardFooterText, styles.speedFooterText]}>
                    Dalga {speedBestWave} — {formatScore(speedHighScore)}
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
          {/* DÜELLO MOD */}
          <Animated.View
            style={{
              opacity: card3Opacity,
              transform: [{ translateY: card3TranslateY }],
            }}
          >
            <Pressable
              style={({ pressed }) => [
                styles.card,
                styles.duelCard,
                pressed && styles.cardPressed,
              ]}
              onPress={() => onSelectMode('duel')}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconContainer, styles.duelIconContainer]}>
                  <Users size={24} color="#7B5EA7" />
                </View>
                <Text style={[styles.cardTitle, styles.duelCardTitle]}>Düello</Text>
                <ChevronRight size={20} color="rgba(123,94,167,0.4)" style={styles.cardArrow} />
              </View>
              <Text style={[styles.cardDescription, styles.duelCardDescription]}>
                Aynı cihazda 2 kişi yarışın.{'\n'}
                Sabotajlarla rakibini engelle!
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Başlık
  titleContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  titleMain: {
    fontSize: 42,
    fontWeight: '300',
    color: COLORS.active,
    letterSpacing: 12,
  },
  titleSub: {
    fontSize: 42,
    fontWeight: '700',
    color: COLORS.active,
    letterSpacing: 8,
    marginTop: -4,
  },
  titleLine: {
    width: 60,
    height: 2,
    backgroundColor: COLORS.active,
    marginTop: 16,
    opacity: 0.3,
  },
  // Kartlar
  cardsContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    paddingBottom: 18,
  },
  classicCard: {
    backgroundColor: 'rgba(107,123,58,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(107,123,58,0.12)',
  },
  speedCard: {
    backgroundColor: 'rgba(193,122,58,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(193,122,58,0.12)',
  },
  duelCard: {
    backgroundColor: 'rgba(123,94,167,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.12)',
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(107,123,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  speedIconContainer: {
    backgroundColor: 'rgba(193,122,58,0.12)',
  },
  duelIconContainer: {
    backgroundColor: 'rgba(123,94,167,0.12)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.active,
    flex: 1,
  },
  speedCardTitle: {
    color: '#C17A3A',
  },
  duelCardTitle: {
    color: '#7B5EA7',
  },
  cardArrow: {
    marginLeft: 8,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(107,123,58,0.6)',
    marginLeft: 52,
  },
  speedCardDescription: {
    color: 'rgba(193,122,58,0.6)',
  },
  duelCardDescription: {
    color: 'rgba(123,94,167,0.6)',
  },
  cardFooter: {
    marginTop: 12,
    marginLeft: 52,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107,123,58,0.1)',
  },
  speedCardFooter: {
    borderTopColor: 'rgba(193,122,58,0.1)',
  },
  cardFooterText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(107,123,58,0.5)',
    fontVariant: ['tabular-nums'],
  },
  speedFooterText: {
    color: 'rgba(193,122,58,0.5)',
  },
});
