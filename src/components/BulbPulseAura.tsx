/**
 * BulbPulseAura - Dinamik Parlama Efekti
 * 
 * Enerji ulaşan lambaların etrafında yumuşak, nabız gibi atan
 * bir hale efekti. Zen havasını destekleyen sakin bir animasyon.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// Animated SVG bileşeni için
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface BulbPulseAuraProps {
    cx: number;
    cy: number;
    isPowered: boolean;
    color?: string;
    maxRadius?: number;
}

export const BulbPulseAura: React.FC<BulbPulseAuraProps> = ({
    cx,
    cy,
    isPowered,
    color = '#fdcb6e',
    maxRadius = 35,
}) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isPowered) {
            // Fade in
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: false,
            }).start();

            // Sürekli pulsing - Yavaş ve rahatlatıcı
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: false,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: false,
                    }),
                ])
            ).start();
        } else {
            // Fade out
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
            }).start(() => {
                pulseAnim.setValue(0);
            });
        }
    }, [isPowered]);

    // İnterpolasyonlar
    const radius = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [maxRadius * 0.7, maxRadius],
    });

    const opacity = Animated.multiply(
        opacityAnim,
        pulseAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.3, 0.5, 0.3],
        })
    );

    if (!isPowered) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    left: cx - maxRadius,
                    top: cy - maxRadius,
                    width: maxRadius * 2,
                    height: maxRadius * 2,
                    opacity: opacityAnim,
                }
            ]}
            pointerEvents="none"
        >
            <Svg width={maxRadius * 2} height={maxRadius * 2}>
                <Defs>
                    <RadialGradient id={`bulbAura-${cx}-${cy}`} cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor={color} stopOpacity="0.6" />
                        <Stop offset="0.5" stopColor={color} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={color} stopOpacity="0" />
                    </RadialGradient>
                </Defs>
                <AnimatedCircle
                    cx={maxRadius}
                    cy={maxRadius}
                    r={radius}
                    fill={`url(#bulbAura-${cx}-${cy})`}
                />
            </Svg>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
    },
});

export default BulbPulseAura;
