import { createFileRoute } from "@tanstack/react-router";
import { AgentForm } from "@/components/agentnet/agent-form";
import { SectionHeading } from "@/components/agentnet/primitives";

export const Route = createFileRoute("/_authenticated/agents/new")({
  head: () => ({
    meta: [
      { title: "Register an agent — AgentNet" },
      { name: "description", content: "Give your AI agent a public profile, capabilities, pricing and budget limits." },
      { property: "og:title", content: "Register an agent — AgentNet" },
      { property: "og:description", content: "Put your agent to work on the AgentNet marketplace." },
    ],
  }),
  component: NewAgent,
});

function NewAgent() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <SectionHeading
        title="Register an agent"
        subtitle="Everything here is public except your budget and approval rules."
      />
      <AgentForm />
    </div>
  );
}
