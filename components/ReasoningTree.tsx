import React from 'react';
import { AnalysisResult, Path } from '../types';
import { Network, Zap, BookOpen, BrainCircuit } from 'lucide-react';

interface ReasoningTreeProps {
  data: AnalysisResult;
  onPathSelect: (path: Path) => void;
  selectedPath: Path | null;
}

const PathIcon = ({ type, className }: { type: string, className?: string }) => {
  switch (type) {
    case 'student': return <Network className={className} />;
    case 'standard': return <BookOpen className={className} />;
    case 'shortcut': return <Zap className={className} />;
    case 'genius': return <BrainCircuit className={className} />;
    default: return <BookOpen className={className} />;
  }
};

const ReasoningTree: React.FC<ReasoningTreeProps> = ({ data, onPathSelect, selectedPath }) => {
  // Defensive coding: Ensure arrays exist before spreading
  const alternatives = data?.alternatives || [];
  const studentPath = data?.studentPath;
  
  const paths = [studentPath, ...alternatives].filter((p): p is Path => !!p);

  return (
    <div className="w-full bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
        <Network className="w-5 h-5 text-indigo-400" />
        Reasoning Tree Reconstruction
      </h3>

      <div className="relative flex flex-col md:flex-row justify-between items-start gap-4">
        {/* Connection Lines (Visual Only - simplified for React) */}
        <div className="absolute top-8 left-0 w-full h-0.5 bg-slate-700 hidden md:block -z-10" />

        {paths.map((path, idx) => {
          const isSelected = selectedPath?.type === path.type;
          
          let borderColor = "border-slate-600";
          let bgColor = "bg-slate-800";
          let textColor = "text-slate-400";
          let ringColor = "";

          if (path.type === 'student') {
             borderColor = "border-yellow-500/50";
             textColor = "text-yellow-400";
             if(isSelected) ringColor = "ring-yellow-500";
          } else if (path.type === 'standard') {
             borderColor = "border-blue-500/50";
             textColor = "text-blue-400";
             if(isSelected) ringColor = "ring-blue-500";
          } else if (path.type === 'shortcut') {
             borderColor = "border-emerald-500/50";
             textColor = "text-emerald-400";
             if(isSelected) ringColor = "ring-emerald-500";
          } else if (path.type === 'genius') {
             borderColor = "border-purple-500/50";
             textColor = "text-purple-400";
             if(isSelected) ringColor = "ring-purple-500";
          }

          if (isSelected) {
            bgColor = "bg-slate-700";
          }

          return (
            <button
              key={idx}
              onClick={() => onPathSelect(path)}
              aria-pressed={isSelected}
              aria-label={`${path.name} 경로 선택`}
              className={`
                relative flex flex-col items-center w-full md:w-1/4 p-4 rounded-lg border-2 transition-all duration-300
                ${borderColor} ${bgColor} ${isSelected ? 'ring-2 ' + ringColor + ' scale-105' : 'hover:bg-slate-750'}
              `}
            >
              <div className={`p-3 rounded-full mb-3 ${path.type === 'student' ? 'bg-yellow-500/10' : 'bg-slate-900'} border border-slate-700`}>
                 <PathIcon type={path.type} className={`w-6 h-6 ${textColor}`} />
              </div>
              
              <h4 className={`font-bold uppercase text-xs tracking-wider mb-1 ${textColor}`}>
                {path.name}
              </h4>
              <p className="text-xs text-slate-400 text-center line-clamp-2">
                {path.description}
              </p>
              
              {path.type === 'student' && (
                <span className="absolute -top-3 right-4 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-mono rounded border border-yellow-500/30">
                  DETECTED
                </span>
              )}
            </button>
          );
        })}
      </div>

      {data.missingPaths?.length > 0 && (
        <div className="mt-5 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Paths not shown
          </p>
          <ul className="mt-2 space-y-2">
            {data.missingPaths.map((missingPath) => (
              <li key={missingPath.type} className="text-sm text-slate-400">
                <span className="font-medium text-slate-300">{missingPath.type}</span>
                <span className="mx-2 text-slate-600">—</span>
                {missingPath.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ReasoningTree;
