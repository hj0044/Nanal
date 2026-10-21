# Nanal — 반실사 레이어 캐릭터 제작 파이프라인 v1

## 기존 게임과의 계약

Nanal의 현재 React/Vite 앱은 src/portrait-catalog.ts를 통해 WebP 파일과 character-portraits/catalog.json을 읽는다. 제작 파이프라인은 게임 외부에서 실행하며 기존 엔진, NPC 로직, 저장 데이터, UI에는 손대지 않는다.

- 같은 인물의 얼굴은 고정된 characterId로 표현한다.
- 파츠를 조합한 완성형마다 고유 assetId를 부여한다.
- 현재 게임은 동일 characterId에 하나의 활성 초상화만 허용한다. 따라서 게시 단계에서 한 얼굴당 하나의 조합만 승인 가능하다.
- 헤어/의상 변경을 게임 중 실시간 반영하려면 별도의 UI/게임 저장 계약이 필요하다.

## 템플릿 준비

1. 1024×1024 RGBA PNG 기준 인물을 만든다. 포즈·표정·시점·광원과 얼굴·목·어깨 기준점을 고정한다.
2. 같은 캔버스에 얼굴, 앞머리, 뒷머리, 몸, 의상 다섯 영역을 RGBA PNG 마스크로 만든다. **게임용 마스크 알파 255가 파츠 내부, 알파 0이 파츠 외부**다.
3. 체형별 몸과 옷 실루엣이 다르면 bodyMasks 및 outfitMasks를 추가한다. 모든 체형에서 목 연결점은 동일해야 한다.
4. tools/portrait-kit.example.json 파일을 별도 kit 폴더의 kit.json으로 복사하고 template, masks, variants를 실제 이미지와 제작 지시에 맞춰 수정한다.
5. 얼굴·헤어·체형 파츠를 AI가 편집할 때 원본 템플릿을 함께 전달한다. 헤어는 한 번 생성한 이미지에서 앞뒤 2개 마스크로 파츠를 나눈다. 의상은 체형별 몸 이미지를 참조해 따로 생성한다.
6. 반환된 이미지는 파츠 마스크로 **강제 클리핑**한다. AI가 마스크 경계를 완벽히 지킨다고 가정하지 않는다.

## 사용 방법

Python 3.11 이상 및 Pillow가 필요하다. 설치: python -m pip install Pillow

~~~bash
# 이미지 요청 수만 확인(유료 호출 없음)
python tools/portrait_pipeline.py generate --kit art/portrait-kits/adult-female-v1/kit.json

# AI 유료 생성: 명시적 실행 승인과 호출 횟수 상한
export OPENAI_API_KEY="..."
python tools/portrait_pipeline.py generate --kit art/portrait-kits/adult-female-v1/kit.json --execute --max-requests 12

# 조합 생성 및 QA 보고서/연락시트 출력
python tools/portrait_pipeline.py compose --kit art/portrait-kits/adult-female-v1/kit.json --limit 72

# qa-report.json 및 contact-sheet.png 직접 검수한 후 아래 승인 파일 작성:
# .portrait-build/adult-female-v1/approved.json
# {"approved": ["adult-female-v1-f01-h01-slim-casual"]}
python tools/portrait_pipeline.py publish --kit art/portrait-kits/adult-female-v1/kit.json --approvals .portrait-build/adult-female-v1/approved.json

# API 호출 없는 구조 회귀 검증
python -m unittest discover -s tools -p 'test_portrait_pipeline.py'
~~~

기본 모델은 gpt-image-2이며 --model 매개변수로 바꿀 수 있다. API 키는 로컬 환경변수로만 관리한다. 생성 비용은 실제 호출 시 발생하며 스크립트는 --execute 없이는 생성하지 않는다. 기본 최대 호출 한도는 12다.

## 합성 및 검수

레이어 순서: 뒷머리 → 몸 → 체형별 의상 → 얼굴 → 앞머리.

자동 QA는 누락 파일, 비정상 크기/색상 모드, 빈 파츠, 정의된 마스크 밖으로 새는 알파 픽셀을 차단한다. 성공 조합은 WebP와 연락시트로 출력하며 각 이미지의 SHA-256을 QA 결과에 저장한다. 게시할 때 승인 목록과 SHA-256을 재검증하고 기존 Nanal 초상화 카탈로그에 추가한다.

그러나 피부·머리·옷 경계, 체형 적합성, 그림체, 얼굴 정체성, 손상된 인체 묘사는 자동으로 보장할 수 없다. 연락시트에서 **사람이 승인해야** 게시할 수 있다.

## 현재 범위와 차기 단계

이번 PR은 에셋 제작 및 게시 도구 + 테스트만 포함한다. 실제 AI 호출은 API 키/기준 템플릿이 없어서 실행하지 않았으며 신규 NPC 그림을 게시하지 않는다.

다음 단계: 기준 남녀 템플릿 실제 제작 → 유료 AI 생성 품질·비용 검증 → 세이브 호환 가능한 appearanceId/헤어/의상 변경 런타임 구현 → 실제 기기 UI 검수.
