# PathTutor-edu 리팩토링 플랜

이 문서는 Google AI Studio 프로토타입을 보존하면서, Gemini Flash와 Cloudflare Workers 기반의 후속 엔지니어링 버전으로 확장하기 위한 실행 계획입니다.

현재 저장소에는 Worker, `/api/analyze`, 런타임 Schema 검증, 재시도 로직과 Pages 프론트엔드 배포 설정이 구현되어 있습니다. `pathtutor-api` 운영 Worker에서 텍스트 분석·이미지 OCR·유사 문제 생성 smoke test를 3/3 성공했고, `pathtutor-edu.pages.dev` 최신 빌드 배포와 preview Origin CORS 연결도 완료했습니다. 운영 egress 지역 문제는 `gcp:asia-northeast3` Placement로 보완했습니다. 고정 테스트셋의 실제 응답 기록과 모바일 접근성 점검은 제품 확장 단계의 후속 작업입니다.

## 0. 현재 구현 상태

### 2026-09-11 병렬 분석 보완

동일 모델의 2분할 병렬 요청과 표시용 출력 필드 제거를 구현하고 운영 배포·실측까지 완료했습니다. 기본 2회/재시도 포함 최대 4회 모델 호출로 비용이 증가할 수 있으며, 분기별 검증·재시도·시간·usage 집계를 포함합니다. [구현·한계·복귀 설정](PARALLEL_ANALYSIS.md).

### 2026-09-10 UI 보완 현황

- 네트워크 오류·시간 초과·HTML 오류 응답 뒤 입력 보존 및 수동 재요청, 취소를 전체 앱 회귀 테스트로 검증.
- Aside 브라우저의 고정 응답으로 오류 → timeout → 성공 확인. 운영 health 200·preflight 204 확인. Gemini 실호출 없음.
- 입력·결과 axe-core 자동 검사, 오류 설명 연결·그룹 의미·터치 영역 보완. 실제 기기와 스크린리더 수동 확인은 남음.
- SUIT Variable / Pretendard Variable 자체 호스팅, 라이선스 배포물 포함.
- 자동 테스트 63개. 운영 smoke test와 UI/mock 검증을 구분.
- 자세한 확인 범위와 수동 점검 목록: [UI 구현 기록](UI_UX_IMPLEMENTATION.md).

다음 표의 운영 smoke test는 2026-09-11 최종 배포 후 실행한 결과입니다. 단일 smoke test를 고정 테스트셋 전체 평가 완료로 해석하지 않습니다. 분산 quota·비용 상한은 미구현이며 단순 IP 제한을 비용 보장으로 간주하지 않습니다.

| 영역 | 상태 | 근거 또는 남은 작업 |
| --- | --- | --- |
| Worker `/api/analyze` | 코드·로컬/운영 텍스트·이미지 smoke test 3/3·운영 배포 완료 | 저장 응답 기반 고정 평가만 남음 |
| Worker `/api/practice` | 코드·로컬/운영 smoke test·운영 배포 완료 | 저장 응답 기반 고정 평가만 남음 |
| API 키 경계 | Gemini 로컬 `.env`·Cloudflare Secret 등록·운영 배포 확인 | 운영 Secret 회전 정책 검토 필요 |
| Gemini Flash 설정 | `gemini-3.8-flash` 운영 설정·Placement·smoke test 완료 | 모델 교체 시 호환성 확인 필요 |
| 런타임 응답 검증 | 코드·단위 테스트·운영 응답 검증 | 고정 테스트셋 비교 필요 |
| `standard` 필수·누락 사유 | 코드·단위 테스트·텍스트/이미지 운영 smoke test 완료 | 고정 테스트셋에서 재확인 필요 |
| bounded retry·오류 코드 | 코드·timeout/rate-limit/잘못된 출력 mock 테스트 완료, 429는 `Retry-After` 전달 | 5xx 재시도 backoff 검토 필요 |
| 프론트 API 전환·오류 UX | Worker API 전환·Pages 최신 배포·인라인 오류·취소·파일 검증·컴포넌트/상태 분리·결과 화면 테스트 완료 | custom domain 연결 시 Origin 추가 |
| 관측성 | 토큰·추정 비용·latency 로그 및 기록 응답 평균·p50/p95 집계 구현 | 실제 고정 테스트셋 기록만 필요 |
| Veo | 핵심 흐름에서 분리 | 별도 endpoint는 아직 만들지 않음 |

