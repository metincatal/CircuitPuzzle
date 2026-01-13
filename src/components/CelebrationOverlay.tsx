import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Dimensions, Text } from 'react-native';

const { width, height } = Dimensions.get('window');

interface CelebrationOverlayProps {
    visible: boolean;
    onComplete?: () => void;
}

/**
 * Başarı kutlama animasyonu
 * Konfeti efekti ve parlama
 */
export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
    visible,
    onComplete,
}) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.5)).current;
    const particles = useRef(
        Array(12).fill(0).map(() => ({
            x: new Animated.Value(0),
            y: new Animated.Value(0),
            opacity: new Animated.Value(1),
            rotation: new Animated.Value(0),
        }))
    ).current;

    useEffect(() => {
        if (visible) {
            // Ana animasyon
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    tension: 100,
                    friction: 6,
                    useNativeDriver: true,
                }),
            ]).start();

            // Parçacık animasyonları
            particles.forEach((particle, index) => {
                const angle = (index / particles.length) * Math.PI * 2;
                const distance = 100 + Math.random() * 80;

                Animated.parallel([
                    Animated.timing(particle.x, {
                        toValue: Math.cos(angle) * distance,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(particle.y, {
                        toValue: Math.sin(angle) * distance + 50,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(particle.opacity, {
                        toValue: 0,
                        duration: 800,
                        delay: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(particle.rotation, {
                        toValue: 360,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ]).start();
            });

            // Otomatik kapat
            setTimeout(() => {
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }).start(() => {
                    // Reset
                    scale.setValue(0.5);
                    particles.forEach(p => {
                        p.x.setValue(0);
                        p.y.setValue(0);
                        p.opacity.setValue(1);
                        p.rotation.setValue(0);
                    });
                    onComplete?.();
                });
            }, 2000);
        }
    }, [visible]);

    if (!visible) return null;

    const particleColors = ['#00ffaa', '#00aaff', '#ffaa00', '#ff55aa', '#aa55ff', '#55ffaa'];

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity }
            ]}
            pointerEvents="none"
        >
            {/* Parçacıklar */}
            {particles.map((particle, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.particle,
                        {
                            backgroundColor: particleColors[index % particleColors.length],
                            transform: [
                                { translateX: particle.x },
                                { translateY: particle.y },
                                {
                                    rotate: particle.rotation.interpolate({
                                        inputRange: [0, 360],
                                        outputRange: ['0deg', '360deg'],
                                    })
                                },
                                { scale: particle.opacity },
                            ],
                            opacity: particle.opacity,
                        },
                    ]}
                />
            ))}

            {/* Başarı mesajı */}
            <Animated.View
                style={[
                    styles.messageContainer,
                    {
                        transform: [{ scale }],
                    }
                ]}
            >
                <Text style={styles.emoji}>🎉</Text>
                <Text style={styles.title}>TEBRİKLER!</Text>
                <Text style={styles.subtitle}>Puzzle Çözüldü</Text>
            </Animated.View>

            {/* Işık efekti */}
            <Animated.View
                style={[
                    styles.glow,
                    {
                        opacity: Animated.multiply(opacity, new Animated.Value(0.3)),
                        transform: [{ scale: Animated.multiply(scale, new Animated.Value(2)) }],
                    }
                ]}
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 1000,
    },
    messageContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        paddingHorizontal: 50,
        paddingVertical: 30,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#00ffaa',
    },
    emoji: {
        fontSize: 60,
        marginBottom: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#00ffaa',
        letterSpacing: 4,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.7)',
        letterSpacing: 2,
    },
    particle: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 4,
    },
    glow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#00ffaa',
    },
});

export default CelebrationOverlay;
