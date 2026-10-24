# AP008 정본 복원 → 전신 2장 추가 → 자동 반영: Work 실행 계약

상위 작업: [Issue #46](https://github.com/hj0044/Nanal/issues/46)  
기준일: 2026-10-24 (Asia/Seoul)  
범위: **기존 AP008 1명, 전신 +2장**, 공식 DB와 게임 DB 구분. 재예약/새 AP ID 생성 금지.

## 0. 선행 검사와 관찰된 차단 원인

1. 공식 커넥터 \`appearance_get_reservation({appearanceId:"AP008"})\`는 APPROVED이며 다음 신체값과 디자인을 권위 원장으로 반환한다.
   - 여성, 20대 / 162cm, 49kg, \`balanced adult build\`
   - D컵 생산 규격 / 밑가슴 70cm, 가슴 87.5cm, 차이 17.5cm
   - \`soft_square\` 얼굴, 전신 1024×1536 RGBA PNG
   - 이미지 경로: \`images.portrait\`, \`images.fullBody\`는 **상대경로**. 완전한 URL로 임의 조합/외부 다운로드 금지
2. 라이브러리에 동명의 기존 이미지 2장이 있고 시각적으로는 확인되지만, \`files.materialize\`는 \`This Project file does not have an authorized raw-byte materialization path.\`를 반환했다. 시각 렌더링만으로 원본 PNG 바이트/SHA 확보를 주장하지 않는다.
3. 연결된 Google Drive에서 AP008 / Nanal 검색 결과는 비어 있다. 백업 존재 여부를 더 넓은 범위에서 확정할 수 없으며, 현재 찾은 정본 원본은 없다.
4. \`AP_Physical_Identity_Master_v1.json\`의 2026-10-23 스냅샷은 AP008 \`generationAllowed:false\`; 전체 시각 정본 검증 미완료. 이 미러는 공식 live 예약과 다를 수 있으니 맞춰서 재검증.
5. 공식 나날 도구에는 **기존 캐릭터 이미지 읽기·기존 ID variant 등록**이 노출되지 않았다. 신규 첫 쌍용 \`appearance_submit_reserved_images\`를 기존 추가 2장에 사용하면 안 된다.
6. GitHub \`src/assets/character-portraits/catalog.json\`은 \`assets:[]\`. 게임 공개 URL 및 AP008 반영 증거 없음.
7. ChatGPT \`image_gen\` 출력 이미지의 원본 바이트가 프로젝트 Worker로 자동 전송되는 네이티브 호스트 콜백은 현재 접근 불가. 리포지터리 코드만으로 설치했다고 말하면 안 된다.

## 1. Work 개발 실행 순서: P0 → P1 → P2 → P3 → P4

### P0: 공식 서버/도구 권한 및 정본 바이트 획득 (blocking)

백엔드 소유 서비스에 다음 인증된 작업을 구현하고 사용자 채팅의 Nanal 연결 도구로 노출할 것:

- \`appearance_get_canonical_assets({appearanceId})\`: 접근 제어 후 **승인된** portrait/fullBody 정본 2개의 실제 바이너리, 자산 ID·원본 SHA-256·소스 경로·신체 통계 잠금 해시·QA 감사기록을 신뢰할 수 있는 호스트 어댑터에 반환한다. 바이너리가 DIL/텍스트 도구를 거치기 어렵다면 권한 제한 스트리밍 \`file_uri\` 또는 생성 호스트에서만 사용 가능한 핸들을 사용한다. 자의적인 서명 URL 조합 금지.
- \`appearance_submit_variant({appearanceId,kind,index,originalPngSha256,referenceAnchorSha256,requestKey,originalFileRef})\`: 이미 승인된 AP ID의 **추가** 이미지를 업로드하고 실재하는 \`assetId\` 및 \`awaiting_review\` 응답을 반환한다. 멱등 키와 정본 계보, 물리 통계 변경 금지를 강제한다.
- \`appearance_get_variants({appearanceId})\`: 기존 전신 장수·인덱스를 공식 원장 기준으로 읽고 중복/누락 없이 다음 2개 슬롯을 예약한다.
- \`appearance_get_variant_status({assetId})\`: \`uploaded / awaiting_review / blocked / approved\` 및 QA 사유 조회.
- 위 세부 명칭은 계약 이름이며 **현재 실제 연결 도구에 없으므로 미구현**이다. 개발자는 서버 구현 및 연결 권한이 없으면 이 단계를 \`external_dependency_blocked\`로 남겨야 한다.

게임 측 대체 경로는 Cloudflare D1/R2이며 공식 서버와 동기화되어 있지 않다. 공식 DB의 정본을 복원하지 않은 채 게임 DB의 임의 아트로 AP008을 대체 금지.

### P1: 검증 가능한 정본 복원 및 생성 게이트 (새로 만든 코드)

- \`server/image-pipeline/canonical-source.mjs\`의 \`recoverCanonicalSource()\`는 \`getReservation\` + \`getCanonicalAssets\` 신뢰 어댑터를 요구한다. 명령 인자에는 \`AP008\`을 전달하며 다른 ID를 만들지 않는다.
- 원장의 신체값, 얼굴 설계, \`designVersion\`, profile SHA와 anchor PNG SHA를 비교한다.
- 얼굴·키/화면 스케일·체형·흉부 실루엣·초상-전신 동일성의 **승인된 시각 감사기록** 확인 필수. CRC, RGBA, 투명도, 규격과 픽셀 QA는 독립적으로 검사한다.
- 오직 성공 시 \`.nanal-private/canonical/AP008/\`에 정본 2개 원본을 불변 백업하고 \`ready_for_same_identity_variant_generation\`으로 전환. \`getCanonicalAssets\`가 없으면 \`official_canonical_asset_read_action_not_exposed\`가 정상적인 차단 결과.
- 다음 주 개발자는 이미지 마스터 중앙 미러에 검증 SHA·QA 증거를 기록하고, 실재 운영 정본과 다르면 동기화만 수행(임의 해시 작성 금지).

### P2: ChatGPT Images 원본 편집 → 전신 이미지 정확히 두 장

- 사용자가 허가한 생성 경로는 **ChatGPT Images**이며, 유료 OpenAI API를 임의 호출하지 않는다. 공식 PNG 정본 두 개를 실제 참조 이미지로 편집한다. 텍스트만으로 다른 얼굴을 새로 만드는 방법 금지.
- 동일 AP008의 \`soft_square\` 얼굴, 눈·코·입·눈썹, 갈색 계열 장발의 정체성, 키/체중, 프레임·흉부 규격 고정. 얼굴/신체 왜곡 시 그 건만 반려하고 정본부터 다시 시작한다.
- Variant A: 올리브+차콜 스트리트 유틸리티 상의와 스트레이트 팬츠, 자연스러운 3/4 스탠딩, 두 손·머리·신발 포함.
- Variant B: 네이비+화이트 단정한 일상 레이어링과 테일러드 팬츠, 체중을 옮긴 편한 스탠딩, A와는 복장·자세만 다름.
- 산출물: **각각 별도 PNG 1024×1536, RGBA + 완전 투명 배경**, 마젠타/검은 박스·그림자·문자·워터마크·신발 잘림 없음. 정본의 동일 체형 유지.
- 요청량 2장은 총 목표 수량. 불필요한 앱 자체 일일 2건 상한 금지. 플랫폼 제공자 자체 한도·정책은 우회하지 않는다.

### P3: 실파일 업로드 + QA + 원본 보존

실제 호스트 생성 결과의 \`Buffer\` 또는 인증된 \`file_uri\`를 \`handoffGeneratedArtifact\`에 연결하되, 파일 핸들이 없으면 \`artifact_bytes_unavailable\` 상태를 반환한다. 임의 링크/더미 PNG를 업로드하지 않는다.

경로 A(공식): \`appearance_submit_variant\` → 공식 \`awaiting_review\` 자산.  
경로 B(게임): \`submitChatGptBytes\` → 불변 로컬 백업 → 비공개 Google Drive 체크섬 백업 → Cloudflare R2/D1 \`awaiting_review\` → 160/320/640/1024 WebP.  
두 경로를 동일 ID/동일 SHA 이벤트로 감사 연결하되, 어느 한쪽 성공을 양쪽 성공으로 선언 금지. 이미지 파일과 비밀키는 공개 GitHub/브라우저/VITE_에 넣지 않는다.

각 후보 시각 QA의 원본:
- 반드시 정본 **초상화 + 전신** 비교 자료 제공
- 객관검사: PNG CRC, RGBA, 알파, 1024×1536, 두상·발끝, bbox 스케일, 후보 고유 SHA
- 시각검사: 얼굴 동일성, 좌우 비율, 흉부 드레이프·어깨/허리/골반/다리 비율, 의상 외 신체 속성 변동 여부
- 미확인·애매함 → \`awaiting_review\`, 자동 PASS 금지; 뚜렷한 불일치 → \`blocked\`
- 승인에는 실재 QA reviewer, note 30자 이상, 증거 checksum 필요.

### P4: 승인 → 게임 캐릭터 카드에 표시

- 공식 DB 승인과 별도 게임 DB 승인 모두 실확인 후 동일 AP008 catalog 갱신. 전신 이미지는 **portrait avatar로 사용하지 않음**; 캐릭터 상세 전신 갤러리에 2장 추가.
- \`GET /api/appearance/catalog\` 및 \`GET /api/appearance/assets/{assetId}\`에서 승인된 자산만 접근 가능. 미승인 파일은 403/404.
- 라이브 배포 워커/게임 화면에서 실제 전신 갤러리 조회, 새로고침 없는 갱신, 모바일 390×844에서 머리/발끝 잘림 없음까지 검증.
- 보안: AP ID 위조, requestKey 중복, 잘못된 SHAs, 악성 image URL, 401/409/413/422, 부분 백업 실패, 429 backoff, 5xx 재시도, 후보 1장 실패 시 다른 1장 진행/상태 보존.

## 2. 상태 모델 및 승인 조건

~~~
requested
  → source_access_pending
  → canonical_recovered
  → reference_qa_passed
  → generation_queued
  → generated (real image bytes)
  → backup_verified
  → official_awaiting_review
  → game_awaiting_review
  → visual_qa_passed
  → official_approved + game_approved
  → game_visible (real UI confirmation)
~~~

* 하나라도 실패하면 원래 후보 ID·인덱스·해시를 유지한 채 오류 상태 저장 및 안전한 재시도. 성공 상태를 선취하지 않는다.
* 백오프: 429는 \`Retry-After\` 준수, 5xx는 제한적 지수 백오프, 401/403/422/안전 검사 실패는 자동 무한 재시도 금지.
* 비용: 무료 경로 최우선, 비용을 발생시키는 새 공급자 호출·유료 저장소 프로비저닝은 별도 승인 없이는 실행하지 않는다.
* 장기 트리거: 정본이 승인될 때 ID 지정 단일 작업을 큐에서 재개. **ChatGPT 앱 내부의 자동 이미지 생성/바이트 전달이 불가능할 때는 사람이 호출 가능한 정확한 재개 지점을 남긴다.** ChatGPT Task/알림을 실제 이미지 생성 워커와 혼동하지 않는다.

## 3. 완료증빙 / Work 인수 기준

- [ ] \`appearance_get_canonical_assets(AP008)\` 운영 응답에 실재 2개 anchor assetId 및 유효한 binary/stream, sha256 존재
- [ ] 원본 PNG checksum + 정본 시각 QA 통과 기록과 신규 source gate readback
- [ ] 정확히 두 장의 1024×1536 PNG 생성 기록(최초 앵커로부터 직접 편집)
- [ ] 이미지 A/B의 각 \`assetId\`, \`originalSha256\`, \`anchorSha256\`, \`requestKey\`, 최종 상태 기록
- [ ] 공식 DB \`approved\` + 게임 D1/R2 \`approved\` 개별 readback
- [ ] 모바일 게임 AP008 전신 갤러리에 정확히 +2장 및 기존 사진 보존
- [ ] \`npm test\`, \`npm run build\`, \`npm run verify:site\` 통과; 워커 실제 배포 확인
- [ ] 어떤 단계든 미완료일 때 해당 원인과 외부 소유자를 명시하고 완료 보고 금지

## 4. Work에 전달할 실행 지시

> \`hj0044/Nanal\` 저장소의 Issue #46과 이 문서를 구현 기준으로 삼아, 현재 \`work/ap008-canonical-automation-rfc\` 초안 PR의 코드와 테스트를 이어받아 완성하세요. AP008 공식 원장과 승인 정본을 읽을 수 있는 신뢰 가능한 서버 액션을 우선 마련하고, 불가능한 권한은 외부 차단으로 정확히 보고하세요. 이후 동일인물 편집으로 전신 두 장을 만들어 실제 원본 바이트를 획득할 수 있을 때만 업로드하세요. 사용자에게 계정 토큰 값을 채팅에 붙여넣게 하지 마세요. 단위/통합/라이브 QA와 모바일 검증을 완료한 증거만 최종 결과로 제출하세요.
