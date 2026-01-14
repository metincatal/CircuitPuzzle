import React, { useMemo, useEffect, useState, useRef } from 'react';
import { View, Dimensions, Pressable, Animated } from 'react-native';
import Svg, { Path, Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Zap, Lightbulb } from 'lucide-react-native';
import {
    Level,
    Tile,
    getActiveConnections,
    getTileAt,
} from '../types/circuit';
import { SparkParticles } from './SparkParticles';

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

// Animated Circle for pulsing bulbs
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TileGraphics {
    id: string;
    position: { row: number; col: number };
    type: string;
    rotation: number;
    isPowered: boolean;
    cx: number;
    cy: number;
    d: string;
    isJunction: boolean;
}

// Bulb Pulse Aura Component (inline for performance)
const BulbPulseAuraInline: React.FC<{
    cx: number;
    cy: number;
    isPowered: boolean;
    uniqueId: string;
}> = ({ cx, cy, isPowered, uniqueId }) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isPowered) {
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: false,
            }).start();

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
            opacityAnim.stopAnimation();
            pulseAnim.stopAnimation();
            opacityAnim.setValue(0);
            pulseAnim.setValue(0);
        }

        return () => {
            opacityAnim.stopAnimation();
            pulseAnim.stopAnimation();
        };
    }, [isPowered]);

    if (!isPowered) return null;

    const maxRadius = 40;

    return (
        <Animated.View
            style={{
                position: 'absolute',
                left: cx - maxRadius,
                top: cy - maxRadius,
                width: maxRadius * 2,
                height: maxRadius * 2,
                opacity: opacityAnim,
            }}
            pointerEvents="none"
        >
            <Svg width={maxRadius * 2} height={maxRadius * 2}>
                <Defs>
                    <RadialGradient id={`pulseAura-${uniqueId}`} cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor={COLORS.bulbGlow} stopOpacity="0.7" />
                        <Stop offset="0.4" stopColor={COLORS.bulbGlow} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={COLORS.bulbGlow} stopOpacity="0" />
                    </RadialGradient>
                </Defs>
                <AnimatedCircle
                    cx={maxRadius}
                    cy={maxRadius}
                    r={pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [maxRadius * 0.6, maxRadius],
                    })}
                    fill={`url(#pulseAura-${uniqueId})`}
                />
            </Svg>
        </Animated.View>
    );
};

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
    level,
    onTilePress,
}) => {
    const canvasWidth = SCREEN_WIDTH - 20;
    const cellSize = canvasWidth / level.cols;
    const canvasHeight = cellSize * level.rows;

    // Pulse Animasyonu (Win State)
    const [pulseAnim] = useState(new Animated.Value(1));

    // Spark tetikleyici - powered tile sayısı değiştiğinde tetiklenir
    const [sparkTrigger, setSparkTrigger] = useState('initial');
    const prevPoweredCount = useRef(0);

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

    // Bağlantı noktalarını hesapla (kıvılcımlar için)
    const connectionPoints = useMemo(() => {
        const points: { x: number; y: number; color: string }[] = [];

        level.tiles.forEach(tile => {
            if (!tile.isPowered) return;

            const activeConns = getActiveConnections(tile);
            const cx = tile.position.col * cellSize + cellSize / 2;
            const cy = tile.position.row * cellSize + cellSize / 2;
            const half = cellSize / 2;

            // Sadece gerçek bağlantı noktalarında kıvılcım göster
            const directions = [
                { dir: 'top', dx: 0, dy: -half, nr: -1, nc: 0, opp: 'bottom' },
                { dir: 'right', dx: half, dy: 0, nr: 0, nc: 1, opp: 'left' },
                { dir: 'bottom', dx: 0, dy: half, nr: 1, nc: 0, opp: 'top' },
                { dir: 'left', dx: -half, dy: 0, nr: 0, nc: -1, opp: 'right' },
            ];

            directions.forEach(({ dir, dx, dy, nr, nc, opp }) => {
                if (!activeConns[dir as keyof typeof activeConns]) return;

                const neighbor = getTileAt(
                    level.tiles,
                    tile.position.row + nr,
                    tile.position.col + nc
                );

                if (neighbor && neighbor.isPowered) {
                    const neighborConns = getActiveConnections(neighbor);
                    if (neighborConns[opp as keyof typeof neighborConns]) {
                        // Gerçek bağlantı var - sadece bir kez ekle (ID kontrolü ile)
                        const pointKey = `${Math.min(tile.position.row, neighbor.position.row)}-${Math.min(tile.position.col, neighbor.position.col)}-${dir}`;
                        const existing = points.find(p =>
                            Math.abs(p.x - (cx + dx)) < 5 && Math.abs(p.y - (cy + dy)) < 5
                        );

                        if (!existing) {
                            points.push({
                                x: cx + dx,
                                y: cy + dy,
                                color: COLORS.glow,
                            });
                        }
                    }
                }
            });
        });

        return points;
    }, [level, cellSize]);

    // Powered tile sayısı değiştiğinde spark tetikle
    useEffect(() => {
        const currentPoweredCount = level.tiles.filter(t => t.isPowered).length;
        if (currentPoweredCount > prevPoweredCount.current) {
            setSparkTrigger(`spark-${Date.now()}`);
        }
        prevPoweredCount.current = currentPoweredCount;
    }, [level.tiles]);

    // Bulb tile'ları
    const bulbTiles = useMemo(() => {
        return tileGraphics.filter(t => t.type === 'bulb' && t.isPowered);
    }, [tileGraphics]);

    return (
        <Animated.View style={{
            width: canvasWidth,
            height: canvasHeight,
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

                        {/* Glow Circles for Source */}
                        {t.type === 'source' && t.isPowered && (
                            <Circle cx={t.cx} cy={t.cy} r={22} fill="url(#gradSource)" opacity={0.6} />
                        )}
                        {/* Static Bulb Glow (Pulse Aura ayrı render edilecek) */}
                        {t.type === 'bulb' && t.isPowered && (
                            <Circle cx={t.cx} cy={t.cy} r={24} fill="url(#gradBulb)" opacity={0.4} />
                        )}
                    </G>
                ))}
            </Svg>

            {/* BULB PULSE AURA LAYER - Dinamik Parlama */}
            {bulbTiles.map(t => (
                <BulbPulseAuraInline
                    key={`aura-${t.id}`}
                    cx={t.cx}
                    cy={t.cy}
                    isPowered={t.isPowered}
                    uniqueId={t.id}
                />
            ))}

            {/* SPARK PARTICLES LAYER - Etkileşimli Kıvılcımlar */}
            <SparkParticles
                points={connectionPoints}
                triggerKey={sparkTrigger}
            />

            {/* TOUCH & ICON LAYER */}
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
