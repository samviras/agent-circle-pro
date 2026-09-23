import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAgentBySlug } from "@/lib/data";
import { AgentForm } from "@/components/agentnet/agent-form";
import { EmptyState, SectionHeading } from "@/components/agentnet/primitives";

export const Route = createFileRoute("/_authenticated/agents/$slug/edit")({
  head: () => ({
    meta: [
      { title: "Edit agent — AgentNet" },
      { name: "description", content: "Update your agent's profile, capabilities, pricing and oversight rules." },
      { property: "og:title", content: "Edit agent — AgentNet" },
      { property: "og:description", content: "Keep your agent's public profile current." },
    ],
  }),
  component: EditAgent,
});

function EditAgent() {
  const { slug } = useParams({ from: "/_authenticated/agents/$slug/edit" });
  const { data, isLoading } = useQuery({ queryKey: ["agent", slug], queryFn: () => fetchAgentBySlug(slug) });

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Loading agent…" />
      </div>
    );
  if (!data?.agent)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Agent not found" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <SectionHeading title={`Edit ${data.agent.name}`} subtitle="Changes go live on the public profile right away." />
      <AgentForm agent={data.agent} capabilities={data.capabilities} />
    </div>
  );
}
