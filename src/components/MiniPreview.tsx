import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import {
    Level,
    Tile,
    getActiveConnections,
    getActiveBridgePaths,
    calculatePowerFlow,
} from '../types/circuit';
import { COLORS } from './CircuitCanvas';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MiniPreviewProps {
    level: Level;
}

const PREVIEW_SCALE = 0.22;
const STROKE_WIDTH = 2;
const NODE_RADIUS = 1.5;

export const MiniPreview: React.FC<MiniPreviewProps> = ({ level }) => {
    const solvedLevel = useMemo(() => {
        const solvedTiles: Tile[] = level.tiles.map(t => ({
            ...t,
            rotation: t.solvedRotation,
        }));
        calculatePowerFlow(solvedTiles);
        return { ...level, tiles: solvedTiles, isSolved: true };
    }, [level]);

    const canvasWidth = (SCREEN_WIDTH - 20) * PREVIEW_SCALE;
    const cellSize = canvasWidth / solvedLevel.cols;
    const canvasHeight = cellSize * solvedLevel.rows;

    const color = COLORS.active;

    return (
        <View style={[styles.container, { width: canvasWidth + 16, height: canvasHeight + 16 }]}>
            <Svg width={canvasWidth} height={canvasHeight}>
                {solvedLevel.tiles.map(tile => {
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

                    const conns = Object.entries(activeConns).filter(([_, v]) => v).map(([k]) => k);
                    const count = conns.length;
                    const paths: string[] = [];

                    if (tile.type === 'bridge') {
                        const bp = getActiveBridgePaths(tile);
                        const pA1 = edgePoints[bp.pathA[0]];
                        const pA2 = edgePoints[bp.pathA[1]];
                        if (pA1 && pA2) paths.push(`M ${pA1.x} ${pA1.y} L ${pA2.x} ${pA2.y}`);
                        const pB1 = edgePoints[bp.pathB[0]];
                        const pB2 = edgePoints[bp.pathB[1]];
                        if (pB1 && pB2) {
                            const dx = pB2.x - pB1.x;
                            const dy = pB2.y - pB1.y;
                            const gr = 0.15;
                            const g1x = pB1.x + dx * (0.5 - gr);
                            const g1y = pB1.y + dy * (0.5 - gr);
                            const g2x = pB1.x + dx * (0.5 + gr);
                            const g2y = pB1.y + dy * (0.5 + gr);
                            paths.push(`M ${pB1.x} ${pB1.y} L ${g1x} ${g1y}`);
                            paths.push(`M ${g2x} ${g2y} L ${pB2.x} ${pB2.y}`);
                            const bs = cellSize * 0.2;
                            const len = Math.sqrt(dx * dx + dy * dy) || 1;
                            const px = -dy / len * bs;
                            const py = dx / len * bs;
                            paths.push(`M ${g1x} ${g1y} C ${g1x + px} ${g1y + py} ${g2x + px} ${g2y + py} ${g2x} ${g2y}`);
                        }
                    } else if (tile.type === 'source' || tile.type === 'bulb') {
                        for (const dir of conns) {
                            const ep = edgePoints[dir];
                            if (ep) paths.push(`M ${cx} ${cy} L ${ep.x} ${ep.y}`);
                        }
                    } else if (count === 2) {
                        const isLine = (activeConns.top && activeConns.bottom) || (activeConns.left && activeConns.right);
                        if (isLine) {
                            const ep1 = edgePoints[conns[0]];
                            const ep2 = edgePoints[conns[1]];
                            if (ep1 && ep2) paths.push(`M ${ep1.x} ${ep1.y} L ${ep2.x} ${ep2.y}`);
                        } else {
                            const cornerMap: Record<string, { x: number; y: number }> = {
                                'top-right': { x: cx + half, y: cy - half },
                                'right-top': { x: cx + half, y: cy - half },
                                'right-bottom': { x: cx + half, y: cy + half },
                                'bottom-right': { x: cx + half, y: cy + half },
                                'bottom-left': { x: cx - half, y: cy + half },
                                'left-bottom': { x: cx - half, y: cy + half },
                                'left-top': { x: cx - half, y: cy - half },
                                'top-left': { x: cx - half, y: cy - half },
                            };
                            const p1 = edgePoints[conns[0]];
                            const p2 = edgePoints[conns[1]];
                            const cp = cornerMap[`${conns[0]}-${conns[1]}`] || cornerMap[`${conns[1]}-${conns[0]}`];
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

                    return (
                        <G key={tile.id}>
                            {paths.map((d, i) => (
                                <Path
                                    key={`p-${tile.id}-${i}`}
                                    d={d}
                                    stroke={color}
                                    strokeWidth={STROKE_WIDTH}
                                    strokeLinecap="round"
                                    fill="none"
                                />
                            ))}
                            {(tile.type === 'source' || tile.type === 'bulb') && (
                                <Circle cx={cx} cy={cy} r={NODE_RADIUS + 1} fill={color} />
                            )}
                        </G>
                    );
                })}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(107,123,58,0.06)',
        borderRadius: 10,
        padding: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
