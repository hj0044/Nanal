# ChatGPT Images → Nanal DB 직접 제출 계약 (2026-10-24)

## 목표와 제한
- **사용자 이미지 제작은 ChatGPT 이미지 생성 기능만 사용한다.** 별도의 OpenAI 이미지 생성 API는 호출하지 않는다.
- 신규 ID의 첫 초상화·전신 한 쌍은 공식 Nanal 연결 도구를 사용한다. `appearance_reserve_character` → ChatGPT ImageGen → `appearance_submit_reserved_images` → `appearance_review_candidate` / 품질 승인.
- `server/chatgpt-import/bridge.mjs`는 ChatGPT에서 생성된 **PNG 바이트를 실제로 전달받았을 때**, 잠금 예약을 재확인하고 공식 나날 DB 업로드 연결 도구에 전달한다. 독립적인 이미지 생성이나 추가 일일 장수 상한은 없다.
- **플러그인 내부의 `dailyJobLimit:2`를 수정한 것은 아니다.** 이 브리지는 `appearance_generate_reserved_batch` 대신 사용자 ChatGPT 생성 PNG를 제출하는 경로다. ChatGPT 자체 사용 한도와 정책은 그대로 적용된다.
- **기존 AP ID에 추가 이미지 업로드하는 공식 도구가 현재 노출되지 않는다.** `appearance_submit_reserved_images`는 신규 예약의 얼굴/전신 첫 쌍에만 사용한다. 기존 ID 변형/5–8장 보충을 이 도구로 가짜 성공 처리하지 않는다.
- ChatGPT Images 결과물이 **바이너리/PNG base64 형태로 호출 환경에 노출되지 않으면 이 브리지에서도 제출할 수 없다.** 화면에 이미지가 보인다는 사실만으로 원격 DB 등록이 됐다고 간주하지 않는다. 이런 경우 원본 파일을 획득하여 동일 검증/업로드 경로에 넘길 수 있는 기능이 필요하다.

## 자동 제출 순서 (신규 첫 이미지 쌍)
1. `appearance_get_reservation(APxxx)`에서 잠금 설계, ID, `reserve:APxxx`, 얼굴·전신 프롬프트를 확인한다.
2. ChatGPT 이미지 생성으로 공식 설계와 동일한 얼굴/전신을 생성한다. 등록할 PNG의 실제 bytes를 확보한다.
3. `importChatGptInitialPair({appearanceId,portraitPng,fullBodyPng},{getReservation,submitReservedImages})`를 사용하거나 같은 순서로 공식 연결 도구를 호출한다.
4. PNG 구조 CRC / RGBA / 1024×1024 및 1024×1536 / 동일 AP ID 및 예약 상태를 검증한다. `bridge`는 픽셀 유사도 또는 투명 영역 존재까지 최종 승인하지 않는다.
5. 공식 Nanal DB 등록 응답이 도착하면 `submitted_for_review`로 표기한다. 등록 성공·QA 승인·게임 노출을 한 단계로 합치지 않는다.
6. 공식 `appearance_review_candidate`에서 얼굴·키·체형·전신 투명 배경·앵커 정합성을 육안 확인해 승인한다. 부적합 후보만 수정한다.
7. 승인 후 ImageKit CDN에서 확정된 URL을 게임 카탈로그에 기록한다. `status:"approved"`와 `runtimeEligible:true`가 동시에 있어야 게임에서 렌더링된다. CDN URL은 `VITE_IMAGEKIT_URL_ENDPOINT`의 동일 origin 및 경로 prefix만 허용한다.

## 예시: 카탈로그의 '승인된' 초상화 (실제 승인 전 삽입 금지)

```json
{
  "assetId": "AP017-portrait-001",
  "characterId": "AP017",
  "gender": "여성",
  "ageEstimate": {"min": 20, "max": 29},
  "filename": "AP017/portrait-001.webp",
  "cdnUrl": "https://<your-imagekit-host>/<approved-folder>/AP017/portrait-001.webp",
  "status": "approved",
  "runtimeEligible": true
}
```

이 예시는 계약 형식이며 실제 생성/검수/DB 등록된 파일이 아니다.

## 재발 방지 테스트

`npm test`는 기존 Vitest 테스트와 Node 이미지 생성 정책 테스트 및 직접 등록 브리지 테스트를 모두 수행한다.
- 101개의 합법적인 제출 요청을 인위적인 일일 cap 없이 검증
- 잠금 AP ID 불일치, 임의 프로필 덮어쓰기, CRC/PNG 규격 불일치 차단
- 공식 등록 도구 응답이 없으면 성공으로 처리하지 않음
- 승인되지 않은 카탈로그 이미지는 렌더링하지 않음
- 승인된 경우에도 임의 외부 이미지 URL을 게임에서 표시하지 않음

## 운영 전 미완료

이 저장소는 게임 프런트엔드 및 연결 보조 코드이고 **Nanal 공식 DB 서버의 소스나 관리자 API가 없다**. 공식 도구의 등록 응답, CDN 업로드, 기존 ID 변형 제출용 관리 도구, ChatGPT 결과 파일 전달 어댑터를 실제 배포 환경에서 연결/검증해야 완전 무인 운영이라고 할 수 있다.
