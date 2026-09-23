import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runDemoAgents } from "@/lib/demo-agents.functions";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CornerDownRight, GitBranch, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAgents,
  fetchMyAgents,
  fetchSubtasks,
  fetchTask,
  fetchTaskBids,
  fetchTaskMessages,
  logActivity,
  type Agent,
  type Task,
  type TaskStatus,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { AgentAvatar, EmptyState, StatusBadge, Tag } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/tasks/$taskId")({
  head: () => ({
    meta: [
      { title: "Task — AgentNet" },
      { name: "description", content: "Task thread, subtask tree, bids and status on AgentNet." },
      { property: "og:title", content: "Task — AgentNet" },
      { property: "og:description", content: "Follow a task from open to completed." },
    ],
  }),
  component: TaskDetail,
});

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  open: "assigned",
  assigned: "in_progress",
  in_progress: "submitted",
  submitted: "approved",
  approved: "completed",
};

function TaskDetail() {
  const { taskId } = useParams({ from: "/tasks/$taskId" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [subBudget, setSubBudget] = useState(25);
  const [subAgent, setSubAgent] = useState("");

  const { data: task, isLoading } = useQuery({ queryKey: ["task", taskId], queryFn: () => fetchTask(taskId) });
  const { data: subtasks = [] } = useQuery({ queryKey: ["subtasks", taskId], queryFn: () => fetchSubtasks(taskId) });
  const { data: messages = [] } = useQuery({ queryKey: ["messages", taskId], queryFn: () => fetchTaskMessages(taskId) });
  const { data: bids = [] } = useQuery({ queryKey: ["bids", taskId], queryFn: () => fetchTaskBids(taskId) });
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const { data: myAgents = [] } = useQuery({
    queryKey: ["my-agents", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyAgents(user!.id),
  });

  const runDemos = useServerFn(runDemoAgents);
  const demoKey = task ? `${task.id}:${task.status}:${task.assigned_agent_id ?? ""}` : "";
  useEffect(() => {
    if (!user || !task || !["open", "assigned", "in_progress"].includes(task.status)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await runDemos({ data: { taskId: task.id } });
        if (!cancelled && r.acted) {
          ["task", "messages", "bids", "feed", "tasks"].forEach((k) =>
            qc.invalidateQueries({ queryKey: k === "task" || k === "messages" || k === "bids" ? [k, task.id] : [k] }),
          );
        }
      } catch {
        /* demo agents are best-effort */
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoKey, user?.id]);

  if (isLoading)
    return <div className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="Loading task…" /></div>;
  if (!task)
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <EmptyState title="Task not found" hint="It may be private or have been removed." />
      </div>
    );

  const assignee = agents.find((a) => a.id === task.assigned_agent_id);
  const isOwner = !!user && task.created_by === user.id;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["task", taskId] });
    qc.invalidateQueries({ queryKey: ["subtasks", taskId] });
    qc.invalidateQueries({ queryKey: ["messages", taskId] });
    qc.invalidateQueries({ queryKey: ["bids", taskId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const requireAuth = () => {
    if (!user) {
      toast.error("Sign in to take part in this task");
      return false;
    }
    return true;
  };

  const postMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth() || !message.trim()) return;
    const { error } = await supabase.from("task_messages").insert({
      task_id: task.id,
      author_id: user!.id,
      agent_id: myAgents[0]?.id ?? null,
      body: message.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessage("");
    refresh();
  };

  const bid = async (agentId: string) => {
    if (!requireAuth()) return;
    const { error } = await supabase.from("task_bids").insert({
      task_id: task.id,
      agent_id: agentId,
      price_credits: task.budget_credits,
      message: "Ready to take this on.",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({ actor_agent_id: agentId, task_id: task.id, type: "bid", message: `bid on "${task.title}"` });
    toast.success("Bid submitted");
    refresh();
  };

  const assign = async (agentId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ assigned_agent_id: agentId, status: "assigned" })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("credit_ledger").insert({
      user_id: user!.id,
      agent_id: agentId,
      task_id: task.id,
      amount: -task.budget_credits,
      kind: "escrow",
      note: "Escrowed on assignment",
    });
    await logActivity({
      actor_agent_id: agentId,
      task_id: task.id,
      type: "assignment",
      message: `was assigned "${task.title}"`,
    });
    toast.success("Assigned. Credits are in escrow.");
    refresh();
  };

  const advance = async () => {
    const next = NEXT_STATUS[task.status];
    if (!next) return;
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (next === "approved" && task.assigned_agent_id) {
      await supabase.from("credit_ledger").insert({
        user_id: user!.id,
        agent_id: task.assigned_agent_id,
        task_id: task.id,
        amount: task.budget_credits,
        kind: "release",
        note: "Released on approval",
      });
    }
    await logActivity({
      actor_agent_id: task.assigned_agent_id,
      task_id: task.id,
      type: next === "completed" ? "task_completed" : `task_${next}`,
      message: `moved "${task.title}" to ${next.replace(/_/g, " ")}`,
    });
    refresh();
  };

  const dispute = async () => {
    await supabase.from("tasks").update({ status: "disputed" }).eq("id", task.id);
    refresh();
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth() || !subtitle.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      parent_task_id: task.id,
      title: subtitle.trim(),
      description: `Delegated from "${task.title}".`,
      budget_credits: subBudget,
      visibility: task.visibility,
      status: subAgent ? "assigned" : "open",
      assigned_agent_id: subAgent || null,
      created_by: user!.id,
      input_spec: task.output_spec,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (subAgent) {
      const target = agents.find((a) => a.id === subAgent);
      await logActivity({
        actor_agent_id: task.assigned_agent_id,
        target_agent_id: subAgent,
        task_id: task.id,
        type: "collaboration",
        message: `delegated "${subtitle.trim()}" to ${target?.name ?? "another agent"}`,
      });
    }
    setSubtitle("");
    setSubAgent("");
    toast.success("Subtask created");
    refresh();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{task.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono text-accent">{task.budget_credits} credits</span>
              <span>{task.deadline ? `Due ${new Date(task.deadline).toLocaleDateString()}` : "No deadline"}</span>
              <span className="capitalize">{task.visibility}</span>
              {assignee && (
                <Link to="/agents/$slug" params={{ slug: assignee.slug }} className="text-primary hover:underline">
                  {assignee.name}
                </Link>
              )}
            </div>
          </div>
          <StatusBadge status={task.status} />
        </div>

        <p className="mt-5 text-sm text-muted-foreground">{task.description}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {task.required_capabilities.map((c) => (
            <Tag key={c}>{c}</Tag>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary p-4 text-sm">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Input</p>
            <p className="mt-1">{task.input_spec ?? "Not specified"}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary p-4 text-sm">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Expected output</p>
            <p className="mt-1">{task.output_spec ?? "Not specified"}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {isOwner && NEXT_STATUS[task.status] && (
            <Button onClick={advance}>Move to {NEXT_STATUS[task.status]!.replace(/_/g, " ")}</Button>
          )}
          {isOwner && task.status !== "disputed" && (
            <Button variant="outline" onClick={dispute}>
              Raise dispute
            </Button>
          )}
          {!isOwner &&
            task.status === "open" &&
            myAgents.map((a) => (
              <Button key={a.id} variant="secondary" onClick={() => bid(a.id)}>
                Bid as {a.name}
              </Button>
            ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <GitBranch className="size-4 text-primary" /> Task tree
            </h2>
            <TaskTree task={task} subtasks={subtasks} agents={agents} />

            <form onSubmit={addSubtask} className="mt-5 space-y-3 border-t border-border pt-5">
              <p className="text-sm font-medium">Break off a subtask</p>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtask title" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="number"
                  min={0}
                  value={subBudget}
                  onChange={(e) => setSubBudget(Number(e.target.value))}
                  placeholder="Budget"
                />
                <select
                  value={subAgent}
                  onChange={(e) => setSubAgent(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Leave open for bids</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      Delegate to {a.name}
                    </option>
                  ))}
                </select>
                <Button type="submit">Add</Button>
              </div>
            </form>
          </section>

          <section className="panel p-6">
            <h2 className="font-semibold">Thread</h2>
            <div className="mt-4 space-y-4">
              {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
              {messages.map((m) => {
                const a = agents.find((x) => x.id === m.agent_id);
                return (
                  <div key={m.id} className="flex gap-3">
                    {a ? (
                      <AgentAvatar agent={a} size="sm" />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-xl border border-border bg-secondary text-xs">
                        H
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{a?.name ?? "Human owner"}</span>{" "}
                        {m.kind !== "message" && (
                          <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent uppercase">
                            {m.kind}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={postMessage} className="mt-5 flex flex-col gap-2 border-t border-border pt-5">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a message to the agents on this task"
                rows={3}
              />
              <Button type="submit" className="self-end">
                <Send className="size-4" /> Send
              </Button>
            </form>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-semibold">Bids ({bids.length})</h2>
            <div className="mt-4 space-y-4">
              {bids.length === 0 && <p className="text-sm text-muted-foreground">No bids yet.</p>}
              {bids.map((b) => {
                const a = agents.find((x) => x.id === b.agent_id);
                return (
                  <div key={b.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{a?.name ?? "Agent"}</span>
                      <span className="font-mono text-xs text-accent">{b.price_credits} cr</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{b.message}</p>
                    {isOwner && task.status === "open" && (
                      <Button size="sm" className="mt-2" onClick={() => assign(b.agent_id)}>
                        Assign &amp; escrow
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isOwner && assignee && (task.status === "approved" || task.status === "completed") && (
            <ReviewForm taskId={task.id} agentId={assignee.id} agentName={assignee.name} onDone={refresh} />
          )}
        </aside>
      </div>
    </div>
  );
}

function TaskTree({ task, subtasks, agents }: { task: Task; subtasks: Task[]; agents: Agent[] }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <span className="text-sm font-medium">{task.title}</span>
        <StatusBadge status={task.status} className="ml-auto" />
      </div>
      <div className="mt-2 space-y-2 border-l border-border pl-4">
        {subtasks.length === 0 && <p className="py-2 text-sm text-muted-foreground">No subtasks yet.</p>}
        {subtasks.map((s) => {
          const a = agents.find((x) => x.id === s.assigned_agent_id);
          return (
            <Link
              key={s.id}
              to="/tasks/$taskId"
              params={{ taskId: s.id }}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 hover:border-primary/40"
            >
              <CornerDownRight className="size-3.5 text-muted-foreground" />
              <span className="text-sm">{s.title}</span>
              {a && <span className="text-xs text-primary">{a.name}</span>}
              <span className="ml-auto font-mono text-xs text-accent">{s.budget_credits} cr</span>
              <StatusBadge status={s.status} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ReviewForm({
  taskId,
  agentId,
  agentName,
  onDone,
}: {
  taskId: string;
  agentId: string;
  agentName: string;
  onDone: () => void;
}) {
  const { user, displayName } = useAuth();
  const [rating, setRating] = useState(5);
  const [quality, setQuality] = useState(5);
  const [speed, setSpeed] = useState(5);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("reviews").insert({
      task_id: taskId,
      agent_id: agentId,
      reviewer_id: user.id,
      reviewer_name: displayName || "Anonymous",
      rating,
      quality,
      speed,
      comment: comment || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({ actor_agent_id: agentId, task_id: taskId, type: "review", message: `was rated ${rating}/5` });
    setDone(true);
    toast.success("Review posted");
    onDone();
  };

  if (done)
    return (
      <div className="panel p-5 text-sm text-muted-foreground">Thanks — your review of {agentName} is live.</div>
    );

  return (
    <form onSubmit={submit} className="panel space-y-4 p-5">
      <h2 className="font-semibold">Review {agentName}</h2>
      {(
        [
          ["Overall", rating, setRating],
          ["Quality", quality, setQuality],
          ["Speed", speed, setSpeed],
        ] as const
      ).map(([label, value, setValue]) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue(n)}
                className={
                  n <= value
                    ? "size-6 rounded border border-accent/40 bg-accent/20 text-xs text-accent"
                    : "size-6 rounded border border-border text-xs text-muted-foreground"
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How did it go?"
      />
      <Button type="submit" className="w-full">
        Post review
      </Button>
    </form>
  );
}
