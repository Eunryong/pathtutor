import { analysisResponseSchema, practiceResponseSchema } from '../../shared/analysisSchema';
import {
  AnalysisValidationError,
  validateAnalysisResult,
} from '../../shared/analysisValidation';
import {
  ANALYSIS_SYSTEM_INSTRUCTION,
  PRACTICE_SYSTEM_INSTRUCTION,
  buildAnalysisPrompt,
  buildPracticePrompt,
} from '../../shared/prompts';
import { estimateGeminiCost, parseTokenPricing } from '../../shared/usage';
import { branchSchemas, branchPrompt, validateBranch, mergeBranches, type AnalysisBranch } from '../../shared/parallelAnalysis';
import type {
  AnalysisMeta,
  AnalysisResult,
  ApiErrorCode,
  AnalyzeSuccessResponse,
  PracticeSuccessResponse,
  UsageMetadata,
} from '../../types';

interface WorkerEnv {
  GEMINI_ANALYSIS_MODE?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_MAX_RETRIES?: string;
  GEMINI_MAX_OUTPUT_TOKENS?: string;
  GEMINI_PRACTICE_MAX_OUTPUT_TOKENS?: string;
  GEMINI_TIMEOUT_MS?: string;
  GEMINI_INPUT_USD_PER_MILLION_TOKENS?: string;
  GEMINI_OUTPUT_USD_PER_MILLION_TOKENS?: string;
  PATHTUTOR_ACCESS_TOKEN?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  ALLOWED_ORIGIN?: string;
}

interface AnalyzeInput {
  text: string;
  image?: {
    data: string;
    mimeType: string;
  };
}

interface PracticeInput {
  originalLatex: string;
  problemDescription: string;
}

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}

interface StructuredResult<T> {
  data: T;
  attempts: number;
  usage?: UsageMetadata;
  branches?: Array<{ branch: AnalysisBranch; attempts: number; durationMs: number }>;
}

const DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_TIMEOUT_MS = 50_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_ANALYSIS_MAX_OUTPUT_TOKENS = 16_384;
const DEFAULT_PRACTICE_MAX_OUTPUT_TOKENS = 4_096;
const MAX_REQUEST_BYTES = 9 * 1024 * 1024;
const MAX_IMAGE_BASE64_LENGTH = 8_500_000;
const MAX_TEXT_LENGTH = 12_000;
const MAX_PRACTICE_TEXT_LENGTH = 20_000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 20;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_ENTRIES = 10_000;
const ALLOWED_CORS_HEADERS = 'Content-Type, Authorization';
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const PUBLIC_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_REQUEST: '요청 형식이나 입력값을 확인해 주세요.',
  UNAUTHORIZED: '인증이 필요합니다.',
  CONFIGURATION_ERROR: '분석 서버 설정이 아직 완료되지 않았습니다.',
  UPSTREAM_TIMEOUT: '분석 시간이 너무 오래 걸렸습니다. 잠시 후 다시 시도해 주세요.',
  UPSTREAM_ERROR: '분석 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  INVALID_MODEL_OUTPUT: 'AI가 안정적인 풀이 형식을 만들지 못했습니다. 다시 시도해 주세요.',
  INCOMPLETE_ANALYSIS: '표준 풀이를 생성하지 못했습니다. 입력을 확인한 뒤 다시 시도해 주세요.',
  RATE_LIMITED: '요청이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
};

