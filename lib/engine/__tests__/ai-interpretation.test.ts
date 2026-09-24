import { describe, expect, it } from "vitest";
import { getAiInterpreter } from "../ai-interpretation";

describe("HeuristicAiInterpreter", () => {
  it("detects department hints from free text", async () => {
    const interpreter = getAiInterpreter();
    const result = await interpreter.interpretFreeText("Client wants an LED wall and IMAG with rigging for a truss.");
    const departments = result.departmentHints.map((h) => h.department);
    expect(departments).toContain("LED");
    expect(departments).toContain("VIDEO");
    expect(departments).toContain("RIGGING");
  });

  it("detects flags like union labor", async () => {
    const interpreter = getAiInterpreter();
    const result = await interpreter.interpretFreeText("This is a union house, same-day turn.");
    expect(result.flags).toContain("Mentions union labor");
    expect(result.flags).toContain("Mentions a same-day or quick-turn schedule");
  });

  it("returns nothing for empty text", async () => {
    const interpreter = getAiInterpreter();
    const result = await interpreter.interpretFreeText("");
    expect(result.departmentHints).toHaveLength(0);
    expect(result.flags).toHaveLength(0);
  });
});
