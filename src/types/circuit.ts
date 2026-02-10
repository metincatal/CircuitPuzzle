/**
 * Circuit Puzzle - Grid Tabanlı Sistem v2
 *
 * MİMARİ:
 * - Kademeli grid boyutu (5x4 → 12x11, 4000 seviye)
 * - Bridge (crossover) parça desteği
 * - Multi-structure (çoklu yapı) desteği
 * - Spanning Tree algoritması ile garantili çözüm
 * - Loop tarzı minimal tasarım
 */

export type TileType = 'source' | 'bulb' | 'empty' | 'line' | 'corner' | 't-shape' | 'cross' | 'bridge' | 'double-corner' | 'diode' | 'switch' | 'blocker';

export type Direction = 'top' | 'right' | 'bottom' | 'left';

export interface GridPos {
    row: number;
    col: number;
}

export interface Connections {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
}

export interface BridgePaths {
    pathA: [Direction, Direction];
    pathB: [Direction, Direction];
}

export interface Tile {
    id: string;
    position: GridPos;
    type: TileType;
    rotation: number; // 0, 1, 2, 3 (x90 derece)
    solvedRotation: number;
    baseConnections: Connections;
    isPowered: boolean;
    fixed: boolean;
    structureId?: number;
    bridgePaths?: BridgePaths;
    bridgePathAPowered?: boolean;
    bridgePathBPowered?: boolean;
    diodeDirection?: Direction; // base durumda güç çıkış yönü
    switchStates?: { stateA: Connections; stateB: Connections }; // iki durum
    switchState?: boolean; // mevcut durum (false=A, true=B)
    solvedSwitchState?: boolean; // çözüm durumu
}

export interface Level {
    id: string;
    rows: number;
    cols: number;
    tiles: Tile[];
    isSolved: boolean;
    structureCount: number;
}

// ============= YARDIMCI FONKSİYONLAR =============

export const generateId = (): string => Math.random().toString(36).substring(2, 9);

const OPPOSITE: Record<Direction, Direction> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
};

const DIR_OFFSETS: Record<Direction, { dr: number; dc: number }> = {
    top: { dr: -1, dc: 0 },
    right: { dr: 0, dc: 1 },
    bottom: { dr: 1, dc: 0 },
    left: { dr: 0, dc: -1 },
};

/**
 * Bir yönü saat yönünde belirli adım kadar döndür
 */
const rotateDirection = (dir: Direction, steps: number): Direction => {
    const dirs: Direction[] = ['top', 'right', 'bottom', 'left'];
    const idx = dirs.indexOf(dir);
    return dirs[(idx + steps) % 4];
};

/**
 * Bir tile'ın şu anki rotasyonuna göre aktif bağlantılarını hesapla
 */
export const getActiveConnections = (tile: Tile): Connections => {
    if (tile.type === 'bridge' || tile.type === 'double-corner') {
        // Bridge/Double-corner: her zaman 4 yön aktif (iki bağımsız path)
        const paths = getActiveBridgePaths(tile);
        return {
            top: paths.pathA.includes('top') || paths.pathB.includes('top'),
            right: paths.pathA.includes('right') || paths.pathB.includes('right'),
            bottom: paths.pathA.includes('bottom') || paths.pathB.includes('bottom'),
            left: paths.pathA.includes('left') || paths.pathB.includes('left'),
        };
    }

    if (tile.type === 'blocker') {
        return { top: false, right: false, bottom: false, left: false };
    }

    if (tile.type === 'switch') {
        if (tile.switchStates) {
            return tile.switchState ? tile.switchStates.stateB : tile.switchStates.stateA;
        }
        return { top: false, right: false, bottom: false, left: false };
    }

    // Diode ve diğer normal parçalar: rotation bazlı
    const { top, right, bottom, left } = tile.baseConnections;
    const conns = [top, right, bottom, left];
    const rotated = [false, false, false, false];

    for (let i = 0; i < 4; i++) {
        rotated[(i + tile.rotation) % 4] = conns[i];
    }

    return {
        top: rotated[0],
        right: rotated[1],
        bottom: rotated[2],
        left: rotated[3],
    };
};

/**
 * Bridge parçasının döndürülmüş yollarını hesapla
 */
export const getActiveBridgePaths = (tile: Tile): { pathA: [Direction, Direction]; pathB: [Direction, Direction] } => {
    if (!tile.bridgePaths) {
        return { pathA: ['top', 'bottom'], pathB: ['left', 'right'] };
    }

    const { pathA, pathB } = tile.bridgePaths;
    return {
        pathA: [rotateDirection(pathA[0], tile.rotation), rotateDirection(pathA[1], tile.rotation)],
        pathB: [rotateDirection(pathB[0], tile.rotation), rotateDirection(pathB[1], tile.rotation)],
    };
};

/**
 * Grid üzerinde (row, col) pozisyonundaki tile'ı bul
 */
export const getTileAt = (tiles: Tile[], row: number, col: number): Tile | undefined => {
    return tiles.find(t => t.position.row === row && t.position.col === col);
};

// ============= KADEMELİ ZORLUK AYARLARI =============

interface DifficultyConfig {
    rows: number;
    cols: number;
    structureCount: number;
    bridgeChance: number;
    fixedChance: number;
    doubleCornerChance: number;
    diodeChance: number;
    switchChance: number;
    blockerChance: number;
}

interface DifficultyMilestone {
    level: number;
    rows: number;
    cols: number;
    structureCount: number;
    bridgeChance: number;
    doubleCornerChance: number;
    diodeChance: number;
    switchChance: number;
    blockerChance: number;
    fixedChance: number;
}

