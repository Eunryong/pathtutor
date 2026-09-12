import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, analyzeMathSolution, generateSimilarProblem } from './clientApi';

function path(type: 'student' | 'standard') {
  return {
    name: `${type} path`,
    description: `A ${type} solution`,
    type,
    steps: [{ stepNumber: 1, latex: 'x = 1', explanation: 'Solve the equation.' }],
  };
}

function analysisResponse() {
  return {
    ok: true,
    data: {
      problemLatex: 'x + 1 = 2',
      problemDescription: 'A linear equation',
      studentPath: path('student'),
      alternatives: [path('standard')],
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
    },
    meta: { requestId: 'test-request', model: 'mock', attempts: 1, durationMs: 1 },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('client API contract', () => {
  it('rejects an empty analysis before making a network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(analyzeMathSolution('   ')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates the analysis response before returning it to the UI', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(analysisResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(analyzeMathSolution('Solve x + 1 = 2.')).resolves.toMatchObject({
      problemLatex: 'x + 1 = 2',
      alternatives: [{ type: 'standard' }],
    });
  });

  it('normalizes server errors without exposing upstream details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'internal detail should not be used',
        retryable: true,
        requestId: 'rate-limit-request',
      },
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '12',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateSimilarProblem('x + 1 = 2', 'linear equation')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
      requestId: 'rate-limit-request',
      retryAfterSeconds: 12,
      message: '요청이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
    });
  });

  it('rejects invalid practice input before making a network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateSimilarProblem('', 'linear equation')).rejects.toBeInstanceOf(ApiClientError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
