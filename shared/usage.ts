import type { UsageMetadata } from '../types';

export interface TokenPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

export function parseTokenPricing(
  inputUsdPerMillionTokens: unknown,
  outputUsdPerMillionTokens: unknown,
): TokenPricing | undefined {
  const input = nonNegativeNumber(inputUsdPerMillionTokens);
  const output = nonNegativeNumber(outputUsdPerMillionTokens);
  if (input === undefined || output === undefined) return undefined;
  return {
    inputUsdPerMillionTokens: input,
    outputUsdPerMillionTokens: output,
  };
}

export function estimateGeminiCost(
  usage: UsageMetadata | undefined,
  pricing: TokenPricing | undefined,
): number | undefined {
  if (!usage || !pricing) return undefined;

  const inputTokens = nonNegativeNumber(usage.promptTokenCount);
  const candidateTokens = nonNegativeNumber(usage.candidatesTokenCount);
  const thoughtsTokens = nonNegativeNumber(usage.thoughtsTokenCount) ?? 0;
  const totalTokens = nonNegativeNumber(usage.totalTokenCount);

  if (inputTokens === undefined) return undefined;

  const outputTokens = candidateTokens !== undefined
    ? candidateTokens + thoughtsTokens
    : totalTokens !== undefined
      ? Math.max(0, totalTokens - inputTokens)
      : undefined;
  if (outputTokens === undefined) return undefined;

  const cost = (inputTokens / 1_000_000) * pricing.inputUsdPerMillionTokens
    + (outputTokens / 1_000_000) * pricing.outputUsdPerMillionTokens;
  return Math.round(cost * 100_000_000) / 100_000_000;
}
