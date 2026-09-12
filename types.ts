export interface MatrixVisualization {
  type: 'matrix_grid';
  matrixA: string[][];
  matrixB: string[][];
  resultMatrix?: string[][];
}

export interface Step {
  stepNumber: number;
  latex: string;
  explanation: string;
  isError?: boolean;
  correction?: string;
  strategy?: string;
  visualization?: MatrixVisualization;
}

export type PathType = 'student' | 'standard' | 'shortcut' | 'genius';

export interface Path {
  name: string;
  description: string;
  steps: Step[];
  type: PathType;
  color?: string;
}

export interface MissingPath {
  type: 'shortcut' | 'genius';
  reason: string;
}

export interface AnalysisResult {
  problemLatex: string;
  problemDescription: string;
  studentPath: Path;
  alternatives: Path[];
  missingPaths: MissingPath[];
  feedback: {
    accuracy: number; // 0-100
    conceptualUnderstanding: number; // 0-100
    strategyEfficiency: number; // 0-100
    summary: string;
  };
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR',
}

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface AnalysisMeta {
  modelCalls?: number;
  branches?: Array<{ branch: 'core' | 'extensions'; attempts: number; durationMs: number }>;
  requestId: string;
  model: string;
  attempts: number;
  durationMs: number;
  usage?: UsageMetadata;
  estimatedCostUsd?: number;
}

export interface AnalyzeSuccessResponse {
  ok: true;
  data: AnalysisResult;
  meta: AnalysisMeta;
}

export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'CONFIGURATION_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'INVALID_MODEL_OUTPUT'
  | 'INCOMPLETE_ANALYSIS'
  | 'RATE_LIMITED';

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
    requestId: string;
  };
}

export type AnalyzeResponse = AnalyzeSuccessResponse | ApiErrorResponse;

export interface PracticeSuccessResponse {
  ok: true;
  problem: string;
  meta: AnalysisMeta;
}
