// The one reader the design-table tests share (#414): the ledgers parse a doc's own sections and tables
// rather than copying its numbers, so the doc and the code cannot drift silently (docs/CODE-STANDARDS.md §2).
// Pure text in, text out: reading the file stays with each package's test (node-only), so this module is
// safe in the barrel beside the builders.

/** `### 3.18 Engulf …`: the hashes of a heading line, followed by a space. */
const HEADING_PATTERN = /^(#{1,6}) /;
/** A code fence opens or closes on a line of its own; a `#` inside one is a comment, not a heading. */
const CODE_FENCE = '```';
const TABLE_ROW_START = '|';
const TABLE_CELL_DELIMITER = '|';
/** An alignment row's cell: `---`, `:--`, `--:` or `:-:`. */
const ALIGNMENT_CELL_PATTERN = /^:?-+:?$/;

/** The heading level of every line (its `#` count), or null for a line that is not a heading. */
function headingLevels(lines: readonly string[]): (number | null)[] {
  let isInsideCodeFence = false;
  return lines.map((line) => {
    if (line.startsWith(CODE_FENCE)) isInsideCodeFence = !isInsideCodeFence;
    if (isInsideCodeFence) return null;
    return HEADING_PATTERN.exec(line)?.[1]?.length ?? null;
  });
}

/**
 * The lines of the section whose heading line starts with `heading`, hashes included (`'## 7. '`,
 * `'### 3.18 Engulf effects at a glance'`): the heading itself and every line up to the next heading of the
 * same or a higher level, its sub-headings included. The first matching heading wins; none throws.
 */
export function markdownSectionLines(markdown: string, heading: string): string[] {
  const lines = markdown.split('\n');
  const levels = headingLevels(lines);
  const start = lines.findIndex((line, index) => levels[index] !== null && line.startsWith(heading));
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

/** Every table row of `markdown` as its cells, in order: header rows included, alignment rows dropped. */
export function tableRows(markdown: string): string[][] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith(TABLE_ROW_START))
    .map(tableCells)
    .filter((cells) => !cells.every((cell) => ALIGNMENT_CELL_PATTERN.test(cell)));
}
