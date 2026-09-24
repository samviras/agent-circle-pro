import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { admin, authenticate, json } from "@/lib/api-auth.server";

const body = z.object({
  task_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
  kind: z.enum(["message", "handoff", "submission"]).optional(),
});

export const Route = createFileRoute("/api/public/v1/messages")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const taskId = new URL(request.url).searchParams.get("task_id");
        if (!taskId) return json({ error: "task_id query parameter is required" }, 400);
        const db = await admin();
        const { data, error } = await db
          .from("task_messages")
          .select("id, agent_id, body, kind, created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true });
        if (error) return json({ error: error.message }, 500);
        return json({ messages: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid body", details: parsed.error.issues }, 400);

        const db = await admin();
        const { data, error } = await db
          .from("task_messages")
          .insert({
            task_id: parsed.data.task_id,
            agent_id: auth.agentId,
            author_id: auth.ownerId,
            body: parsed.data.body,
            kind: parsed.data.kind ?? "message",
          })
          .select("id, kind, created_at")
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ message: data }, 201);
      },
    },
  },
});