class WorkerError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly upstreamStatus?: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ApiErrorCode,
    status: number,
    retryable: boolean,
    message?: string,
    upstreamStatus?: number,
    retryAfterSeconds?: number,
  ) {
    super(message ?? PUBLIC_MESSAGES[code]);
    this.name = 'WorkerError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.upstreamStatus = upstreamStatus;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class ModelOutputError extends Error {
  readonly issues: string[];
  readonly finishReason?: string;

  constructor(issues: string[], finishReason?: string) {
    super('Gemini returned an invalid structured response');
    this.name = 'ModelOutputError';
    this.issues = issues;
    this.finishReason = finishReason;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function analysisMaxOutputTokens(env: WorkerEnv): number {
  return boundedInteger(
    env.GEMINI_MAX_OUTPUT_TOKENS,
    DEFAULT_ANALYSIS_MAX_OUTPUT_TOKENS,
    8_192,
    32_768,
  );
}

function practiceMaxOutputTokens(env: WorkerEnv): number {
  return boundedInteger(
    env.GEMINI_PRACTICE_MAX_OUTPUT_TOKENS,
    DEFAULT_PRACTICE_MAX_OUTPUT_TOKENS,
    1_024,
    16_384,
  );
}

function modelName(env: WorkerEnv): string {
  return env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function allowedOrigins(env: WorkerEnv): string[] {
  return (env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function originMatches(origin: string, configuredOrigin: string): boolean {
  if (configuredOrigin === '*') return true;
  const wildcardIndex = configuredOrigin.indexOf('*');
  if (wildcardIndex < 0) return origin === configuredOrigin;
  const prefix = configuredOrigin.slice(0, wildcardIndex);
  const suffix = configuredOrigin.slice(wildcardIndex + 1);
  return origin.startsWith(prefix)
    && origin.endsWith(suffix)
    && origin.length > prefix.length + suffix.length;
}

function originIsAllowed(origin: string, env: WorkerEnv): boolean {
  return allowedOrigins(env).some((configuredOrigin) => originMatches(origin, configuredOrigin));
}

function requestOriginAllowed(request: Request, env: WorkerEnv): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return originIsAllowed(origin, env);
}

function responseOrigin(request: Request, env: WorkerEnv): string {
  const origin = request.headers.get('Origin');
  const origins = allowedOrigins(env);
  if (origins.includes('*')) return '*';
  return origin && originIsAllowed(origin, env) ? origin : origins[0] || '*';
}

function clientAddress(request: Request): string {
  return request.headers.get('CF-Connecting-IP')?.trim()
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'anonymous';
}

function requireAccessToken(request: Request, env: WorkerEnv): void {
  const expectedToken = env.PATHTUTOR_ACCESS_TOKEN?.trim();
  if (!expectedToken) return;

  const authorization = request.headers.get('Authorization') || '';
  if (authorization !== `Bearer ${expectedToken}`) {
    throw new WorkerError('UNAUTHORIZED', 401, false);
  }
}

function enforceRateLimit(request: Request, env: WorkerEnv): void {
  const maxRequests = boundedInteger(
    env.RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_RATE_LIMIT_MAX_REQUESTS,
    0,
    10_000,
  );
  if (maxRequests === 0) return;

  const windowMs = boundedInteger(
    env.RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
    1_000,
    3_600_000,
  );
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }

  const key = clientAddress(request);
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && rateLimitBuckets.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = rateLimitBuckets.keys().next().value;
      if (typeof oldestKey === 'string') rateLimitBuckets.delete(oldestKey);
    }
    bucket = { count: 0, resetAt: now + windowMs };
    rateLimitBuckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
    throw new WorkerError(
      'RATE_LIMITED',
      429,
      true,
      undefined,
      undefined,
      retryAfterSeconds,
    );
  }
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Math.min(3_600, Number(value));
  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return undefined;
  return Math.max(1, Math.min(3_600, Math.ceil((retryAt - Date.now()) / 1_000)));
}

function jsonResponse(
  request: Request,
  env: WorkerEnv,
  body: unknown,
  status = 200,
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': responseOrigin(request, env),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': ALLOWED_CORS_HEADERS,
    'Vary': 'Origin',
  });
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(request: Request, env: WorkerEnv, requestId: string, error: WorkerError): Response {
  const response = jsonResponse(request, env, {
    ok: false,
    error: {
      code: error.code,
      message: PUBLIC_MESSAGES[error.code],
      retryable: error.retryable,
      requestId,
    },
  }, error.status);
  if (error.retryAfterSeconds !== undefined) {
    response.headers.set('Retry-After', String(error.retryAfterSeconds));
    response.headers.set('Access-Control-Expose-Headers', 'Retry-After');
  }
  if (error.code === 'UNAUTHORIZED') response.headers.set('WWW-Authenticate', 'Bearer');
  return response;
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new WorkerError('INVALID_REQUEST', 415, false);
  }
  const contentLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new WorkerError('INVALID_REQUEST', 413, false);
  }
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      throw new WorkerError('INVALID_REQUEST', 413, false);
    }
    return JSON.parse(rawBody) as unknown;
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw new WorkerError('INVALID_REQUEST', 400, false);
  }
}

