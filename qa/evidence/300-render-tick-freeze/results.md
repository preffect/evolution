# Ticket #300: renderTick after a deep debug_step_room (private stack 4500/4502, headless client)

`renderTick()` read from `window.__evolutionDebug` every second after `debug_pause_room` then `debug_step_room`.

| run             | server tick after step | client renderTick, 1–6 s after                                        |
| --------------- | ---------------------- | --------------------------------------------------------------------- |
| before, step 89 | 277                    | 249 (all six reads): stuck at the last delta sent + 3, until a resume |
| after, step 89  | 285                    | 288 (all six reads): the stepped tick + 3                             |
| after, step 600 | 793                    | 796 (all reads)                                                       |

Also checked after the fix: pause then resume (renderTick advances about 60 ticks/s), and a running room with the page's
main thread blocked for 2.5 s (renderTick 246 before, 449 one second after).
