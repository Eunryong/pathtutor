import React from 'react';
import {
  computeLoss,
  computeGradient,
  generateLossCurve,
  StepRecord,
} from '../../services/mathEngine';

interface LossSpaceViewProps {
  w: number;
  lr: number;
  history?: StepRecord[];
  targetX?: number;
  targetY?: number;
}

export const LossSpaceView: React.FC<LossSpaceViewProps> = ({
  w,
  lr,
  history = [],
  targetX = 2.0,
  targetY = 4.0,
}) => {
  const width = 360;
  const height = 280;
  const padding = { top: 24, right: 30, bottom: 36, left: 44 };

  const wMin = -0.5;
  const wMax = 4.5;
  const lossMax = 16.0;

  const toSvgX = (valW: number) =>
    padding.left + ((valW - wMin) / (wMax - wMin)) * (width - padding.left - padding.right);
  const toSvgY = (valL: number) => {
    const clampedL = Math.max(0, Math.min(lossMax, valL));
    return height - padding.bottom - (clampedL / lossMax) * (height - padding.top - padding.bottom);
  };

  // Current values
  const currentLoss = computeLoss(w, targetX, targetY);
  const rawGradient = computeGradient(w, targetX, targetY);
  const targetW = targetY / targetX;
  const isOptimal = currentLoss < 0.05;
  const isConverged = Math.abs(w - targetW) < 1e-4 || Math.abs(rawGradient) < 1e-4;
  const currentGradient = isConverged ? 0 : rawGradient;
  const nextW = isConverged ? targetW : w - lr * currentGradient;
  const isOutOfView = currentLoss > lossMax || w < wMin || w > wMax;

  // Pre-generate smooth loss curve path
  const curvePoints = generateLossCurve(targetX, targetY, wMin, wMax, 60);
  const pathD = curvePoints.reduce((acc, pt, idx) => {
    const xSvg = toSvgX(pt.w);
    const ySvg = toSvgY(pt.loss);
    return idx === 0 ? `M ${xSvg} ${ySvg}` : `${acc} L ${xSvg} ${ySvg}`;
  }, '');

  // Tangent line calculation (clamped in view)
  const tangentSpan = 0.65;
  const tW1 = Math.max(wMin, w - tangentSpan);
  const tW2 = Math.min(wMax, w + tangentSpan);
  const tL1 = currentLoss + currentGradient * (tW1 - w);
  const tL2 = currentLoss + currentGradient * (tW2 - w);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            손실 공간 (Loss Space)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            손실 곡선 <span className="font-mono text-rose-600">L(w) = (2w - 4)²</span> 과 접선
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] uppercase tracking-wider text-slate-600 block">손실 오차 L(w)</span>
          <span
            className={`font-mono text-sm font-bold ${
              isOptimal ? 'text-teal-600' : 'text-rose-600'
            }`}
          >
            {currentLoss.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="relative w-full flex justify-center bg-slate-50/70 rounded-xl border border-slate-100 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[420px] select-none"
          aria-label="손실 공간 그래프: L(w) 포물선 곡선과 현재 가중치 위치의 공"
        >
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((gw) => (
            <line
              key={`gw-${gw}`}
              x1={toSvgX(gw)}
              y1={toSvgY(0)}
              x2={toSvgX(gw)}
              y2={toSvgY(lossMax)}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
          ))}
          {[4, 8, 12, 16].map((gl) => (
            <line
              key={`gl-${gl}`}
              x1={toSvgX(wMin)}
              y1={toSvgY(gl)}
              x2={toSvgX(wMax)}
              y2={toSvgY(gl)}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
          ))}

          {/* Axes */}
          <line
            x1={toSvgX(wMin)}
            y1={toSvgY(0)}
            x2={toSvgX(wMax)}
            y2={toSvgY(0)}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(0)}
            y2={toSvgY(lossMax)}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* Axis Labels */}
          <text
            x={toSvgX(wMax) - 10}
            y={toSvgY(0) + 20}
            fontSize="11"
            fill="#64748b"
            fontWeight="bold"
          >
            w
          </text>
          <text
            x={toSvgX(0) - 16}
            y={toSvgY(lossMax) + 4}
            fontSize="11"
            fill="#64748b"
            fontWeight="bold"
          >
            L
          </text>
          {[0, 1, 2, 3, 4].map((val) => (
            <text
              key={`lbl-w-${val}`}
              x={toSvgX(val)}
              y={toSvgY(0) + 16}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {val}
            </text>
          ))}
          {[4, 8, 12, 16].map((val) => (
            <text
              key={`lbl-l-${val}`}
              x={toSvgX(0) - 8}
              y={toSvgY(val) + 3}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="end"
            >
              {val}
            </text>
          ))}

          {/* Parabola Loss Curve Path */}
          <path d={pathD} fill="none" stroke="#64748b" strokeWidth="2.5" />

          {/* Optimal Target marker at w=2.0, L=0 */}
          <circle
            cx={toSvgX(2.0)}
            cy={toSvgY(0)}
            r="4"
            fill="#10b981"
            stroke="#fff"
            strokeWidth="1.5"
          />
          <text
            x={toSvgX(2.0)}
            y={toSvgY(0) - 8}
            fontSize="10"
            fill="#059669"
            fontWeight="700"
            textAnchor="middle"
          >
            최저점 (w=2)
          </text>

          {/* History Trajectory (prior steps) */}
          {history.length > 1 &&
            history.map((h, i) => {
              if (i === history.length - 1) return null;
              return (
                <circle
                  key={`hist-${i}`}
                  cx={toSvgX(h.w)}
                  cy={toSvgY(h.loss)}
                  r="3"
                  fill="#94a3b8"
                  opacity="0.6"
                />
              );
            })}

          {/* Tangent Line at current w */}
          {currentLoss <= lossMax && (
            <line
              x1={toSvgX(tW1)}
              y1={toSvgY(tL1)}
              x2={toSvgX(tW2)}
              y2={toSvgY(tL2)}
              stroke="#f43f5e"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* Step vector arrow to nextW along the axis */}
          {currentLoss <= lossMax && Math.abs(nextW - w) > 0.03 && (
            <line
              x1={toSvgX(w)}
              y1={toSvgY(0) - 10}
              x2={toSvgX(Math.max(wMin, Math.min(wMax, nextW)))}
              y2={toSvgY(0) - 10}
              stroke="#8b5cf6"
              strokeWidth="2.5"
              markerEnd="url(#arrowhead)"
            />
          )}

          {/* Current Ball on the curve or Out-of-bounds indicator */}
          {!isOutOfView ? (
            <>
              <circle
                cx={toSvgX(w)}
                cy={toSvgY(currentLoss)}
                r="7.5"
                fill="#f43f5e"
                stroke="#fff"
                strokeWidth="2.5"
                className="transition-all duration-150"
              />
              <circle
                cx={toSvgX(w)}
                cy={toSvgY(currentLoss)}
                r="13"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1"
                opacity="0.3"
              />
            </>
          ) : (
            /* Warning indicator if exploded out of view */
            <g className="animate-pulse">
              <rect
                x={toSvgX(wMin) + 15}
                y={toSvgY(lossMax) + 10}
                width={width - padding.left - padding.right - 30}
                height={28}
                rx="6"
                fill="#fff1f2"
                stroke="#f43f5e"
                strokeWidth="1"
              />
              <text
                x={width / 2}
                y={toSvgY(lossMax) + 28}
                fontSize="11"
                fill="#e11d48"
                fontWeight="bold"
                textAnchor="middle"
              >
                ⚠ 그래프 범위 초과 (w={w.toFixed(2)}, L={currentLoss.toFixed(1)})
              </text>
            </g>
          )}

          {/* Arrowhead marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#8b5cf6" />
            </marker>
          </defs>
        </svg>
      </div>

      <div className="mt-3 text-[12px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <span>
          기울기{' '}
          <strong
            className={
              isConverged
                ? 'text-emerald-600'
                : currentGradient >= 0
                ? 'text-amber-600'
                : 'text-blue-600'
            }
          >
            dL/dw = {currentGradient.toFixed(1)}
          </strong>
        </span>
        <span>
          이동 방향{' '}
          <strong
            className={
              isConverged
                ? 'text-emerald-700 font-bold'
                : 'text-violet-600 font-bold'
            }
          >
            {isConverged
              ? '최저점 도달 (이동 없음)'
              : currentGradient > 0
              ? '← 왼쪽 이동 (w 감소)'
              : '오른쪽 이동 (w 증가) →'}
          </strong>
        </span>
        <span>
          다음 예상{' '}
          <strong className="text-slate-700">
            {isConverged ? 'w = 2.00 (수렴 완료)' : `w ≈ ${nextW.toFixed(2)}`}
          </strong>
        </span>
      </div>
    </div>
  );
};
