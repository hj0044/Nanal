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

## 캐릭터 이미지 상태

현재 캐릭터 초상화 이미지 파일과 얼굴 선택·표시 기능은 게임에서 제거했습니다. 새 이미지가 검수·승인되기 전까지 주인공과 NPC 프로필에는 이름 첫 글자 아바타가 표시됩니다. 기존 세이브의 진행·관계 데이터는 유지하며, 폐기된 초상화 ID와 해당 이미지 이력은 저장 파일을 불러올 때 정리합니다.

새 얼굴을 다시 적용할 때는 이미지를 검수한 뒤 `src/assets/character-portraits/catalog.json`에 자산 정보를 등록하고 `status: "approved"`, `runtimeEligible: true`를 모두 지정합니다. 카탈로그는 두 조건을 만족하는 항목만 게임에 포함하고 자동 배정에 사용합니다. 이미지 파일과 표시 UI는 별도 작업으로 다시 구현해야 합니다.

## Automated original-image backup and ImageKit delivery

Character image candidates can be staged with `npm run images:import`. This archives their original PNG/JPEG/WebP, uploads a verified Drive backup, converts a WebP for ImageKit, and registers a review-pending asset. It does **not** generate images, approve artwork or affect the existing same-origin official appearance API. See [the image pipeline guide](docs/character-image-pipeline.md).

## ChatGPT 이미지 파일 제출 및 캐릭터 전체 일괄 최적화

`npm run images:batch`는 AP ID와 검증된 마스터 SHA-256을 기준으로 로컬 원본을 자동 발견해 Google Drive/로컬 백업, ImageKit WebP 최적화 또는 게임 측 D1/R2 검수대기 제출을 수행합니다. 기본은 dry-run이며 `--apply`를 명시해야 원격 쓰기가 발생합니다. ChatGPT UI에서 생성 PNG 바이트를 직접 전달하는 호스트 연동이나 공식 Nanal 플러그인 DB의 기존 이미지 전체 다운로드는 현재 제공되지 않습니다. 상세: [일괄 이미지 관리](docs/chatgpt-bulk-image-handoff.md).

## 운영자 원본 등록·검수 화면 (동일 게임 데이터베이스)

Cloudflare Worker + D1/R2가 배포된 경우, 게임 URL 뒤에 `/appearance-admin.html`을 붙여 운영자 화면에 접속합니다. 관리자 토큰은 브라우저 **메모리에만** 보관하며 새로고침 시 사라집니다. 해당 화면에서 (1) 공식 AP 예약과 일치하는 **승인된** 얼굴·전신 원본의 PNG 두 장을 SHA-256으로 영구 잠금 등록하고, (2) 추가 PNG 후보를 비공개 검수 대기에 제출하고, (3) 기준 원본과 추가 후보를 나란히 대조하여 승인/차단할 수 있습니다. 승인된 초상화만 게임에서 조회할 수 있으며 기존 게임 저장·관계 데이터는 변경하지 않습니다.

이미지 원본을 등록할 때는 실제 공식 예약 정보 및 승인 원본을 직접 대조해야 합니다. 미승인 후보나 과거 ZIP 백업을 승인된 정본으로 자동 등록하지 않습니다. 게임 측 Cloudflare D1/R2는 현재 연결된 `Nanal 플레이 테스트` 플러그인 저장소와 **독립적**이므로 플러그인 DB 업데이트 성공이라고 주장하지 않습니다.

GPT Actions용 운영 URL에 맞춘 OpenAPI 스키마는 `GET /api/appearance/actions/openapi.json`으로 자동 제공됩니다. ChatGPT Custom GPT가 **실제로 전달하는 서명 파일 참조**가 있어야 수동 다운로드 없이 제출할 수 있으며, 현재 ChatGPT Images 호환 여부는 실환경에서 확인해야 합니다. 검수·승인 경로 상세: [게임 이미지 운영 안내](docs/game-side-image-console.md).
