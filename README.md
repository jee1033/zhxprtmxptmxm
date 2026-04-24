# React 다마고치 게임

기존 시력 스크리닝 앱을 제거하고, 레트로 1-bit 스타일 다마고치 육성 게임으로 변경한 프로젝트입니다.

## 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 게임 규칙

- 3초마다 포만감/행복/에너지/청결 수치가 감소합니다.
- 행동 버튼(밥주기, 놀아주기, 재우기, 씻기기, 간식)으로 상태를 관리합니다.
- 두 개 이상의 핵심 수치가 0이 되면 게임 오버입니다.
- 턴이 지날 때마다 코인이 쌓이며, 간식은 5코인을 사용합니다.

## 스프라이트/애니메이션 구현

- `src/sprites.ts` 에 16x16 픽셀 프레임(문자열 비트맵)을 정의했습니다.
- `src/App.tsx` 의 `PixelSprite` 컴포넌트가 canvas에 프레임을 그려 250ms 간격으로 애니메이션합니다.
- 무드(행복/기본/피곤/사망)에 따라 다른 프레임 세트를 재생합니다.

### GPT-image-2 재생성용 프롬프트 예시

아래 프롬프트를 사용해 참고 이미지 느낌의 스프라이트 시트를 재생성할 수 있습니다.

```text
Create a retro 1-bit Tamagotchi-style sprite sheet on a white background.
Grid of tiny pixel characters, monochrome black pixels only, no anti-aliasing.
Each sprite fits 16x16 pixels, cute rounded creatures, simple eyes and mouth.
Output as crisp pixel art suitable for canvas animation frames.
```
