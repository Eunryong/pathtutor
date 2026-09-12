import { afterEach, expect, it, vi } from 'vitest';
import worker from './index';
import { branchSchemas, validateBranch, mergeBranches } from '../../shared/parallelAnalysis';

const env = {
  GEMINI_API_KEY: 'mock-key', GEMINI_MODEL: 'unchanged-model',
  GEMINI_ANALYSIS_MODE: 'parallel', GEMINI_MAX_RETRIES: '1',
  RATE_LIMIT_MAX_REQUESTS: '0',
};
const path = { description: '등식의 성질', steps: [{ latex: 'x=1', explanation: '양변에서 1을 뺍니다.' }] };
const core = {
  problemLatex: 'x+1=2', problemDescription: '일차방정식',
  student: path, standard: path,
  feedback: { accuracy: 100, conceptualUnderstanding: 100, strategyEfficiency: 100, summary: '확인' },
};
const extensions = {
  problemLatex: 'x+1=2', shortcut: path,
  missingPaths: [{ type: 'genius', reason: '별도의 심화 방법이 필요하지 않습니다.' }],
};
function response(payload: unknown, usage = true) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    ...(usage ? { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 5, totalTokenCount: 35 } } : {}),
  }));
}
function request() {
  return new Request('https://local/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x+1=2' }) });
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('starts both requests before either completes, preserves model settings, and merges', async () => {
  const pending: Array<(r: Response) => void> = [];
  const fetchMock = vi.fn((_url, _options) => new Promise<Response>(resolve => pending.push(resolve)));
  vi.stubGlobal('fetch', fetchMock);
  const result = worker.fetch(request(), env);
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  for (const [url, options] of fetchMock.mock.calls) {
    expect(url).toContain('unchanged-model:generateContent');
    const config = JSON.parse(options.body).generationConfig;
    expect(config).not.toHaveProperty('thinkingConfig');
    expect(config).not.toHaveProperty('serviceTier');
    expect(config.maxOutputTokens).toBe(8192);
  }
  pending[1](response(extensions));
  pending[0](response(core));
  const payload = await (await result).json() as any;
  expect(payload.ok).toBe(true);
  expect(payload.data.studentPath.name).toBe('내 풀이');
  expect(payload.data.studentPath.steps[0].stepNumber).toBe(1);
  expect(payload.data.alternatives.map((p: any) => p.type)).toEqual(['standard', 'shortcut']);
  expect(payload.data.missingPaths[0].type).toBe('genius');
  expect(payload.meta).toMatchObject({ modelCalls: 2, attempts: 1, usage: { totalTokenCount: 70, promptTokenCount: 20, candidatesTokenCount: 40, thoughtsTokenCount: 10 } });
  expect(payload.meta.branches).toHaveLength(2);
});

it('retries only the invalid branch and sums usage from the rejected attempt', async () => {
  let coreCalls = 0;
  let extensionCalls = 0;
  vi.stubGlobal('fetch', vi.fn((_url, options) => {
    const schema = JSON.parse(options.body).generationConfig.responseSchema;
    if (schema.properties.student) { coreCalls++; return Promise.resolve(response(core)); }
    extensionCalls++;
    return Promise.resolve(response(extensionCalls === 1 ? { ...extensions, missingPaths: [] } : extensions));
  }));
  const payload = await (await worker.fetch(request(), env)).json() as any;
  expect(payload.ok).toBe(true);
  expect([coreCalls, extensionCalls]).toEqual([1, 2]);
  expect(payload.meta).toMatchObject({ modelCalls: 3, attempts: 2, usage: { totalTokenCount: 105 } });
});

it('does not disguise a failed extensions request as mathematically unavailable paths', async () => {
  vi.stubGlobal('fetch', vi.fn((_url, options) => {
    const schema = JSON.parse(options.body).generationConfig.responseSchema;
    return Promise.resolve(schema.properties.student ? response(core) : new Response('{}', { status: 429 }));
  }));
  const result = await worker.fetch(request(), env);
  expect(result.status).toBe(429);
  expect(await result.json()).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
});

it('rejects different transcriptions instead of silently merging them', async () => {
  vi.stubGlobal('fetch', vi.fn((_url, options) => {
    const schema = JSON.parse(options.body).generationConfig.responseSchema;
    return Promise.resolve(response(schema.properties.student ? core : { ...extensions, problemLatex: 'x+1=3' }));
  }));
  expect(await (await worker.fetch(request(), env)).json()).toMatchObject({ ok: false, error: { code: 'INVALID_MODEL_OUTPUT' } });
});

it('omits cost totals when a branch provides no usage metadata', async () => {
  vi.stubGlobal('fetch', vi.fn((_url, options) => {
    const isCore = !!JSON.parse(options.body).generationConfig.responseSchema.properties.student;
    return Promise.resolve(response(isCore ? core : extensions, isCore));
  }));
  const payload = await (await worker.fetch(request(), env)).json() as any;
  expect(payload.ok).toBe(true);
  expect(payload.meta).not.toHaveProperty('usage');
  expect(payload.meta).not.toHaveProperty('estimatedCostUsd');
});

it('removes only deterministic display fields, preserves explanations and fills omitted optional-path reasons', () => {
  const schema = branchSchemas.core.properties.student;
  expect(schema.properties).not.toHaveProperty('name');
  expect(schema.properties).not.toHaveProperty('type');
  expect(schema.properties.steps.items.properties).not.toHaveProperty('stepNumber');
  expect(schema.properties.steps.items.properties).toHaveProperty('correction');
  expect(() => validateBranch('extensions', { ...extensions, missingPaths: [] })).toThrow();
  const extensionWithFallback = validateBranch('extensions', { ...extensions, missingPaths: [] }, true);
  expect(extensionWithFallback.missingPaths).toEqual([
    { type: 'genius', reason: expect.stringContaining('validated standard path') },
  ]);
  expect(() => validateBranch('core', { ...core, standard: undefined })).toThrow();
  const merged = mergeBranches(validateBranch('core', core), validateBranch('extensions', extensions));
  expect(JSON.stringify(merged)).not.toContain('validation only');
  expect(merged.studentPath.steps[0].explanation).toBe(path.steps[0].explanation);
});

it('supplies the same image to both branches without an OCR pre-call', async () => {
  const image = { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' };
  const seen: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn((_url, options) => {
    const body = JSON.parse(options.body);
    seen.push(body.contents[0].parts[1]);
    return Promise.resolve(response(body.generationConfig.responseSchema.properties.student ? core : extensions));
  }));
  const req = new Request('https://local/api/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'x+1=2', image }),
  });
  expect((await worker.fetch(req, env)).status).toBe(200);
  expect(seen).toEqual([
    { inline_data: { mime_type: image.mimeType, data: image.data } },
    { inline_data: { mime_type: image.mimeType, data: image.data } },
  ]);
});
