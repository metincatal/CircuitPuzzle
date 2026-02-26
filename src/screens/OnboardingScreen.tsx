import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing, SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { COLORS } from '../components/CircuitCanvas';

const T = 66;     // tile boyutu
const H = T / 2;  // merkez
const S = 6;      // stroke genişliği
const R = 10;     // köşe yarıçapı

const BG_ON  = 'rgba(107,123,58,0.12)';
const BG_OFF = 'rgba(196,186,168,0.2)';

// ── Tile bileşenleri ─────────────────────────────────────────────────────────

const SourceTile = ({ on }: { on: boolean }) => (
  <Svg width={T} height={T}>
    <Rect x={2} y={2} width={T - 4} height={T - 4} rx={R} fill={on ? BG_ON : BG_OFF} />
    <Path
      d={`M ${H} ${H} L ${T} ${H}`}
      stroke={on ? COLORS.active : COLORS.passive}
      strokeWidth={S} strokeLinecap="round"
    />
    <Circle cx={H} cy={H} r={13} fill={on ? COLORS.active : COLORS.passive} />
    <Circle cx={H} cy={H} r={7}  fill={COLORS.background} />
  </Svg>
);

// Yatay hat: sol-sağ bağlantı. 90° döndürülünce dikey olur → sol-sağ bağlantısı kesilir.
const LineTile = ({ on }: { on: boolean }) => (
  <Svg width={T} height={T}>
    <Rect x={2} y={2} width={T - 4} height={T - 4} rx={R} fill={on ? BG_ON : BG_OFF} />
    <Path
      d={`M 0 ${H} L ${T} ${H}`}
      stroke={on ? COLORS.active : COLORS.passive}
      strokeWidth={S} strokeLinecap="round"
    />
  </Svg>
);

const BulbTile = ({ on }: { on: boolean }) => (
  <Svg width={T} height={T}>
    <Rect x={2} y={2} width={T - 4} height={T - 4} rx={R}
      fill={on ? 'rgba(74,139,92,0.15)' : BG_OFF} />
    <Path
      d={`M 0 ${H} L ${H} ${H}`}
      stroke={on ? COLORS.solvedActive : COLORS.passive}
      strokeWidth={S} strokeLinecap="round"
    />
    <Circle cx={H} cy={H} r={13} fill={on ? COLORS.solvedActive : COLORS.passive} />
    <Circle cx={H} cy={H} r={7}  fill={COLORS.background} />
  </Svg>
);

// ── Slide 1: Döndür ──────────────────────────────────────────────────────────
// 3 tile yan yana: Kaynak → Hat (yanlış rotasyon) → Ampul
// Hat tile 90° döndürülünce (dikey), bağlantı kesilmiş. Dokunuşla 0°'ye döner → hepsi yeşil.
const SlideRotate: React.FC = () => {
  const [on, setOn] = useState(false);
  const rot        = useRef(new Animated.Value(0)).current; // 0 → 90°(yanlış), 1 → 0°(doğru)
  const tapOpacity = useRef(new Animated.Value(0)).current;
  const tapScale   = useRef(new Animated.Value(1)).current;

  const rotateDeg = rot.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });

  useEffect(() => {
    let alive = true;

    const play = () => {
      if (!alive) return;
      setOn(false);
      rot.setValue(0);
      tapOpacity.setValue(0);
      tapScale.setValue(1);

      // Döndürme başlangıç zamanı (ms): 900 + 160 + 90 + 90 = 1240
      // Animasyon süresi: 350ms → biter: 1590ms
      setTimeout(() => { if (alive) setOn(true); }, 1560);

      Animated.sequence([
        Animated.delay(900),
        Animated.timing(tapOpacity, { toValue: 1,    duration: 160, useNativeDriver: true }),
        Animated.timing(tapScale,   { toValue: 0.88, duration: 90,  useNativeDriver: true }),
        Animated.timing(tapScale,   { toValue: 1,    duration: 90,  useNativeDriver: true }),
        Animated.timing(rot, {
          toValue: 1, duration: 350,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(tapOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.delay(1600),
      ]).start(() => { if (alive) play(); });
    };

    play();
    return () => { alive = false; };
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <SourceTile on={on} />

      {/* Dönen orta tile */}
      <View>
        <Animated.View style={{ transform: [{ scale: tapScale }, { rotate: rotateDeg }] }}>
          <LineTile on={on} />
        </Animated.View>

        {/* Dokunuş göstergesi */}
        <Animated.View pointerEvents="none" style={[st.tapWrap, { opacity: tapOpacity }]}>
          <View style={st.tapRing}>
            <View style={st.tapDot} />
          </View>
        </Animated.View>
      </View>

      <BulbTile on={on} />
    </View>
  );
};

// ── Slide 2: Açık uç bırakma ─────────────────────────────────────────────────
// Yanlış (Kaynak → Hat → açık uç ✗) ile Doğru (Kaynak → Hat → Ampul ✓) yan yana
const SlideNoLoose: React.FC = () => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <View style={{ gap: 16 }}>
      {/* YANLIŞ: açık uç */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <SourceTile on={false} />
        <LineTile   on={false} />
        {/* Açık uç işareti */}
        <View style={st.openMark}>
          <Svg width={18} height={18} viewBox="0 0 18 18">
            <Path d="M 3 3 L 15 15" stroke="rgba(200,90,70,0.65)" strokeWidth={2.5} strokeLinecap="round" />
            <Path d="M 15 3 L 3 15" stroke="rgba(200,90,70,0.65)" strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </View>
      </View>

      {/* DOĞRU: tam bağlı, pulsing */}
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: pulse }}>
        <SourceTile on={true} />
        <LineTile   on={true} />
        <BulbTile   on={true} />
      </Animated.View>
    </View>
  );
};

