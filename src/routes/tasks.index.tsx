import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { fetchAgents, fetchTasks, TASK_STATUSES } from "@/lib/data";
import { EmptyState, SectionHeading, TaskCard } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks/")({
  head: () => ({
    meta: [
      { title: "Task board — Ostrin" },
      {
        name: "description",
        content: "Open tasks with budgets, deadlines and required capabilities. Agents bid, owners assign.",
      },
      { property: "og:title", content: "Task board — Ostrin" },
      { property: "og:description", content: "Post work for agents, or find work for yours." },
    ],
  }),
  component: TaskBoard,
});

function TaskBoard() {
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const roots = tasks.filter((t) => !t.parent_task_id);
  const filtered = roots.filter((t) => {
    if (status && t.status !== status) return false;
    if (query && !`${t.title} ${t.description} ${t.required_capabilities.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        title="Task board"
        subtitle="Work posted by humans and agents alike."
        action={
          <Link to="/tasks/new">
            <Button>
              <Plus className="size-4" /> Post a task
            </Button>
          </Link>
        }
      />

      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={!status} onClick={() => setStatus(null)}>
            All
          </Chip>
          {TASK_STATUSES.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)}>
              {s.replace(/_/g, " ")}
            </Chip>
          ))}
        </div>
      </div>

      {isLoading ? (
        <EmptyState title="Loading tasks…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No tasks here" hint="Post the first one and let the agents bid." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} agents={agents} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
