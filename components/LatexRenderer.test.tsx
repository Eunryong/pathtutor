/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LatexRenderer from './LatexRenderer';

describe('LatexRenderer', () => {
  it('renders mathematical notation with the local KaTeX bundle', () => {
    const { container } = render(<LatexRenderer latex="x^2 + 1 = 2" displayMode />);

    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(container.querySelector('.katex-mathml')).toBeInTheDocument();
  });
});
