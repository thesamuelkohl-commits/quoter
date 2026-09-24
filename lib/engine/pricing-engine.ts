import type { ConfidenceLevel, Department, LineItemSource } from "./types";
import type { CrewPlanItem } from "./crew-engine";

// ---------------------------------------------------------------------------
// Equipment / department pricing
// ---------------------------------------------------------------------------

export interface EquipmentPackageItemInput {
  equipmentItemId: string;
  name: string;
  category: string;
  department: Department;
  quantity: number;
  sellRate: number;
}

export interface DepartmentPackageInput {
  department: Department;
  complexityLevel: string;
  packageId: string;
  packageName: string;
  items: EquipmentPackageItemInput[];
}

export interface ComputedLineItem {
  department: Department;
  category: string;
  description: string;
  equipmentItemId: string | null;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  source: LineItemSource;
}

/**
 * Equipment drives the dollar estimate for every non-labor department
 * (audio/video/led/lighting/scenic/comms/rigging/trucking/travel/other):
 * a department's chosen complexity level resolves to an equipment package,
 * and each package item becomes a priced line item. Package sell rates are
 * already the full show-rate price OTL charges (not a per-day rate to be
 * multiplied up for longer engagements).
 */
export function computeEquipmentLineItems(selectedPackages: DepartmentPackageInput[]): ComputedLineItem[] {
  const lineItems: ComputedLineItem[] = [];
  for (const pkg of selectedPackages) {
    for (const item of pkg.items) {
      lineItems.push({
        department: pkg.department,
        category: item.category,
        description: item.name,
        equipmentItemId: item.equipmentItemId,
        quantity: item.quantity,
        unitPrice: item.sellRate,
        extendedPrice: item.quantity * item.sellRate,
        source: "RULE",
      });
    }
  }
  return lineItems;
}

// ---------------------------------------------------------------------------
// Labor / crew pricing
// ---------------------------------------------------------------------------

export interface LaborRateInput {
  rateType: "DAY" | "HOURLY";
  standardRate: number;
  overtimeMultiplier: number;
  minimumCallHours: number;
}

export interface ScheduleDays {
  setupDays: number;
  rehearsalDays: number;
  showDays: number;
  strikeDays: number;
  /** Expected hours worked per show day — drives the overtime flag. */
  hoursPerDay: number;
  /** Travel gig: charges a half-day rate each way (there + home) per crew member. */
  travelRequired: boolean;
  /** How many of the engagement's total working days fall on a Saturday/Sunday. */
  weekendDayCount: number;
  /** Holiday surcharge checkbox — a flat 10% added to crew cost. */
  isHoliday: boolean;
}

export interface ComputedCrewItem extends CrewPlanItem {
  days: number;
  hoursPerDay: number;
  rateType: "DAY" | "HOURLY";
  rate: number;
  overtimeHours: number;
  overtimeRate: number;
  travelCost: number;
  weekendSurcharge: number;
  holidaySurcharge: number;
  totalCost: number;
}

/** OTL's standard day before overtime applies. */
export const STANDARD_HOURS_PER_DAY = 12;

/** Crew never works past this — clamped defensively even if bad data sneaks in. */
export const MAX_HOURS_PER_DAY = 16;

/** Checkbox surcharge: +10% on crew cost for a holiday show. */
export const HOLIDAY_SURCHARGE_RATE = 0.1;

/** Stagehand-only surcharge for weekend work days. */
export const WEEKEND_STAGEHAND_SURCHARGE_RATE = 0.25;
const WEEKEND_SURCHARGE_POSITION = "Stagehand";

/**
 * OTL bills overtime as a day-rate tier, not incremental hourly pay: a
 * 12–14hr day bills the whole day at 1.25x the day rate, 14–16hr at 1.5x.
 * Hours are clamped to the 16hr hard cap before the lookup.
 */
export function dayRateMultiplier(hoursPerDay: number): number {
  const clamped = Math.min(hoursPerDay, MAX_HOURS_PER_DAY);
  if (clamped <= STANDARD_HOURS_PER_DAY) return 1;
  if (clamped <= 14) return 1.25;
  return 1.5;
}

/**
 * position x quantity x days x rate — never a flat "people x day rate"
 * shortcut. The day-rate tier multiplier (see dayRateMultiplier) applies
 * only to show days, against each position's day-equivalent rate (DAY rate
 * type uses its standard rate directly; HOURLY types, e.g. Stagehand, use
 * standardRate x 12 as their day-equivalent) — setup/rehearsal/strike days
 * stay at the standard 1x rate. Travel gigs add a half-day rate each way
 * (there and home) per crew member, on top of setup/rehearsal/show/strike
 * days. A holiday show adds a flat 10% to crew cost (checkbox-controlled),
 * and Stagehand work that falls on a weekend day carries its own 25%
 * premium (auto-detected from the entered show dates).
 */
