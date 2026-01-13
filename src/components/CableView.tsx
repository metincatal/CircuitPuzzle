import React, { useRef, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Cable, getCableEndpoints, degToRad } from '../types/circuit';

interface CableViewProps {
    cable: Cable;
    onPress?: () => void;
    canvasWidth: number;
    canvasHeight: number;
}

// Renkler
const COLORS = {
    normal: 'rgba(200, 190, 160, 0.85)',
    powered: 'rgba(255, 255, 230, 0.95)',
    glow: 'rgba(255, 255, 200, 0.5)',
    endpoint: 'rgba(180, 170, 140, 0.9)',
    endpointPowered: 'rgba(255, 255, 230, 1)',
};

/**
 * Kablo şeklini SVG path olarak oluştur
 * ŞEKİL SABİT - Rotasyon SVG transform ile yapılır
 */
const getCableShapePath = (
    cable: Cable,
    canvasWidth: number,
    canvasHeight: number
): { path: string; cx: number; cy: number; endpoints: { x1: number; y1: number; x2: number; y2: number } } => {
    const cx = cable.center.x * canvasWidth;
    const cy = cable.center.y * canvasHeight;
    const halfLen = (cable.length / 2) * Math.min(canvasWidth, canvasHeight);

    // Uç noktalar (lokal koordinatlarda, rotasyon 0)
    const x1 = -halfLen;
    const y1 = 0;
    const x2 = halfLen;
    const y2 = 0;

    let path: string;

    switch (cable.shape) {
        case 'curve': {
            // C şeklinde eğri
            const curveY = halfLen * cable.curveOffset * 2;
            path = `M ${x1} ${y1} Q 0 ${curveY}, ${x2} ${y2}`;
            break;
        }
        case 'scurve': {
            // S şeklinde eğri
            const curveY = halfLen * cable.curveOffset * 1.5;
            path = `M ${x1} ${y1} C ${x1 / 2} ${-curveY}, ${x2 / 2} ${curveY}, ${x2} ${y2}`;
            break;
        }
        case 'triangle': {
            // Üçgen şekli
            const peakY = -halfLen * 0.6;
            path = `M ${x1} ${y1} L 0 ${peakY} L ${x2} ${y2}`;
            break;
        }
        case 'line':
        default:
            // Düz çizgi
            path = `M ${x1} ${y1} L ${x2} ${y2}`;
            break;
    }

    return { path, cx, cy, endpoints: { x1, y1, x2, y2 } };
};

/**
 * Kablo bileşeni - Merkez etrafında döner
 */
export const CableView: React.FC<CableViewProps> = ({
    cable,
    onPress,
    canvasWidth,
    canvasHeight,
}) => {
    const animatedRotation = useRef(new Animated.Value(cable.rotation)).current;
    const currentRotation = useRef(cable.rotation);

    // Rotasyon animasyonu
    useEffect(() => {
        if (currentRotation.current !== cable.rotation) {
            Animated.spring(animatedRotation, {
                toValue: cable.rotation,
                useNativeDriver: true,
                tension: 100,
                friction: 10,
            }).start();
            currentRotation.current = cable.rotation;
        }
    }, [cable.rotation, animatedRotation]);

    const { path, cx, cy, endpoints } = getCableShapePath(cable, canvasWidth, canvasHeight);
    const halfLen = (cable.length / 2) * Math.min(canvasWidth, canvasHeight);

    // Bounding box (rotasyon için geniş)
    const boxSize = halfLen * 2.5;
    const left = cx - boxSize / 2;
    const top = cy - boxSize / 2;

    const color = cable.isPowered ? COLORS.powered : COLORS.normal;
    const endpointColor = cable.isPowered ? COLORS.endpointPowered : COLORS.endpoint;

    const rotateTransform = animatedRotation.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View
            style={[
                styles.container,
                {
                    position: 'absolute',
                    left,
                    top,
                    width: boxSize,
                    height: boxSize,
                }
            ]}
        >
            <Pressable onPress={onPress} style={styles.pressable}>
                <Animated.View
                    style={[
                        styles.rotatingContent,
                        {
                            width: boxSize,
                            height: boxSize,
                            transform: [{ rotate: rotateTransform }],
                        }
                    ]}
                >
                    <Svg width={boxSize} height={boxSize}>
                        <G transform={`translate(${boxSize / 2}, ${boxSize / 2})`}>
                            {/* Glow efekti */}
                            {cable.isPowered && (
                                <Path
                                    d={path}
                                    stroke={COLORS.glow}
                                    strokeWidth={10}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            )}

                            {/* Ana kablo */}
                            <Path
                                d={path}
                                stroke={color}
                                strokeWidth={3.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />

                            {/* Uç noktaları */}
                            <Circle cx={endpoints.x1} cy={endpoints.y1} r={4} fill={endpointColor} />
                            <Circle cx={endpoints.x2} cy={endpoints.y2} r={4} fill={endpointColor} />
                        </G>
                    </Svg>
                </Animated.View>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        zIndex: 1,
    },
    pressable: {
        width: '100%',
        height: '100%',
    },
    rotatingContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default CableView;
