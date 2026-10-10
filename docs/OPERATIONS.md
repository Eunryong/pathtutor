# PathTutor-edu 운영 체크리스트

이 문서는 현재 배포된 `pathtutor-api` Worker를 안전하게 관리하기 위한 최소 운영 절차입니다. 실제 Gemini 호출은 비용이 발생할 수 있으므로, 운영 점검과 모델 평가를 분리합니다.

## 현재 배포

- Worker: `pathtutor-api`
- URL: `https://pathtutor-api.pathtutor.workers.dev`
- 상태 확인: `GET /api/health`
- 프론트엔드: `https://pathtutor-edu.pages.dev`
- custom domain: `https://pathtutor.eunryong.com`, `https://pathtutor.eunryong.win` (HTTP 200, CSP 확인)
- Pages preview: `https://2b6f4e6a.pathtutor-edu.pages.dev`
- Pages 프로젝트: `pathtutor-edu`
- 최신 Worker 버전: `2cbb3753-69fd-4db4-b8d0-0dedb9d9fda3`
- Placement: `gcp:asia-northeast3` (Gemini API egress 지역 고정)

기본 Pages 주소, preview 주소와 `https://pathtutor.eunryong.com`, `https://pathtutor.eunryong.win`은 `worker/wrangler.toml`의 `ALLOWED_ORIGIN`에 반영되어 있습니다. custom domain DNS가 활성화되어 해당 주소에서 Worker API를 호출할 수 있습니다.

custom domain DNS 레코드:

```text
Type: CNAME
Name: pathtutor
Target: pathtutor-edu.pages.dev
TTL: Auto
```

## 환경변수와 Secret

비밀값과 일반 설정을 분리합니다.

| 이름 | 저장 위치 | 용도 |
| --- | --- | --- |
| `GEMINI_API_KEY` | Wrangler Secret / 로컬 `worker/.env` | Gemini 호출 인증 |
| `PATHTUTOR_ACCESS_TOKEN` | Wrangler Secret | 설정한 경우 API Bearer 인증 |
| `GEMINI_MODEL` | Wrangler 변수 | 모델 ID |
| `GEMINI_MAX_OUTPUT_TOKENS` | Wrangler 변수 | 분석 branch 출력 상한 |
| `GEMINI_PRACTICE_MAX_OUTPUT_TOKENS` | Wrangler 변수 | 유사 문제 생성 출력 상한. 기본 배포값 `4096` |
| `ALLOWED_ORIGIN` | Wrangler 변수 | 브라우저 Origin allowlist |
| `RATE_LIMIT_MAX_REQUESTS` | Wrangler 변수 | isolate 단위 요청 상한 |
| `RATE_LIMIT_WINDOW_MS` | Wrangler 변수 | 요청 상한 시간 창 |

Secret 등록·교체:

```bash
npx wrangler secret put GEMINI_API_KEY --config worker/wrangler.toml
npx wrangler secret put PATHTUTOR_ACCESS_TOKEN --config worker/wrangler.toml
```

`PATHTUTOR_ACCESS_TOKEN`을 설정하면 모든 분석·practice POST 요청에 다음 헤더가 필요합니다.

```text
Authorization: Bearer <token>
```

현재 프론트엔드 번들에는 이 토큰을 넣지 않습니다. 공개 브라우저 앱에 토큰을 직접 포함하면 보호 효과가 없으므로, 인증을 활성화하기 전에는 사용자 인증 또는 별도 세션 발급 방식을 결정해야 합니다.

## 요청 제한

Worker에는 기본값으로 IP 기준 분당 20회인 isolate-local best-effort 제한이 있습니다. 이 제한은 Worker 인스턴스 간에 공유되지 않으므로 공개 서비스의 최종 보호 장치가 아닙니다.

현재 포트폴리오 데모 정책은 별도 로그인 없이 제공하되, IP 기준 isolate-local 분당 20회 제한과 입력 크기 제한을 적용하는 것입니다. `PATHTUTOR_ACCESS_TOKEN`은 비공개 staging/운영 점검용 선택 보호 수단으로 남겨 둡니다. 공개 서비스 규모가 커지면 Cloudflare Rate Limiting 또는 사용자 인증 기반 quota를 추가합니다.

