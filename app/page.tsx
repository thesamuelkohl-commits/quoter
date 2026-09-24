import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import type { ConfidenceLevel } from "@/lib/engine/types";

export default async function DashboardPage() {
  const [estimateCount, historicalCount, recentEstimates] = await Promise.all([
    prisma.estimate.count(),
    prisma.historicalEvent.count(),
    prisma.estimate.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { client: true, results: { orderBy: { generatedAt: "desc" }, take: 1 } },
    }),
  ]);

  const calculatedCount = await prisma.estimate.count({ where: { status: "CALCULATED" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Orange Thread LIVE — Quoting &amp; Budget Estimator</p>
        </div>
        <LinkButton href="/estimates/new">New Estimate</LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimates</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{estimateCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{calculatedCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Historical Shows on File</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{historicalCount}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Estimates</CardTitle>
        </CardHeader>
        {recentEstimates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No estimates yet.{" "}
            <Link href="/estimates/new" className="text-accent hover:underline">
              Create your first one
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {recentEstimates.map((e) => {
              const result = e.results[0];
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <Link href={result ? `/estimates/${e.id}/results` : `/estimates/${e.id}`} className="text-sm font-medium text-foreground hover:underline">
                      {e.eventName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{e.client?.name ?? "No client"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {result && <span className="text-sm text-foreground">${Math.round(result.mostLikelyPrice).toLocaleString()}</span>}
                    {result && <Badge tone={confidenceTone(result.confidenceLevel as ConfidenceLevel)}>{result.confidenceLevel}</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
