import { useEffect, useMemo, useRef, useState } from 'react';
import { TumblingE } from './optotype';
import { AppState, Direction, Eye, EyeResult, ItemResult, QualityFlags } from './types';
import {
  clamp,
  confidenceFromQuality,
  logMarToDecimal,
  logMarToSnellen,
  makeQualityFlags,
  nextDirection,
} from './utils';

interface SessionData {
  mmPerCssPx: number | null;
  permission: {
    camera: 'unknown' | 'granted' | 'denied';
    motion: 'unknown' | 'granted' | 'denied';
  };
  eyeResults: Partial<Record<Eye, EyeResult>>;
}

const initialSession: SessionData = {
  mmPerCssPx: null,
  permission: { camera: 'unknown', motion: 'unknown' },
  eyeResults: {},
};

const initialDifficulty = 0.7;

const layout = {
  card: {
    width: 'min(100%, 520px)',
    margin: '0 auto',
    padding: 'max(12px, env(safe-area-inset-top)) 14px max(16px, env(safe-area-inset-bottom))',
    boxSizing: 'border-box' as const,
  },
  section: {
    background: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  button: {
    minHeight: 48,
    width: '100%',
    borderRadius: 12,
    border: '1px solid #d0d7de',
    background: '#f9fafb',
    padding: '10px 12px',
    fontWeight: 600,
  },
};

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [resumeState, setResumeState] = useState<AppState>('idle');
  const [session, setSession] = useState<SessionData>(initialSession);
  const [cardWidthPx, setCardWidthPx] = useState(320);
  const [direction, setDirection] = useState<Direction>('right');
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [currentEye, setCurrentEye] = useState<Eye>('right');
  const [validItems, setValidItems] = useState(0);
  const [invalidItems, setInvalidItems] = useState(0);
  const [reversals, setReversals] = useState(0);
  const [lastMove, setLastMove] = useState<'up' | 'down' | null>(null);
  const [items, setItems] = useState<ItemResult[]>([]);
  const [alert, setAlert] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const startMsRef = useRef<number>(0);
  const baselineFaceRef = useRef<number | null>(null);
  const pitchRef = useRef(0);
  const rollRef = useRef(0);
  const accelRef = useRef(0);

  const phaseLabel = useMemo(() => {
    const map: Record<AppState, string> = {
      idle: '시작', permissions: '권한', device_check: '기기 준비', calibration: '보정',
      face_alignment: '얼굴 정렬', practice_right: '우안 연습', test_right: '우안 검사',
      practice_left: '좌안 연습', test_left: '좌안 검사', results: '결과', paused: '일시정지', fatal_error: '오류'
    };
    return map[state];
  }, [state]);

  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === 'hidden' && state.includes('test')) {
        pauseWithMessage('백그라운드 전환으로 일시정지되었습니다.');
      }
      if (document.visibilityState === 'visible' && state === 'paused') {
        await acquireWakeLock();
      }
    };

    const onResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      if (Math.abs(vv.scale - 1) > 0.01 && (state.includes('test') || state.includes('practice'))) {
        pauseWithMessage('줌이 감지되어 검사 일시정지됨. 원래 배율(1x)로 돌려주세요.');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.visualViewport?.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [state]);

  useEffect(() => {
    const onOrientation = (e: DeviceOrientationEvent) => {
      pitchRef.current = e.beta ?? 0;
      rollRef.current = e.gamma ?? 0;
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      accelRef.current = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
    };
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, []);

  async function requestPermissions() {
    try {
      if (!window.isSecureContext) throw new Error('HTTPS 환경이 아닙니다.');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaRef.current = stream;
      setSession((s) => ({ ...s, permission: { ...s.permission, camera: 'granted' } }));

      let motionStatus: SessionData['permission']['motion'] = 'unknown';
      try {
        const reqOri = (DeviceOrientationEvent as any).requestPermission;
        const reqMot = (DeviceMotionEvent as any).requestPermission;
        if (isIOS() && (reqOri || reqMot)) {
          const oriResult = reqOri ? await reqOri() : 'granted';
          const motResult = reqMot ? await reqMot() : 'granted';
          motionStatus = oriResult === 'granted' && motResult === 'granted' ? 'granted' : 'denied';
        } else {
          motionStatus = 'granted';
        }
      } catch {
        motionStatus = 'denied';
      }

      setSession((s) => ({ ...s, permission: { ...s.permission, motion: motionStatus } }));
      setState('device_check');
      await acquireWakeLock();
    } catch (e) {
      setSession((s) => ({ ...s, permission: { ...s.permission, camera: 'denied' } }));
      setAlert(`카메라 권한 요청 실패: ${(e as Error).message}`);
      setState('fatal_error');
    }
  }

  async function acquireWakeLock() {
    try {
      wakeLockRef.current = await navigator.wakeLock?.request('screen');
      wakeLockRef.current?.addEventListener('release', () => {
        if (document.visibilityState === 'visible') acquireWakeLock();
      });
    } catch {
      setAlert('Wake Lock을 획득하지 못했습니다. 화면이 꺼지지 않게 주의해주세요.');
    }
  }

  async function bindVideo() {
    if (!videoRef.current || !mediaRef.current) return;
    videoRef.current.srcObject = mediaRef.current;
    await videoRef.current.play();
  }

  function completeCalibration() {
    const mmPerCssPx = 85.6 / cardWidthPx;
    setSession((s) => ({ ...s, mmPerCssPx }));
    setState('face_alignment');
    setTimeout(bindVideo, 0);
  }

  function beginPractice(eye: Eye) {
    setCurrentEye(eye);
    setDirection(nextDirection(null));
    setState(eye === 'right' ? 'practice_right' : 'practice_left');
    startMsRef.current = performance.now();
  }

  function beginTest() {
    setDifficulty(initialDifficulty);
    setValidItems(0);
    setInvalidItems(0);
    setReversals(0);
    setLastMove(null);
    setItems([]);
    setDirection(nextDirection(null));
    setState(currentEye === 'right' ? 'test_right' : 'test_left');
    startMsRef.current = performance.now();
  }

  function qualityGate(): QualityFlags {
    const video = videoRef.current;
    const vv = window.visualViewport;
    const viewport_ok = vv ? Math.abs(vv.scale - 1) < 0.01 : true;
    const pose_ok = Math.abs(rollRef.current) < 20 && Math.abs(pitchRef.current) < 35;
    const motion_ok = accelRef.current < 35 || session.permission.motion !== 'granted';

    let lighting_ok = true;
    let face_ok = false;
    let distance_ok = true;

    if (video && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let sum = 0;
        let edges = 0;
        for (let i = 0; i < data.length; i += 4) {
          const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          sum += y;
          if (i > 8) edges += Math.abs(y - 0.2126 * data[i - 4] - 0.7152 * data[i - 3] - 0.0722 * data[i - 2]);
        }
        const mean = sum / (data.length / 4);
        const contrast = edges / (data.length / 4);
        lighting_ok = mean > 45 && contrast > 5;
        face_ok = mean > 25;

        const proxy = clamp((video.videoHeight + video.videoWidth) / 2, 0, 5000);
        if (!baselineFaceRef.current) baselineFaceRef.current = proxy;
        const ratio = proxy / baselineFaceRef.current;
        distance_ok = ratio > 0.88 && ratio < 1.12;
      }
    }

    return makeQualityFlags({ face_ok, pose_ok, motion_ok, distance_ok, viewport_ok, lighting_ok });
  }

  function answer(response: Direction) {
    const now = performance.now();
    const q = qualityGate();
    const isInvalid = !Object.values(q).every(Boolean);
    if (isInvalid) {
      setInvalidItems((v) => v + 1);
      setAlert('품질 조건 미달로 문항이 무효 처리되었습니다. 자세/거리/밝기를 확인하세요.');
      setDirection((prev) => nextDirection(prev));
      startMsRef.current = now;
      return;
    }

    const isCorrect = response === direction;
    const move = isCorrect ? 'down' : 'up';

    if (lastMove && lastMove !== move) setReversals((r) => r + 1);
    setLastMove(move);
    setDifficulty((d) => clamp(Number((d + (isCorrect ? -0.1 : 0.1)).toFixed(1)), -0.3, 1.0));
    setValidItems((v) => v + 1);

    const item: ItemResult = {
      eye: currentEye,
      directionShown: direction,
      difficultyLogmar: difficulty,
      response,
      isCorrect,
      responseMs: Math.round(now - startMsRef.current),
      qualityFlags: q,
      wasInvalidated: false,
    };
    setItems((prev) => [...prev, item]);
    setDirection((prev) => nextDirection(prev));
    startMsRef.current = now;
  }

  useEffect(() => {
    const isTesting = state === 'test_right' || state === 'test_left';
    if (!isTesting) return;
    const done = (reversals >= 3 && validItems >= 12) || validItems >= 24;
    if (!done) return;

    const latest = items.slice(-5);
    const avg = latest.length ? latest.reduce((s, i) => s + i.difficultyLogmar, 0) / latest.length : difficulty;
    const estimatedLogmar = Number(avg.toFixed(2));

    const result: EyeResult = {
      estimatedLogmar,
      decimalAcuity: logMarToDecimal(estimatedLogmar),
      snellenEquivalent: logMarToSnellen(estimatedLogmar),
      confidence: confidenceFromQuality(validItems, invalidItems),
      validItems,
      invalidItems,
    };

    setSession((s) => ({ ...s, eyeResults: { ...s.eyeResults, [currentEye]: result } }));

    if (currentEye === 'right') {
      setState('practice_left');
      setCurrentEye('left');
    } else {
      setState('results');
    }
  }, [state, validItems, reversals, items, difficulty, currentEye, invalidItems]);

  function pauseWithMessage(message: string) {
    setResumeState(state);
    setState('paused');
    setAlert(message);
  }

  function resume() {
    setState(resumeState);
    setAlert('');
    startMsRef.current = performance.now();
  }

  const sizePx = useMemo(() => {
    const marMm = 5 * 0.291 * 10 ** difficulty;
    const mmPerPx = session.mmPerCssPx ?? 0.26;
    return clamp(marMm / mmPerPx, 18, 280);
  }, [difficulty, session.mmPerCssPx]);

  return (
    <main style={layout.card}>
      <h1 style={{ marginTop: 4, marginBottom: 8, fontSize: 24 }}>Near Vision Screening v1</h1>
      <p style={{ marginTop: 0 }}>단계: {phaseLabel}</p>
      {alert && <p style={{ background: '#fff3cd', padding: 10, borderRadius: 8 }}>{alert}</p>}

      {state === 'idle' && (
        <section style={layout.section}>
          <p>이 도구는 의료 진단 도구가 아닙니다. 밝은 환경에서 한쪽 눈씩 진행하세요.</p>
          <button style={layout.button} onClick={() => setState('permissions')}>시작</button>
        </section>
      )}

      {state === 'permissions' && (
        <section style={layout.section}>
          <p>카메라 및 모션 권한을 요청합니다 (iOS Safari는 탭 이벤트에서만 허용).</p>
          <button style={layout.button} onClick={requestPermissions}>권한 요청</button>
        </section>
      )}

      {state === 'device_check' && (
        <section style={layout.section}>
          <p>Portrait 모드 유지, 저전력 모드 해제, 화면 확대 1x를 확인하세요.</p>
          <button style={layout.button} onClick={() => setState('calibration')}>다음: 카드 보정</button>
        </section>
      )}

      {state === 'calibration' && (
        <section style={layout.section}>
          <p>실물 카드(가로 85.60mm)에 맞게 아래 박스 너비를 조정하세요.</p>
          <div style={{ border: '2px dashed #333', width: cardWidthPx, maxWidth: '100%', height: cardWidthPx * 0.63, margin: '12px 0' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={layout.button} onClick={() => setCardWidthPx((w) => w - 2)}>-</button>
            <button style={layout.button} onClick={() => setCardWidthPx((w) => w + 2)}>+</button>
          </div>
          <p>{cardWidthPx}px → {Number((85.6 / cardWidthPx).toFixed(4))} mm/px</p>
          <button style={layout.button} onClick={completeCalibration}>보정 완료</button>
        </section>
      )}

      {(state === 'face_alignment' || state === 'practice_right' || state === 'practice_left' || state === 'test_right' || state === 'test_left') && (
        <section style={layout.section}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 12, background: '#111' }} />
        </section>
      )}

      {state === 'face_alignment' && (
        <section style={layout.section}>
          <p>얼굴을 정면 중앙에 맞추세요. 준비되면 우안 연습으로 이동합니다.</p>
          <button style={layout.button} onClick={() => beginPractice('right')}>우안 연습 시작</button>
        </section>
      )}

      {(state === 'practice_right' || state === 'practice_left') && (
        <section style={layout.section}>
          <p>{state === 'practice_right' ? '우안' : '좌안'} 연습: 큰 E 방향을 누르세요.</p>
          <TumblingE sizePx={120} direction={direction} />
          <DirectionPad onAnswer={answer} />
          <button style={{ ...layout.button, marginTop: 12 }} onClick={beginTest}>본 검사 시작</button>
        </section>
      )}

      {(state === 'test_right' || state === 'test_left') && (
        <section style={layout.section}>
          <p>{state === 'test_right' ? '우안 검사' : '좌안 검사'} | 유효 {validItems} / 무효 {invalidItems} / reversal {reversals}</p>
          <TumblingE sizePx={sizePx} direction={direction} />
          <DirectionPad onAnswer={answer} />
          <button style={{ ...layout.button, marginTop: 12 }} onClick={() => pauseWithMessage('사용자 요청 일시정지')}>일시정지</button>
        </section>
      )}

      {state === 'paused' && (
        <section style={layout.section}>
          <p>검사가 일시중지되었습니다. 줌/자세/카메라 상태를 확인 후 재개하세요.</p>
          <button style={layout.button} onClick={resume}>재개</button>
        </section>
      )}

      {state === 'results' && (
        <section style={layout.section}>
          <h2>검사 결과</h2>
          {(['right', 'left'] as Eye[]).map((eye) => {
            const r = session.eyeResults[eye];
            if (!r) return null;
            return (
              <div key={eye} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 12, marginBottom: 8, borderRadius: 8 }}>
                <strong>{eye === 'right' ? '우안' : '좌안'}</strong>
                <div>logMAR: {r.estimatedLogmar}</div>
                <div>Decimal: {r.decimalAcuity}</div>
                <div>Snellen: {r.snellenEquivalent}</div>
                <div>Confidence: {r.confidence}</div>
              </div>
            );
          })}
          <p>권고: 낮은 신뢰도 또는 시력 저하가 추정되면 재검 후 전문가 상담을 권장합니다.</p>
        </section>
      )}

      {state === 'fatal_error' && (
        <section style={layout.section}>
          <p>치명적 오류로 검사를 진행할 수 없습니다.</p>
          <button style={layout.button} onClick={() => window.location.reload()}>새로고침</button>
        </section>
      )}
    </main>
  );
}

function DirectionPad({ onAnswer }: { onAnswer: (d: Direction) => void }) {
  const arrowStyle = {
    minHeight: 64,
    width: '100%',
    borderRadius: 14,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    fontSize: 28,
    fontWeight: 700,
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(64px, 1fr))', gap: 10, marginTop: 16, width: '100%' }}>
      <div />
      <button style={arrowStyle} aria-label="위" onClick={() => onAnswer('up')}>↑</button>
      <div />
      <button style={arrowStyle} aria-label="왼쪽" onClick={() => onAnswer('left')}>←</button>
      <div />
      <button style={arrowStyle} aria-label="오른쪽" onClick={() => onAnswer('right')}>→</button>
      <div />
      <button style={arrowStyle} aria-label="아래" onClick={() => onAnswer('down')}>↓</button>
      <div />
    </div>
  );
}
