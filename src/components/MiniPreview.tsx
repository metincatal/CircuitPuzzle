import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
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
            switchState: t.solvedSwitchState,
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
                    let isBlocker = false;
                    let diodeArrow: string | undefined;
                    let switchIndicator: string | undefined;

                    if (tile.type === 'blocker') {
                        isBlocker = true;
                        const size = cellSize * 0.3;
                        paths.push(`M ${cx - size} ${cy - size} L ${cx + size} ${cy - size} L ${cx + size} ${cy + size} L ${cx - size} ${cy + size} Z`);
                    } else if (tile.type === 'double-corner') {
                        const bp = getActiveBridgePaths(tile);
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
                        // PathA: kavisli
                        const pA1 = edgePoints[bp.pathA[0]];
                        const pA2 = edgePoints[bp.pathA[1]];
                        const cpA = cornerMap[`${bp.pathA[0]}-${bp.pathA[1]}`] || cornerMap[`${bp.pathA[1]}-${bp.pathA[0]}`];
                        if (pA1 && pA2 && cpA) {
                            paths.push(`M ${pA1.x} ${pA1.y} Q ${cpA.x} ${cpA.y} ${pA2.x} ${pA2.y}`);
                        }
                        // PathB: kavisli + bump
                        const pB1 = edgePoints[bp.pathB[0]];
                        const pB2 = edgePoints[bp.pathB[1]];
                        const cpB = cornerMap[`${bp.pathB[0]}-${bp.pathB[1]}`] || cornerMap[`${bp.pathB[1]}-${bp.pathB[0]}`];
                        if (pB1 && pB2 && cpB) {
                            const midX1 = pB1.x + (cpB.x - pB1.x) * 0.5;
                            const midY1 = pB1.y + (cpB.y - pB1.y) * 0.5;
                            const midX2 = cpB.x + (pB2.x - cpB.x) * 0.5;
                            const midY2 = cpB.y + (pB2.y - cpB.y) * 0.5;
                            paths.push(`M ${pB1.x} ${pB1.y} Q ${(pB1.x + cpB.x) / 2} ${(pB1.y + cpB.y) / 2} ${midX1} ${midY1}`);
                            paths.push(`M ${midX2} ${midY2} Q ${(cpB.x + pB2.x) / 2} ${(cpB.y + pB2.y) / 2} ${pB2.x} ${pB2.y}`);
                            const bs = cellSize * 0.15;
                            const dx = midX2 - midX1;
                            const dy = midY2 - midY1;
                            const len = Math.sqrt(dx * dx + dy * dy) || 1;
                            const px = -dy / len * bs;
                            const py = dx / len * bs;
                            paths.push(`M ${midX1} ${midY1} C ${midX1 + px} ${midY1 + py} ${midX2 + px} ${midY2 + py} ${midX2} ${midY2}`);
                        }
                    } else if (tile.type === 'diode') {
                        const ep1 = edgePoints[conns[0]];
                        const ep2 = edgePoints[conns[1]];
                        if (ep1 && ep2) paths.push(`M ${ep1.x} ${ep1.y} L ${ep2.x} ${ep2.y}`);
                        // Ok işareti (küçük)
                        if (tile.diodeDirection) {
                            const dirs: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
                            const rotIdx = (dirs.indexOf(tile.diodeDirection) + tile.rotation) % 4;
                            const rotDir = dirs[rotIdx];
                            const dm: Record<string, { dx: number; dy: number }> = {
                                top: { dx: 0, dy: -1 }, right: { dx: 1, dy: 0 },
                                bottom: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 },
                            };
                            const dd = dm[rotDir];
                            const as = cellSize * 0.1;
                            if (dd) {
                                diodeArrow = `M ${cx + dd.dx * as * 1.5} ${cy + dd.dy * as * 1.5} L ${cx - dd.dy * as - dd.dx * as * 0.5} ${cy + dd.dx * as - dd.dy * as * 0.5} L ${cx + dd.dy * as - dd.dx * as * 0.5} ${cy - dd.dx * as - dd.dy * as * 0.5} Z`;
                            }
                        }
                    } else if (tile.type === 'switch') {
                        // Switch: solved state'e göre çiz
                        const activeState = tile.switchState ? tile.switchStates?.stateB : tile.switchStates?.stateA;
                        if (activeState) {
                            const sw = Object.entries(activeState).filter(([_, v]) => v).map(([k]) => k);
                            if (sw.length === 2) {
                                const isLine = (activeState.top && activeState.bottom) || (activeState.left && activeState.right);
                                if (isLine) {
                                    const e1 = edgePoints[sw[0]];
                                    const e2 = edgePoints[sw[1]];
                                    if (e1 && e2) paths.push(`M ${e1.x} ${e1.y} L ${e2.x} ${e2.y}`);
                                } else {
                                    const cMap: Record<string, { x: number; y: number }> = {
                                        'top-right': { x: cx + half, y: cy - half },
                                        'right-top': { x: cx + half, y: cy - half },
                                        'right-bottom': { x: cx + half, y: cy + half },
                                        'bottom-right': { x: cx + half, y: cy + half },
                                        'bottom-left': { x: cx - half, y: cy + half },
                                        'left-bottom': { x: cx - half, y: cy + half },
                                        'left-top': { x: cx - half, y: cy - half },
                                        'top-left': { x: cx - half, y: cy - half },
                                    };
                                    const sp1 = edgePoints[sw[0]];
                                    const sp2 = edgePoints[sw[1]];
                                    const scp = cMap[`${sw[0]}-${sw[1]}`] || cMap[`${sw[1]}-${sw[0]}`];
                                    if (sp1 && sp2 && scp) {
                                        paths.push(`M ${sp1.x} ${sp1.y} Q ${scp.x} ${scp.y} ${sp2.x} ${sp2.y}`);
                                    }
                                }
                            }
                        }
                        const ind = cellSize * 0.06;
                        switchIndicator = `M ${cx} ${cy - ind} L ${cx + ind} ${cy} L ${cx} ${cy + ind} L ${cx - ind} ${cy} Z`;
                    } else if (tile.type === 'bridge') {
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
                        // Through-line yaklaşımı: merkez pürüzlerini önler
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

                    return (
                        <G key={tile.id}>
                            {paths.map((d, i) => (
                                <Path
                                    key={`p-${tile.id}-${i}`}
                                    d={d}
                                    stroke={color}
                                    strokeWidth={STROKE_WIDTH}
                                    strokeLinecap="round"
                                    fill={isBlocker ? color : 'none'}
                                />
                            ))}
                            {diodeArrow && (
                                <Path
                                    d={diodeArrow}
                                    fill={color}
                                    stroke="none"
                                />
                            )}
                            {switchIndicator && (
                                <Path
                                    d={switchIndicator}
                                    fill={color}
                                    stroke="none"
                                />
                            )}
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
