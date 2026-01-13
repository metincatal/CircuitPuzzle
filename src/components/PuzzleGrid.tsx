import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Pressable, Text, Animated } from 'react-native';
import { PuzzlePiece, PieceType } from './PuzzlePiece';
import { findPoweredCells, isCircuitClosed, GridCell } from '../utils/connectionLogic';
import { generateSolvableLevel, DIFFICULTY_SETTINGS } from '../utils/levelGenerator';
import { rotateEffect, newLevelEffect } from '../utils/effects';

const { width } = Dimensions.get('window');

type Difficulty = 'easy' | 'medium' | 'hard';

interface PuzzleGridProps {
    difficulty?: Difficulty;
    onCellPress?: (row: number, col: number) => void;
    onPuzzleSolved?: () => void;
    onNewLevel?: () => void;
}

/**
 * Puzzle grid bileşeni
 * Seviye üretici ile rastgele çözülebilir puzzle oluşturur
 */
export const PuzzleGrid: React.FC<PuzzleGridProps> = ({
    difficulty = 'easy',
    onCellPress,
    onPuzzleSolved,
    onNewLevel,
}) => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const gridSize = settings.gridSize;
    const calculatedCellSize = Math.floor((width - 60) / gridSize);

    // Animasyon değerleri
    const gridScale = useRef(new Animated.Value(1)).current;
    const gridOpacity = useRef(new Animated.Value(1)).current;

    // Grid state'i
    const [grid, setGrid] = useState<GridCell[][]>(() =>
        generateSolvableLevel(gridSize, difficulty)
    );

    // Powered state'i
    const [poweredCells, setPoweredCells] = useState<boolean[][]>([]);
    const [isSolved, setIsSolved] = useState(false);
    const [levelKey, setLevelKey] = useState(0);

    // Yeni seviye oluştur (animasyonlu)
    const generateNewLevel = useCallback(async () => {
        // Haptic feedback
        await newLevelEffect();

        // Küçülme animasyonu
        Animated.parallel([
            Animated.timing(gridScale, {
                toValue: 0.8,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(gridOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Yeni grid oluştur
            const newGrid = generateSolvableLevel(gridSize, difficulty);
            setGrid(newGrid);
            setIsSolved(false);
            setLevelKey(prev => prev + 1);
            onNewLevel?.();

            // Büyüme animasyonu
            Animated.parallel([
                Animated.spring(gridScale, {
                    toValue: 1,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(gridOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    }, [gridSize, difficulty, onNewLevel, gridScale, gridOpacity]);

    // Zorluk değişince yeni seviye
    useEffect(() => {
        const newGrid = generateSolvableLevel(gridSize, difficulty);
        setGrid(newGrid);
        setIsSolved(false);
        setLevelKey(prev => prev + 1);
    }, [difficulty, gridSize]);

    // Grid değiştiğinde bağlantıları kontrol et
    useEffect(() => {
        const powered = findPoweredCells(grid);
        setPoweredCells(powered);

        // Kapalı devre kontrolü - ampulün 2 yönden bağlı olması gerekli
        const solved = isCircuitClosed(grid, powered);
        if (solved && !isSolved) {
            setIsSolved(true);
            onPuzzleSolved?.();
        } else if (!solved && isSolved) {
            setIsSolved(false);
        }
    }, [grid, isSolved, onPuzzleSolved]);

    // Hücreye tıklama (haptic ile)
    const handleCellPress = useCallback(async (row: number, col: number) => {
        // Haptic feedback
        await rotateEffect();

        setGrid(prevGrid => {
            const newGrid = prevGrid.map((r, rIdx) =>
                r.map((cell, cIdx) => {
                    if (rIdx === row && cIdx === col) {
                        return {
                            ...cell,
                            rotation: cell.rotation + 90,
                        };
                    }
                    return cell;
                })
            );
            return newGrid;
        });

        onCellPress?.(row, col);
    }, [onCellPress]);

    const isCellPowered = (row: number, col: number): boolean => {
        return poweredCells[row]?.[col] || false;
    };

    return (
        <View style={styles.container}>
            {/* Grid (animasyonlu) */}
            <Animated.View
                key={levelKey}
                style={[
                    styles.grid,
                    {
                        width: calculatedCellSize * gridSize + 4,
                        height: calculatedCellSize * gridSize + 4,
                        borderColor: isSolved ? 'rgba(0, 255, 170, 0.8)' : 'rgba(0, 255, 170, 0.3)',
                        transform: [{ scale: gridScale }],
                        opacity: gridOpacity,
                    }
                ]}
            >
                {grid.map((row, rowIndex) => (
                    <View key={`row-${rowIndex}`} style={styles.row}>
                        {row.map((cell, colIndex) => (
                            <View
                                key={`cell-${rowIndex}-${colIndex}`}
                                style={[
                                    styles.cell,
                                    {
                                        width: calculatedCellSize,
                                        height: calculatedCellSize,
                                    }
                                ]}
                            >
                                <PuzzlePiece
                                    type={cell.type}
                                    rotation={cell.rotation}
                                    size={calculatedCellSize}
                                    onPress={() => handleCellPress(rowIndex, colIndex)}
                                    isPowered={isCellPowered(rowIndex, colIndex)}
                                    isSource={cell.isSource}
                                    isBulb={cell.isBulb}
                                    color="#444444"
                                />
                            </View>
                        ))}
                    </View>
                ))}
            </Animated.View>

            {/* Yeni Seviye Butonu */}
            <Pressable style={styles.newLevelButton} onPress={generateNewLevel}>
                <Text style={styles.newLevelText}>🔄 Yeni Seviye</Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    grid: {
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 16,
        borderWidth: 2,
        padding: 2,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
    },
    cell: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    newLevelButton: {
        marginTop: 20,
        backgroundColor: 'rgba(0, 170, 255, 0.15)',
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#00aaff',
    },
    newLevelText: {
        color: '#00aaff',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1,
    },
});

export default PuzzleGrid;