const DIFFICULTY_MILESTONES: DifficultyMilestone[] = [
    { level:    1, rows:  5, cols:  4, structureCount: 1, bridgeChance: 0,    doubleCornerChance: 0,    diodeChance: 0,    switchChance: 0,    blockerChance: 0,    fixedChance: 0 },
    { level:    5, rows:  6, cols:  5, structureCount: 1, bridgeChance: 0.04, doubleCornerChance: 0,    diodeChance: 0,    switchChance: 0,    blockerChance: 0,    fixedChance: 0 },
    { level:   15, rows:  6, cols:  5, structureCount: 1, bridgeChance: 0.08, doubleCornerChance: 0.03, diodeChance: 0.05, switchChance: 0,    blockerChance: 0,    fixedChance: 0 },
    { level:   30, rows:  7, cols:  6, structureCount: 1, bridgeChance: 0.10, doubleCornerChance: 0.05, diodeChance: 0.08, switchChance: 0.04, blockerChance: 0.01, fixedChance: 0 },
    { level:   50, rows:  7, cols:  6, structureCount: 1, bridgeChance: 0.12, doubleCornerChance: 0.06, diodeChance: 0.10, switchChance: 0.06, blockerChance: 0.02, fixedChance: 0 },
    { level:   80, rows:  7, cols:  7, structureCount: 2, bridgeChance: 0.14, doubleCornerChance: 0.08, diodeChance: 0.12, switchChance: 0.08, blockerChance: 0.03, fixedChance: 0 },
    { level:  120, rows:  8, cols:  7, structureCount: 2, bridgeChance: 0.16, doubleCornerChance: 0.10, diodeChance: 0.14, switchChance: 0.10, blockerChance: 0.04, fixedChance: 0.02 },
    { level:  180, rows:  8, cols:  7, structureCount: 2, bridgeChance: 0.18, doubleCornerChance: 0.12, diodeChance: 0.16, switchChance: 0.12, blockerChance: 0.05, fixedChance: 0.04 },
    { level:  250, rows:  8, cols:  8, structureCount: 3, bridgeChance: 0.20, doubleCornerChance: 0.14, diodeChance: 0.18, switchChance: 0.14, blockerChance: 0.06, fixedChance: 0.06 },
    { level:  350, rows:  9, cols:  8, structureCount: 3, bridgeChance: 0.22, doubleCornerChance: 0.16, diodeChance: 0.20, switchChance: 0.16, blockerChance: 0.07, fixedChance: 0.08 },
    { level:  500, rows:  9, cols:  8, structureCount: 3, bridgeChance: 0.25, doubleCornerChance: 0.18, diodeChance: 0.22, switchChance: 0.18, blockerChance: 0.08, fixedChance: 0.10 },
    { level:  700, rows:  9, cols:  9, structureCount: 4, bridgeChance: 0.28, doubleCornerChance: 0.20, diodeChance: 0.25, switchChance: 0.20, blockerChance: 0.09, fixedChance: 0.12 },
    { level: 1000, rows: 10, cols:  9, structureCount: 4, bridgeChance: 0.30, doubleCornerChance: 0.22, diodeChance: 0.28, switchChance: 0.22, blockerChance: 0.10, fixedChance: 0.15 },
    { level: 1500, rows: 10, cols: 10, structureCount: 5, bridgeChance: 0.33, doubleCornerChance: 0.25, diodeChance: 0.30, switchChance: 0.25, blockerChance: 0.11, fixedChance: 0.18 },
    { level: 2000, rows: 11, cols: 10, structureCount: 5, bridgeChance: 0.35, doubleCornerChance: 0.28, diodeChance: 0.33, switchChance: 0.28, blockerChance: 0.12, fixedChance: 0.20 },
    { level: 2500, rows: 11, cols: 10, structureCount: 5, bridgeChance: 0.38, doubleCornerChance: 0.30, diodeChance: 0.35, switchChance: 0.30, blockerChance: 0.13, fixedChance: 0.22 },
    { level: 3000, rows: 12, cols: 10, structureCount: 6, bridgeChance: 0.40, doubleCornerChance: 0.32, diodeChance: 0.38, switchChance: 0.32, blockerChance: 0.14, fixedChance: 0.24 },
    { level: 4000, rows: 12, cols: 11, structureCount: 6, bridgeChance: 0.45, doubleCornerChance: 0.35, diodeChance: 0.40, switchChance: 0.35, blockerChance: 0.15, fixedChance: 0.28 },
];

