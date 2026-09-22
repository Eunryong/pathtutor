/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LatexRenderer from './LatexRenderer';

describe('LatexRenderer', () => {
  it('renders mathematical notation with the local KaTeX bundle', () => {
    const { container } = render(<LatexRenderer latex="x^2 + 1 = 2" displayMode />);

    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(container.querySelector('.katex-mathml')).toBeInTheDocument();
  });

  it('keeps Korean prose out of the KaTeX math parser', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(<LatexRenderer latex={'30. \\text{ 최고차항의 계수가 } 1\\text{인 삼차함수 } f(x)\\text{에 대하여 함수} \\[g(x)=x^2\\] \\text{가 미분가능하다.'} displayMode />);

    expect(container).toHaveTextContent('최고차항의 계수가');
    expect(container).toHaveTextContent('가 미분가능하다.');
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('renders aligned conditions line by line and repairs a missing fraction brace', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const alignedProblem = "가 실수 전체에서 미분가능하다. \\begin{aligned} &(가) 함수 g(x)는 x=0에서 극소이고, g(0)>0이다. \\\\ &(나) |g'(-\\ln 3)| = \\frac{3}{8}g(-\\ln 3) \\end{aligned}g(0)의 최솟값을 \\fracqp라 할 때";
    const { container } = render(<LatexRenderer latex={alignedProblem} displayMode />);

    expect(container.querySelectorAll('.latex-aligned-line')).toHaveLength(2);
    expect(container.textContent).not.toContain('begin{aligned}');
    expect(container.textContent).not.toContain('fracqp');
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(2);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
