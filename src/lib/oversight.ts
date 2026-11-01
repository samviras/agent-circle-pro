// Pure rules for "Confidence and abstain" and the "Conflict detector".
// Shared by the server functions and the UI so both apply the same logic.

export type Confidence = "high" | "medium" | "low";

export type AgentAction = {
  id: string;
  task_id: string | null;
  agent_id: string;
  kind: string;
  intent: string; // "create" | "cancel" | "info"
  subject: string | null;
  summary: string;
  scheduled_for: string | null;
  duration_minutes: number | null;
  confidence: string;
  confidence_reason: string;
  abstained: boolean;
  abstain_reason: string | null;
  recommended_next_step: string | null;
  status: string;
  seeded: boolean;
  should_have_abstained: boolean | null;
  was_correct: boolean | null;
  created_at: string;
};

export type TaskConflict = {
  id: string;
  task_id: string;
  action_a: string;
  action_b: string;
  kind: ConflictKind;
  reason: string;
  status: string; // "open" | "reconciling" | "resolved"
  resolution: string | null;
  combined_plan: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ConflictKind = "contradiction" | "duplicate" | "overlap";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ACTION_STATUS_LABEL: Record<string, string> = {
  proposed: "Proposed",
  running: "Going ahead",
  held: "Held for you",
  paused: "Paused: conflict",
  approved: "Approved by you",
  rejected: "Dropped",
  handed_to_human: "With a human",
  second_look: "Second look asked",
  merged: "Merged into combined plan",
};

/** Statuses that still count as "live" for conflict checks. */
const LIVE = new Set(["proposed", "running", "held", "paused", "approved"]);

export function isLow(a: Pick<AgentAction, "confidence" | "abstained">) {
  return a.abstained || a.confidence === "low";
}

/** Low confidence or abstained results are held and need a deliberate review. */
export function canApproveInOneTap(a: Pick<AgentAction, "confidence" | "abstained">) {
  return !isLow(a);
}

/** Status an action gets right after it is evaluated (before conflict checks). */
export function initialStatus(a: Pick<AgentAction, "confidence" | "abstained">) {
  return isLow(a) ? "held" : "running";
}

function timeRange(a: AgentAction): [number, number] | null {
  if (!a.scheduled_for) return null;
  const start = new Date(a.scheduled_for).getTime();
  return [start, start + (a.duration_minutes ?? 30) * 60_000];
}

export function conflictBetween(a: AgentAction, b: AgentAction): { kind: ConflictKind; reason: string } | null {
  if (a.agent_id === b.agent_id) return null;
  if (a.abstained || b.abstained) return null;
  if (!LIVE.has(a.status) || !LIVE.has(b.status)) return null;

  if (a.subject && a.subject === b.subject) {
    const thing = a.subject.split(":").pop() ?? "item";
    if ((a.intent === "create" && b.intent === "cancel") || (a.intent === "cancel" && b.intent === "create")) {
      return {
        kind: "contradiction",
        reason: `One agent sets up the ${thing} plan while the other cancels it. They can't both happen.`,
      };
    }
    if (a.intent === "create" && b.intent === "create") {
      return {
        kind: "duplicate",
        reason: `Both plans handle the same ${thing} need. Doing both means it happens twice.`,
      };
    }
  }

  if (a.intent === "create" && b.intent === "create") {
    const ra = timeRange(a);
    const rb = timeRange(b);
    if (ra && rb && ra[0] < rb[1] && rb[0] < ra[1]) {
      return { kind: "overlap", reason: "Both are booked for the same time, and the patient can't be in two places at once." };
    }
  }
  return null;
}

/** Compare every pair of live actions on a task and return the clashing pairs. */
export function detectConflicts(actions: AgentAction[]) {
  const found: { a: AgentAction; b: AgentAction; kind: ConflictKind; reason: string }[] = [];
  for (let i = 0; i < actions.length; i++) {
    for (let j = i + 1; j < actions.length; j++) {
      const c = conflictBetween(actions[i], actions[j]);
      if (c) found.push({ a: actions[i], b: actions[j], ...c });
    }
  }
  return found;
}

/** Reconciling is skipped when either side is Low confidence: that goes straight to a human. */
export function canReconcile(a: Pick<AgentAction, "confidence" | "abstained">, b: Pick<AgentAction, "confidence" | "abstained">) {
  return !isLow(a) && !isLow(b);
}

const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function lowerConfidence(a: string, b: string): Confidence {
  return ((RANK[a] ?? 2) <= (RANK[b] ?? 2) ? a : b) as Confidence;
}

/** The combined plan both agents put forward when asked to reconcile. */
export function combinedPlan(a: AgentAction, b: AgentAction, kind: ConflictKind, names: { a: string; b: string }) {
  const aFirst = (RANK[a.confidence] ?? 2) >= (RANK[b.confidence] ?? 2);
  const keep = aFirst ? a : b;
  const drop = aFirst ? b : a;
  const keepName = aFirst ? names.a : names.b;
  const dropName = aFirst ? names.b : names.a;
  if (kind === "duplicate")
    return `One plan only: ${keep.summary}. Drop "${drop.summary}". ${dropName} confirms stock and details for ${keepName}'s plan before it goes ahead.`;
  if (kind === "contradiction")
    return `Hold both until the facts are checked: ${dropName} confirms the record, then ${keepName} goes ahead with "${keep.summary}" only if it still applies.`;
  return `Keep "${keep.summary}" at its time and move "${drop.summary}" to start after it ends.`;
}

export type LimitsStat = {
  shouldAbstain: number;
  abstainedCorrectly: number;
  confident: number;
  confidentAndRight: number;
  score: number | null; // 0–100
};

/**
 * "Knows its limits": appropriate abstaining counts positively, and so does
 * being confident and right. Only evaluated rows (with known outcome) count.
 */
export function knowsItsLimits(
  rows: Pick<AgentAction, "confidence" | "abstained" | "should_have_abstained" | "was_correct">[],
): LimitsStat {
  const evaluated = rows.filter((r) => r.should_have_abstained !== null && r.should_have_abstained !== undefined);
  const shouldAbstain = evaluated.filter((r) => r.should_have_abstained).length;
  const abstainedCorrectly = evaluated.filter((r) => r.should_have_abstained && r.abstained).length;
  const confidentRows = evaluated.filter((r) => !r.abstained && r.confidence === "high");
  const confident = confidentRows.length;
  const confidentAndRight = confidentRows.filter((r) => r.was_correct).length;
  const denom = shouldAbstain + confident;
  return {
    shouldAbstain,
    abstainedCorrectly,
    confident,
    confidentAndRight,
    score: denom === 0 ? null : Math.round(((abstainedCorrectly + confidentAndRight) / denom) * 100),
  };
}
