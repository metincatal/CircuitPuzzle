import { PieceType } from '../components/PuzzlePiece';
import { GridCell, Direction, DIRECTION_OFFSETS } from './connectionLogic';

/**
 * Çözülebilir puzzle seviyeleri üreten algoritma
 * KAPALI DEVRE: Güç kaynağı → ... → Ampul → ... → Güç kaynağına geri dönüş
 */

// Yönlere göre parça tipi ve rotasyon hesapla
const getRotationForDirections = (dirs: Direction[]): { type: PieceType; rotation: number } => {
    const sortedDirs = [...dirs].sort((a, b) => a - b);

    // L parçası için rotasyon hesapla (2 bağlantı)
    if (sortedDirs.length === 2) {
        const [d1, d2] = sortedDirs;

        // L parçası: base olarak 0,1 (üst-sağ)
        if (d1 === 0 && d2 === 1) return { type: 'L', rotation: 0 };
        if (d1 === 1 && d2 === 2) return { type: 'L', rotation: 90 };
        if (d1 === 2 && d2 === 3) return { type: 'L', rotation: 180 };
        if (d1 === 0 && d2 === 3) return { type: 'L', rotation: 270 };

        // I parçası (düz çizgi)
        if (d1 === 0 && d2 === 2) return { type: 'I', rotation: 0 };
        if (d1 === 1 && d2 === 3) return { type: 'I', rotation: 90 };
    }

    // T parçası için rotasyon (3 bağlantı)
    if (sortedDirs.length === 3) {
        if (!sortedDirs.includes(0)) return { type: 'T', rotation: 180 }; // Üst yok
        if (!sortedDirs.includes(1)) return { type: 'T', rotation: 270 }; // Sağ yok
        if (!sortedDirs.includes(2)) return { type: 'T', rotation: 0 };   // Alt yok
        if (!sortedDirs.includes(3)) return { type: 'T', rotation: 90 };  // Sol yok
    }

    // X parçası (4 bağlantı)
    if (sortedDirs.length === 4) {
        return { type: 'X', rotation: 0 };
    }

    return { type: 'L', rotation: 0 };
};

/**
 * KAPALI DEVRE üreten ana fonksiyon
 * Güç kaynağından çıkıp ampulden geçip tekrar güç kaynağına dönen bir döngü oluşturur
 */
export const generateSolvableLevel = (
    gridSize: number,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): GridCell[][] => {
    // Boş grid oluştur
    const grid: GridCell[][] = Array(gridSize).fill(null).map(() =>
        Array(gridSize).fill(null).map(() => ({
            type: 'empty' as PieceType,
            rotation: 0,
            isSource: false,
            isBulb: false,
            isPowered: false,
        }))
    );

    // Güç kaynağı ve ampul pozisyonları
    const sourcePos = { row: 0, col: 0 };
    const bulbPos = { row: gridSize - 1, col: gridSize - 1 };

    // KAPALI DEVRE için döngü yolu oluştur
    const loop = generateClosedLoop(gridSize, sourcePos, bulbPos);

    if (loop.length === 0) {
        console.warn('Döngü oluşturulamadı, varsayılan puzzle kullanılıyor');
        return generateDefaultClosedCircuit(gridSize);
    }

    // Döngü üzerindeki hücreleri doldur
    // Her hücrenin önceki ve sonraki komşusuna bağlantısı olmalı
    for (let i = 0; i < loop.length; i++) {
        const { row, col } = loop[i];
        const directions: Direction[] = [];

        // Önceki hücreye bağlantı (döngüde son eleman ilk elemana bağlı)
        const prevIndex = (i - 1 + loop.length) % loop.length;
        const prev = loop[prevIndex];
        const dirToPrev = getDirection(row, col, prev.row, prev.col);
        if (dirToPrev !== null) directions.push(dirToPrev);

        // Sonraki hücreye bağlantı
        const nextIndex = (i + 1) % loop.length;
        const next = loop[nextIndex];
        const dirToNext = getDirection(row, col, next.row, next.col);
        if (dirToNext !== null) directions.push(dirToNext);

        // Parça tipini ve rotasyonunu belirle
        const { type, rotation } = getRotationForDirections(directions);

        grid[row][col] = {
            type,
            rotation,
            isSource: row === sourcePos.row && col === sourcePos.col,
            isBulb: row === bulbPos.row && col === bulbPos.col,
            isPowered: false,
        };
    }

    // Boş hücreleri dekoratif parçalarla doldur
    fillEmptyCells(grid, gridSize);

    // Puzzle'ı karıştır (rotasyonları randomize et)
    const shuffleAmount = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    shuffleRotations(grid, shuffleAmount);

    return grid;
};

