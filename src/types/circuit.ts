/**
 * Circuit Puzzle - Grid Tabanlı Sistem
 * 
 * MİMARİ:
 * - 5x6 Grid Sistemi
 * - Parçalar "Lego" gibi kenar-kenar bağlanır
 * - Spanning Tree algoritması ile garantili çözüm
 * - Görsel bütünlük için "Eritilmiş Neon" efekti
 */

export type TileType = 'source' | 'bulb' | 'empty' | 'line' | 'corner' | 't-shape' | 'cross';

export interface GridPos {
    row: number;
    col: number;
}

// 4 Yönlü bağlantı
export interface Connections {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
}

export interface Tile {
    id: string;
    position: GridPos;
    type: TileType;
    rotation: number; // 0, 1, 2, 3 (x90 derece)
    solvedRotation: number; // Çözüm için gereken rotasyon
    baseConnections: Connections; // Rotasyonsuz orijinal bağlantılar
    isPowered: boolean;
    fixed: boolean; // Source döndürülemez
}

export interface Level {
    id: string;
    rows: number;
    cols: number;
    tiles: Tile[];
    isSolved: boolean;
}

// ============= YARDIMCI FONKSİYONLAR =============

export const generateId = (): string => Math.random().toString(36).substring(2, 9);

/**
 * Bir tile'ın şu anki rotasyonuna göre aktif bağlantılarını hesapla
 */
export const getActiveConnections = (tile: Tile): Connections => {
    const { top, right, bottom, left } = tile.baseConnections;
    // Saat yönünde döndür
    // 0: T R B L
    // 1: L T R B
    // 2: B L T R
    // 3: R B L T

    // Basit bir kaydırma mantığı
    const conns = [top, right, bottom, left];
    const rotated = [false, false, false, false];

    for (let i = 0; i < 4; i++) {
        rotated[(i + tile.rotation) % 4] = conns[i];
    }

    return {
        top: rotated[0],
        right: rotated[1],
        bottom: rotated[2],
        left: rotated[3]
    };
};

/**
 * Grid üzerinde (row, col) pozisyonundaki tile'ı bul
 */
export const getTileAt = (tiles: Tile[], row: number, col: number): Tile | undefined => {
    return tiles.find(t => t.position.row === row && t.position.col === col);
};

// ============= SEVİYE ÜRETİCİ (Spanning Tree) =============

const ROWS = 6;
const COLS = 5;

/**
 * Recursive Backtracker ile mükemmel labirent/ağ oluştur
 */
