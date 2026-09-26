// The one reader the design-table tests share (#414): the ledgers parse a doc's own sections and tables
// rather than copying its numbers, so the doc and the code cannot drift silently (docs/CODE-STANDARDS.md §2).
// Pure text in, text out: reading the file stays with each package's test (node-only), so this module is
// safe in the barrel beside the builders.

/** `### 3.18 Engulf …`: the hashes of a heading line, followed by a space. */
const HEADING_PATTERN = /^(#{1,6}) /;
/** A code fence opens or closes on a line of its own; a `#` inside one is a comment, not a heading. */
const CODE_FENCE = '```';
const TABLE_ROW_START = '|';
/** What follows a heading's number or name: `## 7. Constants table`. */
const WORD_BOUNDARY = ' ';
const TABLE_CELL_DELIMITER = '|';
/** An alignment row's cell: `---`, `:--`, `--:` or `:-:`. */
const ALIGNMENT_CELL_PATTERN = /^:?-+:?$/;

/** The lines outside code fences, the fence lines themselves dropped: the only lines that are markdown. */
function linesOutsideCodeFences(lines: readonly string[]): (string | null)[] {
  let isInsideCodeFence = false;
  return lines.map((line) => {
    if (line.startsWith(CODE_FENCE)) {
      isInsideCodeFence = !isInsideCodeFence;
      return null;
    }
    return isInsideCodeFence ? null : line;
  });
}

/** The heading level of every line (its `#` count), or null for a line that is not a heading. */
function headingLevels(lines: readonly string[]): (number | null)[] {
  return linesOutsideCodeFences(lines).map((line) =>
    line === null ? null : (HEADING_PATTERN.exec(line)?.[1]?.length ?? null),
  );
}

/** `line` opens with `heading` as whole words: `'### 1.1'` names `### 1.1 Nested`, never `### 1.10 Other`. */
function isHeadingNamed(line: string, heading: string): boolean {
  if (!line.startsWith(heading)) return false;
  const next = line.charAt(heading.length);
  return heading.endsWith(WORD_BOUNDARY) || next === '' || next === WORD_BOUNDARY;
}

/**
 * The lines of the section whose heading line starts with `heading`, hashes included (`'## 7. '`,
 * `'### 3.18 Engulf effects at a glance'`), up to a space or the line's end: the heading itself and every line up to the next heading of the
 * same or a higher level, its sub-headings included. The first matching heading wins; none throws.
 */
export function markdownSectionLines(markdown: string, heading: string): string[] {
  const lines = markdown.split('\n');
  const levels = headingLevels(lines);
  const start = lines.findIndex((line, index) => levels[index] !== null && isHeadingNamed(line, heading));
  if (start < 0) throw new Error(`heading "${heading}" not found`);
  const level = levels[start]!;
  const end = levels.findIndex((other, index) => index > start && other !== null && other <= level);
  return lines.slice(start, end < 0 ? undefined : end);
}

/** {@link markdownSectionLines} joined back into one text. */
export function markdownSection(markdown: string, heading: string): string {
  return markdownSectionLines(markdown, heading).join('\n');
}

/** The cells of a markdown table row, trimmed, without the empty edges outside the outer pipes. */
export function tableCells(row: string): string[] {
  return row
    .split(TABLE_CELL_DELIMITER)
    .slice(1, -1)
    .map((cell) => cell.trim());
}

/** Every table row of `markdown` as its cells, in order: header rows included, alignment rows and code dropped. */
export function tableRows(markdown: string): string[][] {
  return linesOutsideCodeFences(markdown.split('\n'))
    .filter((line): line is string => line?.startsWith(TABLE_ROW_START) === true)
    .map(tableCells)
    .filter((cells) => !cells.every((cell) => ALIGNMENT_CELL_PATTERN.test(cell)));
}
