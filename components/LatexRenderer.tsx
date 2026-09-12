import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  latex: string;
  displayMode?: boolean;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ latex, displayMode = false }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.replaceChildren();
    if (!latex.trim()) return;

    let cleanLatex = latex.trim();
    if (cleanLatex.startsWith('$$') && cleanLatex.endsWith('$$')) {
      cleanLatex = cleanLatex.slice(2, -2);
    } else if (cleanLatex.startsWith('\\[') && cleanLatex.endsWith('\\]')) {
      cleanLatex = cleanLatex.slice(2, -2);
    } else if (cleanLatex.startsWith('$') && cleanLatex.endsWith('$')) {
      cleanLatex = cleanLatex.slice(1, -1);
    } else if (cleanLatex.startsWith('\\(') && cleanLatex.endsWith('\\)')) {
      cleanLatex = cleanLatex.slice(2, -2);
    }

    try {
      katex.render(cleanLatex, element, {
        displayMode,
        output: 'htmlAndMathml',
        throwOnError: false,
        trust: false,
      });
    } catch (error: unknown) {
      // Keep the result readable even if a model emits unsupported TeX.
      element.textContent = cleanLatex;
      console.debug('KaTeX rendering failed:', error);
    }
  }, [latex, displayMode]);

  return <span ref={containerRef} className={displayMode ? 'block my-2' : 'inline-block'} />;
};

export default LatexRenderer;
