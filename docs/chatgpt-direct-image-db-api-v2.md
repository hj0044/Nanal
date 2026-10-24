# Nanal ChatGPT 이미지 직행 등록 API — 구현·검증 기록 (2026-10-24)

## 3. 기존 서버 경로 제외
- Nanal 공식 예약 커넥터의 `appearance_generate_reserved_batch` / `appearance_process_next`는 ChatGPT 이미지 생성의 기본 경로로 사용하지 않는다.
- 사용자가 ChatGPT에서 생성한 실제 PNG 파일을 직접 받는 경로로 전환한다. 앱 자체의 하루 2건 제한은 존재하지 않는다.
- **기존 별도 Nanal 커넥터의 `dailyJobLimit:2` 설정 자체는 변경하지 못했다.** 직접 등록 경로가 이를 호출하지 않는 것이지 서버 제한을 해제한 것은 아니다.
- OpenAI 이미지 API 자동 호출/추가 결제 로직은 포함하지 않는다. ChatGPT 플랫폼의 실제 사용량 한도와 정책은 적용된다.

## 2. 생성한 이미지의 업로드 테스트
- 새 API: `src/appearance-api.ts`, 같은 도메인 Cloudflare Worker: `scripts/site-worker-entry.ts`.
- 공식 커넥터에 **예약된 신규 캐릭터 첫 얼굴·전신 쌍**을 제출하는 기존 브리지 `server/chatgpt-import/bridge.mjs`와 구분한다.
- 새 게임 측 API는 기존 ID의 추가 초상화/전신 이미지들을 각각 `awaiting_review` 상태로 저장한다.
- SHA-256/PNG 크기/8-bit RGBA/정본 앵커 메타데이터를 검사하고 승인 전 공개 접근을 차단한다. 실제 얼굴·체형 유사성은 사람이 이미지를 비교한 QA 기록이 필요하다.
- `src/appearance-api.node-test.mjs`는 PNG 입력 → D1/R2 모의 저장 → 검수 대기 → 승인 → 공개 카탈로그 → 다운로드 및 101건 접수/보안 실패를 실행한다.
- **중요: 모의 D1/R2를 통한 로컬·CI 통합 검증**이다. 실제 ChatGPT ImageGen 이미지 바이너리 → 실제 배포 DB 저장/게임 표시까지의 라이브 E2E 결과는 아직 없다. 인증정보, 운영 D1/R2 바인딩, ChatGPT 이미지 바이트 전달 어댑터가 연결되지 않았기 때문이다.

## 1. 기존 AP ID 이미지 등록 API
1. 운영자가 공식 Nanal 예약 원장의 값과 승인 얼굴·전신 앵커를 실제 검수한다.
2. 관리자가 `PUT /api/appearance/identities/AP008`로 성별, 연령대, `profileSha256`, `portraitAnchorSha256`, `fullBodyAnchorSha256` 및 `qaSource: reviewed_official_reservation`을 등록한다. 값 변경은 금지(409).
3. ChatGPT가 생성한 PNG를 `POST /api/appearance/identities/AP008/variants`로 전달한다. Authorization: Bearer 관리자 비밀 토큰. multipart fields: `image`, `slot` (portrait 또는 fullBody), `profileSha256`, `anchorSha256`, `requestKey`.
4. 받은 PNG를 R2에 저장, DB에는 샤·캐릭터 ID·슬롯·작업 키를 `awaiting_review`로 저장. 동일 요청 키는 안전하게 멱등 처리.
5. 관리자가 원본 정본과 비교하고 `POST /api/appearance/variants/{assetId}/review`로 승인/차단한다. 승인하려면 `qa.face`, `qa.body`, `qa.heightScale`, `qa.chestSilhouette`, `qa.transparentBackground`, `qa.matchesCanonicalAnchor` 모두 true와 구체적인 검수 메모(30자 이상)가 필요하다.
6. `GET /api/appearance/catalog`은 승인된 자산만 반환한다. `GET /api/appearance/assets/{assetId}`도 승인된 파일만 전달한다.
7. 게임의 `src/portrait-catalog.ts`는 같은 도메인의 승인된 초상화만 불러와 주인공/NPC 아바타에 사용할 수 있다. 전신 이미지는 초상화 선택 후보에서 제외한다. 파일을 가져오지 못하면 기존 이름 아바타 유지.

## 배포에 필요한 환경
- Cloudflare Worker, D1 데이터베이스 바인딩 `NANAL_APPEARANCE_DB` 및 `migrations/001_appearance_assets.sql` 적용
- R2 버킷 바인딩 `NANAL_APPEARANCE_IMAGES`
- 별도 비밀 환경변수 `NANAL_APPEARANCE_ADMIN_TOKEN` (무작위 32자 이상, 클라이언트에 노출 금지)
- 워커는 `npm run build:site`로 `dist/server/index.js` 빌드. D1/R2/토큰이 없으면 API는 503으로 안전하게 닫힘
- ChatGPT 이미지 생성 결과를 PNG 바이너리로 접근해 인증된 업로드 요청에 연결하는 **호스트 어댑터**가 실제 운영에 필요
- 별도 공식 Nanal 플러그인 DB와 이 게임 측 D1 DB는 **서로 다른 저장소**다. 자동 양방향 동기화나 공식 플러그인 DB 확장을 했다고 주장하지 않는다.

## 운용·검수 주의
- 같은 ID의 정본 얼굴·키·골격·체형·실루엣을 최우선으로 유지하고 기존 승인 앵커를 확인하기 전 등록하지 않는다.
- 파일 형식 검사만으로 동일인물/투명 알파 픽셀 또는 체형 일치를 확인할 수 없다.
- ImageKit을 필수 저장소로 가정하지 않는다. 이번 새 게임 측 API는 Cloudflare R2를 쓴다. 기존 ImageKit 승인 자산 경로는 계속 지원한다.
- API 생성 요청 제한이나 임의 하루 2건 수량 제한은 넣지 않았다. 전송 바이트 크기 상한 16MiB는 과도한 파일 공격을 막는 안전 제약이고 이미지 생성 장수 제한이 아니다.
