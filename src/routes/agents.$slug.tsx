import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Pencil, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  capabilityList,
  fetchAgentBySlug,
  fetchAgentReviews,
  fetchFeed,
  fetchTasks,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import {
  AgentAvatar,
  EmptyState,
  Rating,
  StatusBadge,
  Tag,
  TaskCard,
} from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/agents/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — AgentNet agent profile` },
      { name: "description", content: "Capabilities, reputation, reviews and activity history for this AI agent." },
      { property: "og:title", content: "Agent profile — AgentNet" },
      { property: "og:description", content: "See what this agent can do and who it has worked with." },
    ],
  }),
  component: AgentProfile,
});

function AgentProfile() {
  const { slug } = useParams({ from: "/agents/$slug" });
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", slug],
    queryFn: () => fetchAgentBySlug(slug),
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", agent?.id],
    enabled: !!agent,
    queryFn: () => fetchAgentReviews(agent!.id),
  });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: feed = [] } = useQuery({ queryKey: ["feed"], queryFn: fetchFeed });
  const { data: followers = 0 } = useQuery({
    queryKey: ["followers", agent?.id],
    enabled: !!agent,
    queryFn: async () => {
      const { count } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", agent!.id);
      return count ?? 0;
    },
  });

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="Loading agent…" /></div>;
  if (!agent)
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <EmptyState title="Agent not found" hint="It may have been removed by its owner." />
      </div>
    );

  const agentTasks = tasks.filter((t) => t.assigned_agent_id === agent.id || t.posted_by_agent === agent.id);
  const agentFeed = feed.filter((f) => f.actor_agent_id === agent.id);
  const isOwner = !!user && agent.owner_id === user.id;

  const follow = async () => {
    if (!user) {
      toast.error("Sign in to follow agents");
      return;
    }
    await supabase.from("follows").insert({ follower_id: user.id, agent_id: agent.id });
    toast.success(`Following ${agent.name}`);
    qc.invalidateQueries({ queryKey: ["followers", agent.id] });
  };

  const endorse = async (skill: string) => {
    if (!user) {
      toast.error("Sign in to endorse skills");
      return;
    }
    await supabase.from("activity_log").insert({
      actor_user_id: user.id,
      target_agent_id: agent.id,
      type: "endorsement",
      message: `endorsed ${agent.name} for ${skill}`,
    });
    toast.success(`Endorsed ${skill}`);
    qc.invalidateQueries({ queryKey: ["feed"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="panel glow-ring p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <AgentAvatar agent={agent} size="lg" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold sm:text-3xl">{agent.name}</h1>
              {agent.verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  <BadgeCheck className="size-3.5" /> Verified owner
                </span>
              )}
              <StatusBadge status={agent.paused ? "paused" : agent.availability} />
            </div>
            <p className="mt-1 text-muted-foreground">{agent.tagline}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <Rating value={agent.reputation} count={reviews.length} />
              <span className="text-muted-foreground">{agent.completed_tasks} tasks completed</span>
              <span className="text-muted-foreground">{followers} followers</span>
              <span className="font-mono text-accent">
                {agent.pricing_model === "free" ? "Free" : `${agent.price_credits} credits / task`}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {isOwner ? (
              <Link to="/agents/$slug/edit" params={{ slug: agent.slug }}>
                <Button variant="secondary">
                  <Pencil className="size-4" /> Edit
                </Button>
              </Link>
            ) : (
              <Button onClick={follow}>Follow</Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="font-semibold">About</h2>
            <p className="mt-2 text-sm text-muted-foreground">{agent.description}</p>
          </section>

          <section className="panel p-6">
            <h2 className="font-semibold">Tasks</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {agentTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
              {agentTasks.map((t) => (
                <TaskCard key={t.id} task={t} agents={[agent]} />
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="font-semibold">Reviews</h2>
            <div className="mt-4 space-y-4">
              {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.reviewer_name}</span>
                    <Rating value={r.rating} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="font-semibold">Activity history</h2>
            <ul className="mt-4 space-y-3">
              {agentFeed.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
              {agentFeed.map((f) => (
                <li key={f.id} className="text-sm text-muted-foreground">
                  <span className="text-foreground">{new Date(f.created_at).toLocaleDateString()}</span> — {f.message}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-semibold">Capabilities</h2>
            <div className="mt-3 space-y-2">
              {capabilityList(agent).map((c) => (
                <div key={c} className="flex items-center justify-between gap-2">
                  <Tag>{c}</Tag>
                  <button
                    onClick={() => endorse(c)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    <ThumbsUp className="size-3.5" /> Endorse
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-5 text-sm">
            <h2 className="font-semibold">Interface</h2>
            <p className="mt-3 text-muted-foreground">Accepts</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {agent.input_types.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
            <p className="mt-3 text-muted-foreground">Returns</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {agent.output_types.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
