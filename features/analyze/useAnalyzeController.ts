import { useEffect, useRef, useState } from 'react';
import { analyzeMathSolution, generateSimilarProblem, getApiErrorMessage } from '../../services/clientApi';
import { AppState, type AnalysisResult, type Path } from '../../types';
import { EXAMPLE_ANALYSIS, EXAMPLE_INPUT } from '../../shared/exampleAnalysis';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);


export interface AnalyzeController {
  hasStudentWork: boolean;
  setHasStudentWork: (value: boolean) => void;
  isExample: boolean;
  handleExample: () => void;
  appState: AppState;
  inputProblem: string;
  selectedFile: File | null;
  previewUrl: string | null;
  analysisResult: AnalysisResult | null;
  selectedPath: Path | null;
  errorMessage: string | null;
  isGeneratingSimilar: boolean;
  canSubmit: boolean;
  setInputProblem: (value: string) => void;
  setSelectedPath: (path: Path) => void;
  handleFileChange: (file: File | null) => boolean;
  handleUseSample: () => void;
  handleAnalysis: () => Promise<void>;
  handleCancelAnalysis: () => void;
  handlePracticeSimilar: () => Promise<void>;
  handleCancelPractice: () => void;
  handleReset: () => void;
}

export function useAnalyzeController(): AnalyzeController {
  const [hasStudentWork, setHasStudentWork] = useState(true);
  const [isExample, setIsExample] = useState(false);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [inputProblem, setInputProblem] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<Path | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGeneratingSimilar, setIsGeneratingSimilar] = useState(false);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const practiceAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => () => {
    analysisAbortRef.current?.abort();
    practiceAbortRef.current?.abort();
  }, []);

  const handleFileChange = (file: File | null): boolean => {
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMessage(null);
      return true;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMessage('PNG, JPEG, WEBP 이미지만 업로드할 수 있습니다.');
      setAppState(AppState.ERROR);
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMessage('이미지 크기는 6MB 이내여야 합니다.');
      setAppState(AppState.ERROR);
      return false;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
    setAppState(AppState.IDLE);
    return true;
  };

  const handleUseSample = () => {
    setInputProblem(EXAMPLE_INPUT);
    setHasStudentWork(true);
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setAppState(AppState.IDLE);
  };

  const handleAnalysis = async () => {
    if (!inputProblem.trim() && !selectedFile) {
      setErrorMessage('문제 또는 풀이를 입력하거나 이미지를 첨부해 주세요.');
      setAppState(AppState.ERROR);
      return;
    }

    setIsExample(false);
    setAppState(AppState.ANALYZING);
    setErrorMessage(null);
    practiceAbortRef.current?.abort();
    practiceAbortRef.current = null;
    setIsGeneratingSimilar(false);
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    try {
      const requestText = hasStudentWork ? inputProblem : '학생 풀이가 없는 문제 질문입니다. 학생 오류나 이해도를 추정하지 말고 문제 풀이를 설명해 주세요.\n' + inputProblem;
      const result = await analyzeMathSolution(requestText, selectedFile, controller.signal);
      if (controller.signal.aborted) return;
      setAnalysisResult(result);
      setSelectedPath(hasStudentWork ? result.studentPath : result.alternatives.find(path => path.type === 'standard') || result.studentPath);
      setAppState(AppState.RESULTS);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error);
      setErrorMessage(getApiErrorMessage(error));
      setAppState(AppState.ERROR);
    } finally {
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
    }
  };

  const handleCancelAnalysis = () => {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setErrorMessage('분석을 취소했습니다.');
    setAppState(AppState.ERROR);
  };

  const handlePracticeSimilar = async () => {
    if (!analysisResult) return;
    if (isExample) {
      setInputProblem('연습 문제: 3x + 4 = 10에서 x의 값을 구해 보세요.\n내 풀이: ');
      setAnalysisResult(null);
      setSelectedPath(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      setHasStudentWork(true);
      setErrorMessage(null);
      setIsExample(false);
      setAppState(AppState.IDLE);
      return;
    }
    practiceAbortRef.current?.abort();
    const controller = new AbortController();
    practiceAbortRef.current = controller;
    setIsGeneratingSimilar(true);
    setErrorMessage(null);

    try {
      const newProblem = await generateSimilarProblem(
        analysisResult.problemLatex,
        analysisResult.problemDescription,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setInputProblem(newProblem);
      setHasStudentWork(false);
      setAnalysisResult(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedPath(null);
      setAppState(AppState.IDLE);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Failed to generate similar problem', error);
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      if (practiceAbortRef.current === controller) {
        practiceAbortRef.current = null;
        setIsGeneratingSimilar(false);
      }
    }
  };

  const handleCancelPractice = () => {
    practiceAbortRef.current?.abort();
    practiceAbortRef.current = null;
    setIsGeneratingSimilar(false);
    setErrorMessage('유사 문제 생성을 취소했습니다.');
  };

  const handleReset = () => {
    setIsExample(false);
    setHasStudentWork(true);
    analysisAbortRef.current?.abort();
    practiceAbortRef.current?.abort();
    practiceAbortRef.current = null;
    setAppState(AppState.IDLE);
    setAnalysisResult(null);
    setSelectedPath(null);
    setInputProblem('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setIsGeneratingSimilar(false);
  };

  return {
    hasStudentWork,
    setHasStudentWork,
    isExample,
    handleExample: () => {
      analysisAbortRef.current?.abort();
      practiceAbortRef.current?.abort();
      practiceAbortRef.current = null;
      setIsGeneratingSimilar(false);
      setInputProblem(EXAMPLE_INPUT);
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMessage(null);
      setHasStudentWork(true);
      setIsExample(true);
      setAnalysisResult(EXAMPLE_ANALYSIS);
      setSelectedPath(EXAMPLE_ANALYSIS.studentPath);
      setAppState(AppState.RESULTS);
    },
    appState,
    inputProblem,
    selectedFile,
    previewUrl,
    analysisResult,
    selectedPath,
    errorMessage,
    isGeneratingSimilar,
    canSubmit: Boolean(inputProblem.trim() || selectedFile),
    setInputProblem,
    setSelectedPath,
    handleFileChange,
    handleUseSample,
    handleAnalysis,
    handleCancelAnalysis,
    handlePracticeSimilar,
    handleCancelPractice,
    handleReset,
  };
}
