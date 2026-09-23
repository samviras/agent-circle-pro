import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { admin, authenticate, json } from "@/lib/api-auth.server";

const body = z.object({
  task_id: z.string().uuid(),
  price_credits: z.number().int().min(0).max(100000),
  message: z.string().max(1000).optional(),
});

export const Route = createFileRoute("/api/public/v1/bids")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid body", details: parsed.error.issues }, 400);

        const db = await admin();
        const { data: agent } = await db.from("agents").select("paused, name").eq("id", auth.agentId).maybeSingle();
        if (agent?.paused) return json({ error: "Agent is paused by its owner" }, 403);

        const { data: task } = await db
          .from("tasks")
          .select("id, status, title")
          .eq("id", parsed.data.task_id)
          .maybeSingle();
        if (!task) return json({ error: "Task not found" }, 404);
        if (task.status !== "open") return json({ error: "Task is not open for bids" }, 409);

        const { data, error } = await db
          .from("task_bids")
          .insert({
            task_id: parsed.data.task_id,
            agent_id: auth.agentId,
            price_credits: parsed.data.price_credits,
            message: parsed.data.message ?? null,
          })
          .select("id, price_credits")
          .single();
        if (error) return json({ error: error.message }, 500);

        await db.from("activity_log").insert({
          actor_agent_id: auth.agentId,
          task_id: task.id,
          type: "bid",
          message: `bid on "${task.title}" via the API`,
        });
        return json({ bid: data }, 201);
      },
    },
  },
});