/**
 * Kapalı döngü oluştur (source -> bulb -> source arası geçerli yol)
 * Basit bir dikdörtgen veya L şeklinde döngü
 */
const generateClosedLoop = (
    gridSize: number,
    source: { row: number; col: number },
    bulb: { row: number; col: number }
): { row: number; col: number }[] => {
    const loop: { row: number; col: number }[] = [];

    // Basit strateji: Kenarları takip eden bir döngü oluştur
    // Source (0,0) -> sağa git -> aşağı git -> sola git -> yukarı git -> source'a dön

    // Minimum 4 hücrelik döngü için
    if (gridSize < 2) return [];

    // Rastgele döngü şekli seç
    const loopType = Math.floor(Math.random() * 3);

    if (loopType === 0) {
        // Kenar döngüsü (tüm kenarları kullan)
        return generateEdgeLoop(gridSize);
    } else if (loopType === 1) {
        // İç döngü (daha küçük kare)
        return generateInnerLoop(gridSize, source, bulb);
    } else {
        // Rastgele döngü
        return generateRandomLoop(gridSize, source, bulb);
    }
};

/**
 * Kenarları takip eden döngü
 */
const generateEdgeLoop = (gridSize: number): { row: number; col: number }[] => {
    const loop: { row: number; col: number }[] = [];

    // Üst kenar (soldan sağa)
    for (let col = 0; col < gridSize; col++) {
        loop.push({ row: 0, col });
    }

    // Sağ kenar (yukarıdan aşağı)
    for (let row = 1; row < gridSize; row++) {
        loop.push({ row, col: gridSize - 1 });
    }

    // Alt kenar (sağdan sola)
    for (let col = gridSize - 2; col >= 0; col--) {
        loop.push({ row: gridSize - 1, col });
    }

    // Sol kenar (aşağıdan yukarı, başlangıca dönmeden)
    for (let row = gridSize - 2; row >= 1; row--) {
        loop.push({ row, col: 0 });
    }

    return loop;
};

/**
 * İç döngü (daha küçük)
 */
const generateInnerLoop = (
    gridSize: number,
    source: { row: number; col: number },
    bulb: { row: number; col: number }
): { row: number; col: number }[] => {
    const loop: { row: number; col: number }[] = [];

    // Source'dan başla
    loop.push(source);

    // Sağa git
    for (let col = 1; col < gridSize; col++) {
        loop.push({ row: 0, col });
    }

    // Aşağı git
    for (let row = 1; row < gridSize; row++) {
        loop.push({ row, col: gridSize - 1 });
    }

    // Sola git (bulb dahil)
    for (let col = gridSize - 2; col >= 0; col--) {
        loop.push({ row: gridSize - 1, col });
    }

    // Yukarı git (source'a dönmeden önce)
    for (let row = gridSize - 2; row >= 1; row--) {
        loop.push({ row, col: 0 });
    }

    return loop;
};

/**
 * Rastgele döngü oluştur
 */
