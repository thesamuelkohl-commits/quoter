import { describe, expect, it } from "vitest";
import { buildEngagementDates, countWeekendDays, isWeekend } from "../schedule-dates";

describe("buildEngagementDates", () => {
  it("lays out setup/rehearsal days before the show start date and strike days after", () => {
    // Show starts Friday 2026-10-02 (a Friday). 1 setup day, 0 rehearsal, 2 show days, 1 strike day.
    const dates = buildEngagementDates(new Date("2026-10-02T00:00:00Z"), {
      setupDays: 1,
      rehearsalDays: 0,
      showDays: 2,
      strikeDays: 1,
    });
    const iso = dates.map((d) => d.toISOString().slice(0, 10));
    expect(iso).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  });

  it("returns the right total day count", () => {
    const dates = buildEngagementDates(new Date("2026-06-15T00:00:00Z"), {
      setupDays: 2,
      rehearsalDays: 1,
      showDays: 3,
      strikeDays: 2,
    });
    expect(dates).toHaveLength(8);
  });
});

describe("isWeekend / countWeekendDays", () => {
  it("identifies Saturday and Sunday as weekend days", () => {
    expect(isWeekend(new Date("2026-10-03T00:00:00Z"))).toBe(true); // Saturday
    expect(isWeekend(new Date("2026-10-04T00:00:00Z"))).toBe(true); // Sunday
    expect(isWeekend(new Date("2026-10-02T00:00:00Z"))).toBe(false); // Friday
  });

  it("counts weekend days across a date range", () => {
    const dates = buildEngagementDates(new Date("2026-10-02T00:00:00Z"), {
      setupDays: 1,
      rehearsalDays: 0,
      showDays: 2,
      strikeDays: 1,
    });
    // Oct 1 (Thu), 2 (Fri), 3 (Sat), 4 (Sun) -> 2 weekend days
    expect(countWeekendDays(dates)).toBe(2);
  });
});
