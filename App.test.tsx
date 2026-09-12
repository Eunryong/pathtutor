/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import axe from 'axe-core';
import { EXAMPLE_ANALYSIS } from './shared/exampleAnalysis';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function success() {
  return new Response(JSON.stringify({ ok: true, data: EXAMPLE_ANALYSIS }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

it.each([
  ['network', () => Promise.reject(new TypeError('Failed to fetch')), /분석 서버와 통신하지 못했습니다/],
  ['timeout', () => Promise.resolve(new Response(JSON.stringify({ ok: false, error: { code: 'UPSTREAM_TIMEOUT', retryable: true } }), { status: 504 })), /분석 시간이 너무 오래/],
  ['server HTML', () => Promise.resolve(new Response('<h1>Unavailable</h1>', { status: 503 })), /분석 서버와 통신하지 못했습니다/],
] as const)('preserves input after %s and allows an explicit retry', async (_name, fail, message) => {
  const fetchMock = vi.fn().mockImplementationOnce(fail).mockResolvedValueOnce(success());
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '2x + 3 = 7' } });
  fireEvent.click(screen.getByRole('button', { name: '풀이 분석하기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('textbox')).toHaveValue('2x + 3 = 7');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '풀이 분석하기' }));
  expect(await screen.findByRole('heading', { name: '생각의 흐름을 살펴봐요' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(document.activeElement).toBe(screen.getByRole('main'));
});

it('aborts a pending fetch and keeps the input available', async () => {
  let requestSignal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
    requestSignal = options.signal;
    requestSignal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })));
  render(<App />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '2x + 3 = 7' } });
  fireEvent.click(screen.getByRole('button', { name: '풀이 분석하기' }));
  fireEvent.click(await screen.findByRole('button', { name: '분석 취소' }));
  await waitFor(() => expect(requestSignal?.aborted).toBe(true));
  expect(screen.getByRole('textbox')).toHaveValue('2x + 3 = 7');
  expect(screen.getByRole('alert')).toHaveTextContent('분석을 취소했습니다.');
});

it('opens offline results without network requests and moves focus to main', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '예시 결과 둘러보기' }));
  expect(screen.getByRole('heading', { name: '생각의 흐름을 살펴봐요' })).toBeInTheDocument();
  expect(document.activeElement).toBe(screen.getByRole('main'));
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(['input', 'result'])('%s passes automated semantic accessibility checks', async state => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Live requests forbidden in accessibility test'); }));
  const { container } = render(<App />);
  if (state === 'result') fireEvent.click(screen.getByRole('button', { name: '예시 결과 둘러보기' }));
  const report = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    // JSDOM has no layout engine. Contrast is checked separately in Aside.
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(report.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
});
