---
name: wf
description: Use when working under devflow: every request becomes a wf item, progress is mechanical, and nothing is "done" without evidence.
---

# wf: mechanical task tracking

1. Start a task with `node scripts/wf.mjs start <TASK-ID> [title]`; a second task in the same chat uses `also`, then `switch`.
2. Put the whole scope into wf at once with `wf add <id> --text "..."`; every new owner request becomes an item immediately.
3. Mark progress with `wf doing <id>`; close with `wf done <id> --evidence "<proof>"`. Evidence is a test run, a screenshot or a log, never a claim.
4. Blocked: `wf block <id> --needs <access|decision|legal> --reason "..."`; skipped on purpose: `wf skip <id> --reason "..."`. Reasons are mandatory.
5. Item texts, evidence and reasons are written in English.
6. Do not end a turn while `wf status` has todo or doing items without a blocker.
7. After every change run `node devflow/bin/wf-publish.mjs` so the native widget and dashboard stay current.
