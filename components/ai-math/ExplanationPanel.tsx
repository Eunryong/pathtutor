import React, { useState } from 'react';
import { BookOpen, Code2, Layers, Lightbulb, Calculator, GraduationCap } from 'lucide-react';
import LatexRenderer from '../LatexRenderer';
import {
  computeLoss,
  computeGradient,
  computeVerticalResidual,
  predict,
} from '../../services/mathEngine';

interface ExplanationPanelProps {
  w: number;
  lr: number;
  stepCount: number;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({ w, lr }) => {
  // Top-level tab: 'concept' (개념 해설) vs 'code' (PyTorch 코드로 보기)
  const [activeTab, setActiveTab] = useState<'concept' | 'code'>('concept');

  // Vertical Depth level for concept tab: 1 (직관), 2 (수식 대입), 3 (상세 미분 및 유도)
  const [depthLevel, setDepthLevel] = useState<1 | 2 | 3>(1);

  // Live calculated values for current w & lr
  const x = 2.0;
  const y = 4.0;
  const yHat = predict(w, x);
  const residual = computeVerticalResidual(w, x, y);
  const loss = computeLoss(w, x, y);
  const gradient = computeGradient(w, x, y);
  const deltaW = -lr * gradient;
  const nextW = w + deltaW;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Top Header: Representation Modality Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('concept')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'concept'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BookOpen size={14} /> 개념 해설 (깊이 조절)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'code'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Code2 size={14} /> PyTorch 코드로 보기
          </button>
        </div>

        {/* Depth Level Selector (Only shown in concept mode) */}
        {activeTab === 'concept' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <span className="text-[11px] font-semibold text-slate-600 px-2 flex items-center gap-1">
              <Layers size={12} /> 설명 깊이:
            </span>
            <button
              type="button"
              onClick={() => setDepthLevel(1)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                depthLevel === 1
                  ? 'bg-white text-blue-600 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. 직관
            </button>
            <button
              type="button"
              onClick={() => setDepthLevel(2)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                depthLevel === 2
                  ? 'bg-white text-blue-600 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. 단계별 수식
            </button>
            <button
              type="button"
              onClick={() => setDepthLevel(3)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                depthLevel === 3
                  ? 'bg-white text-blue-600 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3. 상세 미분 & 유도
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Concept Explanations with Depth Levels */}
      {activeTab === 'concept' && (
        <div className="space-y-4">
          {depthLevel === 1 && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
              <div className="flex items-start gap-3 p-4 bg-blue-50/70 rounded-xl border border-blue-100">
                <Lightbulb size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-blue-900 text-sm mb-1">
                    안개 낀 산골짜기에서 발바닥으로 길 찾기
                  </h4>
                  <p className="text-xs text-blue-800/90 leading-normal">
                    앞이 전혀 보이지 않는 짙은 안개 속에서 가장 낮은 골짜기(손실이 최소인 곳)로
                    내려가려면 어떻게 해야 할까요?
                    <br />
                    지금 딛고 서 있는 <strong>발바닥의 경사(기울기)</strong>를 느끼고,{' '}
                    <strong>가장 가파르게 올라가는 반대 방향(내리막길)</strong>으로 한 걸음씩
                    내딛으면 됩니다.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <strong className="text-slate-800 block mb-1">🎯 오차를 줄인다는 것</strong>
                  <span className="text-slate-600">
                    현재 데이터 점 (2, 4)와 모델의 예측선 사이의 <strong>세로 잔차</strong>를 줄여
                    손실을 최소화하는 직선의 기울기 <code className="text-blue-600 font-bold">w=2.0</code>을
                    스스로 찾아가는 여정입니다.
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <strong className="text-slate-800 block mb-1">👟 학습률(η) = 발걸음의 크기</strong>
                  <span className="text-slate-600">
                    보폭이 너무 좁으면 한참 걸리고, 보폭이 너무 넓으면(η &gt; 0.25) 골짜기를
                    건너뛰어 반대편 산 너머로 날아가 버립니다(발산).
                  </span>
                </div>
              </div>
            </div>
          )}

          {depthLevel === 2 && (
            <div className="space-y-3">
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2">
                  <Calculator size={14} className="text-blue-400" />
                  <span>실시간 라이브 연산 대입 (현재 상태)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-slate-400 block mb-1">1. 순전파 (예측값 및 세로 잔차)</span>
                    <p>
                      ŷ = w · x = {w.toFixed(2)} × 2.0 ={' '}
                      <span className="text-blue-400 font-bold">{yHat.toFixed(2)}</span>
                    </p>
                    <p className="text-slate-400">
                      잔차(y - ŷ) = 4.0 - {yHat.toFixed(2)} ={' '}
                      <span className="text-amber-400 font-bold">{residual.toFixed(2)}</span>
                    </p>
                    <p>
                      손실 L(w) = (잔차)² = ({residual.toFixed(2)})² ={' '}
                      <span className="text-rose-400 font-bold">{loss.toFixed(2)}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">2. 역전파 및 가중치 업데이트</span>
                    <p>
                      기울기(dL/dw) = 8w - 16 = 8({w.toFixed(2)}) - 16 ={' '}
                      <span className="text-violet-400 font-bold">{gradient.toFixed(2)}</span>
                    </p>
                    <p>
                      이동량 (-η · dL/dw) = -({lr.toFixed(3)}) × ({gradient.toFixed(2)}) ={' '}
                      <span className="text-emerald-400 font-bold">
                        {deltaW >= 0 ? `+${deltaW.toFixed(2)}` : deltaW.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-white font-bold pt-1 border-t border-slate-800">
                      다음 w_new = {w.toFixed(2)} {deltaW >= 0 ? '+' : ''} {deltaW.toFixed(2)} ={' '}
                      <span className="text-emerald-400">{nextW.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                💡 <strong>Hero Step 팁:</strong> 초기값 <code className="text-slate-800 font-bold">w=0.5</code>,{' '}
                <code className="text-slate-800 font-bold">η=0.1</code> 상태에서 [Step] 버튼을 한 번만 누르면{' '}
                <code className="text-blue-600 font-bold">w=1.7</code>로 점프하며 손실이{' '}
                <strong>9.0에서 0.36으로 96% 급감</strong>합니다!
              </p>
            </div>
          )}

          {depthLevel === 3 && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <GraduationCap size={16} className="text-violet-600" />
                  1. 연쇄법칙(Chain Rule)을 통한 손실 함수 미분
                </h4>
                <div>
                  <LatexRenderer latex="손실 함수 $L(w) = (wx - y)^2$는 바깥 함수 $u^2$와 안쪽 함수 $u = wx - y$의 합성함수입니다." />
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <LatexRenderer
                    latex="\frac{dL}{dw} = \frac{dL}{du} \cdot \frac{du}{dw} = 2(wx - y) \cdot x = 2x(wx - y)"
                    displayMode
                  />
                </div>
                <div>
                  <LatexRenderer latex="토이 예제 데이터 $(x=2, y=4)$를 대입하면 도함수는 다음과 같습니다:" />
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <LatexRenderer
                    latex="\frac{dL}{dw} = 2(2)(2w - 4) = 8w - 16 = 8(w - 2)"
                    displayMode
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">
                  2. 왜 0 &lt; η &lt; 0.25 에서만 수렴하는가? (곡률과 안정성 조건)
                </h4>
                <div>
                  <LatexRenderer latex="경사하강법 점화식 $w_{t+1} = w_t - \eta \cdot \frac{dL}{dw}$에 $\frac{dL}{dw} = 8(w_t - 2)$를 대입하고 양변에서 2를 빼면 다음과 같은 점화식이 유도됩니다:" />
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <LatexRenderer
                    latex="w_{t+1} - 2 = (w_t - 2) - 8\eta(w_t - 2) = (1 - 8\eta)(w_t - 2)"
                    displayMode
                  />
                </div>
                <div>
                  <LatexRenderer latex="수열 $w_t - 2$가 0으로 수렴하기 위한 필요충분조건은 공비의 절댓값이 1보다 작아야 합니다:" />
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                  <LatexRenderer latex="|1 - 8\eta| < 1 \iff -1 < 1 - 8\eta < 1 \iff 0 < \eta < 0.25" displayMode />
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600 pt-1">
                  <li>
                    <LatexRenderer latex="$\eta = 0.125$ 일 때: 공비 $1 - 8(0.125) = 0$ 이 되어 단 1회 스텝 만에 오차 0인 최솟값에 도달합니다." />
                  </li>
                  <li>
                    <LatexRenderer latex="$\eta = 0.25$ 일 때: 초기값이 $w_0 \ne 2$ 일 때 공비가 $-1$ 이 되어 최저점을 중심으로 같은 폭으로 무한 진동합니다." />
                  </li>
                  <li>
                    <LatexRenderer latex="$\eta > 0.25$ 일 때: 공비의 절댓값이 1보다 커져 오차가 지수적으로 폭발(Divergence)합니다." />
                  </li>
                </ul>
                <p className="text-slate-500 pt-2 border-t border-slate-200">
                  ※ 이 경계는 2차 함수 곡률 $L''=8$ 에 한정된 기준이며, 실제 딥러닝에서는 손실 곡면의 형태, 옵티마이저 종류(Adam 등), 배치 크기에 따라 학습률 조정 방식이 달라집니다.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: PyTorch Code View */}
      {activeTab === 'code' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1 flex-wrap gap-2">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              현재 조작값과 1:1 동기화된 PyTorch 코드 (Live)
            </span>
            <span className="font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200">
              현재 설정: w={w.toFixed(2)}, η={lr.toFixed(3)}
            </span>
          </div>

          <div className="p-4 bg-slate-950 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
            <span className="text-slate-500 block mb-2"># PyTorch 1:1 매핑 코드 (현재 실험 파라미터 실시간 적용)</span>
            <span className="text-purple-400">import</span> torch<br />
            <br />
            <span className="text-slate-500"># 1. 토이 데이터 및 학습할 파라미터 (현재 w = {w.toFixed(2)})</span><br />
            x = torch.<span className="text-blue-400">tensor</span>(2.0)<br />
            y = torch.<span className="text-blue-400">tensor</span>(4.0)<br />
            w = torch.<span className="text-blue-400">tensor</span>({w.toFixed(2)}, requires_grad=<span className="text-amber-400">True</span>)<br />
            lr = <span className="text-violet-400">{lr.toFixed(3)}</span><br />
            <br />
            <span className="text-slate-500"># 2. 순전파 (Forward Pass): 예측값 {yHat.toFixed(2)}, 손실 {loss.toFixed(2)}</span><br />
            y_hat = w * x &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500"># ŷ = {w.toFixed(2)} * 2.0 = {yHat.toFixed(2)}</span><br />
            loss = (y_hat - y) ** 2 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500"># L(w) = ({yHat.toFixed(2)} - 4.0)² = {loss.toFixed(2)}</span><br />
            <br />
            <span className="text-slate-500"># 3. 역전파 (Backward Pass): 연쇄법칙으로 기울기 자동 계산</span><br />
            loss.<span className="text-blue-400">backward</span>() &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500"># w.grad = dL/dw = 8w - 16 = {Math.abs(gradient) < 1e-4 ? '0.0' : gradient.toFixed(2)}</span><br />
            <br />
            <span className="text-slate-500"># 4. 경사하강법 1스텝 업데이트</span><br />
            <span className="text-purple-400">with</span> torch.<span className="text-blue-400">no_grad</span>():<br />
            {Math.abs(gradient) < 1e-4 ? (
              <>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500"># 기울기 0: 이미 최저점에 도달하여 가중치가 변하지 않음</span><br />
                &nbsp;&nbsp;&nbsp;&nbsp;w -= lr * w.grad &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-emerald-400"># w 유지: {w.toFixed(2)} (수렴 완료)</span><br />
              </>
            ) : (
              <>
                &nbsp;&nbsp;&nbsp;&nbsp;w -= lr * w.grad &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-emerald-400"># w: {w.toFixed(2)} → {nextW.toFixed(2)} ({deltaW >= 0 ? '+' : ''}{deltaW.toFixed(2)})</span><br />
              </>
            )}
            &nbsp;&nbsp;&nbsp;&nbsp;w.grad.<span className="text-blue-400">zero_</span>() &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500"># 다음 스텝을 위해 그래디언트 초기화</span><br />
          </div>
          <p className="text-xs text-slate-500">
            💡 위 코드는 현재 슬라이더로 조절한 <code className="text-slate-800 font-mono font-bold">w={w.toFixed(2)}</code>, <code className="text-slate-800 font-mono font-bold">η={lr.toFixed(3)}</code> 값이 즉시 반영된 라이브 코드입니다. PyTorch의 <code className="text-slate-800 font-mono font-bold">loss.backward()</code>와 <code className="text-slate-800 font-mono font-bold">optimizer.step()</code>이 화면 속 그래프의 기울기 및 공의 이동과 완전히 일치합니다.
          </p>
        </div>
      )}
    </div>
  );
};
