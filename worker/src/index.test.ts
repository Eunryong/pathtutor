import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const env = {
  GEMINI_API_KEY: 'test-key',
  GEMINI_MODEL: 'gemini-3.8-flash',
  GEMINI_MAX_RETRIES: '1',
  GEMINI_TIMEOUT_MS: '5000',
  GEMINI_INPUT_USD_PER_MILLION_TOKENS: '1.5',
  GEMINI_OUTPUT_USD_PER_MILLION_TOKENS: '9',
  ALLOWED_ORIGIN: 'http://localhost:3000,https://pathtutor-edu.pages.dev,https://*.pathtutor-edu.pages.dev',
  RATE_LIMIT_MAX_REQUESTS: '20',
  RATE_LIMIT_WINDOW_MS: '60000',
};

const validPngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function path(type: 'student' | 'standard' | 'shortcut' | 'genius') {
  return {
    name: `${type} path`,
    description: `A ${type} solution`,
    type,
    steps: [{ stepNumber: 1, latex: 'x = 1', explanation: 'Solve the equation.' }],
  };
}

function analysisPayload(includeStandard = true) {
  return {
    problemLatex: 'x + 1 = 2',
    problemDescription: 'A linear equation',
    studentPath: path('student'),
    alternatives: includeStandard ? [path('standard')] : [],
    missingPaths: [
      { type: 'shortcut', reason: 'No meaningful shortcut applies.' },
      { type: 'genius', reason: 'No deeper method is useful here.' },
    ],
    feedback: {
      accuracy: 80,
      conceptualUnderstanding: 75,
      strategyEfficiency: 70,
      summary: 'Good progress.',
    },
  };
}

function geminiResponse(payload: unknown): Response {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 5,
      totalTokenCount: 35,
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function analyzeRequest(extraHeaders: Record<string, string> = {}) {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      ...extraHeaders,
    },
    body: JSON.stringify({ text: 'Solve x + 1 = 2.' }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PathTutor Worker', () => {
  it('returns health status without requiring a Gemini call', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/api/health'),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      model: 'gemini-3.8-flash',
    });
  });

  it('answers a CORS preflight without requiring a Gemini call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('http://localhost/api/analyze', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, authorization',
        },
      }),
      env,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a Cloudflare Pages preview origin and reflects it safely', async () => {
    const previewOrigin = 'https://49c73d76.pathtutor-edu.pages.dev';
    const response = await worker.fetch(
      new Request('http://localhost/api/analyze', {
        method: 'OPTIONS',
        headers: {
          Origin: previewOrigin,
          'Access-Control-Request-Method': 'POST',
        },
      }),
      env,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(previewOrigin);
  });

  it('returns a validated analysis response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(analysisPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(analyzeRequest(), env);
    const body = await response.json() as { ok: boolean; meta?: { attempts: number } };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      meta: { attempts: 1, estimatedCostUsd: 0.00024 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3.8-flash:generateContent');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ 'x-goog-api-key': 'test-key' }),
    });
    const upstreamBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as {
      generationConfig: {
        responseMimeType: string;
        responseSchema: { type: string };
      };
    };
    expect(upstreamBody.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT' },
    });
  });

  it('sends an image as inline_data to the Worker upstream call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(analysisPayload()));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        text: 'Read this solution.',
        image: { data: validPngData, mimeType: 'image/png' },
      }),
    });

    const response = await worker.fetch(request, env);
    const upstreamRequest = fetchMock.mock.calls[0][1] as RequestInit;
    const upstreamBody = JSON.parse(String(upstreamRequest.body)) as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    };

    expect(response.status).toBe(200);
    expect(upstreamBody.contents[0].parts[1]).toMatchObject({
      inline_data: { data: validPngData, mime_type: 'image/png' },
    });
  });

  it('retries when the standard path is missing', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(analysisPayload(false)))
      .mockResolvedValueOnce(geminiResponse(analysisPayload(true)));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(analyzeRequest(), env);
    const body = await response.json() as { ok: boolean; meta?: { attempts: number } };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, meta: { attempts: 2 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('generates a similar problem through the protected practice endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse({ problem: '2x + 3 = 7' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('http://localhost/api/practice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          originalLatex: 'x + 1 = 2',
          problemDescription: 'A linear equation',
        }),
      }),
      env,
    );
    const body = await response.json() as { ok: boolean; problem?: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, problem: '2x + 3 = 7' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty request before calling Gemini', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env,
    );
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported image types before calling the upstream API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ image: { data: 'aGVsbG8=', mimeType: 'image/gif' } }),
      }),
      env,
    );
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(response.status).toBe(415);
    expect(body).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an image whose content does not match its declared MIME type', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('http://localhost/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ image: { data: 'aGVsbG8=', mimeType: 'image/png' } }),
      }),
      env,
    );
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(response.status).toBe(415);
    expect(body).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries a rate-limited upstream response and returns a normalized error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(analyzeRequest(), env);
    const body = await response.json() as {
      ok: boolean;
      error?: { code: string; retryable: boolean; requestId: string; upstreamStatus?: number };
    };

    expect(response.status).toBe(429);
    expect(body).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', retryable: true },
    });
    expect(body.error?.requestId).toEqual(expect.any(String));
    expect(body.error).not.toHaveProperty('upstreamStatus');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enforces the optional access token before calling the upstream API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(analyzeRequest(), {
      ...env,
      PATHTUTOR_ACCESS_TOKEN: 'staging-token',
    });
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect(body).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a request with the configured access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(analysisPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(analyzeRequest({
      Authorization: 'Bearer staging-token',
      'CF-Connecting-IP': 'authorized-client',
    }), {
      ...env,
      PATHTUTOR_ACCESS_TOKEN: 'staging-token',
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns Retry-After when the per-isolate request limit is exceeded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(analysisPayload()));
    vi.stubGlobal('fetch', fetchMock);
    const limitedEnv = {
      ...env,
      RATE_LIMIT_MAX_REQUESTS: '1',
      RATE_LIMIT_WINDOW_MS: '60000',
    };
    const requestHeaders = { 'CF-Connecting-IP': 'unique-rate-limit-client' };

    const firstResponse = await worker.fetch(analyzeRequest(requestHeaders), limitedEnv);
    const secondResponse = await worker.fetch(analyzeRequest(requestHeaders), limitedEnv);
    const body = await secondResponse.json() as { ok: boolean; error?: { code: string } };

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(secondResponse.headers.get('Retry-After')).toEqual(expect.any(String));
    expect(body).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED', retryable: true } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns INCOMPLETE_ANALYSIS after bounded retries for an incomplete JSON result', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(geminiResponse({ unexpected: true })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(analyzeRequest(), env);
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ ok: false, error: { code: 'INCOMPLETE_ANALYSIS' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps an aborted upstream request to UPSTREAM_TIMEOUT', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(analyzeRequest(), {
      ...env,
      GEMINI_MAX_RETRIES: '0',
    });
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(response.status).toBe(504);
    expect(body).toMatchObject({ ok: false, error: { code: 'UPSTREAM_TIMEOUT' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks origins that are not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/api/health', {
      headers: { Origin: 'https://untrusted.example' },
    });

    const response = await worker.fetch(request, env);
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
