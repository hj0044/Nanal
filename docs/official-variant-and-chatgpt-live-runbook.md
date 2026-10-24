# Nanal 공식 DB 추가 이미지 업로드 및 실제 ChatGPT 파일 연계 점검

**2026-10-24 구현 범위:** 재사용 가능한 공식 서버 측 등록 로직 및 실서버 점검 CLI. 이 저장소에는 **공식 나날 플러그인 운영 서버의 소스/배포 권한이 없으며**, 공식 캐릭터 DB와 게임 측 Cloudflare D1/R2는 별개다. 코드를 GitHub main에 병합해도 이 플러그인 동작이 자동 설치되거나 기존 AP 이미지가 이관되지는 않는다.

## A. 공식 플러그인 서버에 설치할 기능

1. `integrations/nanal-plugin/appearance_submit_variant.tool.json`을 **실제 MCP 플러그인 서버**의 도구 정의에 적용. ChatGPT 플러그인용 file input은 `_meta["openai/fileParams"]`에 `file`을 지정하며, 실제 런타임 파일 객체의 `download_url` 및 `file_id`를 사용한다. 기존 **Custom GPT Actions**의 `openaiFileIdRefs`(`download_link`/`id`)와 스키마가 다르다.
2. `integrations/nanal-plugin/official-chatgpt-file-handler.mjs`의 `submitOfficialVariantFromChatGptFile(input,backend)`를 사용자 인증이 강제되는 MCP 도구 핸들러에 연결.
3. 플러그인 운영 백엔드에서 `getApprovedCanonical(AP_ID)`, `getApprovedReferencePng(AP_ID,role)`, `findVariantByRequestKey(key)`, `createPendingVariantAtomic({metadata,originalPng,visualQa})` 네 함수를 실 DB/R2 또는 Blob Storage에 연결. 마지막 함수는 **실제 공식 DB 테이블의 유니크 키와 저장 트랜잭션**으로 구현. 기존 정본/승인 이미지/점수를 임의로 덮어쓰지 않는다.
4. 서버 쪽 승인 전 비공개 스토리지에 보관, `awaiting_review` 상태만 반환, 기존 자동 시각 QA와 연결해 동일 얼굴/전신 근거 검수 후 승인. 이 모듈은 자동 승인하지 않는다.
5. 도구 재배포 후 현재 ChatGPT의 연결 도구 목록에 `appearance_submit_variant`가 나타나는지 확인한다. 없으면 연결이 완료되지 않은 것이다.

이미지 파일은 실제 ChatGPT 런타임에서 제공한 파일 참조로만 받는다. `files.oaiusercontent.com`의 짧게 유효한 HTTPS 서명 URL만 다운로드하고 외부 리디렉션은 거절한다. PNG/WebP의 *실제* 투명도와 전경을 검증하고 얼굴 1024×1024 또는 전신 1024×1536 PNG로 변환한다. 실제 원본 파일의 출처/해시와 정본 잠금 정보는 메타데이터에 남겨야 한다. 변환은 얼굴 동일성이나 신체치수 동일성을 증명하지 않으므로 시각 QA가 필요하다.

**주의:** 현재 연결된 나날 MCP 도구는 신규 예약 첫 얼굴/전신 제출 기능만 노출한다. 위의 새 도구는 **아직 실제 운영 플러그인에 설치되지 않았다.** 나날 게임 GitHub 저장소를 변경하는 권한만으로 플러그인 운영 서버를 수정하거나 재연결할 수 없다.

## B. GPT Actions 실전 테스트

현재 게임 측 GPT Actions는 `integrations/gpt-actions/nanal-images.openapi.yaml`로 정의돼 있다. 이것은 공식 나날 플러그인 DB가 아니라 **게임 측 Cloudflare D1/R2**에 등록한다. 공식 OpenAI Actions 문서는 `openaiFileIdRefs` 배열이 런타임에서 `{id,download_link,mime_type,name}` 객체로 전달되며 약 5분 유효하다고 설명한다. 문서는 DALL·E 생성 이미지 전송도 언급하지만 *현행 ChatGPT Images*가 동일하게 제공되는지 보장하지는 않는다.

### 운영 서버 연결/정상 상태 확인

Cloudflare Workers의 실제 HTTPS 게임 도메인과 `NANAL_APPEARANCE_ADMIN_TOKEN`을 안전한 쉘 환경 변수로 제공한 뒤:

```sh
export NANAL_GAME_API_ORIGIN=https://YOUR-LIVE-GAME-DOMAIN/
export NANAL_APPEARANCE_ADMIN_TOKEN=<PRIVATE_OWNER_TOKEN>
npm run images:probe-live-action
```

이 명령은 **실서버 인증·D1/R2 readiness 확인만** 수행한다. 이 결과만으로 ChatGPT Images → Action 파일 전송 성공을 선언하지 않는다.

### 실제 생성 이미지로 제출 확인

Custom GPT 제작자 권한에서 해당 GPT의 **Actions**에 OpenAPI 스키마를 추가하고 개인 API 키를 연결한 후, 이미지 생성 기능을 사용해 현실의 PNG/투명 배경 성인 가상 캐릭터 후보 1장을 만든다. `openaiFileIdRefs`가 실제 새 이미지 파일을 포함하고, `importGeneratedCharacterImage`가 응답한 `assetId`와 `status: awaiting_review`를 확인한다. 그 후 비공개 검수 API에서 실제 PNG 및 캐릭터 ID를 대조하고 검수·승인 후 게임에 표시되는지 확인한다.

이미 설정된 GPT Action이 제공한 **실제 임시 파일 참조 JSON을 비공개 파일로 얻은 경우에만**, 5분 이내 다음 명령으로 서버 측 전송을 재현할 수 있다:

```sh
npm run images:probe-live-action -- \
 --origin https://YOUR-LIVE-GAME-DOMAIN/ \
 --appearance AP008 --slot portrait \
 --file-ref-json .nanal-private/real-chatgpt-action-ref.json --submit
```

생성 결과가 `image/webp`이거나 투명 PNG가 아니면 현재 게임 측 Cloudflare Worker는 검증에 실패할 수 있다. 파일을 손실 없이 전달했더라도 서버가 `201` 또는 중복 `200`과 실제 `assetId`를 반환하기 전에는 성공으로 기록하지 않는다. 실사용 토큰, 만료 전 URL, 전체 원본 이미지는 GitHub·채팅 로그에 올리지 않는다.

**이 저장소의 CI는 모의 응답과 합성 테스트 이미지로 인증·SHA-256·PNG/WebP 변환·기본 중복 방지 로직을 검사한다. CI 통과는 운영 공식 DB 등록이나 ChatGPT 계정의 Action 설치를 입증하지 않는다.**

## C. 실제로 남는 필수 외부 연결

- 공식 나날 플러그인의 서버 소스/관리 환경 및 새로운 도구 배포·재연결
- Custom GPT 제작자의 편집 권한으로 OpenAPI Action 설치 및 비밀키 설정
- 실제 사용 중인 Cloudflare Worker HTTPS 원본과 D1/R2 바인딩·관리자 인증 설정
- 현재 ChatGPT Images 실제 파일 참조 1개로 전송 테스트 및 정본 영상 검수

이 네 가지는 사용자가 포괄적으로 권한을 위임했다는 사실만으로 이 세션에 인증 수단이 생기지 않기 때문에, 명시적으로 실환경에서 확인해야 한다.

참고: https://developers.openai.com/api/docs/actions/sending-files
참고: https://developers.openai.com/plugins/reference
