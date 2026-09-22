# PathTutor-edu

이미지와 텍스트로 입력된 수학 풀이를 분석해 학습자의 풀이 과정을 재구성하고, 오류 피드백과 여러 풀이 경로를 보여주는 멀티모달 AI 튜터 프로토타입입니다.

> 이 저장소는 2025년 12월부터 2026년 1월까지 Google AI Studio에서 설계·검증한 프로토타입을 바탕으로, Cloudflare Workers와 Gemini Flash API 기반 후속 구조를 구현하는 프로젝트입니다. 현재 Worker API와 프론트엔드를 각각 Cloudflare에 배포했고, 운영 Worker에서 텍스트 분석·이미지 OCR·유사 문제 생성 smoke test를 3/3 성공시켰습니다. 기본 Pages 주소와 `pathtutor.eunryong.win` custom domain 모두 운영 중입니다.

## 프로젝트 정보

| 항목 | 내용 |
| --- | --- |
| 프로젝트명 | PathTutor-edu |
| 기간 | 2025.12 ~ 2026.01 |
| 형태 | Google AI Studio 기반 AI 프로토타입 |
| 현재 클라이언트 | React 19 + Vite + TypeScript |
| 현재 프론트엔드 배포 | Cloudflare Pages (`pathtutor.eunryong.win` 연결 중, `pathtutor-edu.pages.dev` 운영) |
| 프로토타입 당시 모델 호출 | 브라우저에서 Gemini 3 Pro Preview 직접 호출 |
| 현재 후속 모델 호출 | Cloudflare Worker에서 Gemini REST API 호출 |
| 후속 방향 | Cloudflare Workers + Gemini Flash API |
| 목표 | 이미지·텍스트 수학 풀이 분석, 풀이 과정 재구성, 학습 피드백 제공 |

## 프로젝트에서 확인·구현한 것

- Gemini를 활용해 수학 풀이 분석 프롬프트를 작성했습니다.
- 요구사항과 출력 규칙을 AI가 처리하기 쉬운 형태로 구조화했습니다.
- 이미지 속 수식과 손글씨 풀이를 인식하는 멀티모달 분석 흐름을 구성했습니다.
- 학생 풀이, 표준 풀이, 단축 풀이, 심화 풀이를 생성하도록 프롬프트를 설계했습니다.
- JSON Schema와 LaTeX 출력 규칙을 설계했습니다.
- OCR 기반 수학 문제 분석이 동작하는지 AI Studio에서 확인했습니다.
- 생성 결과와 출력 누락·형식 오류·응답 지연 등의 한계점을 테스트했습니다.
- `/api/analyze`와 `/api/practice` Worker 엔드포인트를 추가했습니다.
- Worker에서 입력 제한, timeout, bounded retry, 런타임 응답 검증을 처리하도록 구성했습니다.
- `standard` 풀이를 필수 경로로 검증하고, `shortcut`·`genius` 누락 사유를 반환하도록 확장했습니다.
- 브라우저의 Gemini SDK·API 키 직접 호출을 제거하고, 프론트엔드를 API 클라이언트로 전환했습니다.

이 프로젝트에서 AI가 구현 전체를 자동으로 완성한 것은 아닙니다. Gemini의 도움으로 프롬프트를 작성했으며, 본인이 요구사항·출력 구조·실패 사례를 정리하고 결과를 검증하는 방식으로 프로토타입을 설계했습니다.

## 주요 기능

### 병렬 분석 보완 (2026-09-11, 운영 미반영)

현재 모델·사고 설정을 유지하고 첨삭/표준 풀이와 단축/심화 풀이를 동시에 생성하는 Worker 모드를 추가했습니다. 모델이 만들던 고정 경로 제목·타입·단계 번호는 코드에서 복원합니다. 실패 분기만 재시도하고 분기별 시간·전체 호출 수·토큰 합계를 기록합니다. 코드 설정은 parallel이며 실제 운영 반영에는 Worker 배포가 필요합니다. 실호출이나 속도 개선 측정은 수행하지 않았습니다. 비용 증가·해석 불일치와 복귀 절차는 [병렬 분석 기록](docs/PARALLEL_ANALYSIS.md)을 참고하세요.

### 풀이 분석

텍스트 또는 이미지 입력을 바탕으로 다음 정보를 생성하도록 요청합니다.

