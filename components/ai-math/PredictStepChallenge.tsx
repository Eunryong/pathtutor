import React, { useState, useEffect } from 'react';
import { HelpCircle, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
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
              이동하기 전 미분값의 부호를 보고 가중치가 어디로 움직여야 오차가 줄어들지 직접 예측해 보세요.
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
                <div className="text-xs text-emerald-800">
                  <strong className="block text-sm text-emerald-900 font-bold mb-0.5">
                    🎉 이상적인 최저점 (w = 2.00)에 도달했습니다!
                  </strong>
                  현재 접선의 기울기 $\frac&#123;dL&#125;&#123;dw&#125; = 0.0$ 이므로 손실이 0이며 더 이상 이동하지 않습니다.
                  새로운 가중치로 다시 퀴즈를 풀어보세요.
                </div>
              </div>
              <button
                type="button"
                onClick={onReset}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <RotateCcw size={13} /> 초기 상태(w=0.5)로 리셋
              </button>
            </div>
          ) : (
            <>
              {/* Question card */}
              <div className="bg-white/90 border border-indigo-100 rounded-xl p-4 space-y-3">
                <div className="text-xs text-slate-700 leading-relaxed">
                  현재 가중치 <span className="font-mono font-bold text-blue-700">w = {w.toFixed(2)}</span>에서
                  접선의 기울기(미분값)는{' '}
                  <span
                    className={`font-mono font-bold ${
                      isGradientNegative ? 'text-blue-600' : 'text-rose-600'
                    }`}
                  >
                    dL/dw = {gradient > 0 ? `+${gradient.toFixed(1)}` : gradient.toFixed(1)}
                  </span>
                  {' '}
                  ({isGradientNegative ? '음수' : isGradientPositive ? '양수' : '0'})입니다.
                  <br />
                  <strong className="text-slate-900 font-semibold mt-1 inline-block">
                    Q. 손실 L(w)를 줄이기 위해 경사하강법은 w를 어느 방향으로 이동시켜야 할까요?
                  </strong>
                </div>

                {/* Option Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setUserChoice('increase')}
                    className={`p-3 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between ${
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
                    className={`p-3 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between ${
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
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                    ) : (
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    )}
                    <div>
                      <strong className="font-bold text-sm block">
                        {isCorrect ? '정답입니다! 🎉' : '다시 생각해볼까요? 💡'}
                      </strong>
                      <p className="mt-1">
                        {isGradientNegative ? (
                          <>
                            기울기 $\frac&#123;dL&#125;&#123;dw&#125;$가 <strong>음수(-)</strong>라는 것은 오른쪽으로 갈수록
                            손실 곡선이 아래로 내려가는 형상입니다.
                            <br />
                            경사하강법 공식{' '}
                            <span className="font-mono font-semibold">
                              $w_&#123;t+1&#125; = w_t - \eta \cdot \frac&#123;dL&#125;&#123;dw&#125;$
                            </span>
                            에서 음수 기울기를 빼주므로($- (-)$), 가중치는{' '}
                            <strong>오른쪽(+)으로 증가</strong>하여 최솟값인 $w=2.0$에 접근합니다!
                          </>
                        ) : (
                          <>
                            기울기 $\frac&#123;dL&#125;&#123;dw&#125;$가 <strong>양수(+)</strong>라는 것은 오른쪽으로 갈수록
                            손실 곡선이 가파르게 올라가는 형상입니다.
                            <br />
                            따라서 손실을 줄이려면 반대 방향인 <strong>왼쪽(-)으로 감소</strong>해야 합니다.
                            공식에서도 양수를 빼주므로($- (+)$) 가중치가 줄어들어 $w=2.0$을 향합니다.
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={onStep}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-xs"
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