## 1. 리팩토링 목표

- 브라우저에서 Gemini API 키가 노출되지 않도록 호출 경계를 Worker로 이동합니다.
- 텍스트와 이미지 입력을 하나의 분석 API 계약으로 통합합니다.
- Gemini의 구조화 출력 제약과 별도로 런타임 응답 검증을 수행합니다.
- `standard` 풀이를 필수 경로로 보장하고, `shortcut`·`genius` 생략은 이유와 함께 반환합니다.
- JSON 오류·필수 경로 누락·일시적 API 오류를 제한된 재시도로 복구합니다.
- 응답 시간·토큰 수·비용·실패율을 같은 테스트셋에서 측정합니다.
- Veo를 핵심 분석 흐름과 분리하고 실험 기능으로 관리합니다.

## 2. 현재 상태와 기술 부채

| 영역 | 현재 상태 | 리스크 |
| --- | --- | --- |
| API 호출 | `services/clientApi.ts`가 Worker API만 호출하고 Worker가 Gemini를 호출 | 인증·rate limit·남용 방어가 추가로 필요 |
| 모델 설정 | `GEMINI_MODEL` 환경 변수로 관리 | 모델 교체 시 Schema 호환성 확인 필요 |
| 응답 처리 | Gemini 구조화 출력 + Worker/클라이언트 런타임 검증 | 실제 청구·모델 변경에 대한 회귀 기준 필요 |
| 경로 생성 | `studentPath`·`standard` 필수, 선택 경로 누락 사유 반환 | 고정 평가셋 기반 품질 측정 필요 |
| 입력 | 텍스트와 PNG/JPEG/WEBP 이미지, 6MB 제한, 파일 signature 확인 | 완전한 이미지 디코딩 가능성·보존 정책 보완 필요 |
| 오류 UX | `ApiClientError`, 인라인 오류, 재시도 가능한 상태, 결과 화면·기본 접근성 테스트 | 브라우저/스크린리더 전체 접근성 점검 필요 |
| 상태 관리 | `useAnalyzeController`가 분석·practice 요청 취소와 오래된 응답 무시를 관리 | 실제 브라우저 네트워크 중단 시나리오 점검 필요 |
| 성능 | requestId·latency·token·추정 비용 로그, 기록 응답 p50/p95 집계 도구 | 실제 고정 데이터와 비동기 전환 기준 필요 |
| 테스트 | Vitest 62개 mock/계약/컴포넌트·상태 테스트, 명시적 live smoke·오프라인 평가 명령 | 실제 고정 테스트셋 확장 평가 필요 |
| Veo | 핵심 API와 학습 UI에서 제외 | 별도 endpoint·비용·권한 정책은 보류 |

## 3. 목표 아키텍처

```text
┌─────────────────────┐
│ React/Vite Frontend  │
│ text + image input   │
└──────────┬──────────┘
           │ POST /api/analyze
           ▼
┌─────────────────────┐
│ Cloudflare Worker    │
│ auth/input/timeout   │
└──────────┬──────────┘
           │ server-side API call
           ▼
┌─────────────────────┐
│ Gemini Flash API     │
│ multimodal + JSON    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ parse + validate     │
│ completeness policy  │
└───────┬───────┬─────┘
        │       │
        │       └─ bounded retry / missing reason
        ▼
  valid response → Frontend
```