- 원문 문제의 정규화된 LaTeX
- 문제 유형 설명
- 학생이 작성한 풀이 경로와 오류 표시
- 표준·단축·심화 풀이 경로
- 정확도·개념 이해도·전략 효율성 피드백

원본 프로토타입에서는 모델이 반환한 경로만 화면에 표시되어 네 가지 경로가 항상 모두 나타나지 않았습니다. 현재 Worker 계약에서는 `studentPath`와 `standard`를 필수로 검증하고, `shortcut`·`genius`를 생략하면 이유를 함께 반환합니다.

### 학습 노트 UI

- KaTeX 기반 수식·행렬 렌더링, 단계선 탐색과 첫 오류 자동 선택
- 수정 풀이 펼치기, 입력 원본 확인, 데스크톱 병렬 비교·모바일 풀이 전환
- 이미지 드래그·붙여넣기·교체·삭제와 텍스트 입력
- 내 풀이 첨삭 / 문제만 질문 구분, 접힌 AI 참고 평가
- 실제 경과 시간·취소 안내와 오류 발생 후 입력 보존
- AI 호출 없는 예시 결과·예시 연습 문제
- SUIT 제목·Pretendard 본문 자체 호스팅, OFL 라이선스 동봉

실측 모델 점수와 학습 효과를 동일시하지 않습니다. 구현 내역과 검증 한계는 [UI 보완 기록](docs/UI_UX_IMPLEMENTATION.md)을 참고하세요.

### Veo 실험 기능

원본 프로토타입에서 Veo 영상 생성 아이디어를 실험했지만, 현재 후속 Worker에는 Veo 호출을 포함하지 않습니다. AI Studio에서 실제 영상 생성 완료까지 검증하지 못했으므로 핵심 기능과 학습 노트 UI에서 제외했습니다.

## 구조

현재 런타임·배포·분석 branch·오류 처리 흐름은 [프로젝트 플로우 문서](docs/PROJECT_FLOW.md), 프롬프트 설계와 검증 이력은 [프롬프트 로그](docs/PROMPT_LOG.md)를 참고하세요.

```text
사용자 브라우저
    └─ React/Vite UI
        ├─ 텍스트 입력 또는 이미지 선택
        ├─ services/clientApi.ts
        │   └─ POST /api/analyze, POST /api/practice
        └─ 분석 결과 렌더링
            ├─ AnalysisResults: 단계 탐색·첨삭·비교
            ├─ 접힌 AI 참고 평가
            └─ KaTeX 수식·행렬
                    ↓
          Cloudflare Worker
            ├─ 입력·CORS·timeout 검증
            ├─ Gemini REST API 호출
            ├─ JSON Schema + 런타임 검증
            └─ 재시도·오류 코드·관측 메타데이터
```

프로토타입 당시에는 브라우저가 Gemini API를 직접 호출했지만, 현재 후속 구현에서는 브라우저가 Worker API만 호출합니다. `GEMINI_API_KEY`는 Worker 환경에서만 읽도록 분리했습니다.

## 빠른 시작

### 사전 요구사항

- Node.js 20 이상 (Vitest 5 개발 도구 기준)
- Gemini API 키

### 설치 및 실행

```bash
npm install
```

Worker 로컬 실행용 `.env` 파일을 준비합니다. Wrangler 설정 파일이 `worker/` 안에 있으므로 키 파일도 `worker/.env`에 둡니다.

```env
# worker/.env
GEMINI_API_KEY=your_gemini_api_key
```

`worker/.env.example`을 복사해 값을 넣어도 됩니다. 실제 `.env` 파일은 커밋하지 않습니다.

터미널을 두 개 열고 Worker와 프론트엔드를 각각 실행합니다.

```bash
# terminal 1
npm run worker:dev
```

```bash
# terminal 2
npm run dev
```

기본 주소는 `http://localhost:3000`이고, Vite가 `/api` 요청을 `http://127.0.0.1:8787`의 Wrangler Worker로 프록시합니다.

기본 `npm run test:integration`은 실제 Gemini 호출을 막기 위해 건너뜁니다. 이미 완료한 운영 smoke test를 다시 실행해야 할 때만 `worker/.env` 또는 운영 Secret을 준비하고 아래 명령을 명시적으로 사용합니다. 이 명령은 Gemini 토큰을 소비할 수 있으며, Worker가 실행 중이지 않으면 로컬 Worker를 자동으로 시작합니다.

