import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { Card } from "@/components/ui/card";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { DeleteEstimateButton } from "@/components/estimates/delete-estimate-button";
import type { ConfidenceLevel } from "@/lib/engine/types";

// Must never be statically cached, or newly created/deleted estimates
// won't show up here until the next deploy.
export const dynamic = "force-dynamic";

export default async function EstimatesListPage() {
  const estimates = await prisma.estimate.findMany({
    orderBy: { updatedAt: "desc" },
    include: { client: true, results: { orderBy: { generatedAt: "desc" }, take: 1 } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Estimates</h1>
          <p className="mt-1 text-sm text-muted-foreground">{estimates.length} total</p>
        </div>
        <LinkButton href="/estimates/new">New Estimate</LinkButton>
      </div>

      {estimates.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">No estimates yet.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Event</th>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Most Likely</th>
                <th className="px-4 py-2.5">Confidence</th>
                <th className="px-4 py-2.5">Updated</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => {
                const result = e.results[0];
                return (
                  <tr key={e.id} className="border-t border-border hover:bg-surface-muted/60">
                    <td className="px-4 py-2.5">
                      <Link href={result ? `/estimates/${e.id}/results` : `/estimates/${e.id}`} className="font-medium text-foreground hover:underline">
                        {e.eventName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.client?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge>{e.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">{result ? `$${Math.round(result.mostLikelyPrice).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-2.5">
                      {result ? <Badge tone={confidenceTone(result.confidenceLevel as ConfidenceLevel)}>{result.confidenceLevel}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.updatedAt.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <DeleteEstimateButton estimateId={e.id} eventName={e.eventName} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
