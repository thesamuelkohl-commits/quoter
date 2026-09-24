import { describe, expect, it } from "vitest";
import {
  computeEquipmentLineItems,
  computeCrewCost,
  scheduleGeneratesOvertime,
  blendPriceRange,
  sumLineItems,
  departmentSubtotals,
  weightedAverage,
  dayRateMultiplier,
  gearRentalTierMultiplier,
  HOLIDAY_SURCHARGE_RATE,
  WEEKEND_STAGEHAND_SURCHARGE_RATE,
  type ScheduleDays,
} from "../pricing-engine";
import type { CrewPlanItem } from "../crew-engine";

describe("weightedAverage", () => {
  it("lets a strong match dominate over a weak, loosely-related one", () => {
    // A near-perfect match ($50k) alongside a barely-related show ($10k) should land
    // close to $50k, not the flat-average midpoint of $30k.
    const result = weightedAverage([
      { value: 50000, weight: 0.9 },
      { value: 10000, weight: 0.15 },
    ]);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(40000);
  });

  it("returns null when there is nothing to average", () => {
    expect(weightedAverage([])).toBeNull();
  });

  it("matches a simple average when all weights are equal", () => {
    const result = weightedAverage([
      { value: 100, weight: 1 },
      { value: 200, weight: 1 },
    ]);
    expect(result).toBe(150);
  });
});

describe("computeEquipmentLineItems", () => {
  it("prices each package item at quantity x sell rate", () => {
    const lineItems = computeEquipmentLineItems([
      {
        department: "AUDIO",
        complexityLevel: "MEDIUM",
        packageId: "pkg-1",
        packageName: "Audio: Medium",
        items: [
          { equipmentItemId: "eq-1", name: "Digital Console", category: "Console", department: "AUDIO", quantity: 1, sellRate: 1200 },
          { equipmentItemId: "eq-2", name: "Wireless Mic", category: "Microphone", department: "AUDIO", quantity: 4, sellRate: 150 },
        ],
      },
    ]);

    expect(lineItems).toHaveLength(2);
    expect(lineItems[0].extendedPrice).toBe(1200);
    expect(lineItems[1].extendedPrice).toBe(600);
    expect(sumLineItems(lineItems)).toBe(1800);
  });

  it("groups subtotals by department", () => {
    const lineItems = computeEquipmentLineItems([
      { department: "AUDIO", complexityLevel: "SMALL", packageId: "p1", packageName: "a", items: [{ equipmentItemId: "e1", name: "n", category: "c", department: "AUDIO", quantity: 1, sellRate: 100 }] },
      { department: "VIDEO", complexityLevel: "SMALL", packageId: "p2", packageName: "b", items: [{ equipmentItemId: "e2", name: "n", category: "c", department: "VIDEO", quantity: 1, sellRate: 250 }] },
    ]);
    expect(departmentSubtotals(lineItems)).toEqual({ AUDIO: 100, VIDEO: 250 });
  });

  it("scales rental-gear departments by the rental tier multiplier", () => {
    const lineItems = computeEquipmentLineItems(
      [{ department: "AUDIO", complexityLevel: "SMALL", packageId: "p1", packageName: "a", items: [{ equipmentItemId: "e1", name: "n", category: "c", department: "AUDIO", quantity: 2, sellRate: 100 }] }],
      3,
    );
    expect(lineItems[0].unitPrice).toBe(300);
    expect(lineItems[0].extendedPrice).toBe(600);
  });

  it("does not scale Trucking/Travel by the rental tier multiplier", () => {
    const lineItems = computeEquipmentLineItems(
      [
        { department: "TRUCKING", complexityLevel: "SMALL", packageId: "p1", packageName: "a", items: [{ equipmentItemId: "e1", name: "n", category: "c", department: "TRUCKING", quantity: 1, sellRate: 500 }] },
        { department: "TRAVEL", complexityLevel: "SMALL", packageId: "p2", packageName: "b", items: [{ equipmentItemId: "e2", name: "n", category: "c", department: "TRAVEL", quantity: 1, sellRate: 200 }] },
      ],
      4,
    );
    expect(lineItems[0].extendedPrice).toBe(500);
    expect(lineItems[1].extendedPrice).toBe(200);
  });
});