```bash
npm run test:integration:live
```

일반 회귀 검증은 외부 API를 호출하지 않는 `npm test`, `npm run typecheck`, `npm run build`를 사용합니다.

고정 테스트셋 평가 도구는 저장된 응답만 읽으며, latency 평균·p50·p95·재시도율·토큰·추정 비용을 계산합니다. Gemini 호출이 필요한 응답 기록은 별도 승인 후에만 생성합니다.

```bash
# 비용이 발생할 수 있는 명시적 live 평가·기록
npm run test:integration:live -- --record fixtures/recorded-results.json

# 저장된 응답의 재현 가능한 오프라인 평가
npm run evaluate:cases -- fixtures/recorded-results.json
```

Worker 번들만 배포 전 검증하려면 다음 명령을 사용합니다.

```bash
npm run worker:deploy -- --dry-run
```

프론트엔드 배포용 번들은 다음 명령으로 확인할 수 있습니다.

```bash
npm run build
npm run preview
npm run typecheck
```

Cloudflare Pages에 프론트엔드를 배포할 때는 다음 명령을 사용합니다. `VITE_API_BASE_URL`은 공개 API 주소일 뿐이며 Gemini 키를 포함하지 않습니다.

```bash
npm run pages:deploy
```

운영 환경에서는 다음과 같이 Worker Secret을 설정합니다.

```bash
npx wrangler secret put GEMINI_API_KEY --config worker/wrangler.toml
```

Cloudflare 배포 인증은 Gemini API 키와 별도입니다. 로컬 OAuth를 사용하려면 `npx wrangler login`을 실행하고, 비대화형 배포에서는 범위가 제한된 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`를 `worker/.env`에 설정합니다. 현재 `pathtutor-api` Worker와 `pathtutor-edu` Pages가 배포되어 있으며, 기본 Pages 주소와 preview 주소를 Worker CORS allowlist에 반영했습니다. Wrangler 인증 방식은 [Cloudflare 공식 문서](https://developers.cloudflare.com/workers/wrangler/commands/general/)를 참고합니다.

현재 프론트엔드에는 Gemini 키를 넣지 않습니다. Worker의 `.env`와 `.dev.vars` 파일은 `.gitignore`에 포함되어 있습니다.

`estimatedCostUsd`는 Gemini 응답의 입력 토큰과 출력 토큰(사고 토큰 포함)에 현재 설정된 단가를 곱한 유료 표준 요금 추정치입니다. 실제 청구액·무료 사용량과는 다를 수 있으므로 모델이나 요금제가 바뀌면 `GEMINI_INPUT_USD_PER_MILLION_TOKENS`와 `GEMINI_OUTPUT_USD_PER_MILLION_TOKENS`를 갱신합니다. 현재 기본값은 [Gemini API 가격표](https://ai.google.dev/gemini-api/docs/pricing)의 Gemini 3.8 Flash 표준 유료 요금 기준입니다.

## API 흐름

현재 React는 `services/clientApi.ts`를 통해 Worker HTTP API를 호출합니다.

```ts
analyzeMathSolution(
  inputText: string,
  imageFile?: File | null,
  signal?: AbortSignal,
): Promise<AnalysisResult>

generateSimilarProblem(
  originalLatex: string,
  problemDescription: string,
): Promise<string>
```

분석 요청은 다음 형태입니다.

```json
{
  "text": "문제와 학생 풀이 텍스트",
  "image": {
    "data": "base64-without-data-url-prefix",
    "mimeType": "image/jpeg"
  }
}
```

`text`와 `image` 중 하나만 보내도 되고, 둘을 함께 보낼 수도 있습니다. 현재 허용 이미지 형식은 PNG·JPEG·WEBP이며 최대 크기는 6MB입니다.

주요 반환 구조는 다음과 같습니다.

```ts
interface AnalysisResult {
  problemLatex: string;
  problemDescription: string;
  studentPath: Path;
  alternatives: Path[];
  missingPaths: {
    type: 'shortcut' | 'genius';
    reason: string;
  }[];
  feedback: {
    accuracy: number;
    conceptualUnderstanding: number;
    strategyEfficiency: number;
    summary: string;
  };
}
```

`Path.type`은 `student`, `standard`, `shortcut`, `genius` 중 하나를 사용합니다. Worker 검증에서는 `studentPath`와 `standard` 경로를 필수로 보고, 선택 경로가 생략되면 `missingPaths`에 이유를 기록합니다.

## 후속 구조 구현 상태

```text
사용자 브라우저
    ↓ POST /api/analyze