function parseAnalyzeInput(value: unknown): AnalyzeInput {
  if (!isRecord(value)) throw new WorkerError('INVALID_REQUEST', 400, false);

  const text = typeof value.text === 'string' ? value.text.trim() : '';
  if (text.length > MAX_TEXT_LENGTH) throw new WorkerError('INVALID_REQUEST', 413, false);

  let image: AnalyzeInput['image'];
  if (value.image !== undefined && value.image !== null) {
    if (!isRecord(value.image)) throw new WorkerError('INVALID_REQUEST', 400, false);
    const data = typeof value.image.data === 'string' ? value.image.data.trim() : '';
    const mimeType = typeof value.image.mimeType === 'string' ? value.image.mimeType.trim().toLowerCase() : '';
    if (!data || data.length > MAX_IMAGE_BASE64_LENGTH || data.includes(',')) {
      throw new WorkerError('INVALID_REQUEST', 413, false);
    }
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      throw new WorkerError('INVALID_REQUEST', 415, false);
    }
    if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) {
      throw new WorkerError('INVALID_REQUEST', 400, false);
    }
    if (!hasValidImageSignature(data, mimeType)) {
      throw new WorkerError('INVALID_REQUEST', 415, false);
    }
    image = { data, mimeType };
  }

  if (!text && !image) throw new WorkerError('INVALID_REQUEST', 400, false);
  return { text, ...(image ? { image } : {}) };
}

function hasValidImageSignature(data: string, mimeType: string): boolean {
  try {
    const bytes = Uint8Array.from(atob(data.replace(/\s/g, '').slice(0, 64)), (character) => character.charCodeAt(0));
    if (mimeType === 'image/png') {
      return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
    }
    if (mimeType === 'image/jpeg') {
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mimeType === 'image/webp') {
      return [82, 73, 70, 70].every((value, index) => bytes[index] === value)
        && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value);
    }
  } catch {
    return false;
  }
  return false;
}

function parsePracticeInput(value: unknown): PracticeInput {
  if (!isRecord(value)) throw new WorkerError('INVALID_REQUEST', 400, false);
  const originalLatex = typeof value.originalLatex === 'string' ? value.originalLatex.trim() : '';
  const problemDescription = typeof value.problemDescription === 'string'
    ? value.problemDescription.trim()
    : '';
  if (!originalLatex || !problemDescription) throw new WorkerError('INVALID_REQUEST', 400, false);
  if (originalLatex.length > MAX_PRACTICE_TEXT_LENGTH || problemDescription.length > MAX_TEXT_LENGTH) {
    throw new WorkerError('INVALID_REQUEST', 413, false);
  }
  return { originalLatex, problemDescription };
}

function usageMetadata(response: GeminiResponse): UsageMetadata | undefined {
  if (!response.usageMetadata) return undefined;
  const usage = response.usageMetadata;
  return {
    ...(typeof usage.promptTokenCount === 'number' ? { promptTokenCount: usage.promptTokenCount } : {}),
    ...(typeof usage.candidatesTokenCount === 'number' ? { candidatesTokenCount: usage.candidatesTokenCount } : {}),
    ...(typeof usage.thoughtsTokenCount === 'number' ? { thoughtsTokenCount: usage.thoughtsTokenCount } : {}),
    ...(typeof usage.totalTokenCount === 'number' ? { totalTokenCount: usage.totalTokenCount } : {}),
  };
}

function safeUpstreamReason(body: string): string {
  let message = body.trim();
  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === 'string') {
      message = parsed.error.message;
    }
  } catch {
    // Keep a compact text fallback for non-JSON upstream errors.
  }
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted-key]')
    .replace(/\s+/g, ' ')
    .slice(0, 240) || 'empty upstream response';
}

function findBalancedJsonObject(text: string): string | undefined {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(start, index + 1);
        if (depth < 0) break;
      }
    }
  }
  return undefined;
}

