import { supabase } from "@/integrations/supabase/client";

export type Agent = {
  id: string;
  owner_id: string | null;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  avatar_url: string | null;
  input_types: string[];
  output_types: string[];
  pricing_model: string;
  price_credits: number;
  availability: string;
  paused: boolean;
  verified: boolean;
  reputation: number;
  completed_tasks: number;
  monthly_budget: number;
  approval_threshold: number;
  created_at: string;
  agent_capabilities?: { capabilities: { slug: string; name: string } | null }[];
};

export type Task = {
  id: string;
  parent_task_id: string | null;
  title: string;
  description: string;
  required_capabilities: string[];
  budget_credits: number;
  deadline: string | null;
  visibility: string;
  status: TaskStatus;
  input_spec: string | null;
  output_spec: string | null;
  result: string | null;
  created_by: string | null;
  posted_by_agent: string | null;
  assigned_agent_id: string | null;
  created_at: string;
};

export type TaskStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "approved"
  | "completed"
  | "disputed";

export const TASK_STATUSES: TaskStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "submitted",
  "approved",
  "completed",
  "disputed",
];

export type TaskBid = {
  id: string;
  task_id: string;
  agent_id: string;
  message: string | null;
  price_credits: number;
  status: string;
  created_at: string;
};

export type TaskMessage = {
  id: string;
  task_id: string;
  agent_id: string | null;
  author_id: string | null;
  body: string;
  kind: string;
  created_at: string;
};

export type Review = {
  id: string;
  task_id: string | null;
  agent_id: string;
  reviewer_name: string;
  rating: number;
  quality: number | null;
  speed: number | null;
  comment: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  actor_agent_id: string | null;
  target_agent_id: string | null;
  task_id: string | null;
  type: string;
  message: string;
  created_at: string;
};

export type Capability = { id: string; slug: string; name: string };

const AGENT_SELECT = "*, agent_capabilities(capabilities(slug,name))";

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export const capabilityList = (agent: Agent): string[] =>
  (agent.agent_capabilities ?? []).map((row) => row.capabilities?.name).filter(Boolean) as string[];

export async function fetchAgents(): Promise<Agent[]> {
  return unwrap<Agent[]>(
    await supabase.from("agents").select(AGENT_SELECT).order("reputation", { ascending: false }),
  );
}

export async function fetchAgentBySlug(slug: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Agent | null;
}

export async function fetchMyAgents(ownerId: string): Promise<Agent[]> {
  return unwrap<Agent[]>(
    await supabase
      .from("agents")
      .select(AGENT_SELECT)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false }),
  );
}

export async function fetchCapabilities(): Promise<Capability[]> {
  return unwrap<Capability[]>(await supabase.from("capabilities").select("*").order("name"));
}

export async function fetchTasks(): Promise<Task[]> {
  return unwrap<Task[]>(
    await supabase.from("tasks").select("*").order("created_at", { ascending: false }),
  );
}

export async function fetchTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Task | null;
}

export async function fetchSubtasks(parentId: string): Promise<Task[]> {
  return unwrap<Task[]>(
    await supabase
      .from("tasks")
      .select("*")
      .eq("parent_task_id", parentId)
      .order("created_at", { ascending: true }),
  );
}

export async function fetchTaskMessages(taskId: string): Promise<TaskMessage[]> {
  return unwrap<TaskMessage[]>(
    await supabase
      .from("task_messages")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
  );
}

export async function fetchTaskBids(taskId: string): Promise<TaskBid[]> {
  return unwrap<TaskBid[]>(
    await supabase
      .from("task_bids")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
  );
}

export async function fetchAgentReviews(agentId: string): Promise<Review[]> {
  return unwrap<Review[]>(
    await supabase
      .from("reviews")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false }),
  );
}

export async function fetchFeed(): Promise<Activity[]> {
  return unwrap<Activity[]>(
    await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40),
  );
}

export async function fetchLedger(): Promise<
  { id: string; agent_id: string | null; task_id: string | null; amount: number; kind: string; note: string | null; created_at: string }[]
> {
  return unwrap(
    await supabase
      .from("credit_ledger")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  );
}

export async function logActivity(entry: {
  actor_agent_id?: string | null;
  target_agent_id?: string | null;
  task_id?: string | null;
  type: string;
  message: string;
}) {
  await supabase.from("activity_log").insert(entry);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
