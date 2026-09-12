import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface MetricsChartProps {
  metrics: {
    accuracy: number;
    conceptualUnderstanding: number;
    strategyEfficiency: number;
  };
}

const MetricsChart: React.FC<MetricsChartProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-slate-500 text-xs">
        No metrics available
      </div>
    );
  }

  const data = [
    { subject: 'Accuracy', A: metrics.accuracy || 0, fullMark: 100 },
    { subject: 'Concept', A: metrics.conceptualUnderstanding || 0, fullMark: 100 },
    { subject: 'Efficiency', A: metrics.strategyEfficiency || 0, fullMark: 100 },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#475569" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <Radar
            name="Performance"
            dataKey="A"
            stroke="#818cf8"
            strokeWidth={3}
            fill="#818cf8"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MetricsChart;