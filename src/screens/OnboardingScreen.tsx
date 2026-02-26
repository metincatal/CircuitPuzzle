import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing,
  SafeAreaView, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { COLORS } from '../components/CircuitCanvas';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingScreenProps {
  onDone: () => void;
}

// ─── Slayt 1: Dönen tile animasyonu ──────────────────────────────────────────
const RotatingTileDemo: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;
  const tapOpacity = useRef(new Animated.Value(0)).current;

  const TILE = 110;
  const H = TILE / 2;
  const S = 8;

  useEffect(() => {
    let cancelled = false;

    const loop = () => {
      if (cancelled) return;

      rotation.setValue(0);
      setIsConnected(false);
      tapOpacity.setValue(0);
      tapScale.setValue(1);

      Animated.sequence([
        Animated.delay(700),
        // Tap göster
        Animated.timing(tapOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        // Tile'a bas
        Animated.timing(tapScale, { toValue: 0.88, duration: 100, useNativeDriver: true }),
        Animated.timing(tapScale, { toValue: 1, duration: 100, useNativeDriver: true }),
        // Döndür
        Animated.timing(rotation, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Tap gizle
        Animated.timing(tapOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.delay(1100),
      ]).start(() => {
        if (!cancelled) {
          setIsConnected(true);
          setTimeout(() => { if (!cancelled) loop(); }, 300);
        }
      });

      // Rengi rotation ortasında değiştir
      setTimeout(() => {
        if (!cancelled) setIsConnected(true);
      }, 700 + 480 + 380);
    };

    loop();
    return () => { cancelled = true; };
  }, []);

  const rotateDeg = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const color = isConnected ? COLORS.active : COLORS.passive;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Ana tile */}
      <Animated.View style={{ transform: [{ scale: tapScale }, { rotate: rotateDeg }] }}>
        <Svg width={TILE} height={TILE}>
          <Rect
            x={4} y={4} width={TILE - 8} height={TILE - 8} rx={16}
            fill={isConnected ? 'rgba(107,123,58,0.13)' : 'rgba(196,186,168,0.25)'}
          />
          {/* Sağ bağlantı */}
          <Path
            d={`M ${H} ${H} L ${TILE} ${H}`}
            stroke={color} strokeWidth={S} strokeLinecap="round"
          />
          {/* Alt bağlantı */}
          <Path
            d={`M ${H} ${H} L ${H} ${TILE}`}
            stroke={color} strokeWidth={S} strokeLinecap="round"
          />
          <Circle cx={H} cy={H} r={S / 2 + 1} fill={color} />
        </Svg>
      </Animated.View>

      {/* Tap indicator */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -8,
          bottom: -8,
          opacity: tapOpacity,
        }}
      >
        <View style={styles.tapRing}>
          <View style={styles.tapDot} />
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Slayt 2: Bağlı devre gösterimi ──────────────────────────────────────────
const ConnectedCircuitDemo: React.FC = () => {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.5, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const TILE = 76;
  const H = TILE / 2;
  const S = 7;

  return (
    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }}>
      {/* Kaynak tile */}
      <Svg width={TILE} height={TILE}>
        <Rect x={3} y={3} width={TILE - 6} height={TILE - 6} rx={12} fill="rgba(107,123,58,0.13)" />
        <Path d={`M ${H} ${H} L ${TILE} ${H}`} stroke={COLORS.active} strokeWidth={S} strokeLinecap="round" />
        <Circle cx={H} cy={H} r={12} fill={COLORS.active} />
        <Circle cx={H} cy={H} r={6} fill={COLORS.solvedBg} />
      </Svg>

      {/* Düz hat tile */}
      <Svg width={TILE} height={TILE}>
        <Rect x={3} y={3} width={TILE - 6} height={TILE - 6} rx={12} fill="rgba(107,123,58,0.13)" />
        <Path d={`M 0 ${H} L ${TILE} ${H}`} stroke={COLORS.active} strokeWidth={S} strokeLinecap="round" />
      </Svg>

      {/* Ampul tile */}
      <Svg width={TILE} height={TILE}>
        <Rect x={3} y={3} width={TILE - 6} height={TILE - 6} rx={12} fill="rgba(107,123,58,0.13)" />
        <Path d={`M 0 ${H} L ${H} ${H}`} stroke={COLORS.active} strokeWidth={S} strokeLinecap="round" />
        {/* Ampul dış */}
        <Circle cx={H} cy={H} r={14} fill={COLORS.solvedActive} />
        {/* Ampul iç */}
        <Circle cx={H} cy={H} r={7} fill={COLORS.solvedBg} />
      </Svg>
    </Animated.View>
  );
};

// ─── Slayt tanımları ──────────────────────────────────────────────────────────
const SLIDES = [
  {
    key: 'rotate',
    title: 'Dokunarak döndür',
    description: 'Parçalara dokun, her dokunuş\nparçayı 90° döndürür.',
    Demo: RotatingTileDemo,
  },
  {
    key: 'connect',
    title: 'Devreyi kapat',
    description: 'Kaynaktan ampullere uzanan\nyolu oluştur. Hepsi bu kadar.',
    Demo: ConnectedCircuitDemo,
  },
];

// ─── Ana ekran ────────────────────────────────────────────────────────────────
export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onDone }) => {
  const [slide, setSlide] = useState(0);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const goNext = () => {
    Animated.timing(btnScale, { toValue: 0.94, duration: 80, useNativeDriver: true }).start(() => {
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    });

    if (slide === SLIDES.length - 1) {
      onDone();
      return;
    }

    Animated.timing(contentOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setSlide(prev => prev + 1);
      Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>

        {/* Slayt içeriği */}
        <Animated.View style={[styles.slideContent, { opacity: contentOpacity }]}>
          <View style={styles.demoBox}>
            <current.Demo />
          </View>

          <View style={styles.textBox}>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.description}>{current.description}</Text>
          </View>
        </Animated.View>

        {/* Alt alan: noktalar + buton */}
        <View style={styles.bottom}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
            ))}
          </View>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                isLast && styles.btnLast,
                pressed && { opacity: 0.8 },
              ]}
              onPress={goNext}
            >
              <Text style={[styles.btnText, isLast && styles.btnTextLast]}>
                {isLast ? 'Oynamaya Başla' : 'Devam'}
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
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 24,
    paddingTop: 40,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  demoBox: {
    width: 200,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: {
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.active,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(107,123,58,0.6)',
    textAlign: 'center',
  },
  // Tap indicator
  tapRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(107,123,58,0.15)',
    borderWidth: 2,
    borderColor: COLORS.active,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.active,
  },
  // Alt alan
  bottom: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(107,123,58,0.2)',
  },
  dotActive: {
    width: 20,
    backgroundColor: COLORS.active,
  },
  btn: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(107,123,58,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(107,123,58,0.15)',
  },
  btnLast: {
    backgroundColor: COLORS.active,
    borderColor: COLORS.active,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.active,
    letterSpacing: 0.2,
  },
  btnTextLast: {
    color: '#fff',
  },
});