- 사용자/IP별 일일 분석 상한
- 동시 분석 수
- 이미지 최대 크기와 허용 MIME/signature
- 예산 초과 시 차단 기준
- `Retry-After`를 따른 클라이언트 재요청 정책

## CORS 갱신

프론트엔드 도메인이 정해지면 예를 들어 다음처럼 allowlist를 갱신합니다.

```toml
ALLOWED_ORIGIN = "http://localhost:3000,https://<frontend-domain>"
```

그 뒤 배포 전 dry-run과 mock 계약 테스트를 실행합니다.

```bash
npm run worker:deploy -- --dry-run
npm test
npm run typecheck
npm run build
```

운영 도메인에서 실제 브라우저 호출을 검증할 때는 CORS만 확인하는 요청과 비용이 발생하는 모델 호출을 구분합니다. 모델 호출 검증은 명시적으로 승인된 경우에만 `npm run test:integration:live`를 사용합니다.

## 데이터 보호

- 이미지와 입력 텍스트를 Worker 저장소에 저장하지 않습니다.
- 구조화된 모델 원문과 손글씨 원본을 로그에 기록하지 않습니다.
- 로그에는 request ID, 상태 코드, latency, 토큰 메타데이터와 추정 비용만 남깁니다.
- 현재 코드에는 이미지·입력 텍스트 저장 기능이 없으며, 요청 처리 후 보존하지 않는 것을 기본 정책으로 합니다. 공개 서비스로 확장할 때 Cloudflare 로그 보존 기간과 개인정보 처리 고지를 별도로 확정합니다.
- MIME 타입 검증만으로 충분하지 않으므로 Worker에서 PNG/JPEG/WEBP signature도 확인합니다.

## 비용과 평가

`estimatedCostUsd`는 설정된 토큰 단가를 이용한 추정치이며 실제 청구서가 아닙니다. 모델·요금제·무료 할당량이 바뀌면 설정값을 갱신하고, 실제 결제 프로젝트의 예산 알림은 별도로 설정합니다.

기본 회귀 명령은 외부 API를 호출하지 않습니다.

```bash
npm test
npm run typecheck
npm run build
npm run test:integration
npm run evaluate:cases
```

고정 평가 결과를 별도 JSON으로 저장한 경우에만 오프라인 평가를 실행합니다.

```bash
npm run evaluate:cases -- path/to/recorded-results.json
```

운영 smoke 결과를 평가 파일로 남겨야 하는 경우에만, 별도 승인 후 다음처럼 기록합니다. `--record`는 응답 JSON과 latency를 파일에 저장하며, 실 Gemini 호출과 비용이 발생할 수 있습니다.

```bash
npm run test:integration:live -- --record fixtures/recorded-results.json
npm run evaluate:cases -- fixtures/recorded-results.json
```

오프라인 평가 명령은 케이스별 JSON 계약 성공 여부와 함께 기록된 E2E/Worker latency의 평균·p50·p95, 재시도율, 토큰 수, 설정 단가 기준 추정 비용을 출력합니다. 실제 응답 기록이 없으면 매니페스트만 확인하고 성공 종료합니다.

`npm run test:integration:live`는 운영 품질 평가가 아니라 비용이 발생할 수 있는 smoke test입니다. CI 기본 단계에 포함하지 않습니다.

## 현재 범위 밖의 후속 선택사항

현재 데모 배포와 기본 운영 정책은 완료했으며, 운영 smoke test 3/3과 Pages 최신 빌드 배포도 완료했습니다. 다음은 규모 확장 또는 제품 정책이 바뀔 때 선택하는 후속 항목입니다.

1. custom frontend domain 연결
2. 로그인·사용자별 quota가 필요한 공개 서비스 전환
3. 분산 rate limit 또는 Durable Objects 도입
4. 별도 staging Worker와 Secret 분리
5. 실제 latency 데이터가 누적된 뒤 비동기 작업·상태 조회 도입