describe("gearRentalTierMultiplier", () => {
  it("returns 1x for a single day", () => {
    expect(gearRentalTierMultiplier(1)).toBe(1);
  });
  it("returns 2x for 2-7 days", () => {
    expect(gearRentalTierMultiplier(2)).toBe(2);
    expect(gearRentalTierMultiplier(7)).toBe(2);
  });
  it("returns 3x for 8-13 days", () => {
    expect(gearRentalTierMultiplier(8)).toBe(3);
    expect(gearRentalTierMultiplier(13)).toBe(3);
  });
  it("returns 4x for 14+ days", () => {
    expect(gearRentalTierMultiplier(14)).toBe(4);
    expect(gearRentalTierMultiplier(30)).toBe(4);
  });
});

describe("dayRateMultiplier", () => {
  it("is 1x at or under 12 hours", () => {
    expect(dayRateMultiplier(12)).toBe(1);
    expect(dayRateMultiplier(8)).toBe(1);
  });
  it("is 1.25x between 12 and 14 hours", () => {
    expect(dayRateMultiplier(13)).toBe(1.25);
    expect(dayRateMultiplier(14)).toBe(1.25);
  });
  it("is 1.5x between 14 and 16 hours", () => {
    expect(dayRateMultiplier(15)).toBe(1.5);
    expect(dayRateMultiplier(16)).toBe(1.5);
  });
  it("is clamped at the 16-hour cap", () => {
    expect(dayRateMultiplier(20)).toBe(1.5);
  });
});

const baseCrewItem: CrewPlanItem = {
  positionId: "pos-a1",
  positionName: "A1",
  quantity: 1,
  source: "HARD_RULE",
  explanation: "test",
};

function schedule(overrides: Partial<ScheduleDays> = {}): ScheduleDays {
  return {
    setupDays: 0,
    rehearsalDays: 0,
    showDays: 1,
    strikeDays: 0,
    hoursPerDay: 12,
    travelRequired: false,
    weekendDayCount: 0,
    isHoliday: false,
    ...overrides,
  };
}