export const generateGridLevel = (): Level => {
    // 1. Grid'i hazırla (hepsi boş)
    const tiles: Tile[] = [];

    // Ziyaret edilenler matrisi
    const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));

    // Bağlantı matrisi (Hangi hücre hangisine bağlı)
    const connectionMatrix = Array(ROWS).fill(null).map(() =>
        Array(COLS).fill(null).map(() => ({ top: false, right: false, bottom: false, left: false }))
    );

    // 2. Rastgele bir başlangıç noktası seç (Genelde üst orta source olsun)
    const startRow = 0;
    const startCol = Math.floor(COLS / 2);

    // Stack tabanlı DFS
    const stack: GridPos[] = [{ row: startRow, col: startCol }];
    visited[startRow][startCol] = true;

    while (stack.length > 0) {
        const current = stack[stack.length - 1];

        // Komşuları bul (N, E, S, W)
        const neighbors: { pos: GridPos, dir: string }[] = [];

        // Top
        if (current.row > 0 && !visited[current.row - 1][current.col])
            neighbors.push({ pos: { row: current.row - 1, col: current.col }, dir: 'top' });
        // Right
        if (current.col < COLS - 1 && !visited[current.row][current.col + 1])
            neighbors.push({ pos: { row: current.row, col: current.col + 1 }, dir: 'right' });
        // Bottom
        if (current.row < ROWS - 1 && !visited[current.row + 1][current.col])
            neighbors.push({ pos: { row: current.row + 1, col: current.col }, dir: 'bottom' });
        // Left
        if (current.col > 0 && !visited[current.row][current.col - 1])
            neighbors.push({ pos: { row: current.row, col: current.col - 1 }, dir: 'left' });

        if (neighbors.length > 0) {
            // Rastgele bir komşu seç
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];

            // Duvarı yık (bağlantı kur)
            if (next.dir === 'top') {
                connectionMatrix[current.row][current.col].top = true;
                connectionMatrix[next.pos.row][next.pos.col].bottom = true;
            } else if (next.dir === 'right') {
                connectionMatrix[current.row][current.col].right = true;
                connectionMatrix[next.pos.row][next.pos.col].left = true;
            } else if (next.dir === 'bottom') {
                connectionMatrix[current.row][current.col].bottom = true;
                connectionMatrix[next.pos.row][next.pos.col].top = true;
            } else if (next.dir === 'left') {
                connectionMatrix[current.row][current.col].left = true;
                connectionMatrix[next.pos.row][next.pos.col].right = true;
            }

            visited[next.pos.row][next.pos.col] = true;
            stack.push(next.pos);
        } else {
            stack.pop();
        }
    }

    // 3. Matrise göre Tile Objelerini oluştur
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const conns = connectionMatrix[r][c];
            const connCount = (conns.top ? 1 : 0) + (conns.right ? 1 : 0) + (conns.bottom ? 1 : 0) + (conns.left ? 1 : 0);

            // Eğer hiç bağlantı yoksa boş geç (ama spanning tree'de genelde olmaz, sadece izole kalırsa)
            if (connCount === 0) continue;

            let type: TileType = 'line';
            let rotation = 0;
            let baseConns = { ...conns };

            // Tipi belirle
            if (r === startRow && c === startCol) {
                type = 'source';
                // Source genelde tek çıkışlıdır, spanning tree sayesinde zaten öyle olabilir
                // Ama görsel olarak 'source' tipini koruyalım
            } else if (connCount === 1) {
                type = 'bulb'; // Uç noktalar lamba
            } else if (connCount === 2) {
                if ((conns.top && conns.bottom) || (conns.left && conns.right)) {
                    type = 'line';
                } else {
                    type = 'corner';
                }
            } else if (connCount === 3) {
                type = 't-shape';
            } else if (connCount === 4) {
                type = 'cross';
            }

            // BULB ve SOURCE için base bağlantıları düzelt (her zaman Bottom'a baksın, biz döndürelim)
            // Bu kısım önemli: Tile'ın "varsayılan" hali ile "gereken" hali arasındaki fark rotasyondur.
            // Şimdilik basitlik için: Spanning tree'den gelen bağlantıları "base" olarak kabul edelim
            // Ve rastgele bir rotasyon ekleyelim. Base'i de o rotasyonun tersi kadar döndürelim?
            // HAYIR. BaseConnection "şeklin kendisi"dir.
            // Örneğin DÜZ ÇİZGİ'nin base'i Top-Bottom'dur.

            let finalBaseConnections = { top: false, right: false, bottom: false, left: false };

            // Şekil tiplerinin canonical (standart) halleri:
            if (type === 'line') {
                finalBaseConnections = { top: true, bottom: true, right: false, left: false };
            } else if (type === 'corner') {
                finalBaseConnections = { top: true, right: true, bottom: false, left: false }; // L şekli
            } else if (type === 't-shape') {
                finalBaseConnections = { top: false, right: true, bottom: true, left: true }; // T şekli (Aşağı bakan)
            } else if (type === 'cross') {
                finalBaseConnections = { top: true, right: true, bottom: true, left: true };
            } else if (type === 'source' || type === 'bulb') {
                finalBaseConnections = { top: false, bottom: true, right: false, left: false }; // Tek uçlu
            }

            // Şimdi bu canonical şekli, matrixtteki duruma uydurmak için ne kadar döndürmeliyiz?
            // Bu "Çözülmüş Rotasyon"dur.
            let solvedRotation = 0;

            // Brute-force ile doğru rotasyonu bul
            for (let rot = 0; rot < 4; rot++) {
                const testTile = { baseConnections: finalBaseConnections, rotation: rot } as Tile;
                const active = getActiveConnections(testTile);

                if (active.top === conns.top &&
                    active.right === conns.right &&
                    active.bottom === conns.bottom &&
                    active.left === conns.left) {
                    solvedRotation = rot;
                    break;
                }
            }

            // Şimdi rastgele bir başlangıç rotasyonu ver (Kullanıcı çözecek)
            const randomRot = Math.floor(Math.random() * 4);

            // Source sabit kalsın istiyorsak:
            const isFixed = (type === 'source');

            tiles.push({
                id: generateId(),
                position: { row: r, col: c },
                type: type,
                rotation: isFixed ? solvedRotation : randomRot,
                solvedRotation: solvedRotation,
                baseConnections: finalBaseConnections,
                isPowered: type === 'source',
                fixed: isFixed
            });
        }
    }

    // Güç akışını hesapla (ilk durum için)
    calculatePowerFlow(tiles);

    return {
        id: generateId(),
        rows: ROWS,
        cols: COLS,
        tiles,
        isSolved: false
    };
};

