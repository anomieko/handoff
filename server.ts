import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";

const PORT = parseInt(process.env.PORT || "3456");
const ROOT = import.meta.dir;
const DATA_DIR = join(ROOT, "data");
const SCREENSHOTS_DIR = join(DATA_DIR, "screenshots");

// Split storage — one file per status
const OPEN_FILE = join(DATA_DIR, "open.json");
const REVIEW_FILE = join(DATA_DIR, "review.json");
const DONE_FILE = join(DATA_DIR, "done.json");
const LEGACY_FILE = join(DATA_DIR, "tasks.json");

// Bootstrap data directories
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

interface Task {
  id: string;
  text: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: "open" | "review" | "done";
  comment: string | null;
  screenshots: string[];
  created: string;
  completed: string | null;
}

// --- Storage helpers ---
const loadFile = (path: string): Task[] => {
  if (!existsSync(path)) return [];
  try { return JSON.parse(readFileSync(path, "utf-8")); }
  catch { return []; }
};

const saveFile = (path: string, tasks: Task[]) =>
  writeFileSync(path, JSON.stringify(tasks, null, 2));

const fileForStatus = (status: string): string => {
  if (status === "review") return REVIEW_FILE;
  if (status === "done") return DONE_FILE;
  return OPEN_FILE;
};

const loadAll = (): Task[] => [
  ...loadFile(OPEN_FILE),
  ...loadFile(REVIEW_FILE),
  ...loadFile(DONE_FILE),
];

const findTask = (id: string): { task: Task; file: string; tasks: Task[] } | null => {
  for (const file of [OPEN_FILE, REVIEW_FILE, DONE_FILE]) {
    const tasks = loadFile(file);
    const task = tasks.find(t => t.id === id);
    if (task) return { task, file, tasks };
  }
  return null;
};

// --- Migration from legacy tasks.json ---
if (existsSync(LEGACY_FILE)) {
  console.log("Migrating legacy tasks.json to split files...");
  try {
    const legacy: any[] = JSON.parse(readFileSync(LEGACY_FILE, "utf-8"));
    const open: Task[] = [];
    const review: Task[] = [];
    const done: Task[] = [];

    for (const t of legacy) {
      const task: Task = { ...t, comment: t.comment ?? null };
      if (task.status === "done") done.push(task);
      else if (task.status === "review") review.push(task);
      else open.push(task);
    }

    saveFile(OPEN_FILE, open);
    saveFile(REVIEW_FILE, review);
    saveFile(DONE_FILE, done);
    unlinkSync(LEGACY_FILE);
    console.log(`  Migrated: ${open.length} open, ${review.length} review, ${done.length} done`);
  } catch (e) {
    console.error("Migration failed, keeping legacy file:", e);
  }
}

// Ensure split files exist
for (const f of [OPEN_FILE, REVIEW_FILE, DONE_FILE]) {
  if (!existsSync(f)) writeFileSync(f, "[]");
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const json = (data: unknown, status = 200) => Response.json(data, { status });

function parseTags(raw: string): { text: string; category: string; priority: "high" | "medium" | "low" } {
  let text = raw;
  let category = "";
  let priority: "high" | "medium" | "low" = "low";

  // Priority: !1, !2, !3, !high, !med, !low
  text = text.replace(/\s*!([123]|high|med(?:ium)?|low)\b/i, (_, p) => {
    const v = p.toLowerCase();
    priority = v === "1" || v === "high" ? "high" : v === "2" || v.startsWith("med") ? "medium" : "low";
    return "";
  });

  // Category: #word (first match)
  text = text.replace(/\s*#(\w+)\b/, (_, c) => {
    category = c.toLowerCase();
    return "";
  });

  return { text: text.trim().replace(/\s{2,}/g, " "), category, priority };
}