const getDifficultyConfig = (levelNumber: number): DifficultyConfig => {
    const ms = DIFFICULTY_MILESTONES;

    // Son milestone'dan büyükse, son milestone'u döndür
    if (levelNumber >= ms[ms.length - 1].level) {
        const last = ms[ms.length - 1];
        return {
            rows: last.rows, cols: last.cols, structureCount: last.structureCount,
            bridgeChance: last.bridgeChance, fixedChance: last.fixedChance,
            doubleCornerChance: last.doubleCornerChance, diodeChance: last.diodeChance,
            switchChance: last.switchChance, blockerChance: last.blockerChance,
        };
    }

    // İlk milestone'dan küçükse, ilk milestone'u döndür
    if (levelNumber <= ms[0].level) {
        const first = ms[0];
        return {
            rows: first.rows, cols: first.cols, structureCount: first.structureCount,
            bridgeChance: first.bridgeChance, fixedChance: first.fixedChance,
            doubleCornerChance: first.doubleCornerChance, diodeChance: first.diodeChance,
            switchChance: first.switchChance, blockerChance: first.blockerChance,
        };
    }

    // İki komşu milestone'u bul
    let lower = ms[0];
    let upper = ms[1];
    for (let i = 0; i < ms.length - 1; i++) {
        if (levelNumber >= ms[i].level && levelNumber < ms[i + 1].level) {
            lower = ms[i];
            upper = ms[i + 1];
            break;
        }
    }

    // İnterpolasyon oranı (0..1)
    const t = (levelNumber - lower.level) / (upper.level - lower.level);

    // Lineer interpolasyon
    const lerp = (a: number, b: number) => a + (b - a) * t;

    return {
        rows: Math.floor(lerp(lower.rows, upper.rows)),
        cols: Math.floor(lerp(lower.cols, upper.cols)),
        structureCount: Math.floor(lerp(lower.structureCount, upper.structureCount)),
        bridgeChance: lerp(lower.bridgeChance, upper.bridgeChance),
        fixedChance: lerp(lower.fixedChance, upper.fixedChance),
        doubleCornerChance: lerp(lower.doubleCornerChance, upper.doubleCornerChance),
        diodeChance: lerp(lower.diodeChance, upper.diodeChance),
        switchChance: lerp(lower.switchChance, upper.switchChance),
        blockerChance: lerp(lower.blockerChance, upper.blockerChance),
    };
};

// ============= GRİD BÖLGELEME (Multi-Structure) =============

const partitionGrid = (rows: number, cols: number, structureCount: number): number[][] => {
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(-1));

    if (structureCount <= 1) {
        // Tek yapı: tümü 0
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++)
                grid[r][c] = 0;
        return grid;
    }

    // Seed noktalarını belirle (Manhattan mesafe ≥ 3)
    const seeds: GridPos[] = [];
    let attempts = 0;
    while (seeds.length < structureCount && attempts < 200) {
        attempts++;
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);

        const tooClose = seeds.some(s =>
            Math.abs(s.row - r) + Math.abs(s.col - c) < 3
        );
        if (!tooClose) {
            seeds.push({ row: r, col: c });
        }
    }

    // Seed bulunamadıysa fallback
    if (seeds.length < structureCount) {
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++)
                grid[r][c] = 0;
        return grid;
    }

    // BFS ile Voronoi benzeri bölgelere ayır
    const queue: { pos: GridPos; id: number }[] = [];
    seeds.forEach((s, i) => {
        grid[s.row][s.col] = i;
        queue.push({ pos: s, id: i });
    });

    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];

    // Shuffle queue her adımda - fair expansion
    let idx = 0;
    while (idx < queue.length) {
        const { pos, id } = queue[idx];
        idx++;

        for (const [dr, dc] of dirs) {
            const nr = pos.row + dr;
            const nc = pos.col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === -1) {
                grid[nr][nc] = id;
                queue.push({ pos: { row: nr, col: nc }, id });
            }
        }
    }

    return grid;
};

// ============= SEVİYE ÜRETİCİ =============

/**
 * Tek bir bölge için spanning tree oluştur
 */
const generateSpanningTree = (
    rows: number,
    cols: number,
    regionGrid: number[][],
    regionId: number,
    sourcePos: GridPos,
    blockers: Set<string> = new Set(),
): Map<string, Connections> => {
    const connectionMap = new Map<string, Connections>();

    // Bölgeye ait hücreleri bul (blocker'ları hariç tut)
    const regionCells = new Set<string>();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (regionGrid[r][c] === regionId && !blockers.has(`${r},${c}`)) {
                regionCells.add(`${r},${c}`);
                connectionMap.set(`${r},${c}`, { top: false, right: false, bottom: false, left: false });
            }
        }
    }

    // DFS (Recursive Backtracker)
    const visited = new Set<string>();
    const stack: GridPos[] = [sourcePos];
    visited.add(`${sourcePos.row},${sourcePos.col}`);

    const dirList: { dr: number; dc: number; dir: Direction; opp: Direction }[] = [
        { dr: -1, dc: 0, dir: 'top', opp: 'bottom' },
        { dr: 0, dc: 1, dir: 'right', opp: 'left' },
        { dr: 1, dc: 0, dir: 'bottom', opp: 'top' },
        { dr: 0, dc: -1, dir: 'left', opp: 'right' },
    ];

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const key = `${current.row},${current.col}`;

        // Ziyaret edilmemiş komşuları bul
        const neighbors: { pos: GridPos; dir: Direction; opp: Direction }[] = [];

        for (const d of dirList) {
            const nr = current.row + d.dr;
            const nc = current.col + d.dc;
            const nKey = `${nr},${nc}`;
            if (regionCells.has(nKey) && !visited.has(nKey)) {
                neighbors.push({ pos: { row: nr, col: nc }, dir: d.dir, opp: d.opp });
            }
        }

        if (neighbors.length > 0) {
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            const nextKey = `${next.pos.row},${next.pos.col}`;

            // Bağlantı kur
            const currentConns = connectionMap.get(key)!;
            currentConns[next.dir] = true;

            const nextConns = connectionMap.get(nextKey)!;
            nextConns[next.opp] = true;

            visited.add(nextKey);
            stack.push(next.pos);
        } else {
            stack.pop();
        }
    }

    return connectionMap;
};

/**
 * Bağlantı sayısına göre tile tipini belirle
 */
const determineTileType = (conns: Connections, isSource: boolean): TileType => {
    const count = (conns.top ? 1 : 0) + (conns.right ? 1 : 0) + (conns.bottom ? 1 : 0) + (conns.left ? 1 : 0);

    if (count === 0) return 'empty';
    if (isSource) return 'source';
    if (count === 1) return 'bulb';
    if (count === 2) {
        if ((conns.top && conns.bottom) || (conns.left && conns.right)) return 'line';
        return 'corner';
    }
    if (count === 3) return 't-shape';
    return 'cross';
};

