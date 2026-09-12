import React, { useState } from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import LatexRenderer from './LatexRenderer';
import type { AnalysisResult, Path, Step } from '../types';

const names = { student: '내 풀이', standard: '표준 풀이', shortcut: '단축 풀이', genius: '심화 풀이' };
interface AnalysisResultsProps {
  result: AnalysisResult;
  selectedPath: Path | null;
  errorMessage: string | null;
  isGeneratingSimilar: boolean;
  onPathSelect: (path: Path) => void;
  onPracticeSimilar: () => void;
  onCancelPractice: () => void;
  onReset: () => void;
  previewUrl?: string | null;
  originalText?: string;
  hasStudentWork?: boolean;
}

const StepContent: React.FC<{ step: Step }> = ({ step }) => {
  return <>
    <div className="equation"><LatexRenderer latex={step.latex} displayMode /></div>
    <p className="explanation">{step.explanation}</p>
    {step.visualization && <div className="matrix-row">{[step.visualization.matrixA, step.visualization.matrixB, step.visualization.resultMatrix].filter(Boolean).map((matrix, index) => <LatexRenderer key={index} latex={'\\begin{bmatrix}' + matrix!.map(row => row.join(' & ')).join(' \\\\ ') + '\\end{bmatrix}'} displayMode />)}</div>}
    {step.isError && <details className="correction"><summary>수정 풀이 보기</summary>{step.correction ? <LatexRenderer latex={step.correction} /> : <p>수정식이 제공되지 않았어요. 표준 풀이를 함께 확인해 주세요.</p>}</details>}
  </>;
}

