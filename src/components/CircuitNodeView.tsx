import React, { useRef, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { CircuitNode } from '../types/circuit';

interface CircuitNodeViewProps {
    node: CircuitNode;
    size: number;
    onPress?: () => void;
    canvasWidth: number;
    canvasHeight: number;
}

// Referans oyundaki renkler
const COLORS = {
    nodeRing: 'rgba(200, 190, 160, 0.9)',
    nodeRingPowered: 'rgba(255, 255, 230, 0.95)',
    nodeFill: 'rgba(180, 170, 140, 0.3)',
    nodeFillPowered: 'rgba(255, 255, 200, 0.4)',
    port: 'rgba(180, 170, 140, 0.9)',
    portPowered: 'rgba(255, 255, 230, 1)',
    iconNormal: 'rgba(160, 150, 120, 0.9)',
    iconPowered: 'rgba(255, 220, 100, 1)',
    glow: 'rgba(255, 255, 200, 0.6)',
};

/**
 * Node bileşeni - Tek port çıkışı
 */
export const CircuitNodeView: React.FC<CircuitNodeViewProps> = ({
    node,
    size,
    onPress,
    canvasWidth,
    canvasHeight,
}) => {
    const animatedRotation = useRef(new Animated.Value(node.portAngle)).current;
    const currentRotation = useRef(node.portAngle);
    const glowScale = useRef(new Animated.Value(node.isPowered ? 1 : 0)).current;

    // Rotasyon animasyonu
    useEffect(() => {
        if (currentRotation.current !== node.portAngle) {
            Animated.spring(animatedRotation, {
                toValue: node.portAngle,
                useNativeDriver: true,
                tension: 100,
                friction: 10,
            }).start();
            currentRotation.current = node.portAngle;
        }
    }, [node.portAngle, animatedRotation]);

    // Glow animasyonu
    useEffect(() => {
        Animated.spring(glowScale, {
            toValue: node.isPowered ? 1.2 : 0,
            useNativeDriver: true,
            tension: 80,
            friction: 8,
        }).start();
    }, [node.isPowered, glowScale]);

    // Pozisyon
    const cx = node.position.x * canvasWidth;
    const cy = node.position.y * canvasHeight;
    const radius = size / 2;
    const portLength = radius * 1.2;
    const totalSize = size + portLength * 2;

    // Port çıkıntısı
    const renderPort = () => {
        const endX = radius + portLength + portLength;
        const endY = radius + portLength;
        const color = node.isPowered ? COLORS.portPowered : COLORS.port;

        return (
            <G>
                <Line
                    x1={radius + portLength}
                    y1={radius + portLength}
                    x2={endX}
                    y2={endY}
                    stroke={color}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                />
                <Circle cx={endX} cy={endY} r={4} fill={color} />
            </G>
        );
    };

    // Güç kaynağı ikonu
    const renderSourceIcon = () => {
        if (node.type !== 'source') return null;
        const s = size * 0.18;
        const iconCx = radius + portLength;
        const iconCy = radius + portLength;
        const color = node.isPowered ? COLORS.iconPowered : COLORS.iconNormal;

        return (
            <Path
                d={`
                    M ${iconCx - s * 0.1} ${iconCy - s * 0.7}
                    L ${iconCx + s * 0.4} ${iconCy - s * 0.05}
                    L ${iconCx + s * 0.05} ${iconCy + s * 0.05}
                    L ${iconCx + s * 0.5} ${iconCy + s * 0.7}
                    L ${iconCx - s * 0.1} ${iconCy + s * 0.1}
                    L ${iconCx + s * 0.15} ${iconCy}
                    Z
                `}
                fill={color}
            />
        );
    };

    // Lamba ikonu
    const renderBulbIcon = () => {
        if (node.type !== 'bulb') return null;
        const s = size * 0.2;
        const iconCx = radius + portLength;
        const iconCy = radius + portLength - s * 0.15;
        const color = node.isPowered ? COLORS.iconPowered : COLORS.iconNormal;

        return (
            <G>
                {/* Ampul */}
                <Circle
                    cx={iconCx}
                    cy={iconCy}
                    r={s * 0.45}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                />
                {/* Duy */}
                <Line
                    x1={iconCx}
                    y1={iconCy + s * 0.4}
                    x2={iconCx}
                    y2={iconCy + s * 0.7}
                    stroke={color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                />
            </G>
        );
    };

    const rotateTransform = animatedRotation.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
    });

    const ringColor = node.isPowered ? COLORS.nodeRingPowered : COLORS.nodeRing;
    const fillColor = node.isPowered ? COLORS.nodeFillPowered : COLORS.nodeFill;

    return (
        <View
            style={[
                styles.container,
                {
                    position: 'absolute',
                    left: cx - totalSize / 2,
                    top: cy - totalSize / 2,
                    width: totalSize,
                    height: totalSize,
                }
            ]}
        >
            {/* Glow */}
            {node.isPowered && (
                <Animated.View
                    style={[
                        styles.glow,
                        {
                            backgroundColor: COLORS.glow,
                            width: size * 1.4,
                            height: size * 1.4,
                            borderRadius: size * 0.7,
                            left: portLength - size * 0.2,
                            top: portLength - size * 0.2,
                            transform: [{ scale: glowScale }],
                        }
                    ]}
                />
            )}

            <Pressable onPress={onPress} style={styles.pressable}>
                {/* Dönen içerik */}
                <Animated.View
                    style={[
                        styles.rotatingContent,
                        {
                            width: totalSize,
                            height: totalSize,
                            transform: [{ rotate: rotateTransform }],
                        }
                    ]}
                >
                    <Svg width={totalSize} height={totalSize}>
                        {renderPort()}
                    </Svg>
                </Animated.View>

                {/* Sabit merkez ve ikon */}
                <View style={[styles.centerOverlay, { left: portLength, top: portLength }]}>
                    <Svg width={size} height={size}>
                        {/* Dış halka */}
                        <Circle
                            cx={radius}
                            cy={radius}
                            r={radius * 0.7}
                            fill={fillColor}
                            stroke={ringColor}
                            strokeWidth={2.5}
                        />
                    </Svg>
                </View>

                {/* İkon */}
                <View style={styles.iconOverlay}>
                    <Svg width={totalSize} height={totalSize}>
                        {renderSourceIcon()}
                        {renderBulbIcon()}
                    </Svg>
                </View>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        zIndex: 10,
    },
    glow: {
        position: 'absolute',
    },
    pressable: {
        width: '100%',
        height: '100%',
    },
    rotatingContent: {
        position: 'absolute',
    },
    centerOverlay: {
        position: 'absolute',
    },
    iconOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
});

export default CircuitNodeView;
