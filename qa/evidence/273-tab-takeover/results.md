# Ticket #273: two tabs, one clientId (private stack 4540/4542, headless Chromium, one browser context)

Tab 1 starts a room; tab 2 opens the same URL and connects; both run for 10 s. Counts are for `/ws` sockets only.

| run    | tab 1                                                                  | tab 2                           |
| ------ | ---------------------------------------------------------------------- | ------------------------------- |
| before | 7 opens, 6 closes, 9 game_state                                        | 6 opens, 6 closes, 6 game_state |
| after  | 1 open, 1 close (code 4001), lobby: "The game is open in another tab." | 1 open, 0 closes, in play       |
