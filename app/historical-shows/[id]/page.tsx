import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export default async function HistoricalShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.historicalEvent.findUnique({
    where: { id },
    include: { equipment: true, crew: { include: { position: true } } },
  });
  if (!event) notFound();

  const fields: [string, string | number | null][] = [
    ["Event type", event.eventType],
    ["Client", event.clientName],
    ["Venue", event.venueName],
    ["Location", [event.city, event.state].filter(Boolean).join(", ") || null],
    ["Attendees", event.attendees],
    ["Room sqft", event.roomSqft],
    ["General session rooms", event.numGeneralSessionRooms],
    ["Breakout rooms", event.numBreakoutRooms],
    ["Simultaneous breakout rooms", event.numSimultaneousBreakoutRooms],
    ["Setup days", event.setupDays],
    ["Rehearsal days", event.rehearsalDays],
    ["Show days", event.showDays],
    ["Strike days", event.strikeDays],
    ["LED size (sqft)", event.ledSizeSqft],
    ["Projection used", event.projectionUsed === null ? null : event.projectionUsed ? "Yes" : "No"],
    ["Camera count", event.cameraCount],
    ["Audio complexity", event.audioComplexity],
    ["Video complexity", event.videoComplexity],
    ["LED complexity", event.ledComplexity],
    ["Lighting complexity", event.lightingComplexity],
    ["Scenic complexity", event.scenicComplexity],
    ["Union labor", event.unionLabor === null ? null : event.unionLabor ? "Yes" : "No"],
    ["Event date", event.eventDate ? new Date(event.eventDate).toLocaleDateString() : null],
  ];

  const financials: [string, string][] = [
    ["Quoted amount", money(event.quotedAmount)],
    ["Final selling price", money(event.finalSellingPrice)],
    ["Discount", money(event.discountAmount)],
    ["Internal cost", money(event.internalCost)],
    ["Gross margin", money(event.grossMargin)],
  ];

  const costByDepartment: Record<string, number> = {};
  for (const eq of event.equipment) {
    if (eq.cost === null) continue;
    costByDepartment[eq.department] = (costByDepartment[eq.department] ?? 0) + eq.cost;
  }
  const crewCostTotal = event.crew.reduce((sum, c) => sum + (c.cost ?? 0), 0);
  const equipmentCostTotal = Object.values(costByDepartment).reduce((sum, v) => sum + v, 0);
  const trackedTotal = equipmentCostTotal + crewCostTotal;
  const hasCostData = trackedTotal > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/historical-shows" className="hover:underline">
            Historical Shows
          </Link>{" "}
          / {event.eventName}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{event.eventName}</h1>
          <Badge tone={event.dataQuality === "VERIFIED" ? "success" : "warning"}>{event.dataQuality.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
            {fields.map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-border py-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {event.notes && <p className="mt-4 text-sm text-muted-foreground">{event.notes}</p>}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financials</CardTitle>
          </CardHeader>
          <dl className="flex flex-col gap-2 text-sm">
            {financials.map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-border py-1.5 last:border-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {hasCostData && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Cost by Department</CardTitle>
            </CardHeader>
            <p className="mb-4 text-xs text-muted-foreground">
              Only lines with a known real cost are counted here — departments below reflect what was actually attributable on the
              invoice, not a full accounting of every dollar.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(costByDepartment)
                .sort(([, a], [, b]) => b - a)
                .map(([dept, amount]) => (
                  <div key={dept} className="flex items-center justify-between border-b border-border py-1.5">
                    <span className="text-foreground">{dept}</span>
                    <span className="font-medium text-foreground">{money(amount)}</span>
                  </div>
                ))}
              <div className="flex items-center justify-between border-b border-border py-1.5">
                <span className="text-foreground">CREW</span>
                <span className="font-medium text-foreground">{money(crewCostTotal)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Tracked Total</span>
              <span>{money(trackedTotal)}</span>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Equipment</CardTitle>
          </CardHeader>
          {event.equipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">No equipment recorded.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {event.equipment.map((eq) => (
                <li key={eq.id} className="flex items-start justify-between gap-3 py-1.5">
                  <span>
                    <span className="text-foreground">{eq.name}</span>{" "}
                    <span className="text-xs text-muted-foreground">({eq.department})</span>
                    {eq.notes && <span className="block text-xs text-muted-foreground">{eq.notes}</span>}
                  </span>
                  <span className="shrink-0 text-right text-muted-foreground">
                    x{eq.quantity}
                    {eq.cost !== null && <span className="block text-foreground">{money(eq.cost)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Crew</CardTitle>
          </CardHeader>
          {event.crew.length === 0 ? (
            <p className="text-sm text-muted-foreground">No crew recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-3">Position</th>
                    <th className="py-1.5 pr-3">Qty</th>
                    <th className="py-1.5 pr-3">Days</th>
                    <th className="py-1.5 pr-3">Hours</th>
                    <th className="py-1.5 pr-3">OT Hours</th>
                    <th className="py-1.5 pr-3">Cost</th>
                    <th className="py-1.5 pr-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {event.crew.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 font-medium text-foreground">{c.position.name}</td>
                      <td className="py-1.5 pr-3">{c.quantity}</td>
                      <td className="py-1.5 pr-3">{c.days}</td>
                      <td className="py-1.5 pr-3">{c.hours ?? "—"}</td>
                      <td className="py-1.5 pr-3">{c.overtimeHours || "—"}</td>
                      <td className="py-1.5 pr-3">{money(c.cost)}</td>
                      <td className="py-1.5 pr-3 text-xs text-muted-foreground">{c.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
