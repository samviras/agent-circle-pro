import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CONFIDENCE_LABEL,
  canReconcile,
  combinedPlan,
  conflictBetween,
  detectConflicts,
  initialStatus,
  isLow,
  lowerConfidence,
  type AgentAction,
  type Confidence,
  type ConflictKind,
  type TaskConflict,
} from "@/lib/oversight";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/**
 * The caller may act as the care manager when they created the task, or when
 * the task is a public demo task. Visibility is checked with their own session.
 */
async function authorize(context: { supabase: any; userId: string }, taskId: string) {
  const { data: task } = await context.supabase
    .from("tasks")
    .select("id, title, created_by, demo")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) throw new Error("Task not found");
  if (!task.demo && task.created_by !== context.userId) throw new Error("Only the task owner can decide here");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { task: task as { id: string; title: string }, db: supabaseAdmin as Db };
}

async function names(db: Db, ids: string[]) {
  const { data } = await db.from("agents").select("id, name").in("id", ids);
  return new Map((data ?? []).map((a) => [a.id, a.name]));
}

/** One shared replay writer: every step is logged with a timestamp and who did it. */
function replay(db: Db, taskId: string) {
  let t = Date.now();
  return async (entry: { type: string; message: string; agentId?: string | null; userId?: string | null }) => {
    t += 1;
    await db.from("activity_log").insert({
      task_id: taskId,
      type: entry.type,
      message: entry.message,
      actor_agent_id: entry.agentId ?? null,
      actor_user_id: entry.userId ?? null,
      created_at: new Date(t).toISOString(),
    });
  };
}

/** One shared "Hand to a human" used by both features. */
async function handToHuman(db: Db, log: ReturnType<typeof replay>, actions: AgentAction[], userId: string, why: string) {
  await db.from("agent_actions").update({ status: "handed_to_human" }).in("id", actions.map((a) => a.id));
  await log({
    type: "handoff",
    userId,
    message: `handed ${actions.length === 1 ? `"${actions[0].summary}"` : `${actions.length} actions`} to a human (${why}). A care team member will follow up.`,
  });
}

/** Evaluate new actions: log confidence and abstains, hold low ones, detect and pause conflicts. */
async function evaluate(db: Db, taskId: string, fresh: AgentAction[], log: ReturnType<typeof replay>) {
  const { data: all } = await db.from("agent_actions").select("*").eq("task_id", taskId);
  const actions = (all ?? []) as AgentAction[];
  const agentNames = await names(db, [...new Set(actions.map((a) => a.agent_id))]);

  for (const a of fresh) {
    const label = CONFIDENCE_LABEL[a.confidence as Confidence] ?? a.confidence;
    await log({ type: "confidence", agentId: a.agent_id, message: `proposed "${a.summary}" with ${label} confidence: ${a.confidence_reason}` });
    if (a.abstained) {
      await log({
        type: "abstain",
        agentId: a.agent_id,
        message: `abstained: "I'm not sure." Recommended next step: ${a.recommended_next_step === "second_agent" ? "ask another agent" : "hand to a human"}`,
      });
    }
    a.status = initialStatus(a);
    await db.from("agent_actions").update({ status: a.status }).eq("id", a.id);
    if (a.status === "held") await log({ type: "held", message: "Ostrin held this result for the care manager. It can't be approved with one tap." });
  }

  const byId = new Map(actions.map((a) => [a.id, a]));
  fresh.forEach((a) => byId.set(a.id, a));
  const live = [...byId.values()];
  const freshIds = new Set(fresh.map((a) => a.id));
  const clashes = detectConflicts(live).filter((c) => freshIds.has(c.a.id) || freshIds.has(c.b.id));

  for (const c of clashes) {
    await db.from("task_conflicts").insert({ task_id: taskId, action_a: c.a.id, action_b: c.b.id, kind: c.kind, reason: c.reason });
    await db.from("agent_actions").update({ status: "paused" }).in("id", [c.a.id, c.b.id]);
    await log({ type: "conflict_detected", message: `Ostrin found a ${c.kind}: ${c.reason} (${agentNames.get(c.a.agent_id)} vs ${agentNames.get(c.b.agent_id)})` });
    await log({
      type: "paused",
      message: canReconcile(c.a, c.b)
        ? "Ostrin paused both actions until the care manager decides. Other actions keep going."
        : "Ostrin paused both actions. One side has Low confidence, so reconciling is skipped and this goes to a human.",
    });
  }
}

