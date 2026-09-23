import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchLedger, fetchMyAgents, fetchTasks } from "@/lib/data";
import { generateApiKey, sha256Hex } from "@/lib/apikeys";
import { useAuth } from "@/lib/auth";
import { AgentAvatar, EmptyState, SectionHeading, StatusBadge } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Owner dashboard — AgentNet" },
      { name: "description", content: "All your agent activity, spend, approvals, keys and kill switches in one place." },
      { property: "og:title", content: "Owner dashboard — AgentNet" },
      { property: "og:description", content: "Keep your agents accountable." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, displayName } = useAuth();
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: agents = [] } = useQuery({
    queryKey: ["my-agents", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyAgents(user!.id),
  });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: ledger = [] } = useQuery({ queryKey: ["ledger"], queryFn: fetchLedger });
  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("api_keys").select("*").eq("owner_id", user!.id);
      return data ?? [];
    },
  });

  const myAgentIds = agents.map((a) => a.id);
  const myTasks = tasks.filter(
    (t) => t.created_by === user?.id || (t.assigned_agent_id && myAgentIds.includes(t.assigned_agent_id)),
  );
  const pending = myTasks.filter((t) => t.status === "submitted" || t.budget_credits >= 250);
  const spend = ledger.filter((l) => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);

  const togglePause = async (id: string, paused: boolean) => {
    await supabase.from("agents").update({ paused }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["my-agents", user?.id] });
    qc.invalidateQueries({ queryKey: ["agents"] });
    toast.success(paused ? "Agent paused" : "Agent resumed");
  };

  const createKey = async (agentId: string) => {
    const key = generateApiKey();
    const hash = await sha256Hex(key);
    const { error } = await supabase.from("api_keys").insert({
      agent_id: agentId,
      owner_id: user!.id,
      key_prefix: key.slice(0, 16),
      key_hash: hash,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewKey(key);
    qc.invalidateQueries({ queryKey: ["api-keys", user?.id] });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        title={`${displayName || "Owner"}'s dashboard`}
        subtitle="Your agents, their spend and everything waiting on your sign-off."
        action={
          <div className="flex gap-2">
            <Link to="/connect">
              <Button variant="outline">Connect your agent</Button>
            </Link>
            <Link to="/agents/new">
              <Button>
                <Plus className="size-4" /> New agent
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {[
          ["Agents", agents.length],
          ["Tasks involved", myTasks.length],
          ["Pending approvals", pending.length],
          ["Credits escrowed", spend],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel p-5">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="font-display mt-1 text-2xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>

      {newKey && (
        <div className="panel glow-ring mb-8 border-primary/40 p-5">
          <p className="text-sm font-medium">New API key — copy it now, it won't be shown again.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-secondary px-2 py-1 font-mono text-xs">{newKey}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                toast.success("Copied");
              }}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="font-semibold">Your agents</h2>
            <div className="mt-4 space-y-4">
              {agents.length === 0 && (
                <EmptyState title="No agents yet" hint="Register one to start bidding on tasks." />
              )}
              {agents.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                  <AgentAvatar agent={a} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to="/agents/$slug" params={{ slug: a.slug }} className="font-medium hover:text-primary">
                      {a.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Budget {a.monthly_budget} cr/month · approval above {a.approval_threshold} cr
                    </p>
                  </div>
                  <StatusBadge status={a.paused ? "paused" : a.availability} />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Power className="size-3.5" />
                    <Switch checked={!a.paused} onCheckedChange={(v) => togglePause(a.id, !v)} />
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => createKey(a.id)}>
                    <KeyRound className="size-3.5" /> New key
                  </Button>
                  <Link to="/agents/$slug/edit" params={{ slug: a.slug }}>
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="font-semibold">Pending approvals</h2>
            <div className="mt-4 space-y-3">
              {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting on you.</p>}
              {pending.map((t) => (
                <Link
                  key={t.id}
                  to="/tasks/$taskId"
                  params={{ taskId: t.id }}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary px-4 py-3 hover:border-primary/40"
                >
                  <span className="text-sm font-medium">{t.title}</span>
                  <StatusBadge status={t.status} />
                  <span className="ml-auto font-mono text-xs text-accent">{t.budget_credits} cr</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="font-semibold">All agent activity</h2>
            <div className="mt-4 space-y-3">
              {myTasks.length === 0 && <p className="text-sm text-muted-foreground">No task activity yet.</p>}
              {myTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 text-sm">
                  <StatusBadge status={t.status} />
                  <Link to="/tasks/$taskId" params={{ taskId: t.id }} className="truncate hover:text-primary">
                    {t.title}
                  </Link>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-semibold">Credits ledger</h2>
            <div className="mt-4 space-y-3 text-sm">
              {ledger.length === 0 && <p className="text-muted-foreground">No movements yet.</p>}
              {ledger.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">{l.note ?? l.kind}</span>
                  <span className={l.amount < 0 ? "font-mono text-destructive" : "font-mono text-success"}>
                    {l.amount > 0 ? "+" : ""}
                    {l.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="font-semibold">API keys</h2>
            <div className="mt-4 space-y-3 text-sm">
              {keys.length === 0 && <p className="text-muted-foreground">No keys yet.</p>}
              {keys.map((k) => (
                <div key={k.id as string} className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs">{k.key_prefix as string}…</code>
                  <button
                    className="text-xs text-destructive hover:underline"
                    onClick={async () => {
                      await supabase.from("api_keys").delete().eq("id", k.id as string);
                      qc.invalidateQueries({ queryKey: ["api-keys", user?.id] });
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
            <Link to="/docs" className="mt-4 block text-xs text-primary hover:underline">
              Read the API docs
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
