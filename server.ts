import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";

const PORT = parseInt(process.env.PORT || "3456");
const ROOT = import.meta.dir;
const DATA_DIR = join(ROOT, "data");
const SCREENSHOTS_DIR = join(DATA_DIR, "screenshots");
const TASKS_FILE = join(DATA_DIR, "tasks.json");

// Bootstrap data directories
mkdirSync(SCREENSHOTS_DIR, { recursive: true });
if (!existsSync(TASKS_FILE)) writeFileSync(TASKS_FILE, "[]");

interface Task {
  id: string;
  text: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: "open" | "done";
  screenshots: string[];
  created: string;
  completed: string | null;
}

const load = (): Task[] => JSON.parse(readFileSync(TASKS_FILE, "utf-8"));
const save = (tasks: Task[]) => writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
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
    const { pathname } = new URL(req.url);
    const method = req.method;

    try {
      // GET /api/tasks
      if (pathname === "/api/tasks" && method === "GET") {
        return json(load());
      }

      // POST /api/tasks
      if (pathname === "/api/tasks" && method === "POST") {
        const body = await req.json();
        const tasks = load();
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
          screenshots,
          created: new Date().toISOString(),
          completed: null,
        };

        tasks.unshift(task);
        save(tasks);
        return json(task, 201);
      }

      // POST /api/tasks/batch
      if (pathname === "/api/tasks/batch" && method === "POST") {
        const body = await req.json();
        const tasks = load();
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
            screenshots: [],
            created: new Date().toISOString(),
            completed: null,
          });
        }

        tasks.unshift(...created);
        save(tasks);
        return json(created, 201);
      }

      // /api/tasks/:id/screenshots
      const ssMatch = pathname.match(/^\/api\/tasks\/([a-z0-9]+)\/screenshots$/);
      if (ssMatch && method === "POST") {
        const tasks = load();
        const task = tasks.find((t) => t.id === ssMatch[1]);
        if (!task) return json({ error: "Not found" }, 404);
        const body = await req.json();
        const filename = saveScreenshot(task.id, task.screenshots.length, body.data);
        task.screenshots.push(filename);
        save(tasks);
        return json(task);
      }

      // /api/tasks/:id
      const taskMatch = pathname.match(/^\/api\/tasks\/([a-z0-9]+)$/);
      if (taskMatch) {
        const taskId = taskMatch[1];
        const tasks = load();
        const idx = tasks.findIndex((t) => t.id === taskId);
        if (idx === -1) return json({ error: "Not found" }, 404);

        if (method === "PATCH") {
          const body = await req.json();
          const task = tasks[idx];
          if (body.text !== undefined) task.text = body.text;
          if (body.category !== undefined) task.category = body.category;
          if (body.priority !== undefined) task.priority = body.priority;
          if (body.status !== undefined) {
            task.status = body.status;
            task.completed = body.status === "done" ? new Date().toISOString() : null;
          }
          save(tasks);
          return json(task);
        }

        if (method === "DELETE") {
          for (const s of tasks[idx].screenshots) {
            try { unlinkSync(join(SCREENSHOTS_DIR, s)); } catch {}
          }
          tasks.splice(idx, 1);
          save(tasks);
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
