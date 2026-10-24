# 나날 이미지 운영 — 별도 플러그인 서버 없이 게임 DB에서 직접 관리

## 구현한 단일 운영 경로

이 기능은 **이미 GitHub에 존재하는 나날 웹게임 Worker**(`scripts/site-worker-entry.ts`)와 게임 측 Cloudflare **D1/R2**를 사용한다. 별도 공식 플러그인 서버를 발견하거나 가정하지 않는다.

1. 운영자 `https://배포된-나날-게임/appearance-admin.html`에 접속.
2. 원래의 승인된 공식 AP 예약을 확인한 뒤 동일 ID의 **검증된 정본 원본 얼굴·전신 두 장**과 성별·나이·키·체중을 선택하고 검수 근거를 작성한다. `POST /api/appearance/identities/APxxx/bootstrap`에서 1024×1024 / 1024×1536 RGBA PNG 검증, 원본 SHA-256, 잠긴 프로필 SHA-256, R2의 content-addressed 비공개 원본 저장, D1의 AP 레코드 기록을 실행한다. 기존 AP 정본 값이 다르면 HTTP 409로 거절한다. 토큰과 승인 근거 없이 누군가가 임의 정본을 지정해서는 안 된다.
3. 추가 PNG를 선택해 제출하면 파일 해시 기반 멱등 키로 `POST /api/appearance/identities/APxxx/variants`에 업로드된다. 원본은 비공개, 상태는 `awaiting_review`.
4. `GET /api/appearance/admin/queue`에서 대기 목록을 확인한다. `GET /api/appearance/admin/references/APxxx/portrait|fullBody` 및 `GET /api/appearance/admin/assets/{UUID}`로 실제 원본과 후보를 불러와 좌우 비교한다. 두 엔드포인트는 Bearer 관리자 인증 후에만 접근할 수 있다.
5. 얼굴, 체형, 키/비례, 흉부·실루엣, 투명 배경, 기존 원본 대조 항목 6개를 실제 검수한 뒤 승인하거나, 불합격 후보를 차단한다. 승인된 자료만 `/api/appearance/catalog`에 등장하고 게임에 반영된다.

## ChatGPT와 연동

실제 배포된 워커의 `https://배포된-나날-게임/api/appearance/actions/openapi.json`에서 **현재 도메인이 주입된** GPT Actions 명세를 가져온다. 기존 문서처럼 `YOUR-LIVE-NANAL-GAME-DOMAIN`을 수정할 필요가 없다.

사용자의 Custom GPT가 Actions를 지원하고 소유자가 API Key / Bearer 관리 비밀을 **GPT 편집자 설정**에 안전하게 등록한 경우, 같은 도메인의 `/api/appearance/actions/ingest`에 바로 파일을 보낼 수 있다. `openaiFileIdRefs`는 공식 문서상 JSON 스키마에서는 `items: string`이지만, 실제 런타임에서는 `id`, `download_link` 등이 포함된 객체로 전달된다. 이 스키마와 서버 양쪽은 그 차이를 고려한다. 참조는 실제 이미지에서 온 것이어야 하며, URL을 만들어 내거나 외부 임의 도메인으로 우회하지 않는다.

**중요:** OpenAI의 일반 GPT Actions 문서는 DALL·E 생성 이미지/대화 파일 전송을 설명한다. 현행 ChatGPT Images 생성 결과가 실제로 동일한 파일 참조를 제공하는지에 대한 **라이브 검증은 아직 없다**. 이 대화에 연결된 플러그인에는 이미지 수신용 새로운 작업을 동적 등록할 권한이 없고, 이 코드만으로 현재 ChatGPT의 `image_gen` 결과를 자동으로 가로챌 수 없다.

## 기존 플러그인과 데이터 손실 방지

- 현재 대화에 연결된 `Nanal 플레이 테스트` 플러그인의 캐릭터 예약 원장은 별개로 유지되고 **전혀 변경되지 않는다**. 플러그인 서버 주소·소스가 검증되지 않았으므로 이 Worker를 원래 공식 서버라고 주장하지 않는다.
- 이미 승인된 앵커의 **실제 파일** 없이 SHA 문자열만 추측해서 정본을 추가하지 않는다. 이전 레거시 ZIP의 AP 이미지들이 무조건 승인됐다고 간주하지 않는다.
- 기존 게임 저장 세이브와 NPC 관계에 변경 없음. 신규 API는 별도 image tables만 사용한다.
- 잠긴 AP 정본을 덮어쓸 수 없으며 신규 후보는 별도의 image variants로만 저장된다.
- 자동 pixel QA만으로 얼굴 신원, 실제 키·체형, 흉부 치수의 정합성을 확정하지 않는다. **사람이 실제 비교해야** 승인 가능하다.

## 배포·운영 선행조건 (현재 이 세션에서 아직 확인되지 않음)

게임 Worker가 실제 Cloudflare 계정에 배포돼야 하고, `wrangler.jsonc`의 D1/R2 바인딩, `migrations/001_appearance_assets.sql` 마이그레이션, `NANAL_APPEARANCE_ADMIN_TOKEN` secret이 필요하다. 관리 화면은 DB가 배포돼 있지 않으면 실패 원인을 표시하며 성공을 가장하지 않는다. `GET /api/appearance/admin/status`는 DB 테이블 유무를 확인하고 테이블이 없으면 HTTP 503을 반환한다.

이미지 원본·관리자 토큰·짧은 유효기간 서명 URL을 GitHub/채팅/로그에 게시하지 않는다. 관리자 콘솔은 토큰을 로컬 저장소에 남기지 않으며, 캐시를 금지하고 CSP 및 프레임 삽입 금지를 적용한다.

## 검증

`npm test`: 기존 모든 테스트에 더해 `src/appearance-bootstrap.node-test.mjs`에서 원본 등록, sha 잠금, 이미지 비공개, 불일치 차단, 중복 안전성, 원본 대조, 승인 후 공개 카탈로그, 동적 OpenAPI, D1 누락 시 503을 검사한다.

**테스트는 합성 PNG와 모의 R2/D1을 통한 코드 검증이다. 운영 Cloudflare 배포나 현행 ChatGPT Images Action 전달 테스트를 대체하지 않는다.**
