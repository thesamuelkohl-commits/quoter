import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { regenerateEstimate } from "@/lib/actions/estimates";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import type { ConfidenceLevel } from "@/lib/engine/types";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export default async function EstimateResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      client: true,
      venue: true,
      results: { orderBy: { generatedAt: "desc" }, take: 1 },
      crewItems: { include: { position: true } },
      lineItems: true,
      assumptions: true,
      comparables: { include: { historicalEvent: true }, orderBy: { rank: "asc" } },
      departments: true,
    },
  });

  if (!estimate) notFound();

  const result = estimate.results[0];
  const crewItems = [...estimate.crewItems].sort((a, b) => a.position.name.localeCompare(b.position.name));

  if (!result) {
    return (
      <div>
        <h1 className="text-xl font-semibold">{estimate.eventName}</h1>
        <p className="mt-4 text-sm text-muted-foreground">This estimate hasn&apos;t been generated yet.</p>
        <form action={regenerateEstimate.bind(null, estimate.id)} className="mt-4">
          <Button type="submit">Generate Estimate</Button>
        </form>
      </div>
    );
  }

  const explanation = result.explanation as {
    headline: string;
    why: string[];
    crewAssumptions: string[];
    majorVariables: string[];
    itemsRequiringConfirmation: string[];
    departmentSubtotals: Record<string, number>;
    equipmentTotal: number;
    laborTotal: number;
    travelLaborTotal: number;
    weekendSurchargeTotal: number;
    holidaySurchargeTotal: number;
    confidenceFactors: { label: string; points: number; detail: string }[];
  };

  const confidenceLevel = result.confidenceLevel as ConfidenceLevel;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/estimates" className="hover:underline">
              Estimates
            </Link>{" "}
            / {estimate.eventName}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{estimate.eventName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {estimate.client?.name ?? "No client"} · {estimate.eventType ?? "Unspecified type"} ·{" "}
            {[estimate.city, estimate.state].filter(Boolean).join(", ") || "No location"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={confidenceTone(confidenceLevel)}>{confidenceLevel} CONFIDENCE</Badge>
          <form action={regenerateEstimate.bind(null, estimate.id)}>
            <Button type="submit" variant="secondary">
              Regenerate
            </Button>
          </form>
          <LinkButton href={`/estimates/${estimate.id}`} variant="ghost">
            Edit inputs
          </LinkButton>
        </div>
      </div>

      <Card className="bg-accent-soft/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated Range</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {money(result.lowPrice)} – {money(result.highPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Most Likely</p>
            <p className="mt-1 text-2xl font-semibold text-accent">{money(result.mostLikelyPrice)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confidence Score</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{Math.round(result.confidenceScore)}/100</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Est. Margin</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{money(result.marginEstimate)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Why This Estimate</CardTitle>
            </CardHeader>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
              {explanation.why.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost by Department</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-1.5 text-sm">
              {Object.entries(explanation.departmentSubtotals).map(([dept, amount]) => (
                <div key={dept} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
                  <span className="text-foreground">{dept}</span>
                  <span className="font-medium text-foreground">{money(amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Equipment Total</span>
                <span>{money(explanation.equipmentTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Labor Total</span>
                <span>{money(explanation.laborTotal)}</span>
              </div>
              {explanation.travelLaborTotal > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>— incl. crew travel (half-day each way)</span>
                  <span>{money(explanation.travelLaborTotal)}</span>
                </div>
              )}
              {explanation.weekendSurchargeTotal > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>— incl. weekend Stagehand premium</span>
                  <span>{money(explanation.weekendSurchargeTotal)}</span>
                </div>
              )}
              {explanation.holidaySurchargeTotal > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>— incl. holiday surcharge</span>
                  <span>{money(explanation.holidaySurchargeTotal)}</span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommended Crew</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-3">Position</th>
                    <th className="py-1.5 pr-3">Qty</th>
                    <th className="py-1.5 pr-3">Days</th>
                    <th className="py-1.5 pr-3">OT Hrs</th>
                    <th className="py-1.5 pr-3">Cost</th>
                    <th className="py-1.5 pr-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {crewItems.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 font-medium text-foreground">{item.position.name}</td>
                      <td className="py-1.5 pr-3">{item.quantity}</td>
                      <td className="py-1.5 pr-3">{item.days}</td>
                      <td className="py-1.5 pr-3">{item.overtimeHours > 0 ? item.overtimeHours : "—"}</td>
                      <td className="py-1.5 pr-3">{money(item.totalCost)}</td>
                      <td className="py-1.5 pr-3">
                        <Badge tone={item.source === "HARD_RULE" ? "accent" : "neutral"}>{item.source.replace("_", " ")}</Badge>
                      </td>
                    </tr>
                  ))}
                  {crewItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-sm text-muted-foreground">
                        No crew positions were determined for this estimate.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {explanation.crewAssumptions.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Similar Historical OTL Events</CardTitle>
            </CardHeader>
            {estimate.comparables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No closely comparable historical events were found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3">Event</th>
                      <th className="py-1.5 pr-3">Attendees</th>
                      <th className="py-1.5 pr-3">Location</th>
                      <th className="py-1.5 pr-3">Match</th>
                      <th className="py-1.5 pr-3">Final Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.comparables.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-3 font-medium text-foreground">{c.historicalEvent.eventName}</td>
                        <td className="py-1.5 pr-3">{c.historicalEvent.attendees ?? "—"}</td>
                        <td className="py-1.5 pr-3">
                          {[c.historicalEvent.city, c.historicalEvent.state].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="py-1.5 pr-3">{Math.round(c.similarityScore * 100)}%</td>
                        <td className="py-1.5 pr-3">{money(c.historicalEvent.finalSellingPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Confidence Breakdown</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2 text-xs">
              {explanation.confidenceFactors.map((f, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{f.label}</p>
                    <p className="text-muted-foreground">{f.detail}</p>
                  </div>
                  <span className={`shrink-0 font-mono ${f.points < 0 ? "text-danger" : "text-foreground"}`}>
                    {f.points > 0 ? "+" : ""}
                    {f.points}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Major Cost Drivers</CardTitle>
            </CardHeader>
            {explanation.majorVariables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unusual cost drivers identified.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {explanation.majorVariables.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assumptions Made</CardTitle>
            </CardHeader>
            {estimate.assumptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assumptions were required.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {estimate.assumptions.map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <Badge tone={a.confidence === "LOW" ? "warning" : "neutral"} className="mt-0.5 shrink-0">
                      {a.confidence}
                    </Badge>
                    <span className="text-foreground">{a.assumptionText}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-warning/30">
            <CardHeader>
              <CardTitle>Needs Human Confirmation</CardTitle>
            </CardHeader>
            {explanation.itemsRequiringConfirmation.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing flagged — still confirm scope with the client before quoting.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {explanation.itemsRequiringConfirmation.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-border" />
                    <span className="text-foreground">{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
