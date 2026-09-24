import { describe, expect, it } from "vitest";
import { computeConfidence } from "../confidence-engine";

describe("computeConfidence", () => {
  it("never reports HIGH when key inputs are missing, even with many comparables", () => {
    const result = computeConfidence({
      comparableCount: 20,
      averageSimilarity: 0.9,
      assumptionCount: 8,
      venueKnown: false,
      scheduleKnown: false,
      equipmentKnown: false,
      travelKnown: false,
      unverifiedComparableShare: 0,
    });
    expect(result.level).not.toBe("HIGH");
  });

  it("reports HIGH when comparables are plentiful, similar, and inputs are known", () => {
    const result = computeConfidence({
      comparableCount: 15,
      averageSimilarity: 0.95,
      assumptionCount: 0,
      venueKnown: true,
      scheduleKnown: true,
      equipmentKnown: true,
      travelKnown: true,
      unverifiedComparableShare: 0,
    });
    expect(result.level).toBe("HIGH");
  });

  it("reports LOW when there are almost no comparables", () => {
    const result = computeConfidence({
      comparableCount: 1,
      averageSimilarity: 0.3,
      assumptionCount: 6,
      venueKnown: false,
      scheduleKnown: false,
      equipmentKnown: false,
      travelKnown: false,
      unverifiedComparableShare: 0.5,
    });
    expect(result.level).toBe("LOW");
  });

  it("keeps the score within 0-100", () => {
    const result = computeConfidence({
      comparableCount: 0,
      averageSimilarity: 0,
      assumptionCount: 50,
      venueKnown: false,
      scheduleKnown: false,
      equipmentKnown: false,
      travelKnown: false,
      unverifiedComparableShare: 1,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("penalizes more assumptions with a lower score, all else equal", () => {
    const base = {
      comparableCount: 6,
      averageSimilarity: 0.6,
      venueKnown: true,
      scheduleKnown: true,
      equipmentKnown: true,
      travelKnown: true,
      unverifiedComparableShare: 0,
    };
    const fewAssumptions = computeConfidence({ ...base, assumptionCount: 0 });
    const manyAssumptions = computeConfidence({ ...base, assumptionCount: 10 });
    expect(manyAssumptions.score).toBeLessThan(fewAssumptions.score);
  });
});
