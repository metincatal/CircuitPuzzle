import React, { useMemo } from 'react';
import { View, Dimensions, Pressable } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import {
    Level,
    Tile,
    getActiveConnections,
    getActiveBridgePaths,
} from '../types/circuit';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Loop tarzı açık tema renk paleti
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
const ENDPOINT_RADIUS = 4;

interface CircuitCanvasProps {
    level: Level;
    onTilePress: (tileId: string) => void;
    isSolved?: boolean;
}

interface TileGraphics {
    id: string;
    position: { row: number; col: number };
    type: string;
    rotation: number;
    isPowered: boolean;
    fixed: boolean;
    cx: number;
    cy: number;
    paths: string[];
    bridgeOverPath?: string;
    isJunction: boolean;
    endPoints: { x: number; y: number }[];
}

/**
 * Corner için çeyrek daire arc yolu oluştur
 */
const makeCornerArc = (
    cx: number, cy: number, half: number,
    dir1: string, dir2: string
): { path: string; endPoints: { x: number; y: number }[] } => {
    const edgePoints: Record<string, { x: number; y: number }> = {
        top: { x: cx, y: cy - half },
        right: { x: cx + half, y: cy },
        bottom: { x: cx, y: cy + half },
        left: { x: cx - half, y: cy },
    };

    const cornerPoints: Record<string, { x: number; y: number }> = {
        'top-right': { x: cx + half, y: cy - half },
        'right-top': { x: cx + half, y: cy - half },
        'right-bottom': { x: cx + half, y: cy + half },
        'bottom-right': { x: cx + half, y: cy + half },
        'bottom-left': { x: cx - half, y: cy + half },
        'left-bottom': { x: cx - half, y: cy + half },
        'left-top': { x: cx - half, y: cy - half },
        'top-left': { x: cx - half, y: cy - half },
    };

    const p1 = edgePoints[dir1];
    const p2 = edgePoints[dir2];
    const cp = cornerPoints[`${dir1}-${dir2}`] || cornerPoints[`${dir2}-${dir1}`];

    if (!p1 || !p2 || !cp) {
        return { path: `M ${p1?.x || cx} ${p1?.y || cy} L ${p2?.x || cx} ${p2?.y || cy}`, endPoints: [] };
    }

    return {
        path: `M ${p1.x} ${p1.y} Q ${cp.x} ${cp.y} ${p2.x} ${p2.y}`,
        endPoints: [p1, p2],
    };
};

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

    const tileGraphics = useMemo(() => {
        return level.tiles.map(tile => {
            const activeConns = getActiveConnections(tile);

            const cx = tile.position.col * cellSize + cellSize / 2;
            const cy = tile.position.row * cellSize + cellSize / 2;
            const half = cellSize / 2;

            const edgePoints: Record<string, { x: number; y: number }> = {
                top: { x: cx, y: cy - half },
                right: { x: cx + half, y: cy },
                bottom: { x: cx, y: cy + half },
                left: { x: cx - half, y: cy },
            };

            let paths: string[] = [];
            let bridgeOverPath: string | undefined;
            let isJunction = false;
            let endPoints: { x: number; y: number }[] = [];

            const conns = Object.entries(activeConns).filter(([_, v]) => v).map(([k]) => k);
            const count = conns.length;

            if (tile.type === 'bridge') {
                // Bridge: iki bağımsız path
                const bp = getActiveBridgePaths(tile);

                // PathA: düz çizgi
                const pA1 = edgePoints[bp.pathA[0]];
                const pA2 = edgePoints[bp.pathA[1]];
                if (pA1 && pA2) {
                    paths.push(`M ${pA1.x} ${pA1.y} L ${pA2.x} ${pA2.y}`);
                    endPoints.push(pA1, pA2);
                }

                // PathB: kavisli "üstten atlama" yolu
                const pB1 = edgePoints[bp.pathB[0]];
                const pB2 = edgePoints[bp.pathB[1]];
                if (pB1 && pB2) {
                    // Yarım daire şeklinde atlama
                    const midX = (pB1.x + pB2.x) / 2;
                    const midY = (pB1.y + pB2.y) / 2;
                    const dx = pB2.x - pB1.x;
                    const dy = pB2.y - pB1.y;
                    // Perpendicular offset (atlama yüksekliği)
                    const bumpSize = cellSize * 0.2;
                    const perpX = -dy / Math.sqrt(dx * dx + dy * dy) * bumpSize;
                    const perpY = dx / Math.sqrt(dx * dx + dy * dy) * bumpSize;

                    const cp1x = pB1.x + (pB2.x - pB1.x) * 0.3 + perpX;
                    const cp1y = pB1.y + (pB2.y - pB1.y) * 0.3 + perpY;
                    const cp2x = pB1.x + (pB2.x - pB1.x) * 0.7 + perpX;
                    const cp2y = pB1.y + (pB2.y - pB1.y) * 0.7 + perpY;

                    // Düz çizgi parçaları + gap (kesinti)
                    const gapRatio = 0.15;
                    const gapStart1X = pB1.x + dx * (0.5 - gapRatio);
                    const gapStart1Y = pB1.y + dy * (0.5 - gapRatio);
                    const gapEnd2X = pB1.x + dx * (0.5 + gapRatio);
                    const gapEnd2Y = pB1.y + dy * (0.5 + gapRatio);

                    // İki parçalı çizgi (ortada boşluk) + üstten atlayan kavis
                    paths.push(`M ${pB1.x} ${pB1.y} L ${gapStart1X} ${gapStart1Y}`);
                    paths.push(`M ${gapEnd2X} ${gapEnd2Y} L ${pB2.x} ${pB2.y}`);

                    // Üstten atlayan yarım daire
                    bridgeOverPath = `M ${gapStart1X} ${gapStart1Y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${gapEnd2X} ${gapEnd2Y}`;

                    endPoints.push(pB1, pB2);
                }
            } else if (tile.type === 'source' || tile.type === 'bulb') {
                // Endpoint: merkezden kenar yönüne düz çizgi
                for (const dir of conns) {
                    const ep = edgePoints[dir];
                    if (ep) {
                        paths.push(`M ${cx} ${cy} L ${ep.x} ${ep.y}`);
                        endPoints.push(ep);
                    }
                }
                // Merkez node
                endPoints.push({ x: cx, y: cy });
            } else if (count === 2) {
                const isLine = (activeConns.top && activeConns.bottom) || (activeConns.left && activeConns.right);
                if (isLine) {
                    // Line: düz çizgi
                    const ep1 = edgePoints[conns[0]];
                    const ep2 = edgePoints[conns[1]];
                    if (ep1 && ep2) {
                        paths.push(`M ${ep1.x} ${ep1.y} L ${ep2.x} ${ep2.y}`);
                        endPoints.push(ep1, ep2);
                    }
                } else {
                    // Corner: çeyrek daire arc
                    const result = makeCornerArc(cx, cy, half, conns[0], conns[1]);
                    paths.push(result.path);
                    endPoints.push(...result.endPoints);
                }
            } else if (count >= 3) {
                // T-shape veya Cross: merkezden her yöne düz çizgi
                isJunction = true;
                for (const dir of conns) {
                    const ep = edgePoints[dir];
                    if (ep) {
                        paths.push(`M ${cx} ${cy} L ${ep.x} ${ep.y}`);
                        endPoints.push(ep);
                    }
                }
            }

            return {
                ...tile,
                cx, cy, paths, bridgeOverPath, isJunction, endPoints,
            } as TileGraphics;
        });
    }, [level, cellSize]);

    return (
        <View style={{ width: canvasWidth, height: canvasHeight }}>
            <Svg width={canvasWidth} height={canvasHeight}>
                {/* KABLO LAYER */}
                {tileGraphics.map(t => {
                    const color = t.isPowered ? cableColor : passiveColor;
                    const fixedColor = t.fixed && t.type !== 'source' ? COLORS.fixed : color;
                    const strokeColor = t.isPowered ? color : fixedColor;

                    return (
                        <G key={t.id}>
                            {/* Ana path'ler */}
                            {t.paths.map((d, i) => (
                                <Path
                                    key={`path-${t.id}-${i}`}
                                    d={d}
                                    stroke={strokeColor}
                                    strokeWidth={STROKE_WIDTH}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            ))}

                            {/* Bridge atlama kavisi */}
                            {t.bridgeOverPath && (
                                <Path
                                    d={t.bridgeOverPath}
                                    stroke={strokeColor}
                                    strokeWidth={STROKE_WIDTH}
                                    strokeLinecap="round"
                                    fill="none"
                                />
                            )}

                            {/* Junction dairesi (T-shape, Cross) */}
                            {t.isJunction && (
                                <Circle
                                    cx={t.cx}
                                    cy={t.cy}
                                    r={NODE_RADIUS}
                                    fill={strokeColor}
                                />
                            )}

                            {/* Endpoint daireleri */}
                            {t.endPoints.map((ep, i) => (
                                <Circle
                                    key={`ep-${t.id}-${i}`}
                                    cx={ep.x}
                                    cy={ep.y}
                                    r={ENDPOINT_RADIUS}
                                    fill={strokeColor}
                                />
                            ))}

                            {/* Source ve Bulb merkez dairesi */}
                            {(t.type === 'source' || t.type === 'bulb') && (
                                <Circle
                                    cx={t.cx}
                                    cy={t.cy}
                                    r={NODE_RADIUS + 2}
                                    fill={strokeColor}
                                />
                            )}
                        </G>
                    );
                })}
            </Svg>

            {/* TOUCH LAYER */}
            {tileGraphics.map(t => (
                <Pressable
                    key={`touch-${t.id}`}
                    style={{
                        position: 'absolute',
                        left: t.position.col * cellSize,
                        top: t.position.row * cellSize,
                        width: cellSize,
                        height: cellSize,
                    }}
                    onPress={() => onTilePress(t.id)}
                />
            ))}
        </View>
    );
};