export function computeCrewCost(
  item: CrewPlanItem,
  rate: LaborRateInput,
  schedule: ScheduleDays,
): ComputedCrewItem {
  const totalDays = schedule.setupDays + schedule.rehearsalDays + schedule.showDays + schedule.strikeDays;
  const dayEquivalentRate = rate.rateType === "DAY" ? rate.standardRate : rate.standardRate * STANDARD_HOURS_PER_DAY;

  const clampedHoursPerDay = Math.min(schedule.hoursPerDay, MAX_HOURS_PER_DAY);
  const totalOvertimeHours = Math.max(0, clampedHoursPerDay - STANDARD_HOURS_PER_DAY) * schedule.showDays;
  const tierMultiplier = dayRateMultiplier(schedule.hoursPerDay);

  const baseCost = totalDays * dayEquivalentRate;
  // The tier premium (the part of showDays' cost above the standard 1x rate) — the
  // "day-rate tier multiplier" repurposes the overtimeRate field to hold the
  // multiplier itself (1 / 1.25 / 1.5), not a $/hr rate.
  const overtimeRate = tierMultiplier;
  const overtimeCost = schedule.showDays * dayEquivalentRate * (tierMultiplier - 1);

  // Stagehand weekend premium: applied to the fraction of base pay that falls on a weekend day.
  const weekendFraction = totalDays > 0 ? Math.min(schedule.weekendDayCount, totalDays) / totalDays : 0;
  const weekendSurcharge =
    item.positionName === WEEKEND_SURCHARGE_POSITION && weekendFraction > 0 ? baseCost * weekendFraction * WEEKEND_STAGEHAND_SURCHARGE_RATE : 0;

  // Holiday premium: a flat 10% on top of worked labor (base + OT + weekend premium), not on travel pay.
  const holidaySurcharge = schedule.isHoliday ? (baseCost + overtimeCost + weekendSurcharge) * HOLIDAY_SURCHARGE_RATE : 0;

  // Half-day there + half-day home = one day-rate-equivalent per crew member.
  const travelCost = schedule.travelRequired ? dayEquivalentRate : 0;

  const totalCost = (baseCost + overtimeCost + weekendSurcharge + holidaySurcharge + travelCost) * item.quantity;

  return {
    ...item,
    travelCost: travelCost * item.quantity,
    weekendSurcharge: weekendSurcharge * item.quantity,
    holidaySurcharge: holidaySurcharge * item.quantity,
    days: totalDays,
    hoursPerDay: schedule.hoursPerDay,
    rateType: rate.rateType,
    rate: rate.standardRate,
    overtimeHours: totalOvertimeHours,
    overtimeRate,
    totalCost,
  };
}

export function totalCrewCost(items: ComputedCrewItem[]): number {
  return items.reduce((sum, i) => sum + i.totalCost, 0);
}

export function scheduleGeneratesOvertime(schedule: ScheduleDays): boolean {
  return schedule.hoursPerDay > STANDARD_HOURS_PER_DAY && schedule.showDays > 0;
}

// ---------------------------------------------------------------------------
// Blending the rule-based baseline with comparable historical pricing
// ---------------------------------------------------------------------------

export interface PriceRange {
  lowPrice: number;
  highPrice: number;
  mostLikelyPrice: number;
}

const RANGE_SPREAD_BY_CONFIDENCE: Record<ConfidenceLevel, number> = {
  HIGH: 0.08,
  MEDIUM: 0.16,
  LOW: 0.28,
};

/**
 * A similarity-weighted average, not a flat one: a comparable that's only
 * loosely related (e.g. missing a department this estimate needs, or a very
 * different scale) contributes little, instead of pulling the result down
 * exactly as hard as a near-perfect match would.
 */
export function weightedAverage(pairs: { value: number; weight: number }[]): number | null {
  const totalWeight = pairs.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return null;
  return pairs.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight;
}

/**
 * Blends the deterministic equipment+labor baseline with the average final
 * selling price of comparable historical events. More/closer comparables
 * pull the estimate toward historical reality; fewer/weaker comparables lean
 * on the rule-based baseline. The range widens as confidence drops — an
 * estimate is never presented as precise when the inputs don't support it.
 */
export function blendPriceRange(
  baselineTotal: number,
  comparableAveragePrice: number | null,
  comparableCount: number,
  confidenceLevel: ConfidenceLevel,
): PriceRange {
  const comparableWeight = comparableAveragePrice === null ? 0 : Math.min(comparableCount / 10, 0.6);
  const mostLikelyPrice =
    comparableAveragePrice === null
      ? baselineTotal
      : baselineTotal * (1 - comparableWeight) + comparableAveragePrice * comparableWeight;

  const spread = RANGE_SPREAD_BY_CONFIDENCE[confidenceLevel];
  return {
    lowPrice: Math.round(mostLikelyPrice * (1 - spread)),
    highPrice: Math.round(mostLikelyPrice * (1 + spread)),
    mostLikelyPrice: Math.round(mostLikelyPrice),
  };
}

export function sumLineItems(lineItems: ComputedLineItem[]): number {
  return lineItems.reduce((sum, i) => sum + i.extendedPrice, 0);
}

export function departmentSubtotals(lineItems: ComputedLineItem[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of lineItems) {
    totals[item.department] = (totals[item.department] ?? 0) + item.extendedPrice;
  }
  return totals;
}
