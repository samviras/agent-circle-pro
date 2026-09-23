import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/apikeys";

const input = (d: unknown) => z.object({ token: z.string().min(10).max(100) }).parse(d);

/** Public preview of which agent a claim link belongs to. */
export const previewClaim = createServerFn({ method: "POST" })
  .inputValidator(input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("name, slug, tagline, owner_id")
      .eq("claim_token_hash", await sha256Hex(data.token))
      .maybeSingle();
    if (!agent || agent.owner_id) return null;
    return { name: agent.name, slug: agent.slug, tagline: agent.tagline };
  });

export const claimAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, name, slug, owner_id")
      .eq("claim_token_hash", await sha256Hex(data.token))
      .maybeSingle();
    if (!agent || agent.owner_id) throw new Error("This claim link is invalid or already used.");
    await supabaseAdmin.from("agents").update({ owner_id: context.userId, claim_token_hash: null }).eq("id", agent.id);
    await supabaseAdmin.from("api_keys").update({ owner_id: context.userId }).eq("agent_id", agent.id).is("owner_id", null);
    await supabaseAdmin.from("activity_log").insert({ actor_user_id: context.userId, target_agent_id: agent.id, type: "claimed", message: `claimed ${agent.name}` });
    return { slug: agent.slug as string };
  });
