import type { ConfidenceLevel } from "./types";
import type { RankedComparable } from "./comparable-engine";

export interface ConfidenceInputs {
  comparableCount: number;
  averageSimilarity: number; // 0-1, over the comparables actually used
  assumptionCount: number;
  venueKnown: boolean;
  scheduleKnown: boolean; // setup/show/strike days present
  equipmentKnown: boolean; // at least one department has a non-NONE complexity
  travelKnown: boolean; // city/state present
  unverifiedComparableShare: number; // 0-1, fraction of comparables that are IMPORTED_UNVERIFIED
}

export interface ConfidenceFactor {
  label: string;
  points: number; // signed contribution out of the 100-point scale
  detail: string;
}

export interface ConfidenceResult {
  score: number; // 0-100
  level: ConfidenceLevel;
  factors: ConfidenceFactor[];
}

/**
 * Confidence is never allowed to read as "high" when important information
 * is missing — see the project brief's Confidence System section. Each
 * factor below is capped so no single strong signal (e.g. lots of
 * comparables) can paper over missing inputs (e.g. unknown venue/schedule).
 */
export function computeConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const factors: ConfidenceFactor[] = [];

  const comparablePoints = Math.round(Math.min(inputs.comparableCount / 15, 1) * 28);
  factors.push({
    label: "Comparable events",
    points: comparablePoints,
    detail: `${inputs.comparableCount} comparable historical event${inputs.comparableCount === 1 ? "" : "s"} found.`,
  });

  const similarityPoints = Math.round(inputs.averageSimilarity * 27);
  factors.push({
    label: "Similarity quality",
    points: similarityPoints,
    detail: `Average similarity of comparables used: ${Math.round(inputs.averageSimilarity * 100)}%.`,
  });

  const knownFlags = [inputs.venueKnown, inputs.scheduleKnown, inputs.equipmentKnown, inputs.travelKnown];
  const knownCount = knownFlags.filter(Boolean).length;
  const knownPoints = Math.round((knownCount / knownFlags.length) * 25);
  factors.push({
    label: "Known inputs",
    points: knownPoints,
    detail: `${knownCount}/4 of venue, schedule, equipment requirements, and travel are known (not assumed).`,
  });

  const assumptionPenalty = -Math.min(inputs.assumptionCount * 2, 20);
  factors.push({
    label: "Assumptions made",
    points: assumptionPenalty,
    detail: `${inputs.assumptionCount} assumption${inputs.assumptionCount === 1 ? "" : "s"} were required to fill gaps.`,
  });

  const dataQualityPenalty = -Math.round(inputs.unverifiedComparableShare * 10);
  factors.push({
    label: "Historical data quality",
    points: dataQualityPenalty,
    detail:
      inputs.unverifiedComparableShare > 0
        ? `${Math.round(inputs.unverifiedComparableShare * 100)}% of comparables are unverified imports.`
        : "All comparables are verified historical records.",
  });

  const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  let level: ConfidenceLevel;
  if (score >= 70 && inputs.comparableCount >= 5 && knownCount >= 3) {
    level = "HIGH";
  } else if (score >= 40 && inputs.comparableCount >= 2) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  return { score, level, factors };
}

/** Convenience: derive averageSimilarity + unverifiedComparableShare from ranked comparables. */
export function summarizeComparables<T extends { dataQuality: string }>(
  ranked: RankedComparable<T>[],
): { averageSimilarity: number; unverifiedComparableShare: number } {
  if (ranked.length === 0) return { averageSimilarity: 0, unverifiedComparableShare: 0 };
  const averageSimilarity = ranked.reduce((sum, r) => sum + r.similarity.score, 0) / ranked.length;
  const unverifiedComparableShare =
    ranked.filter((r) => r.event.dataQuality === "IMPORTED_UNVERIFIED").length / ranked.length;
  return { averageSimilarity, unverifiedComparableShare };
}
