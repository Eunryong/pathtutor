import {
  AnalysisValidationError,
  validateAnalysisResult,
} from '../shared/analysisValidation';
import type {
  AnalysisResult,
  ApiErrorCode,
  ApiErrorResponse,
  AnalyzeSuccessResponse,
  PracticeSuccessResponse,
} from '../types';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_TEXT_LENGTH = 12_000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_REQUEST: '입력값을 확인해 주세요.',
  UNAUTHORIZED: '인증이 필요합니다.',
  CONFIGURATION_ERROR: '분석 서버 설정이 아직 완료되지 않았습니다.',
  UPSTREAM_TIMEOUT: '분석 시간이 너무 오래 걸렸습니다. 잠시 후 다시 시도해 주세요.',
  UPSTREAM_ERROR: '분석 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  INVALID_MODEL_OUTPUT: 'AI가 안정적인 풀이 형식을 만들지 못했습니다. 다시 시도해 주세요.',
  INCOMPLETE_ANALYSIS: '표준 풀이를 생성하지 못했습니다. 다른 입력으로 다시 시도해 주세요.',
  RATE_LIMITED: '요청이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
};

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ApiErrorCode,
    message?: string,
    retryable = false,
    requestId?: string,
    retryAfterSeconds?: number,
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'ApiClientError';
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, value);
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new ApiClientError('UPSTREAM_TIMEOUT', '요청이 취소되었습니다.', true);
    }
    throw new ApiClientError('UPSTREAM_ERROR', ERROR_MESSAGES.UPSTREAM_ERROR, true);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      response.status >= 500 ? 'UPSTREAM_ERROR' : 'INVALID_MODEL_OUTPUT',
      undefined,
      response.status >= 500,
    );
  }

  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    const errorPayload = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
    const code = isApiErrorCode(errorPayload?.code) ? errorPayload.code : (
      response.status === 429 ? 'RATE_LIMITED' :
      response.status >= 500 ? 'UPSTREAM_ERROR' : 'INVALID_REQUEST'
    );
    const retryable = typeof errorPayload?.retryable === 'boolean'
      ? errorPayload.retryable
      : response.status === 429 || response.status >= 500;
    const requestId = typeof errorPayload?.requestId === 'string' ? errorPayload.requestId : undefined;
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader && /^\d+$/.test(retryAfterHeader)
      ? Number(retryAfterHeader)
      : undefined;
    throw new ApiClientError(code, ERROR_MESSAGES[code], retryable, requestId, retryAfterSeconds);
  }

  return payload as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const separator = result.indexOf(',');
      if (separator < 0) {
        reject(new ApiClientError('INVALID_REQUEST', '이미지 파일을 읽을 수 없습니다.'));
        return;
      }
      resolve(result.slice(separator + 1));
    };
    reader.onerror = () => reject(new ApiClientError('INVALID_REQUEST', '이미지 파일을 읽을 수 없습니다.'));
    reader.onabort = () => reject(new ApiClientError('UPSTREAM_TIMEOUT', '파일 읽기가 취소되었습니다.', true));
    reader.readAsDataURL(file);
  });
}

function validateText(text: string, field: string): string {
  const normalized = text.trim();
  if (!normalized) throw new ApiClientError('INVALID_REQUEST', `${field}을(를) 입력해 주세요.`);
  if (normalized.length > MAX_TEXT_LENGTH) {
    throw new ApiClientError('INVALID_REQUEST', `${field}은 ${MAX_TEXT_LENGTH.toLocaleString()}자 이내로 입력해 주세요.`);
  }
  return normalized;
}

export async function analyzeMathSolution(
  inputText: string,
  imageFile?: File | null,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const text = inputText.trim();
  if (!text && !imageFile) {
    throw new ApiClientError('INVALID_REQUEST', '문제 또는 풀이를 입력하거나 이미지를 첨부해 주세요.');
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new ApiClientError('INVALID_REQUEST', `텍스트는 ${MAX_TEXT_LENGTH.toLocaleString()}자 이내로 입력해 주세요.`);
  }

  const body: {
    text?: string;
    image?: { data: string; mimeType: string };
  } = {};
  if (text) body.text = text;

  if (imageFile) {
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
      throw new ApiClientError('INVALID_REQUEST', 'PNG, JPEG, WEBP 이미지만 업로드할 수 있습니다.');
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      throw new ApiClientError('INVALID_REQUEST', '이미지 크기는 6MB 이내여야 합니다.');
    }
    body.image = {
      data: await fileToBase64(imageFile),
      mimeType: imageFile.type,
    };
  }

  const response = await postJson<AnalyzeSuccessResponse>('/api/analyze', body, signal);
  try {
    return validateAnalysisResult(response.data);
  } catch (error) {
    if (error instanceof AnalysisValidationError) {
      throw new ApiClientError('INVALID_MODEL_OUTPUT', ERROR_MESSAGES.INVALID_MODEL_OUTPUT, true);
    }
    throw error;
  }
}

export async function generateSimilarProblem(
  originalLatex: string,
  problemDescription: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await postJson<PracticeSuccessResponse>('/api/practice', {
    originalLatex: validateText(originalLatex, '원래 문제'),
    problemDescription: validateText(problemDescription, '문제 유형'),
  }, signal);
  if (typeof response.problem !== 'string' || !response.problem.trim()) {
    throw new ApiClientError('INVALID_MODEL_OUTPUT', undefined, true);
  }
  return response.problem.trim();
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '요청이 취소되었습니다.';
  }
  return '예상하지 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
