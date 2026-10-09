/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { GradientDescentPlayground } from './GradientDescentPlayground';

describe('GradientDescentPlayground Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the playground with dual views, controls, and explanation panel', () => {
    render(<GradientDescentPlayground />);

    // Header & Titles
    expect(screen.getByText(/모델은 어떻게 학습할까\? 경사하강법과 미분/i)).toBeInTheDocument();
    expect(screen.getByText(/데이터 공간 \(Data Space\)/i)).toBeInTheDocument();
    expect(screen.getByText(/손실 공간 \(Loss Space\)/i)).toBeInTheDocument();
    expect(screen.getByText(/실험 프리셋:/i)).toBeInTheDocument();

    // Initial state check: w=0.50, loss=9.00, residual=+3.00
    expect(screen.getAllByText('9.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+3.00').length).toBeGreaterThan(0);
  });

  it('executes a step correctly when clicking "한 걸음 이동 (Step)"', () => {
    render(<GradientDescentPlayground />);

    // Initial loss has 9.00, step count is 0
    expect(screen.getAllByText('9.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/누적 스텝:/i)).toHaveTextContent('누적 스텝: 0 회');

    // Click "한 걸음 이동 (Step)" button
    const stepBtn = screen.getByRole('button', { name: /한 걸음 이동/i });
    fireEvent.click(stepBtn);

    // Hero step: w becomes 1.70, loss becomes 0.36, residual becomes +0.60, step becomes 1
    expect(screen.getByText(/누적 스텝:/i)).toHaveTextContent('누적 스텝: 1 회');
    expect(screen.getAllByText('0.36').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+0.60').length).toBeGreaterThan(0);
  });

  it('resets the model state when clicking "리셋"', () => {
    render(<GradientDescentPlayground />);

    // Click step once
    const stepBtn = screen.getByRole('button', { name: /한 걸음 이동/i });
    fireEvent.click(stepBtn);
    expect(screen.getByText(/누적 스텝:/i)).toHaveTextContent('누적 스텝: 1 회');

    // Click reset
    const resetBtn = screen.getByRole('button', { name: /리셋/i });
    fireEvent.click(resetBtn);

    // Should return to step 0 and initial loss 9.00
    expect(screen.getByText(/누적 스텝:/i)).toHaveTextContent('누적 스텝: 0 회');
    expect(screen.getAllByText('9.00').length).toBeGreaterThan(0);
  });

  it('loads preset scenarios correctly', () => {
    render(<GradientDescentPlayground />);

    // Click "1스텝 도달 (η=0.125)" preset
    const exactPresetBtn = screen.getByRole('button', { name: /1스텝 도달/i });
    fireEvent.click(exactPresetBtn);

    // Execute step: should converge exactly to w=2.0, loss=0.00
    const stepBtn = screen.getByRole('button', { name: /한 걸음 이동/i });
    fireEvent.click(stepBtn);

    expect(screen.getAllByText('0.00').length).toBeGreaterThan(0);
  });

  it('switches between concept explanation depths and PyTorch code view', () => {
    render(<GradientDescentPlayground />);

    // Check default depth: 1단계 직관
    expect(screen.getByText(/안개 낀 산골짜기에서 발바닥으로 길 찾기/i)).toBeInTheDocument();

    // Switch to depth 2: 단계별 수식
    const depth2Btn = screen.getByRole('button', { name: /2\. 단계별 수식/i });
    fireEvent.click(depth2Btn);
    expect(screen.getByText(/실시간 라이브 연산 대입/i)).toBeInTheDocument();

    // Switch to depth 3: 상세 미분
    const depth3Btn = screen.getByRole('button', { name: /3\. 상세 미분 & 유도/i });
    fireEvent.click(depth3Btn);
    expect(screen.getByText(/연쇄법칙\(Chain Rule\)을 통한 손실 함수 미분/i)).toBeInTheDocument();

    // Switch to PyTorch code tab
    const pytorchTabBtn = screen.getByRole('button', { name: /PyTorch 코드로 보기/i });
    fireEvent.click(pytorchTabBtn);

    expect(screen.getByText(/# PyTorch 1:1 매핑 코드/i)).toBeInTheDocument();
  });
});
