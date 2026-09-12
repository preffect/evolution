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
  /** Wild cells: spread factors, wander headings and turn rolls (ECOLOGY §3.3). */
  wildCells: 'wild_cells',
  /** Spit-out rolls: one draw per tick per wrapped or sealed prey whose `spitOutChancePerSecond` > 0 (ECOLOGY §6.1). */
  engulf: 'engulf',
  /** Client only, never on the server: wobble and particles. */
  cosmetic: 'cosmetic',
} as const;

/**
 * Sub-streams the client forks from `cosmetic` (docs/RENDERING.md §1): `fork(COSMETIC_SUB_STREAM.x + ':' + key)`.
 * Listed here so every stream name has the one home; never forked on the server.
 */
export const COSMETIC_SUB_STREAM = {
  /** The depth particle fields, one per layer. */
  depth: 'depth',
  /** The cytoplasm noise tile (#206). */
  field: 'field',
  /** The membrane jitter / lobes strip, one row per cell variant (#206). */
  strip: 'strip',
  /** The dish field bake: mire strand placement, stage scratches (#206). */
  dish: 'dish',
  /** The vent sprite bake: crack branching, bubble and plume mote placement (#206). */
  vent: 'vent',
  /** The organelle atlas: chromatin scatter and the nucleoid's loop phases (#206). */
  organelles: 'organelles',
  /** One cell's cosmetic phases, strip row and organelle slots: `fork(cell + ':' + cellId)` (#215). */
  cell: 'cell',
  /** One mote's breath rate and phase and a bacterium's tumble phase: `fork(mote + ':' + moteId)` (#207). */
  mote: 'mote',
  /** One DNA fragment's spin phase: `fork(fragment + ':' + fragmentId)` (#207). */
  fragment: 'fragment',
  /** The fixed-seed bench scene's specs: cells, motes and fragments (docs/RENDERING.md §7, #208). */
  bench: 'bench',
} as const;

export type RandomStreamLabel = (typeof RANDOM_STREAM)[keyof typeof RANDOM_STREAM];

/** The server streams: every label except `cosmetic`, which only the client ever forks. */
export type ServerRandomStreamLabel = Exclude<RandomStreamLabel, typeof RANDOM_STREAM.cosmetic>;

/**
 * The streams `createWorld` forks on the server, in declared order: the order they are forked
 * from the round seed and the walk order of `world.random` in the state hash (never
 * `Object.keys`, DETERMINISM §3, §5). Declared by hand rather than filtered from
 * `RANDOM_STREAM_LABELS` so the narrowing is by declaration, not by a type guard.
 */
export const SERVER_RANDOM_STREAM_LABELS: readonly ServerRandomStreamLabel[] = [
  RANDOM_STREAM.spawner,
  RANDOM_STREAM.zones,
  RANDOM_STREAM.spawnPlacement,
  RANDOM_STREAM.traitDraft,
  RANDOM_STREAM.moteMotion,
  RANDOM_STREAM.wildCells,
  RANDOM_STREAM.engulf,
];

/** Every label in declared order: the server streams, then the client's `cosmetic` stream. */
export const RANDOM_STREAM_LABELS: readonly RandomStreamLabel[] = [
  ...SERVER_RANDOM_STREAM_LABELS,
  RANDOM_STREAM.cosmetic,
];
