import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import { DEPARTMENTS, type ComplexityLevel, type Department, type EventProfile } from "@/lib/engine/types";
import { rankComparables, type SimilarityBreakdown } from "@/lib/engine/comparable-engine";
import { computeConfidence, summarizeComparables } from "@/lib/engine/confidence-engine";
import { buildCrewPlan, type ComparableWithCrew, type CrewRuleInput } from "@/lib/engine/crew-engine";
import {
  computeCrewCost,
  computeEquipmentLineItems,
  blendPriceRange,
  sumLineItems,
  departmentSubtotals,
  scheduleGeneratesOvertime,
  gearRentalTierMultiplier,
  STANDARD_HOURS_PER_DAY,
  HOLIDAY_SURCHARGE_RATE,
  WEEKEND_STAGEHAND_SURCHARGE_RATE,
  weightedAverage,
  type DepartmentPackageInput,
  type ComputedLineItem,
} from "@/lib/engine/pricing-engine";
import { getAiInterpreter } from "@/lib/engine/ai-interpretation";
import { buildEngagementDates, countWeekendDays } from "@/lib/engine/schedule-dates";

// Departments priced through the equipment/package mechanism (LABOR is handled entirely by the crew engine).
// ADDONS is priced as individually-selected flat-fee items, not a Small/Medium/Large/Arena
// package, so it's handled separately from the rest of the tier-priced departments.
const EQUIPMENT_DEPARTMENTS = DEPARTMENTS.filter((d) => d !== "LABOR" && d !== "ADDONS");

const HOME_CITY = "nashville";

interface Defaulted<T> {
  value: T;
  assumed: boolean;
}

function withDefault<T>(value: T | null | undefined, fallback: T): Defaulted<T> {
  return value === null || value === undefined ? { value: fallback, assumed: true } : { value, assumed: false };
}