Cloudflare Worker
    ↓ Gemini Flash API
응답 JSON
    ↓ 런타임 Schema 검증
    ├─ 유효: 프론트엔드에 반환
    ├─ 경로 누락: 제한된 재요청
    └─ 복구 불가: 누락 사유 또는 명시적 오류 반환
```

현재 Worker는 `GEMINI_API_KEY`를 서버 Secret에서 읽고, `gemini-3.8-flash`를 병렬 분석 모드로 사용합니다. `pathtutor-api` 운영 Worker에서 텍스트 분석·이미지 OCR·`/api/practice` smoke test 3/3을 완료했고, 허용 Origin·preflight 계약도 테스트했습니다. Cloudflare Placement를 `gcp:asia-northeast3`로 고정해 Gemini API의 지역 제한 오류를 회피했습니다. 프론트엔드는 `https://pathtutor-edu.pages.dev`에 최신 빌드로 배포되어 있습니다. 추가 live 테스트는 비용이 발생할 수 있으므로 `npm run test:integration:live`로 명시적으로 실행해야 합니다.

```text
GEMINI_MODEL=사용 가능한 Flash 모델 ID
GEMINI_API_KEY=Cloudflare Secret
```

Cloudflare Worker에서 외부 API를 호출하고 Wrangler Secret을 사용하는 방식은 [Cloudflare Workers API 통합 문서](https://developers.cloudflare.com/workers/configuration/integrations/apis/)를 참고합니다. Gemini Flash의 입력·구조화 출력 지원 여부와 모델 ID는 구현 시 [Gemini 3.8 Flash 모델 문서](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)에서 계정과 시점에 맞게 확인합니다.

구현된 항목과 남은 작업은 [리팩토링 플랜](docs/REFACTORING_PLAN.md)에 상태별로 정리되어 있습니다.

## 확인된 한계

### 원본 프로토타입에서 확인한 출력 문제

- 네 가지 풀이 경로가 항상 모두 생성되지 않습니다.
- 모델이 문제에 적합하지 않다고 판단한 경로를 생략하거나 출력 형식을 지키지 않을 수 있습니다.
- 모델 출력만으로는 JSON 형식과 경로 개수를 보장할 수 없었습니다.

### 현재 후속 버전의 남은 검증

- Veo 3 영상 생성은 AI Studio에서 실제 동작 완료까지 검증하지 못했습니다.
- 운영 Worker의 텍스트·이미지·practice 최종 smoke test를 3/3 성공했고, 배포 후 실제 호출에서 확인된 지역 제한 문제는 Placement 고정으로 해결했습니다.
- 고정 테스트셋 기반 OCR 인식률·JSON 성공률·경로 누락률 비교는 저장된 실제 응답이 준비된 뒤 별도 평가합니다. 저장 응답 평가 도구에는 JSON 계약 성공률과 latency 평균·p50·p95·재시도율·토큰·추정 비용 집계가 구현되어 있습니다.
- 기본 Cloudflare Pages 주소와 preview wildcard는 `ALLOWED_ORIGIN`에 반영하고 실제 브라우저 health CORS를 검증했습니다. 별도 custom domain을 연결할 때만 해당 주소를 추가하면 됩니다.

### 공통 한계

- 한 번의 분석에 1~2분 이상 걸릴 수 있습니다.
- Worker 로그에 설정된 단가 기준의 Gemini 토큰·추정 비용을 기록하지만, 실제 청구액과는 다를 수 있습니다.
- Veo 3 영상 생성은 AI Studio에서 실제 동작 완료까지 검증하지 못했습니다.

## 검증 계획

동일한 테스트셋으로 다음 지표를 기록해 AI Studio 프로토타입과 후속 Worker 버전을 비교합니다. Worker에는 request ID·모델·시도 횟수·latency·usage metadata를 기록하는 최소 로그가 들어가 있습니다.

- OCR 인식률
- JSON 파싱 및 Schema 검증 성공률
- `standard` 풀이 생성 성공률
- `shortcut`·`genius` 경로 누락률과 누락 사유 비율
- 응답 시간: 평균, p50, p95
- 재요청 비율
- 입력·출력 토큰 수와 추정 비용

## 포트폴리오 표현 기준

실제 Worker 코드 구현과 운영 배포를 완료했고, 텍스트·이미지 OCR·유사 문제 생성 smoke test를 확인했습니다. 다만 고정 테스트셋 비교와 p50/p95 성능 평가 전까지는 아래와 같이 범위를 제한해 설명합니다.

> Google AI Studio에서 Gemini 기반 멀티모달 수학 풀이 분석 프로토타입을 설계하고 OCR 동작을 검증했다. 풀이 경로 누락과 긴 응답 시간 문제를 확인한 뒤, Cloudflare Workers와 Gemini Flash API 기반 후속 구조를 구현하고 텍스트·이미지 OCR·유사 문제 생성 API의 운영 smoke test를 검증했다.

실제 API 통합 테스트·성능 측정·배포까지 완료한 뒤에는 다음 문장을 사용할 수 있습니다.

> Google AI Studio에서 Gemini 기반 멀티모달 수학 풀이 분석 프로토타입을 설계하고 OCR 동작을 검증했다. 출력 경로 누락과 긴 응답 시간 문제를 확인한 뒤, Cloudflare Workers와 Gemini Flash API 기반 구조로 확장하여 구조화 응답 검증, 재시도 처리, 비용·성능 측정 체계를 설계했다.

## 디렉터리 구조

```text
.
├── App.tsx
├── components/
│   ├── AnalysisInput.tsx
│   ├── AnalysisInput.test.tsx
│   ├── AnalysisResults.tsx
│   ├── AnalysisResults.test.tsx
│   ├── LatexRenderer.tsx
│   ├── LatexRenderer.test.tsx
│   ├── MatrixGrid.tsx
│   ├── MetricsChart.tsx
│   └── ReasoningTree.tsx
├── features/
│   └── analyze/
│       ├── useAnalyzeController.ts
│       └── useAnalyzeController.test.tsx
├── services/
│   ├── clientApi.test.ts
│   └── clientApi.ts
├── shared/
│   ├── analysisSchema.ts
│   ├── analysisValidation.ts
│   ├── analysisValidation.test.ts
│   ├── prompts.ts
│   ├── usage.ts
│   └── usage.test.ts
├── fixtures/
│   ├── evaluation-cases.json
│   ├── math-solution.png
│   └── math-solution.svg
├── scripts/
│   ├── evaluate-recorded.mjs
│   └── integration-smoke.mjs
├── public/
│   └── _headers
├── index.css
├── .env.example
├── .env.production
├── worker/
│   ├── .env.example
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts
│       └── index.test.ts
├── types.ts
├── index.html
├── index.tsx
├── package.json
├── docs/
│   ├── OPERATIONS.md
│   └── REFACTORING_PLAN.md
└── vite.config.ts
```

2026-09-22 복잡한 손글씨 이미지 재현 보완: Gemini 사고 part·출력 상한·선택 시각화·병렬 전사 불일치·correction 누락 처리를 보완했습니다. 이후 한국어 혼합 LaTeX 렌더링과 유사 문제 생성 출력 상한도 보완했습니다. `npm test` 63개, `npm run typecheck`, `npm run build`, Worker dry-run을 통과했고, 최종 Worker에서 `images (1).png` 분석 HTTP 200을 확인했습니다. 최종 분석 재현은 19,486ms, 2회 호출, 14,752토큰, 추정 비용 `$0.047394`였습니다.

운영 smoke test 3/3과 Worker dry-run, Pages 재배포를 완료했습니다. 고정 테스트셋 기반 OCR 품질 비교와 실제 모바일 기기·VoiceOver/TalkBack 점검은 제품 품질 확장 단계의 후속 작업입니다.

운영 설정·Secret 교체·CORS·rate limit·데이터 보호 절차는 [운영 체크리스트](docs/OPERATIONS.md), 리팩터링 우선순위와 남은 항목은 [리팩터링 플랜](docs/REFACTORING_PLAN.md)에서 관리합니다.

## AI Studio 원본

[Google AI Studio에서 원본 앱 열기](https://ai.studio/apps/3c3e4c82-5871-45ac-9141-9eeac2049ceb)
