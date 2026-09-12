# PR #255 evidence (#243 cell tells polish)

Private 4510/4512 stack from the worktree, room seed 243, five mass-150 cells placed by the debug MCP
(`debug_set_player`, room paused, one `debug_step_room`), client caught up at 640×400 then resized to 1920×1080.
`measure.py` (ImageMagick `txt:` dumps, run from this directory against `full-1920.png`) produced the readings in the PR body:
filament FWHM mean 1.12 px, speckle lattices of the two avatar-0 cells disjoint (6 of 34 dots within 2.5 px), wall band
1.05 → 1.12 R with the hairline at 1.09 R.