/**
 * Canonical base connections (şeklin standart hali)
 */
const getCanonicalConnections = (type: TileType): Connections => {
    switch (type) {
        case 'source':
        case 'bulb':
            return { top: false, bottom: true, right: false, left: false };
        case 'line':
            return { top: true, bottom: true, right: false, left: false };
        case 'corner':
            return { top: true, right: true, bottom: false, left: false };
        case 't-shape':
            return { top: false, right: true, bottom: true, left: true };
        case 'cross':
            return { top: true, right: true, bottom: true, left: true };
        case 'bridge':
        case 'double-corner':
            return { top: true, right: true, bottom: true, left: true };
        case 'diode':
            return { top: true, bottom: true, right: false, left: false };
        case 'switch':
            return { top: true, bottom: true, right: false, left: false };
        case 'blocker':
            return { top: false, right: false, bottom: false, left: false };
        default:
            return { top: false, right: false, bottom: false, left: false };
    }
};

/**
 * Gerçek bağlantılara uygun solvedRotation hesapla
 */
const findSolvedRotation = (baseConns: Connections, targetConns: Connections): number => {
    for (let rot = 0; rot < 4; rot++) {
        const conns = [baseConns.top, baseConns.right, baseConns.bottom, baseConns.left];
        const rotated = [false, false, false, false];
        for (let i = 0; i < 4; i++) {
            rotated[(i + rot) % 4] = conns[i];
        }

        if (
            rotated[0] === targetConns.top &&
            rotated[1] === targetConns.right &&
            rotated[2] === targetConns.bottom &&
            rotated[3] === targetConns.left
        ) {
            return rot;
        }
    }
    return 0;
};

/**
 * Bazı line parçalarını bridge'e dönüştür
 */
const convertToBridges = (tiles: Tile[], bridgeChance: number, rows: number, cols: number): void => {
    if (bridgeChance <= 0) return;

    // Tile map oluştur
    const tileMap = new Map<string, Tile>();
    tiles.forEach(t => tileMap.set(`${t.position.row},${t.position.col}`, t));

    // Line parçalarını bul (düz çizgi - karşılıklı 2 bağlantı)
    const lineTiles = tiles.filter(t => t.type === 'line');

    for (const tile of lineTiles) {
        if (Math.random() > bridgeChance) continue;

        const r = tile.position.row;
        const c = tile.position.col;

        // Bu line'ın aktif yönlerini bul (solved rotation ile)
        const testTile = { ...tile, rotation: tile.solvedRotation } as Tile;
        const activeConns = getActiveConnections(testTile);

        // Dikey mi yatay mı?
        let perpDirs: [Direction, Direction];
        if (activeConns.top && activeConns.bottom) {
            perpDirs = ['left', 'right'];
        } else if (activeConns.left && activeConns.right) {
            perpDirs = ['top', 'bottom'];
        } else {
            continue;
        }

        // Perpendicular yönlerde komşu var mı?
        const off1 = DIR_OFFSETS[perpDirs[0]];
        const off2 = DIR_OFFSETS[perpDirs[1]];
        const n1 = tileMap.get(`${r + off1.dr},${c + off1.dc}`);
        const n2 = tileMap.get(`${r + off2.dr},${c + off2.dc}`);

        // İki perpendicular komşu da varsa bridge yapabiliriz
        if (n1 && n2 && n1.type !== 'source' && n2.type !== 'source' && n1.type !== 'bridge' && n2.type !== 'bridge') {
            // Mevcut line'ı bridge'e dönüştür
            let pathA: [Direction, Direction];
            let pathB: [Direction, Direction];

            if (activeConns.top && activeConns.bottom) {
                pathA = ['top', 'bottom'];
                pathB = ['left', 'right'];
            } else {
                pathA = ['left', 'right'];
                pathB = ['top', 'bottom'];
            }

            tile.type = 'bridge';
            tile.bridgePaths = { pathA, pathB };
            tile.baseConnections = { top: true, right: true, bottom: true, left: true };

            // pathB yönlerindeki komşulara bağlantı ekle
            const n1Conns = getActiveConnections({ ...n1, rotation: n1.solvedRotation } as Tile);
            const n2Conns = getActiveConnections({ ...n2, rotation: n2.solvedRotation } as Tile);

            // Komşu 1'e bridge yönünden bağlantı ekle
            const oppDir1 = OPPOSITE[perpDirs[0]];
            if (!n1Conns[oppDir1]) {
                // Komşunun bağlantısını güncelle
                addConnectionToTile(n1, oppDir1);
            }

            // Komşu 2'ye bridge yönünden bağlantı ekle
            const oppDir2 = OPPOSITE[perpDirs[1]];
            if (!n2Conns[oppDir2]) {
                addConnectionToTile(n2, oppDir2);
            }

            // Bridge'in solved rotation'ı: pathA orijinal halde top-bottom ise ve gerçek de top-bottom ise 0
            tile.solvedRotation = 0; // Bridge base hali zaten doğru yönde
        }
    }
};

/**
 * Bir tile'a yeni bir yön bağlantısı ekle (tipini güncelle)
 */
