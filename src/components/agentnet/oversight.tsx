import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Gauge,
  GitMerge,
  HelpCircle,
  History,
  RotateCcw,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  fetchAgentTrackRecord,
  fetchProfileNames,
  fetchTaskActions,
  fetchTaskConflicts,
  fetchTaskReplay,
  type Agent,
  type Task,
} from "@/lib/data";
import {
  ACTION_STATUS_LABEL,
  CONFIDENCE_LABEL,
  canReconcile,
  knowsItsLimits,
  type AgentAction,
  type Confidence,
  type TaskConflict,
} from "@/lib/oversight";
import { actOnResult, resetDemoTask, resolveConflict } from "@/lib/oversight.functions";
import { AgentAvatar } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const CONF_STYLE: Record<string, string> = {
  high: "border-success/40 bg-success/15 text-success",
  medium: "border-warning/40 bg-warning/15 text-warning",
  low: "border-destructive/40 bg-destructive/15 text-destructive",
};

export function ConfidenceBadge({ level }: { level: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        CONF_STYLE[level] ?? CONF_STYLE.medium,
      )}
    >
      <Gauge className="size-3" /> {CONFIDENCE_LABEL[level as Confidence] ?? level} confidence
    </span>
  );
}

function when(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** The one "Hand to a human" button used by both features. */
export function HandToHumanButton({ onClick, recommended, busy }: { onClick: () => void; recommended?: boolean; busy?: boolean }) {
  return (
    <Button size="sm" variant={recommended ? "default" : "outline"} onClick={onClick} disabled={busy}>
      <UserRound className="size-4" /> Hand to a human
      {recommended && <span className="ml-1 text-[10px] uppercase opacity-80">Recommended</span>}
    </Button>
  );
}

function useTaskOversight(taskId: string) {
  const actions = useQuery({ queryKey: ["actions", taskId], queryFn: () => fetchTaskActions(taskId) });
  const conflicts = useQuery({ queryKey: ["conflicts", taskId], queryFn: () => fetchTaskConflicts(taskId) });
  return { actions: actions.data ?? [], conflicts: conflicts.data ?? [] };
}

function useRefresh(taskId: string) {
  const qc = useQueryClient();
  return () => {
    for (const key of [["actions", taskId], ["conflicts", taskId], ["replay", taskId], ["open-conflicts"], ["feed"]])
      qc.invalidateQueries({ queryKey: key });
  };
}

export function OversightPanel({ task, agents }: { task: Task; agents: Agent[] }) {
  const { user } = useAuth();
  const { actions, conflicts } = useTaskOversight(task.id);
  const refresh = useRefresh(task.id);
  const [busy, setBusy] = useState(false);
  const act = useServerFn(actOnResult);
  const resolve = useServerFn(resolveConflict);
  const reset = useServerFn(resetDemoTask);

  if (actions.length === 0) return null;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    if (!user) {
      toast.error("Sign in to act as the care manager");
      return;
    }
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const byId = new Map(actions.map((a) => [a.id, a]));
  const agentOf = (id: string) => agents.find((a) => a.id === id);
  const active = conflicts.filter((c) => c.status !== "resolved");
  const resolved = conflicts.filter((c) => c.status === "resolved");
  const inConflict = new Set(active.flatMap((c) => [c.action_a, c.action_b]));

  return (
    <section className="panel mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-primary" /> Agent results
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each agent says how sure it is. Ostrin holds unsure results and pauses actions that clash.
            {task.demo && " Demo data: you act as the care manager."}
          </p>
        </div>
        {task.demo && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => reset({ data: { taskId: task.id } }), "Demo restarted")}>
            <RotateCcw className="size-4" /> Restart demo
          </Button>
        )}
      </div>

      {active.map((c) => {
        const a = byId.get(c.action_a);
        const b = byId.get(c.action_b);
        if (!a || !b) return null;
        return (
          <ConflictBanner
            key={c.id}
            conflict={c}
            a={a}
            b={b}
            agentA={agentOf(a.agent_id)}
            agentB={agentOf(b.agent_id)}
            busy={busy}
            onResolve={(op, label) => run(() => resolve({ data: { conflictId: c.id, op } }), label)}
          />
        );
      })}

      {resolved.map((c) => (
        <p key={c.id} className="mt-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> Conflict resolved:{" "}
          {c.resolution === "keep_a"
            ? `kept ${agentOf(byId.get(c.action_a)?.agent_id ?? "")?.name ?? "A"}'s plan`
            : c.resolution === "keep_b"
              ? `kept ${agentOf(byId.get(c.action_b)?.agent_id ?? "")?.name ?? "B"}'s plan`
              : c.resolution === "reconcile"
                ? "combined plan approved"
                : "handed to a human"}
        </p>
      ))}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {actions.map((a) => (
          <ResultCard
            key={a.id}
            action={a}
            agent={agentOf(a.agent_id)}
            inConflict={inConflict.has(a.id)}
            busy={busy}
            onAct={(op, reviewed, label) => run(() => act({ data: { actionId: a.id, op, reviewed } }), label)}
          />
        ))}
      </div>
    </section>
  );
}

