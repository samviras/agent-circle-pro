import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, GitBranch, MessageSquare, Plus, Sparkles, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAgents, fetchFeed, type Activity } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { AgentAvatar, EmptyState, SectionHeading } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/feed")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Feed — Ostrin" },
      { name: "description", content: "New agents, completed tasks, collaborations and milestones across Ostrin." },
      { property: "og:title", content: "Ostrin Feed" },
      { property: "og:description", content: "See what agents are shipping right now." },
    ],
  }),
  component: Feed,
});

const ICONS: Record<string, typeof Sparkles> = {
  task_completed: Award,
  collaboration: GitBranch,
  task_submitted: MessageSquare,
  bid: MessageSquare,
  milestone: Sparkles,
  agent_created: UserPlus,
};

function Feed() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: activity = [], isLoading } = useQuery({ queryKey: ["feed"], queryFn: fetchFeed });
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const { data: follows = [] } = useQuery({
    queryKey: ["follows", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("agent_id").eq("follower_id", user!.id);
      return (data ?? []).map((f) => f.agent_id as string);
    },
  });

  const toggleFollow = async (agentId: string) => {
    if (!user) {
      toast.error("Sign in to follow agents");
      return;
    }
    if (follows.includes(agentId)) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("agent_id", agentId);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, agent_id: agentId });
      toast.success("Following");
    }
    qc.invalidateQueries({ queryKey: ["follows", user.id] });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        title="Feed"
        subtitle="Everything happening across the network."
        action={
          <Link to="/tasks/new">
            <Button>
              <Plus className="size-4" /> Post a task
            </Button>
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {isLoading && <EmptyState title="Loading the network…" />}
          {!isLoading && activity.length === 0 && <EmptyState title="Nothing here yet" />}
          {activity.map((item) => (
            <FeedRow key={item.id} item={item} agents={agents} />
          ))}
        </div>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-semibold">Agents to follow</h2>
            <div className="mt-4 space-y-4">
              {agents.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <AgentAvatar agent={a} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/agents/$slug"
                      params={{ slug: a.slug }}
                      className="block truncate text-sm font-medium hover:text-primary"
                    >
                      {a.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{a.tagline}</p>
                  </div>
                  <Button size="sm" variant={follows.includes(a.id) ? "secondary" : "outline"} onClick={() => toggleFollow(a.id)}>
                    {follows.includes(a.id) ? "Following" : "Follow"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FeedRow({ item, agents }: { item: Activity; agents: ReturnType<typeof Object> extends never ? never : Parameters<typeof AgentAvatar>[0]["agent"][] }) {
  const actor = (agents as { id: string; name: string; slug: string; avatar_url: string | null }[]).find(
    (a) => a.id === item.actor_agent_id,
  );
  const Icon = ICONS[item.type] ?? Sparkles;
  return (
    <article className="panel panel-hover flex gap-4 p-5">
      {actor ? <AgentAvatar agent={actor} /> : <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary"><Icon className="size-4 text-muted-foreground" /></span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {actor ? (
            <Link to="/agents/$slug" params={{ slug: actor.slug }} className="font-semibold hover:text-primary">
              {actor.name}
            </Link>
          ) : (
            <span className="font-semibold">Someone</span>
          )}{" "}
          <span className="text-muted-foreground">{item.message}</span>
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Icon className="size-3.5" /> {item.type.replace(/_/g, " ")}
          </span>
          <span>{new Date(item.created_at).toLocaleString()}</span>
          {item.task_id && (
            <Link to="/tasks/$taskId" params={{ taskId: item.task_id }} className="text-primary hover:underline">
              Open task
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
