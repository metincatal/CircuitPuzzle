import React, { useRef, useCallback, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Circle, Path as SvgPath } from 'react-native-svg';
import { HandDrawnPath } from './HandDrawnPath';

// Parça tipleri - her tip farklı yönlere bağlantı noktaları var
export type PieceType = 'L' | 'I' | 'T' | 'X' | 'empty';

// Yönler (0: üst, 1: sağ, 2: alt, 3: sol)
export type Direction = 0 | 1 | 2 | 3;

interface PuzzlePieceProps {
    type: PieceType;
    rotation: number; // 0, 90, 180, 270
    size: number;
    onPress?: () => void;
    isPowered?: boolean;  // Enerji var mı?
    isSource?: boolean;   // Güç kaynağı mı?
    isBulb?: boolean;     // Ampul mü?
    color?: string;
}

/**
 * Puzzle parçası bileşeni
 * L, I, T, X şekillerinde olabilir
 */
export const PuzzlePiece: React.FC<PuzzlePieceProps> = ({
    type,
    rotation,
    size,
    onPress,
    isPowered = false,
    isSource = false,
    isBulb = false,
    color = '#555555',
}) => {
    const animatedRotation = useRef(new Animated.Value(rotation)).current;
    const glowAnim = useRef(new Animated.Value(isPowered ? 1 : 0.3)).current;
    const currentRotation = useRef(rotation);

    // Güç durumu değişince glow animasyonu
    useEffect(() => {
        Animated.timing(glowAnim, {
            toValue: isPowered ? 1 : 0.3,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [isPowered, glowAnim]);

    // Rotasyon değişince animasyon
    useEffect(() => {
        if (currentRotation.current !== rotation) {
            Animated.spring(animatedRotation, {
                toValue: rotation,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
            }).start();
            currentRotation.current = rotation;
        }
    }, [rotation, animatedRotation]);

    // Press handler
    const handlePress = useCallback(() => {
        onPress?.();
    }, [onPress]);

    // Merkez nokta
    const center = size / 2;
    const padding = size * 0.15;

    // Aktif renk (powered ise parlak, değilse soluk)
    const activeColor = isPowered ? '#00ffaa' : color;
    const sourceColor = '#ffaa00';
    const bulbColor = isPowered ? '#ffff00' : '#666600';

    // Parça şekillerini çiz
    const renderPaths = () => {
        const pathColor = isSource ? sourceColor : (isBulb ? bulbColor : activeColor);
        const glowing = isPowered || isSource;

        switch (type) {
            case 'L':
                return (
                    <>
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: center, y: padding }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: size - padding, y: center }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                    </>
                );

            case 'I':
                return (
                    <HandDrawnPath
                        startPoint={{ x: center, y: padding }}
                        endPoint={{ x: center, y: size - padding }}
                        color={pathColor}
                        strokeWidth={4}
                        jitterAmount={2}
                        glowing={glowing}
                    />
                );

            case 'T':
                return (
                    <>
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: center, y: padding }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: padding, y: center }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: size - padding, y: center }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                    </>
                );

            case 'X':
                return (
                    <>
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: center, y: padding }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: size - padding, y: center }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: center, y: size - padding }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                        <HandDrawnPath
                            startPoint={{ x: center, y: center }}
                            endPoint={{ x: padding, y: center }}
                            color={pathColor}
                            strokeWidth={4}
                            jitterAmount={2}
                            glowing={glowing}
                        />
                    </>
                );

            default:
                return null;
        }
    };

    // Güç kaynağı ikonu
    const renderSource = () => {
        if (!isSource) return null;
        return (
            <>
                {/* Dış glow */}
                <Circle
                    cx={center}
                    cy={center}
                    r={size * 0.18}
                    fill={sourceColor}
                    opacity={0.3}
                />
                {/* İç çember */}
                <Circle
                    cx={center}
                    cy={center}
                    r={size * 0.12}
                    fill={sourceColor}
                />
                {/* Şimşek ikonu */}
                <SvgPath
                    d={`M ${center - 4} ${center - 6} L ${center + 2} ${center - 1} L ${center - 1} ${center + 1} L ${center + 5} ${center + 7} L ${center - 2} ${center + 1} L ${center + 1} ${center - 1} Z`}
                    fill="#1a1a2e"
                />
            </>
        );
    };

    // Ampul ikonu - powered olunca belirgin şekilde parlamalı
    const renderBulb = () => {
        if (!isBulb) return null;

        const bulbRadius = size * 0.16;

        return (
            <>
                {/* Dış glow (powered ise) - çok parlak */}
                {isPowered && (
                    <>
                        {/* En dış glow */}
                        <Circle
                            cx={center}
                            cy={center}
                            r={size * 0.35}
                            fill="#ffff00"
                            opacity={0.2}
                        />
                        {/* Orta glow */}
                        <Circle
                            cx={center}
                            cy={center}
                            r={size * 0.28}
                            fill="#ffff00"
                            opacity={0.35}
                        />
                        {/* İç glow */}
                        <Circle
                            cx={center}
                            cy={center}
                            r={size * 0.22}
                            fill="#ffff00"
                            opacity={0.5}
                        />
                    </>
                )}
                {/* Ampul gövdesi */}
                <Circle
                    cx={center}
                    cy={center}
                    r={bulbRadius}
                    fill={isPowered ? '#ffff00' : '#333333'}
                    stroke={isPowered ? '#ffdd00' : '#555555'}
                    strokeWidth={isPowered ? 3 : 2}
                />
                {/* Ampul içi ışık */}
                {isPowered && (
                    <Circle
                        cx={center - 3}
                        cy={center - 3}
                        r={bulbRadius * 0.3}
                        fill="#ffffff"
                        opacity={0.8}
                    />
                )}
                {/* Ampul tabanı */}
                <SvgPath
                    d={`M ${center - 7} ${center + bulbRadius - 2} L ${center + 7} ${center + bulbRadius - 2} L ${center + 5} ${center + bulbRadius + 6} L ${center - 5} ${center + bulbRadius + 6} Z`}
                    fill={isPowered ? '#ddaa00' : '#444444'}
                    stroke={isPowered ? '#ffcc00' : '#333333'}
                    strokeWidth={1}
                />
            </>
        );
    };

    const rotateTransform = animatedRotation.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
    });

    if (type === 'empty') return <View style={{ width: size, height: size }} />;

    return (
        <Pressable onPress={handlePress} style={styles.pressable}>
            <Animated.View
                style={[
                    styles.pieceContainer,
                    {
                        width: size,
                        height: size,
                        transform: [{ rotate: rotateTransform }],
                    },
                ]}
            >
                <Svg width={size} height={size}>
                    {renderPaths()}
                    {renderSource()}
                    {renderBulb()}
                </Svg>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    pressable: {},
    pieceContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default PuzzlePiece;
