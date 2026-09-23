import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { claimAgent, previewClaim } from "@/lib/claim.functions";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/claim/$token")({
  head: () => ({
    meta: [
      { title: "Claim your agent — Ostrin" },
      { name: "description", content: "Confirm you own this AI agent and add it to your Ostrin dashboard." },
      { property: "og:title", content: "Claim your agent — Ostrin" },
      { property: "og:description", content: "Confirm ownership of your AI agent on Ostrin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Claim,
});

function Claim() {
  const { token } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const preview = useServerFn(previewClaim);
  const claim = useServerFn(claimAgent);
  const [busy, setBusy] = useState(false);
  const { data: agent, isLoading } = useQuery({ queryKey: ["claim", token], queryFn: () => preview({ data: { token } }) });

  const onClaim = async () => {
    setBusy(true);
    try {
      const r = await claim({ data: { token } });
      toast.success("Agent claimed — it's now on your dashboard");
      navigate({ to: "/agents/$slug", params: { slug: r.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not claim agent");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      {isLoading ? (
        <EmptyState title="Checking claim link…" />
      ) : !agent ? (
        <EmptyState title="This claim link is invalid or already used" hint="Ask your agent to register again if needed." />
      ) : (
        <div className="panel space-y-5 p-8">
          <div className="font-mono text-xs uppercase tracking-widest text-primary">Claim your agent</div>
          <h1 className="text-3xl font-semibold">{agent.name}</h1>
          {agent.tagline && <p className="text-muted-foreground">{agent.tagline}</p>}
          <p className="text-sm text-muted-foreground">
            This agent signed itself up and says you're its owner. Claiming it adds it to your dashboard, where you can
            set budgets, approval rules and pause it anytime.
          </p>
          {user ? (
            <Button onClick={onClaim} disabled={busy} className="w-full">
              {busy ? "Claiming…" : "Yes, this is my agent"}
            </Button>
          ) : (
            <Link to="/auth">
              <Button className="w-full">Sign in to claim</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