const addConnectionToTile = (tile: Tile, dir: Direction): void => {
    // Mevcut solved rotation'daki aktif bağlantıları bul
    const testTile = { ...tile, rotation: tile.solvedRotation } as Tile;
    const currentConns = getActiveConnections(testTile);

    // Yeni bağlantıyı ekle
    const newConns: Connections = { ...currentConns, [dir]: true };
    const count = (newConns.top ? 1 : 0) + (newConns.right ? 1 : 0) + (newConns.bottom ? 1 : 0) + (newConns.left ? 1 : 0);

    // Yeni tipi belirle
    let newType: TileType = tile.type;
    if (count === 2) {
        if ((newConns.top && newConns.bottom) || (newConns.left && newConns.right)) newType = 'line';
        else newType = 'corner';
    } else if (count === 3) {
        newType = 't-shape';
    } else if (count === 4) {
        newType = 'cross';
    }

    tile.type = newType;
    const newBase = getCanonicalConnections(newType);
    tile.baseConnections = newBase;
    tile.solvedRotation = findSolvedRotation(newBase, newConns);
};

/**
 * İç hücrelere rastgele blocker yerleştir (spanning tree öncesi)
 */
const placeBlockers = (rows: number, cols: number, blockerChance: number): Set<string> => {
    const blockers = new Set<string>();
    if (blockerChance <= 0) return blockers;

    for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
            if (Math.random() < blockerChance) {
                blockers.add(`${r},${c}`);
            }
        }
    }
    return blockers;
};

/**
 * Corner tile'ları double-corner'a dönüştür (bridge benzeri yaklaşım)
 * Mevcut köşe bağlantısını korur + karşı yönlere yeni kavisli yol ekler
 * Bu sayede spanning tree bağlantısı korunur
 */
const convertToDoubleCorners = (tiles: Tile[], doubleCornerChance: number): void => {
    if (doubleCornerChance <= 0) return;

    const tileMap = new Map<string, Tile>();
    tiles.forEach(t => tileMap.set(`${t.position.row},${t.position.col}`, t));

    const cornerTiles = tiles.filter(t => t.type === 'corner');

    for (const tile of cornerTiles) {
        if (Math.random() > doubleCornerChance) continue;

        const r = tile.position.row;
        const c = tile.position.col;

        // Solved rotation'daki aktif bağlantıları bul
        const testTile = { ...tile, rotation: tile.solvedRotation } as Tile;
        const activeConns = getActiveConnections(testTile);

        const activeDirs = (['top', 'right', 'bottom', 'left'] as Direction[]).filter(d => activeConns[d]);
        if (activeDirs.length !== 2) continue;

        // Karşı yönler (yeni path için)
        const perpDirs = (['top', 'right', 'bottom', 'left'] as Direction[]).filter(d => !activeConns[d]) as [Direction, Direction];
        if (perpDirs.length !== 2) continue;

        // Perpendicular yönlerde uygun komşu var mı?
        const off1 = DIR_OFFSETS[perpDirs[0]];
        const off2 = DIR_OFFSETS[perpDirs[1]];
        const n1 = tileMap.get(`${r + off1.dr},${c + off1.dc}`);
        const n2 = tileMap.get(`${r + off2.dr},${c + off2.dc}`);

        if (!n1 || !n2) continue;
        if (n1.type === 'source' || n2.type === 'source') continue;
        if (n1.type === 'bridge' || n2.type === 'bridge') continue;
        if (n1.type === 'double-corner' || n2.type === 'double-corner') continue;
        if (n1.type === 'blocker' || n2.type === 'blocker') continue;

        // Corner -> double-corner
        const pathA: [Direction, Direction] = [activeDirs[0], activeDirs[1]];
        const pathB: [Direction, Direction] = [perpDirs[0], perpDirs[1]];

        tile.type = 'double-corner';
        tile.bridgePaths = { pathA, pathB };
        tile.baseConnections = { top: true, right: true, bottom: true, left: true };

        // pathB yönlerindeki komşulara bağlantı ekle
        const oppDir1 = OPPOSITE[perpDirs[0]];
        const n1Conns = getActiveConnections({ ...n1, rotation: n1.solvedRotation } as Tile);
        if (!n1Conns[oppDir1]) {
            addConnectionToTile(n1, oppDir1);
        }

        const oppDir2 = OPPOSITE[perpDirs[1]];
        const n2Conns = getActiveConnections({ ...n2, rotation: n2.solvedRotation } as Tile);
        if (!n2Conns[oppDir2]) {
            addConnectionToTile(n2, oppDir2);
        }

        tile.solvedRotation = 0; // bridgePaths zaten world (solved) koordinatlarında
    }
};

/**
 * Line tile'ları diode'a dönüştür
 * Diode: güç sadece tek yönde akar
 */
