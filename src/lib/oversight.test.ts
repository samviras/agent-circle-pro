import { describe, expect, it } from "vitest";
import {
  canApproveInOneTap,
  canReconcile,
  detectConflicts,
  knowsItsLimits,
  type AgentAction,
} from "./oversight";

const base: AgentAction = {
  id: "x",
  task_id: "t",
  agent_id: "a1",
  kind: "k",
  intent: "create",
  subject: null,
  summary: "s",
  scheduled_for: null,
  duration_minutes: null,
  confidence: "high",
  confidence_reason: "",
  abstained: false,
  abstain_reason: null,
  recommended_next_step: null,
  status: "running",
  seeded: false,
  should_have_abstained: null,
  was_correct: null,
  created_at: "2026-11-01T00:00:00Z",
};
const act = (o: Partial<AgentAction>): AgentAction => ({ ...base, ...o });

describe("conflict detector", () => {
  it("flags two refill orders for the same medication as a duplicate", () => {
    const r = detectConflicts([
      act({ id: "1", agent_id: "a1", subject: "refill:lisinopril" }),
      act({ id: "2", agent_id: "a2", subject: "refill:lisinopril" }),
    ]);
    expect(r.map((c) => c.kind)).toEqual(["duplicate"]);
  });

  it("flags one agent booking and another cancelling as a contradiction", () => {
    const r = detectConflicts([
      act({ id: "1", agent_id: "a1", subject: "visit", intent: "create" }),
      act({ id: "2", agent_id: "a2", subject: "visit", intent: "cancel" }),
    ]);
    expect(r[0]?.kind).toBe("contradiction");
  });

  it("flags bookings at overlapping times", () => {
    const r = detectConflicts([
      act({ id: "1", agent_id: "a1", subject: "a", scheduled_for: "2026-11-03T10:00:00Z", duration_minutes: 60 }),
      act({ id: "2", agent_id: "a2", subject: "b", scheduled_for: "2026-11-03T10:30:00Z", duration_minutes: 30 }),
    ]);
    expect(r[0]?.kind).toBe("overlap");
  });

  it("leaves non-conflicting actions alone", () => {
    const r = detectConflicts([
      act({ id: "1", agent_id: "a1", subject: "refill:lisinopril" }),
      act({ id: "2", agent_id: "a1", subject: "reminder:daily", intent: "info" }),
    ]);
    expect(r).toHaveLength(0);
  });

  it("ignores an abstained action", () => {
    const r = detectConflicts([
      act({ id: "1", agent_id: "a1", subject: "refill:x" }),
      act({ id: "2", agent_id: "a2", subject: "refill:x", abstained: true }),
    ]);
    expect(r).toHaveLength(0);
  });
});

describe("confidence rules", () => {
  it("low confidence cannot be approved with one tap", () => {
    expect(canApproveInOneTap({ confidence: "low", abstained: false })).toBe(false);
    expect(canApproveInOneTap({ confidence: "medium", abstained: false })).toBe(true);
  });

  it("an abstained result cannot be approved with one tap", () => {
    expect(canApproveInOneTap({ confidence: "high", abstained: true })).toBe(false);
  });

  it("skips reconcile when either side of a conflict is low confidence", () => {
    expect(canReconcile({ confidence: "high", abstained: false }, { confidence: "low", abstained: false })).toBe(false);
    expect(canReconcile({ confidence: "high", abstained: false }, { confidence: "medium", abstained: false })).toBe(true);
  });
});

describe("knows its limits", () => {
  it("counts appropriate abstains and confident-and-right results positively", () => {
    const s = knowsItsLimits([
      { confidence: "low", abstained: true, should_have_abstained: true, was_correct: true },
      { confidence: "high", abstained: false, should_have_abstained: true, was_correct: false },
      { confidence: "high", abstained: false, should_have_abstained: false, was_correct: true },
      { confidence: "high", abstained: false, should_have_abstained: false, was_correct: false },
    ]);
    expect(s.abstainedCorrectly).toBe(1);
    expect(s.shouldAbstain).toBe(2);
    expect(s.confidentAndRight).toBe(1);
    expect(s.confident).toBe(3);
    expect(s.score).toBe(40);
  });

  it("has no score without history", () => {
    expect(knowsItsLimits([]).score).toBeNull();
  });
});
