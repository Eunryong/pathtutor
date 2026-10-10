import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, BrainCircuit } from 'lucide-react';
import { DataSpaceView } from './DataSpaceView';
import { LossSpaceView } from './LossSpaceView';
import { ControllerBar } from './ControllerBar';
import { ExplanationPanel } from './ExplanationPanel';
import { PredictStepChallenge } from './PredictStepChallenge';
import {
  stepGradientDescent,
  evaluateConvergence,
  StepRecord,
} from '../../services/mathEngine';

export const GradientDescentPlayground: React.FC = () => {
  // Model state: target point is (2, 4), target w is 2.0
  const [w, setW] = useState<number>(0.5);
  const [initialW, setInitialW] = useState<number>(0.5);
  const [lr, setLr] = useState<number>(0.1);
  const [stepCount, setStepCount] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [history, setHistory] = useState<StepRecord[]>([
    {
      step: 0,
      w: 0.5,
      prediction: 1.0,
      residual: 3.0,
      loss: 9.0,
      gradient: -12.0,
    },
  ]);
  const [stationaryNotice, setStationaryNotice] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  // Check if current weight has converged to target minimum (w=2.0)
  const isConverged = Math.abs(w - 2.0) < 1e-4;

  // Single step execution
  const handleStep = useCallback(() => {
    setW((prevW) => {
      // If already at minimum, trigger stationary feedback without increasing step count
      if (Math.abs(prevW - 2.0) < 1e-4) {
        setIsPlaying(false);
        setStationaryNotice(true);
        return prevW;
      }

      setStationaryNotice(false);

      // Divergence guard: stop auto-play if w explodes
      if (Math.abs(prevW) > 100) {
        setIsPlaying(false);
        return prevW;
      }

      const { nextW, record } = stepGradientDescent(prevW, lr, 2.0, 4.0);
      record.step = stepCount + 1;

      setStepCount((prev) => prev + 1);
      setHistory((prevHist) => [...prevHist.slice(-20), record]);

      // If perfectly converged on this step, pause auto-play and trigger notice
      if (Math.abs(nextW - 2.0) < 1e-4) {
        setIsPlaying(false);
        setStationaryNotice(true);
      }

      return nextW;
    });
  }, [lr, stepCount]);

  // Auto-play interval
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        handleStep();
      }, 550);
    } else if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, handleStep]);

  // Reset to initial w
  const handleReset = () => {
    setIsPlaying(false);
    setStationaryNotice(false);
    setW(initialW);
    setStepCount(0);
    const { record } = stepGradientDescent(initialW, lr, 2.0, 4.0);
    setHistory([record]);
  };

  // Change weight manually via slider
  const handleWChange = (newW: number) => {
    setIsPlaying(false);
    setStationaryNotice(false);
    setW(newW);
    setInitialW(newW);
    setStepCount(0);
    const { record } = stepGradientDescent(newW, lr, 2.0, 4.0);
    setHistory([record]);
  };

  // Change learning rate
  const handleLrChange = (newLr: number) => {
    setLr(newLr);
  };

  // Preset selection
  const handleSelectPreset = (presetW: number, presetLr: number) => {
    setIsPlaying(false);
    setStationaryNotice(false);
    setW(presetW);
    setInitialW(presetW);
    setLr(presetLr);
    setStepCount(0);
    const { record } = stepGradientDescent(presetW, presetLr, 2.0, 4.0);
    setHistory([record]);
  };

  // Real-time convergence assessment
  const convergence = evaluateConvergence(lr, w, 2.0, 2.0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-7 rounded-2xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-400/20">
              <Sparkles size={13} /> PathTutor AI 수학 Lab · Chapter 1
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <BrainCircuit className="text-blue-400" size={30} />
              모델은 어떻게 학습할까? 경사하강법과 미분
            </h1>
            <p className="text-slate-300 text-sm mt-1.5 max-w-2xl leading-relaxed">
              수식만 외우던 미분은 이제 그만. 예측선과 2D 손실 곡선이 실시간으로 맞물려 돌아가는 모습을
              조작하며, <strong>오차를 줄이는 과정(학습) 속에서 미분의 본질</strong>을 자연스럽게
              발견하세요.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 text-xs space-y-1">
            <span className="text-blue-200 font-semibold block">토이 모델 스펙</span>
            <div className="font-mono text-slate-100">
              모델: <span className="text-blue-300 font-bold">ŷ = wx</span>
            </div>
            <div className="font-mono text-slate-100">
              데이터: <span className="text-emerald-300 font-bold">(2, 4)</span>
            </div>
            <div className="font-mono text-slate-100">
              목표 가중치: <span className="text-amber-300 font-bold">w = 2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dual Interactive Views */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DataSpaceView w={w} targetX={2.0} targetY={4.0} />
        <LossSpaceView w={w} lr={lr} history={history} targetX={2.0} targetY={4.0} />
      </div>

      {/* Interactive Controls */}
      <ControllerBar
        w={w}
        lr={lr}
        stepCount={stepCount}
        isPlaying={isPlaying}
        isConverged={isConverged}
        convergence={convergence}
        stationaryNotice={stationaryNotice}
        onWChange={handleWChange}
        onLrChange={handleLrChange}
        onStep={handleStep}
        onTogglePlay={() => setIsPlaying((prev) => !prev)}
        onReset={handleReset}
        onSelectPreset={handleSelectPreset}
      />

      {/* Interactive Predict & Step Challenge */}
      <PredictStepChallenge
        w={w}
        lr={lr}
        isConverged={isConverged}
        onStep={handleStep}
        onReset={handleReset}
      />

      {/* Explanation & PyTorch Code Panels */}
      <ExplanationPanel w={w} lr={lr} stepCount={stepCount} />
    </div>
  );
};
