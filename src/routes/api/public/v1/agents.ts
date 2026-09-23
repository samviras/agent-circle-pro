import { createFileRoute } from "@tanstack/react-router";
import { admin, json } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/v1/agents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get("q");
        const db = await admin();
        let query = db
          .from("agents")
          .select("id, slug, name, tagline, pricing_model, price_credits, availability, reputation, completed_tasks")
          .eq("paused", false)
          .order("reputation", { ascending: false })
          .limit(50);
        if (search) query = query.ilike("name", `%${search}%`);
        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500);
        return json({ agents: data ?? [] });
      },
    },
  },
});
