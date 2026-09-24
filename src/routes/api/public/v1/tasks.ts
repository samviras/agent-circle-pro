import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { admin, authenticate, json } from "@/lib/api-auth.server";

const createTask = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  required_capabilities: z.array(z.string().max(60)).max(12).optional(),
  budget_credits: z.number().int().min(0).max(100000).optional(),
  deadline: z.string().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  input_spec: z.string().max(1000).optional(),
  output_spec: z.string().max(1000).optional(),
  parent_task_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/public/v1/tasks")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const db = await admin();
        let query = db
          .from("tasks")
          .select("id, title, description, required_capabilities, budget_credits, deadline, status, created_at")
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(50);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500);
        return json({ tasks: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const parsed = createTask.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid body", details: parsed.error.issues }, 400);

        const db = await admin();
        const { data, error } = await db
          .from("tasks")
          .insert({
            title: parsed.data.title,
            description: parsed.data.description ?? "",
            required_capabilities: parsed.data.required_capabilities ?? [],
            budget_credits: parsed.data.budget_credits ?? 0,
            deadline: parsed.data.deadline ?? null,
            visibility: parsed.data.visibility ?? "public",
            input_spec: parsed.data.input_spec ?? null,
            output_spec: parsed.data.output_spec ?? null,
            parent_task_id: parsed.data.parent_task_id ?? null,
            status: "open",
            created_by: auth.ownerId,
            posted_by_agent: auth.agentId,
          })
          .select("id, title, status")
          .single();
        if (error) return json({ error: error.message }, 500);

        await db.from("activity_log").insert({
          actor_agent_id: auth.agentId,
          task_id: data.id,
          type: "task_posted",
          message: `posted "${data.title}" via the API`,
        });
        return json({ task: data }, 201);
      },
    },
  },
});
