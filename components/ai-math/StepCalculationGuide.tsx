import React, { useState } from 'react';
import { Calculator, ArrowRight, ChevronDown, ChevronUp, Sparkles, Footprints, AlertCircle, CheckCircle2 } from 'lucide-react';
import LatexRenderer from '../LatexRenderer';
import {
  predict,
  computeVerticalResidual,
  computeLoss,
  computeGradient,
} from '../../services/mathEngine';

interface StepCalculationGuideProps {
  w: number;
  lr: number;
  isConverged: boolean;
  onStep: () => void;
}

export const StepCalculationGuide: React.FC<StepCalculationGuideProps> = ({
  w,
  lr,
  isConverged,
  onStep,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  // Exact arithmetic for the toy problem: data point (x=2, y=4), model y_hat = w * x
  const x = 2.0;
  const y = 4.0;
  const yHat = predict(w, x);
  const residual = computeVerticalResidual(w, x, y);
  const loss = computeLoss(w, x, y);
  const gradient = computeGradient(w, x, y);
  const deltaW = -lr * gradient;
  const nextW = isConverged ? w : w + deltaW;

  const isGradientNegative = gradient < -1e-4;
  const isGradientPositive = gradient > 1e-4;
  const isExactOneStepLr = Math.abs(lr - 0.125) < 1e-4;
  const isDefaultStartingCase = Math.abs(w - 0.5) < 1e-4 && Math.abs(lr - 0.1) < 1e-4;

  return (
    <div className="bg-white border border-blue-200/80 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
            <Calculator size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-bold text-slate-800">
                한 걸음(Step) 계산 원리: 숫자로 따라가는 4단계
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                초보자 눈높이 실시간 대입
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Step 버튼을 누르면 내부에서 어떤 계산이 일어나는지 현재 값({w.toFixed(2)}, η={lr.toFixed(3)})으로 쉬운 말과 실제 숫자로 확인해 보세요.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          aria-label={isOpen ? '계산 원리 접기' : '계산 원리 펼치기'}
        >
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {isOpen && (
        <div className="pt-2 space-y-4">
          {/* 4 Sequential Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Step 1: Input & Target */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                    1단계 · 데이터
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Input & Target</span>
                </div>
                <strong className="text-xs text-slate-800 block font-semibold mb-1">
                  입력값과 목표 정답
                </strong>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 font-mono text-xs space-y-1">
                  <div>입력 <LatexRenderer latex="x = 2" /></div>
                  <div>목표 <LatexRenderer latex="y = 4" /></div>
                  <div className="text-blue-700 font-bold pt-0.5 border-t border-slate-100">
                    현재 가중치 <LatexRenderer latex={`w = ${w.toFixed(2)}`} />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                모델 <LatexRenderer latex="\hat{y}=wx" />가 주어진 점 <LatexRenderer latex="(2, 4)" />를 정확히 맞추도록 <LatexRenderer latex="w" />를 조정합니다.
              </p>
            </div>

            {/* Step 2: Prediction, Residual, Loss */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                    2단계 · 오차와 손실
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Loss</span>
                </div>
                <strong className="text-xs text-slate-800 block font-semibold mb-1">
                  예측값, 오차, 손실
                </strong>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 font-mono text-xs space-y-1">
                  <div>
                    예측 <LatexRenderer latex={`\\hat{y} = wx = ${yHat.toFixed(2)}`} />
                  </div>
                  <div>
                    오차 <LatexRenderer latex={`y - \\hat{y} = ${residual >= 0 ? '+' : ''}${residual.toFixed(2)}`} />
                  </div>
                  <div className="text-rose-600 font-bold pt-0.5 border-t border-slate-100">
                    손실 <LatexRenderer latex={`L(w) = (${residual.toFixed(2)})^2 = ${loss.toFixed(2)}`} />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {Math.abs(residual) < 1e-4 ? (
                  <span className="text-emerald-700 font-medium">
                    정답과 완벽히 일치하여 오차가 0이고 손실도 0입니다!
                  </span>
                ) : (
                  <span>
                    정답(4)보다 {residual > 0 ? `${residual.toFixed(2)}만큼 작아` : `${Math.abs(residual).toFixed(2)}만큼 커서`} 오차가 생겼고, 이를 제곱한 손실이 <strong>{loss.toFixed(2)}</strong>입니다.
                  </span>
                )}
              </p>
            </div>

            {/* Step 3: Gradient & Direction */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded-md">
                    3단계 · 미분(기울기)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Gradient</span>
                </div>
                <strong className="text-xs text-slate-800 block font-semibold mb-1">
                  기울기가 알려주는 방향
                </strong>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 font-mono text-xs space-y-1">
                  <div>
                    도함수 <LatexRenderer latex="8w - 16" />
                  </div>
                  <div className="text-violet-700 font-bold pt-0.5 border-t border-slate-100">
                    기울기 <LatexRenderer latex={`\\frac{dL}{dw} = ${gradient > 0 ? '+' : ''}${gradient.toFixed(2)}`} />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {isGradientNegative ? (
                  <span>
                    기울기가 <strong>음수({gradient.toFixed(2)})</strong>이므로 가중치를 <strong>키우면(오른쪽 이동)</strong> 손실이 줄어듭니다.
                  </span>
                ) : isGradientPositive ? (
                  <span>
                    기울기가 <strong>양수(+{gradient.toFixed(2)})</strong>이므로 가중치를 <strong>줄이면(왼쪽 이동)</strong> 손실이 줄어듭니다.
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">
                    기울기가 <strong>0.0</strong>이므로 손실이 이미 최저점입니다. (이동 불필요)
                  </span>
                )}
              </p>
            </div>

            {/* Step 4: Weight Update Formula */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    4단계 · 가중치 갱신
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Update</span>
                </div>
                <strong className="text-xs text-slate-800 block font-semibold mb-1">
                  학습률(η)로 새 가중치 계산
                </strong>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 font-mono text-xs space-y-1">
                  <div className="text-slate-600">
                    <LatexRenderer latex="w_{\text{new}} = w - \eta \cdot \frac{dL}{dw}" />
                  </div>
                  <div className="text-emerald-700 font-bold pt-0.5 border-t border-slate-100 truncate">
                    {w.toFixed(2)} - ({lr.toFixed(3)})({gradient.toFixed(2)}) ={' '}
                    <span className="text-slate-900 underline">{nextW.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                이동량은 <strong>{deltaW >= 0 ? `+${deltaW.toFixed(2)}` : deltaW.toFixed(2)}</strong>이며, 다음 스텝에서 <LatexRenderer latex={`w = ${nextW.toFixed(2)}`} />가 됩니다.
              </p>
            </div>
          </div>

          {/* Special Educational Callout */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-950 flex items-start gap-2.5">
            <Sparkles className="text-blue-600 shrink-0 mt-0.5" size={17} />
            <div className="space-y-1 leading-relaxed">
              {isExactOneStepLr ? (
                <p>
                  🎯 <strong>학습률 <LatexRenderer latex="\eta = 0.125" />의 비밀:</strong>{' '}
                  도함수 계수 8과 맞물려 <LatexRenderer latex="1 - 8\eta = 0" />이 되므로,{' '}
                  <LatexRenderer latex={`w_{\\text{new}} = ${w.toFixed(2)} - 0.125 \\times (${gradient.toFixed(2)}) = 2.00`} />
                  으로 <strong>단 한 번의 스텝 만에 오차 0인 최솟값에 정확히 도달</strong>합니다!
                </p>
              ) : isDefaultStartingCase ? (
                <p>
                  💡 <strong>기본 상태 핵심 팁:</strong> 현재 <LatexRenderer latex="w = 0.5" />에서 예측값은{' '}
                  <LatexRenderer latex="\hat{y} = 1.0" />, 손실은 <LatexRenderer latex="9.0" />, 기울기는{' '}
                  <LatexRenderer latex="-12.0" />입니다. 학습률이 <LatexRenderer latex="\eta = 0.1" />이면{' '}
                  <LatexRenderer latex="w_{\text{new}} = 0.5 - 0.1(-12) = 1.7" />로 이동해 손실이{' '}
                  <strong>0.36(96% 감소)</strong>으로 줄어듭니다. 반면 학습률을{' '}
                  <strong><LatexRenderer latex="\eta = 0.125" /></strong>로 설정하면 <strong>단 한 번에 2.0에 도달</strong>합니다!
                </p>
              ) : isConverged ? (
                <p>
                  🎉 <strong>최저점(<LatexRenderer latex="w=2.00" />) 도달:</strong> 기울기가{' '}
                  <LatexRenderer latex="\frac{dL}{dw} = 0.0" />이므로 <LatexRenderer latex="w_{\text{new}} = 2.0 - \eta(0) = 2.0" />이 되어 가중치가 변하지 않습니다.
                </p>
              ) : lr > 0.25 ? (
                <p className="text-rose-900">
                  ⚠️ <strong>주의 (발산 구간):</strong> 현재 학습률(<LatexRenderer latex={`\\eta = ${lr.toFixed(3)}`} />)이 안정 수렴 한계인{' '}
                  <LatexRenderer latex="\eta < 0.25" />를 초과했습니다. 최저점을 지나쳐 오차가 점점 커지게 됩니다.
                </p>
              ) : (
                <p>
                  💡 <strong>현재 계산 요약:</strong> 기울기 <LatexRenderer latex={`\\frac{dL}{dw} = ${gradient.toFixed(2)}`} />에 학습률{' '}
                  <LatexRenderer latex={`\\eta = ${lr.toFixed(3)}`} />를 곱한 이동량 <LatexRenderer latex={`\\Delta w = ${deltaW >= 0 ? `+${deltaW.toFixed(2)}` : deltaW.toFixed(2)}`} /> 만큼 가중치가 갱신됩니다.
                </p>
              )}
            </div>
          </div>

          {/* Action Trigger Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
              <span className="font-semibold text-slate-700">실행 예정:</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                w: {w.toFixed(2)} → {nextW.toFixed(2)}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600">
                손실: {loss.toFixed(2)} → {isConverged ? '0.00' : '감소'}
              </span>
            </div>

            <button
              type="button"
              onClick={onStep}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Footprints size={14} /> 계산대로 적용하기 <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
