import { Link } from "@tanstack/react-router";
import { BadgeCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, Task, TaskStatus } from "@/lib/data";
import { capabilityList } from "@/lib/data";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-info/15 text-info border-info/30",
  assigned: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-warning/15 text-warning border-warning/30",
  submitted: "bg-accent/15 text-accent border-accent/30",
  approved: "bg-success/15 text-success border-success/30",
  completed: "bg-success/20 text-success border-success/40",
  disputed: "bg-destructive/15 text-destructive border-destructive/30",
  available: "bg-success/15 text-success border-success/30",
  busy: "bg-warning/15 text-warning border-warning/30",
  offline: "bg-muted text-muted-foreground border-border",
  paused: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLE[status] ?? "bg-secondary text-secondary-foreground border-border",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
      {children}
    </span>
  );
}

export function AgentAvatar({
  agent,
  size = "md",
}: {
  agent: Pick<Agent, "name" | "avatar_url">;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "size-16 text-xl" : size === "sm" ? "size-8 text-xs" : "size-11 text-sm";
  const initials = agent.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 font-display font-semibold text-primary",
        dims,
      )}
    >
      {agent.avatar_url ? (
        <img src={agent.avatar_url} alt={agent.name} className="size-full rounded-xl object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Star className="size-3.5 fill-accent text-accent" />
      <span className="font-medium text-foreground">{Number(value).toFixed(1)}</span>
      {count != null && <span>({count})</span>}
    </span>
  );
}

export function AgentCard({ agent }: { agent: Agent }) {
  const caps = capabilityList(agent);
  return (
    <Link
      to="/agents/$slug"
      params={{ slug: agent.slug }}
      className="panel panel-hover flex flex-col gap-4 p-5"
    >
      <div className="flex items-start gap-3">
        <AgentAvatar agent={agent} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-semibold">{agent.name}</h3>
            {agent.verified && <BadgeCheck className="size-4 shrink-0 text-primary" />}
          </div>
          <p className="truncate text-sm text-muted-foreground">{agent.tagline}</p>
        </div>
        <StatusBadge status={agent.paused ? "paused" : agent.availability} />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{agent.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {caps.slice(0, 4).map((c) => (
          <Tag key={c}>{c}</Tag>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-sm">
        <Rating value={agent.reputation} count={agent.completed_tasks} />
        <span className="font-mono text-xs text-muted-foreground">
          {agent.pricing_model === "free" ? "Free" : `${agent.price_credits} cr / task`}
        </span>
      </div>
    </Link>
  );
}

export function TaskCard({ task, agents }: { task: Task; agents: Agent[] }) {
  const assignee = agents.find((a) => a.id === task.assigned_agent_id);
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className="panel panel-hover flex flex-col gap-3 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {task.required_capabilities.map((c) => (
          <Tag key={c}>{c}</Tag>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="font-mono text-accent">{task.budget_credits} credits</span>
        <span>
          {task.deadline ? `Due ${new Date(task.deadline).toLocaleDateString()}` : "No deadline"}
        </span>
        <span>{assignee ? `Assigned to ${assignee.name}` : task.visibility === "private" ? "Private" : "Unassigned"}</span>
      </div>
    </Link>
  );
}

export function statusOrder(status: TaskStatus) {
  return ["open", "assigned", "in_progress", "submitted", "approved", "completed", "disputed"].indexOf(
    status,
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="panel p-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
