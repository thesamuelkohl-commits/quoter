import { evaluateCrewRule, explainCrewRule } from "./rules-engine";
import type { CrewRuleDsl, EventProfile } from "./types";

export interface CrewRuleInput {
  id: string;
  positionId: string;
  positionName: string;
  name: string;
  ruleDsl: CrewRuleDsl;
  priority: number;
  active: boolean;
}

export interface HistoricalCrewRow {
  positionId: string;
  positionName: string;
  quantity: number;
}

export interface ComparableWithCrew {
  historicalEventId: string;
  similarity: number;
  crew: HistoricalCrewRow[];
}

export type CrewPlanSource = "HARD_RULE" | "LEARNED_PATTERN" | "UNSTAFFED";

export interface CrewPlanItem {
  positionId: string;
  positionName: string;
  quantity: number;
  source: CrewPlanSource;
  ruleId?: string;
  explanation: string;
  confidenceLevel?: "HIGH" | "MEDIUM" | "LOW";
  confidenceDetail?: string;
}

/** Hard OTL rules take priority over everything else — applies the highest-priority active rule per position. */
export function applyHardRules(profile: EventProfile, rules: CrewRuleInput[]): CrewPlanItem[] {
  const byPosition = new Map<string, CrewRuleInput[]>();
  for (const rule of rules.filter((r) => r.active)) {
    const list = byPosition.get(rule.positionId) ?? [];
    list.push(rule);
    byPosition.set(rule.positionId, list);
  }

  const items: CrewPlanItem[] = [];
  for (const [positionId, positionRules] of byPosition) {
    const sorted = [...positionRules].sort((a, b) => b.priority - a.priority);
    for (const rule of sorted) {
      const quantity = evaluateCrewRule(rule.ruleDsl, profile);
      if (quantity === null || quantity <= 0) continue;
      items.push({
        positionId,
        positionName: rule.positionName,
        quantity,
        source: "HARD_RULE",
        ruleId: rule.id,
        explanation: `${rule.name}: ${explainCrewRule(rule.ruleDsl, profile, quantity)}`,
      });
      break; // highest-priority applicable rule wins for this position
    }
  }
  return items;
}

/**
 * Learned recommendations, never auto-promoted to rules. Looks at how often
 * a position shows up among this estimate's comparable historical events and
 * at what typical quantity, per the brief's
 * "21 of 24 comparable events used a dedicated V1" example.
 *
 * Every comparable's contribution is weighted by its similarity score, not
 * counted flatly. Without this, a loosely-related historical event (e.g. one
 * with zero breakout rooms, or missing the department in question entirely)
 * would pull the "typical quantity" and "how often" numbers down just as
 * hard as a near-perfect match — exactly the failure mode where an unrelated
 * show's zeros quietly drag down an otherwise-solid estimate.
 */
export function learnedCrewSuggestions(
  comparables: ComparableWithCrew[],
  excludePositionIds: Set<string>,
  minFrequency = 0.5,
): CrewPlanItem[] {
  if (comparables.length === 0) return [];

  const totalWeight = comparables.reduce((sum, c) => sum + c.similarity, 0);
  if (totalWeight <= 0) return [];

  const byPosition = new Map<string, { positionName: string; weightedQuantity: number; matchedWeight: number; matchCount: number }>();
  for (const comparable of comparables) {
    const seenThisEvent = new Set<string>();
    for (const row of comparable.crew) {
      if (seenThisEvent.has(row.positionId)) continue; // one data point per event per position
      seenThisEvent.add(row.positionId);
      const entry = byPosition.get(row.positionId) ?? { positionName: row.positionName, weightedQuantity: 0, matchedWeight: 0, matchCount: 0 };
      entry.weightedQuantity += row.quantity * comparable.similarity;
      entry.matchedWeight += comparable.similarity;
      entry.matchCount += 1;
      byPosition.set(row.positionId, entry);
    }
  }

  const items: CrewPlanItem[] = [];
  for (const [positionId, { positionName, weightedQuantity, matchedWeight, matchCount }] of byPosition) {
    if (excludePositionIds.has(positionId)) continue;
    const frequency = matchedWeight / totalWeight;
    if (frequency < minFrequency) continue;

    const avgQuantity = weightedQuantity / matchedWeight;
    const quantity = Math.max(1, Math.round(avgQuantity));
    const confidenceLevel = frequency >= 0.85 ? "HIGH" : frequency >= 0.65 ? "MEDIUM" : "LOW";

    items.push({
      positionId,
      positionName,
      quantity,
      source: "LEARNED_PATTERN",
      explanation: `${matchCount} of ${comparables.length} comparable events used ${positionName} (${Math.round(frequency * 100)}% similarity-weighted), typically ${quantity}.`,
      confidenceLevel,
      confidenceDetail: `Based on ${matchCount}/${comparables.length} comparable historical events, weighted by how similar each one is.`,
    });
  }
  return items;
}

/** Hard rules first, then learned suggestions fill in any position the hard rules didn't cover. */
export function buildCrewPlan(
  profile: EventProfile,
  hardRules: CrewRuleInput[],
  comparables: ComparableWithCrew[],
  minLearnedFrequency = 0.5,
): CrewPlanItem[] {
  const hardRuleItems = applyHardRules(profile, hardRules);
  const covered = new Set(hardRuleItems.map((i) => i.positionId));
  const learnedItems = learnedCrewSuggestions(comparables, covered, minLearnedFrequency);
  return [...hardRuleItems, ...learnedItems];
}

// ---------------------------------------------------------------------------
// Global pattern mining (for the Insights admin page)
// ---------------------------------------------------------------------------

export interface GlobalPatternInput {
  positionId: string;
  positionName: string;
  conditionText: string;
  /** Returns true if this historical event matches the condition being tested (e.g. "LED + IMAG + 2+ cameras"). */
  matchesCondition: (profile: EventProfile) => boolean;
}

export interface HistoricalEventForPatternMining {
  id: string;
  profile: EventProfile;
  crewPositionIds: Set<string>;
}

export interface GlobalPatternResult {
  positionId: string;
  positionName: string;
  conditionText: string;
  sampleSize: number;
  matchCount: number;
  confidenceScore: number; // 0-1
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Computes, across ALL historical events matching a condition, how often a
 * position was staffed. This never writes a CrewRule directly — it's
 * surfaced in Insights for an admin to review and explicitly approve.
 */
export function computeGlobalPattern(
  input: GlobalPatternInput,
  events: HistoricalEventForPatternMining[],
): GlobalPatternResult | null {
  const matching = events.filter((e) => input.matchesCondition(e.profile));
  const sampleSize = matching.length;
  if (sampleSize < 5) return null; // too few data points to say anything meaningful

  const matchCount = matching.filter((e) => e.crewPositionIds.has(input.positionId)).length;
  const confidenceScore = matchCount / sampleSize;
  const confidenceLevel = confidenceScore >= 0.85 ? "HIGH" : confidenceScore >= 0.6 ? "MEDIUM" : "LOW";

  return {
    positionId: input.positionId,
    positionName: input.positionName,
    conditionText: input.conditionText,
    sampleSize,
    matchCount,
    confidenceScore,
    confidenceLevel,
  };
}
