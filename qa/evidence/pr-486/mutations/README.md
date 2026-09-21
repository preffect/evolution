# The mutation runs, verbatim

Kept because three of the five mutations in `run-1` **failed to compile**, and a runner that scores by exit code
alone cannot tell that from a guard firing. Both runs and both logs are here so the claim "each guard was verified
by breaking it" can be checked rather than taken.

| File                     | What it is                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `run-1-first-attempt.sh` | The first pass. M1 and M3 are sound; **M2, M4 and M5 die on `TS6133`** and test nothing       |
| `run-1-output.log`       | Its output — look at M2, M4 and M5: `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` and **no test lines** |
| `run-2-rewritten.sh`     | M2, M4 and M5 rewritten to keep every symbol used, with the build-failure check in `run()`    |
| `run-2-output.log`       | Its output: all three red on the intended guard, with the assertion messages                  |

## The trap, and the four lines that close it

Each of the three failures removed a symbol's last use — swapping `CILIA_REACH_RADII` for `FLAGELLUM_LENGTH_RADII`
left the first unused, and so on. TypeScript's `noUnusedLocals` rejected the build, `validate.sh` exited non-zero,
and a runner watching only the exit code reads that as "the guard fired". Three guards would have been claimed and
none exercised.

The fix is not discipline, it is the runner refusing to score a run that never ran:

```sh
out=$(./validate.sh test --scope "$2" 2>&1)
if ! grep -qE "^ +Tests +[0-9]" <<<"$out"; then
  echo "!!! $1 BUILD FAILED — no test lines, so this mutation TESTED NOTHING"
fi
```

The same shape guards any filtered command: **a filter that hides a result looks exactly like a pass.** The pattern
generalises past mutation testing — `| tail -40` on a test log truncated a spec listing during this ticket and read
as "the spec was skipped", which was also wrong in the safe-looking direction.

## Reusing these

They are evidence, not a tool: each one patches named anchors in specific files with `python3` and `assert`s the
anchor is unique, so they do not survive the code moving. Copy the `run()` function and the anchor-uniqueness
assertion; rewrite the mutations for whatever you are breaking.