/**
 * Bağlantı mantığını ve güç akışını kontrol et
 */
export const calculatePowerFlow = (tiles: Tile[]): void => {
    // 1. Herkesi resetle
    tiles.forEach(t => t.isPowered = (t.type === 'source'));

    // 2. BFS
    const queue: Tile[] = tiles.filter(t => t.type === 'source');
    const visited = new Set<string>(queue.map(t => t.id));

    // Hızlı erişim için map
    const tileMap = new Map<string, Tile>();
    tiles.forEach(t => tileMap.set(`${t.position.row},${t.position.col}`, t));

    while (queue.length > 0) {
        const current = queue.shift()!;
        const r = current.position.row;
        const c = current.position.col;
        const conns = getActiveConnections(current);

        // Komşuları kontrol et
        const directions = [
            { r: -1, c: 0, dir: 'top', opp: 'bottom' },
            { r: 0, c: 1, dir: 'right', opp: 'left' },
            { r: 1, c: 0, dir: 'bottom', opp: 'top' },
            { r: 0, c: -1, dir: 'left', opp: 'right' }
        ];

        for (const d of directions) {
            // Benim bu yönde çıkışım var mı?
            if (!conns[d.dir as keyof Connections]) continue;

            // Komşu var mı?
            const neighbor = tileMap.get(`${r + d.r},${c + d.c}`);
            if (!neighbor) continue;

            // Komşunun bana girişi var mı?
            const neighborConns = getActiveConnections(neighbor);
            if (neighborConns[d.opp as keyof Connections]) {
                // Bağlantı var!
                if (!visited.has(neighbor.id)) {
                    neighbor.isPowered = true;
                    visited.add(neighbor.id);
                    queue.push(neighbor);
                }
            }
        }
    }
};

/**
 * Seviye Çözülme Kontrolü
 * 
 * KOŞULLAR:
 * 1. Tüm lambalar yanmalı (powered)
 * 2. Tüm işlevsel parçalar (functional tiles) güç kaynağına bağlı olmalı
 *    Yani hiçbir "kopuk" parça kalmamalı - devre tek bir bütün olmalı
 */
export const isLevelSolved = (tiles: Tile[]): boolean => {
    // Koşul 1: Tüm lambalar yanıyor mu?
    const bulbs = tiles.filter(t => t.type === 'bulb');
    const allBulbsPowered = bulbs.length > 0 && bulbs.every(b => b.isPowered);

    if (!allBulbsPowered) return false;

    // Koşul 2: Tüm işlevsel parçalar güç kaynağına bağlı mı?
    // Tüm tile'lar powered olmalı (kopuk parça olmamalı)
    const allTilesPowered = tiles.every(t => t.isPowered);

    return allTilesPowered;
};

/**
 * Yıldız Hesaplama
 * Bitirme süresine göre 1-3 yıldız verir
 * 
 * @param seconds - Bitirme süresi (saniye)
 * @param tileCount - Seviyedeki parça sayısı (zorluk faktörü)
 */
export const calculateStars = (seconds: number, tileCount: number): number => {
    // Zorluk faktörü: Daha fazla parça = daha fazla süre toleransı
    // Base süre: Parça başına ~3 saniye
    const baseTime = tileCount * 3;

    // 3 Yıldız: Base sürenin altında
    // 2 Yıldız: Base sürenin 2 katına kadar
    // 1 Yıldız: Üstünde (tamamladıysan en az 1)

    if (seconds <= baseTime) {
        return 3;
    } else if (seconds <= baseTime * 2) {
        return 2;
    } else {
        return 1;
    }
};