function parseModelJson(text: string, label: string, finishReason?: string): unknown {
  const normalized = text.trim().replace(/^\uFEFF/, '');
  const candidates = [normalized];
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  const balanced = findBalancedJsonObject(normalized);
  if (balanced) candidates.push(balanced);

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next safe envelope candidate before treating the response as invalid.
    }
  }
  throw new ModelOutputError([`${label} was not valid JSON`], finishReason);
}

function extractText(response: unknown): { text: string; usage?: UsageMetadata; finishReason?: string } {
  if (!isRecord(response)) throw new ModelOutputError(['response must be an object']);
  const candidates = response.candidates;
  if (!Array.isArray(candidates) || !candidates[0] || !isRecord(candidates[0])) {
    throw new ModelOutputError(['response.candidates[0] is missing']);
  }
  const candidate = candidates[0];
  const content = candidates[0].content;
  if (!isRecord(content) || !Array.isArray(content.parts)) {
    throw new ModelOutputError(['response.candidates[0].content.parts is missing']);
  }
  const text = content.parts
    .filter(isRecord)
    // Gemini thinking summaries can be returned as text parts marked thought=true.
    // They are not the structured answer and must not be concatenated into JSON.
    .filter((part) => part.thought !== true)
    .map((part) => part.text)
    .filter((part): part is string => typeof part === 'string')
    .join('')
    .trim();
  const finishReason = typeof candidate.finishReason === 'string' ? candidate.finishReason : undefined;
  if (!text) throw new ModelOutputError(['model response did not contain text'], finishReason);

  const usage = isRecord(response.usageMetadata)
    ? usageMetadata(response as GeminiResponse)
    : undefined;
  return {
    text,
    ...(usage ? { usage } : {}),
    ...(finishReason ? { finishReason } : {}),
  };
}

async function generateContent(
  env: WorkerEnv,
  systemInstruction: string,
  parts: Array<Record<string, unknown>>,
  schema: unknown,
  maxOutputTokens: number,
): Promise<GeminiResponse> {
  if (!env.GEMINI_API_KEY?.trim()) {
    throw new WorkerError('CONFIGURATION_ERROR', 500, false);
  }

  const timeoutMs = boundedInteger(env.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 120_000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(modelName(env))}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens,
          // Preserve the model's normal thinking level, but keep thought summaries
          // out of the text part that is parsed as the structured JSON answer.
          thinkingConfig: { includeThoughts: false },
          responseMimeType: 'application/json',
          responseSchema: toGeminiResponseSchema(schema),
        },
      }),
      signal: controller.signal,
    });

    const responseBody = await response.text();
    if (!response.ok) {
      console.log(JSON.stringify({
        event: 'gemini.upstream.failed',
        status: response.status,
        reason: safeUpstreamReason(responseBody),
      }));
      if (response.status === 429) {
        throw new WorkerError(
          'RATE_LIMITED',
          429,
          true,
          undefined,
          response.status,
          retryAfterSeconds(response.headers.get('Retry-After')),
        );
      }
      if (response.status >= 500 || response.status === 408) {
        throw new WorkerError('UPSTREAM_ERROR', 502, true, undefined, response.status);
      }
      throw new WorkerError('UPSTREAM_ERROR', 502, false, undefined, response.status);
    }

    try {
      return JSON.parse(responseBody) as GeminiResponse;
    } catch {
      throw new ModelOutputError(['Gemini response was not valid JSON']);
    }
  } catch (error) {
    if (error instanceof WorkerError || error instanceof ModelOutputError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new WorkerError('UPSTREAM_TIMEOUT', 504, true);
    }
    throw new WorkerError('UPSTREAM_ERROR', 502, true);
  } finally {
    clearTimeout(timeoutId);
  }
}

function responseParts(prompt: string, input?: AnalyzeInput['image']): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (input) {
    parts.push({
      inline_data: {
        mime_type: input.mimeType,
        data: input.data,
      },
    });
  }
  return parts;
}

const GEMINI_SCHEMA_TYPES = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null',
]);

function toGeminiResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiResponseSchema);
  if (!isRecord(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === 'type' && typeof child === 'string' && GEMINI_SCHEMA_TYPES.has(child)
      ? child.toUpperCase()
      : toGeminiResponseSchema(child),
  ]));
}

function validationHint(error: unknown): string | undefined {
  if (error instanceof AnalysisValidationError) return error.issues.join('; ');
  if (error instanceof ModelOutputError) return error.issues.join('; ');
  return undefined;
}

function finalModelError(error: unknown): WorkerError {
  if (error instanceof WorkerError) return error;
  if (error instanceof AnalysisValidationError) {
    return new WorkerError(
      error.missingStandard ? 'INCOMPLETE_ANALYSIS' : 'INVALID_MODEL_OUTPUT',
      502,
      false,
    );
  }
  if (error instanceof ModelOutputError) {
    return new WorkerError('INVALID_MODEL_OUTPUT', 502, false);
  }
  return new WorkerError('UPSTREAM_ERROR', 502, false);
}

function errorDiagnostics(error: unknown): Record<string, unknown> {
  if (error instanceof AnalysisValidationError) {
    return {
      type: 'validation',
      missingStandard: error.missingStandard,
      issues: error.issues.slice(0, 12),
    };
  }
  if (error instanceof ModelOutputError) {
    return {
      type: 'model_output',
      issues: error.issues.slice(0, 12),
      ...(error.finishReason ? { finishReason: error.finishReason } : {}),
    };
  }
  if (error instanceof WorkerError) {
    return {
      type: 'worker',
      code: error.code,
      retryable: error.retryable,
      ...(error.upstreamStatus ? { upstreamStatus: error.upstreamStatus } : {}),
    };
  }
  return { type: 'unknown' };
}

async function runAnalysis(
  env: WorkerEnv,
  input: AnalyzeInput,
  requestId: string,
): Promise<StructuredResult<AnalysisResult>> {
  if (env.GEMINI_ANALYSIS_MODE === 'parallel') return runParallelAnalysis(env, input, requestId);
  const maxRetries = boundedInteger(env.GEMINI_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 3);
  let repairHint: string | undefined;
  let lastError: unknown;
  let lastUsage: UsageMetadata | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      const prompt = buildAnalysisPrompt(input.text, Boolean(input.image), repairHint);
      const response = await generateContent(
        env,
        ANALYSIS_SYSTEM_INSTRUCTION,
        responseParts(prompt, input.image),
        analysisResponseSchema,
        analysisMaxOutputTokens(env),
      );
      const extracted = extractText(response);
      lastUsage = extracted.usage;
      const parsed = parseModelJson(extracted.text, 'model text', extracted.finishReason);
      return {
        data: validateAnalysisResult(parsed),
        attempts: attempt,
        ...(lastUsage ? { usage: lastUsage } : {}),
      };
    } catch (error) {
      lastError = error;
      if (
        attempt > maxRetries
        || (error instanceof WorkerError && (!error.retryable || error.code === 'RATE_LIMITED'))
      ) break;
      repairHint = validationHint(error);
    }
  }

  throw finalModelError(lastError);
}

