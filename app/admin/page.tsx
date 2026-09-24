import { prisma } from "@/lib/db/client";
import { createLaborRate, toggleLaborRateActive, createTravelAssumption, createTruckingRate, updateAppSetting } from "@/lib/actions/admin";
import { RATE_TYPES } from "@/lib/engine/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/form-field";

// Must never be statically cached, or admin edits don't show up here until
// the next deploy.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [laborRates, positions, travelAssumptions, truckingRates, appSettings] = await Promise.all([
    prisma.laborRate.findMany({ orderBy: { standardRate: "desc" }, include: { position: true } }),
    prisma.laborPosition.findMany({ orderBy: { name: "asc" } }),
    prisma.travelAssumption.findMany({ orderBy: { city: "asc" } }),
    prisma.truckingRate.findMany({ orderBy: { originRegion: "asc" } }),
    prisma.appSetting.findMany({ orderBy: { key: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Labor rates, travel/trucking assumptions, and margin thresholds.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Margin Thresholds</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          {appSettings.map((s) => (
            <form key={s.id} action={updateAppSetting.bind(null, s.key)} className="flex items-end gap-3">
              <Field label={s.description ?? s.key}>
                <TextInput name="value" type="number" defaultValue={typeof s.value === "number" ? s.value : undefined} className="w-32" />
              </Field>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Labor Rates</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">Position</th>
                <th className="py-1.5 pr-3">Region</th>
                <th className="py-1.5 pr-3">Type</th>
                <th className="py-1.5 pr-3">Rate</th>
                <th className="py-1.5 pr-3">OT Multiplier</th>
                <th className="py-1.5 pr-3">Status</th>
                <th className="py-1.5 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {laborRates.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-3 font-medium text-foreground">{r.position.name}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{r.region}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{r.rateType}</td>
                  <td className="py-1.5 pr-3">${r.standardRate.toLocaleString()}</td>
                  <td className="py-1.5 pr-3">{r.overtimeMultiplier}x</td>
                  <td className="py-1.5 pr-3">
                    <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="py-1.5 pr-3">
                    <form action={toggleLaborRateActive.bind(null, r.id, !r.active)}>
                      <button type="submit" className="text-xs text-accent hover:underline">
                        {r.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createLaborRate} className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Position">
            <Select name="positionId" required>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Region">
            <TextInput name="region" defaultValue="default" />
          </Field>
          <Field label="Rate type">
            <Select name="rateType" defaultValue="DAY">
              {RATE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Standard rate">
            <TextInput name="standardRate" type="number" min={0} required />
          </Field>
          <Field label="OT multiplier">
            <TextInput name="overtimeMultiplier" type="number" step="0.1" defaultValue={1.5} />
          </Field>
          <div className="flex items-end">
            <Button type="submit">Add Rate</Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Travel Assumptions</CardTitle>
          </CardHeader>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {travelAssumptions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5">
                <span className="text-foreground">
                  {t.city}
                  {t.state ? `, ${t.state}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.flightRequired ? "Flight" : "Drive"} · ${t.hotelNightlyRate ?? "—"}/night · ${t.perDiemRate ?? "—"}/day
                </span>
              </li>
            ))}
          </ul>
          <form action={createTravelAssumption} className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <Field label="City">
              <TextInput name="city" required />
            </Field>
            <Field label="State">
              <TextInput name="state" maxLength={2} />
            </Field>
            <Field label="Hotel/night">
              <TextInput name="hotelNightlyRate" type="number" min={0} />
            </Field>
            <Field label="Per diem/day">
              <TextInput name="perDiemRate" type="number" min={0} />
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="flightRequired" className="h-4 w-4 rounded border-border" />
              Requires air travel
            </label>
            <div className="col-span-2">
              <Button type="submit" variant="secondary">
                Add City
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trucking Rates</CardTitle>
          </CardHeader>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {truckingRates.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5">
                <span className="text-foreground">{t.originRegion}</span>
                <span className="text-xs text-muted-foreground">
                  ${t.rate.toLocaleString()} ({t.rateType})
                </span>
              </li>
            ))}
          </ul>
          <form action={createTruckingRate} className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <Field label="Region">
              <TextInput name="originRegion" required />
            </Field>
            <Field label="Rate ($)">
              <TextInput name="rate" type="number" min={0} required />
            </Field>
            <div className="col-span-2">
              <Button type="submit" variant="secondary">
                Add Region
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