function ResultCard({
  action,
  agent,
  inConflict,
  busy,
  onAct,
}: {
  action: AgentAction;
  agent?: Agent;
  inConflict: boolean;
  busy: boolean;
  onAct: (op: "approve" | "ask_agent" | "hand_to_human", reviewed: boolean, label: string) => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [checked, setChecked] = useState(false);
  const held = action.status === "held" && !inConflict;
  const recommendHuman = action.recommended_next_step !== "second_agent";

  return (
    <div className={cn("rounded-lg border bg-secondary/60 p-4", held ? "border-warning/40" : inConflict ? "border-destructive/40" : "border-border")}>
      <div className="flex items-start gap-3">
        {agent && <AgentAvatar agent={agent} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {agent ? (
              <Link to="/agents/$slug" params={{ slug: agent.slug }} className="text-sm font-medium hover:text-primary">
                {agent.name}
              </Link>
            ) : (
              <span className="text-sm font-medium">Agent</span>
            )}
            <ConfidenceBadge level={action.confidence} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{action.confidence_reason}</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
          {ACTION_STATUS_LABEL[action.status] ?? action.status}
        </span>
      </div>

      {action.abstained ? (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            <HelpCircle className="size-4" /> I'm not sure
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{action.abstain_reason}</p>
          <p className="mt-2 text-xs text-foreground">
            Recommended next step: {recommendHuman ? "send to a human" : "ask another agent for a second look"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Wanted to: {action.summary}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm">{action.summary}</p>
      )}
      {action.scheduled_for && <p className="mt-1 text-xs text-muted-foreground">{when(action.scheduled_for)}</p>}

      {held && (
        <div className="mt-4 space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Held: low confidence results can't be approved with one tap.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setReviewing(!reviewing)}>
              <Eye className="size-4" /> Review
            </Button>
            <Button
              size="sm"
              variant={recommendHuman ? "outline" : "default"}
              disabled={busy}
              onClick={() => onAct("ask_agent", false, "Asked another agent for a second look")}
            >
              <Users className="size-4" /> Ask another agent
            </Button>
            <HandToHumanButton recommended={recommendHuman} busy={busy} onClick={() => onAct("hand_to_human", false, "Handed to a human")} />
          </div>
          {reviewing && (
            <div className="rounded-md border border-border bg-background p-3 text-sm">
              <p className="font-medium">Before you approve</p>
              <p className="mt-1 text-muted-foreground">
                The agent's own reason for low confidence: {action.confidence_reason}.
                {action.abstained && ` It also said: "${action.abstain_reason}"`}
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
                I checked this myself and want it to go ahead
              </label>
              <Button
                size="sm"
                className="mt-3"
                disabled={!checked || busy}
                onClick={() => onAct("approve", true, "Approved after review")}
              >
                Approve after review
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConflictBanner({
  conflict,
  a,
  b,
  agentA,
  agentB,
  busy,
  onResolve,
}: {
  conflict: TaskConflict;
  a: AgentAction;
  b: AgentAction;
  agentA?: Agent;
  agentB?: Agent;
  busy: boolean;
  onResolve: (op: "keep_a" | "keep_b" | "reconcile" | "approve_plan" | "reject_plan" | "hand_to_human", label: string) => void;
}) {
  const reconcilable = canReconcile(a, b);
  const nameA = agentA?.name ?? "Agent A";
  const nameB = agentB?.name ?? "Agent B";
  return (
    <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-5">
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="size-4" /> Conflict found
        <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-[11px] font-medium capitalize">{conflict.kind}</span>
      </p>
      <p className="mt-1 text-sm">{conflict.reason}</p>
      <p className="mt-1 text-xs text-muted-foreground">Both actions are paused until you decide. Everything else keeps going.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { label: "A", action: a, agent: agentA },
          { label: "B", action: b, agent: agentB },
        ].map(({ label, action, agent }) => (
          <div key={label} className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Plan {label}</span>
              <ConfidenceBadge level={action.confidence} />
            </div>
            <p className="mt-2 text-sm font-medium">{action.summary}</p>
            {action.scheduled_for && <p className="mt-1 text-xs text-muted-foreground">{when(action.scheduled_for)}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              Proposed by <span className="text-foreground">{agent?.name ?? "an agent"}</span> · {action.confidence_reason}
            </p>
          </div>
        ))}
      </div>

      {conflict.status === "reconciling" && conflict.combined_plan ? (
        <div className="mt-4 rounded-lg border border-primary/40 bg-primary/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <GitMerge className="size-4" /> Combined plan from {nameA} and {nameB}
          </p>
          <p className="mt-2 text-sm">{conflict.combined_plan}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => onResolve("approve_plan", "Combined plan approved")}>
              Approve combined plan
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onResolve("reject_plan", "Combined plan turned down")}>
              Turn it down
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onResolve("keep_a", `Kept ${nameA}'s plan`)}>
            Keep A
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onResolve("keep_b", `Kept ${nameB}'s plan`)}>
            Keep B
          </Button>
          {reconcilable && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onResolve("reconcile", "Asked both agents to reconcile")}>
              <GitMerge className="size-4" /> Ask both agents to reconcile
            </Button>
          )}
          <HandToHumanButton recommended={!reconcilable} busy={busy} onClick={() => onResolve("hand_to_human", "Handed to a human")} />
        </div>
      )}
      {!reconcilable && (
        <p className="mt-2 text-xs text-muted-foreground">
          One side has Low confidence, so reconciling is skipped and this should go to a human.
        </p>
      )}
    </div>
  );
}

const REPLAY_LABEL: Record<string, string> = {
  confidence: "Confidence",
  abstain: "Abstained",
  held: "Held",
  conflict_detected: "Conflict",
  paused: "Paused",
  resolution: "Resolved",
  handoff: "Hand to a human",
  second_look: "Second look",
  reconcile: "Reconcile",
  approved: "Approved",
  reset: "Restart",
};

/** One replay for both features: every step with a timestamp and who did it. */
export function TaskReplay({ taskId, agents }: { taskId: string; agents: Agent[] }) {
  const { data: entries = [] } = useQuery({ queryKey: ["replay", taskId], queryFn: () => fetchTaskReplay(taskId) });
  const userIds = [...new Set(entries.map((e) => e.actor_user_id).filter(Boolean) as string[])];
  const { data: people = {} } = useQuery({
    queryKey: ["profile-names", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: () => fetchProfileNames(userIds),
  });

  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <History className="size-4 text-primary" /> Replay
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <ol className="mt-4 space-y-3 border-l border-border pl-4">
          {entries.map((e) => {
            const agent = agents.find((a) => a.id === e.actor_agent_id);
            const who = agent
              ? agent.name
              : e.actor_user_id
                ? `Care manager${people[e.actor_user_id] ? ` (${people[e.actor_user_id]})` : ""}`
                : "Ostrin";
            return (
              <li key={e.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <time>{new Date(e.created_at).toLocaleString()}</time>
                  <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] uppercase">
                    {REPLAY_LABEL[e.type] ?? e.type.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-0.5">
                  <span className="font-medium">{who}</span> <span className="text-muted-foreground">{e.message}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function KnowsItsLimits({ agentId }: { agentId: string }) {
  const { data: rows = [] } = useQuery({ queryKey: ["track-record", agentId], queryFn: () => fetchAgentTrackRecord(agentId) });
  const s = knowsItsLimits(rows);
  return (
    <div className="panel p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Gauge className="size-4 text-primary" /> Knows its limits
      </h2>
      {s.score === null ? (
        <p className="mt-3 text-sm text-muted-foreground">Not enough history yet.</p>
      ) : (
        <>
          <p className="mt-3 font-display text-3xl font-semibold">{s.score}%</p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>
              Said "I'm not sure" when it should have: <span className="text-foreground">{s.abstainedCorrectly} of {s.shouldAbstain}</span>
            </li>
            <li>
              Confident and right: <span className="text-foreground">{s.confidentAndRight} of {s.confident}</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Abstaining at the right time counts in its favour.</p>
        </>
      )}
    </div>
  );
}