async function runParallelAnalysis(env: WorkerEnv, input: AnalyzeInput, requestId: string): Promise<StructuredResult<AnalysisResult>> {
  const maxRetries = boundedInteger(env.GEMINI_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 3);
  const usage: UsageMetadata = {};
  let usageSeen = false;
  let usageComplete = true;
  const branches: NonNullable<StructuredResult<AnalysisResult>['branches']> = [];
  const failures: Array<{
    branch: AnalysisBranch | 'merge';
    diagnostics: Record<string, unknown>;
  }> = [];
  const run = async (branch: AnalysisBranch) => {
    const startedAt = Date.now();
    let repair: string | undefined;
    let lastError: unknown;
    let attempts = 0;
    try {
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        attempts = attempt;
        try {
          const response = await generateContent(
            env, 'You are PathTutor, a careful mathematical tutor. Follow the branch task and JSON schema.',
            responseParts(branchPrompt(branch, input.text, Boolean(input.image), repair), input.image),
            branchSchemas[branch], analysisMaxOutputTokens(env),
          );
          // Count every reported attempt, including responses rejected by validation.
          const reported = usageMetadata(response);
          if (reported) {
            if (reported.promptTokenCount === undefined || reported.candidatesTokenCount === undefined) usageComplete = false;
            usageSeen = true;
            for (const key of ['promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount'] as const) {
              if (reported[key] !== undefined) usage[key] = (usage[key] || 0) + reported[key]!;
            }
          } else usageComplete = false;
          const extracted = extractText(response);
          const parsed = parseModelJson(extracted.text, 'branch response', extracted.finishReason);
          return validateBranch(
            branch,
            parsed,
            attempt > maxRetries,
            branch === 'core',
          );
        } catch (error) {
          lastError = error;
          if (error instanceof WorkerError) usageComplete = false;
          if (attempt > maxRetries || (error instanceof WorkerError && (!error.retryable || error.code === 'RATE_LIMITED'))) break;
          repair = validationHint(error);
        }
      }
      failures.push({ branch, diagnostics: errorDiagnostics(lastError) });
      throw finalModelError(lastError);
    } finally {
      branches.push({ branch, attempts, durationMs: Date.now() - startedAt });
    }
  };
  // Both calls start before either is awaited. Wait for both even on failure so
  // no rejected work is detached from the Worker request lifetime.
  const settled = await Promise.allSettled([run('core'), run('extensions')]);
  const core = settled[0];
  const extensions = settled[1];
  if (core.status === 'rejected' || extensions.status === 'rejected') {
    logRequest('analysis.parallel.failed', requestId, {
      branches,
      usage,
      usageComplete,
      failures,
    });
    throw core.status === 'rejected' ? core.reason : (extensions as PromiseRejectedResult).reason;
  }
  let data: AnalysisResult;
  try {
    data = mergeBranches(core.value, extensions.value);
  } catch (error) {
    failures.push({ branch: 'merge', diagnostics: errorDiagnostics(error) });
    logRequest('analysis.parallel.failed', requestId, {
      branches,
      usage,
      usageComplete,
      failures,
    });
    throw error;
  }
  return {
    data,
    attempts: Math.max(...branches.map(branch => branch.attempts)),
    branches,
    // Do not present a partial total as a complete cost estimate.
    ...(usageSeen && usageComplete ? { usage } : {}),
  };
}

async function runPractice(
  env: WorkerEnv,
  input: PracticeInput,
): Promise<StructuredResult<string>> {
  const maxRetries = boundedInteger(env.GEMINI_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 2);
  let lastError: unknown;
  let lastUsage: UsageMetadata | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      const response = await generateContent(
        env,
        PRACTICE_SYSTEM_INSTRUCTION,
        [{ text: buildPracticePrompt(input.originalLatex, input.problemDescription) }],
        practiceResponseSchema,
        practiceMaxOutputTokens(env),
      );
      const extracted = extractText(response);
      lastUsage = extracted.usage;
      const parsed = parseModelJson(extracted.text, 'practice response', extracted.finishReason);
      if (!isRecord(parsed) || typeof parsed.problem !== 'string' || !parsed.problem.trim()) {
        throw new ModelOutputError(['practice.problem must be a non-empty string']);
      }
      return {
        data: parsed.problem.trim(),
        attempts: attempt,
        ...(lastUsage ? { usage: lastUsage } : {}),
      };
    } catch (error) {
      lastError = error;
      if (
        attempt > maxRetries
        || (error instanceof WorkerError && (!error.retryable || error.code === 'RATE_LIMITED'))
      ) break;
    }
  }

  throw finalModelError(lastError);
}

function meta(
  requestId: string,
  env: WorkerEnv,
  attempts: number,
  durationMs: number,
  usage?: UsageMetadata,
): AnalysisMeta {
  const pricing = parseTokenPricing(
    env.GEMINI_INPUT_USD_PER_MILLION_TOKENS,
    env.GEMINI_OUTPUT_USD_PER_MILLION_TOKENS,
  );
  const estimatedCostUsd = estimateGeminiCost(usage, pricing);
  return {
    requestId,
    model: modelName(env),
    attempts,
    durationMs,
    ...(usage ? { usage } : {}),
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
  };
}

function logRequest(event: string, requestId: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, requestId, ...details }));
}

