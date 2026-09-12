import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(rootDir, 'fixtures', 'evaluation-cases.json');
const recordedPath = process.argv[2] ? path.resolve(process.argv[2]) : null;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function percentile(values, quantile) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function formatMetric(value, digits = 0) {
  return isFiniteNumber(value) ? value.toFixed(digits) : '-';
}

function hasPath(data, type) {
  return data?.studentPath?.type === type
    || (Array.isArray(data?.alternatives) && data.alternatives.some((path) => path?.type === type));
}

function hasMissingReason(data, type) {
  return Array.isArray(data?.missingPaths)
    && data.missingPaths.some((missingPath) => missingPath?.type === type && typeof missingPath.reason === 'string' && missingPath.reason.trim());
}

function evaluateCase(testCase, response) {
  if (!isObject(response)) return { ok: false, reason: '응답 JSON이 object가 아님' };

  if (testCase.kind === 'practice') {
    const valid = response.ok === true
      && typeof response.problem === 'string'
      && response.problem.trim().length > 0;
    return { ok: valid, reason: valid ? '' : 'problem이 비어 있거나 성공 응답이 아님' };
  }

  const data = response.data;
  if (response.ok !== true || !isObject(data)) {
    return { ok: false, reason: '분석 성공 응답 또는 data가 없음' };
  }

  const requiredPaths = testCase.expect?.requiredPaths || [];
  const requiredOk = requiredPaths.every((type) => hasPath(data, type));
  const optionalPaths = testCase.expect?.optionalPaths || [];
  const optionalOk = optionalPaths.every((type) => hasPath(data, type) || hasMissingReason(data, type));
  const valid = requiredOk && optionalOk;
  return {
    ok: valid,
    reason: valid ? '' : '필수 경로 또는 선택 경로의 누락 사유가 없음',
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

const manifest = await readJson(manifestPath);
if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
  throw new Error('evaluation-cases.json에 평가 케이스가 없습니다.');
}

if (!recordedPath) {
  console.log(`평가 케이스 ${manifest.cases.length}개를 확인했습니다.`);
  console.log('저장된 응답 파일이 없어 목록만 확인했습니다. 실제 API 호출은 수행하지 않았습니다.');
  console.log('사용법: npm run evaluate:cases -- path/to/recorded-results.json');
  process.exit(0);
}

const recorded = await readJson(recordedPath);
const recordedCases = new Map(
  (Array.isArray(recorded.cases) ? recorded.cases : [])
    .filter((entry) => isObject(entry) && typeof entry.id === 'string')
    .map((entry) => [entry.id, entry]),
);

const rows = manifest.cases.map((testCase) => {
  const recordedCase = recordedCases.get(testCase.id);
  const response = recordedCase?.response;
  const meta = isObject(response?.meta) ? response.meta : {};
  const usage = isObject(meta.usage) ? meta.usage : {};
  const result = evaluateCase(testCase, response);
  return {
    id: testCase.id,
    kind: testCase.kind,
    recorded: recordedCase !== undefined,
    ok: result.ok,
    reason: recordedCase === undefined ? '저장된 응답이 없음' : result.reason,
    durationMs: isFiniteNumber(recordedCase?.durationMs)
      ? recordedCase.durationMs
      : (isFiniteNumber(meta.durationMs) ? meta.durationMs : undefined),
    workerDurationMs: isFiniteNumber(meta.durationMs) ? meta.durationMs : undefined,
    attempts: isFiniteNumber(meta.attempts) ? meta.attempts : undefined,
    totalTokenCount: isFiniteNumber(usage.totalTokenCount) ? usage.totalTokenCount : undefined,
    estimatedCostUsd: isFiniteNumber(meta.estimatedCostUsd) ? meta.estimatedCostUsd : undefined,
  };
});

console.table(rows.map(({ id, kind, recorded, ok, reason, durationMs, workerDurationMs, attempts, totalTokenCount, estimatedCostUsd }) => ({
  id,
  kind,
  recorded,
  ok,
  reason,
  durationMs: formatMetric(durationMs),
  workerDurationMs: formatMetric(workerDurationMs),
  attempts: formatMetric(attempts),
  totalTokenCount: formatMetric(totalTokenCount),
  estimatedCostUsd: formatMetric(estimatedCostUsd, 8),
})));
const passed = rows.filter((row) => row.ok).length;
console.log(`오프라인 평가: ${passed}/${rows.length} (${Math.round((passed / rows.length) * 100)}%)`);

const analysisRows = rows.filter((row) => row.kind === 'analyze');
const analysisPassed = analysisRows.filter((row) => row.ok).length;
if (analysisRows.length > 0) {
  console.log(`분석 계약 성공률: ${analysisPassed}/${analysisRows.length} (${Math.round((analysisPassed / analysisRows.length) * 100)}%)`);
}

const endToEndLatencies = rows.filter((row) => isFiniteNumber(row.durationMs)).map((row) => row.durationMs);
const workerLatencies = rows.filter((row) => isFiniteNumber(row.workerDurationMs)).map((row) => row.workerDurationMs);
if (endToEndLatencies.length > 0) {
  console.log(
    `E2E latency(ms): 평균 ${formatMetric(endToEndLatencies.reduce((sum, value) => sum + value, 0) / endToEndLatencies.length)} / `
      + `p50 ${formatMetric(percentile(endToEndLatencies, 0.5))} / p95 ${formatMetric(percentile(endToEndLatencies, 0.95))}`,
  );
}
if (workerLatencies.length > 0) {
  console.log(
    `Worker latency(ms): 평균 ${formatMetric(workerLatencies.reduce((sum, value) => sum + value, 0) / workerLatencies.length)} / `
      + `p50 ${formatMetric(percentile(workerLatencies, 0.5))} / p95 ${formatMetric(percentile(workerLatencies, 0.95))}`,
  );
}

const retryRows = rows.filter((row) => isFiniteNumber(row.attempts));
if (retryRows.length > 0) {
  const retried = retryRows.filter((row) => row.attempts > 1).length;
  console.log(`재시도율: ${retried}/${retryRows.length} (${Math.round((retried / retryRows.length) * 100)}%)`);
}

const tokenRows = rows.filter((row) => isFiniteNumber(row.totalTokenCount));
if (tokenRows.length > 0) {
  const averageTokens = tokenRows.reduce((sum, row) => sum + row.totalTokenCount, 0) / tokenRows.length;
  console.log(`평균 total tokens: ${formatMetric(averageTokens)}`);
}

const costRows = rows.filter((row) => isFiniteNumber(row.estimatedCostUsd));
if (costRows.length > 0) {
  const totalCost = costRows.reduce((sum, row) => sum + row.estimatedCostUsd, 0);
  const averageCost = totalCost / costRows.length;
  console.log(`추정 비용: 총 $${totalCost.toFixed(8)} / 요청당 평균 $${averageCost.toFixed(8)}`);
}

if (passed !== rows.length) process.exitCode = 1;
