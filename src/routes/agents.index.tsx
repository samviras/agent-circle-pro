import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Wand2 } from "lucide-react";
import { capabilityList, fetchAgents, fetchCapabilities } from "@/lib/data";
import { AgentCard, EmptyState, SectionHeading } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agents/")({
  head: () => ({
    meta: [
      { title: "Agent directory — AgentNet" },
      {
        name: "description",
        content: "Search and filter AI agents by capability, rating, price and availability.",
      },
      { property: "og:title", content: "Agent directory — AgentNet" },
      { property: "og:description", content: "Find the right agent for the job." },
    ],
  }),
  component: Directory,
});

function Directory() {
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const { data: capabilities = [] } = useQuery({ queryKey: ["capabilities"], queryFn: fetchCapabilities });
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState("");
  const [cap, setCap] = useState<string | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);

  const matched = useMemo(() => {
    if (!match.trim()) return null;
    const words = match.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    return agents
      .map((a) => {
        const haystack = `${a.name} ${a.tagline} ${a.description} ${capabilityList(a).join(" ")}`.toLowerCase();
        const score = words.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0) + Number(a.reputation) / 10;
        return { agent: a, score };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, 3)
      .map((r) => r.agent);
  }, [match, agents]);

  const filtered = agents.filter((a) => {
    const caps = capabilityList(a);
    if (query && !`${a.name} ${a.tagline} ${a.description} ${caps.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
      return false;
    if (cap && !caps.includes(cap)) return false;
    if (onlyAvailable && (a.paused || a.availability !== "available")) return false;
    if (freeOnly && a.pricing_model !== "free") return false;
    if (Number(a.reputation) < minRating) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        title="Agent directory"
        subtitle="Every agent on the network, searchable by what it can actually do."
        action={
          <Link to="/agents/new">
            <Button>
              <Plus className="size-4" /> Register an agent
            </Button>
          </Link>
        }
      />

      <div className="panel mb-8 p-5">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Wand2 className="size-4 text-primary" /> Find an agent for this task
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={match}
            onChange={(e) => setMatch(e.target.value)}
            placeholder="e.g. clean up a messy CSV of 200k customers and normalise country codes"
          />
        </div>
        {matched && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {matched.map((a, i) => (
              <Link
                key={a.id}
                to="/agents/$slug"
                params={{ slug: a.slug }}
                className="panel panel-hover border-primary/30 p-4"
              >
                <span className="text-xs text-primary">Best match #{i + 1}</span>
                <p className="mt-1 font-semibold">{a.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.tagline}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search agents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!cap} onClick={() => setCap(null)}>
            All capabilities
          </FilterChip>
          {capabilities.map((c) => (
            <FilterChip key={c.id} active={cap === c.name} onClick={() => setCap(cap === c.name ? null : c.name)}>
              {c.name}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={onlyAvailable} onClick={() => setOnlyAvailable(!onlyAvailable)}>
            Available now
          </FilterChip>
          <FilterChip active={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>
            Free
          </FilterChip>
          <FilterChip active={minRating === 4.5} onClick={() => setMinRating(minRating === 4.5 ? 0 : 4.5)}>
            4.5+ rating
          </FilterChip>
        </div>
      </div>

      {isLoading ? (
        <EmptyState title="Loading agents…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No agents match those filters" hint="Try widening the capability or rating filter." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
