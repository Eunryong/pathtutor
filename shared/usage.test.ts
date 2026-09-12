import { describe, expect, it } from 'vitest';
import { estimateGeminiCost, parseTokenPricing } from './usage';

describe('Gemini token cost estimation', () => {
  it('includes thinking tokens in the output estimate', () => {
    const pricing = parseTokenPricing('1.5', '9');
    expect(estimateGeminiCost({
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 5,
      totalTokenCount: 35,
    }, pricing)).toBe(0.00024);
  });

  it('falls back to total tokens when candidate tokens are absent', () => {
    const pricing = parseTokenPricing(1, 2);
    expect(estimateGeminiCost({ promptTokenCount: 100, totalTokenCount: 250 }, pricing))
      .toBe(0.0004);
  });

  it('returns no estimate for incomplete pricing', () => {
    expect(parseTokenPricing('1.5', undefined)).toBeUndefined();
    expect(estimateGeminiCost({ promptTokenCount: 10 }, undefined)).toBeUndefined();
  });
});
