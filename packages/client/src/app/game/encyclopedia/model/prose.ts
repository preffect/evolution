// Prose templates and their token parser (docs/architecture/encyclopedia.md §12.6). A template is player-facing copy
// with `{factKey}` value tokens and `[[entryId]]` or `[[entryId|shown text]]` links, and never a number: the values
// come from the entry's facts. A malformed token throws here, so the prose spec fails instead of a player's screen.

import type { ValueOf } from '@evolution/shared';

/** Text with `{factKey}` value tokens and `[[entryId]]` / `[[entryId|shown text]]` links. No numbers. */
export type ProseTemplate = string;

export const PROSE_TOKEN = { text: 'text', value: 'value', link: 'link' } as const;
export type ProseTokenKind = ValueOf<typeof PROSE_TOKEN>;

export type ProseToken =
  | { readonly kind: typeof PROSE_TOKEN.text; readonly text: string }
  | { readonly kind: typeof PROSE_TOKEN.value; readonly factKey: string }
  | { readonly kind: typeof PROSE_TOKEN.link; readonly reference: string; readonly shownText: string | null };

/** A value token `{massGain}` or a link token `[[trait:cell_wall|a wall]]`. */
const TOKEN_PATTERN = /\{([^{}]*)\}|\[\[([^[\]]*)\]\]/g;
/** What is left of a token's delimiters in the text between tokens means a token did not close or open. */
const STRAY_DELIMITER_PATTERN = /[{}]|\[\[|\]\]/;
const FACT_KEY_PATTERN = /^[a-z][A-Za-z]*$/;
/** `subject:code_id`, optionally `#section_key`, lowercase snake_case throughout. */
const REFERENCE_PATTERN = /^[a-z_]+:[a-z_]+(#[a-z0-9_]+)?$/;
const SHOWN_TEXT_SEPARATOR = '|';

function textToken(template: ProseTemplate, text: string): ProseToken {
  if (STRAY_DELIMITER_PATTERN.test(text)) throw new Error(`Unbalanced token delimiter in prose: "${template}"`);
  return { kind: PROSE_TOKEN.text, text };
}

function valueToken(template: ProseTemplate, factKey: string): ProseToken {
  if (!FACT_KEY_PATTERN.test(factKey)) throw new Error(`Malformed value token {${factKey}} in prose: "${template}"`);
  return { kind: PROSE_TOKEN.value, factKey };
}

function linkToken(template: ProseTemplate, body: string): ProseToken {
  const [reference = '', shownText, ...rest] = body.split(SHOWN_TEXT_SEPARATOR);
  if (!REFERENCE_PATTERN.test(reference) || rest.length > 0 || shownText?.trim() === '') {
    throw new Error(`Malformed link token [[${body}]] in prose: "${template}"`);
  }
  return { kind: PROSE_TOKEN.link, reference, shownText: shownText ?? null };
}

/** The template as a sequence of text, value and link tokens; empty text between tokens is dropped. */
export function parseProseTemplate(template: ProseTemplate): readonly ProseToken[] {
  const tokens: ProseToken[] = [];
  let textStart = 0;
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const text = template.slice(textStart, match.index);
    if (text !== '') tokens.push(textToken(template, text));
    const [whole, factKey, linkBody] = match;
    tokens.push(factKey === undefined ? linkToken(template, linkBody ?? '') : valueToken(template, factKey));
    textStart = match.index + whole.length;
  }
  const tail = template.slice(textStart);
  if (tail !== '') tokens.push(textToken(template, tail));
  return tokens;
}
