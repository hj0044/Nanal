# ChatGPT 생성 PNG 인계 및 기존 AP 이미지 일괄 백업 (2026-10-24)

## 실제 가능한 범위

**이미지 생성이 완료되면 ChatGPT UI에서 PNG 바이트가 자동으로 이 코드에 전달되는 호스트 훅은 제공되지 않는다.**
`image_gen`이 화면에 이미지를 렌더링한 사실만으로 원본 PNG를 파일로 읽거나 공식 Nanal 플러그인 DB에 자동 전송했다고 주장하지 않는다.
현재 코드는 **실제 PNG 파일을 안전하게 확보한 뒤** 나날 **게임 측** API(D1/R2)에 자동으로 검수대기 제출하거나, 기존 이미지들을 ImageKit과 Google Drive에 일괄 처리한다.
게임 측 D1 DB와 공식 Nanal 플러그인 DB는 별개이며, 기존 공식 ID 변형 업로드용 플러그인 액션은 노출되어 있지 않다.
신규 공식 예약의 초기 얼굴/전신 쌍은 기존 `server/chatgpt-import/bridge.mjs` + 공식 플러그인 어댑터를 사용해야 한다.

## 파일명과 보안 폴더

원본을 `.nanal-private/inbox`에 아래 이름으로 넣는다. 하위 폴더까지 재귀 검색하며 이름에 AP ID, 이미지 종류, 일련번호가 반드시 있어야 한다.

```
.nanal-private/inbox/AP008-portrait-001.png
.nanal-private/inbox/AP008-portrait-002.png
.nanal-private/inbox/AP008-fullbody-001.png
.nanal-private/inbox/AP008-fullbody-002.png
.nanal-private/inbox/AP010-portrait-001.png
```

PNG/JPEG/WebP는 ImageKit 일괄 백업 및 최적화에 사용할 수 있다. **게임 측 D1/R2 API에는 1024×1024 RGBA PNG 얼굴과 1024×1536 RGBA PNG 전신만** 제출할 수 있다. 원본을 무단 변형하거나 모델을 다시 호출하지 않는다.

`.nanal-private/identity-registry.json`에 **공식 예약 원장에서 검증한** 캐릭터별 앵커 정보를 별도로 보관한다. 예시 값은 실제 해시가 아니라 구조 설명이다.

```json
{
  "characters": {
    "AP008": {
      "gender": "여성",
      "ageMin": 20,
      "ageMax": 29,
      "reviewedOfficialReservation": true,
      "profileSha256": "정본 프로필 SHA-256 (64자 16진수)",
      "portraitAnchorSha256": "정본 얼굴 PNG SHA-256 (64자 16진수)",
      "fullBodyAnchorSha256": "정본 전신 PNG SHA-256 (64자 16진수)"
    }
  }
}
```

`reviewedOfficialReservation:true`는 운영자가 공식 원장과 이미지 원본을 실제로 대조한 경우에만 설정한다. SHA-256은 동일 바이트를 검증할 뿐 시각적 동일인물/체형/투명 배경을 증명하지 않는다.

## 이미지 DB로 제출 (후보 상태)

먼저 업로드 없이 전량 점검:

```sh
npm install
npm run images:batch -- --source .nanal-private/inbox --registry .nanal-private/identity-registry.json --destination game-db
```

실제 배포한 D1/R2 Worker의 관리자 환경변수를 등록한 후:

```sh
export NANAL_GAME_API_ORIGIN=https://YOUR-LIVE-GAME-DOMAIN
export NANAL_APPEARANCE_ADMIN_TOKEN=YOUR-LONG-PRIVATE-TOKEN
export GOOGLE_DRIVE_BACKUP_FOLDER_ID=YOUR-PRIVATE-BACKUP-FOLDER
export GOOGLE_DRIVE_REFRESH_TOKEN=...
export GOOGLE_OAUTH_CLIENT_ID=...
export GOOGLE_OAUTH_CLIENT_SECRET=...
npm run images:batch -- --source .nanal-private/inbox --registry .nanal-private/identity-registry.json --destination game-db --apply
```

각 파일에 대해 로컬 불변 원본 보관 → Google Drive 업로드/MD5·크기 확인 → **게임 측** 정본 신원 PUT → PNG 후보 POST를 순서대로 수행한다.
후보는 `awaiting_review` 상태이고 게임에 노출되지 않는다. 같은 PNG는 내용 기반 `requestKey`로 다시 제출해도 멱등 처리된다.
`--local-only`는 Google Drive 백업을 의도적으로 건너뛰는 예외 옵션이므로 일반 운영에서는 권장하지 않는다.

## 기존 원본 전체 백업 + ImageKit 최적화

```sh
export IMAGEKIT_PRIVATE_KEY=YOUR-PRIVATE-KEY
export IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/ACCOUNT/nanal
# 같은 Google Drive 환경변수 필요
npm run images:batch -- --source .nanal-private/inbox --registry .nanal-private/identity-registry.json --destination imagekit --apply
```

등록 후보의 원본은 로컬/Drive에 남고 게임용 WebP는 ImageKit에 업로드된다.
기존 `server/image-pipeline/import.mjs`의 개별 등록 경로를 재사용하므로 기존 ID 덮어쓰기 차단, 체크섬 검증, `awaiting_review` 상태를 유지한다.
**GitHub 카탈로그 파일 수정만으로 런타임에 즉시 반영되지는 않는다.** Game 배포는 별도이며, QA 승인과 `runtimeEligible:true` 부여를 자동화하지 않는다.

## 일괄 실행 결과

- 기본 명령은 dry-run이다. `--apply`로만 원격 쓰기를 수행한다.
- `--report path.json`을 지정하지 않으면 `.nanal-private/last-image-batch-report.json`에 비공개 리포트를 저장한다.
- 누락된 프로필, 정본 해시 불일치, 중복 일련번호, PNG 규격 오류, 공급자 인증·백업 오류를 파일별 보고한다.
- 한 이미지가 실패해도 다른 이미지는 계속 처리한다. 실패가 남아 있으면 종료 코드 1을 반환한다.
- 앱 자체 일일 장수 제한을 추가하지 않는다. 공급자의 실제 제한/서비스 요금은 별도다.
- 기존 공식 DB의 전체 목록 및 원본 다운로드 API가 없으므로 **원본 파일을 확보하지 않은 기존 이미지는 원격 일괄 백업되었다고 볼 수 없다**. 현재 GitHub 이미지 카탈로그도 비어 있어 이 명령이 원본을 자동 발견하지는 못한다.
- ChatGPT 이미지 생성 완료 시 PNG 파일을 안전하게 수집해 이 로컬 인박스에 넣는 **호스트 전달 어댑터**가 노출되어야 사용자 입력 없이 완전 자동화할 수 있다. 이 GitHub 코드 변경만으로 ChatGPT 앱 내부 훅을 설치할 수 없다.
