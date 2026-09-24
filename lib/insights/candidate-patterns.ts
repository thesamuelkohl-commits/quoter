import type { EventProfile } from "@/lib/engine/types";

export interface CandidatePattern {
  positionName: string;
  conditionText: string;
  matchesCondition: (profile: EventProfile) => boolean;
}

const largePlus = (level: string | null) => level === "LARGE" || level === "ARENA";

/**
 * A curated starting set of conditions worth testing against historical
 * data — not an open-ended pattern miner. New candidates get added here as
 * OTL notices staffing questions worth checking (e.g. "do we always add a
 * dedicated V1 when there's LED + multiple cameras?").
 */
export const CANDIDATE_PATTERNS: CandidatePattern[] = [
  {
    positionName: "V1",
    conditionText: "LED wall present and 2+ cameras",
    matchesCondition: (p) => (p.ledComplexity ?? "NONE") !== "NONE" && (p.cameraCount ?? 0) >= 2,
  },
  {
    positionName: "LED Technician",
    conditionText: "LED scale Large or above",
    matchesCondition: (p) => largePlus(p.ledComplexity),
  },
  {
    positionName: "Graphics Operator",
    conditionText: "Video scale Large or above",
    matchesCondition: (p) => largePlus(p.videoComplexity),
  },
  {
    positionName: "Stage Manager",
    conditionText: "2 or more show days",
    matchesCondition: (p) => (p.showDays ?? 0) >= 2,
  },
  {
    positionName: "Technical Director",
    conditionText: "Any department at Large scale or above",
    matchesCondition: (p) => largePlus(p.audioComplexity) || largePlus(p.videoComplexity) || largePlus(p.lightingComplexity),
  },
  {
    positionName: "A2",
    conditionText: "Audio scale Medium or above",
    matchesCondition: (p) => p.audioComplexity !== null && p.audioComplexity !== "NONE" && p.audioComplexity !== "SMALL",
  },
];
