import React, { useState, useEffect } from 'react';
import { HelpCircle, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, ChevronDown, ChevronUp, Footprints } from 'lucide-react';
import LatexRenderer from '../LatexRenderer';

interface PredictStepChallengeProps {
  w: number;
  lr: number;
  isConverged: boolean;
  onStep: () => void;
  onReset: () => void;
}

export const PredictStepChallenge: React.FC<PredictStepChallengeProps> = ({
  w,
  lr,
  isConverged,
  onStep,
  onReset,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [userChoice, setUserChoice] = useState<'increase' | 'decrease' | null>(null);

  // Reset user's choice whenever w changes so they can predict the next step
  useEffect(() => {
    setUserChoice(null);
  }, [w]);

  const yHat = 2.0 * w;
  const residual = 4.0 - yHat;
  const loss = residual * residual;
  const gradient = 8 * (w - 2.0);
  const isGradientNegative = gradient < -1e-4;
  const isGradientPositive = gradient > 1e-4;
  const correctChoice: 'increase' | 'decrease' = isGradientNegative ? 'increase' : 'decrease';

  const isCorrect = userChoice === correctChoice;

  return (
    <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/70 border border-indigo-200/80 rounded-2xl p-5 shadow-sm transition">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
            <HelpCircle size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">
                예측하고 확인하기 (Predict & Step)
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                이해도 점검
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              이동하기 전 미분값의 부호를 보고 가중치가 어디로 움직여야 손실이 줄어들지 직접 예측해 보세요.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          aria-label={isOpen ? '예측 챌린지 접기' : '예측 챌린지 펼치기'}
        >
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-indigo-100 space-y-3.5">
          {isConverged ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                <div className="text-xs text-emerald-800 space-y-1">
                  <strong className="block text-sm text-emerald-900 font-bold mb-0.5">
                    🎉 이상적인 최저점 (<LatexRenderer latex="w = 2.00" />)에 도달했습니다!
                  </strong>
                  <p>
                    현재 접선의 기울기 <LatexRenderer latex="\frac{dL}{dw} = 0.0" /> 이므로 손실이 최소화되어 더 이상 가중치가 이동하지 않습니다.
                    새로운 가중치로 다시 퀴즈를 풀어보세요.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onStep}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
                  title="기울기가 0인 상태에서 Step을 실행해 이동량 0을 확인합니다."
                >
                  <Footprints size={13} /> 최저점 Step 확인
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <RotateCcw size={13} /> 리셋
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Question card */}
              <div className="bg-white/90 border border-indigo-100 rounded-xl p-4 space-y-3">
                <div className="text-xs text-slate-700 leading-relaxed space-y-2">
                  {/* Step Arithmetic Context */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 font-mono text-xs flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
                    <span>데이터: <LatexRenderer latex="x=2, y=4" /></span>
                    <span>예측: <LatexRenderer latex={`\\hat{y} = ${yHat.toFixed(1)}`} /></span>
                    <span>오차: <LatexRenderer latex={`4 - ${yHat.toFixed(1)} = ${residual >= 0 ? '+' : ''}${residual.toFixed(1)}`} /></span>
                    <span>손실: <LatexRenderer latex={`L = ${loss.toFixed(1)}`} /></span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>현재 가중치</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      w = {w.toFixed(2)}
                    </span>
                    <span>에서 접선의 기울기(도함수 <LatexRenderer latex="8w - 16" />)는</span>
                    <span
                      className={`font-mono font-bold px-1.5 py-0.5 rounded border inline-flex items-center ${
                        isGradientNegative
                          ? 'text-blue-700 bg-blue-50 border-blue-200'
                          : 'text-rose-700 bg-rose-50 border-rose-200'
                      }`}
                    >
                      <LatexRenderer
                        latex={`\\frac{dL}{dw} = ${gradient > 0 ? `+${gradient.toFixed(1)}` : gradient.toFixed(1)}`}
                      />
                    </span>
                    <span className="font-semibold text-slate-600">
                      ({isGradientNegative ? '음수 기울기' : isGradientPositive ? '양수 기울기' : '기울기 0'})
                    </span>
                    <span>입니다.</span>
                  </div>
                  <div className="pt-1">
                    <strong className="text-slate-900 font-bold text-xs sm:text-sm block">
                      Q. 손실 <LatexRenderer latex="L(w)" />를 줄이기 위해 경사하강법은 가중치 <LatexRenderer latex="w" />를 어느 방향으로 이동시켜야 할까요?
                    </strong>
                  </div>
                </div>

                {/* Option Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setUserChoice('increase')}
                    className={`p-3 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                      userChoice === 'increase'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-sm">오른쪽으로 증가 (+ 방향)</span>
                      <span className="text-[11px] text-slate-500">w의 값을 더 크게 만듭니다.</span>
                    </div>
                    <ArrowRight size={16} className="text-indigo-600 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserChoice('decrease')}
                    className={`p-3 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                      userChoice === 'decrease'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-sm">왼쪽으로 감소 (- 방향)</span>
                      <span className="text-[11px] text-slate-500">w의 값을 더 작게 만듭니다.</span>
                    </div>
                    <ArrowRight size={16} className="text-indigo-600 shrink-0 rotate-180" />
                  </button>
                </div>
              </div>

              {/* Feedback when user selects an answer */}
              {userChoice && (
                <div
                  className={`rounded-xl p-4 border animate-fadeIn text-xs leading-relaxed space-y-2.5 ${
                    isCorrect
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {isCorrect ? (
                      <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                    ) : (
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    )}
                    <div className="space-y-1.5">
                      <strong className="font-bold text-sm block">
                        {isCorrect ? '정답입니다! 🎉' : '다시 생각해볼까요? 💡'}
                      </strong>
                      {isGradientNegative ? (
                        <div className="space-y-1 text-xs leading-relaxed">
                          <p>
                            접선의 기울기 <LatexRenderer latex="\frac{dL}{dw}" />가 <strong>음수(-)</strong>라는 것은 오른쪽으로 갈수록 손실 곡선이 아래로 내려가는 내리막길 형상입니다.
                          </p>
                          <p>
                            경사하강법 공식 <LatexRenderer latex="w_{t+1} = w_t - \eta \cdot \frac{dL}{dw}" /> 에서 음수 기울기를 빼주므로(<LatexRenderer latex="-\eta \cdot (-)" /> = <strong className="text-emerald-700">+</strong>), 가중치 <LatexRenderer latex="w" />는 <strong>오른쪽(+)으로 증가</strong>하여 손실이 줄어드는 최적값(<LatexRenderer latex="w=2.0" />)을 향해 전진합니다!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs leading-relaxed">
                          <p>
                            접선의 기울기 <LatexRenderer latex="\frac{dL}{dw}" />가 <strong>양수(+)</strong>라는 것은 오른쪽으로 갈수록 손실 곡선이 가파르게 올라가는 오르막길 형상입니다.
                          </p>
                          <p>
                            따라서 손실을 줄이려면 반대 방향인 <strong>왼쪽(- 방향)</strong>으로 가야 합니다. 공식 <LatexRenderer latex="w_{t+1} = w_t - \eta \cdot \frac{dL}{dw}" /> 에서도 양수 기울기를 빼주므로(<LatexRenderer latex="-\eta \cdot (+)" /> = <strong className="text-emerald-700">-</strong>), 가중치 <LatexRenderer latex="w" />가 감소하여 최적값(<LatexRenderer latex="w=2.0" />)으로 다가갑니다.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={onStep}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                    >
                      한 걸음 이동(Step)하여 실제로 확인하기 <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