export default function AnalysisResults(props: AnalysisResultsProps) {
  const { result } = props;
  const path = props.selectedPath || result.studentPath;
  const [selection, setSelection] = useState<{ path: Path; index: number } | null>(null);
  const [compare, setCompare] = useState(false);
  const [comparisonSide, setComparisonSide] = useState(0);
  const firstError = path.steps.findIndex(step => step.isError);
  const index = selection?.path === path ? selection.index : Math.max(0, firstError);
  const step = path.steps[index];
  const standard = result.alternatives.find(item => item.type === 'standard');
  const other = path.type === 'standard' ? result.studentPath : standard;
  const title = (item: Path) => item.type === 'student' && props.hasStudentWork === false ? '문제 풀이' : names[item.type];
  const errors = result.studentPath.steps.filter(item => item.isError).length;
  return <div className="results-page">
    <div className="section-heading"><div><p className="eyebrow">나의 풀이 노트</p><h1>생각의 흐름을 살펴봐요</h1></div><button className="secondary" onClick={props.onReset}>새 문제 풀기</button></div>
    {props.errorMessage && <div className="error-banner" role="alert">{props.errorMessage}</div>}
    <section className="paper problem-paper"><h2>이번 문제</h2><div className="equation"><LatexRenderer latex={result.problemLatex} displayMode /></div><p>{result.problemDescription}</p>
      {(props.previewUrl || props.originalText) && <details><summary>입력한 원본 보기</summary>{props.previewUrl && <a href={props.previewUrl} target="_blank" rel="noreferrer"><img className="original-image" src={props.previewUrl} alt="입력한 풀이 원본 · 클릭하여 확대" /></a>}{props.originalText && <pre>{props.originalText}</pre>}</details>}
    </section>
    <section className="feedback-strip"><AlertCircle size={22} /><div><h2>{props.hasStudentWork === false ? '풀이의 핵심' : errors ? errors + '개 단계에서 다시 살펴볼 부분이 있어요' : '풀이를 함께 확인해 봐요'}</h2><p>{result.feedback.summary}</p></div>{errors > 0 && props.hasStudentWork !== false && <button className="text-button" onClick={() => { props.onPathSelect(result.studentPath); setSelection({ path: result.studentPath, index: result.studentPath.steps.findIndex(item => item.isError) }); setCompare(false); }}>첫 오류 보기 <ArrowRight size={16} /></button>}</section>
    <div className="path-toolbar"><div className="path-tabs" role="group" aria-label="풀이 경로">{[result.studentPath, ...result.alternatives].map(item => <button key={item.type} aria-pressed={path.type === item.type} onClick={() => props.onPathSelect(item)}>{title(item)}<span>{item.steps.length}단계</span></button>)}</div>{other && <button className="secondary" aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? '단계별로 보기' : '풀이 비교하기'}</button>}</div>
    {compare && other ? <>
      <p className="small muted">각 풀이의 순서대로 표시합니다. 같은 번호가 같은 계산을 뜻하지는 않아요.</p>
      <div className="mobile-comparison mode-switch" role="group" aria-label="비교할 풀이">{[path, other].map((item, side) => <button key={side} aria-pressed={comparisonSide === side} onClick={() => setComparisonSide(side)}>{title(item)}</button>)}</div>
      <div className="comparison-grid">{[path, other].map((item, side) => <section key={side} className={'paper comparison-paper' + (comparisonSide !== side ? ' mobile-hidden' : '')}><h2>{title(item)}</h2><p className="muted">{item.description}</p><ol className="comparison-steps">{item.steps.map((itemStep, itemIndex) => <li key={itemIndex}><h3>{itemStep.stepNumber}단계{itemStep.isError ? ' · 확인 필요' : ''}</h3><StepContent step={itemStep} /></li>)}</ol></section>)}</div>
    </> : <section className="paper step-workspace">
      <nav className="step-list" aria-label="풀이 단계"><h2>{title(path)}</h2><p className="small muted">단계를 눌러 자세히 확인하세요</p>{path.steps.map((item, itemIndex) => <button key={itemIndex} aria-current={index === itemIndex ? 'step' : undefined} onClick={() => setSelection({ path, index: itemIndex })}><span className={'step-dot' + (item.isError ? ' has-error' : '')}>{item.stepNumber}</span><span>{item.stepNumber}단계<small>{item.isError ? '다시 살펴보기' : item.strategy || '풀이 과정'}</small></span>{item.isError && <AlertCircle size={16} />}</button>)}</nav>
      <div className="step-detail" aria-live="polite">{step ? <><p className="eyebrow">{title(path)} · {step.stepNumber}단계 / {path.steps.length}</p><h2>{step.isError ? '이 단계에서 다시 확인해요' : '한 단계씩 이해해요'}</h2><StepContent key={path.type + '-' + index} step={step} /><div className="step-pagination"><button className="secondary" disabled={index === 0} onClick={() => setSelection({ path, index: index - 1 })}>이전 단계</button><button className="secondary" disabled={index >= path.steps.length - 1} onClick={() => setSelection({ path, index: index + 1 })}>다음 단계 <ArrowRight size={16} /></button></div></> : <p>풀이 단계가 제공되지 않았어요. 다른 경로를 확인해 주세요.</p>}</div>
    </section>}
    {result.missingPaths.length > 0 && <details className="paper supplemental"><summary>일부 풀이 경로가 없는 이유</summary>{result.missingPaths.map(item => <p key={item.type}><strong>{names[item.type]}</strong> — {item.reason}</p>)}</details>}
    {props.hasStudentWork !== false && <details className="paper supplemental"><summary>AI 참고 평가 보기</summary><p className="small muted">AI의 추정치이며 실제 성적이나 검증된 학습 효과를 뜻하지 않습니다.</p><dl className="assessment">{[['계산 정확도', result.feedback.accuracy], ['개념 이해', result.feedback.conceptualUnderstanding], ['전략 효율', result.feedback.strategyEfficiency]].map(([label, score]) => <div key={label}><dt>{label}</dt><dd>{score} / 100</dd></div>)}</dl></details>}
    <section className="practice-strip"><div><h2>이제, 내 힘으로 풀어볼까요?</h2><p className="muted">비슷한 문제로 방금 살펴본 개념을 연습해요.</p></div><button className="primary" onClick={props.isGeneratingSimilar ? props.onCancelPractice : props.onPracticeSimilar}>{props.isGeneratingSimilar ? '유사 문제 생성 취소' : '유사 문제 풀기'} <ArrowRight size={18} /></button></section>
  </div>;
}
