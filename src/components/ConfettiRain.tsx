/**
 * ConfettiRain - Bölüm Sonu Kutlama Efekti
 * 
 * Tüm devre tamamlandığında ekranın genelinde kısa süreli 
 * neon parçacık yağmuru. Zen havasını koruyarak kutlama hissi verir.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet, Dimensions, Easing } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ConfettiRainProps {
    visible: boolean;
    onComplete?: () => void;
}

const PARTICLE_COUNT = 50;

// Neon renk paleti - Oyunun temasına uygun
const NEON_COLORS = [
    '#00fff2', // Cyan
    '#00ffaa', // Mint
    '#ff0055', // Pink (Source)
    '#fdcb6e', // Gold (Bulb)
    '#a55eea', // Purple
    '#74b9ff', // Light Blue
    '#55efc4', // Turquoise
    '#ffffff', // White
];

interface Particle {
    x: number;
    translateY: Animated.Value;
    translateX: Animated.Value;
    rotate: Animated.Value;
    opacity: Animated.Value;
    scale: number;
    color: string;
    size: number;
    delay: number;
}

const createParticle = (index: number): Particle => ({
    x: Math.random() * SCREEN_WIDTH,
    translateY: new Animated.Value(-50),
    translateX: new Animated.Value(0),
    rotate: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: 0.5 + Math.random() * 0.5,
    color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
    size: 4 + Math.random() * 6,
    delay: index * 30 + Math.random() * 200,
});

export const ConfettiRain: React.FC<ConfettiRainProps> = ({
    visible,
    onComplete,
}) => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const containerOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Parçacıkları oluştur
            const newParticles = Array(PARTICLE_COUNT).fill(0).map((_, i) => createParticle(i));
            setParticles(newParticles);

            // Container fade in
            Animated.timing(containerOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();

            // Her parçacığı animasyonla
            newParticles.forEach((particle, index) => {
                const duration = 2000 + Math.random() * 1000;
                const horizontalSwing = (Math.random() - 0.5) * 60;

                setTimeout(() => {
                    // Opacity fade in
                    Animated.timing(particle.opacity, {
                        toValue: 0.8,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();

                    // Düşme animasyonu
                    Animated.parallel([
                        // Dikey hareket
                        Animated.timing(particle.translateY, {
                            toValue: SCREEN_HEIGHT + 100,
                            duration: duration,
                            easing: Easing.linear,
                            useNativeDriver: true,
                        }),
                        // Yatay sallanma
                        Animated.sequence([
                            Animated.timing(particle.translateX, {
                                toValue: horizontalSwing,
                                duration: duration / 3,
                                easing: Easing.inOut(Easing.sin),
                                useNativeDriver: true,
                            }),
                            Animated.timing(particle.translateX, {
                                toValue: -horizontalSwing,
                                duration: duration / 3,
                                easing: Easing.inOut(Easing.sin),
                                useNativeDriver: true,
                            }),
                            Animated.timing(particle.translateX, {
                                toValue: 0,
                                duration: duration / 3,
                                easing: Easing.inOut(Easing.sin),
                                useNativeDriver: true,
                            }),
                        ]),
                        // Dönme
                        Animated.timing(particle.rotate, {
                            toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
                            duration: duration,
                            easing: Easing.linear,
                            useNativeDriver: true,
                        }),
                        // Fade out
                        Animated.timing(particle.opacity, {
                            toValue: 0,
                            duration: duration,
                            delay: duration * 0.5,
                            useNativeDriver: true,
                        }),
                    ]).start();
                }, particle.delay);
            });

            // Tamamlama callback
            const totalDuration = 3500;
            setTimeout(() => {
                Animated.timing(containerOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => {
                    setParticles([]);
                    onComplete?.();
                });
            }, totalDuration);
        }
    }, [visible]);

    if (!visible && particles.length === 0) return null;

    return (
        <Animated.View
            style={[styles.container, { opacity: containerOpacity }]}
            pointerEvents="none"
        >
            {particles.map((particle, index) => (
                <Animated.View
                    key={`confetti-${index}`}
                    style={[
                        styles.particle,
                        {
                            left: particle.x,
                            width: particle.size,
                            height: particle.size * 1.5,
                            backgroundColor: particle.color,
                            borderRadius: particle.size / 4,
                            transform: [
                                { translateY: particle.translateY },
                                { translateX: particle.translateX },
                                { scale: particle.scale },
                                {
                                    rotate: particle.rotate.interpolate({
                                        inputRange: [0, 360],
                                        outputRange: ['0deg', '360deg'],
                                    }),
                                },
                            ],
                            opacity: particle.opacity,
                            // Glow efekti
                            shadowColor: particle.color,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.8,
                            shadowRadius: 4,
                        },
                    ]}
                />
            ))}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    particle: {
        position: 'absolute',
        top: 0,
    },
});

export default ConfettiRain;
