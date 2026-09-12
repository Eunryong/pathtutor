import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.PATHTUTOR_BASE_URL || 'http://127.0.0.1:8787';
const workerPort = new URL(baseUrl).port || '8787';
const requestTimeoutMs = 120_000;
const liveTestRequested = process.argv.includes('--live') || process.env.PATHTUTOR_ALLOW_LIVE === '1';

if (!liveTestRequested) {
  console.log('실제 Gemini API 호출을 방지하기 위해 통합 테스트를 건너뜁니다.');
  console.log('실행이 필요한 경우 npm run test:integration:live 명령을 명시적으로 사용하세요.');
  process.exit(0);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} 옵션에는 저장할 파일 경로가 필요합니다.`);
  }
  return path.resolve(value);
}

const recordPath = optionValue('--record');

let ownedWorker;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(endpoint, body) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json();
    return {
      response,
      payload,
      localDurationMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function isWorkerReady() {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureWorker() {
  if (await isWorkerReady()) return;

  const wranglerPath = path.join(
    rootDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
  );
  ownedWorker = spawn(
    wranglerPath,
    ['dev', '--config', path.join(rootDir, 'worker/wrangler.toml'), '--port', workerPort],
    { cwd: rootDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let workerExited = false;
  ownedWorker.once('exit', () => {
    workerExited = true;
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await isWorkerReady()) return;
    if (workerExited) break;
    await sleep(300);
  }

  throw new Error('로컬 Worker를 시작하지 못했습니다. npm run worker:dev 로그를 확인해 주세요.');
}

function analysisIsValid(payload) {
  const data = payload?.data;
  return Boolean(
    payload?.ok === true
      && data?.studentPath?.type === 'student'
      && Array.isArray(data?.alternatives)
      && data.alternatives.some((path) => path?.type === 'standard')
      && Array.isArray(data?.missingPaths)
      && typeof data?.feedback?.summary === 'string',
  );
}

function practiceIsValid(payload) {
  return payload?.ok === true && typeof payload?.problem === 'string' && payload.problem.trim().length > 0;
}

function resultRow(name, result, valid) {
  const meta = result.payload?.meta || {};
  const usage = meta.usage || {};
  const outputTokenCount = typeof usage.candidatesTokenCount === 'number'
    ? usage.candidatesTokenCount + (usage.thoughtsTokenCount || 0)
    : undefined;
  return {
    case: name,
    ok: valid,
    http: result.response.status,
    durationMs: meta.durationMs ?? result.localDurationMs,
    attempts: meta.attempts ?? '-',
    inputTokens: usage.promptTokenCount ?? '-',
    outputTokens: outputTokenCount ?? '-',
    totalTokens: usage.totalTokenCount ?? '-',
    estimatedCostUsd: typeof meta.estimatedCostUsd === 'number'
      ? meta.estimatedCostUsd.toFixed(8)
      : '-',
    error: result.payload?.error?.code || '',
  };
}

async function stopOwnedWorker() {
  if (!ownedWorker || ownedWorker.exitCode !== null) return;
  ownedWorker.kill('SIGINT');
  await new Promise((resolve) => ownedWorker.once('exit', resolve));
}

async function main() {
  await ensureWorker();
  const imagePath = path.join(rootDir, 'fixtures/math-solution.png');
  const imageData = (await readFile(imagePath)).toString('base64');

  const cases = [
    {
      name: 'text-analysis',
      id: 'text-quadratic-basic',
      endpoint: '/api/analyze',
      body: { text: '이차방정식 x^2 - 5x + 6 = 0을 풀고 풀이 과정을 분석해줘.' },
      validate: analysisIsValid,
    },
    {
      name: 'image-ocr',
      id: 'image-solution-fixture',
      endpoint: '/api/analyze',
      body: {
        text: '이미지에 있는 수학 문제와 학생 풀이를 OCR로 읽고 분석해줘.',
        image: { data: imageData, mimeType: 'image/png' },
      },
      validate: analysisIsValid,
    },
    {
      name: 'practice',
      id: 'practice-quadratic-basic',
      endpoint: '/api/practice',
      body: {
        originalLatex: 'x^2 - 5x + 6 = 0',
        problemDescription: '정수근을 갖는 이차방정식의 인수분해 풀이',
      },
      validate: practiceIsValid,
    },
  ];

  const rows = [];
  const recordedCases = [];
  try {
    for (const testCase of cases) {
      const result = await requestJson(testCase.endpoint, testCase.body);
      rows.push(resultRow(testCase.name, result, testCase.validate(result.payload)));
      recordedCases.push({
        id: testCase.id,
        response: result.payload,
        durationMs: result.localDurationMs,
      });
    }
  } finally {
    await stopOwnedWorker();
  }

  console.table(rows);
  const successful = rows.filter((row) => row.ok).length;
  const totalCost = rows
    .map((row) => Number(row.estimatedCostUsd))
    .filter((value) => Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
  console.log(`성공률: ${successful}/${rows.length} (${Math.round((successful / rows.length) * 100)}%)`);
  if (totalCost > 0 || rows.some((row) => row.estimatedCostUsd !== '-')) {
    console.log(`추정 비용: $${totalCost.toFixed(8)} (Gemini 표준 유료 요금 기준)`);
  } else {
    console.log('추정 비용: 가격 환경변수가 없어 계산하지 못했습니다.');
  }

  if (recordPath) {
    await writeFile(recordPath, `${JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      baseUrl,
      cases: recordedCases,
    }, null, 2)}\n`, 'utf8');
    console.log(`오프라인 평가용 응답을 저장했습니다: ${recordPath}`);
  }

  if (successful !== rows.length) process.exitCode = 1;
}

main().catch(async (error) => {
  await stopOwnedWorker();
  console.error(error instanceof Error ? error.message : '통합 테스트에 실패했습니다.');
  process.exitCode = 1;
});
