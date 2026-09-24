import { describe, expect, it } from "vitest";
import { applyHardRules, learnedCrewSuggestions, buildCrewPlan, computeGlobalPattern } from "../crew-engine";
import { emptyProfile } from "./fixtures";
import type { CrewRuleInput, ComparableWithCrew } from "../crew-engine";

const breakoutRule: CrewRuleInput = {
  id: "rule-breakout",
  positionId: "pos-breakout-tech",
  positionName: "Breakout Technician",
  name: "Breakout Technician Ratio",
  ruleDsl: { type: "ratio_ceiling", inputField: "numSimultaneousBreakoutRooms", divisor: 2 },
  priority: 10,
  active: true,
};

describe("applyHardRules", () => {
  it("computes the breakout tech count from the hard rule", () => {
    const profile = emptyProfile({ numSimultaneousBreakoutRooms: 8 });
    const items = applyHardRules(profile, [breakoutRule]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ positionId: "pos-breakout-tech", quantity: 4, source: "HARD_RULE" });
  });

  it("skips inactive rules", () => {
    const profile = emptyProfile({ numSimultaneousBreakoutRooms: 8 });
    const items = applyHardRules(profile, [{ ...breakoutRule, active: false }]);
    expect(items).toHaveLength(0);
  });

  it("uses only the highest-priority rule when two rules target the same position", () => {
    const lowPriority: CrewRuleInput = { ...breakoutRule, id: "rule-low", priority: 1, ruleDsl: { type: "fixed", quantity: 99 } };
    const profile = emptyProfile({ numSimultaneousBreakoutRooms: 8 });
    const items = applyHardRules(profile, [lowPriority, breakoutRule]);
    expect(items).toHaveLength(1);
    expect(items[0].ruleId).toBe("rule-breakout");
    expect(items[0].quantity).toBe(4);
  });
});

describe("learnedCrewSuggestions", () => {
  const comparables: ComparableWithCrew[] = [
    { historicalEventId: "e1", similarity: 0.9, crew: [{ positionId: "pos-v1", positionName: "V1", quantity: 1 }] },
    { historicalEventId: "e2", similarity: 0.8, crew: [{ positionId: "pos-v1", positionName: "V1", quantity: 1 }] },
    { historicalEventId: "e3", similarity: 0.7, crew: [{ positionId: "pos-v1", positionName: "V1", quantity: 2 }] },
    { historicalEventId: "e4", similarity: 0.6, crew: [] }, // no V1 on this one
  ];

  it("recommends a position that appears in most comparables", () => {
    const items = learnedCrewSuggestions(comparables, new Set(), 0.5);
    expect(items).toHaveLength(1);
    expect(items[0].positionId).toBe("pos-v1");
    expect(items[0].source).toBe("LEARNED_PATTERN");
    expect(items[0].quantity).toBe(1); // round(avg(1,1,2)) = round(1.33) = 1
  });

  it("excludes positions already covered by a hard rule", () => {
    const items = learnedCrewSuggestions(comparables, new Set(["pos-v1"]), 0.5);
    expect(items).toHaveLength(0);
  });

  it("does not suggest a position below the frequency threshold", () => {
    const items = learnedCrewSuggestions(comparables, new Set(), 0.9); // needs 90%+, weighted frequency is 80%
    expect(items).toHaveLength(0);
  });

  it("does not let a loosely-related comparable's absence drag down a strong pattern", () => {
    // Four near-perfect matches all staff 4 breakout techs; one barely-related show (e.g.
    // a event with no breakout rooms at all) has none. A flat average across 5 events would
    // pull the typical quantity down to (4*4+0)/5 = 3.2 -> 3, understaffing every real match.
    const strongMatches: ComparableWithCrew[] = Array.from({ length: 4 }, (_, i) => ({
      historicalEventId: `strong-${i}`,
      similarity: 0.9,
      crew: [{ positionId: "pos-breakout", positionName: "Breakout Technician", quantity: 4 }],
    }));
    const weakOutlier: ComparableWithCrew = { historicalEventId: "weak", similarity: 0.05, crew: [] };

    const items = learnedCrewSuggestions([...strongMatches, weakOutlier], new Set(), 0.5);
    const breakout = items.find((i) => i.positionId === "pos-breakout");
    expect(breakout?.quantity).toBe(4);
  });
});

describe("buildCrewPlan", () => {
  it("merges hard rules and learned suggestions without double-counting a position", () => {
    const profile = emptyProfile({ numSimultaneousBreakoutRooms: 4 });
    const comparables: ComparableWithCrew[] = [
      {
        historicalEventId: "e1",
        similarity: 0.9,
        crew: [
          { positionId: "pos-breakout-tech", positionName: "Breakout Technician", quantity: 99 }, // hard rule should win, not this
          { positionId: "pos-v1", positionName: "V1", quantity: 1 },
        ],
      },
      {
        historicalEventId: "e2",
        similarity: 0.8,
        crew: [
          { positionId: "pos-breakout-tech", positionName: "Breakout Technician", quantity: 99 },
          { positionId: "pos-v1", positionName: "V1", quantity: 1 },
        ],
      },
    ];

    const plan = buildCrewPlan(profile, [breakoutRule], comparables, 0.5);
    const breakoutItem = plan.find((i) => i.positionId === "pos-breakout-tech");
    const v1Item = plan.find((i) => i.positionId === "pos-v1");

    expect(breakoutItem?.source).toBe("HARD_RULE");
    expect(breakoutItem?.quantity).toBe(2); // ceiling(4/2), not the bogus historical 99
    expect(v1Item?.source).toBe("LEARNED_PATTERN");
  });
});

describe("computeGlobalPattern", () => {
  it("returns null when the sample size is too small to mean anything", () => {
    const events = [1, 2, 3].map((i) => ({
      id: `e${i}`,
      profile: emptyProfile({ ledSizeSqft: 300, cameraCount: 3 }),
      crewPositionIds: new Set(["pos-v1"]),
    }));
    const result = computeGlobalPattern(
      { positionId: "pos-v1", positionName: "V1", conditionText: "LED + multi-camera", matchesCondition: (p) => (p.ledSizeSqft ?? 0) > 0 && (p.cameraCount ?? 0) >= 2 },
      events,
    );
    expect(result).toBeNull();
  });

  it("computes confidence from how often the position appears among matching events", () => {
    const matching = Array.from({ length: 24 }, (_, i) => ({
      id: `m${i}`,
      profile: emptyProfile({ ledSizeSqft: 300, cameraCount: 3 }),
      crewPositionIds: i < 21 ? new Set(["pos-v1"]) : new Set<string>(),
    }));
    const nonMatching = [{ id: "n1", profile: emptyProfile({ ledSizeSqft: 0, cameraCount: 0 }), crewPositionIds: new Set(["pos-v1"]) }];

    const result = computeGlobalPattern(
      {
        positionId: "pos-v1",
        positionName: "V1",
        conditionText: "LED + multi-camera",
        matchesCondition: (p) => (p.ledSizeSqft ?? 0) > 0 && (p.cameraCount ?? 0) >= 2,
      },
      [...matching, ...nonMatching],
    );

    expect(result).not.toBeNull();
    expect(result?.sampleSize).toBe(24);
    expect(result?.matchCount).toBe(21);
    expect(result?.confidenceLevel).toBe("HIGH");
  });
});
