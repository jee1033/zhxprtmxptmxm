# iOS Safari Near Vision Screening Web App (v1)

휴대폰 단독 근거리 시력 스크리닝 웹앱 프로토타입입니다.

## 실행

```bash
npm install
npm run dev
```

## GitHub Pages 배포

정적 빌드 결과는 `dist/`에 생성됩니다.

```bash
npm run build
```

GitHub Actions 또는 `gh-pages` 브랜치로 `dist`를 업로드해 서빙할 수 있습니다.

## 구현 범위

- React + TypeScript + Vite 기반 웹앱
- iOS Safari 권한 플로우:
  - `getUserMedia()` 카메라
  - `DeviceOrientationEvent.requestPermission()` / `DeviceMotionEvent.requestPermission()`
  - `navigator.wakeLock`
  - `window.visualViewport` 줌 감시
- 카드 기반 스크린 보정(85.60mm)
- SVG path 기반 Tumbling E 렌더링
- FSM 상태 전이 및 우안/좌안 분리 검사
- 간단 staircase logMAR 알고리즘
- 품질 게이트(얼굴/자세/모션/거리 proxy/viewport/조도 proxy)
- 결과: logMAR / Decimal / Snellen / Confidence
- 원시 카메라 프레임 업로드 없음(on-device 처리)
