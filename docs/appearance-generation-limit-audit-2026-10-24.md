# 나날 이미지 생성 제한 감사 / 2026-10-24

## 결론
- 공식 Nanal 이미지 생성 커넥터의 `appearance_generate_reserved_batch` 응답에서 **`dailyJobLimit: 2`** 를 직접 확인했다. 서버가 이 값을 어떻게 계산하고 강제하는지는 공개된 도구 인터페이스만으로는 확인되지 않는다.
- 이 GitHub 저장소는 웹 게임 UI다. 이미지 생성 백엔드, 워커의 대기열, provider 과금·한도 설정, `dailyJobLimit`의 정의 코드는 **현재 저장소에 없다**. 이 저장소의 값을 바꿔도 원격 하루 2건 제한이 제거되지 않는다.
- 현재 도구 목록에는 공식 이미지 서비스의 **일일 한도 조회/변경**, **작업 ID별 재시작/취소**, **공급자 설정 변경** API가 없다. 별도 백엔드 저장소 또는 서비스 관리 접근 없이는 실제 제한을 바꿨다고 주장하지 않는다.

## 감사 증거
- `appearance_generate_reserved_batch({appearanceIds:["AP017","AP018"]})`:
  `{"queued":[],"alreadyStarted":["AP017","AP018"],"dailyJobLimit":2}`
- `appearance_pending_requests` 최근 100건: `queued 65`, `failed 2`, `blocked 8`, `approved 22`, `deleted 3`.
- `queued` 65건 모두 `attempts:0`. 작업을 생성 공급자에 실제 전송했는지는 아직 확인되지 않는다.
- `reserve:AP015`, `reserve:AP016`은 `failed` / `attempts:1` / `이미지 공급자 응답 429: 모델 사용 권한·한도 확인 필요`.
- `reserve:AP013`, `reserve:AP014`는 얼굴·체형 및 배경 불투명 등 후보 품질 문제로 `blocked`.
- 연령/입력 조건 오류가 명시된 `blocked` 6건: `현재 생성 범위(20–59세) 또는 입력 조건 확인 필요`.

## 실제 확인된 제한과 속성

| 제한 | 근거 | 수정 대상/우선순위 |
|---|---|---|
| `dailyJobLimit:2` | 생성 배치 API 응답 | **최우선: 서버 내부의 일일 작업 상한**. 사용자 요구는 고정값 제거 |
| 이미지를 제공하는 상위 공급자의 HTTP 429 | 실패 작업 기록 | **최우선: provider quota/권한/모델 검증, Retry-After 대응** |
| `appearance_generate_reserved_batch` 호출당 ID 1–20개 | 도구 입력 스키마 | 요청 크기 제약. 작업량 상한이 아님; 별도 변경 여부 검토 |
| `appearance_process_next` 최대 1건/호출 | 도구 설명 | 처리 방식 제한. 검증 안 된 혼합 큐이므로 사용 금지 |
| 캐릭터 연령 20–59 | 예약/생성 도구 입력 스키마 | 현재 계약상 연령 범위. 이를 벗어난 요청은 입력 검증 |
| 생성 대상 ID `AP[0-9]{3,5}` | batch API 입력 스키마 | 식별자 형식. 유지 |
| 성별 female/male, 인상 점수 0–100, 컵 B–G | 예약/생성 도구 스키마 | 캐릭터 설계 계약. 별도 제품 결정 없이 제거 금지 |
| 이미지 규격 얼굴 1024×1024 PNG/RGBA, 전신 1024×1536 PNG/RGBA | 예약 imageSpec, 제출 API | 파일·투명 배경 규격. 유지 |
| 후보 QA 통과 전 공식 등록 불가 | 후보 심사/등록 API | 얼굴·체형·앵커·크기·투명도 검수. 유지 |
| 게임 표시 `approved && runtimeEligible` | `src/portrait-catalog.ts` | 런타임 사용 조건. 유지 |
| 점수별 목표 이미지 수 | 예약 `fullBodyTarget` 등 | 생성 계획 목표이며 보편적인 공급자 hard cap으로 확인되지 않음 |
| 사용자 인터페이스 안전 검사 | 일부 도구 호출 전 발생 | 공급자 HTTP 429와 다른 제한. 우회 불가 |

위의 **일일 상한 2**는 `dailyJobLimit`라는 API 응답값으로 확인했다. 다만 최초 생성 기준 이미지 한 쌍을 1건으로 세는지, 재시도도 세는지, 시간대·자정 리셋 기준은 공개되지 않았으므로 추정하지 않는다.

## 이미지 생성 서버 변경 요구사항
1. 서버 코드의 하드코딩된 `dailyJobLimit=2` 또는 DB/config 내 해당 제한 정의를 찾아 제거하거나 비활성화한다. 정체와 과금 방지를 위해 동시 생성 작업 수는 별도 설정한다. `0`을 무제한으로 해석한다는 근거가 없는 한 임의로 0으로 설정하지 않는다.
2. provider 사용량과 계정 요금/권한은 계속 보호한다. HTTP 429는 `Retry-After` 및 한도 초기화 시간을 확인하고 재시도 가능 상황에만 지수 백오프로 대기시킨다. 권한·크레딧 오류는 자동 무한 재시도 금지.
3. `queued`, `running`, `retry_wait`, `provider_blocked`, `awaiting_review`, `approved`, `blocked`를 서로 구분한다. `alreadyStarted`는 영속 작업 ID 및 실제 `running` 상태와 연결되어야 한다.
4. heartbeat/lease 기반 워커 정체 복구; 멱등키로 중복 이미지 생성·과금 방지. `queued attempts=0` 장기 정체를 자동 탐지한다.
5. `get_job(id)`, `retry_job(id)`, `cancel_job(id)`, `process_job(id)`, `get_limits()` 같은 관리 API를 제공한다. 기존 ID 추가 이미지와 신규 정본 요청을 다른 작업 종류로 분리한다.
6. 공급자 문제 때문에 이미지 품질 검사 기준을 완화하거나 `blocked` 후보를 승인하지 않는다. 각 ID의 승인 원본 얼굴/체형/키 앵커를 확인하고 등록한다.
7. 전체 작업 건수가 많아도 유효한 대상별로 진행한다. 다른 게임의 입력 오류가 있는 혼합 큐에 ID 없는 `process_next`를 호출하지 않는다.

## 완료 판정 (라이브 검증 필수)
- 제한 API 응답에서 일일 고정값 2가 사라졌거나 사용자 운영 설정대로 증가했음을 확인.
- 정상 예약 3건 이상이 **같은 날** 실제 `running` → `awaiting_review`까지 전진 (다만 상위 공급자 제약은 준수).
- 429, 연령 입력 오류, 후보 QA 실패가 독립적으로 기록되고 무한 재시도나 전체 큐 중단이 없다.
- 실제 이미지가 저장·검수된 후 게임에 표시될 때만 최종 완료 처리.

연결된 문제 기록: [이미지 생성 큐 정체/429/QA 차단 분리](https://github.com/hj0044/Nanal/issues/27).
