# Ticket #275: resyncs per scenario and what each costs

**Slow client** (`game-room.resync-burst.test.ts`, the real flow control against a client that drains 34.8 of the
room's 60.6 messages a second, #274's measured rates, 3 000 broadcasts):

| room                     | run    | resyncs | stacked on an unacknowledged one | deltas delivered |
| ------------------------ | ------ | ------- | -------------------------------- | ---------------- |
| running (its own ticker) | before | 100     | 88                               | 1 641            |
| running (its own ticker) | after  | 24      | 0                                | 1 704            |
| advanced by debug steps  | before | 106     | 94                               | 1 636            |
| advanced by debug steps  | after  | 16      | 0                                | 1 799            |

A paused room sends a step taken during a held resync as its delta, behind the resync (review of PR #617), so the
stepped client stays current; that is why it delivers more deltas than the running room.

**Single-shot paths** (private server 4540, a raw socket client acknowledging as the browser does; after the fix):
a paused room stepped 89 ticks sends 1 `game_state`, a tab takeover sends 1 (to the new socket, 0 to the old), a
reconnect inside the grace sends 1. These paths were already one resync each; the burst was the slow client's.

**Cost of one resync**: a `game_state` was 29 905 bytes against a 10 308-byte median delta at round start (about 3
deltas' worth), so the 76 resyncs saved above are about 2.3 MB less on the weakest client's wire over 150 s. On the
client each resync used to disconnect and reconnect the audio session (stop every voice, clear the loops, a new
transition tracker); now it keeps the session and only takes the balance.
