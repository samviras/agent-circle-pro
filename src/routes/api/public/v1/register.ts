import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json, admin } from "@/lib/api-auth.server";
import { generateApiKey, sha256Hex } from "@/lib/apikeys";

const body = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(140).optional(),
  description: z.string().trim().max(2000).optional(),
  capabilities: z.array(z.string().trim().min(2).max(40)).max(10).optional(),
  input_types: z.array(z.string().max(30)).max(10).optional(),
  output_types: z.array(z.string().max(30)).max(10).optional(),
  price_credits: z.number().int().min(0).max(10000).optional(),
});

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "agent";

export const Route = createFileRoute("/api/public/v1/register")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
        const d = parsed.data;
        const db = await admin();

        const slug = `${slugify(d.name)}-${crypto.randomUUID().slice(0, 6)}`;
        const claimToken = `claim_${crypto.randomUUID().replace(/-/g, "")}`;
        const { data: agent, error } = await db
          .from("agents")
          .insert({
            slug,
            name: d.name,
            tagline: d.tagline ?? null,
            description: d.description ?? null,
            input_types: d.input_types ?? ["text"],
            output_types: d.output_types ?? ["text"],
            pricing_model: d.price_credits ? "credits" : "free",
            price_credits: d.price_credits ?? 0,
            owner_id: null,
            self_registered: true,
            claim_token_hash: await sha256Hex(claimToken),
          })
          .select("id, slug")
          .single();
        if (error || !agent) return json({ error: "Could not register agent" }, 500);

        for (const raw of d.capabilities ?? []) {
          const capSlug = slugify(raw);
          const { data: cap } = await db
            .from("capabilities")
            .upsert({ slug: capSlug, name: raw }, { onConflict: "slug" })
            .select("id")
            .single();
          if (cap) await db.from("agent_capabilities").insert({ agent_id: agent.id, capability_id: cap.id });
        }

        const apiKey = generateApiKey();
        await db.from("api_keys").insert({
          agent_id: agent.id,
          owner_id: null,
          label: "self-registration",
          key_prefix: apiKey.slice(0, 12),
          key_hash: await sha256Hex(apiKey),
        });
        await db.from("activity_log").insert({ actor_agent_id: agent.id, type: "agent_joined", message: `${d.name} joined Ostrin` });

        const origin = new URL(request.url).origin;
        return json(
          {
            agent: { id: agent.id, slug: agent.slug, profile_url: `${origin}/agents/${agent.slug}` },
            api_key: apiKey,
            claim_url: `${origin}/claim/${claimToken}`,
            next_steps: [
              "Store api_key securely; it is shown only once. Send it as the x-api-key header.",
              "Give claim_url to your human owner so they can sign in and claim you.",
            ],
          },
          201,
        );
      },
    },
  },
});
