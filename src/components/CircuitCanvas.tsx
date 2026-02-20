import React, { useMemo, useRef, useEffect } from 'react';
import { View, Dimensions, Pressable, Animated, Easing, Platform, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Polygon, G } from 'react-native-svg';
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

interface CircuitCanvasProps {
    level: Level;
    onTilePress: (tileId: string) => void;
    isSolved?: boolean;
    maxHeight?: number;
    containerWidth?: number;
    strokeScale?: number;
    blackout?: boolean;
}

// ===== ORTAK: Tile'ın base (rotation=0) halindeki SVG path'lerini hesapla =====
// Lokal koordinat sistemi: (0,0) -> (cellSize, cellSize)
// edgePoints hücre sınırında TAMI TAMINA durur (0 ve cellSize değerleri)
const computeBasePaths = (tile: Tile, cellSize: number) => {
    const baseConns = tile.baseConnections;
    const half = cellSize / 2;
    const cx = half;
    const cy = half;

    // Kenar noktaları: hücre sınırında tam
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
    let isBlocker = false;
    let isDiode = false;
    let diodeArrowPath: string | undefined;
    let isSwitch = false;
    let switchIndicatorPath: string | undefined;

    if (tile.type === 'blocker') {
        isBlocker = true;
        const size = cellSize * 0.3;
        paths.push(`M ${cx - size} ${cy - size} L ${cx + size} ${cy - size} L ${cx + size} ${cy + size} L ${cx - size} ${cy + size} Z`);
    } else if (tile.type === 'double-corner') {
        const bp = tile.bridgePaths || { pathA: ['top', 'right'] as const, pathB: ['bottom', 'left'] as const };

        const cornerPointsMap: Record<string, { x: number; y: number }> = {
            'top-right': { x: cellSize, y: 0 },
            'right-top': { x: cellSize, y: 0 },
            'right-bottom': { x: cellSize, y: cellSize },
            'bottom-right': { x: cellSize, y: cellSize },
            'bottom-left': { x: 0, y: cellSize },
            'left-bottom': { x: 0, y: cellSize },
            'left-top': { x: 0, y: 0 },
            'top-left': { x: 0, y: 0 },
        };

        const pA1 = edgePoints[bp.pathA[0]];
        const pA2 = edgePoints[bp.pathA[1]];
        const cpA = cornerPointsMap[`${bp.pathA[0]}-${bp.pathA[1]}`] || cornerPointsMap[`${bp.pathA[1]}-${bp.pathA[0]}`];
        if (pA1 && pA2 && cpA) {
            paths.push(`M ${pA1.x} ${pA1.y} Q ${cpA.x} ${cpA.y} ${pA2.x} ${pA2.y}`);
        }

        const pB1 = edgePoints[bp.pathB[0]];
        const pB2 = edgePoints[bp.pathB[1]];
        const cpB = cornerPointsMap[`${bp.pathB[0]}-${bp.pathB[1]}`] || cornerPointsMap[`${bp.pathB[1]}-${bp.pathB[0]}`];
        if (pB1 && pB2 && cpB) {
            const midX1 = pB1.x + (cpB.x - pB1.x) * 0.5;
            const midY1 = pB1.y + (cpB.y - pB1.y) * 0.5;
            const midX2 = cpB.x + (pB2.x - cpB.x) * 0.5;
            const midY2 = cpB.y + (pB2.y - cpB.y) * 0.5;

            paths.push(`M ${pB1.x} ${pB1.y} Q ${(pB1.x + cpB.x) / 2} ${(pB1.y + cpB.y) / 2} ${midX1} ${midY1}`);
            paths.push(`M ${midX2} ${midY2} Q ${(cpB.x + pB2.x) / 2} ${(cpB.y + pB2.y) / 2} ${pB2.x} ${pB2.y}`);
            const bumpSize = cellSize * 0.15;
            const dx = midX2 - midX1;
            const dy = midY2 - midY1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const px = -dy / len * bumpSize;
            const py = dx / len * bumpSize;
            bridgeOverPath = `M ${midX1} ${midY1} C ${midX1 + px} ${midY1 + py} ${midX2 + px} ${midY2 + py} ${midX2} ${midY2}`;
        }
    } else if (tile.type === 'diode') {
        isDiode = true;
        const ep1 = edgePoints[conns[0]];
        const ep2 = edgePoints[conns[1]];
        if (ep1 && ep2) paths.push(`M ${ep1.x} ${ep1.y} L ${ep2.x} ${ep2.y}`);

        if (tile.diodeDirection) {
            const arrowSize = cellSize * 0.12;
            const dirMap: Record<string, { dx: number; dy: number }> = {
                top: { dx: 0, dy: -1 },
                right: { dx: 1, dy: 0 },
                bottom: { dx: 0, dy: 1 },
                left: { dx: -1, dy: 0 },
            };
            const d = dirMap[tile.diodeDirection];
            if (d) {
                const tipX = cx + d.dx * arrowSize * 1.5;
                const tipY = cy + d.dy * arrowSize * 1.5;
                const baseX1 = cx - d.dy * arrowSize - d.dx * arrowSize * 0.5;
                const baseY1 = cy + d.dx * arrowSize - d.dy * arrowSize * 0.5;
                const baseX2 = cx + d.dy * arrowSize - d.dx * arrowSize * 0.5;
                const baseY2 = cy - d.dx * arrowSize - d.dy * arrowSize * 0.5;
                diodeArrowPath = `M ${tipX} ${tipY} L ${baseX1} ${baseY1} L ${baseX2} ${baseY2} Z`;
            }
        }
    } else if (tile.type === 'switch') {
        isSwitch = true;
        if (tile.switchStates) {
            const activeState = tile.switchState ? tile.switchStates.stateB : tile.switchStates.stateA;
            const activeConns = Object.entries(activeState).filter(([_, v]) => v).map(([k]) => k);
            const activeCount = activeConns.length;

            if (activeCount === 2) {
                const isLine = (activeState.top && activeState.bottom) || (activeState.left && activeState.right);
                if (isLine) {
                    const ep1 = edgePoints[activeConns[0]];
                    const ep2 = edgePoints[activeConns[1]];
                    if (ep1 && ep2) paths.push(`M ${ep1.x} ${ep1.y} L ${ep2.x} ${ep2.y}`);
                } else {
                    const cornerPts: Record<string, { x: number; y: number }> = {
                        'top-right': { x: cellSize, y: 0 },
                        'right-top': { x: cellSize, y: 0 },
                        'right-bottom': { x: cellSize, y: cellSize },
                        'bottom-right': { x: cellSize, y: cellSize },
                        'bottom-left': { x: 0, y: cellSize },
                        'left-bottom': { x: 0, y: cellSize },
                        'left-top': { x: 0, y: 0 },
                        'top-left': { x: 0, y: 0 },
                    };
                    const p1 = edgePoints[activeConns[0]];
                    const p2 = edgePoints[activeConns[1]];
                    const cp = cornerPts[`${activeConns[0]}-${activeConns[1]}`] || cornerPts[`${activeConns[1]}-${activeConns[0]}`];
                    if (p1 && p2 && cp) {
                        paths.push(`M ${p1.x} ${p1.y} Q ${cp.x} ${cp.y} ${p2.x} ${p2.y}`);
                    }
                }
            }
        }

        const ind = cellSize * 0.08;
        switchIndicatorPath = `M ${cx} ${cy - ind} L ${cx + ind} ${cy} L ${cx} ${cy + ind} L ${cx - ind} ${cy} Z`;
    } else if (tile.type === 'bridge') {
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
        const oppPairs: [string, string][] = [['top', 'bottom'], ['left', 'right']];
        const drawn = new Set<string>();

        for (const [a, b] of oppPairs) {
            if (conns.includes(a) && conns.includes(b)) {
                const epA = edgePoints[a];
                const epB = edgePoints[b];
                if (epA && epB) {
                    paths.push(`M ${epA.x} ${epA.y} L ${epB.x} ${epB.y}`);
                    drawn.add(a);
                    drawn.add(b);
                }
            }
        }

        for (const dir of conns) {
            if (!drawn.has(dir)) {
                const ep = edgePoints[dir];
                if (ep) paths.push(`M ${cx} ${cy} L ${ep.x} ${ep.y}`);
            }
        }
    }

    return {
        paths, bridgeOverPath, isSource: tile.type === 'source', isBulb: tile.type === 'bulb',
        isBlocker, isDiode, diodeArrowPath, isSwitch, switchIndicatorPath,
    };
};