async function handleAnalyze(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  const startedAt = Date.now();
  try {
    const input = parseAnalyzeInput(await readJson(request));
    const result = await runAnalysis(env, input, requestId);
    const response: AnalyzeSuccessResponse = {
      ok: true,
      data: result.data,
      meta: { ...meta(requestId, env, result.attempts, Date.now() - startedAt, result.usage), ...(result.branches ? { branches: result.branches, modelCalls: result.branches.reduce((sum, branch) => sum + branch.attempts, 0) } : {}) },
    };
    logRequest('analysis.completed', requestId, {
      model: response.meta.model,
      attempts: response.meta.attempts,
      branches: response.meta.branches,
      modelCalls: response.meta.modelCalls,
      durationMs: response.meta.durationMs,
      inputType: input.image ? (input.text ? 'text+image' : 'image') : 'text',
      inputBytes: input.text.length + (input.image?.data.length || 0),
      totalTokenCount: response.meta.usage?.totalTokenCount,
      estimatedCostUsd: response.meta.estimatedCostUsd,
    });
    return jsonResponse(request, env, response);
  } catch (error) {
    const publicError = error instanceof WorkerError
      ? error
      : finalModelError(error);
    logRequest('analysis.failed', requestId, {
      code: publicError.code,
      durationMs: Date.now() - startedAt,
      upstreamStatus: publicError.upstreamStatus,
    });
    return errorResponse(request, env, requestId, publicError);
  }
}

async function handlePractice(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  const startedAt = Date.now();
  try {
    const input = parsePracticeInput(await readJson(request));
    const result = await runPractice(env, input);
    const response: PracticeSuccessResponse = {
      ok: true,
      problem: result.data,
      meta: meta(requestId, env, result.attempts, Date.now() - startedAt, result.usage),
    };
    logRequest('practice.completed', requestId, {
      model: response.meta.model,
      attempts: response.meta.attempts,
      durationMs: response.meta.durationMs,
      totalTokenCount: response.meta.usage?.totalTokenCount,
      estimatedCostUsd: response.meta.estimatedCostUsd,
    });
    return jsonResponse(request, env, response);
  } catch (error) {
    const publicError = error instanceof WorkerError
      ? error
      : finalModelError(error);
    logRequest('practice.failed', requestId, {
      code: publicError.code,
      durationMs: Date.now() - startedAt,
      diagnostics: errorDiagnostics(error),
      upstreamStatus: publicError.upstreamStatus,
    });
    return errorResponse(request, env, requestId, publicError);
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const requestId = createRequestId();
    if (!requestOriginAllowed(request, env)) {
      return errorResponse(
        request,
        env,
        requestId,
        new WorkerError('INVALID_REQUEST', 403, false),
      );
    }

    if (request.method === 'OPTIONS') {
      const headers = new Headers({
        'Access-Control-Allow-Origin': responseOrigin(request, env),
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_CORS_HEADERS,
        'Vary': 'Origin',
      });
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse(request, env, {
        ok: true,
        model: modelName(env),
      });
    }
    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      try {
        requireAccessToken(request, env);
        enforceRateLimit(request, env);
      } catch (error) {
        const publicError = error instanceof WorkerError
          ? error
          : new WorkerError('UPSTREAM_ERROR', 500, false);
        logRequest('request.rejected', requestId, {
          path: url.pathname,
          code: publicError.code,
        });
        return errorResponse(request, env, requestId, publicError);
      }
      return handleAnalyze(request, env, requestId);
    }
    if (url.pathname === '/api/practice' && request.method === 'POST') {
      try {
        requireAccessToken(request, env);
        enforceRateLimit(request, env);
      } catch (error) {
        const publicError = error instanceof WorkerError
          ? error
          : new WorkerError('UPSTREAM_ERROR', 500, false);
        logRequest('request.rejected', requestId, {
          path: url.pathname,
          code: publicError.code,
        });
        return errorResponse(request, env, requestId, publicError);
      }
      return handlePractice(request, env, requestId);
    }

    return errorResponse(
      request,
      env,
      requestId,
      new WorkerError('INVALID_REQUEST', 404, false),
    );
  },
};
