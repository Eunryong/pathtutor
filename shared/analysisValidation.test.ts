import { describe, expect, it } from 'vitest';
import { AnalysisValidationError, validateAnalysisResult } from './analysisValidation';

function path(type: 'student' | 'standard' | 'shortcut' | 'genius') {
  return {
    name: `${type} path`,
    description: `A ${type} solution`,
    type,
    steps: [
      {
        stepNumber: 1,
        latex: 'x = 1',
        explanation: 'Solve the equation.',
      },
    ],
  };
}

function validResult(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe('validateAnalysisResult', () => {
  it('accepts a complete result with documented optional paths', () => {
    expect(validateAnalysisResult(validResult())).toMatchObject({
      problemDescription: 'A linear equation',
      alternatives: [{ type: 'standard' }],
    });
  });

  it('requires a standard path', () => {
    expect(() => validateAnalysisResult(validResult({ alternatives: [] }))).toThrow(AnalysisValidationError);
    try {
      validateAnalysisResult(validResult({ alternatives: [] }));
    } catch (error) {
      expect(error).toMatchObject({ missingStandard: true });
    }
  });

  it('requires a reason when an optional path is omitted', () => {
    expect(() => validateAnalysisResult(validResult({ missingPaths: [] }))).toThrow(AnalysisValidationError);
  });

  it('rejects an error step without a correction', () => {
    const studentPath = {
      ...path('student'),
      steps: [{ ...path('student').steps[0], isError: true }],
    };
    expect(() => validateAnalysisResult(validResult({ studentPath }))).toThrow(AnalysisValidationError);
  });

  it('keeps a final error step visible with a transparent correction fallback', () => {
    const studentPath = {
      ...path('student'),
      steps: [{ ...path('student').steps[0], isError: true }],
    };
    const result = validateAnalysisResult(validResult({ studentPath }), { allowMissingCorrections: true });
    expect(result.studentPath.steps[0].correction).toContain('구체적인 정정식');
  });

  it('drops an invalid optional matrix visualization without rejecting the solution', () => {
    const studentPath = {
      ...path('student'),
      steps: [{
        ...path('student').steps[0],
        visualization: {
          type: 'matrix_grid',
          matrixA: [['1', '2']],
          matrixB: [['3', '4']],
        },
      }],
    };
    const result = validateAnalysisResult(validResult({ studentPath }));
    expect(result.studentPath.steps[0].visualization).toBeUndefined();
  });

  it('rejects feedback scores outside the expected range', () => {
    expect(() => validateAnalysisResult(validResult({
      feedback: {
        accuracy: 101,
        conceptualUnderstanding: 75,
        strategyEfficiency: 70,
        summary: 'Bad score.',
      },
    }))).toThrow(AnalysisValidationError);
  });
});