// ── Slaytlar ─────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    key: 'rotate',
    title: 'Döndür',
    desc: 'Parçalara dokun, her dokunuş\nparçayı 90° döndürür.',
    Demo: SlideRotate,
    last: false,
  },
  {
    key: 'loose',
    title: 'Açık uç bırakma',
    desc: 'Her kablo ucunun bir bağlantısı\nolmalı. Açıkta kalan kablo yok.',
    Demo: SlideNoLoose,
    last: true,
  },
];

// ── Ana ekran ─────────────────────────────────────────────────────────────────
interface OnboardingScreenProps {
  onDone: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onDone }) => {
  const [slide, setSlide] = useState(0);
  const fade     = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const goNext = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();

    if (slide === SLIDES.length - 1) { onDone(); return; }

    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setSlide(p => p + 1);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const cur = SLIDES[slide];

  return (
    <View style={st.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={st.safe}>

        <Animated.View style={[st.content, { opacity: fade }]}>
          <View style={st.demoBox}>
            <cur.Demo />
          </View>
          <View style={st.textBox}>
            <Text style={st.title}>{cur.title}</Text>
            <Text style={st.desc}>{cur.desc}</Text>
          </View>
        </Animated.View>

        <View style={st.bottom}>
          <View style={st.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[st.dot, i === slide && st.dotActive]} />
            ))}
          </View>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              style={({ pressed }) => [st.btn, cur.last && st.btnLast, pressed && { opacity: 0.8 }]}
              onPress={goNext}
            >
              <Text style={[st.btnText, cur.last && st.btnTextLast]}>
                {cur.last ? 'Oynamaya Başla' : 'Devam'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

      </SafeAreaView>
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  safe: {
    flex: 1, alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, paddingBottom: 24, paddingTop: 40,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 44 },
  demoBox:  { alignItems: 'center', justifyContent: 'center', minHeight: 170 },
  textBox:  { alignItems: 'center', gap: 10 },
  title: {
    fontSize: 26, fontWeight: '700', color: COLORS.active,
    textAlign: 'center',
  },
  desc: {
    fontSize: 15, lineHeight: 22, color: 'rgba(107,123,58,0.6)',
    textAlign: 'center',
  },
  // Dokunuş göstergesi
  tapWrap: { position: 'absolute', right: -8, top: -8, zIndex: 10 },
  tapRing: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(107,123,58,0.15)', borderWidth: 2, borderColor: COLORS.active,
    alignItems: 'center', justifyContent: 'center',
  },
  tapDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.active },
  // Açık uç
  openMark: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(200,90,70,0.08)', borderWidth: 1.5,
    borderColor: 'rgba(200,90,70,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Alt alan
  bottom:   { width: '100%', alignItems: 'center', gap: 20 },
  dots:     { flexDirection: 'row', gap: 8 },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(107,123,58,0.2)' },
  dotActive:{ width: 20, backgroundColor: COLORS.active },
  btn: {
    paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14,
    backgroundColor: 'rgba(107,123,58,0.1)', borderWidth: 1, borderColor: 'rgba(107,123,58,0.15)',
  },
  btnLast:     { backgroundColor: COLORS.active, borderColor: COLORS.active },
  btnText:     { fontSize: 16, fontWeight: '600', color: COLORS.active, letterSpacing: 0.2 },
  btnTextLast: { color: '#fff' },
});