const convertToDiodes = (tiles: Tile[], diodeChance: number): void => {
    if (diodeChance <= 0) return;

    // Source pozisyonlarını bul
    const sources = tiles.filter(t => t.type === 'source');
    if (sources.length === 0) return;

    // Source'tan BFS mesafe haritası oluştur
    const tileMap = new Map<string, Tile>();
    tiles.forEach(t => tileMap.set(`${t.position.row},${t.position.col}`, t));

    const distMap = new Map<string, number>();
    const bfsQueue: { key: string; dist: number }[] = [];

    for (const src of sources) {
        const key = `${src.position.row},${src.position.col}`;
        distMap.set(key, 0);
        bfsQueue.push({ key, dist: 0 });
    }

    const dirList: { dr: number; dc: number; dir: Direction }[] = [
        { dr: -1, dc: 0, dir: 'top' },
        { dr: 0, dc: 1, dir: 'right' },
        { dr: 1, dc: 0, dir: 'bottom' },
        { dr: 0, dc: -1, dir: 'left' },
    ];

    let idx = 0;
    while (idx < bfsQueue.length) {
        const { key, dist } = bfsQueue[idx++];
        const tile = tileMap.get(key);
        if (!tile) continue;

        const solvedConns = getActiveConnections({ ...tile, rotation: tile.solvedRotation } as Tile);

        for (const d of dirList) {
            if (!solvedConns[d.dir]) continue;
            const nr = tile.position.row + d.dr;
            const nc = tile.position.col + d.dc;
            const nKey = `${nr},${nc}`;
            const neighbor = tileMap.get(nKey);
            if (!neighbor) continue;

            const neighborConns = getActiveConnections({ ...neighbor, rotation: neighbor.solvedRotation } as Tile);
            if (!neighborConns[OPPOSITE[d.dir]]) continue;

            if (!distMap.has(nKey)) {
                distMap.set(nKey, dist + 1);
                bfsQueue.push({ key: nKey, dist: dist + 1 });
            }
        }
    }

    // Line tile'ları dönüştür
    const lineTiles = tiles.filter(t => t.type === 'line');

    for (const tile of lineTiles) {
        if (Math.random() > diodeChance) continue;

        const key = `${tile.position.row},${tile.position.col}`;
        const myDist = distMap.get(key);
        if (myDist === undefined) continue;

        // Solved rotation ile aktif bağlantıları bul
        const solvedConns = getActiveConnections({ ...tile, rotation: tile.solvedRotation } as Tile);
        const activeDirs = (Object.entries(solvedConns) as [Direction, boolean][])
            .filter(([_, v]) => v).map(([k]) => k);

        if (activeDirs.length !== 2) continue;

        // Source'tan uzaklaşan yönü bul
        let diodeDir: Direction | null = null;
        for (const dir of activeDirs) {
            const off = DIR_OFFSETS[dir];
            const nKey = `${tile.position.row + off.dr},${tile.position.col + off.dc}`;
            const nDist = distMap.get(nKey);
            if (nDist !== undefined && nDist > myDist) {
                diodeDir = dir;
                break;
            }
        }

        if (!diodeDir) continue;

        // diodeDirection: base (rotation=0) durumundaki yön
        // solvedRotation adım kadar geri döndür
        const dirs: Direction[] = ['top', 'right', 'bottom', 'left'];
        const currentIdx = dirs.indexOf(diodeDir);
        const baseIdx = (currentIdx - tile.solvedRotation + 4) % 4;
        const baseDiodeDir = dirs[baseIdx];

        tile.type = 'diode';
        tile.diodeDirection = baseDiodeDir;
        tile.baseConnections = { top: true, bottom: true, right: false, left: false };
        // solvedRotation zaten doğru (line ile aynı base)
    }
};

/**
 * Line/corner tile'ları switch'e dönüştür
 * Switch: iki durum arasında toggle (döndürme yerine)
 */
const convertToSwitches = (tiles: Tile[], switchChance: number): void => {
    if (switchChance <= 0) return;

    const candidates = tiles.filter(t => t.type === 'line' || t.type === 'corner');

    for (const tile of candidates) {
        if (Math.random() > switchChance) continue;

        // Mevcut çözüm bağlantıları
        const solvedConns = getActiveConnections({ ...tile, rotation: tile.solvedRotation } as Tile);

        // Alternatif durum: 90 derece döndürülmüş
        const altRotation = (tile.solvedRotation + 1) % 4;
        const altConns = getActiveConnections({ ...tile, rotation: altRotation } as Tile);

        const stateA: Connections = { ...solvedConns };
        const stateB: Connections = { ...altConns };

        tile.type = 'switch';
        tile.switchStates = { stateA, stateB };
        tile.solvedSwitchState = false; // çözüm: stateA
        tile.switchState = Math.random() < 0.5; // rastgele başlangıç
        tile.rotation = 0; // switch döndürülmez
        tile.solvedRotation = 0;
        tile.baseConnections = getCanonicalConnections('switch');
    }
};

/**
 * Ana level üretici
 */
