import { describe, expect, it } from "vitest";
import { evaluateCrewRule, explainCrewRule } from "../rules-engine";
import type { CrewRuleDsl, EventProfile } from "../types";
import { emptyProfile } from "./fixtures";

function profileWith(numSimultaneousBreakoutRooms: number | null): EventProfile {
  return emptyProfile({ numSimultaneousBreakoutRooms });
}

const breakoutTechRule: CrewRuleDsl = {
  type: "ratio_ceiling",
  inputField: "numSimultaneousBreakoutRooms",
  divisor: 2,
};

describe("breakout technician rule: ceiling(simultaneous_breakout_rooms / 2)", () => {
  const cases: [number, number][] = [
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 4],
    [8, 4],
    [9, 5],
    [10, 5],
  ];

  it.each(cases)("%i simultaneous rooms -> %i breakout techs", (rooms, expected) => {
    expect(evaluateCrewRule(breakoutTechRule, profileWith(rooms))).toBe(expected);
  });

  it("returns null when the input field is missing, instead of guessing", () => {
    expect(evaluateCrewRule(breakoutTechRule, profileWith(null))).toBeNull();
  });

  it("explains the calculation in plain English", () => {
    const explanation = explainCrewRule(breakoutTechRule, profileWith(8), 4);
    expect(explanation).toContain("8 / 2");
    expect(explanation).toContain("4");
  });
});

describe("fixed rule", () => {
  it("always returns its fixed quantity", () => {
    expect(evaluateCrewRule({ type: "fixed", quantity: 1 }, profileWith(null))).toBe(1);
  });
});

describe("threshold_table rule", () => {
  const rule: CrewRuleDsl = {
    type: "threshold_table",
    inputField: "attendees",
    thresholds: [
      { max: 200, quantity: 1 },
      { max: 800, quantity: 2 },
    ],
    aboveMaxQuantity: 3,
  };

  it("picks the matching tier", () => {
    expect(evaluateCrewRule(rule, { ...profileWith(null), attendees: 150 })).toBe(1);
    expect(evaluateCrewRule(rule, { ...profileWith(null), attendees: 500 })).toBe(2);
  });

  it("falls back to aboveMaxQuantity beyond the highest tier", () => {
    expect(evaluateCrewRule(rule, { ...profileWith(null), attendees: 5000 })).toBe(3);
  });
});
