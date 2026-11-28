# devflow

Mechanical task workflow for Claude Code. Every request becomes a tracked item, progress is measured instead of
claimed, and nothing is "done" without evidence. Project specifics live in one file: `devflow.config.json`.

## What is inside

| Part                 | What it does                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/wf.mjs`         | The wf state machine: `start`, `add`, `doing`, `done --evidence`, `block`, `skip`, `status`.                                                                      |
| `hooks/hooks.json`   | Plugin hooks: event journal, status context on every turn, Stop guard, widget auto-start.                                                                         |
| `skills/wf`          | The working rules Claude follows (scope into wf at once, evidence, English texts).                                                                                |
| `mcp/server.mjs`     | MCP tools (`wf_status`, `wf_add`, `wf_done`, ...). Mutating tools publish the state automatically.                                                                |
| `bin/wf-publish.mjs` | Pushes the live snapshot to the `wf-state` branch (no CI run).                                                                                                    |
| `native/`            | macOS widget: progress squares by stage, branches (dev / cpd), pipeline, prompts to copy, day and night themes. Installs itself and self-updates from `wf-state`. |
| `dashboard/`         | Local Dev Console on `127.0.0.1:5174` (read-only, loopback only).                                                                                                 |

## Install

1. Install the plugin (the `devflow` folder is the plugin root).
2. Run `node devflow/bin/devflow.mjs init` to write a starter `devflow/devflow.config.json`, then set `repo`, `taskPattern`
   and `brand`.
3. Start a task: `node scripts/wf.mjs start ABC-1 "Title"` and add the whole scope with `wf add`.

## Configuration

`devflow.config.json` is the only place that knows the host project: task id pattern, state directory, docs
directories, dashboard port and brand, the GitHub repo and the state branch settings, the dashboard URL the widget opens.

## Rules the tooling enforces

- Done requires evidence; blocked and skipped require a reason.
- A turn does not end while todo or doing items exist without a blocker (Stop hook).
- Item texts, evidence and reasons are English.
- The widget shows state only; it never writes project data.

## Status

Version 0.2.0. Licensing is not decided yet (see `LICENSE`).
