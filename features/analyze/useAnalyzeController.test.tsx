/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '../../types';
import { AppState } from '../../types';
import { useAnalyzeController } from './useAnalyzeController';

const mocks = vi.hoisted(() => ({
  analyzeMathSolution: vi.fn(),
  generateSimilarProblem: vi.fn(),
  getApiErrorMessage: vi.fn(() => '요청에 실패했습니다.'),
}));

vi.mock('../../services/clientApi', () => mocks);

const analysisResult: AnalysisResult = {
  problemLatex: 'x + 1 = 2',
  problemDescription: 'A linear equation',
  studentPath: {
    name: 'Student Path',
    description: 'Submitted solution',
    type: 'student',
    steps: [{ stepNumber: 1, latex: 'x = 2', explanation: 'Solve the equation.' }],
  },
  alternatives: [{
    name: 'Standard Path',
    description: 'Standard solution',
    type: 'standard',
    steps: [{ stepNumber: 1, latex: 'x = 2', explanation: 'Solve the equation.' }],
  }],
  missingPaths: [],
  feedback: {
    accuracy: 90,
    conceptualUnderstanding: 90,
    strategyEfficiency: 90,
    summary: 'Good work.',
  },
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useAnalyzeController', () => {
  it('opens an offline example and practice without calling either API', async () => {
    const { result } = renderHook(() => useAnalyzeController());
    act(() => result.current.handleExample());
    expect(result.current.appState).toBe(AppState.RESULTS);
    expect(result.current.isExample).toBe(true);
    expect(result.current.analysisResult?.problemLatex).toBe('2x + 3 = 7');
    await act(async () => result.current.handlePracticeSimilar());
    expect(result.current.appState).toBe(AppState.IDLE);
    expect(result.current.inputProblem).toContain('3x + 4 = 10');
    expect(mocks.analyzeMathSolution).not.toHaveBeenCalled();
    expect(mocks.generateSimilarProblem).not.toHaveBeenCalled();
  });

  it('removes the selected image and releases its preview URL', () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:example'), revokeObjectURL });
    const { result } = renderHook(() => useAnalyzeController());
    act(() => result.current.handleFileChange(new File(['image'], 'work.png', { type: 'image/png' })));
    expect(result.current.previewUrl).toBe('blob:example');
    act(() => result.current.handleFileChange(null));
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.previewUrl).toBeNull();
    expect(result.current.canSubmit).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:example');
  });

  it('informs the API that problem-only input is not student work', async () => {
    mocks.analyzeMathSolution.mockResolvedValue(analysisResult);
    const { result } = renderHook(() => useAnalyzeController());
    act(() => { result.current.setInputProblem('x + 1 = 2'); result.current.setHasStudentWork(false); });
    await act(async () => result.current.handleAnalysis());
    expect(mocks.analyzeMathSolution).toHaveBeenCalledWith(expect.stringContaining('학생 풀이가 없는 문제 질문'), null, expect.any(AbortSignal));
  });

  it('does not let a late analysis response replace a cancelled state', async () => {
    let resolveAnalysis: (value: AnalysisResult) => void = () => undefined;
    mocks.analyzeMathSolution.mockReturnValue(new Promise<AnalysisResult>((resolve) => {
      resolveAnalysis = resolve;
    }));

    const { result } = renderHook(() => useAnalyzeController());
    act(() => result.current.setInputProblem('x + 1 = 2'));
    act(() => {
      void result.current.handleAnalysis();
    });
    expect(result.current.appState).toBe(AppState.ANALYZING);

    act(() => result.current.handleCancelAnalysis());
    await act(async () => {
      resolveAnalysis(analysisResult);
      await Promise.resolve();
    });

    expect(result.current.appState).toBe(AppState.ERROR);
    expect(result.current.analysisResult).toBeNull();
    expect(result.current.errorMessage).toBe('분석을 취소했습니다.');
  });

  it('cancels practice generation and ignores its late response', async () => {
    mocks.analyzeMathSolution.mockResolvedValue(analysisResult);
    let resolvePractice: (value: string) => void = () => undefined;
    mocks.generateSimilarProblem.mockReturnValue(new Promise<string>((resolve) => {
      resolvePractice = resolve;
    }));

    const { result } = renderHook(() => useAnalyzeController());
    act(() => result.current.setInputProblem('x + 1 = 2'));
    await act(async () => {
      await result.current.handleAnalysis();
    });
    expect(result.current.appState).toBe(AppState.RESULTS);

    act(() => {
      void result.current.handlePracticeSimilar();
    });
    expect(result.current.isGeneratingSimilar).toBe(true);

    act(() => result.current.handleCancelPractice());
    await act(async () => {
      resolvePractice('late response');
      await Promise.resolve();
    });

    expect(result.current.appState).toBe(AppState.RESULTS);
    expect(result.current.isGeneratingSimilar).toBe(false);
    expect(result.current.inputProblem).toBe('x + 1 = 2');
    expect(result.current.errorMessage).toBe('유사 문제 생성을 취소했습니다.');
  });
});