// ===== NATIVE RENDERER: Per-tile SVG yaklaşımı (mevcut, kusursuz çalışıyor) =====
const NativeAnimatedTile: React.FC<{
    tile: Tile;
    cellSize: number;
    strokeColor: string;
    onPress: () => void;
    strokeScale: number;
    blackout?: boolean;
}> = React.memo(({ tile, cellSize, strokeColor, onPress, strokeScale, blackout }) => {
    const sw = STROKE_WIDTH * strokeScale;
    const nr = NODE_RADIUS * strokeScale;
    const svgOverflow = sw;

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

    const base = useMemo(() => computeBasePaths(tile, cellSize), [
        tile.type, tile.baseConnections, tile.bridgePaths, cellSize,
        tile.switchState, tile.switchStates, tile.diodeDirection,
    ]);

    const scaleAnim = useRef(new Animated.Value(1)).current;
    const prevSwitchState = useRef(tile.switchState);

    useEffect(() => {
        if (tile.type === 'switch' && tile.switchState !== prevSwitchState.current) {
            prevSwitchState.current = tile.switchState;
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.1,
                    duration: 100,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [tile.switchState]);

    const useRotation = tile.type !== 'switch' && tile.type !== 'blocker';

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
                    transform: useRotation
                        ? [{ rotate: rotateStr }]
                        : [{ scale: tile.type === 'switch' ? scaleAnim : 1 }],
                }}
            >
                <Svg
                    width={cellSize + svgOverflow * 2}
                    height={cellSize + svgOverflow * 2}
                    viewBox={`${-svgOverflow} ${-svgOverflow} ${cellSize + svgOverflow * 2} ${cellSize + svgOverflow * 2}`}
                    style={{ marginLeft: -svgOverflow, marginTop: -svgOverflow }}
                >
                    {!blackout && base.paths.map((d, i) => (
                        <Path
                            key={`p-${i}`}
                            d={d}
                            stroke={strokeColor}
                            strokeWidth={sw}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill={base.isBlocker ? strokeColor : 'none'}
                        />
                    ))}
                    {!blackout && base.bridgeOverPath && (
                        <Path
                            d={base.bridgeOverPath}
                            stroke={strokeColor}
                            strokeWidth={sw}
                            strokeLinecap="round"
                            fill="none"
                        />
                    )}
                    {!blackout && base.diodeArrowPath && (
                        <Path
                            d={base.diodeArrowPath}
                            fill={strokeColor}
                            stroke="none"
                        />
                    )}
                    {!blackout && base.switchIndicatorPath && (
                        <Path
                            d={base.switchIndicatorPath}
                            fill={strokeColor}
                            stroke="none"
                        />
                    )}
                    {(base.isSource || base.isBulb) && (
                        <Circle
                            cx={cellSize / 2}
                            cy={cellSize / 2}
                            r={nr + 2 * strokeScale}
                            fill={blackout ? COLORS.passive : strokeColor}
                        />
                    )}
                </Svg>
            </Animated.View>
        </Pressable>
    );
});