export const actOnResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ actionId: z.string().uuid(), op: z.enum(["approve", "ask_agent", "hand_to_human"]), reviewed: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("agent_actions").select("*").eq("id", data.actionId).maybeSingle();
    if (!row?.task_id) throw new Error("Result not found");
    const action = row as AgentAction;
    const { db, task } = await authorize(context, action.task_id!);
    const log = replay(db, task.id);
    if (!["held", "running", "proposed"].includes(action.status)) throw new Error("This result was already decided");

    if (data.op === "approve") {
      if (isLow(action) && !data.reviewed) throw new Error("Low confidence results need a review before approval");
      await db.from("agent_actions").update({ status: "approved" }).eq("id", action.id);
      await log({
        type: "approved",
        userId: context.userId,
        message: `${isLow(action) ? "reviewed and approved" : "approved"} "${action.summary}"`,
      });
      return { ok: true };
    }

    if (data.op === "hand_to_human") {
      await handToHuman(db, log, [action], context.userId, action.abstained ? "the agent abstained" : "low confidence");
      return { ok: true };
    }

    // Ask another agent for a second look.
    const { data: peers } = await db
      .from("agents")
      .select("id, name, slug")
      .in("slug", ["adherence-agent", "pharmacy-agent", "quickfill-agent"])
      .neq("id", action.agent_id);
    const reviewer = (peers ?? []).sort((a, b) => (a.slug === "adherence-agent" ? -1 : b.slug === "adherence-agent" ? 1 : 0))[0];
    if (!reviewer) throw new Error("No other agent is available");
    await db.from("agent_actions").update({ status: "second_look" }).eq("id", action.id);
    await log({ type: "second_look", userId: context.userId, message: `asked ${reviewer.name} for a second look at "${action.summary}"` });
    const { data: created } = await db
      .from("agent_actions")
      .insert({
        task_id: task.id,
        agent_id: reviewer.id,
        kind: "second_look",
        intent: "info",
        subject: action.subject ? `${action.subject}:review` : null,
        summary: `Second look: keep a pickup slot open and call the pharmacy to confirm stock before promising a date`,
        confidence: "medium",
        confidence_reason: "Supply and due-date data is complete; stock is still unconfirmed",
        status: "proposed",
      })
      .select("*")
      .single();
    if (created) await evaluate(db, task.id, [created as AgentAction], log);
    return { ok: true };
  });

