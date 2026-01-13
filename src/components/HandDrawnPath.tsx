import React, { useMemo } from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';

interface Point {
    x: number;
    y: number;
}

interface HandDrawnPathProps {
    startPoint: Point;
    endPoint: Point;
    color?: string;
    strokeWidth?: number;
    jitterAmount?: number;
    glowing?: boolean;
    glowColor?: string;
}

/**
 * El çizimi hissi veren kavisli çizgi bileşeni (SVG)
 * Quadratic Bezier eğrileri ve rastgele sapmalar kullanır
 */
export const HandDrawnPath: React.FC<HandDrawnPathProps> = ({
    startPoint,
    endPoint,
    color = '#00ffaa',
    strokeWidth = 3,
    jitterAmount = 4,
    glowing = false,
    glowColor,
}) => {
    // Rastgele sapma (jitter) üreten fonksiyon
    const addJitter = (value: number, amount: number): number => {
        return value + (Math.random() - 0.5) * amount;
    };

    // El çizimi path'i oluştur
    const pathData = useMemo(() => {
        // Başlangıç noktası (hafif jitter ile)
        const jitteredStart = {
            x: addJitter(startPoint.x, jitterAmount * 0.5),
            y: addJitter(startPoint.y, jitterAmount * 0.5),
        };

        // Bitiş noktası (hafif jitter ile)
        const jitteredEnd = {
            x: addJitter(endPoint.x, jitterAmount * 0.5),
            y: addJitter(endPoint.y, jitterAmount * 0.5),
        };

        // Orta nokta hesapla
        const midX = (jitteredStart.x + jitteredEnd.x) / 2;
        const midY = (jitteredStart.y + jitteredEnd.y) / 2;

        // Çizginin yönüne dik bir sapma oluştur (el çizimi etkisi için)
        const dx = jitteredEnd.x - jitteredStart.x;
        const dy = jitteredEnd.y - jitteredStart.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        // Dik yön vektörü (normalize edilmiş)
        const perpX = length > 0 ? -dy / length : 0;
        const perpY = length > 0 ? dx / length : 0;

        // Rastgele kavis miktarı (çizgi uzunluğuna orantılı)
        const curveAmount = (Math.random() - 0.5) * length * 0.15;

        // Kontrol noktası (orta noktadan dik yönde sapma)
        const controlPoint = {
            x: midX + perpX * curveAmount + addJitter(0, jitterAmount),
            y: midY + perpY * curveAmount + addJitter(0, jitterAmount),
        };

        // SVG Path data oluştur (Quadratic Bezier)
        return `M ${jitteredStart.x} ${jitteredStart.y} Q ${controlPoint.x} ${controlPoint.y} ${jitteredEnd.x} ${jitteredEnd.y}`;
    }, [startPoint, endPoint, jitterAmount]);

    const actualGlowColor = glowColor || color;

    return (
        <G>
            {/* Glow efekti (opsiyonel) */}
            {glowing && (
                <>
                    {/* Dış glow */}
                    <Path
                        d={pathData}
                        stroke={actualGlowColor}
                        strokeWidth={strokeWidth + 16}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        opacity={0.1}
                    />

                    {/* Orta glow */}
                    <Path
                        d={pathData}
                        stroke={actualGlowColor}
                        strokeWidth={strokeWidth + 10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        opacity={0.2}
                    />

                    {/* İç glow */}
                    <Path
                        d={pathData}
                        stroke={actualGlowColor}
                        strokeWidth={strokeWidth + 4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        opacity={0.4}
                    />
                </>
            )}

            {/* Ana çizgi */}
            <Path
                d={pathData}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </G>
    );
};

export default HandDrawnPath;
