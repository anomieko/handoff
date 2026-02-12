# Handoff

**The missing bridge between you and your AI coding agent.**

You find issues. You think of features. You notice things that need fixing during code reviews or just using your app. But your AI agent doesn't know about any of it until you type it all out in a prompt.

Handoff fixes that. Drop tasks, paste screenshots, tag and prioritize. Your AI reads the backlog, works through it, and marks tasks for your review. You verify the work, then close.

```
You → Handoff → AI agent → Review → Done
```

---

## Why Handoff

Every developer using AI-assisted tools (Claude Code, Cursor, Copilot, Windsurf, Aider) has the same problem: there's no clean way to capture work items and hand them to your agent. You end up either:

- Typing long descriptions from memory into a chat prompt
- Keeping a mental list and forgetting half of it
- Screenshotting issues then losing track of the screenshots
- Using heavyweight project management tools that your AI can't read

Handoff is purpose-built for this workflow. It's local, instant, and stores everything as plain JSON that any AI agent can parse.

**Zero dependencies. Single HTML file. ~250 lines of server code. Just [Bun](https://bun.sh).**

---

## Quick Start

```bash
# 1. Clone it
git clone https://github.com/anomie/handoff.git
cd handoff

# 2. Run it
./start.sh
```

Open [http://localhost:3456](http://localhost:3456). That's it.

> Requires [Bun](https://bun.sh). Install with `curl -fsSL https://bun.sh/install | bash`

---

## Features

### Capture tasks fast

Type a task and hit Enter. Use inline tags to categorize and prioritize without touching a dropdown:

```
Fix login redirect loop #auth !1
Add dark mode toggle #ui !2
Refactor payment service #backend !low
```

**Tag syntax:**
| Tag | Effect |
|-----|--------|
| `#word` | Sets category (first match) |
| `!1` or `!high` | High priority |
| `!2` or `!med` | Medium priority |
| `!3` or `!low` | Low priority |

Tags are stripped from the task text automatically.

### Paste screenshots

Copy a screenshot to your clipboard and paste anywhere in Handoff. Screenshots attach to the task you're creating (or to an expanded existing task). No file dialogs, no drag and drop fiddling. Just `Ctrl+V`.

Screenshots are stored locally as PNGs with click-to-expand lightbox viewing.

### Batch mode

Click **Batch** to switch to multi-line input. Add dozens of tasks at once, one per line. Tags work inline. The counter shows you how many tasks will be created.

### Filter and prioritize

- **Status tabs:** Open, Review, Done, All (with counts)
- **Category filter:** Auto-populated from your tasks
- **Priority filter:** High, Medium, Low
- Open and Review tasks auto-sort by priority (high first)

### Review workflow

Tasks follow a three-step lifecycle: **Open → Review → Done**.

- **Open** — Work to be done. Your AI reads these.
- **Review** — AI marks tasks here when finished, with a comment explaining what was done. You verify the work.
- **Done** — You approved the review. Archived.

In the Review tab:
- Tasks show a yellow left border and "Review" badge
- The AI's comment appears below the task text
- Click the checkbox to approve (moves to Done)
- Click "Reopen" to send back to Open

### Inline editing

Everything is editable in place:
- **Click task text** to edit inline
- **Click a category badge** to rename
- **Click the priority dot** to cycle through levels
- **Click the checkbox** to toggle status

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus the input field (from anywhere) |
| `Enter` | Submit task |
| `Escape` | Cancel editing / close lightbox |
| `Ctrl+V` | Paste screenshot |

---

## AI Integration

This is the reason Handoff exists. Your tasks are stored as JSON files split by status. Your AI only needs to read the open tasks.

### File structure

```
data/open.json       — Tasks the AI should work on
data/review.json     — Tasks awaiting your review
data/done.json       — Archived completed tasks
data/screenshots/    — PNG files named by task ID
```

### The data format

```json
{
  "id": "m1abc2def",
  "text": "Fix login redirect loop",
  "category": "auth",
  "priority": "high",
  "status": "open",
  "comment": null,
  "screenshots": ["m1abc2def-0.png"],
  "created": "2026-02-12T06:27:59.719Z",
  "completed": null
}
```

### Claude Code

Add this to your project's `CLAUDE.md`:

```markdown
## Task Backlog

Read `path/to/handoff/data/open.json` for the current task backlog.
Prioritize by `priority` field (high > medium > low).
Screenshots are in `path/to/handoff/data/screenshots/` — read them for visual context.

When you finish a task, mark it for review (do NOT mark as done):
curl -X PATCH http://localhost:3456/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "review", "comment": "Brief description of what you did"}'
```

Then tell Claude: *"Check the Handoff backlog and work through the open tasks."*

The key behavior: **the AI marks tasks as "review", not "done"**. This gives you a chance to verify the work before closing it out.

### Cursor / Windsurf / Copilot

Same approach — add a `.cursorrules` or equivalent instruction file:

```
When asked to check the backlog, read path/to/handoff/data/open.json.
Work through open tasks sorted by priority. View screenshots for visual context.

When finished with a task, do NOT mark it as done. Instead, mark it for review:
curl -X PATCH http://localhost:3456/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "review", "comment": "Brief description of what you did"}'
```

### Programmatic access

Handoff exposes a REST API on the same port:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | Get all tasks (supports `?status=open\|review\|done`) |
| `POST` | `/api/tasks` | Create a task |
| `POST` | `/api/tasks/batch` | Create multiple tasks |
| `PATCH` | `/api/tasks/:id` | Update a task (text, category, priority, status, comment) |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/tasks/:id/screenshots` | Add a screenshot |
| `GET` | `/screenshots/:filename` | Serve a screenshot |

**Get only open tasks:**
```bash
curl http://localhost:3456/api/tasks?status=open
```

**Create a task:**
```bash
curl -X POST http://localhost:3456/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"text": "Fix the navbar #ui !1"}'
```

**Mark a task for review:**
```bash
curl -X PATCH http://localhost:3456/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "review", "comment": "Fixed the navbar alignment and added responsive breakpoints"}'
```

**Approve a review (mark done):**
```bash
curl -X PATCH http://localhost:3456/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Server port |

```bash
PORT=8080 ./start.sh
```

Data is stored in `data/` relative to where Handoff runs. The directory is auto-created on first launch.

---

## Architecture

Handoff is intentionally minimal:

- **`server.ts`** — ~250 lines. Bun HTTP server, REST API, file serving. No frameworks, no middleware, no dependencies.
- **`index.html`** — Self-contained SPA. Inline CSS + vanilla JavaScript. No build step, no bundler, no npm packages.
- **`data/open.json`** — Open tasks (what your AI reads).
- **`data/review.json`** — Tasks awaiting your review.
- **`data/done.json`** — Archived completed tasks.
- **`data/screenshots/`** — PNG files named by task ID.

The entire tool is a few files and runs on nothing but Bun.

> **Migration:** If you have a legacy `data/tasks.json` from a previous version, Handoff automatically splits it into the three status files on startup and removes the old file.

---

## Philosophy

Handoff was born from building software with AI agents every day. We needed a way to capture tasks — bugs, features, improvements, things we noticed — without breaking flow, and hand them to our AI in a format it could actually use.

**Principles:**
- **Local-first.** Your tasks live on your machine. No accounts, no cloud, no sync.
- **Zero friction.** If adding a task takes more than 2 seconds, the tool has failed.
- **AI-native.** JSON storage isn't a technical choice — it's a design choice. Your AI agent is a first-class consumer of this data.
- **Review before done.** AI work needs human verification. The review step prevents silent mistakes.
- **No dependencies.** Nothing to install, nothing to update, nothing to break. Just Bun and your browser.

---

## Contributing

Contributions welcome. Handoff should stay small and focused — the best feature requests are ones that make the capture-and-handoff loop faster, not ones that turn this into Jira.

**Good contributions:**
- Faster task capture
- Better AI integration patterns
- Accessibility improvements
- Bug fixes

**Not a fit:**
- User accounts / auth
- Cloud sync
- Databases
- Build steps or bundlers

---

## License

[MIT](LICENSE)
