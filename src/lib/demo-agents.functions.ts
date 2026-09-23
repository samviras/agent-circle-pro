import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PITCH: Record<string, string> = {
  "research-agent": "I can research this and deliver a cited summary.",
  "code-review-agent": "I'll review this and return prioritized, actionable notes.",
  "data-cleaning-agent": "I'll clean and normalize the data and document every change.",
  "scheduling-agent": "I can coordinate the timing and propose slots that work.",
};

async function generateResult(agentName: string, tagline: string, task: { title: string; description: string; output_spec: string | null }) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are ${agentName}, an AI agent on a marketplace. ${tagline}. Deliver the requested work directly, concise and well-structured in markdown, under 350 words. No preamble.`,
        },
        {
          role: "user",
          content: `Task: ${task.title}\n\n${task.description}${task.output_spec ? `\n\nExpected output: ${task.output_spec}` : ""}`,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() || null;
}

/** Lets the seeded demo agents react to a task: bid, start work, and submit. */
export const runDemoAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // The caller must be able to see this task.
    const { data: visible } = await context.supabase.from("tasks").select("id").eq("id", data.taskId).maybeSingle();
    if (!visible) return { acted: false };

    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: task } = await db.from("tasks").select("*").eq("id", data.taskId).single();
    if (!task) return { acted: false };

    const { data: demos } = await db
      .from("agents")
      .select("id, slug, name, tagline, price_credits, paused, agent_capabilities(capabilities(name, slug))")
      .eq("demo", true);
    const agents = (demos ?? []).filter((a) => !a.paused);
    let acted = false;

    if (task.status === "open") {
      const { data: bids } = await db.from("task_bids").select("agent_id").eq("task_id", task.id);
      const already = new Set((bids ?? []).map((b) => b.agent_id));
      const req = (task.required_capabilities ?? []).map((c: string) => c.toLowerCase());
      const text = `${task.title} ${task.description}`.toLowerCase();
      for (const a of agents) {
        if (already.has(a.id)) continue;
        const caps = (a.agent_capabilities ?? []).flatMap((r: any) =>
          r.capabilities ? [r.capabilities.name.toLowerCase(), r.capabilities.slug.toLowerCase()] : [],
        );
        const match = req.length
          ? req.some((r: string) => caps.includes(r))
          : caps.some((c: string) => text.includes(c.replace(/-/g, " ")));
        if (!match) continue;
        const price = Math.min(task.budget_credits, a.price_credits || task.budget_credits);
        await db.from("task_bids").insert({ task_id: task.id, agent_id: a.id, price_credits: price, message: PITCH[a.slug] ?? "Ready to take this on." });
        await db.from("activity_log").insert({ actor_agent_id: a.id, task_id: task.id, type: "bid", message: `bid on "${task.title}"` });
        acted = true;
      }
      return { acted };
    }

    const assignee = agents.find((a) => a.id === task.assigned_agent_id);
    if (!assignee) return { acted };

    if (task.status === "assigned") {
      await db.from("tasks").update({ status: "in_progress" }).eq("id", task.id);
      await db.from("task_messages").insert({ task_id: task.id, agent_id: assignee.id, body: "Thanks — starting work now. I'll post my deliverable here shortly.", kind: "message" });
      await db.from("activity_log").insert({ actor_agent_id: assignee.id, task_id: task.id, type: "started", message: `started "${task.title}"` });
      acted = true;
      task.status = "in_progress";
    }

    if (task.status === "in_progress" && !task.result) {
      const result =
        (await generateResult(assignee.name, assignee.tagline ?? "", task)) ??
        `Deliverable for "${task.title}" is ready. (Demo agent — simulated output.)`;
      await db.from("tasks").update({ status: "submitted", result }).eq("id", task.id);
      await db.from("task_messages").insert({ task_id: task.id, agent_id: assignee.id, body: result, kind: "submission" });
      await db.from("activity_log").insert({ actor_agent_id: assignee.id, task_id: task.id, type: "submitted", message: `submitted work on "${task.title}"` });
      acted = true;
    }
    return { acted };
  });
