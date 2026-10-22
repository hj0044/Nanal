# Nanal

현대 한국의 인생 시뮬레이션 웹 프로토타입입니다.

## 실행

```sh
npm install
npm run dev
```

검사와 빌드:

```sh
npm test
npm run build
```

첫 프로토타입은 캐릭터 설정, 첫 주 생활 진행, 상황별 선택, 관계와 상태 변화, 브라우저 자동 저장 및 저장 파일 내보내기·불러오기를 포함합니다. 게임 내 수치와 확률은 플레이 검증을 위한 임시 값입니다. 현실 통계 자료는 출처와 기준 연도를 확인한 뒤 연결합니다.

제품 방향은 [docs/product-vision-v0.1.md](docs/product-vision-v0.1.md), 구현 계획은 [docs/mvp-build-plan-v0.1.md](docs/mvp-build-plan-v0.1.md)를 참고하세요.

## 캐릭터 이미지 상태

현재 캐릭터 초상화 이미지 파일과 얼굴 선택·표시 기능은 게임에서 제거했습니다. 새 이미지가 검수·승인되기 전까지 주인공과 NPC 프로필에는 이름 첫 글자 아바타가 표시됩니다. 기존 세이브의 진행·관계 데이터는 유지하며, 폐기된 초상화 ID와 해당 이미지 이력은 저장 파일을 불러올 때 정리합니다.

새 얼굴을 다시 적용할 때는 이미지를 검수한 뒤 `src/assets/character-portraits/catalog.json`에 자산 정보를 등록하고 `status: "approved"`, `runtimeEligible: true`를 모두 지정합니다. 카탈로그는 두 조건을 만족하는 항목만 게임에 포함하고 자동 배정에 사용합니다. 이미지 파일과 표시 UI는 별도 작업으로 다시 구현해야 합니다.
