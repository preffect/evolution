// Random stream labels (docs/DETERMINISM.md §3, docs/CODE-STANDARDS.md §2). Each subsystem
// forks its own stream from the round seed by one of these labels, so adding a draw to one
// subsystem never changes what another one produces.

export const RANDOM_STREAM = {
  /** Food and fragment spawns: kind, zone, variant, point (ECOLOGY §3). */
  spawner: 'spawner',
  /** Gel patch placement at world creation (ECOLOGY §2). */
  zones: 'zones',
  /** Safe spawn candidates (GAME-DESIGN §5.2). */
  spawnPlacement: 'spawn_placement',
  /** Draft sampling (PROGRESSION §3). */
  traitDraft: 'trait_draft',
  /** Bacteria random-walk headings; fragment drift direction at spawn (ECOLOGY §1). */
  moteMotion: 'mote_motion',
  /** Client only, never on the server: wobble and particles. */
  cosmetic: 'cosmetic',
} as const;

export type RandomStreamLabel = (typeof RANDOM_STREAM)[keyof typeof RANDOM_STREAM];

/**
 * The labels in declared order: the walk order for `world.random` in the state hash and the
 * order `createWorld` forks the server streams (never `Object.keys`, DETERMINISM §5).
 */
export const RANDOM_STREAM_LABELS: readonly RandomStreamLabel[] = [
  RANDOM_STREAM.spawner,
  RANDOM_STREAM.zones,
  RANDOM_STREAM.spawnPlacement,
  RANDOM_STREAM.traitDraft,
  RANDOM_STREAM.moteMotion,
  RANDOM_STREAM.cosmetic,
];

/** The streams `createWorld` forks on the server; `cosmetic` belongs to the client alone. */
export const SERVER_RANDOM_STREAM_LABELS: readonly RandomStreamLabel[] = RANDOM_STREAM_LABELS.filter(
  (label) => label !== RANDOM_STREAM.cosmetic,
);
