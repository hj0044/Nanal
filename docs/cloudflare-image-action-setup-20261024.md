# 나날 Cloudflare 연결 시작하기 (2026-10-24)

이 저장소는 게임 프런트엔드 + `scripts/site-worker-entry.ts`로 구성된다. `wrangler.jsonc`를 사용해 Cloudflare Workers에서 정적 웹게임과 이미지 등록 API를 같은 출처로 배포한다.

## Cloudflare 연결
1. https://dash.cloudflare.com/ → **Workers & Pages** → **Create application** → **GitHub** → `hj0044/Nanal` 저장소 연결.
2. 기본 브랜치 `main`, 프로젝트 이름 `nanal-game`, 빌드 명령 `npm run build:site` (Wrangler 설정의 build.command에도 선언됨). `Save and Deploy`.
3. `wrangler.jsonc`의 `NANAL_APPEARANCE_DB`(D1), `NANAL_APPEARANCE_IMAGES`(R2)는 현재 Cloudflare 문서의 자동 프로비저닝 방식으로 ID 없이 선언되어 있다. 처음 배포 시 Cloudflare가 리소스 생성·연결을 시도한다. 계정이 R2/프로비저닝에 대한 추가 활성화나 결제를 요구하면 승인 여부는 계정 소유자가 결정해야 한다. 실패하면 각각 D1, R2를 대시보드에서 수동 생성하고 해당 바인딩 이름을 정확히 맞춘다.
4. 연결된 D1의 SQL 편집기에서 `migrations/001_appearance_assets.sql`을 실행해야 한다. **이 SQL을 적용하지 않으면 API가 작동하지 않는다.**
5. Worker → Settings → Variables and Secrets → **Secret** `NANAL_APPEARANCE_ADMIN_TOKEN`을 무작위 32자 이상으로 등록한다. 비밀값을 채팅·PR·코드·스크린샷에 공유하지 않는다.
6. HTTPS 배포 URL `https://nanal-game.<account>.workers.dev` 형태를 확인한다. 실제 계정 이름/도메인으로 대체해야 하며 이 예시를 운영 URL로 사용하면 안 된다.
7. GitHub `integrations/gpt-actions/nanal-images.openapi.yaml` 내 `servers[0].url`을 **실제 배포 URL**로 교체한다. 기존 Custom GPT 편집 화면의 Actions에 YAML 붙여넣고 API Key → Bearer 토큰 설정. 이는 ChatGPT Custom GPT 작성/편집 권한을 가진 계정에서만 가능하며 계정이 허용하지 않으면 신규 생성은 불가하다.
8. `checkNanalImageImportStatus` Action 테스트에서 `ready:true`가 나타나는지 검사한다. `503`은 D1/R2 바인딩 실패, `401`은 secret 실패다.
9. 실제 공식 정본 이미지 및 검수 원장에 해당하는 AP ID를 서버에 등록한 이후에만 업로드 테스트한다. 먼저 기존 검수된 AP 캐릭터 1명으로 시작한다. 생성 후 `importGeneratedCharacterImage`의 응답이 `awaiting_review`와 실재 `assetId`이면 자동 인계 성공, 이후 이미지 QA/승인 후 게임 표시를 확인한다.

## 반드시 구분
- 현행 Custom GPT 공식 문서: 개인 Free/Go/Plus/Pro는 **새 GPT 생성 불가**, **기존 GPT 편집 가능** (계정/권한 충족 시). 모바일 앱에서는 GPT 편집 불가. GPTs에서 나날 기존 GPT가 없으면 이 방법만으로 바로 진행할 수 없다.
- GPT Actions의 `openaiFileIdRefs`는 문서상 DALL-E 생성 이미지/대화 파일을 포함하지만, 최신 ChatGPT Images에 대해서는 자동 제공 여부를 이 프로젝트에서 라이브 검증하지 못했다.
- 파일이 JPEG/WEBP 또는 비RGBA PNG로 제공되면 현재 API는 등록 전에 거부한다. 가짜 파일/임의 ID로 테스트하지 말고 실제 생성 이미지로 확인한 뒤 변환기를 보완한다.
- Custom GPT Actions와 현재 연결된 Nanal plugin DB는 독립적이다. 자동 파일 전달은 게임 측 D1/R2를 대상으로 하며 기존 Nanal 원장에 자동 반영됐다는 의미가 아니다.
