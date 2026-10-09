import { describe, it, expect } from 'vitest';
import {
  predict,
  computeVerticalResidual,
  computeLoss,
  computeGradient,
  stepGradientDescent,
  evaluateConvergence,
  generateLossCurve,
} from './mathEngine';

describe('AI Math Engine - Gradient Descent & Loss', () => {
  const X = 2.0;
  const Y = 4.0;

  it('calculates prediction, vertical residual, loss, and gradient correctly', () => {
    const w = 0.5;
    expect(predict(w, X)).toBe(1.0);
    expect(computeVerticalResidual(w, X, Y)).toBe(3.0);
    expect(computeLoss(w, X, Y)).toBe(9.0);
    expect(computeGradient(w, X, Y)).toBe(-12.0);
  });

  it('reaches error 0 at target w = 2.0', () => {
    const w = 2.0;
    expect(predict(w, X)).toBe(4.0);
    expect(computeVerticalResidual(w, X, Y)).toBe(0.0);
    expect(computeLoss(w, X, Y)).toBe(0.0);
    expect(computeGradient(w, X, Y)).toBe(0.0);
  });

  it('reproduces the Hero Step: w = 0.5 with lr = 0.1 jumps to w = 1.7 and loss = 0.36', () => {
    const { nextW, record } = stepGradientDescent(0.5, 0.1, X, Y);

    expect(record.w).toBe(0.5);
    expect(record.loss).toBe(9.0);
    expect(record.gradient).toBe(-12.0);

    expect(nextW).toBeCloseTo(1.7, 5);
    const nextLoss = computeLoss(nextW, X, Y);
    expect(nextLoss).toBeCloseTo(0.36, 5);
    const nextResidual = computeVerticalResidual(nextW, X, Y);
    expect(nextResidual).toBeCloseTo(0.6, 5);
  });

  it('reaches exact target in 1 step when lr = 0.125', () => {
    const { nextW } = stepGradientDescent(0.5, 0.125, X, Y);
    expect(nextW).toBeCloseTo(2.0, 5);

    const status = evaluateConvergence(0.125, 0.5, 2.0, X);
    expect(status.type).toBe('exact_one_step');
  });

  it('identifies monotonic convergence when 0 < lr < 0.125', () => {
    const status = evaluateConvergence(0.08, 0.5, 2.0, X);
    expect(status.type).toBe('monotonic');

    // 2 consecutive steps move closer without oscillation
    const step1 = stepGradientDescent(0.5, 0.08, X, Y).nextW;
    const step2 = stepGradientDescent(step1, 0.08, X, Y).nextW;
    expect(step1).toBeGreaterThan(0.5);
    expect(step1).toBeLessThan(2.0);
    expect(step2).toBeGreaterThan(step1);
    expect(step2).toBeLessThan(2.0);
  });

  it('identifies oscillating convergence when 0.125 < lr < 0.25', () => {
    const status = evaluateConvergence(0.2, 0.5, 2.0, X);
    expect(status.type).toBe('oscillating');

    // Jumps over 2.0, then back towards 2.0
    const step1 = stepGradientDescent(0.5, 0.2, X, Y).nextW;
    expect(step1).toBeGreaterThan(2.0); // Overshoots
    const step2 = stepGradientDescent(step1, 0.2, X, Y).nextW;
    expect(step2).toBeLessThan(2.0); // Jumps back
    expect(Math.abs(step2 - 2.0)).toBeLessThan(Math.abs(step1 - 2.0)); // But amplitude shrinks
  });

  it('identifies limit cycle (equal amplitude oscillation) when lr = 0.25 and w != 2.0', () => {
    const status = evaluateConvergence(0.25, 0.5, 2.0, X);
    expect(status.type).toBe('limit_cycle');

    const step1 = stepGradientDescent(0.5, 0.25, X, Y).nextW;
    expect(step1).toBeCloseTo(3.5, 5); // 0.5 is -1.5 from 2, so flips to +1.5 = 3.5
    const step2 = stepGradientDescent(step1, 0.25, X, Y).nextW;
    expect(step2).toBeCloseTo(0.5, 5); // Flips back to 0.5
  });

  it('identifies divergence when lr > 0.25', () => {
    const status = evaluateConvergence(0.3, 0.5, 2.0, X);
    expect(status.type).toBe('divergent');

    const step1 = stepGradientDescent(0.5, 0.3, X, Y).nextW;
    const dist0 = Math.abs(0.5 - 2.0);
    const dist1 = Math.abs(step1 - 2.0);
    expect(dist1).toBeGreaterThan(dist0); // Distance grows!
  });

  it('generates loss curve points', () => {
    const points = generateLossCurve(X, Y, 0, 4, 10);
    expect(points).toHaveLength(11);
    const minPoint = points.find((p) => Math.abs(p.w - 2.0) < 1e-4);
    expect(minPoint?.loss).toBeCloseTo(0, 5);
  });
});
