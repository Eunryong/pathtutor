import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  latex: string;
  displayMode?: boolean;
}

type RenderSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; displayMode: boolean }
  | { kind: 'aligned'; lines: RenderSegment[][] };

const HANGUL_PATTERN = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7ff]+/u;

function normalizeCommonLatexTypos(source: string): string {
  // Models occasionally omit braces for a one-character fraction, e.g. \\fracqp.
  return source.replace(/\\frac\s*([A-Za-z0-9])\s*([A-Za-z0-9])/g, '\\frac{$1}{$2}');
}

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
  const normalizedSource = normalizeCommonLatexTypos(source);
  const segments: RenderSegment[] = [];
  let cursor = 0;

  const appendRaw = (end: number) => {
    appendRawSegment(segments, normalizedSource.slice(cursor, end), parentDisplayMode && segments.length === 0 && end === normalizedSource.length);
    cursor = end;
  };

  while (cursor < normalizedSource.length) {
    const textIndex = normalizedSource.indexOf('\\text', cursor);
    const displayIndex = normalizedSource.indexOf('\\[', cursor);
    const displayEndIndex = normalizedSource.indexOf('$$', cursor);
    const inlineIndex = normalizedSource.indexOf('\\(', cursor);
    const dollarIndex = normalizedSource.indexOf('$', cursor);
    const alignedMatch = normalizedSource.slice(cursor).match(/\\begin\{aligned\*?\}/);
    const alignedIndex = alignedMatch?.index === undefined ? -1 : cursor + alignedMatch.index;
    const candidates = [textIndex, displayIndex, displayEndIndex, inlineIndex, dollarIndex, alignedIndex]
      .filter((index) => index >= cursor)
      .sort((left, right) => left - right);
    const nextIndex = candidates[0];

    if (nextIndex === undefined) {
      appendRaw(normalizedSource.length);
      break;
    }

    if (nextIndex > cursor) appendRaw(nextIndex);

    if (nextIndex === textIndex) {
      const openBraceIndex = normalizedSource.slice(nextIndex + '\\text'.length).search(/\s*\{/);
      if (openBraceIndex < 0) {
        appendRaw(nextIndex + '\\text'.length);
        continue;
      }
      const braceIndex = nextIndex + '\\text'.length + openBraceIndex;
      const closeBraceIndex = findBalancedGroup(normalizedSource, braceIndex);
      if (closeBraceIndex < 0) {
        appendRaw(nextIndex + '\\text'.length);
        continue;
      }
      appendTextSegment(segments, normalizedSource.slice(braceIndex + 1, closeBraceIndex));
      cursor = closeBraceIndex + 1;
      continue;
    }

    if (nextIndex === alignedIndex) {
      const alignedStart = alignedMatch?.[0] || '\\begin{aligned}';
      const alignedEnd = alignedStart.endsWith('*') ? '\\end{aligned*}' : '\\end{aligned}';
      const closeIndex = normalizedSource.indexOf(alignedEnd, nextIndex + alignedStart.length);
      if (closeIndex < 0) {
        appendRaw(nextIndex + alignedStart.length);
        continue;
      }
      const lines = normalizedSource
        .slice(nextIndex + alignedStart.length, closeIndex)
        .split(/\\\\/)
        .map((line) => line.replace(/^\s*&\s*/, '').trim())
        .filter(Boolean)
        .map((line) => splitRenderableSegments(line, false));
      segments.push({ kind: 'aligned', lines });
      cursor = closeIndex + alignedEnd.length;
      continue;
    }

    const delimiter = nextIndex === displayIndex ? '\\]' : nextIndex === displayEndIndex ? '$$' : nextIndex === inlineIndex ? '\\)' : '$';
    const openLength = delimiter === '$' ? 1 : 2;
    const closeIndex = findClosingDelimiter(normalizedSource, nextIndex + openLength, delimiter);
    if (closeIndex < 0) {
      appendRaw(nextIndex + openLength);
      continue;
    }

    const mathValue = normalizedSource.slice(nextIndex + openLength, closeIndex);
    if (mathValue.includes('\\begin{aligned')) {
      segments.push(...splitRenderableSegments(mathValue, true));
    } else {
      segments.push({
        kind: 'math',
        value: mathValue,
        displayMode: delimiter === '\\]' || delimiter === '$$',
      });
    }
    cursor = closeIndex + delimiter.length;
  }

  return segments;
}

function renderSegments(container: HTMLElement, segments: RenderSegment[]) {
  for (const segment of segments) {
    if (segment.kind === 'text') {
      const textElement = document.createElement('span');
      textElement.className = 'latex-text';
      textElement.textContent = segment.value;
      container.append(textElement);
      continue;
    }

    if (segment.kind === 'aligned') {
      const alignedElement = document.createElement('span');
      alignedElement.className = 'latex-aligned';
      for (const line of segment.lines) {
        const lineElement = document.createElement('span');
        lineElement.className = 'latex-aligned-line';
        renderSegments(lineElement, line);
        alignedElement.append(lineElement);
      }
      container.append(alignedElement);
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
    container.append(mathElement);
  }
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ latex, displayMode = false }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.replaceChildren();
    if (!latex.trim()) return;

    renderSegments(element, splitRenderableSegments(latex.trim(), displayMode));
  }, [latex, displayMode]);

  return <span ref={containerRef} className={displayMode ? 'block my-2' : 'inline-block'} />;
};

export default LatexRenderer;
