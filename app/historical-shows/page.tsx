import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";

export default async function HistoricalShowsPage() {
  const events = await prisma.historicalEvent.findMany({ orderBy: { eventDate: "desc" } });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Historical Shows</h1>
          <p className="mt-1 text-sm text-muted-foreground">{events.length} events on file — the comparable engine matches new estimates against these.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/historical-shows/import" variant="secondary">
            Import from Excel
          </LinkButton>
          <LinkButton href="/historical-shows/new">Add Show</LinkButton>
        </div>
      </div>

      {events.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">No historical events yet.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Event</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5">Attendees</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Final Price</th>
                <th className="px-4 py-2.5">Data Quality</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-surface-muted/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/historical-shows/${e.id}`} className="font-medium text-foreground hover:underline">
                      {e.eventName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.eventType ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{[e.city, e.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-2.5">{e.attendees ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.eventDate ? new Date(e.eventDate).toLocaleDateString("en-US", { timeZone: "UTC" }) : "—"}</td>
                  <td className="px-4 py-2.5">{e.finalSellingPrice ? `$${Math.round(e.finalSellingPrice).toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={e.dataQuality === "VERIFIED" ? "success" : "warning"}>{e.dataQuality.replace("_", " ")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
