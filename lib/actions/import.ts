"use server";

import { redirect } from "next/navigation";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import { parseWorkbook } from "@/lib/import/excel-parser";
import { applyMapping, guessMapping } from "@/lib/import/column-mapper";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

export async function uploadHistoricalImport(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Please choose a file to upload.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = parseWorkbook(buffer);
  if (rows.length === 0) throw new Error("No rows were found in that file.");

  await mkdir(UPLOAD_DIR, { recursive: true });
  const storedFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(UPLOAD_DIR, storedFilename), buffer);

  const guessedMapping = guessMapping(headers);

  const batch = await prisma.historicalImportBatch.create({
    data: {
      originalFilename: file.name,
      storagePath: path.join("storage", "uploads", storedFilename),
      status: "UPLOADED",
      columnMapping: guessedMapping as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.historicalImportRow.createMany({
    data: rows.map((row, index) => ({
      batchId: batch.id,
      rowIndex: index,
      rawData: row as unknown as Prisma.InputJsonValue,
      status: "PENDING",
    })),
  });

  redirect(`/historical-shows/import/${batch.id}`);
}

export async function applyColumnMapping(batchId: string, formData: FormData) {
  const batch = await prisma.historicalImportBatch.findUniqueOrThrow({ where: { id: batchId }, include: { rows: true } });

  const columnMapping: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("map_") && typeof value === "string") {
      columnMapping[key.slice(4)] = value;
    }
  }

  for (const row of batch.rows) {
    const mapped = applyMapping(row.rawData as Record<string, unknown>, columnMapping);
    await prisma.historicalImportRow.update({
      where: { id: row.id },
      data: { mappedData: mapped as unknown as Prisma.InputJsonValue },
    });
  }

  await prisma.historicalImportBatch.update({
    where: { id: batchId },
    data: { columnMapping: columnMapping as unknown as Prisma.InputJsonValue, status: "MAPPED" },
  });

  redirect(`/historical-shows/import/${batchId}`);
}

export async function approveImportBatch(batchId: string) {
  const batch = await prisma.historicalImportBatch.findUniqueOrThrow({ where: { id: batchId }, include: { rows: true } });

  for (const row of batch.rows) {
    if (row.status === "APPROVED") continue;
    const data = (row.mappedData as Record<string, unknown> | null) ?? {};
    if (!data.eventName) continue; // skip rows that never got an event name mapped

    await prisma.historicalEvent.create({
      data: {
        eventName: String(data.eventName),
        clientName: (data.clientName as string) ?? null,
        eventType: (data.eventType as string) ?? null,
        venueName: (data.venueName as string) ?? null,
        city: (data.city as string) ?? null,
        state: (data.state as string) ?? null,
        attendees: (data.attendees as number) ?? null,
        roomSqft: (data.roomSqft as number) ?? null,
        numGeneralSessionRooms: (data.numGeneralSessionRooms as number) ?? null,
        numBreakoutRooms: (data.numBreakoutRooms as number) ?? null,
        numSimultaneousBreakoutRooms: (data.numSimultaneousBreakoutRooms as number) ?? null,
        setupDays: (data.setupDays as number) ?? null,
        rehearsalDays: (data.rehearsalDays as number) ?? null,
        showDays: (data.showDays as number) ?? null,
        strikeDays: (data.strikeDays as number) ?? null,
        ledSizeSqft: (data.ledSizeSqft as number) ?? null,
        projectionUsed: (data.projectionUsed as boolean) ?? null,
        cameraCount: (data.cameraCount as number) ?? null,
        audioComplexity: (data.audioComplexity as string) ?? null,
        videoComplexity: (data.videoComplexity as string) ?? null,
        ledComplexity: (data.ledComplexity as string) ?? null,
        lightingComplexity: (data.lightingComplexity as string) ?? null,
        scenicComplexity: (data.scenicComplexity as string) ?? null,
        unionLabor: (data.unionLabor as boolean) ?? null,
        eventDate: data.eventDate ? new Date(data.eventDate as string) : null,
        quotedAmount: (data.quotedAmount as number) ?? null,
        finalSellingPrice: (data.finalSellingPrice as number) ?? null,
        discountAmount: (data.discountAmount as number) ?? null,
        internalCost: (data.internalCost as number) ?? null,
        grossMargin: (data.grossMargin as number) ?? null,
        notes: (data.notes as string) ?? null,
        dataQuality: "IMPORTED_UNVERIFIED",
        importRowId: row.id,
      },
    });

    await prisma.historicalImportRow.update({ where: { id: row.id }, data: { status: "APPROVED" } });
  }

  await prisma.historicalImportBatch.update({ where: { id: batchId }, data: { status: "COMPLETED" } });

  redirect("/historical-shows");
}
