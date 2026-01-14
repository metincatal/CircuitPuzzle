import React, { useMemo, useEffect, useState } from 'react';
import { View, Dimensions, Pressable, Animated } from 'react-native';
import Svg, { Path, Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Zap, Lightbulb } from 'lucide-react-native';
import {
    Level,
    getActiveConnections,
} from '../types/circuit';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// LİKİT METAL RENK PALETİ
const COLORS = {
    passive: 'rgba(255, 255, 255, 0.1)',
    active: '#ffffff',
    glow: '#00fff2',
    sourceCore: '#ff0055',
    bulbGlow: '#fdcb6e',
};

const STROKE_WIDTH = 14;
const GLOW_WIDTH = 26;
const OVERFLOW_AMOUNT = 3;

interface CircuitCanvasProps {
    level: Level;
    onTilePress: (tileId: string) => void;
}

const ZenNoise = ({ width, height }: { width: number, height: number }) => (
    <G opacity={0.05}>
        <Path d={`M 0 ${height * 0.3} Q ${width * 0.5} ${height * 0.6} ${width} ${height * 0.2}`} stroke="#fff" strokeWidth={1} fill="none" />
        <Path d={`M ${width * 0.2} 0 Q ${width * 0.5} ${height * 0.5} ${width * 0.8} ${height}`} stroke="#fff" strokeWidth={1} fill="none" />
    </G>
);

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
    level,
    onTilePress,
}) => {
    const canvasWidth = SCREEN_WIDTH - 20;
    const cellSize = canvasWidth / level.cols;
    const canvasHeight = cellSize * level.rows;

    // Pulse Animasyonu (Win State)
    const [pulseAnim] = useState(new Animated.Value(1));

    useEffect(() => {
        if (level.isSolved) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [level.isSolved]);

    const tileGraphics = useMemo(() => {
        return level.tiles.map(tile => {
            const activeConns = getActiveConnections(tile);

            const cx = tile.position.col * cellSize + cellSize / 2;
            const cy = tile.position.row * cellSize + cellSize / 2;
            const size = cellSize;
            const half = size / 2;

            // Kenar Koordinatları (OVERFLOW DAHİL)
            const top = { x: cx, y: cy - half - OVERFLOW_AMOUNT };
            const right = { x: cx + half + OVERFLOW_AMOUNT, y: cy };
            const bottom = { x: cx, y: cy + half + OVERFLOW_AMOUNT };
            const left = { x: cx - half - OVERFLOW_AMOUNT, y: cy };

            const tr = { x: cx + half, y: cy - half };
            const br = { x: cx + half, y: cy + half };
            const bl = { x: cx - half, y: cy + half };
            const tl = { x: cx - half, y: cy - half };

            let d = "";
            let isJunction = false;

            const conns = Object.entries(activeConns).filter(([_, v]) => v).map(([k]) => k);
            const count = conns.length;

            if (tile.type === 'source' || tile.type === 'bulb') {
                if (activeConns.top) d = `M ${cx} ${cy} L ${top.x} ${top.y}`;
                else if (activeConns.right) d = `M ${cx} ${cy} L ${right.x} ${right.y}`;
                else if (activeConns.bottom) d = `M ${cx} ${cy} L ${bottom.x} ${bottom.y}`;
                else if (activeConns.left) d = `M ${cx} ${cy} L ${left.x} ${left.y}`;
            }
            else if (count === 2) {
                const isLine = (activeConns.top && activeConns.bottom) || (activeConns.left && activeConns.right);
                if (isLine) {
                    if (activeConns.top) d = `M ${top.x} ${top.y} L ${bottom.x} ${bottom.y}`;
                    else d = `M ${left.x} ${left.y} L ${right.x} ${right.y}`;
                } else {
                    if (activeConns.top && activeConns.right) d = `M ${top.x} ${top.y} Q ${tr.x} ${tr.y} ${right.x} ${right.y}`;
                    else if (activeConns.right && activeConns.bottom) d = `M ${right.x} ${right.y} Q ${br.x} ${br.y} ${bottom.x} ${bottom.y}`;
                    else if (activeConns.bottom && activeConns.left) d = `M ${bottom.x} ${bottom.y} Q ${bl.x} ${bl.y} ${left.x} ${left.y}`;
                    else if (activeConns.left && activeConns.top) d = `M ${left.x} ${left.y} Q ${tl.x} ${tl.y} ${top.x} ${top.y}`;
                }
            } else {
                isJunction = true;
                if (activeConns.top) d += `M ${top.x} ${top.y} L ${cx} ${cy} `;
                if (activeConns.right) d += `M ${right.x} ${right.y} L ${cx} ${cy} `;
                if (activeConns.bottom) d += `M ${bottom.x} ${bottom.y} L ${cx} ${cy} `;
                if (activeConns.left) d += `M ${left.x} ${left.y} L ${cx} ${cy} `;
            }

            return {
                ...tile,
                cx, cy, d, isJunction,
            };
        });
    }, [level, cellSize]);

    return (
        <Animated.View style={{
            width: canvasWidth,
            height: canvasHeight,
            // Tüm içerik (SVG + Icons) birlikte büyüyecek
            transform: [{ scale: pulseAnim }]
        }}>
            <Svg width={canvasWidth} height={canvasHeight}>
                <Defs>
                    <RadialGradient id="gradSource" cx="50%" cy="50%" rx="50%" ry="50%">
                        <Stop offset="0" stopColor={COLORS.sourceCore} stopOpacity="0.8" />
                        <Stop offset="1" stopColor={COLORS.sourceCore} stopOpacity="0" />
                    </RadialGradient>
                    <RadialGradient id="gradBulb" cx="50%" cy="50%" rx="50%" ry="50%">
                        <Stop offset="0" stopColor={COLORS.bulbGlow} stopOpacity="0.8" />
                        <Stop offset="1" stopColor={COLORS.bulbGlow} stopOpacity="0" />
                    </RadialGradient>
                </Defs>

                {/* 0. NOISE */}
                <ZenNoise width={canvasWidth} height={canvasHeight} />

                {/* 1. GLOW LAYER */}
                {tileGraphics.filter(t => t.isPowered).map(t => (
                    <Path
                        key={`glow-${t.id}`}
                        d={t.d}
                        stroke={t.type === 'source' ? COLORS.sourceCore : (t.type === 'bulb' ? COLORS.bulbGlow : COLORS.glow)}
                        strokeWidth={GLOW_WIDTH}
                        strokeOpacity={0.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                ))}

                {/* 2. MAIN PATH LAYER */}
                {tileGraphics.map(t => (
                    <G key={t.id}>
                        <Path
                            d={t.d}
                            stroke={t.isPowered ? COLORS.active : COLORS.passive}
                            strokeWidth={STROKE_WIDTH}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        {t.isJunction && (
                            <Circle
                                cx={t.cx} cy={t.cy}
                                r={STROKE_WIDTH / 2}
                                fill={t.isPowered ? COLORS.active : COLORS.passive}
                            />
                        )}

                        {/* Glow Circles for Source/Bulb */}
                        {t.type === 'source' && t.isPowered && (
                            <Circle cx={t.cx} cy={t.cy} r={22} fill="url(#gradSource)" opacity={0.6} />
                        )}
                        {t.type === 'bulb' && t.isPowered && (
                            <Circle cx={t.cx} cy={t.cy} r={24} fill="url(#gradBulb)" opacity={0.6} />
                        )}
                    </G>
                ))}
            </Svg>

            {/* TOUCH & ICON LAYER - Artık Animated.View'ın içinde, SVG ile senkronize */}
            {tileGraphics.map((t, i) => (
                <Pressable
                    key={`touch-${t.id}`}
                    style={{
                        position: 'absolute',
                        left: t.position.col * cellSize,
                        top: t.position.row * cellSize,
                        width: cellSize,
                        height: cellSize,
                        alignItems: 'center',
                        justifyContent: 'center',
                        // İkonlar artık parent ile birlikte scale oluyor
                    }}
                    onPress={() => onTilePress(t.id)}
                >
                    {t.type === 'source' && (
                        <View style={{ transform: [{ rotate: `${t.rotation * 90}deg` }] }}>
                            <Zap
                                size={24}
                                color={t.isPowered ? '#fff' : 'rgba(255,255,255,0.4)'}
                                fill={t.isPowered ? COLORS.sourceCore : 'transparent'}
                            />
                        </View>
                    )}

                    {t.type === 'bulb' && (
                        <Lightbulb
                            size={24}
                            color={t.isPowered ? '#fff' : 'rgba(255,255,255,0.3)'}
                            fill={t.isPowered ? COLORS.bulbGlow : 'transparent'}
                        />
                    )}
                </Pressable>
            ))}
        </Animated.View>
    );
};
