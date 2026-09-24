import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { updateEstimate } from "@/lib/actions/estimates";
import { EstimateForm, type EstimateFormValues } from "@/components/estimates/estimate-form";
import type { ComplexityLevel, Department } from "@/lib/engine/types";

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [estimate, addOns] = await Promise.all([
    prisma.estimate.findUnique({ where: { id }, include: { client: true, departments: true } }),
    prisma.equipmentItem.findMany({ where: { department: "ADDONS", active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!estimate) notFound();

  const addOnsDept = estimate.departments.find((d) => d.department === "ADDONS");
  const selectedAddOnIds = ((addOnsDept?.structuredRequirements as { selectedItemIds?: string[] } | null)?.selectedItemIds ?? []) as string[];

  const departments: EstimateFormValues["departments"] = {};
  for (const dept of estimate.departments) {
    const structured = (dept.structuredRequirements as Record<string, unknown> | null) ?? {};
    departments[dept.department as Department] = {
      complexityLevel: dept.complexityLevel as ComplexityLevel,
      notes: dept.requirementsText,
      cameraCount: typeof structured.cameraCount === "number" ? structured.cameraCount : undefined,
      projectionUsed: Boolean(structured.projectionUsed),
      ledSizeSqft: typeof structured.ledSizeSqft === "number" ? structured.ledSizeSqft : undefined,
    };
  }

  const defaultValues: EstimateFormValues = {
    eventName: estimate.eventName,
    clientName: estimate.client?.name,
    attendees: estimate.attendees,
    roomSqft: estimate.roomSqft,
    targetBudget: estimate.targetBudget,
    numGeneralSessionRooms: estimate.numGeneralSessionRooms,
    numBreakoutRooms: estimate.numBreakoutRooms,
    numSimultaneousBreakoutRooms: estimate.numSimultaneousBreakoutRooms,
    showStartDate: estimate.showStartDate ? estimate.showStartDate.toISOString().slice(0, 10) : undefined,
    showEndDate: estimate.showEndDate ? estimate.showEndDate.toISOString().slice(0, 10) : undefined,
    hoursPerDay: (estimate.dailySchedule as { hoursPerDay?: number } | null)?.hoursPerDay,
    setupDays: estimate.setupDays,
    rehearsalDays: estimate.rehearsalDays,
    showDays: estimate.showDays,
    strikeDays: estimate.strikeDays,
    darkDays: estimate.darkDays,
    unionLabor: estimate.unionLabor,
    isTravelGig: estimate.isTravelGig,
    isHoliday: estimate.isHoliday,
    specialRequirements: estimate.specialRequirements ?? undefined,
    createdBy: estimate.createdBy ?? undefined,
    departments,
    selectedAddOnIds,
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs text-muted-foreground">
          <Link href="/estimates" className="hover:underline">
            Estimates
          </Link>{" "}
          /{" "}
          <Link href={`/estimates/${estimate.id}/results`} className="hover:underline">
            {estimate.eventName}
          </Link>{" "}
          / Edit
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Edit Estimate</h1>
        <p className="mt-1 text-sm text-muted-foreground">Saving will regenerate the estimate with your changes.</p>
      </div>
      <EstimateForm
        action={updateEstimate.bind(null, estimate.id)}
        defaultValues={defaultValues}
        submitLabel="Save & Regenerate"
        addOns={addOns.map((a) => ({ id: a.id, name: a.name, sellRate: a.sellRate }))}
      />
    </div>
  );
}
