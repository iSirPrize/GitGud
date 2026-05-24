// dailies.test.js
// TDD: written BEFORE the real implementation.
// All 18 tests must fail with the stub, pass with the real implementation.

import { describe, it, expect } from "vitest";
import { QUEST_POOL, pickDailyQuests, isQuestComplete, calcQuestXP, applyProgress } from "../useDailies";

describe("QUEST_POOL", () => {
  it("has exactly 10 quests", () => {
    expect(QUEST_POOL).toHaveLength(10);
  });

  // Guard: fails immediately if pool is empty, then checks each quest's shape
  it("every quest has id, type, label, required, and xpReward", () => {
    expect(QUEST_POOL.length).toBeGreaterThan(0);
    for (const quest of QUEST_POOL) {
      expect(quest).toHaveProperty("id");
      expect(quest).toHaveProperty("type");
      expect(quest).toHaveProperty("label");
      expect(quest).toHaveProperty("required");
      expect(quest).toHaveProperty("xpReward");
    }
  });

  // Guard: fails immediately if pool is empty
  it("all required values are positive integers", () => {
    expect(QUEST_POOL.length).toBeGreaterThan(0);
    for (const quest of QUEST_POOL) {
      expect(Number.isInteger(quest.required)).toBe(true);
      expect(quest.required).toBeGreaterThan(0);
    }
  });

  // Guard: fails immediately if pool is empty
  it("all xpReward values are positive integers", () => {
    expect(QUEST_POOL.length).toBeGreaterThan(0);
    for (const quest of QUEST_POOL) {
      expect(Number.isInteger(quest.xpReward)).toBe(true);
      expect(quest.xpReward).toBeGreaterThan(0);
    }
  });

  // Guard: fails immediately if pool is empty
  it("all types are aim, quiz, or reaction", () => {
    expect(QUEST_POOL.length).toBeGreaterThan(0);
    const validTypes = ["aim", "quiz", "reaction"];
    for (const quest of QUEST_POOL) {
      expect(validTypes).toContain(quest.type);
    }
  });
});

describe("pickDailyQuests", () => {
  it("returns exactly 3 quests", () => {
    expect(pickDailyQuests()).toHaveLength(3);
  });

  it("returns 3 unique quests (no duplicates by id)", () => {
    const picked = pickDailyQuests();
    expect(picked.length).toBe(3); // guard: fails if empty
    expect(new Set(picked.map((q) => q.id)).size).toBe(3);
  });

  // Guard: fails if either the pool or the picked list is empty
  it("all picked quests exist in QUEST_POOL", () => {
    expect(QUEST_POOL.length).toBeGreaterThan(0);
    const picked = pickDailyQuests();
    expect(picked.length).toBeGreaterThan(0);
    const poolIds = QUEST_POOL.map((q) => q.id);
    for (const quest of picked) {
      expect(poolIds).toContain(quest.id);
    }
  });

  // Guard: fails if either call returns empty
  it("is deterministic given the same date string", () => {
    const first  = pickDailyQuests("2024-01-15");
    const second = pickDailyQuests("2024-01-15");
    expect(first.length).toBeGreaterThan(0);
    expect(first.map((q) => q.id)).toEqual(second.map((q) => q.id));
  });

  it("produces different quests for different dates", () => {
    const ids1 = pickDailyQuests("2024-01-15").map((q) => q.id).join(",");
    const ids2 = pickDailyQuests("2024-01-16").map((q) => q.id).join(",");
    expect(ids1).not.toBe(ids2);
  });
});

describe("applyProgress", () => {
  it("increments progress by the given amount", () => {
    expect(applyProgress({ id: "q1", progress: 2, required: 5, done: false }, 1).progress).toBe(3);
  });

  it("caps progress at required", () => {
    expect(applyProgress({ id: "q1", progress: 4, required: 5, done: false }, 10).progress).toBe(5);
  });

  it("marks done=true when progress reaches required", () => {
    expect(applyProgress({ id: "q1", progress: 4, required: 5, done: false }, 1).done).toBe(true);
  });

  it("does not change an already-done quest", () => {
    const updated = applyProgress({ id: "q1", progress: 5, required: 5, done: true }, 3);
    expect(updated.progress).toBe(5);
    expect(updated.done).toBe(true);
  });
});

describe("isQuestComplete", () => {
  it("returns true when progress >= required", () => {
    expect(isQuestComplete({ progress: 5, required: 5 })).toBe(true);
    expect(isQuestComplete({ progress: 6, required: 5 })).toBe(true);
  });

  it("returns false when progress < required", () => {
    expect(isQuestComplete({ progress: 4, required: 5 })).toBe(false);
    expect(isQuestComplete({ progress: 0, required: 3 })).toBe(false);
  });
});

describe("calcQuestXP", () => {
  it("returns the quest xpReward for a completed quest", () => {
    expect(calcQuestXP({ xpReward: 50, progress: 5, required: 5 })).toBe(50);
  });

  it("returns 0 for an incomplete quest", () => {
    expect(calcQuestXP({ xpReward: 50, progress: 2, required: 5 })).toBe(0);
  });
});