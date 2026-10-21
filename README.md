# Nanal

현대 한국의 인생 시뮬레이션 웹 프로토타입입니다.

## 실행

```sh
npm install
npm run dev
```

검사와 빌드:

```sh
npm test
npm run build
```

첫 프로토타입은 캐릭터 설정, 첫 주 생활 진행, 상황별 선택, 관계와 상태 변화, 브라우저 자동 저장 및 저장 파일 내보내기·불러오기를 포함합니다. 게임 내 수치와 확률은 플레이 검증을 위한 임시 값입니다. 현실 통계 자료는 출처와 기준 연도를 확인한 뒤 연결합니다.

제품 방향은 [docs/product-vision-v0.1.md](docs/product-vision-v0.1.md), 구현 계획은 [docs/mvp-build-plan-v0.1.md](docs/mvp-build-plan-v0.1.md)를 참고하세요.

## ImageKit 캐릭터 이미지 CDN 연결 (선택)

Nanal은 기존 62종의 초상화 ID와 저장 데이터를 유지하면서 ImageKit 이미지를 우선 표시할 수 있습니다. 현재 기본 프로덕션 빌드에는 `https://ik.imagekit.io/hj0044`가 `.env.production`에 설정되어 있습니다. 원격 파일이 누락되거나 이미지 요청에 실패하면 기존 번들 WebP를 대체 배경으로 사용합니다.

1. ImageKit Media Library에서 `/nanal/portraits/` 폴더를 만듭니다.
2. `src/assets/character-portraits/`의 사용 중인 WebP와 `src/assets/npc-portrait-atlas-v1.webp`를 해당 폴더에 **동일한 파일명**으로 업로드합니다. ImageKit의 파일명 자동 변경 여부를 확인하세요.
3. 연결된 공개 URL Endpoint는 `https://ik.imagekit.io/hj0044`입니다. Media Library 대시보드 URL이나 API Key가 아닙니다.
4. 현재 `.env.production`에 다음 값이 저장되어 있어 일반 `vite build`에서 자동 적용됩니다. 로컬 개발 환경에서 ImageKit을 사용하려면 `.env.local`에 같은 값을 설정하세요.

```env
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/hj0044
VITE_IMAGEKIT_PORTRAIT_PATH=nanal/portraits
```

5. `npm test`와 `npm run build`를 실행한 뒤 대표 인물 이미지와 4×4 초상화 아틀라스의 실서비스 표시를 확인합니다. GitHub Pages에 배포되는 경우 새 커밋으로 실제 재배포가 수행되어야 변경된 빌드 설정이 적용됩니다. **이미지 파일을 ImageKit에 업로드하기 전에는 번들 이미지가 표시됩니다.**

**보안:** 조회 전용 이미지 URL에는 ImageKit API Key가 필요하지 않습니다. Private API Key를 프런트엔드나 GitHub 저장소에 넣지 마세요. 전면 이전이 끝나기 전까지 기존 이미지 번들은 대체 표시를 위해 유지됩니다.
