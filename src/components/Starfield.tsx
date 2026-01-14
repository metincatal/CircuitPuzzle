import React, { useMemo, useEffect, useRef } from 'react';
import { Dimensions, Animated, View, StyleSheet, Easing } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Starfield Katmanı
const StarLayer = ({ count, speed, scale, opacity }: { count: number, speed: number, scale: number, opacity: number }) => {
    const translateY = useRef(new Animated.Value(0)).current;

    // Yıldızları bir kez oluştur ve ezberle
    const stars = useMemo(() => {
        const items = [];
        for (let i = 0; i < count; i++) {
            items.push({
                x: Math.random() * width,
                y: Math.random() * height * 2, // 2 kat yükseklik (döngü için)
                r: (Math.random() * 1.5 + 0.5) * scale,
            });
        }
        return items;
    }, [count, scale]);

    useEffect(() => {
        // Sonsuz döngü: Aşağıdan yukarıya kaydır
        // translateY 0'dan -height'e giderse, görüntü yukarı kayar
        const anim = Animated.loop(
            Animated.timing(translateY, {
                toValue: -height, // Bir ekran boyu yukarı kay
                duration: speed, // Hız (ms)
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        anim.start();
        return () => anim.stop();
    }, [speed]);

    return (
        <Animated.View style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateY }] }
        ]}>
            <Svg height={height * 2} width={width}>
                <G opacity={opacity}>
                    {stars.map((star, i) => (
                        <Circle
                            key={i}
                            cx={star.x}
                            cy={star.y}
                            r={star.r}
                            fill="#ffffff"
                        />
                    ))}
                    {/* Döngünün pürüzsüz olması için ikinci kopya (veya height*2 alanına yaydık) */}
                </G>
            </Svg>
        </Animated.View>
    );
};

export const Starfield = () => {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Katman 1: En uzak, en yavaş, en küçük */}
            <StarLayer count={40} speed={40000} scale={0.5} opacity={0.2} />

            {/* Katman 2: Orta */}
            <StarLayer count={30} speed={25000} scale={0.8} opacity={0.4} />

            {/* Katman 3: Yakın, en hızlı, toz zerresi gibi */}
            <StarLayer count={15} speed={15000} scale={1} opacity={0.6} />
        </View>
    );
};
