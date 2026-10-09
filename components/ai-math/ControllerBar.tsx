import React from 'react';
import { Play, Pause, RotateCcw, Footprints, Sparkles } from 'lucide-react';
import { ConvergenceInfo } from '../../services/mathEngine';

interface ControllerBarProps {
  w: number;
  lr: number;
  stepCount: number;
  isPlaying: boolean;
  convergence: ConvergenceInfo;
  onWChange: (newW: number) => void;
  onLrChange: (newLr: number) => void;
  onStep: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onSelectPreset: (presetW: number, presetLr: number) => void;
}

export const ControllerBar: React.FC<ControllerBarProps> = ({
  w,
  lr,
  stepCount,
  isPlaying,
  convergence,
  onWChange,
  onLrChange,
  onStep,
  onTogglePlay,
  onReset,
  onSelectPreset,
}) => {
  const getBadgeStyle = (level: ConvergenceInfo['statusLevel']) => {
    switch (level) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'danger':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Top Row: Presets & Convergence Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Sparkles size={13} className="text-blue-500" /> 실험 프리셋:
          </span>
          <button
            type="button"
            onClick={() => onSelectPreset(0.5, 0.1)}
            className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 transition font-medium"
          >
            기본 수렴 (η=0.1)
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset(0.5, 0.125)}
            className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition font-medium"
          >
            1스텝 도달 (η=0.125)
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset(0.5, 0.25)}
            className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-700 transition font-medium"
          >
            무한 진동 (η=0.25)
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset(0.5, 0.3)}
            className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 transition font-medium"
          >
            수치 발산 (η=0.30)
          </button>
        </div>

        <div
          className={`text-xs px-3 py-1 rounded-full border font-medium flex items-center gap-1.5 ${getBadgeStyle(
            convergence.statusLevel
          )}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
          <span>{convergence.title}</span>
        </div>
      </div>

      {/* Middle Row: Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Weight Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="weight-slider" className="font-bold text-slate-700">
              가중치 w (현재 값)
            </label>
            <span className="font-mono text-sm font-bold text-blue-600">
              w = {w.toFixed(2)}
            </span>
          </div>
          <input
            id="weight-slider"
            type="range"
            min="0.0"
            max="4.0"
            step="0.05"
            value={w}
            disabled={isPlaying}
            onChange={(e) => onWChange(parseFloat(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>0.0</span>
            <span className="text-emerald-700 font-bold">최저점 2.0</span>
            <span>4.0</span>
          </div>
        </div>

        {/* Learning Rate Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="lr-slider" className="font-bold text-slate-700">
              학습률 η (Learning Rate)
            </label>
            <span className="font-mono text-sm font-bold text-violet-600">
              η = {lr.toFixed(3)}
            </span>
          </div>
          <input
            id="lr-slider"
            type="range"
            min="0.01"
            max="0.35"
            step="0.005"
            value={lr}
            disabled={isPlaying}
            onChange={(e) => onLrChange(parseFloat(e.target.value))}
            className="w-full accent-violet-600 cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>0.01</span>
            <span className="text-emerald-700 font-semibold">0.125 (1스텝)</span>
            <span className="text-rose-700 font-semibold">0.25 (발산경계)</span>
            <span>0.35</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-500 font-mono">
          누적 스텝: <strong className="text-slate-800 text-sm">{stepCount}</strong> 회
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition"
            title="초기 상태로 리셋"
          >
            <RotateCcw size={14} /> 리셋
          </button>

          <button
            type="button"
            onClick={onStep}
            disabled={isPlaying}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Footprints size={14} /> 한 걸음 이동 (Step)
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95 text-white ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={14} /> 일시정지
              </>
            ) : (
              <>
                <Play size={14} /> 자동 학습 (Play)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