export const resolveConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conflictId: z.string().uuid(),
        op: z.enum(["keep_a", "keep_b", "reconcile", "approve_plan", "reject_plan", "hand_to_human"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("task_conflicts").select("*").eq("id", data.conflictId).maybeSingle();
    if (!row) throw new Error("Conflict not found");
    const conflict = row as TaskConflict;
    const { db, task } = await authorize(context, conflict.task_id);
    if (conflict.status === "resolved") throw new Error("This conflict is already resolved");
    const log = replay(db, task.id);

    const { data: pair } = await db.from("agent_actions").select("*").in("id", [conflict.action_a, conflict.action_b]);
    const a = (pair ?? []).find((x) => x.id === conflict.action_a) as AgentAction | undefined;
    const b = (pair ?? []).find((x) => x.id === conflict.action_b) as AgentAction | undefined;
    if (!a || !b) throw new Error("Actions not found");
    const n = await names(db, [a.agent_id, b.agent_id]);
    const nameA = n.get(a.agent_id) ?? "Agent A";
    const nameB = n.get(b.agent_id) ?? "Agent B";

    const close = (resolution: string) =>
      db
        .from("task_conflicts")
        .update({ status: "resolved", resolution, resolved_by: context.userId, resolved_at: new Date().toISOString() })
        .eq("id", conflict.id);

    if (data.op === "keep_a" || data.op === "keep_b") {
      const [keep, drop, keepName] = data.op === "keep_a" ? [a, b, nameA] : [b, a, nameB];
      await db.from("agent_actions").update({ status: "approved" }).eq("id", keep.id);
      await db.from("agent_actions").update({ status: "rejected" }).eq("id", drop.id);
      await close(data.op);
      await log({ type: "resolution", userId: context.userId, message: `resolved the conflict: kept ${keepName}'s "${keep.summary}" and dropped "${drop.summary}"` });
      return { ok: true };
    }

    if (data.op === "hand_to_human") {
      await handToHuman(db, log, [a, b], context.userId, "agents disagree");
      await close("human");
      await log({ type: "resolution", userId: context.userId, message: "resolved the conflict by handing it to a human" });
      return { ok: true };
    }

    if (data.op === "reconcile") {
      if (!canReconcile(a, b)) throw new Error("One side has Low confidence, so this goes to a human instead");
      const plan = combinedPlan(a, b, conflict.kind as ConflictKind, { a: nameA, b: nameB });
      await db.from("task_conflicts").update({ status: "reconciling", combined_plan: plan }).eq("id", conflict.id);
      await log({ type: "reconcile", userId: context.userId, message: `asked ${nameA} and ${nameB} to reconcile` });
      await log({ type: "reconcile", agentId: a.agent_id, message: `and ${nameB} proposed a combined plan: ${plan}` });
      return { ok: true };
    }

    if (data.op === "reject_plan") {
      await db.from("task_conflicts").update({ status: "open", combined_plan: null }).eq("id", conflict.id);
      await log({ type: "reconcile", userId: context.userId, message: "turned down the combined plan; the conflict is open again" });
      return { ok: true };
    }

    // approve_plan
    if (conflict.status !== "reconciling" || !conflict.combined_plan) throw new Error("There is no combined plan to approve");
    await db.from("agent_actions").update({ status: "merged" }).in("id", [a.id, b.id]);
    await db.from("agent_actions").insert({
      task_id: task.id,
      agent_id: a.agent_id,
      kind: "combined_plan",
      intent: "info",
      summary: conflict.combined_plan,
      confidence: lowerConfidence(a.confidence, b.confidence),
      confidence_reason: `Combined from ${nameA} and ${nameB}`,
      status: "approved",
    });
    await close("reconcile");
    await log({ type: "resolution", userId: context.userId, message: `approved the combined plan from ${nameA} and ${nameB}` });
    return { ok: true };
  });

/** Puts a demo task back to its starting point and re-runs confidence and conflict checks. */
export const resetDemoTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, task } = await authorize(context, data.taskId);
    const { data: t } = await db.from("tasks").select("demo").eq("id", task.id).single();
    if (!t?.demo) throw new Error("Only demo tasks can be reset");
    await db.from("task_conflicts").delete().eq("task_id", task.id);
    await db.from("agent_actions").delete().eq("task_id", task.id).eq("seeded", false);
    await db.from("activity_log").delete().eq("task_id", task.id);
    await db.from("agent_actions").update({ status: "proposed" }).eq("task_id", task.id);
    const { data: seeded } = await db.from("agent_actions").select("*").eq("task_id", task.id).order("created_at");
    const log = replay(db, task.id);
    await log({ type: "reset", userId: context.userId, message: "restarted the demo" });
    await evaluate(db, task.id, (seeded ?? []) as AgentAction[], log);
    return { ok: true };
  });

// Re-exported so the UI and server agree on the same rule.
export { conflictBetween };
