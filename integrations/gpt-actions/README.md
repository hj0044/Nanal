# Nanal ChatGPT Actions — 생성 직후 자동 등록

## 목표
ChatGPT 구독에 포함된 이미지 생성 기능으로 나날 캐릭터를 만들고, 파일 저장·재첨부 없이 해당 이미지를 Nanal 게임 측 D1/R2의 비공개 검수 대기에 등록한다.

OpenAI 문서에 따르면 Custom GPT Actions의 `openaiFileIdRefs`는 대화 파일(문서에 명시된 DALL·E 이미지 포함)을 유효기간 약 5분의 서명 URL로 서버에 전달할 수 있다.
참고: https://developers.openai.com/api/docs/actions/sending-files

**확인되지 않은 부분:** 현재 ChatGPT Images의 최신 생성 이미지가 GPT Actions의 `openaiFileIdRefs`에 실리는지. 기존 나날 플러그인에는 이 파일 전달 기능이 없고, ChatGPT Library의 생성 이미지 원본 raw_file materialize는 실패했다. 따라서 반드시 **실제 생성 이미지 1장으로 Action 실전 테스트**가 필요하다. 이 저장소에 서버 코드가 있다는 사실로 그 실전 테스트를 대체할 수 없다.

## 준비
1. Nanal 게임용 Cloudflare Worker에 운영용 D1 (`NANAL_APPEARANCE_DB`) / R2 (`NANAL_APPEARANCE_IMAGES`) 바인딩, `migrations/001_appearance_assets.sql` 적용.
2. 안전한 32자 이상의 관리자 토큰 `NANAL_APPEARANCE_ADMIN_TOKEN`을 Worker secret에 저장.
3. 공식 나날 예약 원장·이미지 정본과 실제 해시를 대조해 `PUT /api/appearance/identities/APxxx`로 정본 등록. 해시나 QA 근거를 추측하지 않음.
4. 본 저장소의 `integrations/gpt-actions/nanal-images.openapi.yaml`에서 실제 HTTPS Nanal Worker 도메인을 지정.
5. Custom GPT에서 Image Generation 기능을 활성화하고 Actions에 OpenAPI 스키마 추가. 인증은 API Key / Bearer로 지정하고 비밀키를 사용자 전용 GPT 설정에만 저장. 비밀키를 프롬프트, GitHub, 공개 페이지에 입력하지 않음.

## GPT 지침에 넣을 동작 규칙 (신뢰할 수 있는 GPT 작성자만)
- Nanal의 AP ID, 잠긴 캐릭터 프로필과 승인된 이미지 앵커를 확인한 뒤 허용된 가상 성인 캐릭터 이미지를 만든다.
- 얼굴 이미지는 PNG/RGBA 1024×1024, 전신 이미지는 PNG/RGBA 1024×1536, 투명 배경을 사용한다.
- 이미지가 생성되면 **가능한 한 즉시** `importGeneratedCharacterImage` 액션을 호출한다. 정확히 방금 생성한 이미지 1장을 `openaiFileIdRefs`로 전달한다.
- 생성된 실제 파일 reference가 없는 경우 거짓 링크, 예시 file ID 또는 임의 URL을 만들지 않는다. 자동 등록 불가를 정확히 알린다.
- `assetId`와 `status:awaiting_review`을 응답받은 경우에만 '나날 DB 검수 대기에 제출'이라고 보고한다.
- 같은 AP ID의 신규 이미지라도 얼굴·키·체형·표정·기준 앵커는 검수하고, QA 이전에 approved로 만들지 않는다.
- 앱 자체 2장/일 제한은 없다. ChatGPT 이미지 생성의 사용량 한도와 정책은 준수한다.

## 서버 로직
- `POST /api/appearance/actions/ingest`: `appearanceId`, `slot`, `openaiFileIdRefs` 한 항목을 받는다.
- 자체 Bearer 관리자 인증 후 `files.oaiusercontent.com` HTTPS **서명 URL만** 즉시 다운로드한다. 다른 호스트, 만료 URL, 리디렉션은 거부한다.
- 원본 PNG 최대 16MiB, CRC/1024×1024 또는 1024×1536/RGBA 검사, 기존 AP 정본이 있는 경우에만 R2에 저장한다.
- 실제 SHA256으로 멱등 처리, D1에는 `awaiting_review` 기록. 승인 전 공개 조회 불가, `GET /api/appearance/admin/assets/{uuid}`는 관리자 전용 검수 이미지 조회.
- 이 경로는 **게임 측 D1/R2 DB**를 대상으로 하며 기존 Nanal 원격 플러그인 DB가 자동 갱신되는 것은 아니다.

## 실제 완성 판정
- 실제 ChatGPT Images 생성 직후 Action이 생성 이미지의 유효한 `openaiFileIdRefs`를 전달하는지 확인
- 서명 파일이 실제로 PNG/RGBA로 수신되는지 확인. WebP/JPEG이면 현재 서버는 `image_format_invalid`로 거부하며 확장·변환 후 재검증이 필요
- D1/R2 운영 환경에 실제 파일 및 AP/해시/상태 기록이 남는지 확인
- 승인 전 게임 미표시 → 공식 시각 검수 → 승인 후 이미지 표시 확인
- 새 이미지 3장 이상을 같은 날 앱 자체 제한 없이 접수해 중복 및 AP 혼선을 확인

## 남은 플랫폼 의존성
- Custom GPT 작성·Action 연결에는 사용자의 명시적 연결 작업이 필요하고, 앱이 그 작업을 대신 실행할 수 있는 관리 API는 이 대화에 없음.
- 가장 중요한 `openaiFileIdRefs`의 **현행 ChatGPT Images 호환성은 아직 검증되지 않음**. 이 기능이 현행 생성 이미지에 파일 링크를 제공하지 않으면 사용자의 수동 다운로드 없이 자동 전달하는 경로는 현재 접근 가능한 도구로 구현 불가. 이 경우 사용자에게 숨기지 말 것.
- 임의의 파일 접근 우회나 ChatGPT 구독 이미지 생성 사용량 한도 우회는 하지 않는다.
