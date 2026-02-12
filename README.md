# Handoff

**The missing bridge between you and your AI coding agent.**

You find issues. You think of features. You notice things that need fixing during code reviews or just using your app. But your AI agent doesn't know about any of it until you type it all out in a prompt.

Handoff fixes that. Drop tasks, paste screenshots, tag and prioritize. Your AI reads the backlog as structured JSON and works through it. That's the whole loop.

```
You → Handoff → AI agent → Done
```

---

## Why Handoff

Every developer using AI-assisted tools (Claude Code, Cursor, Copilot, Windsurf, Aider) has the same problem: there's no clean way to capture work items and hand them to your agent. You end up either:

- Typing long descriptions from memory into a chat prompt
- Keeping a mental list and forgetting half of it
- Screenshotting issues then losing track of the screenshots
- Using heavyweight project management tools that your AI can't read

Handoff is purpose-built for this workflow. It's local, instant, and stores everything as plain JSON that any AI agent can parse.

**Zero dependencies. Single HTML file. ~200 lines of server code. Just [Bun](https://bun.sh).**

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

- **Status tabs:** Open, Done, All
- **Category filter:** Auto-populated from your tasks
- **Priority filter:** High, Medium, Low
- Open tasks auto-sort by priority (high first)

### Inline editing

Everything is editable in place:
- **Click task text** to edit inline
- **Click a category badge** to rename
- **Click the priority dot** to cycle through levels
- **Click the checkbox** to mark done/reopen

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus the input field (from anywhere) |
| `Enter` | Submit task |
| `Escape` | Cancel editing / close lightbox |
| `Ctrl+V` | Paste screenshot |

---

## AI Integration

This is the reason Handoff exists. Your tasks are stored as a JSON array in `data/tasks.json`. Any AI agent that can read files can read your backlog.

### The data format

```json
{
  "id": "m1abc2def",
  "text": "Fix login redirect loop",
  "category": "auth",
  "priority": "high",
  "status": "open",
  "screenshots": ["m1abc2def-0.png"],
  "created": "2026-02-12T06:27:59.719Z",
  "completed": null
}
```

Screenshots are in `data/screenshots/` and named `{taskId}-{index}.png`.

### Claude Code

Add this to your project's `CLAUDE.md`:

```markdown
## Task Backlog

Read `path/to/handoff/data/tasks.json` for the current task backlog.
Filter for `status: "open"` tasks, prioritize by `priority` field (high > medium > low).
Screenshots are in `path/to/handoff/data/screenshots/` — read them for visual context.
```

Then tell Claude: *"Check the Handoff backlog and work through the open tasks."*

### Cursor / Windsurf / Copilot

Same approach — add a `.cursorrules` or equivalent instruction file pointing to the JSON:

```
When asked to check the backlog, read path/to/handoff/data/tasks.json.
Work through open tasks sorted by priority. View screenshots for visual context.
```

### Programmatic access

Handoff also exposes a REST API on the same port:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | Get all tasks |
| `POST` | `/api/tasks` | Create a task |
| `POST` | `/api/tasks/batch` | Create multiple tasks |
| `PATCH` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/tasks/:id/screenshots` | Add a screenshot |
| `GET` | `/screenshots/:filename` | Serve a screenshot |

**Create a task:**
```bash
curl -X POST http://localhost:3456/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"text": "Fix the navbar #ui !1"}'
```

**Mark a task done:**
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

- **`server.ts`** — ~200 lines. Bun HTTP server, REST API, file serving. No frameworks, no middleware, no dependencies.
- **`index.html`** — Self-contained SPA. Inline CSS + vanilla JavaScript. No build step, no bundler, no npm packages.
- **`data/tasks.json`** — Plain JSON array. Human-readable, AI-parseable, version-controllable if you want.
- **`data/screenshots/`** — PNG files named by task ID.

The entire tool is 4 files and runs on nothing but Bun.

---

## Philosophy

Handoff was born from building software with AI agents every day. We needed a way to capture tasks — bugs, features, improvements, things we noticed — without breaking flow, and hand them to our AI in a format it could actually use.

**Principles:**
- **Local-first.** Your tasks live on your machine. No accounts, no cloud, no sync.
- **Zero friction.** If adding a task takes more than 2 seconds, the tool has failed.
- **AI-native.** JSON storage isn't a technical choice — it's a design choice. Your AI agent is a first-class consumer of this data.
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
