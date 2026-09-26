import { describe, expect, it } from 'vitest';
import { markdownSection, markdownSectionLines, tableCells, tableRows } from './markdown-document.js';

const DOCUMENT = [
  '# Title',
  '## 1. First',
  'first body',
  '### 1.1 Nested',
  '| Name | Value |',
  '| :--- | ----: |',
  '| `A`  | 1     |',
  '```bash',
  '# a comment, not a heading',
  '## nor this',
  '```',
  '## 2. Second',
  'second body',
  '### 2.1 Last',
  'last body',
].join('\n');

describe('markdownSectionLines', () => {
  it('runs from the heading to the next heading of the same level, sub-headings and code included', () => {
    expect(markdownSectionLines(DOCUMENT, '## 1. ')).toEqual(DOCUMENT.split('\n').slice(1, 11));
  });

  it('ends a sub-section at the next heading of a higher level', () => {
    expect(markdownSectionLines(DOCUMENT, '### 1.1')).toEqual(DOCUMENT.split('\n').slice(3, 11));
  });

  it('runs to the end of the document when no heading follows', () => {
    expect(markdownSectionLines(DOCUMENT, '### 2.1')).toEqual(['### 2.1 Last', 'last body']);
  });

  it('matches the heading as whole words, never a longer number it prefixes', () => {
    const numbered = ['## 1. Top', '### 1.10 Tenth', 'tenth body', '### 1.1 First', 'first body'].join('\n');
    expect(markdownSectionLines(numbered, '### 1.1')).toEqual(['### 1.1 First', 'first body']);
    expect(markdownSectionLines(numbered, '### 1.10')).toEqual(['### 1.10 Tenth', 'tenth body']);
  });

  it('never matches a line inside a code fence', () => {
    expect(() => markdownSectionLines(DOCUMENT, '## nor this')).toThrow('heading "## nor this" not found');
  });
});

describe('markdownSection', () => {
  it('joins the section lines back into one text', () => {
    expect(markdownSection(DOCUMENT, '## 2. ')).toBe('## 2. Second\nsecond body\n### 2.1 Last\nlast body');
  });
});

describe('tableCells', () => {
  it('trims each cell and drops the edges outside the outer pipes', () => {
    expect(tableCells('| `A`  | 1     |')).toEqual(['`A`', '1']);
  });

  it('keeps an empty cell', () => {
    expect(tableCells('| a |  | c |')).toEqual(['a', '', 'c']);
  });
});

describe('tableRows', () => {
  it('returns the header and body rows as cells and drops the alignment row', () => {
    expect(tableRows(DOCUMENT)).toEqual([
      ['Name', 'Value'],
      ['`A`', '1'],
    ]);
  });

  it('drops a pipe line inside a code fence, which is code, not a table', () => {
    expect(tableRows(['```text', '| not | a row |', '```', '| a | row |'].join('\n'))).toEqual([['a', 'row']]);
  });

  it('keeps a row of empty cells, which is not an alignment row', () => {
    expect(tableRows('| | |')).toEqual([['', '']]);
  });
});
