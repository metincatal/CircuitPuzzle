import React, { useMemo, useRef, useEffect } from 'react';
import { View, Dimensions, Pressable, Animated, Easing } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import {
    Level,
    Tile,
    getActiveConnections,
    getActiveBridgePaths,
} from '../types/circuit';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const COLORS = {
    background: '#E8E0D5',
    passive: '#C4BAA8',
    active: '#6B7B3A',
    node: '#6B7B3A',
    fixed: '#8B7B5A',
    solvedActive: '#4A8B5C',
    solvedBg: '#E0EBD5',
};

const STROKE_WIDTH = 6;
const NODE_RADIUS = 5;
const SVG_OVERFLOW = STROKE_WIDTH; // SVG kenar taşması (clipping önleme)

interface CircuitCanvasProps {
    level: Level;
    onTilePress: (tileId: string) => void;
    isSolved?: boolean;
}

// Tile'ın base (rotation=0) halindeki SVG path'lerini hesapla (lokal koordinat: 0,0 -> cellSize,cellSize)
const computeBasePaths = (tile: Tile, cellSize: number) => {
    const baseConns = tile.baseConnections;
    const half = cellSize / 2;
    const cx = half;
    const cy = half;

    const edgePoints: Record<string, { x: number; y: number }> = {
        top: { x: cx, y: 0 },
        right: { x: cellSize, y: cy },
        bottom: { x: cx, y: cellSize },
        left: { x: 0, y: cy },
    };

    const conns = Object.entries(baseConns).filter(([_, v]) => v).map(([k]) => k);
    const count = conns.length;
    let paths: string[] = [];
    let bridgeOverPath: string | undefined;

    if (tile.type === 'bridge') {
        const bp = tile.bridgePaths || { pathA: ['top', 'bottom'] as const, pathB: ['left', 'right'] as const };
        const pA1 = edgePoints[bp.pathA[0]];
        const pA2 = edgePoints[bp.pathA[1]];
        if (pA1 && pA2) {
            paths.push(`M ${pA1.x} ${pA1.y} L ${pA2.x} ${pA2.y}`);
        }
        const pB1 = edgePoints[bp.pathB[0]];
        const pB2 = edgePoints[bp.pathB[1]];
        if (pB1 && pB2) {
            const dx = pB2.x - pB1.x;
            const dy = pB2.y - pB1.y;
            const gapRatio = 0.15;
            const g1x = pB1.x + dx * (0.5 - gapRatio);
            const g1y = pB1.y + dy * (0.5 - gapRatio);
            const g2x = pB1.x + dx * (0.5 + gapRatio);
            const g2y = pB1.y + dy * (0.5 + gapRatio);
            paths.push(`M ${pB1.x} ${pB1.y} L ${g1x} ${g1y}`);
            paths.push(`M ${g2x} ${g2y} L ${pB2.x} ${pB2.y}`);
            const bumpSize = cellSize * 0.2;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const px = -dy / len * bumpSize;
            const py = dx / len * bumpSize;
            bridgeOverPath = `M ${g1x} ${g1y} C ${g1x + px} ${g1y + py} ${g2x + px} ${g2y + py} ${g2x} ${g2y}`;
        }
    } else if (tile.type === 'source' || tile.type === 'bulb') {
        for (const dir of conns) {
            const ep = edgePoints[dir];
            if (ep) paths.push(`M ${cx} ${cy} L ${ep.x} ${ep.y}`);
        }
    } else if (count === 2) {
        const isLine = (baseConns.top && baseConns.bottom) || (baseConns.left && baseConns.right);
        if (isLine) {
            const ep1 = edgePoints[conns[0]];
            const ep2 = edgePoints[conns[1]];
            if (ep1 && ep2) paths.push(`M ${ep1.x} ${ep1.y} L ${ep2.x} ${ep2.y}`);
        } else {
            const cornerPoints: Record<string, { x: number; y: number }> = {
                'top-right': { x: cellSize, y: 0 },
                'right-top': { x: cellSize, y: 0 },
                'right-bottom': { x: cellSize, y: cellSize },
                'bottom-right': { x: cellSize, y: cellSize },
                'bottom-left': { x: 0, y: cellSize },
                'left-bottom': { x: 0, y: cellSize },
                'left-top': { x: 0, y: 0 },
                'top-left': { x: 0, y: 0 },
            };
            const p1 = edgePoints[conns[0]];
            const p2 = edgePoints[conns[1]];
            const cp = cornerPoints[`${conns[0]}-${conns[1]}`] || cornerPoints[`${conns[1]}-${conns[0]}`];
            if (p1 && p2 && cp) {
                paths.push(`M ${p1.x} ${p1.y} Q ${cp.x} ${cp.y} ${p2.x} ${p2.y}`);
            }
        }
    } else if (count >= 3) {
        for (const dir of conns) {
            const ep = edgePoints[dir];
            if (ep) paths.push(`M ${cx} ${cy} L ${ep.x} ${ep.y}`);
        }
    }

    return { paths, bridgeOverPath, isSource: tile.type === 'source', isBulb: tile.type === 'bulb' };
};

