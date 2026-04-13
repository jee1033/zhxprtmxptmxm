import { Direction, EyeResult, QualityFlags } from './types';

export const allDirections: Direction[] = ['up', 'down', 'left', 'right'];

export function nextDirection(prev: Direction | null): Direction {
  const pool = prev ? allDirections.filter((d) => d !== prev) : allDirections;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function makeQualityFlags(overrides?: Partial<QualityFlags>): QualityFlags {
  return {
    face_ok: true,
    pose_ok: true,
    motion_ok: true,
    distance_ok: true,
    viewport_ok: true,
    lighting_ok: true,
    ...overrides,
  };
}

export function logMarToDecimal(logmar: number): number {
  return Number((10 ** -logmar).toFixed(2));
}

export function logMarToSnellen(logmar: number): string {
  const denominator = Math.round(20 * 10 ** logmar);
  return `20/${denominator}`;
}

export function confidenceFromQuality(valid: number, invalid: number): EyeResult['confidence'] {
  const ratio = valid === 0 ? 1 : invalid / (valid + invalid);
  if (valid >= 12 && ratio <= 0.2) return 'High';
  if (valid >= 8 && ratio <= 0.4) return 'Medium';
  return 'Low';
}
