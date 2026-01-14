/**
 * StarRating - Yıldız Derecelendirme Animasyonu
 * 
 * Bölüm tamamlandığında kazanılan yıldızları
 * neon parlamayla gösteren animasyonlu bileşen.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';

interface StarRatingProps {
    stars: number; // 0-3 arası
    size?: number;
    animated?: boolean;
    delay?: number; // ilk yıldız için gecikme (ms)
}

// Yıldız SVG path
const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

const AnimatedG = Animated.createAnimatedComponent(G);

const Star: React.FC<{
    filled: boolean;
    size: number;
    delay: number;
    animated: boolean;
    index: number;
}> = ({ filled, size, delay, animated, index }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (filled && animated) {
            // Sıralı animasyon
            setTimeout(() => {
                Animated.parallel([
                    // Scale: 0 -> 1.3 -> 1
                    Animated.sequence([
                        Animated.timing(scaleAnim, {
                            toValue: 1.3,
                            duration: 200,
                            easing: Easing.out(Easing.back(2)),
                            useNativeDriver: true,
                        }),
                        Animated.spring(scaleAnim, {
                            toValue: 1,
                            tension: 100,
                            friction: 5,
                            useNativeDriver: true,
                        }),
                    ]),
                    // Opacity fade in
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                ]).start();

                // Glow pulse
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(glowAnim, {
                            toValue: 1,
                            duration: 1500,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true,
                        }),
                        Animated.timing(glowAnim, {
                            toValue: 0,
                            duration: 1500,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            }, delay);
        } else if (!animated) {
            scaleAnim.setValue(filled ? 1 : 0.8);
            opacityAnim.setValue(1);
        }
    }, [filled, animated, delay]);

    const gradientId = `starGrad-${index}`;

    return (
        <Animated.View
            style={[
                styles.starContainer,
                {
                    width: size,
                    height: size,
                    transform: [{ scale: animated ? scaleAnim : 1 }],
                    opacity: animated && filled ? opacityAnim : 1,
                },
            ]}
        >
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Defs>
                    <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0" stopColor={filled ? "#ffd700" : "#444"} />
                        <Stop offset="50" stopColor={filled ? "#ffaa00" : "#333"} />
                        <Stop offset="100" stopColor={filled ? "#ff8800" : "#222"} />
                    </LinearGradient>
                </Defs>
                <Path
                    d={STAR_PATH}
                    fill={`url(#${gradientId})`}
                    stroke={filled ? "#ffcc00" : "#555"}
                    strokeWidth={0.5}
                />
            </Svg>

            {/* Glow efekti */}
            {filled && (
                <Animated.View
                    style={[
                        styles.glow,
                        {
                            width: size * 1.5,
                            height: size * 1.5,
                            opacity: glowAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.2, 0.5],
                            }),
                        },
                    ]}
                />
            )}
        </Animated.View>
    );
};

export const StarRating: React.FC<StarRatingProps> = ({
    stars,
    size = 40,
    animated = true,
    delay = 0,
}) => {
    return (
        <View style={styles.container}>
            {[0, 1, 2].map((index) => (
                <Star
                    key={`star-${index}`}
                    filled={index < stars}
                    size={size}
                    delay={delay + index * 200}
                    animated={animated}
                    index={index}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    starContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
        borderRadius: 100,
        backgroundColor: '#ffd700',
        shadowColor: '#ffd700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 15,
    },
});

export default StarRating;