describe("computeCrewCost", () => {
  it("prices a day-rate position across setup/show/strike days with no overtime at 12hr days", () => {
    const result = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 800, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ setupDays: 1, showDays: 2, strikeDays: 1 }),
    );
    expect(result.days).toBe(4);
    expect(result.overtimeHours).toBe(0);
    expect(result.totalCost).toBe(4 * 800);
  });

  it("bills the day-rate tier multiplier when the daily schedule exceeds 12 hours", () => {
    const result = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 1200, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ showDays: 2, hoursPerDay: 16 }),
    );
    // 4 overtime hours/show day x 2 show days = 8 OT hours (informational)
    expect(result.overtimeHours).toBe(8);
    // 14-16hr day -> 1.5x tier multiplier (repurposed overtimeRate field)
    expect(result.overtimeRate).toBe(1.5);
    // base 2 x 1200 = 2400, tier premium 2 x 1200 x 0.5 = 1200
    expect(result.totalCost).toBe(3600);
  });

  it("bills the 1.25x tier for a 12-14 hour day", () => {
    const result = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 1000, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ showDays: 1, hoursPerDay: 13 }),
    );
    expect(result.overtimeRate).toBe(1.25);
    expect(result.totalCost).toBe(1250);
  });

  it("clamps at the 16-hour cap for both DAY and HOURLY positions", () => {
    const dayResult = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 1000, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ showDays: 1, hoursPerDay: 20 }),
    );
    expect(dayResult.overtimeHours).toBe(4); // clamped to 16 - 12
    expect(dayResult.totalCost).toBe(1500); // still just the 1.5x tier, not higher

    const stagehand: CrewPlanItem = { ...baseCrewItem, positionName: "Stagehand" };
    const hourlyResult = computeCrewCost(
      stagehand,
      { rateType: "HOURLY", standardRate: 45, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ showDays: 1, hoursPerDay: 20 }),
    );
    // day-equivalent rate = 45 x 12 = 540; 1.5x tier -> 810
    expect(hourlyResult.totalCost).toBe(810);
  });

  it("multiplies by crew quantity", () => {
    const result = computeCrewCost(
      { ...baseCrewItem, quantity: 3 },
      { rateType: "DAY", standardRate: 500, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule(),
    );
    expect(result.totalCost).toBe(3 * 500);
  });

  it("charges a half-day rate each way for a travel gig, on top of the working days", () => {
    const result = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 800, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ setupDays: 1, showDays: 1, strikeDays: 1, travelRequired: true }),
    );
    // 3 working days at day rate + one day-rate-equivalent of travel (half there + half home)
    expect(result.travelCost).toBe(800);
    expect(result.totalCost).toBe(3 * 800 + 800);
  });

  it("does not charge travel when it's an in-town gig", () => {
    const result = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 800, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ setupDays: 1, showDays: 1, strikeDays: 1 }),
    );
    expect(result.travelCost).toBe(0);
  });

  it("scales travel cost by crew quantity", () => {
    const result = computeCrewCost(
      { ...baseCrewItem, quantity: 4 },
      { rateType: "DAY", standardRate: 500, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ travelRequired: true }),
    );
    expect(result.travelCost).toBe(4 * 500);
    expect(result.totalCost).toBe(4 * (500 + 500));
  });

  it("adds a flat 10% holiday surcharge to crew cost when checked", () => {
    const result = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 1000, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ isHoliday: true }),
    );
    expect(result.holidaySurcharge).toBeCloseTo(1000 * HOLIDAY_SURCHARGE_RATE);
    expect(result.totalCost).toBeCloseTo(1000 * (1 + HOLIDAY_SURCHARGE_RATE));
  });

  it("does not apply a holiday surcharge to travel pay", () => {
    const result = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 1000, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ isHoliday: true, travelRequired: true }),
    );
    // base 1000 + 10% holiday (100) + travel 1000 (not surcharged) = 2100
    expect(result.totalCost).toBeCloseTo(2100);
  });

  it("applies the weekend premium only to the Stagehand position", () => {
    const stagehand: CrewPlanItem = { ...baseCrewItem, positionName: "Stagehand" };
    const result = computeCrewCost(
      stagehand,
      { rateType: "DAY", standardRate: 1000, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ showDays: 2, weekendDayCount: 1 }),
    );
    // half of the 2 working days are a weekend day -> 25% premium on half of base pay
    expect(result.weekendSurcharge).toBeCloseTo(2000 * 0.5 * WEEKEND_STAGEHAND_SURCHARGE_RATE);

    const other = computeCrewCost(
      baseCrewItem,
      { rateType: "DAY", standardRate: 1000, overtimeMultiplier: 1.5, minimumCallHours: 8 },
      schedule({ showDays: 2, weekendDayCount: 1 }),
    );
    expect(other.weekendSurcharge).toBe(0);
  });
});

describe("scheduleGeneratesOvertime", () => {
  it("is true when show days exist and hours exceed 12/day", () => {
    expect(scheduleGeneratesOvertime(schedule({ hoursPerDay: 14 }))).toBe(true);
  });
  it("is false at exactly 12 hours/day", () => {
    expect(scheduleGeneratesOvertime(schedule({ hoursPerDay: 12 }))).toBe(false);
  });
});

describe("blendPriceRange", () => {
  it("uses the baseline alone when there are no comparables", () => {
    const range = blendPriceRange(50000, null, 0, "LOW");
    expect(range.mostLikelyPrice).toBe(50000);
  });

  it("pulls the estimate toward the comparable average as comparable count grows", () => {
    const fewComparables = blendPriceRange(50000, 70000, 1, "MEDIUM");
    const manyComparables = blendPriceRange(50000, 70000, 10, "MEDIUM");
    expect(manyComparables.mostLikelyPrice).toBeGreaterThan(fewComparables.mostLikelyPrice);
  });

  it("produces a wider range for lower confidence", () => {
    const high = blendPriceRange(50000, null, 0, "HIGH");
    const low = blendPriceRange(50000, null, 0, "LOW");
    expect(low.highPrice - low.lowPrice).toBeGreaterThan(high.highPrice - high.lowPrice);
  });
});
