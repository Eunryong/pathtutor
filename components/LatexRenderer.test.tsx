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
});
