import React from 'react';
import { predict, computeVerticalResidual } from '../../services/mathEngine';

interface DataSpaceViewProps {
  w: number;
  targetX?: number;
  targetY?: number;
}

export const DataSpaceView: React.FC<DataSpaceViewProps> = ({
  w,
  targetX = 2.0,
  targetY = 4.0,
}) => {
  // SVG Canvas dimensions and coordinate mapping
  const width = 360;
  const height = 280;
  const padding = { top: 24, right: 30, bottom: 36, left: 44 };

  const xMax = 3.5;
  const yMax = 7.0;

  const toSvgX = (x: number) =>
    padding.left + (x / xMax) * (width - padding.left - padding.right);
  const toSvgY = (y: number) =>
    height - padding.bottom - (y / yMax) * (height - padding.top - padding.bottom);

  // Computed values
  const yHat = predict(w, targetX);
  const residual = computeVerticalResidual(w, targetX, targetY);
  const isOptimal = Math.abs(residual) < 0.05;

  // Model line endpoints
  const lineEndX = 3.2;
  const lineEndY = predict(w, lineEndX);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            데이터 공간 (Data Space)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            모델 예측선 <span className="font-mono text-blue-600">ŷ = {w.toFixed(2)}x</span> 과 목표 데이터
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] uppercase tracking-wider text-slate-600 block">세로 잔차 (y - ŷ)</span>
          <span
            className={`font-mono text-sm font-bold ${
              isOptimal ? 'text-teal-600' : 'text-amber-600'
            }`}
          >
            {residual >= 0 ? `+${residual.toFixed(2)}` : residual.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="relative w-full flex justify-center bg-slate-50/70 rounded-xl border border-slate-100 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[420px] select-none"
          aria-label="데이터 공간 그래프: 목표 점 (2, 4)와 모델 예측선 ŷ = wx"
        >
          {/* Grid lines */}
          {[1, 2, 3].map((gx) => (
            <line
              key={`gx-${gx}`}
              x1={toSvgX(gx)}
              y1={toSvgY(0)}
              x2={toSvgX(gx)}
              y2={toSvgY(yMax)}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
          ))}
          {[2, 4, 6].map((gy) => (
            <line
              key={`gy-${gy}`}
              x1={toSvgX(0)}
              y1={toSvgY(gy)}
              x2={toSvgX(xMax)}
              y2={toSvgY(gy)}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
          ))}

          {/* Axes */}
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(xMax)}
            y2={toSvgY(0)}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(0)}
            y2={toSvgY(yMax)}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* Axis Labels */}
          <text
            x={toSvgX(xMax) - 6}
            y={toSvgY(0) + 20}
            fontSize="11"
            fill="#64748b"
            fontWeight="bold"
          >
            x
          </text>
          <text
            x={toSvgX(0) - 16}
            y={toSvgY(yMax) + 4}
            fontSize="11"
            fill="#64748b"
            fontWeight="bold"
          >
            y
          </text>
          {[1, 2, 3].map((val) => (
            <text
              key={`lbl-x-${val}`}
              x={toSvgX(val)}
              y={toSvgY(0) + 16}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {val}
            </text>
          ))}
          {[2, 4, 6].map((val) => (
            <text
              key={`lbl-y-${val}`}
              x={toSvgX(0) - 8}
              y={toSvgY(val) + 3}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="end"
            >
              {val}
            </text>
          ))}

          {/* Model Line: y_hat = w * x */}
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(lineEndX)}
            y2={toSvgY(lineEndY)}
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Vertical Residual dashed segment (같은 x=2 에서의 세로 차이) */}
          <line
            x1={toSvgX(targetX)}
            y1={toSvgY(yHat)}
            x2={toSvgX(targetX)}
            y2={toSvgY(targetY)}
            stroke={isOptimal ? '#0d9488' : '#ea580c'}
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* Prediction Point on the line: (x, yHat) */}
          <circle
            cx={toSvgX(targetX)}
            cy={toSvgY(yHat)}
            r="4.5"
            fill="#2563eb"
            stroke="#fff"
            strokeWidth="1.5"
          />
          <text
            x={toSvgX(targetX) + 8}
            y={toSvgY(yHat) + 4}
            fontSize="10"
            fill="#2563eb"
            fontWeight="600"
          >
            ŷ={yHat.toFixed(1)}
          </text>

          {/* Target Data Point: (2, 4) */}
          <circle
            cx={toSvgX(targetX)}
            cy={toSvgY(targetY)}
            r="7"
            fill="#10b981"
            stroke="#047857"
            strokeWidth="2"
          />
          <circle
            cx={toSvgX(targetX)}
            cy={toSvgY(targetY)}
            r="12"
            fill="none"
            stroke="#10b981"
            strokeWidth="1"
            opacity="0.4"
          />
          <text
            x={toSvgX(targetX) - 10}
            y={toSvgY(targetY) - 12}
            fontSize="11"
            fill="#065f46"
            fontWeight="700"
          >
            목표 ({targetX}, {targetY})
          </text>
        </svg>
      </div>

      <div className="mt-3 text-[12px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
        <span>
          직선 기울기 <strong className="text-slate-700">w = {w.toFixed(2)}</strong>
        </span>
        <span>
          예측값 <strong className="text-blue-600">ŷ = {yHat.toFixed(2)}</strong>
        </span>
        <span>
          목표값 <strong className="text-emerald-700">y = {targetY.toFixed(1)}</strong>
        </span>
      </div>
    </div>
  );
};