export const generateGridLevel = (levelNumber: number = 1): Level => {
    const config = getDifficultyConfig(levelNumber);
    const { rows, cols, structureCount, bridgeChance, fixedChance,
        doubleCornerChance, diodeChance, switchChance, blockerChance } = config;

    // Blocker yerleştirme (spanning tree öncesi)
    const blockers = placeBlockers(rows, cols, blockerChance);

    // Grid bölgeleme
    const regionGrid = partitionGrid(rows, cols, structureCount);

    // Source pozisyonunun blocker olmamasını sağla
    // Her bölge için source pozisyonu bul
    const regionSources: GridPos[] = [];
    for (let i = 0; i < structureCount; i++) {
        const cells: GridPos[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (regionGrid[r][c] === i && !blockers.has(`${r},${c}`)) {
                    cells.push({ row: r, col: c });
                }
            }
        }
        if (cells.length > 0) {
            const centerR = cells.reduce((s, c) => s + c.row, 0) / cells.length;
            const centerC = cells.reduce((s, c) => s + c.col, 0) / cells.length;
            cells.sort((a, b) => {
                const distA = Math.abs(a.row - centerR) + Math.abs(a.col - centerC);
                const distB = Math.abs(b.row - centerR) + Math.abs(b.col - centerC);
                return distA - distB;
            });
            regionSources.push(cells[0]);
        }
    }

    // Her bölge için spanning tree (blocker'lar hariç)
    const allConnectionMaps: Map<string, Connections>[] = [];
    for (let i = 0; i < regionSources.length; i++) {
        const connMap = generateSpanningTree(rows, cols, regionGrid, i, regionSources[i], blockers);
        allConnectionMaps.push(connMap);
    }

    // Tile'ları oluştur
    const tiles: Tile[] = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const regionId = regionGrid[r][c];
            if (regionId < 0) continue;

            const key = `${r},${c}`;

            // Blocker tile oluştur
            if (blockers.has(key)) {
                tiles.push({
                    id: generateId(),
                    position: { row: r, col: c },
                    type: 'blocker',
                    rotation: 0,
                    solvedRotation: 0,
                    baseConnections: { top: false, right: false, bottom: false, left: false },
                    isPowered: false,
                    fixed: true,
                    structureId: regionId,
                });
                continue;
            }

            const connMap = allConnectionMaps[regionId];
            const conns = connMap?.get(key);

            if (!conns) continue;

            const connCount = (conns.top ? 1 : 0) + (conns.right ? 1 : 0) + (conns.bottom ? 1 : 0) + (conns.left ? 1 : 0);
            if (connCount === 0) continue;

            const isSource = regionSources[regionId].row === r && regionSources[regionId].col === c;
            const type = determineTileType(conns, isSource);
            const baseConns = getCanonicalConnections(type);
            const solvedRotation = findSolvedRotation(baseConns, conns);

            const randomRot = Math.floor(Math.random() * 4);
            const isFixed = type === 'source' || (fixedChance > 0 && !isSource && Math.random() < fixedChance);

            tiles.push({
                id: generateId(),
                position: { row: r, col: c },
                type,
                rotation: isFixed ? solvedRotation : randomRot,
                solvedRotation,
                baseConnections: baseConns,
                isPowered: type === 'source',
                fixed: isFixed,
                structureId: regionId,
            });
        }
    }

    // Post-processing dönüşümleri (sıra önemli!)
    // 1. Bridge dönüşümü
    if (bridgeChance > 0) {
        convertToBridges(tiles, bridgeChance, rows, cols);
    }

    // 2. Double-corner dönüşümü (bridge'den sonra, cross dönüşümü)
    if (doubleCornerChance > 0) {
        convertToDoubleCorners(tiles, doubleCornerChance);
    }

    // 3. Diode dönüşümü (bağlantı haritası hazır olmalı)
    if (diodeChance > 0) {
        convertToDiodes(tiles, diodeChance);
    }

    // 4. Switch dönüşümü (en son, mevcut bağlantıları kullanır)
    if (switchChance > 0) {
        convertToSwitches(tiles, switchChance);
    }

    // Solved state'te bağlantı doğrulaması: kopuk parça varsa basit tipe geri döndür
    validateSolvedConnectivity(tiles);

    // Güç akışını hesapla
    calculatePowerFlow(tiles);

    return {
        id: generateId(),
        rows,
        cols,
        tiles,
        isSolved: false,
        structureCount,
    };
};

/**
 * Solved state'te tüm fonksiyonel tile'ların source'a bağlı olduğunu doğrula.
 * Kopuk tile varsa basit tipine geri döndür.
 */
const validateSolvedConnectivity = (tiles: Tile[]): void => {
    // Geçici solved state oluştur
    const tempTiles: Tile[] = tiles.map(t => ({
        ...t,
        rotation: t.solvedRotation,
        switchState: t.solvedSwitchState,
    }));

    calculatePowerFlow(tempTiles);

    // Powered olmayan fonksiyonel tile'ları bul ve geri döndür
    for (let i = 0; i < tiles.length; i++) {
        const real = tiles[i];
        const temp = tempTiles[i];

        if (real.type === 'empty' || real.type === 'blocker' || real.type === 'source') continue;

        if (!temp.isPowered) {
            // Double-corner -> corner'a geri döndür
            if (real.type === 'double-corner' && real.bridgePaths) {
                real.type = 'corner';
                const conns = real.bridgePaths.pathA;
                const newConns: Connections = { top: false, right: false, bottom: false, left: false };
                newConns[conns[0]] = true;
                newConns[conns[1]] = true;
                real.baseConnections = getCanonicalConnections('corner');
                real.solvedRotation = findSolvedRotation(real.baseConnections, newConns);
                delete real.bridgePaths;
            }
            // Diode -> line'a geri döndür
            else if (real.type === 'diode') {
                real.type = 'line';
                real.baseConnections = getCanonicalConnections('line');
                delete real.diodeDirection;
            }
            // Switch -> orijinal tipe geri döndür
            else if (real.type === 'switch' && real.switchStates) {
                const solvedConns = real.switchStates.stateA;
                const count = (solvedConns.top ? 1 : 0) + (solvedConns.right ? 1 : 0) + (solvedConns.bottom ? 1 : 0) + (solvedConns.left ? 1 : 0);
                const isLine = count === 2 && ((solvedConns.top && solvedConns.bottom) || (solvedConns.left && solvedConns.right));
                real.type = isLine ? 'line' : 'corner';
                real.baseConnections = getCanonicalConnections(real.type);
                real.solvedRotation = findSolvedRotation(real.baseConnections, solvedConns);
                real.rotation = Math.floor(Math.random() * 4);
                delete real.switchStates;
                delete real.switchState;
                delete real.solvedSwitchState;
            }
        }
    }
};

// ============= GÜÇ AKIŞI (Bridge-aware BFS) =============

/**
 * Bağlantı mantığını ve güç akışını kontrol et
 * Bridge parçalar için path-bazlı akış
 */