// ===== WEB RENDERER: Tek SVG yaklaşımı =====
// Tüm kablolar tek bir SVG koordinat sisteminde çizilir.
// Komşu tile kablolarının birleşim noktaları aynı pikselde buluşur,
// böylece sub-pixel gap sorunu fiziksel olarak imkansız hale gelir.

const AnimatedG = Animated.createAnimatedComponent(G);

// Web'de her tile'ın kablolarını tek SVG içinde <G> ile çizen bileşen
const WebTilePaths: React.FC<{
    tile: Tile;
    cellSize: number;
    strokeColor: string;
    strokeScale: number;
    blackout?: boolean;
}> = React.memo(({ tile, cellSize, strokeColor, strokeScale, blackout }) => {
    const sw = STROKE_WIDTH * strokeScale;
    const nr = NODE_RADIUS * strokeScale;
    const half = cellSize / 2;
    const ox = tile.position.col * cellSize;
    const oy = tile.position.row * cellSize;

    // === Rotation animasyonu ===
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
                useNativeDriver: false, // SVG prop'ları native driver desteklemez
            }).start();
            prevRotation.current = tile.rotation;
        }
    }, [tile.rotation]);

    // === Switch scale animasyonu ===
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const prevSwitchState = useRef(tile.switchState);

    useEffect(() => {
        if (tile.type === 'switch' && tile.switchState !== prevSwitchState.current) {
            prevSwitchState.current = tile.switchState;
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.1, duration: 100,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1, duration: 100,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: false,
                }),
            ]).start();
        }
    }, [tile.switchState]);

    // === Base path'leri hesapla ===
    const base = useMemo(() => computeBasePaths(tile, cellSize), [
        tile.type, tile.baseConnections, tile.bridgePaths, cellSize,
        tile.switchState, tile.switchStates, tile.diodeDirection,
    ]);

    const useRotation = tile.type !== 'switch' && tile.type !== 'blocker';

    // G grubu: tile'ın hücresel ofsetine konumlanır, merkezinden döner
    return (
        <AnimatedG
            x={ox}
            y={oy}
            rotation={useRotation ? animRotation : 0}
            originX={half}
            originY={half}
            scale={tile.type === 'switch' ? scaleAnim : 1}
        >
            {/* Kablo path'leri */}
            {!blackout && base.paths.map((d, i) => (
                <Path
                    key={`p-${i}`}
                    d={d}
                    stroke={strokeColor}
                    strokeWidth={sw}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill={base.isBlocker ? strokeColor : 'none'}
                />
            ))}
            {!blackout && base.bridgeOverPath && (
                <Path
                    d={base.bridgeOverPath}
                    stroke={strokeColor}
                    strokeWidth={sw}
                    strokeLinecap="round"
                    fill="none"
                />
            )}
            {!blackout && base.diodeArrowPath && (
                <Path
                    d={base.diodeArrowPath}
                    fill={strokeColor}
                    stroke="none"
                />
            )}
            {!blackout && base.switchIndicatorPath && (
                <Path
                    d={base.switchIndicatorPath}
                    fill={strokeColor}
                    stroke="none"
                />
            )}
            {(base.isSource || base.isBulb) && (
                <Circle
                    cx={half}
                    cy={half}
                    r={nr + 2 * strokeScale}
                    fill={blackout ? COLORS.passive : strokeColor}
                />
            )}
        </AnimatedG>
    );
});

