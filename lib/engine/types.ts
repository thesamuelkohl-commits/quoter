// Shared domain vocabulary for the engine layer. These mirror the "enum-like"
// string fields in prisma/schema.prisma (SQLite has no native enum type, so
// values are validated here at the app boundary instead of in the DB).

export const DEPARTMENTS = [
  "AUDIO",
  "VIDEO",
  "STREAMING",
  "LED",
  "LIGHTING",
  "SCENIC",
  "COMMUNICATIONS",
  "RIGGING",
  "LABOR",
  "TRUCKING",
  "TRAVEL",
  "OTHER",
  "ADDONS",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** Event/production scale per department, picked visually on the New Estimate form. */
export const COMPLEXITY_LEVELS = ["NONE", "SMALL", "MEDIUM", "LARGE", "ARENA"] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const ESTIMATE_STATUSES = ["DRAFT", "CALCULATED", "REVIEWED"] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const RATE_TYPES = ["DAY", "HOURLY"] as const;
export type RateType = (typeof RATE_TYPES)[number];

export const LINE_ITEM_SOURCES = ["RULE", "HISTORICAL", "MANUAL", "AI_SUGGESTED"] as const;
export type LineItemSource = (typeof LINE_ITEM_SOURCES)[number];

export const CREW_ITEM_SOURCES = ["HARD_RULE", "LEARNED_PATTERN", "MANUAL"] as const;
export type CrewItemSource = (typeof CREW_ITEM_SOURCES)[number];

export const EQUIPMENT_UNITS = ["FLAT", "PER_DAY", "PER_PERSON"] as const;
export type EquipmentUnit = (typeof EQUIPMENT_UNITS)[number];

export const DATA_QUALITY = ["VERIFIED", "IMPORTED_UNVERIFIED"] as const;
export type DataQuality = (typeof DATA_QUALITY)[number];

export const PATTERN_STATUSES = ["PROPOSED", "APPROVED", "REJECTED"] as const;
export type PatternStatus = (typeof PATTERN_STATUSES)[number];

export const IMPORT_BATCH_STATUSES = ["UPLOADED", "MAPPED", "REVIEWED", "COMPLETED"] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const IMPORT_ROW_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

/**
 * The subset of event-shape fields shared between a salesperson's Estimate
 * intake and a HistoricalEvent record. The comparable engine scores an
 * Estimate against every HistoricalEvent using exactly these fields, so
 * keeping the two shapes aligned is what makes "find similar shows" possible.
 */
export interface EventProfile {
  eventType: string | null;
  city: string | null;
  state: string | null;
  attendees: number | null;
  roomSqft: number | null;
  numGeneralSessionRooms: number | null;
  numBreakoutRooms: number | null;
  numSimultaneousBreakoutRooms: number | null;
  setupDays: number | null;
  rehearsalDays: number | null;
  showDays: number | null;
  strikeDays: number | null;
  ledSizeSqft: number | null;
  projectionUsed: boolean | null;
  cameraCount: number | null;
  audioComplexity: ComplexityLevel | null;
  videoComplexity: ComplexityLevel | null;
  ledComplexity: ComplexityLevel | null;
  lightingComplexity: ComplexityLevel | null;
  scenicComplexity: ComplexityLevel | null;
  unionLabor: boolean | null;
  travelRequired: boolean | null;
}

/** A single department's requirement as captured on an Estimate. */
export interface DepartmentRequirement {
  department: Department;
  complexityLevel: ComplexityLevel;
  requirementsText?: string | null;
  structuredRequirements?: Record<string, unknown> | null;
}

export interface AssumptionRecord {
  fieldName: string;
  assumptionText: string;
  confidence: ConfidenceLevel;
}

/** Crew Rule DSL — deterministic, data-driven, never `eval`'d. */
export type CrewRuleDsl =
  | { type: "ratio_ceiling"; inputField: keyof EventProfile | string; divisor: number; minimum?: number }
  | { type: "fixed"; quantity: number }
  | {
      type: "threshold_table";
      inputField: keyof EventProfile | string;
      thresholds: { max: number; quantity: number }[];
      aboveMaxQuantity: number;
    };
