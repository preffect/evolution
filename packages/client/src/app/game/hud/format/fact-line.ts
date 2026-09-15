// One HUD caption line that carries several facts (docs/ui/hud.md §3.1.1): the leaderboard's score rule and
// the round clock's bloom caption both read `A · B · C`, so the separator has one home.

/** Between two facts on one line. */
export const FACT_SEPARATOR = ' · ';

/** `BLOOM · FOOD ×1.5 · DNA DROPS ×2`. */
export function joinFacts(facts: readonly string[]): string {
  return facts.join(FACT_SEPARATOR);
}