// Web CircuitCanvas: Tek SVG + touch overlay
const WebCircuitCanvas: React.FC<CircuitCanvasProps> = ({
    level,
    onTilePress,
    isSolved = false,
    maxHeight,
    containerWidth,
    strokeScale = 1,
    blackout = false,
}) => {
    const canvasWidth = containerWidth ?? (SCREEN_WIDTH - 20);
    const cellW = canvasWidth / level.cols;
    const cellH = maxHeight ? maxHeight / level.rows : cellW;
    const cellSize = Math.min(cellW, cellH);
    const actualWidth = cellSize * level.cols;
    const canvasHeight = cellSize * level.rows;
    const svgPad = STROKE_WIDTH * strokeScale; // Kenar taşması payı

    const cableColor = isSolved ? COLORS.solvedActive : COLORS.active;
    const passiveColor = COLORS.passive;

    return (
        <View style={{
            width: actualWidth,
            height: canvasHeight,
            overflow: 'visible',
        }}>
            {/* TEK SVG: Tüm kablolar burada çizilir */}
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    left: -svgPad,
                    top: -svgPad,
                    width: actualWidth + svgPad * 2,
                    height: canvasHeight + svgPad * 2,
                }}
            >
                <Svg
                    width={actualWidth + svgPad * 2}
                    height={canvasHeight + svgPad * 2}
                    viewBox={`${-svgPad} ${-svgPad} ${actualWidth + svgPad * 2} ${canvasHeight + svgPad * 2}`}
                >
                    {level.tiles.map(tile => {
                        const color = tile.isPowered ? cableColor : passiveColor;
                        const strokeColor = (tile.fixed && tile.type !== 'source' && !tile.isPowered) ? COLORS.fixed : color;

                        return (
                            <WebTilePaths
                                key={tile.id}
                                tile={tile}
                                cellSize={cellSize}
                                strokeColor={strokeColor}
                                strokeScale={strokeScale}
                                blackout={blackout}
                            />
                        );
                    })}
                </Svg>
            </View>

            {/* TOUCH OVERLAY: Görünmez Pressable'lar dokunma olaylarını yakalar */}
            {level.tiles.map(tile => (
                <Pressable
                    key={`touch-${tile.id}`}
                    style={{
                        position: 'absolute',
                        left: tile.position.col * cellSize,
                        top: tile.position.row * cellSize,
                        width: cellSize,
                        height: cellSize,
                    }}
                    onPress={() => onTilePress(tile.id)}
                />
            ))}
        </View>
    );
};

// ===== MAIN COMPONENT: Platform'a göre renderer seç =====
export const CircuitCanvas: React.FC<CircuitCanvasProps> = (props) => {
    // Web: Tek SVG ile kusursuz kablo birleşimleri
    if (Platform.OS === 'web') {
        return <WebCircuitCanvas {...props} />;
    }

    // Native: Per-tile SVG yaklaşımı (zaten kusursuz)
    const {
        level, onTilePress, isSolved = false,
        maxHeight, containerWidth, strokeScale = 1, blackout = false,
    } = props;

    const canvasWidth = containerWidth ?? (SCREEN_WIDTH - 20);
    const cellW = canvasWidth / level.cols;
    const cellH = maxHeight ? maxHeight / level.rows : cellW;
    const cellSize = Math.min(cellW, cellH);
    const actualWidth = cellSize * level.cols;
    const canvasHeight = cellSize * level.rows;

    const cableColor = isSolved ? COLORS.solvedActive : COLORS.active;
    const passiveColor = COLORS.passive;

    return (
        <View style={{
            width: actualWidth,
            height: canvasHeight,
            overflow: 'visible',
        }}>
            {level.tiles.map(tile => {
                const color = tile.isPowered ? cableColor : passiveColor;
                const strokeColor = (tile.fixed && tile.type !== 'source' && !tile.isPowered) ? COLORS.fixed : color;

                return (
                    <NativeAnimatedTile
                        key={tile.id}
                        tile={tile}
                        cellSize={cellSize}
                        strokeColor={strokeColor}
                        onPress={() => onTilePress(tile.id)}
                        strokeScale={strokeScale}
                        blackout={blackout}
                    />
                );
            })}
        </View>
    );
};
