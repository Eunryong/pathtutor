/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnalysisInput from './AnalysisInput';

function renderInput(overrides: Partial<ComponentProps<typeof AnalysisInput>> = {}) {
  const props: ComponentProps<typeof AnalysisInput> = {
    inputProblem: '',
    selectedFile: null,
    previewUrl: null,
    errorMessage: null,
    canSubmit: false,
    onInputChange: vi.fn(),
    onFileChange: vi.fn().mockReturnValue(true),
    onUseSample: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  return { ...render(<AnalysisInput {...props} />), props };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AnalysisInput', () => {
  it('supports dropped and pasted images, removal, mode selection, and offline examples', () => {
    const onFileChange = vi.fn();
    const onModeChange = vi.fn();
    const onExample = vi.fn();
    const file = new File(['image'], 'work.png', { type: 'image/png' });
    const { container } = renderInput({ selectedFile: file, onFileChange, onModeChange, onExample });
    fireEvent.drop(container.querySelector('.upload-zone')!, { dataTransfer: { files: [file] } });
    expect(onFileChange).toHaveBeenLastCalledWith(file);
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [file] } });
    expect(onFileChange).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onFileChange).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: '문제만 질문' }));
    expect(onModeChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: /예시 결과 둘러보기/ }));
    expect(onExample).toHaveBeenCalledOnce();
  });
  it('keeps submit disabled until the controller reports valid input', () => {
    const { rerender, props } = renderInput();
    const submitButton = screen.getByRole('button', { name: /풀이 분석하기/i });

    expect(submitButton).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x + 1 = 2' } });
    expect(props.onInputChange).toHaveBeenCalledWith('x + 1 = 2');

    rerender(<AnalysisInput {...props} inputProblem="x + 1 = 2" canSubmit />);
    expect(screen.getByRole('button', { name: /풀이 분석하기/i })).toBeEnabled();
  });

  it('passes selected files to the controller and clears rejected file input', () => {
    const onFileChange = vi.fn().mockReturnValue(false);
    const { container } = renderInput({ onFileChange });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['not an image'], 'notes.txt', { type: 'text/plain' });

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: {
        0: invalidFile,
        length: 1,
        item: (index: number) => index === 0 ? invalidFile : null,
      },
    });
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onFileChange).toHaveBeenCalledWith(invalidFile);
    expect(fileInput.value).toBe('');
  });

  it('shows the current error and selected file name inline', () => {
    const file = new File(['image'], 'solution.png', { type: 'image/png' });
    renderInput({
      selectedFile: file,
      previewUrl: 'blob:test-preview',
      errorMessage: '입력값을 확인해 주세요.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('입력값을 확인해 주세요.');
    expect(screen.getByText('solution.png')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '선택한 풀이 미리보기' })).toHaveAttribute('src', 'blob:test-preview');
  });
});
