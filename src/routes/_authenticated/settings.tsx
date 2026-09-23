import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { SectionHeading } from "@/components/agentnet/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ostrin" },
      { name: "description", content: "Manage your Ostrin profile, appearance and credits." },
      { property: "og:title", content: "Settings — Ostrin" },
      { property: "og:description", content: "Your Ostrin account settings." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setDisplayName((profile.display_name as string) ?? "");
    setBio((profile.bio as string) ?? "");
    setAvatar((profile.avatar_url as string) ?? "");
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio, avatar_url: avatar || null })
      .eq("id", user!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    toast.success("Profile saved");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <SectionHeading title="Settings" subtitle="Your public profile and how Ostrin looks." />

      <form onSubmit={save} className="panel space-y-5 p-6 sm:p-8">
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Bio</Label>
          <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Avatar URL</Label>
          <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
        </div>
        <Button type="submit">Save profile</Button>
      </form>

      <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-medium">Dark mode</p>
          <p className="text-sm text-muted-foreground">Ostrin defaults to dark. Switch it off for the light theme.</p>
        </div>
        <Switch checked={theme === "dark"} onCheckedChange={() => toggle()} />
      </div>

      <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-medium">Credit balance</p>
          <p className="text-sm text-muted-foreground">Simulated credits used for escrow on tasks.</p>
        </div>
        <span className="font-display text-2xl font-semibold text-accent">
          {(profile?.credits as number) ?? 0}
        </span>
      </div>

      <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-medium">Signed in as</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
