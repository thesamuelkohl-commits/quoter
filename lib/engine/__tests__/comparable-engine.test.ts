import { describe, expect, it } from "vitest";
import { scoreSimilarity, rankComparables, recencyWeight } from "../comparable-engine";
import { emptyProfile } from "./fixtures";

describe("scoreSimilarity", () => {
  it("scores an identical profile as a perfect match", () => {
    const profile = emptyProfile({
      eventType: "Corporate Conference",
      attendees: 500,
      roomSqft: 20000,
      showDays: 2,
      audioComplexity: "LARGE",
    });
    const result = scoreSimilarity(profile, profile);
    expect(result.score).toBeCloseTo(1, 5);
  });

  it("scores a very different profile lower than an identical one", () => {
    const target = emptyProfile({ eventType: "Corporate Conference", attendees: 500, showDays: 2 });
    const similar = emptyProfile({ eventType: "Corporate Conference", attendees: 520, showDays: 2 });
    const different = emptyProfile({ eventType: "Product Launch", attendees: 4000, showDays: 5 });

    const similarScore = scoreSimilarity(target, similar).score;
    const differentScore = scoreSimilarity(target, different).score;
    expect(similarScore).toBeGreaterThan(differentScore);
  });

  it("skips fields missing on either side rather than penalizing them", () => {
    const target = emptyProfile({ attendees: 500 });
    const candidate = emptyProfile({}); // nothing known
    const result = scoreSimilarity(target, candidate);
    expect(result.comparableFieldCount).toBe(0);
    expect(result.score).toBe(0);
  });
});

describe("recencyWeight", () => {
  it("weighs a recent event near 1", () => {
    const now = new Date("2026-01-01");
    const recent = new Date("2025-11-01");
    expect(recencyWeight(recent, now)).toBeGreaterThan(0.9);
  });

  it("weighs an old event lower", () => {
    const now = new Date("2026-01-01");
    const old = new Date("2018-01-01");
    expect(recencyWeight(old, now)).toBeLessThan(0.1);
  });
});

describe("rankComparables", () => {
  it("ranks a recent similar event above an old identical one when close", () => {
    const target = emptyProfile({ attendees: 500, eventType: "Corporate Conference" });

    const candidates = [
      { id: "old", profile: emptyProfile({ attendees: 500, eventType: "Corporate Conference" }), eventDate: new Date("2015-01-01") },
      { id: "recent", profile: emptyProfile({ attendees: 480, eventType: "Corporate Conference" }), eventDate: new Date("2025-12-01") },
    ];

    const ranked = rankComparables(target, candidates).map((r) => r.event.id);
    // recent+close should beat old+exact once recency is blended in
    expect(ranked[0]).toBe("recent");
  });

  it("respects the limit", () => {
    const target = emptyProfile({ attendees: 500 });
    const candidates = Array.from({ length: 20 }, (_, i) => ({
      id: `event-${i}`,
      profile: emptyProfile({ attendees: 500 + i }),
      eventDate: new Date("2026-01-01"),
    }));
    expect(rankComparables(target, candidates, undefined, 5)).toHaveLength(5);
  });
});
