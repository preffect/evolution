#!/usr/bin/env python3
"""TeammateIdle hook — keep an agent from going idle on its own unfinished work (ticket #519).

The stall: an agent starts a command with run_in_background, ends its turn ("I'll pick this up when it
finishes"), and is never woken when the command ends. This hook reads the idling agent's transcript, finds
every background command it started (the harness prints "Output is being written to: <file>"), and blocks
the idle (exit 2, reason on stderr) when one of them is still running or finished after the agent's last
action. Every call is logged to .game-logs/teammate-idle.log, since the event's fields are undocumented.
A per-transcript budget stops it from blocking forever.
"""
import glob, json, os, re, sys, time

LOG = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "/workspace"), ".game-logs", "teammate-idle.log")
STATE_DIR = "/tmp/claude-teammate-idle"
MAX_BLOCKS_PER_HOUR = 6
BLOCK = 2
OUTPUT_FILE = re.compile(r"Output is being written to: (\S+\.output)")
# The harness ends a task's output with "[exited with code N]" or "[killed]".
EXIT_MARKER = re.compile(r"^\[(exited with code \d+|killed)\]$", re.M)


def log(message):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a") as handle:
        handle.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {message}\n")


def transcript_entries(path):
    entries = []
    try:
        with open(path) as handle:
            for line in handle:
                try:
                    entries.append(json.loads(line))
                except ValueError:
                    pass
    except OSError:
        pass
    return entries


def background_files(entries):
    found = []
    for entry in entries:
        for match in OUTPUT_FILE.finditer(json.dumps(entry)):
            if match.group(1) not in found:
                found.append(match.group(1))
    return found


def last_action_time(path):
    try:
        return os.path.getmtime(path)
    except OSError:
        return time.time()


def outstanding(files, transcript_path):
    since = last_action_time(transcript_path)
    reasons = []
    for output in files:
        try:
            text = open(output).read()
        except OSError:
            continue
        if not EXIT_MARKER.search(text):
            reasons.append(f"still running: {output} — call `scripts/wait-for.sh {output}` in the foreground")
        elif os.path.getmtime(output) > since:
            reasons.append(f"finished after your last action and you have not read it: {output} — read it now")
    return reasons


def within_budget(transcript_path):
    os.makedirs(STATE_DIR, exist_ok=True)
    state = os.path.join(STATE_DIR, re.sub(r"\W", "_", transcript_path)[-120:])
    now = time.time()
    try:
        stamps = [float(s) for s in open(state).read().split() if now - float(s) < 3600]
    except OSError:
        stamps = []
    if len(stamps) >= MAX_BLOCKS_PER_HOUR:
        return False
    with open(state, "w") as handle:
        handle.write(" ".join(str(s) for s in stamps + [now]))
    return True


def teammate_transcript(event):
    """The idling teammate's OWN transcript. The event's transcript_path is the lead session's, whose
    background commands are not the teammate's; teammates live at <session>/subagents/agent-a<name>-*.jsonl."""
    name = event.get("teammate_name")
    session = (event.get("transcript_path") or "").removesuffix(".jsonl")
    if not name or not session:
        return ""
    matches = glob.glob(os.path.join(session, "subagents", f"agent-a{name}-*.jsonl"))
    return max(matches, key=os.path.getmtime) if matches else ""


def main():
    raw = sys.stdin.read()
    try:
        event = json.loads(raw)
    except ValueError:
        log(f"unparseable input: {raw[:300]!r}")
        return 0
    transcript_path = teammate_transcript(event)
    log(f"teammate={event.get('teammate_name')} transcript={transcript_path or 'NOT FOUND (allowing idle)'}")
    if not transcript_path:
        return 0
    reasons = outstanding(background_files(transcript_entries(transcript_path)), transcript_path)
    if not reasons:
        return 0
    if not within_budget(transcript_path):
        log(f"budget spent, letting it idle: {reasons}")
        return 0
    log(f"BLOCKED idle: {reasons}")
    sys.stderr.write(
        "Do not go idle: a command you started is not done with.\n- " + "\n- ".join(reasons)
        + "\nNever end your turn on a running command (.claude/roles/_common.md rule 8).\n"
    )
    return BLOCK


if __name__ == "__main__":
    sys.exit(main())
