import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, slugify, type Agent } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  name: string;
  tagline: string;
  description: string;
  avatar_url: string;
  capabilities: string;
  input_types: string;
  output_types: string;
  pricing_model: string;
  price_credits: number;
  availability: string;
  monthly_budget: number;
  approval_threshold: number;
};

export function AgentForm({ agent, capabilities }: { agent?: Agent; capabilities?: string[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: agent?.name ?? "",
    tagline: agent?.tagline ?? "",
    description: agent?.description ?? "",
    avatar_url: agent?.avatar_url ?? "",
    capabilities: (capabilities ?? []).join(", "),
    input_types: (agent?.input_types ?? []).join(", "),
    output_types: (agent?.output_types ?? []).join(", "),
    pricing_model: agent?.pricing_model ?? "credits",
    price_credits: agent?.price_credits ?? 50,
    availability: agent?.availability ?? "available",
    monthly_budget: agent?.monthly_budget ?? 1000,
    approval_threshold: agent?.approval_threshold ?? 250,
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const list = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const syncCapabilities = async (agentId: string) => {
    const names = list(draft.capabilities);
    await supabase.from("agent_capabilities").delete().eq("agent_id", agentId);
    for (const name of names) {
      const slug = slugify(name);
      const { data: existing } = await supabase.from("capabilities").select("id").eq("slug", slug).maybeSingle();
      let capId = existing?.id as string | undefined;
      if (!capId) {
        const { data: created } = await supabase.from("capabilities").insert({ name, slug }).select("id").single();
        capId = created?.id as string | undefined;
      }
      if (capId) await supabase.from("agent_capabilities").insert({ agent_id: agentId, capability_id: capId });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !draft.name.trim()) return;
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      tagline: draft.tagline,
      description: draft.description,
      avatar_url: draft.avatar_url || null,
      input_types: list(draft.input_types),
      output_types: list(draft.output_types),
      pricing_model: draft.pricing_model,
      price_credits: draft.pricing_model === "free" ? 0 : draft.price_credits,
      availability: draft.availability,
      monthly_budget: draft.monthly_budget,
      approval_threshold: draft.approval_threshold,
    };

    if (agent) {
      const { error } = await supabase.from("agents").update(payload).eq("id", agent.id);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
      await syncCapabilities(agent.id);
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent updated");
      navigate({ to: "/agents/$slug", params: { slug: agent.slug } });
      return;
    }

    const slug = `${slugify(draft.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("agents")
      .insert({ ...payload, slug, owner_id: user.id })
      .select("id, slug")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create agent");
      return;
    }
    await syncCapabilities(data.id as string);
    await logActivity({
      actor_agent_id: data.id as string,
      type: "agent_joined",
      message: `${payload.name} joined AgentNet`,
    });
    qc.invalidateQueries({ queryKey: ["agents"] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    toast.success("Agent registered");
    navigate({ to: "/agents/$slug", params: { slug: data.slug as string } });
  };

  return (
    <form onSubmit={submit} className="panel space-y-5 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Atlas Research" />
        </Field>
        <Field label="Tagline">
          <Input
            value={draft.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="Deep research briefs with sources"
          />
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          rows={4}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What this agent does, how it works, and what it is good at."
        />
      </Field>

      <Field label="Avatar image URL (optional)">
        <Input value={draft.avatar_url} onChange={(e) => set("avatar_url", e.target.value)} placeholder="https://…" />
      </Field>

      <Field label="Capability tags (comma separated)">
        <Input
          value={draft.capabilities}
          onChange={(e) => set("capabilities", e.target.value)}
          placeholder="Research, Summarisation, Citations"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Input types">
          <Input value={draft.input_types} onChange={(e) => set("input_types", e.target.value)} placeholder="text, url" />
        </Field>
        <Field label="Output types">
          <Input
            value={draft.output_types}
            onChange={(e) => set("output_types", e.target.value)}
            placeholder="markdown, json"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Pricing">
          <Select value={draft.pricing_model} onChange={(v) => set("pricing_model", v)} options={["free", "credits"]} />
        </Field>
        <Field label="Price (credits)">
          <Input
            type="number"
            min={0}
            disabled={draft.pricing_model === "free"}
            value={draft.price_credits}
            onChange={(e) => set("price_credits", Number(e.target.value))}
          />
        </Field>
        <Field label="Availability">
          <Select
            value={draft.availability}
            onChange={(v) => set("availability", v)}
            options={["available", "busy", "offline"]}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monthly budget (credits)">
          <Input
            type="number"
            min={0}
            value={draft.monthly_budget}
            onChange={(e) => set("monthly_budget", Number(e.target.value))}
          />
        </Field>
        <Field label="Require my sign-off above (credits)">
          <Input
            type="number"
            min={0}
            value={draft.approval_threshold}
            onChange={(e) => set("approval_threshold", Number(e.target.value))}
          />
        </Field>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : agent ? "Save changes" : "Register agent"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs tracking-wide text-muted-foreground uppercase">{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
