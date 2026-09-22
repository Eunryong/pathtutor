import type {
  AnalysisResult,
  MatrixVisualization,
  MissingPath,
  Path,
  PathType,
  Step,
} from '../types';

const PATH_TYPES: PathType[] = ['student', 'standard', 'shortcut', 'genius'];
const OPTIONAL_PATH_TYPES = ['shortcut', 'genius'] as const;
const MAX_PATHS = 4;
const MAX_STEPS = 40;
const MAX_MATRIX_ROWS = 20;
const MAX_MATRIX_COLUMNS = 20;
const MAX_STRING_LENGTH = 20_000;
const MISSING_CORRECTION_FALLBACK = '모델이 이 오류 단계의 구체적인 정정식을 반환하지 않았습니다. 직전의 올바른 식에서 다시 계산해 확인하세요.';

export interface AnalysisValidationOptions {
  allowMissingCorrections?: boolean;
}

type RecordValue = Record<string, unknown>;

export class AnalysisValidationError extends Error {
  readonly issues: string[];
  readonly missingStandard: boolean;

  constructor(issues: string[], missingStandard = false) {
    super('Analysis response failed validation');
    this.name = 'AnalysisValidationError';
    this.issues = issues;
    this.missingStandard = missingStandard;
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, field: string, issues: string[]): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string`);
    return '';
  }
  if (value.length > MAX_STRING_LENGTH) {
    issues.push(`${field} exceeds the maximum length`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string, issues: string[]): string | undefined {
  if (value === undefined || value === null) return undefined;
  return nonEmptyString(value, field, issues) || undefined;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  issues: string[],
): T | undefined {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issues.push(`${field} must be one of: ${allowed.join(', ')}`);
    return undefined;
  }
  return value as T;
}

function parseMatrix(value: unknown, field: string, issues: string[]): string[][] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MATRIX_ROWS) {
    issues.push(`${field} must be a non-empty matrix`);
    return [];
  }

  const rows: string[][] = [];
  let columnCount: number | undefined;
  value.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length === 0 || row.length > MAX_MATRIX_COLUMNS) {
      issues.push(`${field}[${rowIndex}] must be a non-empty row`);
      return;
    }
    if (columnCount === undefined) columnCount = row.length;
    if (row.length !== columnCount) {
      issues.push(`${field} must have rows with the same number of columns`);
    }
    rows.push(row.map((cell, columnIndex) =>
      nonEmptyString(cell, `${field}[${rowIndex}][${columnIndex}]`, issues),
    ));
  });
  return rows;
}

function parseVisualization(value: unknown, field: string, issues: string[]): MatrixVisualization | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    return undefined;
  }

  // Matrix visualization is optional display metadata. Validate it in a local
  // issue list so a malformed grid cannot discard an otherwise valid solution.
  const visualizationIssues: string[] = [];
  const type = enumValue(value.type, ['matrix_grid'] as const, `${field}.type`, visualizationIssues);
  const matrixA = parseMatrix(value.matrixA, `${field}.matrixA`, visualizationIssues);
  const matrixB = parseMatrix(value.matrixB, `${field}.matrixB`, visualizationIssues);
  const resultMatrix = value.resultMatrix === undefined
    ? undefined
    : parseMatrix(value.resultMatrix, `${field}.resultMatrix`, visualizationIssues);

  if (matrixA[0] && matrixB.length && matrixA[0].length !== matrixB.length) {
    visualizationIssues.push(`${field} matrix dimensions are not valid for multiplication`);
  }
  if (resultMatrix && matrixA.length && matrixB[0]) {
    if (resultMatrix.length !== matrixA.length || resultMatrix[0]?.length !== matrixB[0].length) {
      visualizationIssues.push(`${field}.resultMatrix dimensions do not match the multiplication result`);
    }
  }

  if (visualizationIssues.length > 0 || !type || !matrixA.length || !matrixB.length) return undefined;
  return { type, matrixA, matrixB, ...(resultMatrix ? { resultMatrix } : {}) };
}

function parseStep(
  value: unknown,
  field: string,
  issues: string[],
  options: AnalysisValidationOptions,
): Step {
  if (!isRecord(value)) {
    issues.push(`${field} must be an object`);
    return { stepNumber: 0, latex: '', explanation: '' };
  }

  const stepNumber = value.stepNumber;
  if (typeof stepNumber !== 'number' || !Number.isInteger(stepNumber) || stepNumber < 1) {
    issues.push(`${field}.stepNumber must be a positive integer`);
  }
  const latex = nonEmptyString(value.latex, `${field}.latex`, issues);
  const explanation = nonEmptyString(value.explanation, `${field}.explanation`, issues);
  const isError = value.isError === undefined ? false : value.isError;
  if (typeof isError !== 'boolean') issues.push(`${field}.isError must be boolean`);
  const correction = optionalString(value.correction, `${field}.correction`, issues);
  if (isError === true && !correction && !options.allowMissingCorrections) {
    issues.push(`${field}.correction is required for an error step`);
  }
  const strategy = optionalString(value.strategy, `${field}.strategy`, issues);
  const visualization = parseVisualization(value.visualization, `${field}.visualization`, issues);
  const safeCorrection = correction || (
    isError === true && options.allowMissingCorrections
      ? MISSING_CORRECTION_FALLBACK
      : undefined
  );

  return {
    stepNumber: typeof stepNumber === 'number' ? stepNumber : 0,
    latex,
    explanation,
    ...(isError === true ? { isError: true } : {}),
    ...(safeCorrection ? { correction: safeCorrection } : {}),
    ...(strategy ? { strategy } : {}),
    ...(visualization ? { visualization } : {}),
  };
}

function parsePath(
  value: unknown,
  field: string,
  issues: string[],
  options: AnalysisValidationOptions,
): Path {
  if (!isRecord(value)) {
    issues.push(`${field} must be an object`);
    return { name: '', description: '', type: 'standard', steps: [] };
  }

  const name = nonEmptyString(value.name, `${field}.name`, issues);
  const description = nonEmptyString(value.description, `${field}.description`, issues);
  const type = enumValue(value.type, PATH_TYPES, `${field}.type`, issues) ?? 'standard';
  if (!Array.isArray(value.steps) || value.steps.length === 0 || value.steps.length > MAX_STEPS) {
    issues.push(`${field}.steps must contain between 1 and ${MAX_STEPS} steps`);
  }
  const steps = Array.isArray(value.steps)
    ? value.steps.slice(0, MAX_STEPS).map((step, index) => parseStep(
      step,
      `${field}.steps[${index}]`,
      issues,
      options,
    ))
    : [];
  const color = optionalString(value.color, `${field}.color`, issues);
  return { name, description, type, steps, ...(color ? { color } : {}) };
}

function parseMissingPaths(value: unknown, issues: string[]): MissingPath[] {
  if (!Array.isArray(value) || value.length > OPTIONAL_PATH_TYPES.length) {
    issues.push('missingPaths must be an array with at most two entries');
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      issues.push(`missingPaths[${index}] must be an object`);
      return [];
    }
    const type = enumValue(entry.type, OPTIONAL_PATH_TYPES, `missingPaths[${index}].type`, issues);
    const reason = nonEmptyString(entry.reason, `missingPaths[${index}].reason`, issues);
    if (type && seen.has(type)) issues.push(`missingPaths contains duplicate type: ${type}`);
    if (type) seen.add(type);
    return type && reason ? [{ type, reason }] : [];
  });
}

function score(value: unknown, field: string, issues: string[]): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    issues.push(`${field} must be a number between 0 and 100`);
    return 0;
  }
  return value;
}

export function validateAnalysisResult(
  value: unknown,
  options: AnalysisValidationOptions = {},
): AnalysisResult {
  const issues: string[] = [];
  if (!isRecord(value)) throw new AnalysisValidationError(['response must be an object']);

  const problemLatex = nonEmptyString(value.problemLatex, 'problemLatex', issues);
  const problemDescription = nonEmptyString(value.problemDescription, 'problemDescription', issues);
  const studentPath = parsePath(value.studentPath, 'studentPath', issues, options);
  if (studentPath.type !== 'student') issues.push('studentPath.type must be student');

  if (Array.isArray(value.alternatives) && value.alternatives.length > MAX_PATHS - 1) {
    issues.push(`alternatives must contain at most ${MAX_PATHS - 1} paths`);
  }
  const alternatives = Array.isArray(value.alternatives)
    ? value.alternatives.slice(0, MAX_PATHS - 1).map((path, index) => parsePath(
      path,
      `alternatives[${index}]`,
      issues,
      options,
    ))
    : [];
  if (!Array.isArray(value.alternatives)) issues.push('alternatives must be an array');

  const missingPaths = parseMissingPaths(value.missingPaths, issues);
  const allPaths = [studentPath, ...alternatives];
  const seenTypes = new Set<string>();
  allPaths.forEach((path, index) => {
    if (seenTypes.has(path.type)) issues.push(`duplicate path type: ${path.type}`);
    seenTypes.add(path.type);
    if (index > 0 && path.type === 'student') issues.push('alternatives cannot contain a student path');
  });

  const missingStandard = !alternatives.some((path) => path.type === 'standard');
  if (missingStandard) issues.push('standard path is required in alternatives');

  const missingByType = new Map(missingPaths.map((path) => [path.type, path]));
  OPTIONAL_PATH_TYPES.forEach((type) => {
    const present = alternatives.some((path) => path.type === type);
    const documented = missingByType.has(type);
    if (!present && !documented) issues.push(`${type} must be generated or documented in missingPaths`);
    if (present && documented) issues.push(`${type} cannot be both generated and listed in missingPaths`);
  });

  if (!isRecord(value.feedback)) {
    issues.push('feedback must be an object');
  }
  const feedback = isRecord(value.feedback) ? {
    accuracy: score(value.feedback.accuracy, 'feedback.accuracy', issues),
    conceptualUnderstanding: score(
      value.feedback.conceptualUnderstanding,
      'feedback.conceptualUnderstanding',
      issues,
    ),
    strategyEfficiency: score(value.feedback.strategyEfficiency, 'feedback.strategyEfficiency', issues),
    summary: nonEmptyString(value.feedback.summary, 'feedback.summary', issues),
  } : {
    accuracy: 0,
    conceptualUnderstanding: 0,
    strategyEfficiency: 0,
    summary: '',
  };

  if (issues.length > 0) {
    throw new AnalysisValidationError(issues.slice(0, 12), missingStandard);
  }

  return {
    problemLatex,
    problemDescription,
    studentPath,
    alternatives,
    missingPaths,
    feedback,
  };
}
