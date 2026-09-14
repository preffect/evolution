# Legibility audit (#321)

What decides a round, and what a player can see of it on main 43a464a. "Today" was read from the specs and
`packages/client/src/app/game/`: no toast, onboarding, menu, respawn or results component exists yet
(`game/hud/` has the leaderboard, round clock, trait picker and the hidden status mirror), and no `+N`
floater exists in `game/render/`, although `docs/ui/hud.md` §3.1.2 cites one.

**The camera locks the own cell's size on screen.** `render/camera.ts` sets the view half-height to
`CAMERA_VIEW_RADII` (12) × the own radius, clamped to 300–1500 wu, and the zoom to viewport height / 2 / that
half-height, easing in over `CAMERA_ZOOM_SECONDS` (0.6 s). So from mass 39 to 977 (radius 25–125) the own cell is
always 1/24 of the viewport height, 33 px at 800 px, whatever its mass. The only mass number a player can see is in
the leaderboard while Tab is held; the status mirror is for screen readers only. #320 measured decay within 2 % of
spec in the broth, the vent and the shallows, and with traits. Decay works; the player just cannot see it.

Numbers are the shipped constants (`packages/shared/src/constants/`). Worked example: mass 312, in the vent,
Mitochondrion I owned.

| Mechanic                  | The player must understand                                                         | When it matters                | Shows today                                                                                                    | Cheapest cue                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Own size                  | How big you are now, and whether you are growing or shrinking                      | Always                         | Nothing: the camera holds the cell at 33 px from mass 39 to 977; the mass number is only on the held-Tab board | Partial zoom (the view grows slower than the cell); a mass chip with a trend near the cell |
| Food gain                 | Eating grows you; rods 3, algae 1, detritus 2                                      | Always                         | Eat pulse only; the camera cancels the growth within about a second                                            | `+3` floater at the mouth                                                                  |
| Mass decay                | Mass above 20 bleeds away at 0.2 %/s of the surplus                                | Once big (≥ ~150); idle giants | Nothing; a slow drift is fully cancelled by the camera                                                         | `−1` floater once a second with its cause; trend arrow                                     |
| Vent decay                | The vent multiplies decay ×1.5                                                     | In the vent                    | Orange tint only                                                                                               | Zone name and effect on entry; heat shimmer on the membrane                                |
| Sprint cost               | A sprint costs 5 % of mass                                                         | Every sprint                   | Sprint ring shows the cooldown, not the cost                                                                   | `−16 SPRINT` floater                                                                       |
| Size → speed              | Bigger is slower (half speed at 16× start mass)                                    | Chasing, fleeing               | Nothing (zoom hides size)                                                                                      | Speed row in a Tab panel; size-vs-others rings                                             |
| Gel                       | Gel slows big cells (a 600-mass cell to 40 %) and barely slows small ones          | In gel                         | Purple tint only                                                                                               | Zone name on entry; `SLOWED` on the cell                                                   |
| Shallows / photosynthesis | Chloroplast gains mass only in the sunlit ring                                     | Owning Chloroplast             | Green tint only                                                                                                | `+1 SUN` floater; zone name on entry                                                       |
| Food by zone              | Orange rods at the vent, green in the shallows, count toward organelles            | The trip (3:00–4:30)           | Ladder pips count; nothing says where to go                                                                    | Zone name carries its food: `WARM VENT · orange rods`                                      |
| Bloom                     | From 80 % of the round: food ×1.5, DNA fragments ×2                                | Last 2 minutes                 | Clock turns gold, caption `BLOOM`                                                                              | Caption says the effect: `BLOOM · DNA ×2`                                                  |
| Toxin drain               | Touching a toxic cell drains mass/s (3–7 % of your mass); swallowed toxin ×6       | Contact, engulfing toxic prey  | Nothing                                                                                                        | `−9 TOXIN` floater; toxic cells ringed and labelled                                        |
| Spine drain               | Engulfing a Diatom Shell cell drains you while it lasts                            | Engulfing                      | Nothing                                                                                                        | `−N SPINES` floater                                                                        |
| Who can eat whom          | Need 1.25× the prey's mass (more against Cell Wall); hold down to 1.1×             | Every encounter                | Danger ring and `X CAN ENGULF YOU` on threats; prey unmarked                                                   | Prey ring on edible cells; mass thresholds in a panel                                      |
| Engulf progress           | Cover → wrap → seal; escape before the seal                                        | Being eaten / eating           | Escape arc and `SPRINT TO ESCAPE` / `SEALED` (prey side only)                                                  | Predator side: the same arc on the prey                                                    |
| Death cost                | Death loses mass and part of DNA toward the next level, keeps level, traits, score | Dying                          | Respawn overlay specified, not built                                                                           | Respawn overlay (§3.3) as specified                                                        |
| DNA sources               | Fragments 5, rods 1, engulfs, mass over the cap                                    | Always                         | DNA ring fills                                                                                                 | `+5 DNA` floater flying to the ring                                                        |
| Level                     | Full ring = level = trait pick                                                     | Level-up                       | Ring, numeral, gold flash, picker                                                                              | Enough                                                                                     |
| DNA tags                  | Where you feed shapes which traits are offered                                     | Drafts                         | Nothing                                                                                                        | Tag chip on picker cards (spec'd in VISUAL-STYLE §2)                                       |
| Stage gates               | The rung card moves you up the ladder                                              | Offers                         | Orbit ghost and `RUNG` ribbon; `stage` toast not built                                                         | Stage toast (§3.6)                                                                         |
| Endosymbiosis count       | 10 of one rod colour unlocks the organelle                                         | The trip                       | Pips on the orbit; unlock toast not built                                                                      | Unlock toast; zone name names the rod                                                      |
| Trait effects             | What an owned trait does, and when it is acting                                    | After the pick, all round      | Card text during the pick only; the menu list is not built                                                     | Effect floater at pick; organelle glows when it acts; list under Tab                       |
| Wild cells                | They grow with the world clock and hunt from 6:00                                  | Mid-round on                   | Danger ring when bigger                                                                                        | Name them `WILD` on the ring label                                                         |
| Standing vs world         | Ahead / with / behind the dish's average                                           | All round                      | Nothing (its level-ring marker was cut by #143)                                                                | One word in a Tab panel                                                                    |
| World level-up            | The dish just got heavier and more dangerous                                       | 3:00, 6:00, 9:00               | Toast not built                                                                                                | Toast (§3.6)                                                                               |
| Score                     | Score = DNA earned + 25 per engulf; death keeps it                                 | Reading the board              | Column has no label on the compact board                                                                       | Label strip `LV SCORE` always on                                                           |
| Leaderboard columns       | `EATEN` = cells engulfed, not food; `TAB` opens more                               | Reading the board              | `TAB` in muted caption; `EATEN` reads as food, so it "never moves"                                             | Rename `ENGULFS`; header hint `HOLD TAB`                                                   |
| Mass cap                  | At 5000, food turns into DNA                                                       | Late, rare                     | Nothing                                                                                                        | `+N DNA` floater from food at the cap                                                      |

## Notes for the build tickets

- **Bloom timing.** The bloom starts at `ROUND_BLOOM_START_FRACTION` 0.8 (8:00 of 10:00), not halfway as the
  ticket says (confirmed by #320).
- **"Grew, then shrank"** is decay at size: a 1000-mass cell pays about 2 mass/s, 3/s in the vent. The camera
  lock hides both directions. Options for the camera (`legibility-camera-lever.png`):
  - **Z1 · partial zoom:** half-height ∝ √radius instead of ∝ radius (about 71 × √r, same clamps). The own cell
    grows on screen from 24 px at spawn to 34 px at mass 80, 47 px at 312, 62 px at 900 and 95 px at the cap.
    Cost: a big cell sees fewer of its own radii ahead (6.5 at mass 900, against 12 today). The px floors of
    `docs/ui/hud.md` §3.1.3 still hold, but its geometry table changes.
  - **Z2 · slow zoom:** keep the lock, raise `CAMERA_ZOOM_SECONDS` from 0.6 to about 6 s. A +60 engulf at mass
    312 swells the cell only from 33 to 36 px before the view catches up, and decay stays invisible. It shows
    only big jumps.
  - Either way, a mass number with its trend near the cell is the direct cue.
- **Trait picker timer** goes to 20 s in #323; none of these mockups show the picker.
- **Colour roles.** A prey ring needs a palette role; `docs/visual-style/principles-and-palette.md` §2 allows
  only danger, gold and DNA as saturated UI colours. The mockups borrow `FOOD_MOTE` green, which a build ticket
  would add as a named role.
