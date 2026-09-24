import type { CrewRuleDsl, EventProfile } from "./types";

/**
 * Evaluates a CrewRule's JSON DSL against an event profile. Deterministic,
 * no `eval`: rules stay data (editable in Admin) rather than code. Returns
 * null if the rule's required input field is missing, so callers can fall
 * back to a learned pattern or flag the position for manual review instead
 * of silently producing a zero.
 */
export function evaluateCrewRule(rule: CrewRuleDsl, profile: EventProfile): number | null {
  switch (rule.type) {
    case "fixed":
      return rule.quantity;

    case "ratio_ceiling": {
      const value = readField(profile, rule.inputField);
      if (value === null || value === undefined) return null;
      const quantity = Math.ceil(value / rule.divisor);
      return Math.max(quantity, rule.minimum ?? 0);
    }

    case "threshold_table": {
      const value = readField(profile, rule.inputField);
      if (value === null || value === undefined) return null;
      const sorted = [...rule.thresholds].sort((a, b) => a.max - b.max);
      const match = sorted.find((t) => value <= t.max);
      return match ? match.quantity : rule.aboveMaxQuantity;
    }

    default:
      return null;
  }
}

function readField(profile: EventProfile, field: string): number | null {
  const value = (profile as unknown as Record<string, unknown>)[field];
  return typeof value === "number" ? value : null;
}

/** Renders a short, human-readable explanation of how a rule produced its number. */
export function explainCrewRule(rule: CrewRuleDsl, profile: EventProfile, result: number): string {
  switch (rule.type) {
    case "fixed":
      return `Fixed staffing of ${result}.`;
    case "ratio_ceiling": {
      const value = readField(profile, rule.inputField);
      return `${value} / ${rule.divisor} rounded up = ${result}.`;
    }
    case "threshold_table": {
      const value = readField(profile, rule.inputField);
      return `${rule.inputField} = ${value} falls into the ${result}-person tier.`;
    }
    default:
      return `Result: ${result}.`;
  }
}
