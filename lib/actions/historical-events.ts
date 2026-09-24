"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";

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

export async function createHistoricalEvent(formData: FormData) {
  const eventName = str(formData, "eventName");
  if (!eventName) throw new Error("Event name is required.");

  const event = await prisma.historicalEvent.create({
    data: {
      eventName,
      clientName: str(formData, "clientName"),
      eventType: str(formData, "eventType"),
      venueName: str(formData, "venueName"),
      city: str(formData, "city"),
      state: str(formData, "state"),
      attendees: num(formData, "attendees"),
      roomSqft: num(formData, "roomSqft"),
      numGeneralSessionRooms: num(formData, "numGeneralSessionRooms"),
      numBreakoutRooms: num(formData, "numBreakoutRooms"),
      numSimultaneousBreakoutRooms: num(formData, "numSimultaneousBreakoutRooms"),
      setupDays: num(formData, "setupDays"),
      rehearsalDays: num(formData, "rehearsalDays"),
      showDays: num(formData, "showDays"),
      strikeDays: num(formData, "strikeDays"),
      ledSizeSqft: num(formData, "ledSizeSqft"),
      projectionUsed: bool(formData, "projectionUsed"),
      cameraCount: num(formData, "cameraCount"),
      audioComplexity: str(formData, "audioComplexity"),
      videoComplexity: str(formData, "videoComplexity"),
      ledComplexity: str(formData, "ledComplexity"),
      lightingComplexity: str(formData, "lightingComplexity"),
      scenicComplexity: str(formData, "scenicComplexity"),
      unionLabor: bool(formData, "unionLabor"),
      eventDate: str(formData, "eventDate") ? new Date(str(formData, "eventDate")!) : null,
      quotedAmount: num(formData, "quotedAmount"),
      finalSellingPrice: num(formData, "finalSellingPrice"),
      discountAmount: num(formData, "discountAmount"),
      internalCost: num(formData, "internalCost"),
      grossMargin: num(formData, "grossMargin"),
      notes: str(formData, "notes"),
      dataQuality: "VERIFIED",
      createdBy: str(formData, "createdBy"),
    },
  });

  redirect(`/historical-shows/${event.id}`);
}
