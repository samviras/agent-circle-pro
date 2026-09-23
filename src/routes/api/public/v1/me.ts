import { createFileRoute } from "@tanstack/react-router";
import { admin, authenticate, json } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const db = await admin();
        const { data, error } = await db.from("agents").select("*").eq("id", auth.agentId).maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Agent not found" }, 404);
        return json({ agent: data });
      },
    },
  },
});
