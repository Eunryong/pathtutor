# 동일 모델 2분할 병렬 분석

## 구현 상태

2026-09-11 코드 구현 및 mock 검증. 실제 Gemini 호출·성능 측정·운영 배포는 하지 않음.

- 모델: 병렬화 당시에는 기존 모델을 유지했으며, 이후 사용자 요청으로 기본값과 배포 설정을 gemini-3.8-flash로 변경(2026-09-11). 운영 배포·실호출은 미수행.
- 공식 모델 ID 및 이미지/구조화 출력 지원: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
- 추정 단가는 공식 Standard 기준 입력 $0.75 / 출력(사고 포함) $3.75 per 1M tokens. 2026-12-31까지의 도입 요금이며 2027-01-01부터 $1.50 / $7.50으로 갱신 필요: https://ai.google.dev/gemini-api/docs/pricing
- 사고 설정, Priority, temperature, 요청별 출력 상한은 변경하지 않음.
- worker/wrangler.toml의 GEMINI_ANALYSIS_MODE=parallel로 다음 배포 시 적용.
- single 또는 설정 미지정 시 기존 단일 요청으로 복귀.

## 처리 흐름

동일 텍스트·이미지를 동시에 두 요청에 전달:

1. core: 문제 인식·학생 첨삭·표준 풀이·피드백
2. extensions: 문제 식 확인·단축 풀이·심화 풀이 또는 수학적 누락 사유

OCR 전처리용 모델 요청을 별도로 추가하지 않음. 두 응답이 모두 완료된 후 검증하여 기존 AnalysisResult 형태로 반환. 클라이언트 계약과 경로 표시 방식은 유지.

각 분기의 검증 오류·복구 가능한 실패는 해당 분기만 재시도. 한쪽이 실패하면 성공한 경로를 임의로 생략하거나 기술적 실패를 수학적 누락 사유로 위장하지 않고 전체 오류 반환. 다른 분기가 완료될 때까지 기다려 Worker 수명 밖의 미처리 요청을 만들지 않음.

## 출력 간소화

- 모델 출력에서 path.name, path.type, step.stepNumber를 제거.
- 고정 객체 키(student/standard/shortcut/genius)에서 경로 타입과 한국어 제목을 결정.
- 단계 배열 순서로 1부터 번호 부여.
- 수식·설명·오류 표시·수정식·전략·수학적 접근 설명·행렬 데이터·피드백은 유지.
- 병렬 해석 일치 검사를 위해 problemLatex는 두 분기에 남김. 단순 표시용 중복이 아님.

## 안전성과 한계

- 문제 식은 공백만 정규화하여 비교. 다르면 INVALID_MODEL_OUTPUT으로 거부.
- 수학적으로 동치인 다른 LaTeX 표현도 거부될 수 있음. 이 검사는 의미적 동치나 모든 경로의 정답 일치를 증명하지 않음.
- 기본 2회 호출, 재시도 1회 설정에서는 최대 4회 호출 가능. 입력·이미지·사고가 중복되어 비용과 quota 사용량이 증가할 수 있음.
- 요청별 50초 제한은 유지. 전체 완료는 느린 분기와 그 재시도에 좌우되며 통합 deadline이나 스트리밍을 추가하지 않음.
- 더 빨라졌다는 실측 결과는 없음. 동일 모델·입력의 단일/병렬 p50·p95와 정확도·누락률·비용 비교는 별도 실호출 승인 후 수행.

## 관측

- meta.durationMs: 전체 요청 시간.
- meta.branches: 분기별 attempts와 durationMs.
- meta.modelCalls: 두 분기의 실제 시도 수 합계.
- meta.attempts: 분기별 시도 수의 최댓값. 기존 재시도율 집계에서 정상 병렬 2회 호출을 재시도로 잘못 세지 않음.
- usage: 검증에 실패한 응답까지 포함해 양쪽의 보고된 토큰 합산.
- 일부 호출의 usage가 없으면 성공 응답의 총 usage·추정 비용을 생략. 미확인 비용을 0 또는 완전한 합계처럼 표시하지 않음.
- 분기 실패 로그는 원본 텍스트·이미지 없이 requestId와 분기 시간·보고된 usage를 기록.

## 검증

동시 시작, 동일 모델/이미지 전달, 실패 분기만 재시도, 토큰 합산, 누락 경로 검증, 문제 식 불일치 거부, 표시 필드 복원, usage 누락 시 비용 생략을 mock으로 검사.

배포 전 확인:

```sh
npm test
npm run typecheck
npx wrangler deploy --config worker/wrangler.toml --dry-run
```

실제 운영 반영은 별도의 worker:deploy가 필요. 롤백하려면 GEMINI_ANALYSIS_MODE를 single로 변경한 뒤 Worker 재배포.
