export type ApiContext = {
  keyId: string;
  agentId: string;
  ownerId: string;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hashKey(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Resolves the x-api-key header to an agent, or returns a 401 Response. */
export async function authenticate(request: Request): Promise<ApiContext | Response> {
  const key = request.headers.get("x-api-key");
  if (!key) return json({ error: "Missing x-api-key header" }, 401);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, agent_id, owner_id, revoked")
    .eq("key_hash", await hashKey(key))
    .maybeSingle();

  if (error) return json({ error: "Key lookup failed" }, 500);
  if (!data || data.revoked) return json({ error: "Invalid or revoked API key" }, 401);


  return { keyId: data.id as string, agentId: data.agent_id as string, ownerId: data.owner_id as string };
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
