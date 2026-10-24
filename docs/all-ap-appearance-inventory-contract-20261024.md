# Nanal 전체 캐릭터 이미지 목표·검수·승인 수량 자동 집계 계약

적용 범위: **AP001–AP020 및 향후 신규로 승인/등록되는 모든 `AP\\d{3,5}` 캐릭터**.
Issue #46 → Draft PR #50의 후속 범위. 이 문서는 **개발된 집계 코드**와 아직 확보되지 않은 **운영 서버 연결**을 구분한다.

## 1. 이미지별 상태 및 목표 숫자

| 용어 | 정의 | 데이터 근거 |
| --- | --- | --- |
| 목표 수량(`targetCount`) | 캐릭터·이미지 역할(`portrait`/`fullBody`)별 공식 원장의 목표값 또는 명시적인 소유자 설정 | `appearance_image_targets` |
| 승인 수량(`approved`) | 게임 D1/R2에서 QA 승인 완료된 고유 이미지 SHA-256 수 | `appearance_variants.status='approved'` |
| 검수 대기(`awaitingReview`) | 저장은 되었으나 독립 시각 QA 미완료 | `appearance_variants.status='awaiting_review'` |
| 차단(`blocked`) | QA 실패 또는 운영 정책 차단된 후보 | `appearance_variants.status='blocked'` |
| 목표 미달(`remainingToApprove`) | `max(0, targetCount - approved)`; 검수 대기 이미지는 승인에 미포함 | 계산식 |
| 신규 생성 필요 추정(`unfilledAfterPending`) | `max(0,targetCount-approved-awaitingReview)`; 대기 후보가 모두 승인된다는 가정의 **계획용 숫자**, 확정 수량 아님 | 계산식 |
| 목표 미지정 | 공식 원장에 해당 역할 목표가 없거나 아직 동기화되지 않음 | **null, 임의 0/12 금지** |

공식 Nanal 플러그인 DB 승인 장수와 게임 D1/R2 승인 장수는 **서로 다른 지표**이다. 같은 캐릭터의 서로 다른 시스템 계수를 더해 이중 계산하지 않으며, 이 API의 집계는 명시적으로 `source:"game_d1_r2"`로 표시한다. 공식 DB 수량 조회 API가 노출되기 전에는 `officialApprovedCount`를 만들어내지 않는다.

## 2. 확장 규칙: AP001–AP020에서 AP99999까지

- `src/appearance-inventory.ts`는 AP001–AP020 식별자를 코드에 하드코딩하지 않고 **실제 game D1 `appearance_identities` 전체**를 조회한다.
- 새 AP가 정본 검수 후 `PUT /api/appearance/identities/APxxxxx`로 추가되면, 별도 마이그레이션 없이 다음 조회부터 목록에 자동 나타난다. **아직 검증되지 않은 AP 예약을 임의로 게임 신원으로 등록하지 않는다.**
- 새 그림은 기존 이미지 제출 경로에서 `appearance_variants`에 들어오고 `awaiting_review`로 집계된다. 별도 동기화 배치 없이 API 조회 시 집계가 갱신된다.
- 승인/차단 시 상태가 바뀌면 다음 조회부터 반영된다. 동일 AP/역할/바이너리 SHA-256 중복은 승인 > 대기 > 차단 우선순위로 **한 장만** 센다.
- 임의의 AP 이미지 이미지 경로나 유사한 얼굴은 자동 수집하지 않는다. AP000/문자열 변조/원본 정본이 없는 ID에는 안전하게 거부한다.
- 영구 파일 저장은 R2; D1엔 메타데이터·상태·목표값만 둔다. ImageKit과 원본 Drive는 현재 별도 경로이며 운영 동기화 완료를 뜻하지 않는다.

## 3. D1 마이그레이션: 반드시 적용

`migrations/002_appearance_image_targets.sql`을 기존 `001_appearance_assets.sql` 이후 **추가 적용**한다. 기존 `appearance_identities`, `appearance_variants` 행은 지우거나 초기화하지 않는다.

- `appearance_image_targets`: 복합 PK (`appearance_id,slot`), 잠긴 `profile_sha256`, 출처·변경시각.
- `appearance_image_target_audit`: 목표의 이전값/새값/출처/프로필 SHA를 SQLite 트리거로 **동일 트랜잭션**에 감사 기록.
- 지금 등록된 이전 사진의 승인 여부는 바꾸지 않는다. 기존 행을 삭제하지 않고 새 집계 조회에서 그대로 재사용한다.

## 4. 관리자 API

관리자 비밀 토큰은 Worker Secret으로만 관리하고 클라이언트 번들에 배포하지 않는다.

