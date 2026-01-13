import React, { useMemo } from 'react';
import { View, Dimensions, Pressable } from 'react-native';
import Svg, { Path, Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import {
    Level,
    getActiveConnections,
} from '../types/circuit';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// LİKİT METAL RENK PALETİ
const COLORS = {
    // Sönük Hali (Koyu, transparan)
    passive: 'rgba(255, 255, 255, 0.1)',

    // Aktif Hali (Parlak Beyaz + Neon Glow)
    active: '#ffffff',
    glow: '#00fff2', // Cyberpunk Cyan Glow

    // Ampul
    bulbOff: 'rgba(255, 255, 255, 0.2)',
    bulbOn: '#ffeaa7',
    bulbGlow: '#fdcb6e',

    // Kaynak
    sourceCore: '#ff0055', // Neon Pembe/Kırmızı
};

const STROKE_WIDTH = 14;
const GLOW_WIDTH = 26;
const OVERFLOW_AMOUNT = 3; // Kenar taşma mikarı (piksel)

interface CircuitCanvasProps {
    level: Level;
    onTilePress: (tileId: string) => void;
}

const ZenNoise = ({ width, height }: { width: number, height: number }) => (
    <G opacity={0.05}>
        <Path d={`M 0 ${height * 0.3} Q ${width * 0.5} ${height * 0.6} ${width} ${height * 0.2}`} stroke="#fff" strokeWidth={1} fill="none" />
        <Path d={`M ${width * 0.2} 0 Q ${width * 0.5} ${height * 0.5} ${width * 0.8} ${height}`} stroke="#fff" strokeWidth={1} fill="none" />
    </G>
);

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
    level,
    onTilePress,
}) => {
    const canvasWidth = SCREEN_WIDTH - 20;
    const cellSize = canvasWidth / level.cols;
    const canvasHeight = cellSize * level.rows;

    const tileGraphics = useMemo(() => {
        return level.tiles.map(tile => {
            const activeConns = getActiveConnections(tile);

            // Merkez koordinat
            const cx = tile.position.col * cellSize + cellSize / 2;
            const cy = tile.position.row * cellSize + cellSize / 2;
            const size = cellSize;
            const half = size / 2;

            // Kenar Koordinatları (OVERFLOW DAHİL)
            // Bu kritik: Çizgiler artık hücre sınırında bitmiyor, komşunun içine giriyor.
            const top = { x: cx, y: cy - half - OVERFLOW_AMOUNT };
            const right = { x: cx + half + OVERFLOW_AMOUNT, y: cy };
            const bottom = { x: cx, y: cy + half + OVERFLOW_AMOUNT };
            const left = { x: cx - half - OVERFLOW_AMOUNT, y: cy };

            // Grid Köşeleri (Bezier Kontrol Noktaları iç sınırda kalabilir, ama kavis dışa taşmalı)
            // Daha yumuşak kavis için kontrol noktalarını biraz içeri çekebiliriz veya tam köşede tutabiliriz.
            const tr = { x: cx + half, y: cy - half };
            const br = { x: cx + half, y: cy + half };
            const bl = { x: cx - half, y: cy + half };
            const tl = { x: cx - half, y: cy - half };

            let d = "";
            let isJunction = false;

            const conns = Object.entries(activeConns).filter(([_, v]) => v).map(([k]) => k);
            const count = conns.length;

            if (tile.type === 'source') {
                // Source artık yönlü bir "kafa" gibi çizilecek.
                // Sadece bağlantı olan yöne doğru kalın bir çıkıntı
                isJunction = true; // Merkezde büyük bir top olsun
                if (activeConns.top) d = `M ${cx} ${cy} L ${top.x} ${top.y}`;
                if (activeConns.right) d = `M ${cx} ${cy} L ${right.x} ${right.y}`;
                if (activeConns.bottom) d = `M ${cx} ${cy} L ${bottom.x} ${bottom.y}`;
                if (activeConns.left) d = `M ${cx} ${cy} L ${left.x} ${left.y}`;
            }
            else if (tile.type === 'bulb') {
                // Ampul de uca bağlanan bir sap
                if (activeConns.top) d = `M ${cx} ${cy} L ${top.x} ${top.y}`;
                else if (activeConns.right) d = `M ${cx} ${cy} L ${right.x} ${right.y}`;
                else if (activeConns.bottom) d = `M ${cx} ${cy} L ${bottom.x} ${bottom.y}`;
                else if (activeConns.left) d = `M ${cx} ${cy} L ${left.x} ${left.y}`;
            }
            else if (count === 2) {
                const isLine = (activeConns.top && activeConns.bottom) || (activeConns.left && activeConns.right);
                if (isLine) {
                    if (activeConns.top) d = `M ${top.x} ${top.y} L ${bottom.x} ${bottom.y}`;
                    else d = `M ${left.x} ${left.y} L ${right.x} ${right.y}`;
                } else {
                    // Curved Corner
                    // Kavisin düzgün görünmesi için Path yönü önemli değil çünkü tek renk
                    if (activeConns.top && activeConns.right) d = `M ${top.x} ${top.y} Q ${tr.x} ${tr.y} ${right.x} ${right.y}`;
                    else if (activeConns.right && activeConns.bottom) d = `M ${right.x} ${right.y} Q ${br.x} ${br.y} ${bottom.x} ${bottom.y}`;
                    else if (activeConns.bottom && activeConns.left) d = `M ${bottom.x} ${bottom.y} Q ${bl.x} ${bl.y} ${left.x} ${left.y}`;
                    else if (activeConns.left && activeConns.top) d = `M ${left.x} ${left.y} Q ${tl.x} ${tl.y} ${top.x} ${top.y}`;
                }
            } else {
                // T veya Cross -> Junction
                isJunction = true;
                if (activeConns.top) d += `M ${top.x} ${top.y} L ${cx} ${cy} `;
                if (activeConns.right) d += `M ${right.x} ${right.y} L ${cx} ${cy} `;
                if (activeConns.bottom) d += `M ${bottom.x} ${bottom.y} L ${cx} ${cy} `;
                if (activeConns.left) d += `M ${left.x} ${left.y} L ${cx} ${cy} `;
            }

            return {
                ...tile,
                cx, cy, d, isJunction,
                // Source veya Bulb iseler özel çizim gerekecek
            };
        });
    }, [level, cellSize]);

    return (
        <View style={{ width: canvasWidth, height: canvasHeight }}>
            <Svg width={canvasWidth} height={canvasHeight}>
                <Defs>
                    {/* Source Glow - Kırmızımsı */}
                    <RadialGradient id="gradSource" cx="50%" cy="50%" rx="50%" ry="50%">
                        <Stop offset="0" stopColor={COLORS.sourceCore} stopOpacity="0.8" />
                        <Stop offset="1" stopColor={COLORS.sourceCore} stopOpacity="0" />
                    </RadialGradient>
                    {/* Bulb Glow - Altın */}
                    <RadialGradient id="gradBulb" cx="50%" cy="50%" rx="50%" ry="50%">
                        <Stop offset="0" stopColor={COLORS.bulbGlow} stopOpacity="0.8" />
                        <Stop offset="1" stopColor={COLORS.bulbGlow} stopOpacity="0" />
                    </RadialGradient>
                </Defs>

                {/* --- 0. BACKGROUND NOISE --- */}
                <ZenNoise width={canvasWidth} height={canvasHeight} />

                {/* --- 1. GLOW LAYER (Sadece Powered Tiles) --- */}
                {tileGraphics.filter(t => t.isPowered).map(t => (
                    <Path
                        key={`glow-${t.id}`}
                        d={t.d}
                        stroke={COLORS.glow}
                        strokeWidth={GLOW_WIDTH}
                        strokeOpacity={0.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                ))}

                {/* --- 2. MAIN PATH LAYER (Liquid Metal) --- */}
                {tileGraphics.map(t => {
                    // Source ve Bulb hariç diğerleri aynı stilde
                    return (
                        <G key={t.id}>
                            <Path
                                d={t.d}
                                stroke={t.isPowered ? COLORS.active : COLORS.passive}
                                strokeWidth={STROKE_WIDTH}
                                strokeLinecap="round" // Bu "round" sayesinde taşan kısımlar yumuşak birleşir
                                strokeLinejoin="round"
                                fill="none"
                            />

                            {/* JUNCTION FUSION */}
                            {t.isJunction && (
                                <Circle
                                    cx={t.cx} cy={t.cy}
                                    r={STROKE_WIDTH / 2}
                                    fill={t.isPowered ? COLORS.active : COLORS.passive}
                                />
                            )}

                            {/* SOURCE ICON */}
                            {t.type === 'source' && (
                                <G>
                                    {/* Dönerken yönünü belli eden bir tasarım: Üçgen */}
                                    {/* Rotasyona göre şekli çevirmek yerine, SVG transform kullanacağız */}
                                    <G
                                        origin={`${t.cx}, ${t.cy}`}
                                        rotation={t.rotation * 90} // Tile rotasyonu
                                    >
                                        {/* Enerji Çekirdeği Glow */}
                                        {t.isPowered && <Circle cx={t.cx} cy={t.cy} r={22} fill="url(#gradSource)" opacity={0.6} />}

                                        {/* Yön Ok'u / Gövde */}
                                        {/* Aşağı (Bottom) varsayılan yön olsun, dönüşle düzelir */}
                                        {/* Hayır, Tile mantığında baseConnection neyse o. Biz çizimi ona göre yapmalıyız. */}
                                        {/* Ama yukarıda 'd' hesabını zaten rotasyona göre yaptık. Buradaki ikon sadece süs. */}

                                        {/* Source Core */}
                                        <Circle cx={t.cx} cy={t.cy} r={10} fill={COLORS.sourceCore} stroke="#fff" strokeWidth={2} />

                                        {/* Şimşek İkonu */}
                                        <Path
                                            d={`M ${t.cx - 3} ${t.cy - 5} L ${t.cx + 3} ${t.cy} L ${t.cx - 1} ${t.cy} L ${t.cx + 2} ${t.cy + 5}`}
                                            stroke="#fff" strokeWidth={2} fill="none"
                                        />
                                    </G>
                                </G>
                            )}

                            {/* BULB ICON */}
                            {t.type === 'bulb' && (
                                <G>
                                    {t.isPowered && <Circle cx={t.cx} cy={t.cy} r={24} fill="url(#gradBulb)" opacity={0.6} />}

                                    {/* Ampul Camı */}
                                    <Circle
                                        cx={t.cx} cy={t.cy} r={9}
                                        fill={t.isPowered ? COLORS.bulbOn : COLORS.bulbOff}
                                        stroke={t.isPowered ? "#fff" : "transparent"} strokeWidth={2}
                                    />
                                </G>
                            )}
                        </G>
                    );
                })}
            </Svg>

            {/* --- TOUCH LAYER --- */}
            {tileGraphics.map((t, i) => (
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
