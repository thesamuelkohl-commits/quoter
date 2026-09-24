import { prisma } from "@/lib/db/client";
import { createEstimate } from "@/lib/actions/estimates";
import { EstimateForm } from "@/components/estimates/estimate-form";

export default async function NewEstimatePage() {
  const addOns = await prisma.equipmentItem.findMany({
    where: { department: "ADDONS", active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">New Estimate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in what you know. Anything left blank will be filled with a reasonable assumption — and every assumption will be shown to
          you on the results page.
        </p>
      </div>
      <EstimateForm action={createEstimate} addOns={addOns.map((a) => ({ id: a.id, name: a.name, sellRate: a.sellRate }))} />
    </div>
  );
}
