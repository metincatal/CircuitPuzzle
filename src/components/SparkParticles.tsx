/**
 * SparkParticles - Etkileşimli Kıvılcım Efekti
 * 
 * Enerji bir hattan akmaya başladığında veya iki kablo birleştiğinde
 * birleşme noktalarından dışarı saçılan kısa süreli neon parçacıklar.
 * 
 * Zen havasını bozmayacak şekilde yumuşak ve minimal tasarım.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, View, StyleSheet, Dimensions } from 'react-native';

interface SparkPoint {
    x: number;
    y: number;
    color: string;
}

interface SparkParticlesProps {
    points: SparkPoint[];
    triggerKey: string; // Bu değiştiğinde parçacıklar tetiklenir
}

const PARTICLE_COUNT = 6;
const SPARK_COLORS = ['#00fff2', '#00ffaa', '#55ffff', '#aaffff', '#ffffff'];

interface Particle {
    translateX: Animated.Value;
    translateY: Animated.Value;
    opacity: Animated.Value;
    scale: Animated.Value;
}

const createParticles = (): Particle[] => {
    return Array(PARTICLE_COUNT).fill(0).map(() => ({
        translateX: new Animated.Value(0),
        translateY: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0),
    }));
};

export const SparkParticles: React.FC<SparkParticlesProps> = ({
    points,
    triggerKey,
}) => {
    // Her nokta için parçacık seti
    const particleSets = useRef<Map<string, Particle[]>>(new Map());
    const lastTriggerKey = useRef(triggerKey);

    // Parçacık setlerini oluştur/güncelle
    useMemo(() => {
        points.forEach(point => {
            const key = `${point.x}-${point.y}`;
            if (!particleSets.current.has(key)) {
                particleSets.current.set(key, createParticles());
            }
        });
    }, [points]);

    // Tetikleyici değiştiğinde animasyonu başlat
    useEffect(() => {
        if (triggerKey !== lastTriggerKey.current) {
            lastTriggerKey.current = triggerKey;

            points.forEach(point => {
                const key = `${point.x}-${point.y}`;
                const particles = particleSets.current.get(key);
                if (!particles) return;

                particles.forEach((particle, index) => {
                    // Rastgele yön
                    const angle = (Math.PI * 2 * index) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
                    const distance = 15 + Math.random() * 20;
                    const targetX = Math.cos(angle) * distance;
                    const targetY = Math.sin(angle) * distance;

                    // Reset
                    particle.translateX.setValue(0);
                    particle.translateY.setValue(0);
                    particle.opacity.setValue(1);
                    particle.scale.setValue(0.5);

                    // Animasyon - Yumuşak patlama
                    Animated.parallel([
                        Animated.timing(particle.translateX, {
                            toValue: targetX,
                            duration: 400 + Math.random() * 200,
                            useNativeDriver: true,
                        }),
                        Animated.timing(particle.translateY, {
                            toValue: targetY,
                            duration: 400 + Math.random() * 200,
                            useNativeDriver: true,
                        }),
                        Animated.sequence([
                            Animated.timing(particle.scale, {
                                toValue: 1,
                                duration: 100,
                                useNativeDriver: true,
                            }),
                            Animated.timing(particle.scale, {
                                toValue: 0,
                                duration: 300 + Math.random() * 200,
                                useNativeDriver: true,
                            }),
                        ]),
                        Animated.timing(particle.opacity, {
                            toValue: 0,
                            duration: 400 + Math.random() * 200,
                            delay: 100,
                            useNativeDriver: true,
                        }),
                    ]).start();
                });
            });
        }
    }, [triggerKey, points]);

    if (points.length === 0) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {points.map((point, pointIndex) => {
                const key = `${point.x}-${point.y}`;
                const particles = particleSets.current.get(key);
                if (!particles) return null;

                return (
                    <View
                        key={`spark-source-${pointIndex}`}
                        style={[
                            styles.sparkContainer,
                            { left: point.x, top: point.y }
                        ]}
                    >
                        {particles.map((particle, i) => (
                            <Animated.View
                                key={`particle-${pointIndex}-${i}`}
                                style={[
                                    styles.spark,
                                    {
                                        backgroundColor: point.color || SPARK_COLORS[i % SPARK_COLORS.length],
                                        transform: [
                                            { translateX: particle.translateX },
                                            { translateY: particle.translateY },
                                            { scale: particle.scale },
                                        ],
                                        opacity: particle.opacity,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    sparkContainer: {
        position: 'absolute',
        width: 0,
        height: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spark: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        shadowColor: '#00fff2',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
});

export default SparkParticles;
