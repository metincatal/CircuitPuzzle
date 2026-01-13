import { PieceType } from '../components/PuzzlePiece';

// Yönler: 0 = Üst, 1 = Sağ, 2 = Alt, 3 = Sol
export type Direction = 0 | 1 | 2 | 3;

// Her parça tipinin hangi yönlere bağlantısı olduğu (rotation=0 için)
const PIECE_CONNECTIONS: Record<PieceType, Direction[]> = {
    'L': [0, 1],      // Üst ve Sağ
    'I': [0, 2],      // Üst ve Alt (düz çizgi)
    'T': [0, 1, 3],   // Üst, Sağ, Sol
    'X': [0, 1, 2, 3], // Tüm yönler
    'empty': [],
};

// Zıt yönleri döndür (bağlantı kontrolü için)
export const getOppositeDirection = (dir: Direction): Direction => {
    return ((dir + 2) % 4) as Direction;
};

// Yön offsetleri: [row, col] değişimi
export const DIRECTION_OFFSETS: Record<Direction, [number, number]> = {
    0: [-1, 0],  // Üst
    1: [0, 1],   // Sağ
    2: [1, 0],   // Alt
    3: [0, -1],  // Sol
};

/**
 * Bir parçanın belirli bir rotasyonda hangi yönlere bağlantısı olduğunu döndürür
 */
export const getConnections = (type: PieceType, rotation: number): Direction[] => {
    const baseConnections = PIECE_CONNECTIONS[type] || [];

    // Rotasyon 90'ın katı olmalı (0, 90, 180, 270)
    const rotationSteps = Math.floor(((rotation % 360) + 360) % 360 / 90);

    // Her bağlantıyı rotasyona göre döndür
    return baseConnections.map(dir => {
        return ((dir + rotationSteps) % 4) as Direction;
    });
};

/**
 * Bir parçanın belirli bir yöne bağlantısı var mı?
 */
export const hasConnection = (type: PieceType, rotation: number, direction: Direction): boolean => {
    const connections = getConnections(type, rotation);
    return connections.includes(direction);
};

/**
 * İki komşu hücrenin birbirine bağlı olup olmadığını kontrol eder
 */
export const areCellsConnected = (
    cell1Type: PieceType,
    cell1Rotation: number,
    cell2Type: PieceType,
    cell2Rotation: number,
    directionFrom1To2: Direction
): boolean => {
    // Cell1'in cell2 yönüne bağlantısı var mı?
    const cell1HasConnection = hasConnection(cell1Type, cell1Rotation, directionFrom1To2);

    // Cell2'nin cell1 yönüne (zıt yön) bağlantısı var mı?
    const oppositeDir = getOppositeDirection(directionFrom1To2);
    const cell2HasConnection = hasConnection(cell2Type, cell2Rotation, oppositeDir);

    return cell1HasConnection && cell2HasConnection;
};

/**
 * Grid hücresi
 */
export interface GridCell {
    type: PieceType;
    rotation: number;
    isSource?: boolean;  // Güç kaynağı mı?
    isBulb?: boolean;    // Ampul mü?
    isPowered?: boolean; // Enerji var mı?
}

/**
 * BFS ile güç kaynağından başlayarak bağlı tüm hücreleri bulur
 */
