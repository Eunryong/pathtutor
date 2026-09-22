import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  latex: string;
  displayMode?: boolean;
}

type RenderSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; displayMode: boolean };

const HANGUL_PATTERN = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7ff]+/u;

function findBalancedGroup(source: string, openIndex: number): number {
  let depth = 0;

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function findClosingDelimiter(source: string, startIndex: number, delimiter: string): number {
  for (let index = startIndex; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source.startsWith(delimiter, index)) return index;
  }
  return -1;
}

function looksLikeMath(value: string): boolean {
  return /\\[a-zA-Z]+|[=^_{}]|[+*/<>]|\([A-Za-z0-9]|[A-Za-z0-9]\)/.test(value);
}

function appendTextSegment(segments: RenderSegment[], value: string) {
  if (!value) return;
  const previous = segments.at(-1);
  if (previous?.kind === 'text') previous.value += value;
  else segments.push({ kind: 'text', value });
}

function appendRawSegment(segments: RenderSegment[], value: string, useDisplayMode: boolean) {
  if (!value) return;

  // Korean prose is not sent to KaTeX. This also handles a model response that
  // mixes plain text with TeX without adding explicit math delimiters.
  if (!HANGUL_PATTERN.test(value)) {
    if (looksLikeMath(value)) segments.push({ kind: 'math', value, displayMode: useDisplayMode });
    else appendTextSegment(segments, value);
    return;
  }

  let cursor = 0;
  const matcher = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7ff]+/gu;
  for (const match of value.matchAll(matcher)) {
    const start = match.index ?? cursor;
    const before = value.slice(cursor, start);
    if (before) {
      if (looksLikeMath(before)) segments.push({ kind: 'math', value: before, displayMode: false });
      else appendTextSegment(segments, before);
    }
    appendTextSegment(segments, match[0]);
    cursor = start + match[0].length;
  }

  const after = value.slice(cursor);
  if (after) {
    if (looksLikeMath(after)) segments.push({ kind: 'math', value: after, displayMode: false });
    else appendTextSegment(segments, after);
  }
}

function splitRenderableSegments(source: string, parentDisplayMode: boolean): RenderSegment[] {
  const segments: RenderSegment[] = [];
  let cursor = 0;

  const appendRaw = (end: number) => {
    appendRawSegment(segments, source.slice(cursor, end), parentDisplayMode && segments.length === 0 && end === source.length);
    cursor = end;
  };

  while (cursor < source.length) {
    const textIndex = source.indexOf('\\text', cursor);
    const displayIndex = source.indexOf('\\[', cursor);
    const displayEndIndex = source.indexOf('$$', cursor);
    const inlineIndex = source.indexOf('\\(', cursor);
    const dollarIndex = source.indexOf('$', cursor);
    const candidates = [textIndex, displayIndex, displayEndIndex, inlineIndex, dollarIndex]
      .filter((index) => index >= cursor)
      .sort((left, right) => left - right);
    const nextIndex = candidates[0];

    if (nextIndex === undefined) {
      appendRaw(source.length);
      break;
    }

    if (nextIndex > cursor) appendRaw(nextIndex);

    if (nextIndex === textIndex) {
      const openBraceIndex = source.slice(nextIndex + '\\text'.length).search(/\s*\{/);
      if (openBraceIndex < 0) {
        appendRaw(nextIndex + '\\text'.length);
        continue;
      }
      const braceIndex = nextIndex + '\\text'.length + openBraceIndex;
      const closeBraceIndex = findBalancedGroup(source, braceIndex);
      if (closeBraceIndex < 0) {
        appendRaw(nextIndex + '\\text'.length);
        continue;
      }
      appendTextSegment(segments, source.slice(braceIndex + 1, closeBraceIndex));
      cursor = closeBraceIndex + 1;
      continue;
    }

    const delimiter = nextIndex === displayIndex ? '\\]' : nextIndex === displayEndIndex ? '$$' : nextIndex === inlineIndex ? '\\)' : '$';
    const openLength = delimiter === '$$' ? 2 : 2;
    const closeIndex = findClosingDelimiter(source, nextIndex + openLength, delimiter);
    if (closeIndex < 0) {
      appendRaw(nextIndex + openLength);
      continue;
    }

    segments.push({
      kind: 'math',
      value: source.slice(nextIndex + openLength, closeIndex),
      displayMode: delimiter === '\\]' || delimiter === '$$',
    });
    cursor = closeIndex + delimiter.length;
  }

  return segments;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ latex, displayMode = false }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.replaceChildren();
    if (!latex.trim()) return;

    const segments = splitRenderableSegments(latex.trim(), displayMode);
    for (const segment of segments) {
      if (segment.kind === 'text') {
        const textElement = document.createElement('span');
        textElement.className = 'latex-text';
        textElement.textContent = segment.value;
        element.append(textElement);
        continue;
      }

      const mathElement = document.createElement('span');
      try {
        katex.render(segment.value.trim(), mathElement, {
          displayMode: segment.displayMode,
          output: 'htmlAndMathml',
          throwOnError: false,
          trust: false,
          strict: 'ignore',
        });
      } catch (error: unknown) {
        // Keep the result readable even if a model emits unsupported TeX.
        mathElement.textContent = segment.value;
        console.debug('KaTeX rendering failed:', error);
      }
      element.append(mathElement);
    }
  }, [latex, displayMode]);

  return <span ref={containerRef} className={displayMode ? 'block my-2' : 'inline-block'} />;
};

export default LatexRenderer;