function saveScreenshot(taskId: string, idx: number, data: string): string {
  const filename = `${taskId}-${idx}.png`;
  const b64 = data.includes(",") ? data.split(",")[1] : data;
  writeFileSync(join(SCREENSHOTS_DIR, filename), Buffer.from(b64, "base64"));
  return filename;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    try {
      // GET /api/tasks — supports ?status=open|review|done
      if (pathname === "/api/tasks" && method === "GET") {
        const statusParam = url.searchParams.get("status");
        if (statusParam && ["open", "review", "done"].includes(statusParam)) {
          return json(loadFile(fileForStatus(statusParam)));
        }
        return json(loadAll());
      }

      // POST /api/tasks
      if (pathname === "/api/tasks" && method === "POST") {
        const body = await req.json();
        const parsed = parseTags(body.text || "");
        const taskId = genId();

        const screenshots: string[] = [];
        if (Array.isArray(body.screenshots)) {
          body.screenshots.forEach((s: string, i: number) => {
            screenshots.push(saveScreenshot(taskId, i, s));
          });
        }

        const task: Task = {
          id: taskId,
          text: parsed.text || body.text || "",
          category: body.category || parsed.category,
          priority: body.priority || parsed.priority,
          status: "open",
          comment: null,
          screenshots,
          created: new Date().toISOString(),
          completed: null,
        };

        const tasks = loadFile(OPEN_FILE);
        tasks.unshift(task);
        saveFile(OPEN_FILE, tasks);
        return json(task, 201);
      }

      // POST /api/tasks/batch
      if (pathname === "/api/tasks/batch" && method === "POST") {
        const body = await req.json();
        const created: Task[] = [];

        for (const line of body.lines || []) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parsed = parseTags(trimmed);
          created.push({
            id: genId(),
            text: parsed.text,
            category: parsed.category,
            priority: parsed.priority,
            status: "open",
            comment: null,
            screenshots: [],
            created: new Date().toISOString(),
            completed: null,
          });
        }

        const tasks = loadFile(OPEN_FILE);
        tasks.unshift(...created);
        saveFile(OPEN_FILE, tasks);
        return json(created, 201);
      }

      // /api/tasks/:id/screenshots
      const ssMatch = pathname.match(/^\/api\/tasks\/([a-z0-9]+)\/screenshots$/);
      if (ssMatch && method === "POST") {
        const found = findTask(ssMatch[1]);
        if (!found) return json({ error: "Not found" }, 404);
        const { task, file, tasks } = found;
        const body = await req.json();
        const filename = saveScreenshot(task.id, task.screenshots.length, body.data);
        task.screenshots.push(filename);
        saveFile(file, tasks);
        return json(task);
      }

      // /api/tasks/:id
      const taskMatch = pathname.match(/^\/api\/tasks\/([a-z0-9]+)$/);
      if (taskMatch) {
        const taskId = taskMatch[1];

        if (method === "PATCH") {
          const found = findTask(taskId);
          if (!found) return json({ error: "Not found" }, 404);
          const { task, file: sourceFile, tasks: sourceTasks } = found;
          const body = await req.json();

          if (body.text !== undefined) task.text = body.text;
          if (body.category !== undefined) task.category = body.category;
          if (body.priority !== undefined) task.priority = body.priority;
          if (body.comment !== undefined) task.comment = body.comment;

          if (body.status !== undefined && body.status !== task.status) {
            const newStatus = body.status as Task["status"];
            task.status = newStatus;
            task.completed = newStatus === "done" ? new Date().toISOString() : null;

            // Move task between files
            const destFile = fileForStatus(newStatus);
            if (destFile !== sourceFile) {
              // Remove from source
              const idx = sourceTasks.findIndex(t => t.id === taskId);
              if (idx !== -1) sourceTasks.splice(idx, 1);
              saveFile(sourceFile, sourceTasks);

              // Add to destination
              const destTasks = loadFile(destFile);
              destTasks.unshift(task);
              saveFile(destFile, destTasks);

              return json(task);
            }
          }

          saveFile(sourceFile, sourceTasks);
          return json(task);
        }

        if (method === "DELETE") {
          const found = findTask(taskId);
          if (!found) return json({ error: "Not found" }, 404);
          const { task, file, tasks } = found;

          for (const s of task.screenshots) {
            try { unlinkSync(join(SCREENSHOTS_DIR, s)); } catch {}
          }

          const idx = tasks.findIndex(t => t.id === taskId);
          if (idx !== -1) tasks.splice(idx, 1);
          saveFile(file, tasks);
          return new Response(null, { status: 204 });
        }
      }

      // Serve screenshots
      if (pathname.startsWith("/screenshots/")) {
        const filename = pathname.slice(13);
        if (filename.includes("..") || filename.includes("/")) {
          return new Response("Forbidden", { status: 403 });
        }
        const file = Bun.file(join(SCREENSHOTS_DIR, filename));
        if (await file.exists()) {
          return new Response(file, { headers: { "Content-Type": "image/png" } });
        }
        return new Response("Not found", { status: 404 });
      }

      // Serve index.html
      if (pathname === "/" || pathname === "/index.html") {
        return new Response(Bun.file(join(ROOT, "index.html")), {
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("Not found", { status: 404 });
    } catch (e) {
      console.error(e);
      return json({ error: "Internal server error" }, 500);
    }
  },
});

console.log(`\n  Handoff running at http://localhost:${PORT}\n`);
