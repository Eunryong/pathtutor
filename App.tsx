import React, { useEffect, useRef } from 'react';
import { GitBranch } from 'lucide-react';
import AnalysisInput from './components/AnalysisInput';
import AnalysisResults from './components/AnalysisResults';
import AnalysisLoading from './components/AnalysisLoading';
import { AppState } from './types';
import { useAnalyzeController } from './features/analyze/useAnalyzeController';

const App: React.FC = () => {
  const controller = useAnalyzeController();
  const mainRef = useRef<HTMLElement>(null);
  const previousState = useRef(controller.appState);
  useEffect(() => {
    if (previousState.current !== controller.appState) {
      mainRef.current?.focus();
      mainRef.current?.scrollIntoView({ block: 'start' });
      previousState.current = controller.appState;
    }
  }, [controller.appState]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={controller.handleReset} aria-label="PathTutor 처음으로"><GitBranch size={25} /><span>PathTutor<span className="brand-dot">.</span></span></button>
      <span className="header-note">나의 수학 풀이 노트</span>
    </div></header>
    <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
      {(controller.appState === AppState.IDLE || controller.appState === AppState.ERROR) && <AnalysisInput
        inputProblem={controller.inputProblem} selectedFile={controller.selectedFile} previewUrl={controller.previewUrl}
        errorMessage={controller.errorMessage} canSubmit={controller.canSubmit}
        onInputChange={controller.setInputProblem} onFileChange={controller.handleFileChange}
        onUseSample={controller.handleUseSample} onSubmit={controller.handleAnalysis}
        onExample={controller.handleExample} hasStudentWork={controller.hasStudentWork} onModeChange={controller.setHasStudentWork} />}
      {controller.appState === AppState.ANALYZING && <AnalysisLoading text={controller.inputProblem} previewUrl={controller.previewUrl} onCancel={controller.handleCancelAnalysis} />}
      {controller.appState === AppState.RESULTS && controller.analysisResult && <>
        {controller.isExample && <p className="example-banner">예시 노트 · 직접 작성한 결과입니다. 예시의 유사 문제도 AI 호출 없이 제공됩니다.</p>}
        <AnalysisResults result={controller.analysisResult} selectedPath={controller.selectedPath}
          errorMessage={controller.errorMessage} isGeneratingSimilar={controller.isGeneratingSimilar}
          onPathSelect={controller.setSelectedPath} onPracticeSimilar={controller.handlePracticeSimilar}
          onCancelPractice={controller.handleCancelPractice} onReset={controller.handleReset}
          previewUrl={controller.previewUrl} originalText={controller.inputProblem} hasStudentWork={controller.hasStudentWork} />
      </>}
    </main>
    <footer className="site-footer"><span>PathTutor · 정답으로 가는 나만의 길</span><span>AI 분석은 틀릴 수 있어요. 원문과 풀이를 함께 확인해 주세요.</span></footer>
  </div>;
};
export default App;
