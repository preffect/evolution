// Reads the style rules a rendered component put into the document, so a kit spec can pin a state's look
// (hover, pressed, focus-visible, disabled) that jsdom never computes: it does not apply pseudo-classes.
//
// A spec names a rule by its whole selector: the simple selectors it is built of, such as the component's
// `[_nghost-…]` (`hostSelector`), `[data-variant='primary']`, `:hover` or `::before`. A rule matches only when
// one selector of its list is made of exactly those parts, so `:host([data-variant='primary'])` never also
// answers for `:host([data-variant='primary'][data-size='compact'])`. Angular's `[_ngcontent-…]` scoping
// attribute is left out of the comparison, since a spec cannot know it. Quotes are compared as one kind.

interface FoundStyleRule {
  readonly selectorText: string;
  readonly style: CSSStyleDeclaration;
  readonly media: string | null;
}

function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return 'selectorText' in rule;
}

function isMediaRule(rule: CSSRule): rule is CSSMediaRule {
  return 'media' in rule && 'cssRules' in rule;
}

function collect(rules: CSSRuleList, media: string | null, found: FoundStyleRule[]): void {
  for (const rule of Array.from(rules)) {
    if (isMediaRule(rule)) collect(rule.cssRules, rule.media.mediaText, found);
    else if (isStyleRule(rule)) found.push({ selectorText: rule.selectorText, style: rule.style, media });
  }
}

function documentStyleRules(ownerDocument: Document): FoundStyleRule[] {
  const found: FoundStyleRule[] = [];
  for (const sheet of Array.from(ownerDocument.styleSheets)) collect(sheet.cssRules, null, found);
  return found;
}

/** A pseudo-class or element with its argument, an attribute, a class, an id, a type or `*`. */
const SIMPLE_SELECTOR = /::?[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?|\[[^\]]*\]|\.[\w-]+|#[\w-]+|[a-z][\w-]*|\*/gi;
const CONTENT_SCOPE_ATTRIBUTE = /^\[_ngcontent-[^\]]*\]$/;

function normaliseQuotes(selector: string): string {
  return selector.replaceAll('"', "'");
}

/** A selector list split at its top-level commas: a comma inside `:not(…)` stays with its selector. */
function splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of selectorText) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      selectors.push(current);
      current = '';
    } else current += character;
  }
  return [...selectors, current];
}

function simpleSelectorsOf(selector: string): string[] {
  return (normaliseQuotes(selector).match(SIMPLE_SELECTOR) ?? []).filter((part) => !CONTENT_SCOPE_ATTRIBUTE.test(part));
}

function isSameSet(parts: readonly string[], wanted: ReadonlySet<string>): boolean {
  const unique = new Set(parts);
  return unique.size === wanted.size && [...unique].every((part) => wanted.has(part));
}

/** `[_nghost-…]`: the attribute selector Angular gave a rendered component's host. */
export function hostSelector(host: Element): string {
  const attribute = host.getAttributeNames().find((name) => name.startsWith('_nghost-'));
  if (attribute === undefined) throw new Error('not an emulated-encapsulation component host');
  return `[${attribute}]`;
}

/**
 * The value of `property` in the rules whose selector is exactly `selectorParts`, under a media condition
 * containing `media` (or under none, when `media` is null); `null` when no such rule sets it. Throws when two
 * such rules set different values, so a spec never passes on whichever rule happened to come first.
 */
export function styleRuleValue(
  ownerDocument: Document,
  selectorParts: readonly string[],
  property: string,
  media: string | null = null,
): string | null {
  const wanted = new Set(selectorParts.map(normaliseQuotes));
  const values = documentStyleRules(ownerDocument)
    .filter((found) => (media === null ? found.media === null : (found.media ?? '').includes(media)))
    .filter((found) =>
      splitSelectorList(found.selectorText).some((selector) => isSameSet(simpleSelectorsOf(selector), wanted)),
    )
    .map((found) => found.style.getPropertyValue(property).trim())
    .filter((value) => value !== '');
  const distinct = [...new Set(values)];
  if (distinct.length > 1) {
    throw new Error(`rules for ${[...wanted].join('')} disagree on ${property}: ${distinct.join(' | ')}`);
  }
  return distinct[0] ?? null;
}
