import { COMPLEXITY_LEVELS, type ComplexityLevel, type EventProfile } from "./types";

/**
 * Default similarity weights. Deliberately kept as a plain exported object
 * (not buried in logic) so this is the first thing to move into an
 * admin-editable `AppSetting` row once there's real data to tune against —
 * see the "Known Trade-offs" section of the project plan.
 */
export const DEFAULT_SIMILARITY_WEIGHTS = {
  eventType: 12,
  attendees: 12,
  roomSqft: 8,
  numGeneralSessionRooms: 4,
  numBreakoutRooms: 6,
  numSimultaneousBreakoutRooms: 6,
  showDays: 6,
  setupDays: 4,
  ledSizeSqft: 6,
  projectionUsed: 3,
  cameraCount: 6,
  audioComplexity: 7,
  videoComplexity: 7,
  ledComplexity: 6,
  lightingComplexity: 6,
  scenicComplexity: 4,
  location: 5,
  unionLabor: 2,
  travelRequired: 4,
} as const;

export type SimilarityWeights = typeof DEFAULT_SIMILARITY_WEIGHTS;

/** Reasonable "typical variation" scale per numeric field, used to normalize distance into a 0-1 similarity. */
const NUMERIC_SCALES: Partial<Record<keyof EventProfile, number>> = {
  attendees: 600,
  roomSqft: 15000,
  numGeneralSessionRooms: 3,
  numBreakoutRooms: 8,
  numSimultaneousBreakoutRooms: 6,
  showDays: 3,
  setupDays: 2,
  ledSizeSqft: 400,
  cameraCount: 4,
};

const COMPLEXITY_FIELDS = [
  "audioComplexity",
  "videoComplexity",
  "ledComplexity",
  "lightingComplexity",
  "scenicComplexity",
] as const;

export interface SimilarityBreakdown {
  field: string;
  weight: number;
  similarity: number | null; // null = skipped, missing data on one side
}

export interface SimilarityResult {
  score: number; // 0-1, weighted average over fields that had data on both sides
  breakdown: SimilarityBreakdown[];
  comparableFieldCount: number;
}

export function scoreSimilarity(
  target: EventProfile,
  candidate: EventProfile,
  weights: SimilarityWeights = DEFAULT_SIMILARITY_WEIGHTS,
): SimilarityResult {
  const breakdown: SimilarityBreakdown[] = [];

  breakdown.push({
    field: "eventType",
    weight: weights.eventType,
    similarity: categoricalSimilarity(target.eventType, candidate.eventType),
  });

  breakdown.push({
    field: "location",
    weight: weights.location,
    similarity: locationSimilarity(target, candidate),
  });

  breakdown.push({
    field: "projectionUsed",
    weight: weights.projectionUsed,
    similarity: booleanSimilarity(target.projectionUsed, candidate.projectionUsed),
  });

  breakdown.push({
    field: "unionLabor",
    weight: weights.unionLabor,
    similarity: booleanSimilarity(target.unionLabor, candidate.unionLabor),
  });

  breakdown.push({
    field: "travelRequired",
    weight: weights.travelRequired,
    similarity: booleanSimilarity(target.travelRequired, candidate.travelRequired),
  });

  for (const field of COMPLEXITY_FIELDS) {
    breakdown.push({
      field,
      weight: weights[field],
      similarity: complexitySimilarity(target[field], candidate[field]),
    });
  }

  for (const [field, scale] of Object.entries(NUMERIC_SCALES) as [keyof EventProfile, number][]) {
    const weight = (weights as Record<string, number>)[field];
    if (weight === undefined) continue;
    breakdown.push({
      field,
      weight,
      similarity: numericSimilarity(target[field] as number | null, candidate[field] as number | null, scale),
    });
  }

  const usable = breakdown.filter((b) => b.similarity !== null) as (SimilarityBreakdown & { similarity: number })[];
  const totalWeight = usable.reduce((sum, b) => sum + b.weight, 0);
  const score = totalWeight === 0 ? 0 : usable.reduce((sum, b) => sum + b.weight * b.similarity, 0) / totalWeight;

  return { score, breakdown, comparableFieldCount: usable.length };
}

function numericSimilarity(a: number | null, b: number | null, scale: number): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const distance = Math.abs(a - b) / scale;
  return Math.max(0, 1 - distance);
}

function booleanSimilarity(a: boolean | null, b: boolean | null): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return a === b ? 1 : 0;
}

function categoricalSimilarity(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
}

function complexitySimilarity(a: ComplexityLevel | null, b: ComplexityLevel | null): number | null {
  if (!a || !b) return null;
  const ia = COMPLEXITY_LEVELS.indexOf(a);
  const ib = COMPLEXITY_LEVELS.indexOf(b);
  if (ia === -1 || ib === -1) return null;
  return Math.max(0, 1 - Math.abs(ia - ib) / (COMPLEXITY_LEVELS.length - 1));
}

function locationSimilarity(target: EventProfile, candidate: EventProfile): number | null {
  if (!target.city && !target.state) return null;
  if (!candidate.city && !candidate.state) return null;
  if (target.city && candidate.city && target.city.trim().toLowerCase() === candidate.city.trim().toLowerCase()) {
    return 1;
  }
  if (target.state && candidate.state && target.state.trim().toLowerCase() === candidate.state.trim().toLowerCase()) {
    return 0.5;
  }
  return 0;
}

/**
 * Recency weighting: an event loses half its "freshness" every ~2 years, so
 * older data still counts but recent, highly similar shows dominate. Applied
 * as a multiplier on top of the raw similarity score when ranking.
 */
export function recencyWeight(eventDate: Date | null, now: Date = new Date()): number {
  if (!eventDate) return 0.7; // unknown date: treat as moderately stale, not disqualifying
  const ageYears = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  const halfLifeYears = 2;
  return Math.pow(0.5, Math.max(0, ageYears) / halfLifeYears);
}

export interface RankedComparable<T> {
  event: T;
  similarity: SimilarityResult;
  recency: number;
  rankScore: number;
}

/**
 * Ranks candidates by similarity blended with recency (recent + similar wins
 * over old + similar). `rankScore` is what's used for ordering; the raw
 * `similarity.score` is what's shown to the user as "N% match" so recency
 * doesn't inflate a displayed similarity that isn't really about the event.
 */
export function rankComparables<T extends { profile: EventProfile; eventDate: Date | null }>(
  target: EventProfile,
  candidates: T[],
  weights: SimilarityWeights = DEFAULT_SIMILARITY_WEIGHTS,
  limit = 10,
): RankedComparable<T>[] {
  return candidates
    .map((candidate) => {
      const similarity = scoreSimilarity(target, candidate.profile, weights);
      const recency = recencyWeight(candidate.eventDate);
      return { event: candidate, similarity, recency, rankScore: similarity.score * (0.7 + 0.3 * recency) };
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, limit);
}
