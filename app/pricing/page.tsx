import { prisma } from "@/lib/db/client";
import { createEquipmentItem, toggleEquipmentItemActive } from "@/lib/actions/admin";
import { DEPARTMENTS, EQUIPMENT_UNITS } from "@/lib/engine/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/form-field";

// Must never be statically cached, or admin edits to pricing don't show up
// here until the next deploy.
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [items, packages] = await Promise.all([
    prisma.equipmentItem.findMany({ orderBy: [{ department: "asc" }, { category: "asc" }, { name: "asc" }] }),
    prisma.equipmentPackage.findMany({
      orderBy: [{ department: "asc" }, { complexityLevel: "asc" }],
      include: { items: { include: { equipmentItem: true } } },
    }),
  ]);

  const itemsByDepartment = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByDepartment.get(item.department) ?? [];
    list.push(item);
    itemsByDepartment.set(item.department, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Equipment items and packages that drive the automated estimate.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Equipment Item</CardTitle>
        </CardHeader>
        <form action={createEquipmentItem} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Department">
            <Select name="department" required>
              {DEPARTMENTS.filter((d) => d !== "LABOR").map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <TextInput name="category" required placeholder="Console" />
          </Field>
          <Field label="Name">
            <TextInput name="name" required placeholder="Digital Audio Console" />
          </Field>
          <Field label="Sell rate ($)">
            <TextInput name="sellRate" type="number" min={0} required />
          </Field>
          <Field label="Cost ($)" hint="Optional">
            <TextInput name="cost" type="number" min={0} />
          </Field>
          <Field label="Unit">
            <Select name="unit" defaultValue="FLAT">
              {EQUIPMENT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-6">
            <Button type="submit">Add Item</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipment Items</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-6">
          {Array.from(itemsByDepartment.entries()).map(([department, deptItems]) => (
            <div key={department}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{department}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3">Category</th>
                      <th className="py-1.5 pr-3">Name</th>
                      <th className="py-1.5 pr-3">Sell Rate</th>
                      <th className="py-1.5 pr-3">Unit</th>
                      <th className="py-1.5 pr-3">Status</th>
                      <th className="py-1.5 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptItems.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-3 text-muted-foreground">{item.category}</td>
                        <td className="py-1.5 pr-3 font-medium text-foreground">{item.name}</td>
                        <td className="py-1.5 pr-3">${item.sellRate.toLocaleString()}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{item.unit}</td>
                        <td className="py-1.5 pr-3">
                          <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
                        </td>
                        <td className="py-1.5 pr-3">
                          <form action={toggleEquipmentItemActive.bind(null, item.id, !item.active)}>
                            <button type="submit" className="text-xs text-accent hover:underline">
                              {item.active ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipment Packages</CardTitle>
        </CardHeader>
        <p className="mb-4 text-xs text-muted-foreground">
          Packages let a salesperson pick a scale (Small/Medium/Large/Arena) instead of individual gear. Managed via seed data for V1 — package editing is a
          fast-follow.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{pkg.name}</p>
                <Badge>{pkg.complexityLevel}</Badge>
              </div>
              <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
                {pkg.items.map((i) => (
                  <li key={i.id}>
                    {i.quantity}x {i.equipmentItem.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
