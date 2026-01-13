import { Cable, CircuitNode, CableShape, normalizeAngle } from '../types/circuit';

// Kablo renkleri
export const CABLE_COLORS = {
    normal: 'rgba(180, 180, 180, 0.7)',
    powered: 'rgba(255, 255, 255, 0.95)',
    glow: 'rgba(255, 255, 200, 0.5)',
    disconnected: 'rgba(150, 150, 150, 0.4)',
};

/**
 * Kablo için SVG path data oluştur
 * Kablo şekli SABİT - node rotasyonundan bağımsız
 */
export const getCablePathData = (
    cable: Cable,
    fromNode: CircuitNode,
    toNode: CircuitNode,
    canvasWidth: number,
    canvasHeight: number
): string => {
    // Düğüm merkezleri (piksel)
    const x1 = fromNode.x * canvasWidth;
    const y1 = fromNode.y * canvasHeight;
    const x2 = toNode.x * canvasWidth;
    const y2 = toNode.y * canvasHeight;

    switch (cable.shape) {
        case 'straight':
            return getStraightPath(x1, y1, x2, y2);
        case 'triangle':
            return getTrianglePath(x1, y1, x2, y2, cable.controlPoints);
        case 'zigzag':
            return getZigzagPath(x1, y1, x2, y2);
        case 'bezier':
        default:
            return getBezierPath(x1, y1, x2, y2, cable.fromAngle, cable.toAngle);
    }
};

/**
 * Düz çizgi
 */
const getStraightPath = (x1: number, y1: number, x2: number, y2: number): string => {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
};

/**
 * Bezier eğrisi - yumuşak kablolar
 */
const getBezierPath = (
    x1: number, y1: number,
    x2: number, y2: number,
    fromAngle: number,
    toAngle: number
): string => {
    // Mesafe
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const curveFactor = 0.4;
    const controlDistance = distance * curveFactor;

    // Kontrol noktaları - kablo açılarına göre (sabit)
    const fromRad = (fromAngle * Math.PI) / 180;
    const toRad = (toAngle * Math.PI) / 180;

    const cx1 = x1 + Math.cos(fromRad) * controlDistance;
    const cy1 = y1 + Math.sin(fromRad) * controlDistance;
    const cx2 = x2 + Math.cos(toRad) * controlDistance;
    const cy2 = y2 + Math.sin(toRad) * controlDistance;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
};

/**
 * Üçgen şekli - 3 noktadan geçen yol
 */
const getTrianglePath = (
    x1: number, y1: number,
    x2: number, y2: number,
    controlPoints?: { x: number; y: number }[]
): string => {
    // Eğer özel kontrol noktası varsa kullan
    if (controlPoints && controlPoints.length > 0) {
        const cp = controlPoints[0];
        const midX = (x1 + x2) / 2 + cp.x * Math.abs(x2 - x1);
        const midY = (y1 + y2) / 2 + cp.y * Math.abs(y2 - y1);

        // Yumuşak köşeler için quadratic bezier
        return `M ${x1} ${y1} Q ${midX} ${midY}, ${x2} ${y2}`;
    }

    // Varsayılan: orta noktayı yukarı/sola kaydır
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const perpAngle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    const offset = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) * 0.3;

    const peakX = midX + Math.cos(perpAngle) * offset;
    const peakY = midY + Math.sin(perpAngle) * offset;

    // Quadratic bezier ile yumuşak üçgen
    return `M ${x1} ${y1} Q ${peakX} ${peakY}, ${x2} ${y2}`;
};

/**
 * Zikzak şekli
 */
const getZigzagPath = (x1: number, y1: number, x2: number, y2: number): string => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Zikzak için ara noktalar
    const offsetX = (y2 - y1) * 0.2;
    const offsetY = (x1 - x2) * 0.2;

    const p1x = x1 + (x2 - x1) * 0.25 + offsetX;
    const p1y = y1 + (y2 - y1) * 0.25 + offsetY;
    const p2x = x1 + (x2 - x1) * 0.5 - offsetX;
    const p2y = y1 + (y2 - y1) * 0.5 - offsetY;
    const p3x = x1 + (x2 - x1) * 0.75 + offsetX;
    const p3y = y1 + (y2 - y1) * 0.75 + offsetY;

    return `M ${x1} ${y1} L ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${x2} ${y2}`;
};

/**
 * Kablo rengini belirle
 */
export const getCableColor = (cable: Cable): string => {
    if (!cable.isConnected) {
        return CABLE_COLORS.disconnected;
    }
    if (cable.isPowered) {
        return CABLE_COLORS.powered;
    }
    return CABLE_COLORS.normal;
};

/**
 * Kablo glow rengini belirle
 */
export const getCableGlowColor = (cable: Cable): string | null => {
    if (cable.isPowered && cable.isConnected) {
        return CABLE_COLORS.glow;
    }
    return null;
};

export default {
    getCablePathData,
    getCableColor,
    getCableGlowColor,
    CABLE_COLORS,
};