Worker에서는 `GEMINI_API_KEY`를 Secret으로 읽고, 모델 ID·제한 시간·재시도 횟수 등 비밀이 아닌 설정은 환경별 변수로 관리합니다. 외부 API 호출과 Wrangler Secret의 기본 방식은 [Cloudflare Workers API 통합 문서](https://developers.cloudflare.com/workers/configuration/integrations/apis/)를 기준으로 확인합니다.

## 4. 단계별 실행 계획

### Phase 0 — 기준선 고정과 계약 정의 (P0, 부분 완료)

목적은 리팩토링 전 동작을 기록해 개선 여부를 비교할 수 있게 하는 것입니다.

- 텍스트 입력, 깨끗한 수식 이미지, 손글씨 이미지, 오류가 있는 풀이를 포함한 고정 테스트셋을 정의합니다.
- 각 입력에 대해 OCR 결과, 생성된 경로, 오류 표시, 응답 시간을 기록합니다.
- 현재 프로토타입의 한계인 경로 누락·긴 응답 시간·Veo 미검증을 README와 평가 기록에 고정합니다.
- 분석 결과 타입과 오류 코드 초안을 확정합니다.
- 모델 ID, 입력 크기, timeout, retry 정책을 코드에 하드코딩하지 않을 목록으로 분리합니다.

완료 조건:

- 같은 입력을 후속 버전에도 재사용할 수 있습니다.
- 개선 전후 비교에 사용할 지표와 기록 형식이 정해져 있습니다.

### Phase 1 — Worker 경계와 비밀키 보호 (P0, 완료)

- `worker/` 또는 별도 Worker 프로젝트를 추가합니다.
- `POST /api/analyze`가 텍스트와 이미지 입력을 받아 Gemini Flash API를 호출하도록 이동합니다.
- 브라우저에서 `@google/genai`와 `GEMINI_API_KEY`를 제거합니다.
- `wrangler secret put GEMINI_API_KEY`로 운영 Secret을 설정합니다.
- `GEMINI_MODEL`은 환경 변수로 관리하고 구현 시 실제 사용 가능한 Flash 모델 ID를 확인합니다.
- 허용 MIME 타입, 최대 요청 크기, timeout, CORS origin을 Worker에서 검사합니다.
- Worker가 Gemini 원본 오류나 비밀값을 클라이언트에 그대로 반환하지 않도록 오류를 정규화합니다.

완료 조건:

- 브라우저 번들에서 Gemini 키를 찾을 수 없습니다.
- 텍스트 입력과 이미지 입력이 `/api/analyze`를 통해 동일하게 처리됩니다.
- 키 누락·잘못된 MIME 타입·너무 큰 요청이 명시적인 오류 코드로 반환됩니다.

### Phase 2 — 프롬프트·Schema·검증 모듈화 (P0, 완료)

- system instruction, 사용자 프롬프트, JSON Schema를 별도 모듈로 분리합니다.
- Gemini의 `responseSchema`는 생성 제약으로 사용하되, 반환 이후에도 런타임 검증을 수행합니다.
- 최소 검증 규칙을 정의합니다.

```text
AnalysisResult
├─ problemLatex: non-empty string
├─ problemDescription: non-empty string
├─ studentPath: required
├─ alternatives: unique path types
│  └─ standard: required after validation
├─ missingPaths: shortcut/genius only, when omitted
└─ feedback: scores in 0..100 and summary required
```

- `Path.type` 중복을 제거하고 `student`, `standard`, `shortcut`, `genius`의 의미를 고정합니다.
- `isError === true`인 Step에는 `correction`이 있는지 검증하고, core branch에서 누락되면 검증되지 않은 correction fallback을 명시합니다.
- 행렬 시각화는 선택적 표시 데이터로 `matrixA`, `matrixB`와 결과 행렬의 차원을 검사하며, 잘못된 grid는 풀이 결과에서 제거합니다.
- 문자열 길이·step 수·중첩 배열 크기에 상한을 둬 비정상 응답을 차단합니다.
- `color`처럼 UI가 없어도 되는 모델 생성 필드는 필수 여부를 재검토합니다.

완료 조건:

- 잘못된 응답이 UI에 도달하기 전에 차단됩니다.
- 검증 실패는 필드 위치와 오류 코드를 포함하지만, 원본 이미지나 API 키는 포함하지 않습니다.

### Phase 3 — 누락 경로 정책과 제한된 재시도 (P0, 완료)

- `studentPath`와 `standard`는 필수로 정의합니다.
- `shortcut`과 `genius`가 문제에 적합하지 않으면 생성하지 않아도 되지만, 다음과 같은 누락 사유를 반환합니다.

```ts
missingPaths: [
  {
    type: 'shortcut',
    reason: '이 문제에는 유의미한 단축 풀이가 없어 생략함',
  },
];
```

- JSON 파싱 실패, Schema 검증 실패, 필수 경로 누락을 구분합니다.
- 복구 가능한 오류만 짧고 제한된 횟수로 재요청합니다.
- 재요청 프롬프트에는 누락된 필드와 검증 오류만 전달하고, 전체 프롬프트를 무한 반복하지 않습니다.
- 재시도 후에도 `standard`가 없으면 성공 응답으로 위장하지 않고 `INCOMPLETE_ANALYSIS` 오류를 반환합니다.
- 재시도 횟수와 최종 결과를 관측 로그에 기록합니다.

권장 오류 코드:

| 코드 | 의미 | 재시도 |
| --- | --- | --- |
| `INVALID_REQUEST` | 입력 없음·MIME 타입·크기 오류 | 아니오 |
| `UPSTREAM_TIMEOUT` | Gemini 응답 시간 초과 | 조건부 |
| `UPSTREAM_ERROR` | Gemini 일시 오류 | 조건부 |
| `INVALID_MODEL_OUTPUT` | JSON 또는 Schema 검증 실패 | 예 |
| `INCOMPLETE_ANALYSIS` | 제한된 재시도 뒤 필수 경로 누락 | 아니오 |
| `RATE_LIMITED` | 호출 제한 초과 | `Retry-After` 기준 |

### Phase 4 — 프론트엔드 책임 축소와 상태 분리 (P1, 1차 구현 완료)

- `App.tsx`를 입력, 분석 상태, 결과, 경로 상세, 실험 기능 단위로 분리합니다.
- Gemini SDK 호출 대신 `fetch('/api/analyze')`를 호출하는 클라이언트 API 모듈을 둡니다.
- `IDLE`, `ANALYZING`, `RESULTS`, `ERROR` 등 화면 상태와 네트워크 상태를 명시적으로 관리합니다.
- `alert` 대신 인라인 오류 메시지와 재시도 버튼을 제공합니다.
- 중복 제출 방지, 요청 취소(`AbortController`), 오래된 응답 무시를 추가합니다.
- 파일 MIME 타입·크기·이미지 미리보기를 검증합니다.
- `URL.createObjectURL`로 만든 미리보기 URL을 파일 변경·언마운트 때 해제합니다.
- 핵심 범위를 이미지·텍스트로 고정한다면 `video/*` 입력을 제거하거나 실험 기능 배지와 별도 흐름으로 분리합니다.
- 존재하지 않는 `/index.css` 참조와 CDN 의존성을 정리하고, 스타일·수식 렌더링 로딩 실패를 확인합니다.

현재 1차 구현에서는 `AnalysisInput`, `AnalysisResults`, `LatexRenderer` 컴포넌트와 `useAnalyzeController` 훅으로 화면 조합·입력 UI·결과 UI·네트워크 상태를 분리했습니다. 입력·결과 화면 테스트와 기본 접근성 계약(`role`, `aria-live`, `aria-pressed`)도 추가했습니다.

완료 조건:

- UI가 모델 SDK와 API 키를 직접 알지 않습니다.
- 분석 실패·재시도·누락 경로를 사용자가 이해할 수 있습니다.
- 입력 파일을 바꿔도 이전 미리보기 URL과 이전 요청 결과가 남지 않습니다.

### Phase 5 — 관측성과 비용·성능 측정 (P1, 집계 도구 구현 완료)

요청마다 다음 메타데이터를 기록합니다.

- `requestId`
- 모델 ID와 API 버전
- 입력 유형과 바이트 크기
- 시작·종료 시각, 총 소요 시간
- 시도 횟수와 최종 상태
- 입력·출력 토큰 수(제공되는 경우)
- 사고(thinking) 토큰 수(제공되는 경우)
- 설정된 단가 기준 요청별 추정 비용
- 오류 코드

원본 손글씨 이미지, 사용자 입력 전체, API 키는 로그에 저장하지 않습니다. 비용은 `GEMINI_INPUT_USD_PER_MILLION_TOKENS`와 `GEMINI_OUTPUT_USD_PER_MILLION_TOKENS`로 별도 설정하고, 사고 토큰을 포함한 출력 토큰 사용량과 분리해 계산합니다. 현재 Worker에는 `estimatedCostUsd`가 구현되어 있으며, `scripts/evaluate-recorded.mjs`가 저장된 응답의 평균·p50·p95 latency, 재시도율, 토큰·추정 비용을 집계합니다. 비용이 발생할 수 있는 smoke test는 `npm run test:integration:live`로 명시적으로 실행하고, 기본 `npm run test:integration`은 live 호출을 건너뜁니다.

평가 지표:

| 지표 | 측정 목적 |
| --- | --- |
| OCR 인식률 | 이미지에서 문제·풀이를 얼마나 정확히 복원하는지 확인 |
| JSON/Schema 성공률 | 구조화 응답의 안정성 확인 |
| `standard` 성공률 | 필수 풀이 경로 보장 여부 확인 |
| 선택 경로 누락률 | `shortcut`·`genius` 정책 확인 |
| p50/p95 latency | 평균값에 가려진 느린 요청 확인 |
| retry rate | 프롬프트·모델·검증 품질 확인 |
| token/cost per request | 운영 가능성 확인 |

### Phase 5.5 — 운영 보완 항목 (P1, 데모 운영 완료)

포트폴리오 데모 운영에 필요한 통제 항목은 구현·배포했습니다. 대규모 공개 서비스로 확장할 때 필요한 항목은 후속 선택사항으로 분리합니다.

1. **프론트엔드 배포와 CORS 확정**
   - Cloudflare Pages `https://pathtutor-edu.pages.dev`를 배포했습니다.
   - 개발·preview·Pages production Origin을 `ALLOWED_ORIGIN`에 등록했습니다.
   - 허용되지 않은 Origin과 `OPTIONS` preflight 동작을 계약·운영 요청으로 검증했습니다.

2. **API 남용·비용 보호**
   - 데모는 공개 접근 + isolate-local IP 분당 20회 제한 정책으로 확정했습니다.
   - 비공개 환경은 `PATHTUTOR_ACCESS_TOKEN` Secret을 선택적으로 사용할 수 있습니다.
   - 비용 추정 로그는 청구서가 아니므로, 실제 결제 프로젝트의 예산 알림과 별도로 관리합니다.

3. **환경·Secret 운영**
   - local `.env`와 production Cloudflare Secret을 분리했고, Pages에는 API 키를 넣지 않습니다.
   - Gemini Secret 교체 절차와 롤백 절차를 문서화합니다.
   - 배포 로그·CI 출력에 API 키와 요청 원문이 남지 않는지 점검합니다.

4. **데이터 보호와 입력 방어**
   - 이미지·입력 텍스트는 코드에서 저장하지 않는 정책으로 확정했습니다.
   - MIME 타입뿐 아니라 PNG/JPEG/WEBP 파일 시그니처를 확인하도록 구현했습니다. 완전한 이미지 디코딩 가능성 검사는 별도 보완 항목입니다.
   - 로그에는 원본 텍스트·이미지·모델 원문을 저장하지 않는 원칙을 유지합니다.

5. **품질·회귀 기준**
   - 프론트엔드 입력·결과·오류·파일 동작을 컴포넌트 테스트로 고정하고, 실제 Pages 브라우저 렌더링·health CORS를 확인했습니다.
   - 실제 API 평가가 필요한 고정 테스트셋은 별도 승인된 평가 작업으로 분리합니다.
   - `npm run test:integration`은 live 호출을 하지 않도록 보호하고, 비용이 발생하는 검증은 `npm run test:integration:live`로만 실행합니다.

완료 조건:

- 운영 Origin과 인증/rate limit 정책이 문서와 설정에 일치합니다.
- Secret 교체와 비용 초과 대응 절차를 재현할 수 있습니다.
- 이미지 보존·삭제 정책과 로그 비식별화 범위가 정해져 있습니다.
- 외부 API 없이 실행하는 회귀 테스트가 기본 검증 경로입니다.

### Phase 6 — 비동기 처리 검토 (P1/P2, 현재 동기 운영)

현재 데모는 동기 API로 운영합니다. 실제 live latency 기록은 이전 지시대로 추가하지 않았으므로 비동기 전환을 임의로 확정하지 않고, 기록 데이터가 누적되어 timeout 기준을 넘을 때만 아래 구조를 도입합니다.

```text
POST /api/jobs          → { jobId }
GET  /api/jobs/:jobId   → queued | running | completed | failed
```

작업 상태 저장소와 만료 정책을 정하고, 중복 작업·재시도·페이지 이탈을 처리합니다. 단순한 동기 요청을 먼저 안정화한 뒤 도입해 운영 복잡도를 통제합니다.

### Phase 7 — Veo 분리와 배포 검증 (P2, 핵심 흐름 분리)

- Veo 호출을 `video` 실험 모듈 또는 별도 `/api/video` 엔드포인트로 이동합니다.
- 분석 결과가 없어도 호출되지 않도록 핵심 흐름과 분리합니다.
- 영상 생성 완료까지 실제 검증되지 않은 상태에서는 UI에 실험 기능임을 표시합니다.
- 현재처럼 URI에 API 키를 붙여 브라우저로 반환하는 방식은 후속 버전에 그대로 이식하지 않습니다.
- staging에서 텍스트·이미지·실패·재시도·키 누락 시나리오를 검증한 뒤 운영에 배포합니다.

## 5. 권장 파일 구조

현재 구현은 아래 구조를 기준으로 유지하고, Worker가 커질 때만 route/client 모듈을 추가로 분리합니다.

```text
.
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
├── scripts/
│   ├── evaluate-recorded.mjs
│   └── integration-smoke.mjs
├── fixtures/
│   ├── evaluation-cases.json
│   ├── math-solution.png
│   └── math-solution.svg
├── public/
│   └── _headers
├── index.css
├── worker/
│   └── src/
│       ├── index.ts
│       └── index.test.ts
└── docs/
    ├── OPERATIONS.md
    └── REFACTORING_PLAN.md
```

Worker와 프론트엔드가 같은 응답 계약을 사용해야 하므로, `AnalysisResult`와 오류 타입은 공유 모듈에서 관리합니다. 단, 브라우저 번들에 Gemini SDK나 Secret 관련 코드가 들어가지 않도록 의존성 경계를 확인합니다.

## 6. 테스트 계획

현재 `npm test` 63개, `typecheck`, 프론트엔드 `build`, Wrangler Worker `dry-run`은 통과했습니다. 운영 `pathtutor-api`에서 fixture 이미지를 포함한 텍스트·이미지·practice smoke test가 3/3 성공했고, 복잡한 손글씨 이미지도 최종 Worker에서 HTTP 200으로 확인했습니다. CORS preflight는 mock·운영 요청으로 검증했습니다. 프론트엔드는 `pathtutor-edu.pages.dev`에 최신 빌드로 배포했습니다. 고정 테스트셋 응답 기록과 모바일 접근성 점검은 별도 후속 작업입니다.

### 단위 테스트

- 분석 응답 Schema 검증
- metric 범위 및 필수 문자열 검사
- path 타입 중복·누락 검사
- `missingPaths` 규칙
- matrix visualization 차원 검사
- 오류 코드 정규화

### Worker 계약 테스트

- 정상 텍스트 요청
- 정상 이미지 요청
- 빈 입력·허용하지 않은 MIME 타입·크기 초과
- 잘못된 Gemini JSON
- `standard` 누락 후 재시도
- 재시도 후 `INCOMPLETE_ANALYSIS`
- upstream timeout·rate limit

### 프론트엔드 테스트

- 입력 상태와 제출 비활성화
- 로딩·성공·실패·재시도 화면
- 반환된 경로 선택
- 누락 사유 표시
- 파일 교체 시 미리보기 정리

### 회귀 평가

고정 테스트셋을 AI Studio 원본과 후속 버전에 모두 통과시켜 OCR·구조화 응답·경로 완성도·응답 시간·토큰 비용을 비교합니다.

## 7. 우선순위와 완료 정의

### P0 — 운영 경계와 결과 신뢰성

- Worker `/api/analyze` 동작
- 브라우저 번들에서 API 키 제거
- Gemini Flash 모델 환경 설정
- 런타임 Schema 검증
- `standard` 필수 및 누락 경로 사유
- 제한된 재시도와 명시적 오류

### P1 — 사용성·측정·회귀 방지

- 프론트엔드 상태 분리
- 인라인 오류·재시도 UX
- 파일 검증과 Object URL 정리
- requestId·latency·usage·error 로그
- Schema/Worker/mock 테스트
- 동일 테스트셋 비교 리포트
- 프론트엔드 컴포넌트 테스트와 접근성 점검
- 프론트 배포 주소·CORS 환경 분리(기본 Pages 환경 완료)
- rate limit·동시 요청·비용 상한 정책(데모 정책 완료, 분산 quota는 규모 확장 시)
- 이미지 보존·삭제 및 로그 비식별화 정책(저장하지 않음으로 확정)

### P2 — 확장 기능

- 비동기 작업·상태 조회
- Veo 별도 실험 모듈
- staging/production 환경 분리
- 비용 최적화와 캐싱 검토

후속 버전의 최소 완료 조건은 다음과 같습니다.

- 이미지와 텍스트가 같은 `/api/analyze` 계약으로 처리됩니다.
- 유효하지 않은 응답이 프론트엔드에 그대로 전달되지 않습니다.
- `standard`가 없으면 성공으로 표시되지 않습니다.
- `shortcut`·`genius` 생략 시 이유가 반환됩니다.
- 응답 시간·토큰·비용·실패율을 측정할 수 있습니다.
- Veo는 핵심 분석 기능과 분리된 실험 기능으로 표시됩니다.
- 위 조건을 실제로 구현·검증한 이후에만 이력서의 구현 완료형 문장을 사용합니다.

## 8. 실행 결과와 후속 선택사항

1. `worker/.env`와 Cloudflare Secret 설정, `/api/health`, 운영 Worker 배포를 확인했습니다.
2. fixture 이미지를 포함한 운영 smoke test 3/3 성공을 기준선으로 기록했습니다.
3. `App.tsx`의 입력·결과 UI와 분석 상태 흐름을 컴포넌트/훅으로 분리했습니다.
4. 실제 Gemini 호출 없이 Schema/Worker mock 테스트에 timeout·rate-limit·잘못된 출력 시나리오를 확장했습니다.
5. 클라이언트 API·입력 UI·결과 화면·practice 취소 계약 테스트와 기본 접근성 속성을 추가했습니다.
6. CDN 의존성을 제거하고 Tailwind·KaTeX를 로컬 번들로 전환했습니다.
7. Cloudflare Pages `pathtutor-edu.pages.dev`를 배포하고 Worker CORS·보안 헤더·브라우저 health 연결을 검증했습니다.
8. `integration-smoke`에 승인된 live 응답 기록(`--record`) 경로와 `evaluate-recorded`의 평균·p50·p95·재시도·비용 집계를 추가했고, 운영 최종 smoke 응답을 생성했습니다.
9. 현재 데모는 동기 API와 isolate-local rate limit 정책으로 운영합니다. 실제 latency 데이터가 누적되거나 사용자 quota가 필요해질 때만 분산 rate limit·비동기 job을 추가합니다.