- `GET /api/appearance/admin/inventory`: 검증되어 게임DB에 등록된 **모든 AP**별 `counts.portrait` 및 `counts.fullBody`를 반환한다. 공식DB 장수는 미포함.
- `GET /api/appearance/admin/inventory/AP008`: 한 캐릭터의 별도 집계. 게임 미등록 ID는 404.
- `PUT /api/appearance/identities/AP008/targets`: 잠금 `profileSha256`을 재확인해 명시된 `slot` 목표를 기록. `source`는 `verified_official_reservation` 또는 `explicit_owner_target`만 허용. 같은 목표 재제출은 `unchanged`; 목표 변경은 D1 audit 기록. **이 작업은 이미지 승인/캐릭터 정본 변경이 아니다.**

요청 예시(실제 식별 프로필 해시를 안전한 서버에서 받은 경우):

```json
{
  "slot": "fullBody",
  "targetCount": 12,
  "source": "verified_official_reservation",
  "profileSha256": "<actual-verified-canonical-profile-sha256>"
}
```

이 예시는 운영 해시가 아니다. 문서의 가짜 해시를 실데이터로 사용하지 않는다.

## 5. 공식 서버 목표값 동기화

`src/appearance-inventory.ts`의 `officialReservationTargetUpdates(reservation)`은 실제 공식 예약 `brief.fullBodyTarget`/선택적 `brief.portraitTarget` **존재 시에만** 업데이트 계획을 만든다. AP008 공식 예약에 전신 12장이 기재된 사실은 확인되었지만, **AP001–AP020 각각의 목표 장수는 일괄 확인하지 않았으므로 동일 12장으로 추측하지 않는다.**

`server/image-pipeline/official-inventory-sync.mjs`:
1. 공식 커넥터 `listOfficialAppearanceIds()`를 신뢰할 수 있는 호스트에 제공해야 **과거와 미래 모두 자동 발견**한다. 현재 플러그인에서는 미노출. 없으면 `official_character_list_action_not_exposed`.
2. `getOfficialReservation({appearanceId})`에서 실제 공식 목표를 조회한다.
3. `getGameIdentity({appearanceId})`에서 공식 검수 완료 신원과 profile SHA 존재를 확인한다. 없으면 업데이트하지 않고 해당 ID만 `canonical_game_identity_not_verified`.
4. `submitGameTarget()`의 200/201 응답(`recorded`/`unchanged`)이 실제 확인되어야 동기화 성공으로 보고한다.
5. 신규 공식 AP 생성/목표 변경 이벤트가 발생할 때 호출하도록 신뢰 가능한 워커에 연결하고, 재기동 후 전체 재동기화 기능을 제공한다. **현재 이벤트/호스트 어댑터는 설치되지 않았으므로 완전 무인 운영은 미완료**이다.

소유자 승인된 특수 목표 수정은 `explicit_owner_target`으로 감사 기록한다. 공식 원장 갱신값과 충돌할 경우 운영 정책에서 어느 값이 우선인지 명시하기 전에는 자동 덮어쓰지 않도록 후속 통합에서 충돌 검증을 수행해야 한다.

## 6. Work 개발/운영 인수 기준

- [ ] AP001–AP020 각각 실제 공식 예약 원장과 최신 목표값 조회; 누락 ID는 미지정으로 구분
- [ ] 최신 AP 예약 전체 목록을 제공하는 승인된 공식 서버 API + 기존 이미지 변형 등록 API 실제 연결
- [ ] 신규 ID 생성 및 이미지 신규 추가/QA 상태 변경 이벤트에 배치 또는 이벤트 동기화 연결
- [ ] 게임DB와 공식DB 각각 고유 원본 SHA 기준 승인 수량 감사 대사(reconciliation) 구현
- [ ] 사용자 화면용 관리 대시보드는 승인/대기/차단/미달 표시만; 비밀 토큰 전송 금지
- [ ] 로컬/CI 테스트, 실제 D1/R2 마이그레이션 적용 및 라이브 readback/모바일 검증
- [ ] 기존 AP 저장 데이터/승인 이미지/캐릭터 ID/관계 정보를 초기화하지 않는 회귀 테스트

## 7. 구현 변경 목록 (이 PR 초안)

- `migrations/002_appearance_image_targets.sql`: 비파괴적 목표값 및 감사 DB 추가
- `src/appearance-inventory.ts`: 미래 AP까지 일반화된 고유 사진 집계/목표
- `src/appearance-api.ts`: 인증된 전 캐릭터 집계 API·목표 변경 API
- `src/appearance-inventory.node-test.mjs`: AP001–020, AP021, AP10000, 중복 해시 및 미정 목표 테스트
- `server/image-pipeline/official-inventory-sync.mjs`: 공식 백엔드 어댑터가 준비되면 전체 동기화
- `server/image-pipeline/official-inventory-sync.node-test.mjs`: 미래 ID 포함·누락 목표·차단 오류 테스트
- `src/appearance-api.node-test.mjs`: API 인증·검수 대기·목표 수정·미래 ID 집계 테스트

**핵심:** 목표·상태·원본 정본·DB 등록은 서로 별개다. 현재 추가한 기능이 **ChatGPT 이미지 생성 자체를 실행하거나 공식 이미지DB 운영 서버의 권한을 대체하는 것은 아니다.**
