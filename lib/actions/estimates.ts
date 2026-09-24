"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import { COMPLEXITY_LEVELS, DEPARTMENTS, type ComplexityLevel, type Department } from "@/lib/engine/types";
import { generateEstimateResult } from "./generate-estimate";

// ADDONS is a multi-select checklist of flat-fee items, parsed separately by
// parseAddOns — it doesn't have a Small/Medium/Large/Arena complexity radio.
const INTAKE_DEPARTMENTS = DEPARTMENTS.filter((d) => d !== "LABOR" && d !== "ADDONS");

function str(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function num(formData: FormData, key: string): number | null {
  const value = str(formData, key);
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

interface ParsedDepartment {
  department: Department;
  complexityLevel: ComplexityLevel;
  requirementsText: string | null;
  structuredRequirements: Prisma.InputJsonValue | undefined;
}

function parseDepartments(formData: FormData): ParsedDepartment[] {
  const result: ParsedDepartment[] = [];
  for (const department of INTAKE_DEPARTMENTS as readonly Department[]) {
    const complexityLevel = str(formData, `dept_${department}`) as ComplexityLevel | null;
    if (!complexityLevel || !COMPLEXITY_LEVELS.includes(complexityLevel) || complexityLevel === "NONE") continue;

    const structured: Record<string, unknown> = {};
    if (department === "VIDEO") {
      const cameraCount = num(formData, "cameraCount");
      if (cameraCount !== null) structured.cameraCount = cameraCount;
      structured.projectionUsed = bool(formData, "projectionUsed");
    }
    if (department === "LED") {
      const ledSizeSqft = num(formData, "ledSizeSqft");
      if (ledSizeSqft !== null) structured.ledSizeSqft = ledSizeSqft;
    }

    result.push({
      department,
      complexityLevel,
      requirementsText: str(formData, `dept_${department}_notes`),
      structuredRequirements: Object.keys(structured).length > 0 ? (structured as Prisma.InputJsonValue) : undefined,
    });
  }
  return result;
}

/** Reads every checked `addon_<equipmentItemId>` box into an ADDONS department row, if any are checked. */
function parseAddOns(formData: FormData): ParsedDepartment | null {
  const selectedItemIds: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("addon_") && (value === "on" || value === "true")) {
      selectedItemIds.push(key.slice("addon_".length));
    }
  }
  if (selectedItemIds.length === 0) return null;

  return {
    department: "ADDONS",
    complexityLevel: "NONE",
    requirementsText: null,
    structuredRequirements: { selectedItemIds } as Prisma.InputJsonValue,
  };
}

async function resolveClientId(formData: FormData): Promise<string | null> {
  const clientName = str(formData, "clientName");
  if (!clientName) return null;
  const existing = await prisma.client.findFirst({ where: { name: clientName } });
  return existing ? existing.id : (await prisma.client.create({ data: { name: clientName } })).id;
}

function estimateFieldsFromForm(formData: FormData) {
  const hoursPerDay = num(formData, "hoursPerDay");
  const showStartDate = str(formData, "showStartDate");
  return {
    eventName: str(formData, "eventName") ?? "Untitled Estimate",
    showStartDate: showStartDate ? new Date(showStartDate) : null,
    city: str(formData, "city"),
    state: str(formData, "state"),
    attendees: num(formData, "attendees"),
    roomSqft: num(formData, "roomSqft"),
    numGeneralSessionRooms: num(formData, "numGeneralSessionRooms"),
    numBreakoutRooms: num(formData, "numBreakoutRooms"),
    numSimultaneousBreakoutRooms: num(formData, "numSimultaneousBreakoutRooms"),
    setupDays: num(formData, "setupDays"),
    rehearsalDays: num(formData, "rehearsalDays"),
    rehearsalHours: num(formData, "rehearsalHours"),
    showDays: num(formData, "showDays"),
    strikeDays: num(formData, "strikeDays"),
    dailySchedule: hoursPerDay ? { hoursPerDay } : undefined,
    unionLabor: bool(formData, "unionLabor"),
    isTravelGig: bool(formData, "isTravelGig"),
    isHoliday: bool(formData, "isHoliday"),
    targetBudget: num(formData, "targetBudget"),
    specialRequirements: str(formData, "specialRequirements"),
    createdBy: str(formData, "createdBy"),
  };
}

export async function createEstimate(formData: FormData) {
  const eventName = str(formData, "eventName");
  if (!eventName) throw new Error("Event name is required.");
  if (!str(formData, "showStartDate")) throw new Error("Show start date is required.");

  const clientId = await resolveClientId(formData);

  const estimate = await prisma.estimate.create({
    data: { ...estimateFieldsFromForm(formData), ...(clientId ? { client: { connect: { id: clientId } } } : {}) },
  });

  const addOns = parseAddOns(formData);
  const departmentsToCreate = addOns ? [...parseDepartments(formData), addOns] : parseDepartments(formData);
  for (const dept of departmentsToCreate) {
    await prisma.estimateDepartment.create({
      data: {
        estimateId: estimate.id,
        department: dept.department,
        complexityLevel: dept.complexityLevel,
        requirementsText: dept.requirementsText,
        structuredRequirements: dept.structuredRequirements,
      },
    });
  }

  await generateEstimateResult(estimate.id);

  redirect(`/estimates/${estimate.id}/results`);
}

export async function updateEstimate(estimateId: string, formData: FormData) {
  const eventName = str(formData, "eventName");
  if (!eventName) throw new Error("Event name is required.");
  if (!str(formData, "showStartDate")) throw new Error("Show start date is required.");

  const clientId = await resolveClientId(formData);

  await prisma.estimate.update({
    where: { id: estimateId },
    data: { ...estimateFieldsFromForm(formData), client: clientId ? { connect: { id: clientId } } : { disconnect: true } },
  });

  const addOns = parseAddOns(formData);
  const parsed = addOns ? [...parseDepartments(formData), addOns] : parseDepartments(formData);
  const keepDepartments = parsed.map((d) => d.department);

  await prisma.estimateDepartment.deleteMany({ where: { estimateId, department: { notIn: keepDepartments } } });
  for (const dept of parsed) {
    await prisma.estimateDepartment.upsert({
      where: { estimateId_department: { estimateId, department: dept.department } },
      create: { estimateId, department: dept.department, complexityLevel: dept.complexityLevel, requirementsText: dept.requirementsText, structuredRequirements: dept.structuredRequirements },
      update: { complexityLevel: dept.complexityLevel, requirementsText: dept.requirementsText, structuredRequirements: dept.structuredRequirements },
    });
  }

  await generateEstimateResult(estimateId);

  redirect(`/estimates/${estimateId}/results`);
}

export async function regenerateEstimate(estimateId: string) {
  await generateEstimateResult(estimateId);
  redirect(`/estimates/${estimateId}/results`);
}