export const findPoweredCells = (grid: GridCell[][]): boolean[][] => {
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    // Powered durumunu tutan matris
    const powered: boolean[][] = Array(rows).fill(null).map(() => Array(cols).fill(false));

    // Ziyaret edilen hücreler
    const visited: boolean[][] = Array(rows).fill(null).map(() => Array(cols).fill(false));

    // BFS kuyruğu
    const queue: [number, number][] = [];

    // Güç kaynaklarını bul ve kuyruğa ekle
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (grid[row][col].isSource) {
                queue.push([row, col]);
                visited[row][col] = true;
                powered[row][col] = true;
            }
        }
    }

    // BFS
    while (queue.length > 0) {
        const [currentRow, currentCol] = queue.shift()!;
        const currentCell = grid[currentRow][currentCol];

        // 4 yönü kontrol et
        for (let dir = 0; dir < 4; dir++) {
            const [dRow, dCol] = DIRECTION_OFFSETS[dir as Direction];
            const newRow = currentRow + dRow;
            const newCol = currentCol + dCol;

            // Sınırlar içinde mi?
            if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) {
                continue;
            }

            // Zaten ziyaret edildi mi?
            if (visited[newRow][newCol]) {
                continue;
            }

            const neighborCell = grid[newRow][newCol];

            // Bağlantı var mı?
            const connected = areCellsConnected(
                currentCell.type,
                currentCell.rotation,
                neighborCell.type,
                neighborCell.rotation,
                dir as Direction
            );

            if (connected) {
                visited[newRow][newCol] = true;
                powered[newRow][newCol] = true;
                queue.push([newRow, newCol]);
            }
        }
    }

    return powered;
};

/**
 * Ampulün güç alıp almadığını kontrol eder
 */
export const isBulbPowered = (grid: GridCell[][], powered: boolean[][]): boolean => {
    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            if (grid[row][col].isBulb && powered[row][col]) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Kapalı devre kontrolü - Güç kaynağından çıkan akım, ampulden geçip
 * tekrar güç kaynağına dönmeli (döngü oluşturmalı)
 */
export const isCircuitClosed = (grid: GridCell[][], powered: boolean[][]): boolean => {
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    // Önce ampul powered mı kontrol et
    let bulbPowered = false;
    let bulbRow = -1;
    let bulbCol = -1;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (grid[row][col].isBulb) {
                bulbRow = row;
                bulbCol = col;
                if (powered[row][col]) {
                    bulbPowered = true;
                }
            }
        }
    }

    if (!bulbPowered) return false;

    // Ampulün kaç powered bağlantısı var kontrol et
    // Kapalı devre için ampulün en az 2 powered komşusu olmalı
    const bulbCell = grid[bulbRow][bulbCol];
    let poweredNeighborCount = 0;

    for (let dir = 0; dir < 4; dir++) {
        const [dRow, dCol] = DIRECTION_OFFSETS[dir as Direction];
        const newRow = bulbRow + dRow;
        const newCol = bulbCol + dCol;

        if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) {
            continue;
        }

        const neighborCell = grid[newRow][newCol];

        // Ampul bu yöne bağlantı veriyor mu?
        if (!hasConnection(bulbCell.type, bulbCell.rotation, dir as Direction)) {
            continue;
        }

        // Komşu ampule bağlantı veriyor mu?
        const oppositeDir = getOppositeDirection(dir as Direction);
        if (!hasConnection(neighborCell.type, neighborCell.rotation, oppositeDir)) {
            continue;
        }

        // Komşu powered mı?
        if (powered[newRow][newCol]) {
            poweredNeighborCount++;
        }
    }

    // Kapalı devre için ampulün en az 2 powered bağlantısı olmalı
    // (akım girişi ve çıkışı)
    return poweredNeighborCount >= 2;
};

/**
 * Güç kaynağının kaç yönden powered bağlantısı olduğunu hesapla
 */
export const getSourceConnectionCount = (grid: GridCell[][], powered: boolean[][]): number => {
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (grid[row][col].isSource) {
                const sourceCell = grid[row][col];
                let connectionCount = 0;

                for (let dir = 0; dir < 4; dir++) {
                    const [dRow, dCol] = DIRECTION_OFFSETS[dir as Direction];
                    const newRow = row + dRow;
                    const newCol = col + dCol;

                    if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) {
                        continue;
                    }

                    const neighborCell = grid[newRow][newCol];

                    // Bağlantı var mı ve powered mı?
                    const connected = areCellsConnected(
                        sourceCell.type,
                        sourceCell.rotation,
                        neighborCell.type,
                        neighborCell.rotation,
                        dir as Direction
                    );

                    if (connected && powered[newRow][newCol]) {
                        connectionCount++;
                    }
                }

                return connectionCount;
            }
        }
    }

    return 0;
};
