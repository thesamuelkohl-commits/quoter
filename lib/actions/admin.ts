"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { CrewRuleDsl } from "@/lib/engine/types";

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

// --- Equipment -------------------------------------------------------------

export async function createEquipmentItem(formData: FormData) {
  const name = str(formData, "name");
  const department = str(formData, "department");
  const category = str(formData, "category");
  const sellRate = num(formData, "sellRate");
  if (!name || !department || !category || sellRate === null) throw new Error("Name, department, category, and sell rate are required.");

  await prisma.equipmentItem.create({
    data: { name, department, category, sellRate, cost: num(formData, "cost"), unit: str(formData, "unit") ?? "FLAT" },
  });
  revalidatePath("/pricing");
}

export async function toggleEquipmentItemActive(itemId: string, active: boolean) {
  await prisma.equipmentItem.update({ where: { id: itemId }, data: { active } });
  revalidatePath("/pricing");
}

// --- Crew rules --------------------------------------------------------------

export async function createCrewRule(formData: FormData) {
  const positionId = str(formData, "positionId");
  const name = str(formData, "name");
  const description = str(formData, "description");
  const ruleDslText = str(formData, "ruleDsl");
  if (!positionId || !name || !description || !ruleDslText) throw new Error("Position, name, description, and rule definition are required.");

  let ruleDsl: CrewRuleDsl;
  try {
    ruleDsl = JSON.parse(ruleDslText);
  } catch {
    throw new Error("Rule definition must be valid JSON.");
  }

  await prisma.crewRule.create({
    data: {
      positionId,
      name,
      description,
      ruleDsl: ruleDsl as unknown as Prisma.InputJsonValue,
      priority: num(formData, "priority") ?? 0,
    },
  });
  revalidatePath("/rules");
}

export async function toggleCrewRuleActive(ruleId: string, active: boolean) {
  await prisma.crewRule.update({ where: { id: ruleId }, data: { active } });
  revalidatePath("/rules");
}

// --- Labor rates ---------------------------------------------------------------

export async function createLaborRate(formData: FormData) {
  const positionId = str(formData, "positionId");
  const standardRate = num(formData, "standardRate");
  if (!positionId || standardRate === null) throw new Error("Position and standard rate are required.");

  await prisma.laborRate.create({
    data: {
      positionId,
      region: str(formData, "region") ?? "default",
      rateType: str(formData, "rateType") ?? "DAY",
      standardRate,
      overtimeMultiplier: num(formData, "overtimeMultiplier") ?? 1.5,
      minimumCallHours: num(formData, "minimumCallHours") ?? 0,
    },
  });
  revalidatePath("/admin");
}

export async function toggleLaborRateActive(rateId: string, active: boolean) {
  await prisma.laborRate.update({ where: { id: rateId }, data: { active } });
  revalidatePath("/admin");
}

// --- Travel / trucking -----------------------------------------------------------

export async function createTravelAssumption(formData: FormData) {
  const city = str(formData, "city");
  if (!city) throw new Error("City is required.");
  await prisma.travelAssumption.create({
    data: {
      city,
      state: str(formData, "state"),
      flightRequired: formData.get("flightRequired") === "on",
      hotelNightlyRate: num(formData, "hotelNightlyRate"),
      perDiemRate: num(formData, "perDiemRate"),
    },
  });
  revalidatePath("/admin");
}

export async function createTruckingRate(formData: FormData) {
  const originRegion = str(formData, "originRegion");
  const rate = num(formData, "rate");
  if (!originRegion || rate === null) throw new Error("Origin region and rate are required.");
  await prisma.truckingRate.create({
    data: { originRegion, rateType: str(formData, "rateType") ?? "FLAT", rate },
  });
  revalidatePath("/admin");
}

// --- App settings ------------------------------------------------------------

export async function updateAppSetting(key: string, formData: FormData) {
  const value = num(formData, "value");
  if (value === null) throw new Error("Value must be a number.");
  await prisma.appSetting.update({ where: { key }, data: { value: value as unknown as Prisma.InputJsonValue } });
  revalidatePath("/admin");
}

// --- Learned patterns ---------------------------------------------------------

export async function approveLearnedPattern(
  positionId: string,
  name: string,
  description: string,
  ruleDsl: CrewRuleDsl,
  priority: number,
) {
  await prisma.crewRule.create({
    data: { positionId, name, description, ruleDsl: ruleDsl as unknown as Prisma.InputJsonValue, priority },
  });
  revalidatePath("/insights");
  revalidatePath("/rules");
}
