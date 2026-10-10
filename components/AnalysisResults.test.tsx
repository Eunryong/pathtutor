/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnalysisResults from './AnalysisResults';
import type { AnalysisResult, Path } from '../types';
import { EXAMPLE_ANALYSIS } from '../shared/exampleAnalysis';

const studentPath: Path = {
  name: 'Student Path',
  description: 'The submitted solution.',
  type: 'student',
  steps: [{
    stepNumber: 1,
    latex: 'x = 3',
    explanation: 'The calculation contains an error.',
    isError: true,
    correction: 'x = 2',
  }],
};

const standardPath: Path = {
  name: 'Standard Path',
  description: 'The standard solution.',
  type: 'standard',
  steps: [{ stepNumber: 1, latex: 'x = 2', explanation: 'Solve the equation.' }],
};

const result: AnalysisResult = {
  problemLatex: 'x + 1 = 2',
  problemDescription: 'A linear equation',
  studentPath,
  alternatives: [standardPath],
  missingPaths: [
    { type: 'shortcut', reason: 'No shortcut is useful for this problem.' },
    { type: 'genius', reason: 'No deeper method is needed.' },
  ],
  feedback: {
    accuracy: 80,
    conceptualUnderstanding: 75,
    strategyEfficiency: 70,
    summary: 'Good progress.',
  },
};

function renderResults() {
  return render(
    <AnalysisResults
      result={result}
      selectedPath={studentPath}
      errorMessage="분석 결과를 확인해 주세요."
      isGeneratingSimilar={false}
      onPathSelect={vi.fn()}
      onPracticeSimilar={vi.fn()}
      onCancelPractice={vi.fn()}
      onReset={vi.fn()}
    />,
  );
}

describe('AnalysisResults', () => {
  it('selects the first error, navigates steps and opens a comparison', () => {
    render(<AnalysisResults result={EXAMPLE_ANALYSIS} selectedPath={EXAMPLE_ANALYSIS.studentPath}
      errorMessage={null} isGeneratingSimilar={false} onPathSelect={vi.fn()}
      onPracticeSimilar={vi.fn()} onCancelPractice={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: /2단계.*다시 살펴보기/ })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByText('수정 풀이 보기'));
    expect(screen.getByText('수정 풀이 보기').closest('details')).toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: '이전 단계' }));
    expect(screen.getByRole('button', { name: '이전 단계' })).toBeDisabled();
    expect(screen.queryByText('수정 풀이 보기')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '풀이 비교하기' }));
    expect(screen.getByText(/같은 번호가 같은 계산을 뜻하지는/)).toBeInTheDocument();
    expect(screen.getAllByText('표준 풀이').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: '단계별로 보기' }));
    expect(screen.getByRole('navigation', { name: '풀이 단계' })).toBeInTheDocument();
  });
  afterEach(() => {
    cleanup();
  });

  it('shows the selected path, error feedback, missing reasons, and inline error', () => {
    renderResults();

    expect(screen.getByRole('button', { name: /내 풀이/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /내 풀이/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByText('일부 풀이 경로가 없는 이유'));
    expect(screen.getByText(/No shortcut is useful for this problem/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('분석 결과를 확인해 주세요.');
    expect(screen.getByText('이 단계에서 다시 확인해요')).toBeInTheDocument();
  });

  it('exposes path selection, practice, and reset actions to the parent', () => {
    const onPathSelect = vi.fn();
    const onPracticeSimilar = vi.fn();
    const onCancelPractice = vi.fn();
    const onReset = vi.fn();
    render(
      <AnalysisResults
        result={result}
        selectedPath={studentPath}
        errorMessage={null}
        isGeneratingSimilar={false}
        onPathSelect={onPathSelect}
        onPracticeSimilar={onPracticeSimilar}
        onCancelPractice={onCancelPractice}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /표준 풀이/i }));
    fireEvent.click(screen.getByRole('button', { name: /유사 문제 풀기/i }));
    fireEvent.click(screen.getByRole('button', { name: /새 문제 풀기/i }));

    expect(onPathSelect).toHaveBeenCalledWith(standardPath);
    expect(onPracticeSimilar).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('lets the user cancel an in-flight practice request', () => {
    const onCancelPractice = vi.fn();
    render(
      <AnalysisResults
        result={result}
        selectedPath={studentPath}
        errorMessage={null}
        isGeneratingSimilar
        onPathSelect={vi.fn()}
        onPracticeSimilar={vi.fn()}
        onCancelPractice={onCancelPractice}
        onReset={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /유사 문제 생성 취소/i }));
    expect(onCancelPractice).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenAiMath callback when clicking AI Math Lab bridge button', () => {
    const onOpenAiMath = vi.fn();
    render(
      <AnalysisResults
        result={result}
        selectedPath={studentPath}
        errorMessage={null}
        isGeneratingSimilar={false}
        onPathSelect={vi.fn()}
        onPracticeSimilar={vi.fn()}
        onCancelPractice={vi.fn()}
        onReset={vi.fn()}
        onOpenAiMath={onOpenAiMath}
      />,
    );

    expect(screen.getByText(/이 수학 개념, AI에서는 어떻게 쓰일까요\?/i)).toBeInTheDocument();
    const aiMathBtn = screen.getByRole('button', { name: /AI 수학 Lab 체험하기/i });
    fireEvent.click(aiMathBtn);
    expect(onOpenAiMath).toHaveBeenCalledTimes(1);
  });
});
