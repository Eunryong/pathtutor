/**
 * JSON Schema sent to Gemini's structured-output configuration.
 * Runtime validation lives in analysisValidation.ts because model-side
 * structured output is a generation constraint, not an application boundary.
 */
const matrixSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['matrix_grid'] },
    matrixA: {
      type: 'array',
      items: { type: 'array', items: { type: 'string' } },
    },
    matrixB: {
      type: 'array',
      items: { type: 'array', items: { type: 'string' } },
    },
    resultMatrix: {
      type: 'array',
      items: { type: 'array', items: { type: 'string' } },
    },
  },
  required: ['type', 'matrixA', 'matrixB'],
};

const stepSchema = {
  type: 'object',
  properties: {
    stepNumber: { type: 'integer' },
    latex: { type: 'string' },
    explanation: { type: 'string' },
    isError: { type: 'boolean' },
    correction: { type: 'string' },
    strategy: { type: 'string' },
    visualization: matrixSchema,
  },
  required: ['stepNumber', 'latex', 'explanation'],
};

const pathSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    type: {
      type: 'string',
      enum: ['student', 'standard', 'shortcut', 'genius'],
    },
    steps: { type: 'array', items: stepSchema },
  },
  required: ['name', 'description', 'type', 'steps'],
};

export const analysisResponseSchema = {
  type: 'object',
  properties: {
    problemLatex: { type: 'string' },
    problemDescription: { type: 'string' },
    studentPath: pathSchema,
    alternatives: { type: 'array', items: pathSchema },
    missingPaths: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['shortcut', 'genius'] },
          reason: { type: 'string' },
        },
        required: ['type', 'reason'],
      },
    },
    feedback: {
      type: 'object',
      properties: {
        accuracy: { type: 'number' },
        conceptualUnderstanding: { type: 'number' },
        strategyEfficiency: { type: 'number' },
        summary: { type: 'string' },
      },
      required: [
        'accuracy',
        'conceptualUnderstanding',
        'strategyEfficiency',
        'summary',
      ],
    },
  },
  required: [
    'problemLatex',
    'problemDescription',
    'studentPath',
    'alternatives',
    'missingPaths',
    'feedback',
  ],
};

export const practiceResponseSchema = {
  type: 'object',
  properties: {
    problem: { type: 'string' },
  },
  required: ['problem'],
};
