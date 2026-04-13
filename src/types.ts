export type AppState =
  | 'idle'
  | 'permissions'
  | 'device_check'
  | 'calibration'
  | 'face_alignment'
  | 'practice_right'
  | 'test_right'
  | 'practice_left'
  | 'test_left'
  | 'results'
  | 'paused'
  | 'fatal_error';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type Eye = 'right' | 'left';

export interface QualityFlags {
  face_ok: boolean;
  pose_ok: boolean;
  motion_ok: boolean;
  distance_ok: boolean;
  viewport_ok: boolean;
  lighting_ok: boolean;
}

export interface ItemResult {
  eye: Eye;
  directionShown: Direction;
  difficultyLogmar: number;
  response: Direction | 'timeout';
  isCorrect: boolean;
  responseMs: number;
  qualityFlags: QualityFlags;
  wasInvalidated: boolean;
}

export interface EyeResult {
  estimatedLogmar: number;
  decimalAcuity: number;
  snellenEquivalent: string;
  confidence: 'High' | 'Medium' | 'Low';
  validItems: number;
  invalidItems: number;
}
