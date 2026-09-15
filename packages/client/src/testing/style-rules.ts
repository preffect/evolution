// Reads the style rules a rendered component put into the document, so a kit spec can pin a state's look
// (hover, pressed, focus-visible, disabled) that jsdom never computes: it does not apply pseudo-classes.
// Angular rewrites `:host` to the component's `_nghost-…` attribute, so a spec matches a rule by that
// attribute (`hostSelector`) plus the fragments it cares about.

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

/** `[_nghost-…]`: the attribute selector Angular gave a rendered component's host. */
export function hostSelector(host: Element): string {
  const attribute = host.getAttributeNames().find((name) => name.startsWith('_nghost-'));
  if (attribute === undefined) throw new Error('not an emulated-encapsulation component host');
  return `[${attribute}]`;
}

/**
 * The value of `property` in the first rule whose selector contains every fragment and that sits under a
 * media condition containing `media` (or under none, when `media` is null); `null` when no rule sets it.
 */
export function styleRuleValue(
  ownerDocument: Document,
  selectorFragments: readonly string[],
  property: string,
  media: string | null = null,
): string | null {
  const match = documentStyleRules(ownerDocument).find(
    (found) =>
      selectorFragments.every((fragment) => found.selectorText.includes(fragment)) &&
      (media === null ? found.media === null : (found.media ?? '').includes(media)) &&
      found.style.getPropertyValue(property) !== '',
  );
  return match ? match.style.getPropertyValue(property).trim() : null;
}
