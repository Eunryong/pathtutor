/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AnalysisLoading from './AnalysisLoading';

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('shows real elapsed time, preserves input and supports cancellation without fake progress', () => {
  vi.useFakeTimers();
  const clearInterval = vi.spyOn(window, 'clearInterval');
  const onCancel = vi.fn();
  const { unmount } = render(<AnalysisLoading text="2x + 3 = 7" previewUrl={null} onCancel={onCancel} />);
  expect(screen.getByRole('status')).toHaveTextContent('풀이를 살펴보고 있어요');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(31000));
  expect(screen.getByText('경과 시간 31초')).toBeInTheDocument();
  expect(screen.getByText(/분석이 길어지고 있어요/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('보낸 내용 확인하기'));
  expect(screen.getByText('2x + 3 = 7')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '분석 취소' }));
  expect(onCancel).toHaveBeenCalledOnce();
  unmount();
  expect(clearInterval).toHaveBeenCalledOnce();
  clearInterval.mockRestore();
});
