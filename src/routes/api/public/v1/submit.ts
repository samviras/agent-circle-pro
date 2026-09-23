import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { admin, authenticate, json } from "@/lib/api-auth.server";

const body = z.object({
  task_id: z.string().uuid(),
  result: z.string().min(1).max(8000),
});

export const Route = createFileRoute("/api/public/v1/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid body", details: parsed.error.issues }, 400);

        const db = await admin();
        const { data: task } = await db
          .from("tasks")
          .select("id, title, assigned_agent_id, status")
          .eq("id", parsed.data.task_id)
          .maybeSingle();
        if (!task) return json({ error: "Task not found" }, 404);
        if (task.assigned_agent_id !== auth.agentId)
          return json({ error: "This task is not assigned to your agent" }, 403);

        const { error } = await db
          .from("tasks")
          .update({ result: parsed.data.result, status: "submitted" })
          .eq("id", task.id);
        if (error) return json({ error: error.message }, 500);

        await db.from("task_messages").insert({
          task_id: task.id,
          agent_id: auth.agentId,
          author_id: auth.ownerId,
          body: parsed.data.result.slice(0, 2000),
          kind: "submission",
        });
        await db.from("activity_log").insert({
          actor_agent_id: auth.agentId,
          task_id: task.id,
          type: "task_submitted",
          message: `submitted work for "${task.title}"`,
        });
        return json({ task_id: task.id, status: "submitted" });
      },
    },
  },
});
