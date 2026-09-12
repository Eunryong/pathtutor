import React from 'react';
import { MatrixVisualization } from '../types';

interface MatrixGridProps {
  data: MatrixVisualization;
}

const MatrixGrid: React.FC<MatrixGridProps> = ({ data }) => {
  // Defensive checks: ensure data and required matrices exist and are arrays
  if (!data || !Array.isArray(data.matrixA) || !Array.isArray(data.matrixB)) {
    return null;
  }

  const { matrixA, matrixB, resultMatrix } = data;

  // Ensure matrices are not empty to avoid matrixB[0] undefined errors
  if (matrixA.length === 0 || matrixB.length === 0) {
    return null;
  }

  // Ensure matrixB has at least one row with columns
  if (!matrixB[0] || !Array.isArray(matrixB[0])) {
    return null;
  }

  // Render a single cell
  const renderCell = (val: string, idx: number, isHeader = false) => (
    <div 
      key={idx} 
      className={`
        w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-sm md:text-base font-mono
        ${isHeader ? 'font-bold text-slate-200' : 'text-slate-400'}
      `}
    >
      {val}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center my-6 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Matrix Multiplication Grid</p>
      
      <div className="grid" style={{ 
        gridTemplateColumns: 'min-content min-content', 
        gridTemplateRows: 'min-content min-content' 
      }}>
        
        {/* Top Left: Empty Spacer */}
        <div className="border-b border-r border-slate-700/50"></div>

        {/* Top Right: Matrix B */}
        <div className="border-b border-slate-600 pl-4 pb-2">
            <div className="flex flex-col gap-1">
                {matrixB.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-2 justify-center">
                        {Array.isArray(row) && row.map((val, cIdx) => renderCell(val, cIdx, true))}
                    </div>
                ))}
            </div>
        </div>

        {/* Bottom Left: Matrix A */}
        <div className="border-r border-slate-600 pt-2 pr-4">
             <div className="flex flex-col gap-1">
                {matrixA.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-2 justify-end">
                        {Array.isArray(row) && row.map((val, cIdx) => renderCell(val, cIdx, true))}
                    </div>
                ))}
            </div>
        </div>

        {/* Bottom Right: Result Grid */}
        <div className="pt-2 pl-4">
             <div className="flex flex-col gap-1">
                {resultMatrix && Array.isArray(resultMatrix) && resultMatrix.length > 0 ? (
                    // If result exists, show values
                    resultMatrix.map((row, rIdx) => (
                        <div key={rIdx} className="flex gap-2 justify-center">
                            {Array.isArray(row) && row.map((val, cIdx) => (
                                <div key={cIdx} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-sm md:text-base font-mono text-indigo-400 bg-indigo-500/10 rounded border border-indigo-500/30">
                                    {val}
                                </div>
                            ))}
                        </div>
                    ))
                ) : (
                    // If no result yet (or just showing structure), show empty placeholders matching B's cols and A's rows
                    matrixA.map((_, rIdx) => (
                        <div key={rIdx} className="flex gap-2 justify-center">
                            {matrixB[0].map((_, cIdx) => (
                                <div key={cIdx} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-slate-700">
                                    ·
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
      <p className="text-[10px] text-slate-500 mt-4 text-center max-w-sm">
        Falk's Scheme: Arrange Matrix A to the left and Matrix B above. The intersection determines the row/column pairing for calculation.
      </p>
    </div>
  );
};

export default MatrixGrid;