export async function generateEstimateResult(estimateId: string) {
  const estimate = await prisma.estimate.findUniqueOrThrow({
    where: { id: estimateId },
    include: { departments: true, client: true },
  });

  const assumptions: { fieldName: string; assumptionText: string; confidence: "HIGH" | "MEDIUM" | "LOW" }[] = [];
  const humanConfirmationItems: string[] = [];

  // --- 1. Fill gaps with reasonable defaults, logging every one ------------
  const attendees = withDefault(estimate.attendees, 200);
  if (attendees.assumed) assumptions.push({ fieldName: "attendees", assumptionText: "Attendance not provided — assumed 200 attendees.", confidence: "LOW" });

  const roomSqft = withDefault(estimate.roomSqft, attendees.value * 20);
  if (roomSqft.assumed) assumptions.push({ fieldName: "roomSqft", assumptionText: `Room size not provided — assumed ${roomSqft.value.toLocaleString()} sqft (~20 sqft/attendee).`, confidence: "MEDIUM" });

  const showDays = withDefault(estimate.showDays, 1);
  if (showDays.assumed) assumptions.push({ fieldName: "showDays", assumptionText: "Show length not provided — assumed 1 show day.", confidence: "MEDIUM" });

  const setupDays = withDefault(estimate.setupDays, 1);
  if (setupDays.assumed) assumptions.push({ fieldName: "setupDays", assumptionText: "Setup days not provided — assumed 1 setup day.", confidence: "MEDIUM" });

  const strikeDays = withDefault(estimate.strikeDays, 1);
  if (strikeDays.assumed) assumptions.push({ fieldName: "strikeDays", assumptionText: "Strike days not provided — assumed 1 strike day.", confidence: "MEDIUM" });

  const rehearsalDays = withDefault(estimate.rehearsalDays, 0);
  const darkDays = withDefault(estimate.darkDays, 0);

  const numGeneralSessionRooms = withDefault(estimate.numGeneralSessionRooms, 1);
  const numBreakoutRooms = withDefault(estimate.numBreakoutRooms, 0);
  const numSimultaneousBreakoutRooms = withDefault(
    estimate.numSimultaneousBreakoutRooms,
    numBreakoutRooms.value,
  );
  if (numBreakoutRooms.value > 0 && numSimultaneousBreakoutRooms.assumed) {
    assumptions.push({
      fieldName: "numSimultaneousBreakoutRooms",
      assumptionText: `Simultaneous breakout rooms not provided — assumed all ${numBreakoutRooms.value} run at once.`,
      confidence: "MEDIUM",
    });
  }

  const dailySchedule = (estimate.dailySchedule as { hoursPerDay?: number } | null) ?? null;
  const hoursPerDay = withDefault(dailySchedule?.hoursPerDay, STANDARD_HOURS_PER_DAY);
  if (hoursPerDay.assumed) assumptions.push({ fieldName: "hoursPerDay", assumptionText: `Daily schedule length not provided — assumed a standard ${STANDARD_HOURS_PER_DAY}-hour show day.`, confidence: "LOW" });

  // Venue is intentionally not collected on the V1 intake form — treated as
  // out of scope rather than a per-estimate data gap, so it no longer counts
  // against confidence or generates a recurring assumption.
  const venueKnown = true;

  // The salesperson always explicitly marks in-town vs. travel gig via a
  // checkbox, so this is always a known input (unlike the old city-based
  // inference it replaced). City/state are no longer collected on the
  // intake form, so there's nothing to flag as a per-estimate data gap here.
  const travelKnown = true;

  // --- 2. Department requirements + AI-suggested hints on unset departments -
  const departmentMap = new Map(estimate.departments.map((d) => [d.department as Department, d]));

  if (estimate.isTravelGig) {
    const travelDept = departmentMap.get("TRAVEL");
    if (!travelDept || travelDept.complexityLevel === "NONE") {
      assumptions.push({
        fieldName: "department:TRAVEL",
        assumptionText: "Marked as a travel gig — assumed MEDIUM travel scope (flights/hotel/per diem). Confirm actual crew travel needs.",
        confidence: "LOW",
      });
      humanConfirmationItems.push("Confirm actual travel logistics (flights, hotel nights, per diem headcount) for this travel gig.");
      departmentMap.set("TRAVEL", {
        id: travelDept?.id ?? "", estimateId, department: "TRAVEL", complexityLevel: "MEDIUM",
        requirementsText: travelDept?.requirementsText ?? null, structuredRequirements: travelDept?.structuredRequirements ?? null,
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
  }
  const interpreter = getAiInterpreter();
  const interpreted = estimate.specialRequirements ? await interpreter.interpretFreeText(estimate.specialRequirements) : { departmentHints: [], flags: [] as string[] };

  for (const hint of interpreted.departmentHints) {
    const existing = departmentMap.get(hint.department);
    if (!existing || existing.complexityLevel === "NONE") {
      assumptions.push({
        fieldName: `department:${hint.department}`,
        assumptionText: `AI-detected requirement in notes (${hint.reason}) — suggested ${hint.suggestedComplexity} ${hint.department}. Please confirm.`,
        confidence: "LOW",
      });
      humanConfirmationItems.push(`Confirm ${hint.department} scope (AI-suggested ${hint.suggestedComplexity} from notes: "${hint.reason}").`);
      departmentMap.set(hint.department, {
        id: existing?.id ?? "", estimateId, department: hint.department, complexityLevel: hint.suggestedComplexity,
        requirementsText: existing?.requirementsText ?? null, structuredRequirements: existing?.structuredRequirements ?? null,
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
  }
  for (const flag of interpreted.flags) {
    assumptions.push({ fieldName: "notes", assumptionText: flag, confidence: "MEDIUM" });
  }

  const equipmentKnown = EQUIPMENT_DEPARTMENTS.some((d) => (departmentMap.get(d)?.complexityLevel ?? "NONE") !== "NONE");

  // --- 3. Build the event profile used for comparables/crew rules ----------
  const profile: EventProfile = {
    eventType: estimate.eventType,
    city: estimate.city,
    state: estimate.state,
    attendees: attendees.value,
    roomSqft: roomSqft.value,
    numGeneralSessionRooms: numGeneralSessionRooms.value,
    numBreakoutRooms: numBreakoutRooms.value,
    numSimultaneousBreakoutRooms: numSimultaneousBreakoutRooms.value,
    setupDays: setupDays.value,
    rehearsalDays: rehearsalDays.value,
    showDays: showDays.value,
    strikeDays: strikeDays.value,
    ledSizeSqft: (departmentMap.get("LED")?.structuredRequirements as { ledSizeSqft?: number } | null)?.ledSizeSqft ?? null,
    projectionUsed: (departmentMap.get("VIDEO")?.structuredRequirements as { projectionUsed?: boolean } | null)?.projectionUsed ?? null,
    cameraCount: (departmentMap.get("VIDEO")?.structuredRequirements as { cameraCount?: number } | null)?.cameraCount ?? null,
    audioComplexity: (departmentMap.get("AUDIO")?.complexityLevel as ComplexityLevel) ?? null,
    videoComplexity: (departmentMap.get("VIDEO")?.complexityLevel as ComplexityLevel) ?? null,
    ledComplexity: (departmentMap.get("LED")?.complexityLevel as ComplexityLevel) ?? null,
    lightingComplexity: (departmentMap.get("LIGHTING")?.complexityLevel as ComplexityLevel) ?? null,
    scenicComplexity: (departmentMap.get("SCENIC")?.complexityLevel as ComplexityLevel) ?? null,
    unionLabor: estimate.unionLabor,
    travelRequired: estimate.isTravelGig,
  };

  // --- 4. Comparable historical events --------------------------------------
  const historicalEvents = await prisma.historicalEvent.findMany({ include: { crew: { include: { position: true } } } });
  const candidates = historicalEvents.map((e) => ({
    id: e.id,
    dataQuality: e.dataQuality,
    finalSellingPrice: e.finalSellingPrice,
    grossMargin: e.grossMargin,
    eventDate: e.eventDate,
    profile: {
      eventType: e.eventType,
      city: e.city,
      state: e.state,
      attendees: e.attendees,
      roomSqft: e.roomSqft,
      numGeneralSessionRooms: e.numGeneralSessionRooms,
      numBreakoutRooms: e.numBreakoutRooms,
      numSimultaneousBreakoutRooms: e.numSimultaneousBreakoutRooms,
      setupDays: e.setupDays,
      rehearsalDays: e.rehearsalDays,
      showDays: e.showDays,
      strikeDays: e.strikeDays,
      ledSizeSqft: e.ledSizeSqft,
      projectionUsed: e.projectionUsed,
      cameraCount: e.cameraCount,
      audioComplexity: e.audioComplexity as ComplexityLevel | null,
      videoComplexity: e.videoComplexity as ComplexityLevel | null,
      ledComplexity: e.ledComplexity as ComplexityLevel | null,
      lightingComplexity: e.lightingComplexity as ComplexityLevel | null,
      scenicComplexity: e.scenicComplexity as ComplexityLevel | null,
      unionLabor: e.unionLabor,
      travelRequired: e.city ? e.city.trim().toLowerCase() !== HOME_CITY : null,
    } satisfies EventProfile,
    crew: e.crew.map((c) => ({ positionId: c.positionId, positionName: c.position.name, quantity: c.quantity })),
  }));

  // A low bar here would let barely-related historical shows (e.g. one with
  // no breakout rooms when this estimate needs several) count as
  // "comparable" and dilute the price/crew averages below. 0.3 keeps only
  // shows that are genuinely alike on more than a couple of fields.
  const ranked = rankComparables(profile, candidates, undefined, 12).filter((r) => r.similarity.score >= 0.3);
  const { averageSimilarity, unverifiedComparableShare } = summarizeComparables(ranked);

  const confidence = computeConfidence({
    comparableCount: ranked.length,
    averageSimilarity,
    assumptionCount: assumptions.length,
    venueKnown,
    scheduleKnown: !setupDays.assumed && !showDays.assumed,
    equipmentKnown,
    travelKnown,
    unverifiedComparableShare,
  });

  // --- 5. Crew plan ----------------------------------------------------------
  const crewRules = await prisma.crewRule.findMany({ where: { active: true }, include: { position: true } });
  const hardRules: CrewRuleInput[] = crewRules.map((r) => ({
    id: r.id,
    positionId: r.positionId,
    positionName: r.position.name,
    name: r.name,
    ruleDsl: r.ruleDsl as CrewRuleInput["ruleDsl"],
    priority: r.priority,
    active: r.active,
  }));

  const comparablesWithCrew: ComparableWithCrew[] = ranked.map((r) => ({
    historicalEventId: r.event.id,
    similarity: r.similarity.score,
    crew: r.event.crew,
  }));

  const crewPlan = buildCrewPlan(profile, hardRules, comparablesWithCrew, 0.5);

  const laborRates = await prisma.laborRate.findMany({ where: { region: "default", active: true } });
  const rateByPosition = new Map(laborRates.map((r) => [r.positionId, r]));

  // On-site days (for gear rental tiers) includes dark days — the crew doesn't
  // work them, but the gear is still parked on site the whole span.
  const totalOnSiteDays = setupDays.value + rehearsalDays.value + showDays.value + strikeDays.value + darkDays.value;
  const gearRentalMultiplier = gearRentalTierMultiplier(totalOnSiteDays);

  let weekendDayCount = 0;
  if (estimate.showStartDate) {
    const engagementDates = buildEngagementDates(estimate.showStartDate, {
      setupDays: setupDays.value,
      rehearsalDays: rehearsalDays.value,
      showDays: showDays.value,
      strikeDays: strikeDays.value,
    });
    weekendDayCount = countWeekendDays(engagementDates);

    if (estimate.showEndDate) {
      const engagementStart = engagementDates[0] ?? estimate.showStartDate;
      const expectedEnd = new Date(engagementStart);
      expectedEnd.setUTCDate(expectedEnd.getUTCDate() + Math.max(totalOnSiteDays - 1, 0));
      const actualEnd = new Date(estimate.showEndDate);
      actualEnd.setUTCHours(0, 0, 0, 0);
      if (expectedEnd.getTime() !== actualEnd.getTime()) {
        const fmt = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "UTC" });
        assumptions.push({
          fieldName: "showEndDate",
          assumptionText: `Entered show end date (${fmt(actualEnd)}) doesn't match the ${totalOnSiteDays} on-site day(s) implied by the day counts (expected ${fmt(expectedEnd)}) — confirm which is right.`,
          confidence: "LOW",
        });
      }
    }
  } else {
    assumptions.push({ fieldName: "showStartDate", assumptionText: "Show start date not provided — weekend Stagehand premiums could not be checked.", confidence: "LOW" });
  }

  const schedule = {
    setupDays: setupDays.value,
    rehearsalDays: rehearsalDays.value,
    showDays: showDays.value,
    strikeDays: strikeDays.value,
    hoursPerDay: hoursPerDay.value,
    travelRequired: estimate.isTravelGig,
    weekendDayCount,
    isHoliday: estimate.isHoliday,
  };

  const computedCrew = crewPlan
    .map((item) => {
      const rate = rateByPosition.get(item.positionId);
      if (!rate) {
        humanConfirmationItems.push(`No labor rate configured for ${item.positionName} — priced as $0, needs manual pricing.`);
        return computeCrewCost(item, { rateType: "DAY", standardRate: 0, overtimeMultiplier: 1.5, minimumCallHours: 0 }, schedule);
      }
      return computeCrewCost(item, { rateType: rate.rateType as "DAY" | "HOURLY", standardRate: rate.standardRate, overtimeMultiplier: rate.overtimeMultiplier, minimumCallHours: rate.minimumCallHours }, schedule);
    })
    .sort((a, b) => a.positionName.localeCompare(b.positionName));

  const overtimeFlagged = scheduleGeneratesOvertime(schedule);
  if (overtimeFlagged) {
    humanConfirmationItems.push(`The planned ${hoursPerDay.value}-hour show day generates overtime — confirm the schedule with the client before finalizing.`);
  }

  // --- 6. Equipment line items ------------------------------------------------
  const packages = await prisma.equipmentPackage.findMany({
    where: { active: true, department: { in: EQUIPMENT_DEPARTMENTS as unknown as string[] } },
    include: { items: { include: { equipmentItem: true } } },
  });

  const selectedPackages: DepartmentPackageInput[] = [];
  for (const department of EQUIPMENT_DEPARTMENTS) {
    const requirement = departmentMap.get(department);
    const complexityLevel = requirement?.complexityLevel ?? "NONE";
    if (complexityLevel === "NONE") continue;

    const pkg = packages.find((p) => p.department === department && p.complexityLevel === complexityLevel);
    if (!pkg) {
      assumptions.push({ fieldName: `department:${department}`, assumptionText: `No ${complexityLevel} package configured for ${department} — omitted from the automated total.`, confidence: "LOW" });
      humanConfirmationItems.push(`No pricing package found for ${department} at ${complexityLevel} — price manually.`);
      continue;
    }

    selectedPackages.push({
      department,
      complexityLevel,
      packageId: pkg.id,
      packageName: pkg.name,
      items: pkg.items.map((i) => ({
        equipmentItemId: i.equipmentItemId,
        name: i.equipmentItem.name,
        category: i.equipmentItem.category,
        department,
        quantity: i.quantity,
        sellRate: i.equipmentItem.sellRate,
      })),
    });
  }

  // Add-ons: individually toggled flat-fee items (e.g. Podcast Recording, Graphics
  // Support), not part of the Small/Medium/Large/Arena package tiers.
  const selectedAddOnIds = (departmentMap.get("ADDONS")?.structuredRequirements as { selectedItemIds?: string[] } | null)?.selectedItemIds ?? [];
  const addOnLineItems: ComputedLineItem[] = [];
  if (selectedAddOnIds.length > 0) {
    const addOnItems = await prisma.equipmentItem.findMany({ where: { id: { in: selectedAddOnIds }, active: true } });
    for (const item of addOnItems) {
      addOnLineItems.push({
        department: "ADDONS",
        category: item.category,
        description: item.name,
        equipmentItemId: item.id,
        quantity: 1,
        unitPrice: item.sellRate,
        extendedPrice: item.sellRate,
        source: "MANUAL",
      });
    }
  }

  const lineItems: ComputedLineItem[] = [...computeEquipmentLineItems(selectedPackages, gearRentalMultiplier), ...addOnLineItems];
  const equipmentTotal = sumLineItems(lineItems);
  const laborTotal = computedCrew.reduce((sum, c) => sum + c.totalCost, 0);
  const travelLaborTotal = computedCrew.reduce((sum, c) => sum + c.travelCost, 0);
  const weekendSurchargeTotal = computedCrew.reduce((sum, c) => sum + c.weekendSurcharge, 0);
  const holidaySurchargeTotal = computedCrew.reduce((sum, c) => sum + c.holidaySurcharge, 0);
  const baselineTotal = equipmentTotal + laborTotal;

  // --- 7. Blend with comparable historical pricing ---------------------------
  // Weighted by similarity so a loosely-related comparable (missing a
  // department this estimate needs, wildly different scale, etc.) can't drag
  // the price down as hard as a genuinely close match does.
  const comparableAveragePrice = weightedAverage(
    ranked.filter((r) => r.event.finalSellingPrice !== null).map((r) => ({ value: r.event.finalSellingPrice!, weight: r.similarity.score })),
  );

  const range = blendPriceRange(baselineTotal, comparableAveragePrice, ranked.length, confidence.level);

  const marginPercent = weightedAverage(
    ranked
      .filter((r) => r.event.finalSellingPrice !== null && r.event.grossMargin !== null)
      .map((r) => ({ value: r.event.grossMargin! / r.event.finalSellingPrice!, weight: r.similarity.score })),
  );
  const marginEstimate = marginPercent !== null ? Math.round(range.mostLikelyPrice * marginPercent) : null;

  // --- 8. Explanation ----------------------------------------------------------
  const topComparable = ranked[0];
  const whyBullets: string[] = [];
  if (ranked.length > 0) {
    whyBullets.push(`${ranked.length} comparable historical event${ranked.length === 1 ? "" : "s"} found (avg. similarity ${Math.round(averageSimilarity * 100)}%).`);
    if (topComparable) {
      const strongFields = topComparable.similarity.breakdown.filter((b): b is SimilarityBreakdown & { similarity: number } => b.similarity !== null && b.similarity >= 0.8).map((b) => b.field);
      if (strongFields.length > 0) whyBullets.push(`Closest match shares: ${strongFields.join(", ")}.`);
    }
  } else {
    whyBullets.push("No closely comparable historical events were found — this estimate leans on rule-based equipment/labor pricing alone.");
  }

  const crewAssumptionLines = computedCrew.map((c) => `${c.quantity} ${c.positionName}${c.quantity > 1 ? "s" : ""} — ${c.explanation}`);
  const costDrivers = [
    ...(profile.ledSizeSqft ? [`Final LED dimensions (currently assumed at ${profile.ledSizeSqft} sqft)`] : []),
    ...(numSimultaneousBreakoutRooms.value > 0 ? [`${numSimultaneousBreakoutRooms.value} simultaneous breakout rooms`] : []),
    ...(estimate.unionLabor ? ["Union labor requirements"] : []),
    ...(rehearsalDays.value > 0 ? [`${rehearsalDays.value} rehearsal day(s)`] : []),
    ...(overtimeFlagged ? [`Planned daily schedule generates overtime (crew day is ${STANDARD_HOURS_PER_DAY}hrs before OT)`] : []),
    ...(estimate.isTravelGig ? ["Travel gig — each crew member is charged a half-day rate each way (there and home)"] : []),
    ...(estimate.isHoliday ? [`Holiday show — flat ${Math.round(HOLIDAY_SURCHARGE_RATE * 100)}% crew cost surcharge applied`] : []),
    ...(weekendSurchargeTotal > 0 ? [`${weekendDayCount} weekend day(s) in schedule — ${Math.round(WEEKEND_STAGEHAND_SURCHARGE_RATE * 100)}% Stagehand premium applied`] : []),
    ...(gearRentalMultiplier > 1 ? [`Multi-day gear rental: ${gearRentalMultiplier}x tier applied (${totalOnSiteDays} total on-site days)`] : []),
    ...(darkDays.value > 0 ? [`${darkDays.value} dark/dead day(s) — no crew cost, still counted toward gear rental length`] : []),
  ];

  const explanation = {
    headline: `Estimated ${range.lowPrice.toLocaleString()}–${range.highPrice.toLocaleString()} (most likely ${range.mostLikelyPrice.toLocaleString()}), confidence ${confidence.level}.`,
    why: whyBullets,
    crewAssumptions: crewAssumptionLines,
    majorVariables: costDrivers,
    itemsRequiringConfirmation: humanConfirmationItems,
    departmentSubtotals: departmentSubtotals(lineItems),
    equipmentTotal,
    laborTotal,
    travelLaborTotal,
    weekendSurchargeTotal,
    holidaySurchargeTotal,
    confidenceFactors: confidence.factors,
  };

  // --- 9. Persist (replace any prior generation for this estimate) -----------
  await prisma.$transaction([
    prisma.estimateResult.deleteMany({ where: { estimateId } }),
    prisma.estimateComparable.deleteMany({ where: { estimateId } }),
    prisma.estimateCrewItem.deleteMany({ where: { estimateId } }),
    prisma.estimateLineItem.deleteMany({ where: { estimateId } }),
    prisma.estimateAssumption.deleteMany({ where: { estimateId } }),
  ]);

  for (const [department, requirement] of departmentMap) {
    await prisma.estimateDepartment.upsert({
      where: { estimateId_department: { estimateId, department } },
      create: { estimateId, department, complexityLevel: requirement.complexityLevel, requirementsText: requirement.requirementsText, structuredRequirements: requirement.structuredRequirements ?? undefined },
      update: { complexityLevel: requirement.complexityLevel },
    });
  }

  await prisma.estimateAssumption.createMany({ data: assumptions.map((a) => ({ estimateId, ...a })) });

  await prisma.estimateLineItem.createMany({
    data: lineItems.map((i) => ({
      estimateId,
      department: i.department,
      category: i.category,
      description: i.description,
      equipmentItemId: i.equipmentItemId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      extendedPrice: i.extendedPrice,
      source: i.source,
    })),
  });

  await prisma.estimateCrewItem.createMany({
    data: computedCrew.map((c) => ({
      estimateId,
      positionId: c.positionId,
      quantity: c.quantity,
      days: c.days,
      hoursPerDay: c.hoursPerDay,
      rateType: c.rateType,
      rate: c.rate,
      overtimeHours: c.overtimeHours,
      overtimeRate: c.overtimeRate,
      totalCost: c.totalCost,
      source: c.source,
      ruleId: c.ruleId ?? null,
      explanation: c.explanation,
    })),
  });

  await prisma.estimateComparable.createMany({
    data: ranked.map((r, index) => ({
      estimateId,
      historicalEventId: r.event.id,
      similarityScore: r.similarity.score,
      similarityBreakdown: r.similarity.breakdown as unknown as Prisma.InputJsonValue,
      rank: index + 1,
    })),
  });

  await prisma.estimateResult.create({
    data: {
      estimateId,
      lowPrice: range.lowPrice,
      highPrice: range.highPrice,
      mostLikelyPrice: range.mostLikelyPrice,
      confidenceLevel: confidence.level,
      confidenceScore: confidence.score,
      marginEstimate,
      explanation: explanation as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.estimate.update({ where: { id: estimateId }, data: { status: "CALCULATED" } });

  return estimateId;
}
