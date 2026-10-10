/**
 * AI Math Chapter 1: 경사하강법과 2D 손실 곡선 계산 엔진
 * 토이 모델: y_hat = w * x, L(w) = (w*x - y)^2
 */

export interface StepRecord {
  step: number;
  w: number;
  prediction: number;
  residual: number; // 같은 x에서의 세로 잔차: y - y_hat
  loss: number;
  gradient: number; // dL/dw
}

export type ConvergenceType =
  | 'monotonic'       // 0 < lr < 0.125: 단조 수렴
  | 'exact_one_step'  // lr === 0.125: 단 1회 스텝 만에 도달
  | 'oscillating'     // 0.125 < lr < 0.25: 진동 수렴
  | 'limit_cycle'     // lr === 0.25 (w0 !== targetW): 동일 진폭 무한 진동
  | 'divergent'       // lr > 0.25: 발산
  | 'zero_step';      // lr === 0 or w === targetW

export interface ConvergenceInfo {
  type: ConvergenceType;
  title: string;
  description: string;
  statusLevel: 'success' | 'info' | 'warning' | 'danger';
}

/**
 * 모델 예측값 y_hat = w * x
 */
export function predict(w: number, x: number): number {
  return w * x;
}

/**
 * 같은 x에서의 세로 잔차 (Vertical Residual) = y - y_hat
 */
export function computeVerticalResidual(w: number, x: number, y: number): number {
  return y - predict(w, x);
}

/**
 * 손실 함수 L(w) = (w * x - y)^2
 */
export function computeLoss(w: number, x: number, y: number): number {
  const diff = predict(w, x) - y;
  return diff * diff;
}

/**
 * 손실 함수의 가중치 w에 대한 미분(기울기)
 * dL/dw = 2x(w * x - y)
 */
export function computeGradient(w: number, x: number, y: number): number {
  return 2 * x * (predict(w, x) - y);
}

/**
 * 경사하강법 1회 업데이트 계산
 * w_new = w - lr * (dL/dw)
 */
export function stepGradientDescent(
  w: number,
  lr: number,
  x: number = 2.0,
  y: number = 4.0
): { nextW: number; record: StepRecord } {
  const prediction = predict(w, x);
  const residual = computeVerticalResidual(w, x, y);
  const loss = computeLoss(w, x, y);
  let gradient = computeGradient(w, x, y);

  if (Math.abs(gradient) < 1e-12) {
    gradient = 0;
  }

  let nextW = w - lr * gradient;
  const targetW = y / x;
  if (Math.abs(nextW - targetW) < 1e-5) {
    nextW = targetW;
  }

  return {
    nextW,
    record: {
      step: 0,
      w,
      prediction,
      residual,
      loss,
      gradient,
    },
  };
}

/**
 * 2차 손실 함수 L(w) = (w*x - y)^2의 곡률 기반 수렴·발산 상태 판별
 * 곡률 L'' = 2*x^2 = 8 (x=2일 때)
 * 업데이트 식: w_{t+1} - 2 = (1 - 8*lr)(w_t - 2)
 */
export function evaluateConvergence(
  lr: number,
  currentW: number,
  targetW: number = 2.0,
  x: number = 2.0
): ConvergenceInfo {
  const curvature = 2 * (x * x); // x=2일 때 8
  const factor = 1 - curvature * lr;
  const isAlreadyAtTarget = Math.abs(currentW - targetW) < 1e-6;

  if (lr <= 0) {
    return {
      type: 'zero_step',
      title: '학습률 0 (정지)',
      description: '학습률이 0이므로 가중치가 업데이트되지 않습니다.',
      statusLevel: 'info',
    };
  }

  if (isAlreadyAtTarget) {
    return {
      type: 'zero_step',
      title: '최저점 도달 (오차 0)',
      description: '이미 최적의 가중치 w=2.0에 도달하여 기울기가 0입니다.',
      statusLevel: 'success',
    };
  }

  // 1스텝 만에 최저점 도달: 1 - 8*lr = 0 => lr = 1/8 = 0.125
  if (Math.abs(lr - 1 / curvature) < 1e-5) {
    return {
      type: 'exact_one_step',
      title: '단 1스텝에 최저점 도달 (η = 0.125)',
      description: '업데이트 계수 (1 - 8η)가 정확히 0이 되어, 단 한 걸음 만에 w=2.0에 완벽히 안착합니다 (Newton-Raphson 효과).',
      statusLevel: 'success',
    };
  }

  // 단조 수렴: 0 < 1 - 8*lr < 1 => 0 < lr < 0.125
  if (factor > 0 && factor < 1) {
    return {
      type: 'monotonic',
      title: '단조 수렴 (안정적)',
      description: '진동 없이 최저점(w=2.0)을 향해 부드럽게 감속하며 안착합니다.',
      statusLevel: 'success',
    };
  }

  // 진동 수렴: -1 < 1 - 8*lr < 0 => 0.125 < lr < 0.25
  if (factor > -1 && factor < 0) {
    return {
      type: 'oscillating',
      title: '진동 수렴 (와리가리)',
      description: '최저점을 좌우로 건너뛰지만 진폭이 점점 줄어들며 수렴합니다.',
      statusLevel: 'info',
    };
  }

  // 동일 진폭 진동: factor === -1 => lr === 0.25
  if (Math.abs(factor - -1) < 1e-5) {
    return {
      type: 'limit_cycle',
      title: '동일 진폭 진동 (η = 0.25)',
      description: '초기값이 w=2가 아닐 때, 최저점을 중심으로 같은 폭으로 영원히 진동합니다.',
      statusLevel: 'warning',
    };
  }

  // 발산: factor < -1 => lr > 0.25
  return {
    type: 'divergent',
    title: '발산 / 수치 폭발 (η > 0.25)',
    description: '스텝을 밟을 때마다 오차가 지수적으로 폭발하여 최저점에서 멀어집니다.',
    statusLevel: 'danger',
  };
}

/**
 * 2D 손실 곡선 렌더링용 점 배열 생성
 */
export function generateLossCurve(
  x: number = 2.0,
  y: number = 4.0,
  wMin: number = -0.5,
  wMax: number = 4.5,
  steps: number = 100
): Array<{ w: number; loss: number }> {
  const points: Array<{ w: number; loss: number }> = [];
  const stepSize = (wMax - wMin) / steps;

  for (let i = 0; i <= steps; i++) {
    const w = wMin + i * stepSize;
    points.push({ w, loss: computeLoss(w, x, y) });
  }

  return points;
}
