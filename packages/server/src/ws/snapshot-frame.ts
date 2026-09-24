// The splice of a `game_snapshot` (docs/architecture/wire-contract.md §4): the message is stringified once per broadcast
// with the snapshot's viewer members left out and the snapshot object still open, then closed once per viewer with
// that viewer's members. String assembly from structural JSON pieces only, so no player data (a name with quotes or
// backslashes) is ever searched or replaced. The invariants the tests pin:
//   - the spliced members go last, in the declared order;
//   - the shared value is a plain JSON object, so its stringify ends in the `}` the frame reopens;
//   - a spliced value is never `undefined`: `JSON.stringify` would drop it and leave `"key":` dangling, so it throws;
//   - member order does not matter to `JSON.parse`, so a closed frame parses equal to the whole object stringified.

import { SERVER_MESSAGE_TYPE } from '@evolution/shared';

const EMPTY_OBJECT_JSON = '{}';
const CLOSING_BRACE = '}';
const MEMBER_SEPARATOR = ',';
const KEY_VALUE_SEPARATOR = ':';
/** `{"type":"game_snapshot","snapshot":` — the message members before the snapshot object. */
const MESSAGE_HEAD = `{"type":${JSON.stringify(SERVER_MESSAGE_TYPE.gameSnapshot)},"snapshot":`;
/** Closes the snapshot object, then the message object. */
const SNAPSHOT_AND_MESSAGE_CLOSE = `${CLOSING_BRACE}${CLOSING_BRACE}`;

/** One viewer's values for the declared members, by member name. */
export type ViewerMembers = Readonly<Partial<Record<string, unknown>>>;

/** The shared part of every viewer's `game_snapshot`: see the file header. */
export interface OpenSnapshotFrame<Key extends string = string> {
  /** The message up to the snapshot's last shared member. */
  readonly sharedJson: string;
  /** Whether a shared member precedes the viewer members, so a separator goes between them. */
  readonly hasSharedMembers: boolean;
  /** The viewer members each frame is closed with, in order. */
  readonly viewerKeys: readonly Key[];
}

/** A declared member's value; one the module left out is a bug in the module, never sent as a guess. */
export function requireViewerMember(viewerMembers: ViewerMembers, key: string): unknown {
  const value = viewerMembers[key];
  if (value === undefined) throw new Error(`the viewer state declares "${key}" but answered no value for it`);
  return value;
}

/**
 * Stringifies `snapshot` once without `viewerKeys`: the shared part of every viewer's `game_snapshot`. A broadcast
 * typed without them carries none, but a member present anyway is still left out rather than written twice.
 */
export function openSnapshotFrame<Key extends string>(
  snapshot: object,
  viewerKeys: readonly Key[],
): OpenSnapshotFrame<Key> {
  const viewerMembersLeftOut = Object.fromEntries(viewerKeys.map((key) => [key, undefined]));
  const snapshotJson = JSON.stringify({ ...snapshot, ...viewerMembersLeftOut });
  return {
    sharedJson: `${MESSAGE_HEAD}${snapshotJson.slice(0, snapshotJson.length - CLOSING_BRACE.length)}`,
    hasSharedMembers: snapshotJson !== EMPTY_OBJECT_JSON,
    viewerKeys,
  };
}

/** Writes one member's value as JSON; it must write exactly what `JSON.stringify` would. */
export type MemberJsonWriter<Key extends string = string> = (key: Key, value: unknown) => string;

const STRINGIFY_MEMBER: MemberJsonWriter = (_key, value) => JSON.stringify(value);

/**
 * One viewer's whole `game_snapshot` message: `frame` closed with that viewer's members, in declared order, each
 * written by `memberJson` (a module's writer can reuse strings its viewers share, #406).
 */
export function closeSnapshotFrame<Key extends string>(
  frame: OpenSnapshotFrame<Key>,
  viewerMembers: ViewerMembers,
  memberJson: MemberJsonWriter<Key> = STRINGIFY_MEMBER,
): string {
  const members = frame.viewerKeys.map(
    (key) => `${JSON.stringify(key)}${KEY_VALUE_SEPARATOR}${memberJson(key, requireViewerMember(viewerMembers, key))}`,
  );
  const separator = frame.hasSharedMembers && members.length > 0 ? MEMBER_SEPARATOR : '';
  return `${frame.sharedJson}${separator}${members.join(MEMBER_SEPARATOR)}${SNAPSHOT_AND_MESSAGE_CLOSE}`;
}