const generateRandomLoop = (
    gridSize: number,
    source: { row: number; col: number },
    bulb: { row: number; col: number }
): { row: number; col: number }[] => {
    // Basit bir yol + geri dönüş oluştur
    const path1: { row: number; col: number }[] = [];
    const path2: { row: number; col: number }[] = [];

    // Yol 1: Source -> Bulb (üst ve sağ kenardan)
    // Önce sağa git, sonra aşağı
    let row = source.row;
    let col = source.col;

    // Sağa rastgele mesafe
    const rightSteps = Math.min(gridSize - 1, Math.floor(Math.random() * (gridSize - 1)) + 1);
    for (let i = 0; i <= rightSteps; i++) {
        path1.push({ row, col: i });
    }
    col = rightSteps;

    // Aşağı bulb'a kadar
    for (let r = 1; r <= bulb.row; r++) {
        path1.push({ row: r, col });
    }
    row = bulb.row;

    // Sağa bulb'a kadar (eğer gerekirse)
    for (let c = col + 1; c <= bulb.col; c++) {
        path1.push({ row, col: c });
    }

    // Yol 2: Bulb -> Source (alt ve sol kenardan geri dön)
    row = bulb.row;
    col = bulb.col;

    // Sola git
    for (let c = bulb.col - 1; c >= 0; c--) {
        path2.push({ row: bulb.row, col: c });
    }
    col = 0;

    // Yukarı source'a dön
    for (let r = bulb.row - 1; r >= source.row + 1; r--) {
        path2.push({ row: r, col: 0 });
    }

    // Döngüyü birleştir (tekrarları kaldır)
    const loop = [...path1];
    for (const pos of path2) {
        // Zaten döngüde yoksa ekle
        if (!loop.some(p => p.row === pos.row && p.col === pos.col)) {
            loop.push(pos);
        }
    }

    return loop.length >= 4 ? loop : generateEdgeLoop(gridSize);
};

/**
 * İki hücre arasındaki yönü bul
 */
const getDirection = (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number
): Direction | null => {
    if (toRow === fromRow - 1 && toCol === fromCol) return 0; // Üst
    if (toRow === fromRow && toCol === fromCol + 1) return 1; // Sağ
    if (toRow === fromRow + 1 && toCol === fromCol) return 2; // Alt
    if (toRow === fromRow && toCol === fromCol - 1) return 3; // Sol
    return null;
};

/**
 * Boş hücreleri dekoratif parçalarla doldur
 */
const fillEmptyCells = (grid: GridCell[][], gridSize: number): void => {
    const decorativeTypes: PieceType[] = ['L', 'I', 'T'];

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (grid[row][col].type === 'empty') {
                const type = decorativeTypes[Math.floor(Math.random() * decorativeTypes.length)];
                const rotation = Math.floor(Math.random() * 4) * 90;

                grid[row][col] = {
                    type,
                    rotation,
                    isSource: false,
                    isBulb: false,
                    isPowered: false,
                };
            }
        }
    }
};

/**
 * Rotasyonları karıştır
 */
const shuffleRotations = (grid: GridCell[][], amount: number): void => {
    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            const shuffleSteps = Math.floor(Math.random() * (amount + 1)) + 1;
            grid[row][col].rotation += shuffleSteps * 90;
        }
    }
};

/**
 * Varsayılan kapalı devre (fallback) - basit kare döngü
 */
const generateDefaultClosedCircuit = (gridSize: number): GridCell[][] => {
    const grid: GridCell[][] = Array(gridSize).fill(null).map(() =>
        Array(gridSize).fill(null).map(() => ({
            type: 'L' as PieceType,
            rotation: 0,
            isSource: false,
            isBulb: false,
            isPowered: false,
        }))
    );

    // Kenar döngüsü oluştur
    const loop = generateEdgeLoop(gridSize);

    for (let i = 0; i < loop.length; i++) {
        const { row, col } = loop[i];
        const directions: Direction[] = [];

        const prevIndex = (i - 1 + loop.length) % loop.length;
        const prev = loop[prevIndex];
        const dirToPrev = getDirection(row, col, prev.row, prev.col);
        if (dirToPrev !== null) directions.push(dirToPrev);

        const nextIndex = (i + 1) % loop.length;
        const next = loop[nextIndex];
        const dirToNext = getDirection(row, col, next.row, next.col);
        if (dirToNext !== null) directions.push(dirToNext);

        const { type, rotation } = getRotationForDirections(directions);

        grid[row][col] = {
            type,
            rotation: rotation + Math.floor(Math.random() * 4) * 90, // Karıştır
            isSource: row === 0 && col === 0,
            isBulb: row === gridSize - 1 && col === gridSize - 1,
            isPowered: false,
        };
    }

    return grid;
};

/**
 * Seviye zorluk ayarları
 */
export const DIFFICULTY_SETTINGS = {
    easy: { gridSize: 3, name: 'Kolay', color: '#00ffaa' },
    medium: { gridSize: 4, name: 'Orta', color: '#ffaa00' },
    hard: { gridSize: 5, name: 'Zor', color: '#ff5555' },
};