export const calculatePowerFlow = (tiles: Tile[]): void => {
    // Herkesi resetle
    tiles.forEach(t => {
        if (t.type === 'blocker') {
            t.isPowered = false;
            return;
        }
        t.isPowered = (t.type === 'source');
        if (t.type === 'bridge' || t.type === 'double-corner') {
            t.bridgePathAPowered = false;
            t.bridgePathBPowered = false;
        }
    });

    // Hızlı erişim için map
    const tileMap = new Map<string, Tile>();
    tiles.forEach(t => tileMap.set(`${t.position.row},${t.position.col}`, t));

    // BFS queue: { tile, entryDirection (source'dan null) }
    interface QueueItem {
        tile: Tile;
        entryDirection: Direction | null;
    }

    const queue: QueueItem[] = tiles
        .filter(t => t.type === 'source')
        .map(t => ({ tile: t, entryDirection: null as Direction | null }));

    // Visited tracking: normal tile -> tile.id, bridge -> tile.id-entryDirection
    const visited = new Set<string>();
    queue.forEach(q => visited.add(q.tile.id));

    const directions: { dir: Direction; dr: number; dc: number }[] = [
        { dir: 'top', dr: -1, dc: 0 },
        { dir: 'right', dr: 0, dc: 1 },
        { dir: 'bottom', dr: 1, dc: 0 },
        { dir: 'left', dr: 0, dc: -1 },
    ];

    while (queue.length > 0) {
        const { tile: current, entryDirection } = queue.shift()!;
        const r = current.position.row;
        const c = current.position.col;

        if (current.type === 'blocker') continue;

        if (current.type === 'bridge' || current.type === 'double-corner') {
            // Bridge/Double-corner: sadece aynı path'teki eşleşen yönden çıkış
            const paths = getActiveBridgePaths(current);

            let exitDirs: Direction[] = [];

            if (entryDirection === null) {
                exitDirs = [...paths.pathA, ...paths.pathB];
            } else {
                if (paths.pathA.includes(entryDirection)) {
                    exitDirs = paths.pathA.filter(d => d !== entryDirection);
                    current.bridgePathAPowered = true;
                } else if (paths.pathB.includes(entryDirection)) {
                    exitDirs = paths.pathB.filter(d => d !== entryDirection);
                    current.bridgePathBPowered = true;
                }
            }

            for (const exitDir of exitDirs) {
                const d = directions.find(dd => dd.dir === exitDir)!;
                const neighbor = tileMap.get(`${r + d.dr},${c + d.dc}`);
                if (!neighbor || neighbor.type === 'blocker') continue;

                const neighborConns = getActiveConnections(neighbor);
                const oppDir = OPPOSITE[exitDir];
                if (!neighborConns[oppDir]) continue;

                const visitKey = (neighbor.type === 'bridge' || neighbor.type === 'double-corner')
                    ? `${neighbor.id}-${oppDir}`
                    : neighbor.id;

                if (!visited.has(visitKey)) {
                    neighbor.isPowered = true;
                    visited.add(visitKey);
                    queue.push({ tile: neighbor, entryDirection: oppDir });
                }
            }
        } else {
            // Normal parça: tüm aktif yönlerden çıkış
            const conns = getActiveConnections(current);

            for (const d of directions) {
                if (!conns[d.dir]) continue;

                // Diode kontrolü: sadece diodeDirection yönünde güç çıkışı yapabilir
                if (current.type === 'diode' && current.diodeDirection && entryDirection !== null) {
                    const activeDiodeDir = rotateDirection(current.diodeDirection, current.rotation);
                    if (d.dir !== activeDiodeDir) continue;
                }

                const neighbor = tileMap.get(`${r + d.dr},${c + d.dc}`);
                if (!neighbor || neighbor.type === 'blocker') continue;

                // Komşu diode ise, ters yönden gelen güç geçemez kontrolü
                if (neighbor.type === 'diode' && neighbor.diodeDirection) {
                    const neighborDiodeDir = rotateDirection(neighbor.diodeDirection, neighbor.rotation);
                    const oppDir = OPPOSITE[d.dir];
                    // Güç, diode'un çıkış yönünden girmeye çalışıyorsa engelle
                    if (oppDir === neighborDiodeDir) continue;
                }

                const neighborConns = getActiveConnections(neighbor);
                const oppDir = OPPOSITE[d.dir];
                if (!neighborConns[oppDir]) continue;

                const visitKey = (neighbor.type === 'bridge' || neighbor.type === 'double-corner')
                    ? `${neighbor.id}-${oppDir}`
                    : neighbor.id;

                if (!visited.has(visitKey)) {
                    neighbor.isPowered = true;
                    visited.add(visitKey);
                    queue.push({ tile: neighbor, entryDirection: oppDir });
                }
            }
        }
    }
};

// ============= SEVİYE ÇÖZÜLME KONTROLÜ =============

/**
 * Tüm fonksiyonel parçaların bağlantıları çözüm durumuyla eşleşmeli
 * Sadece isPowered yeterli değil - kablo yapısı da doğru olmalı
 */
export const isLevelSolved = (tiles: Tile[]): boolean => {
    const functionalTiles = tiles.filter(t => t.type !== 'empty' && t.type !== 'blocker');
    if (functionalTiles.length === 0) return false;

    return functionalTiles.every(t => {
        const currentConns = getActiveConnections(t);

        // Solved state bağlantılarını hesapla
        let solvedConns: Connections;
        if (t.type === 'switch') {
            solvedConns = t.switchStates
                ? (t.solvedSwitchState ? t.switchStates.stateB : t.switchStates.stateA)
                : { top: false, right: false, bottom: false, left: false };
        } else {
            solvedConns = getActiveConnections({ ...t, rotation: t.solvedRotation } as Tile);
        }

        return currentConns.top === solvedConns.top &&
            currentConns.right === solvedConns.right &&
            currentConns.bottom === solvedConns.bottom &&
            currentConns.left === solvedConns.left;
    });
};
