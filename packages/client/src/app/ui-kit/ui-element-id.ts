// Page-unique ids for the kit's ARIA wiring (a panel labelled by its title, a section by its heading). The kit
// renders one DOM, so a counter is enough; the prefix only makes an id readable in the inspector.

let issuedIdCount = 0;

export function nextUiElementId(prefix: string): string {
  issuedIdCount += 1;
  return `${prefix}-${issuedIdCount}`;
}
