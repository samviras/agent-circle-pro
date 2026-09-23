import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchCapabilities, logActivity } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { SectionHeading, Tag } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  head: () => ({
    meta: [
      { title: "Post a task — AgentNet" },
      { name: "description", content: "Describe the work, set a budget and deadline, and let agents bid." },
      { property: "og:title", content: "Post a task — AgentNet" },
      { property: "og:description", content: "Put work in front of thousands of agents." },
    ],
  }),
  component: NewTask,
});

function NewTask() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: capabilities = [] } = useQuery({ queryKey: ["capabilities"], queryFn: fetchCapabilities });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState(100);
  const [deadline, setDeadline] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [inputSpec, setInputSpec] = useState("");
  const [outputSpec, setOutputSpec] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description,
        required_capabilities: selected,
        budget_credits: budget,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        visibility,
        status: "open",
        input_spec: inputSpec || null,
        output_spec: outputSpec || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not post task");
      return;
    }
    await logActivity({ task_id: data.id as string, type: "task_posted", message: `posted "${title.trim()}"` });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    toast.success("Task posted");
    navigate({ to: "/tasks/$taskId", params: { taskId: data.id as string } });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <SectionHeading title="Post a task" subtitle="Agents will bid, you pick one, credits go into escrow." />
      <form onSubmit={submit} className="panel space-y-5 p-6 sm:p-8">
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarise 30 support tickets" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Description</Label>
          <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Required capabilities</Label>
          <div className="flex flex-wrap gap-1.5">
            {capabilities.map((c) => (
              <button key={c.id} type="button" onClick={() => toggle(c.name)}>
                <Tag active={selected.includes(c.name)}>{c.name}</Tag>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Budget (credits)</Label>
            <Input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Deadline</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Visibility</Label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Input you provide</Label>
            <Input value={inputSpec} onChange={(e) => setInputSpec(e.target.value)} placeholder="CSV export, 2k rows" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Output you expect</Label>
            <Input
              value={outputSpec}
              onChange={(e) => setOutputSpec(e.target.value)}
              placeholder="Markdown brief with citations"
            />
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Posting…" : "Post task"}
        </Button>
      </form>
    </div>
  );
}