// Animasyonlu tile bileşeni
const AnimatedTile: React.FC<{
    tile: Tile;
    cellSize: number;
    strokeColor: string;
    onPress: () => void;
}> = React.memo(({ tile, cellSize, strokeColor, onPress }) => {
    const animRotation = useRef(new Animated.Value(tile.rotation * 90)).current;
    const prevRotation = useRef(tile.rotation);

    useEffect(() => {
        if (tile.rotation !== prevRotation.current) {
            const current = prevRotation.current * 90;
            const target = current + 90;
            animRotation.setValue(current);
            Animated.timing(animRotation, {
                toValue: target,
                duration: 200,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
            prevRotation.current = tile.rotation;
        }
    }, [tile.rotation]);

    const rotateStr = animRotation.interpolate({
        inputRange: [-360, 0, 360, 720, 1080, 1440],
        outputRange: ['-360deg', '0deg', '360deg', '720deg', '1080deg', '1440deg'],
    });

    const base = useMemo(() => computeBasePaths(tile, cellSize), [tile.type, tile.baseConnections, tile.bridgePaths, cellSize]);

    return (
        <Pressable
            style={{
                position: 'absolute',
                left: tile.position.col * cellSize,
                top: tile.position.row * cellSize,
                width: cellSize,
                height: cellSize,
                overflow: 'visible',
            }}
            onPress={onPress}
        >
            <Animated.View
                style={{
                    width: cellSize,
                    height: cellSize,
                    overflow: 'visible',
                    transform: [{ rotate: rotateStr }],
                }}
            >
                <Svg
                    width={cellSize + SVG_OVERFLOW * 2}
                    height={cellSize + SVG_OVERFLOW * 2}
                    viewBox={`${-SVG_OVERFLOW} ${-SVG_OVERFLOW} ${cellSize + SVG_OVERFLOW * 2} ${cellSize + SVG_OVERFLOW * 2}`}
                    style={{ marginLeft: -SVG_OVERFLOW, marginTop: -SVG_OVERFLOW }}
                >
                    {base.paths.map((d, i) => (
                        <Path
                            key={`p-${i}`}
                            d={d}
                            stroke={strokeColor}
                            strokeWidth={STROKE_WIDTH}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                    ))}
                    {base.bridgeOverPath && (
                        <Path
                            d={base.bridgeOverPath}
                            stroke={strokeColor}
                            strokeWidth={STROKE_WIDTH}
                            strokeLinecap="round"
                            fill="none"
                        />
                    )}
                    {(base.isSource || base.isBulb) && (
                        <Circle
                            cx={cellSize / 2}
                            cy={cellSize / 2}
                            r={NODE_RADIUS + 2}
                            fill={strokeColor}
                        />
                    )}
                </Svg>
            </Animated.View>
        </Pressable>
    );
});

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
    level,
    onTilePress,
    isSolved = false,
}) => {
    const canvasWidth = SCREEN_WIDTH - 20;
    const cellSize = canvasWidth / level.cols;
    const canvasHeight = cellSize * level.rows;

    const cableColor = isSolved ? COLORS.solvedActive : COLORS.active;
    const passiveColor = COLORS.passive;

    return (
        <View style={{
            width: canvasWidth,
            height: canvasHeight,
            overflow: 'visible',
        }}>
            {level.tiles.map(tile => {
                const color = tile.isPowered ? cableColor : passiveColor;
                const strokeColor = (tile.fixed && tile.type !== 'source' && !tile.isPowered) ? COLORS.fixed : color;

                return (
                    <AnimatedTile
                        key={tile.id}
                        tile={tile}
                        cellSize={cellSize}
                        strokeColor={strokeColor}
                        onPress={() => onTilePress(tile.id)}
                    />
                );
            })}
        </View>
    );
};
