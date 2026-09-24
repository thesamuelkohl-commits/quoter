import { prisma } from "@/lib/db/client";
import { computeGlobalPattern, type HistoricalEventForPatternMining } from "@/lib/engine/crew-engine";
import { CANDIDATE_PATTERNS } from "@/lib/insights/candidate-patterns";
import { approveLearnedPattern } from "@/lib/actions/admin";
import type { ComplexityLevel, EventProfile } from "@/lib/engine/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const HOME_CITY = "nashville";

function toProfile(e: {
  eventType: string | null;
  city: string | null;
  state: string | null;
  attendees: number | null;
  roomSqft: number | null;
  numGeneralSessionRooms: number | null;
  numBreakoutRooms: number | null;
  numSimultaneousBreakoutRooms: number | null;
  setupDays: number | null;
  rehearsalDays: number | null;
  showDays: number | null;
  strikeDays: number | null;
  ledSizeSqft: number | null;
  projectionUsed: boolean | null;
  cameraCount: number | null;
  audioComplexity: string | null;
  videoComplexity: string | null;
  ledComplexity: string | null;
  lightingComplexity: string | null;
  scenicComplexity: string | null;
  unionLabor: boolean | null;
}): EventProfile {
  return {
    eventType: e.eventType,
    city: e.city,
    state: e.state,
    attendees: e.attendees,
    roomSqft: e.roomSqft,
    numGeneralSessionRooms: e.numGeneralSessionRooms,
    numBreakoutRooms: e.numBreakoutRooms,
    numSimultaneousBreakoutRooms: e.numSimultaneousBreakoutRooms,
    setupDays: e.setupDays,
    rehearsalDays: e.rehearsalDays,
    showDays: e.showDays,
    strikeDays: e.strikeDays,
    ledSizeSqft: e.ledSizeSqft,
    projectionUsed: e.projectionUsed,
    cameraCount: e.cameraCount,
    audioComplexity: e.audioComplexity as ComplexityLevel | null,
    videoComplexity: e.videoComplexity as ComplexityLevel | null,
    ledComplexity: e.ledComplexity as ComplexityLevel | null,
    lightingComplexity: e.lightingComplexity as ComplexityLevel | null,
    scenicComplexity: e.scenicComplexity as ComplexityLevel | null,
    unionLabor: e.unionLabor,
    travelRequired: e.city ? e.city.trim().toLowerCase() !== HOME_CITY : null,
  };
}

export default async function InsightsPage() {
  const [historicalEvents, positions, activeRules] = await Promise.all([
    prisma.historicalEvent.findMany({ include: { crew: { include: { position: true } } } }),
    prisma.laborPosition.findMany(),
    prisma.crewRule.findMany({ where: { active: true }, include: { position: true } }),
  ]);

  const positionByName = new Map(positions.map((p) => [p.name, p]));
  const activeRulePositionNames = new Set(activeRules.map((r) => r.position.name));

  const eventsForMining: HistoricalEventForPatternMining[] = historicalEvents.map((e) => ({
    id: e.id,
    profile: toProfile(e),
    crewPositionIds: new Set(e.crew.map((c) => c.positionId)),
  }));

  const results = CANDIDATE_PATTERNS.map((candidate) => {
    const position = positionByName.get(candidate.positionName);
    if (!position) return null;

    const pattern = computeGlobalPattern(
      { positionId: position.id, positionName: position.name, conditionText: candidate.conditionText, matchesCondition: candidate.matchesCondition },
      eventsForMining,
    );
    if (!pattern) return null;

    const matchingEvents = historicalEvents.filter((e) => candidate.matchesCondition(toProfile(e)));
    const quantities = matchingEvents
      .flatMap((e) => e.crew.filter((c) => c.positionId === position.id).map((c) => c.quantity))
      .filter((q) => q > 0);
    const avgQuantity = quantities.length > 0 ? Math.max(1, Math.round(quantities.reduce((s, q) => s + q, 0) / quantities.length)) : 1;

    return { candidate, position, pattern, avgQuantity, hasActiveRule: activeRulePositionNames.has(position.name) };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Learned staffing patterns mined from historical shows. Nothing here becomes a rule automatically — approve a pattern to turn it
          into an official OTL crew rule.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {results.map(({ candidate, position, pattern, avgQuantity, hasActiveRule }) => (
          <Card key={`${position.id}-${candidate.conditionText}`}>
            <CardHeader>
              <CardTitle>{candidate.positionName}</CardTitle>
              <Badge tone={confidenceTone(pattern.confidenceLevel)}>{pattern.confidenceLevel}</Badge>
            </CardHeader>
            <p className="text-sm text-foreground">
              Among <strong>{pattern.sampleSize}</strong> comparable historical events matching &quot;{candidate.conditionText}&quot;,{" "}
              <strong>{pattern.matchCount}</strong> ({Math.round(pattern.confidenceScore * 100)}%) used a dedicated {candidate.positionName}
              , typically {avgQuantity}.
            </p>
            <div className="mt-3">
              {hasActiveRule ? (
                <p className="text-xs text-muted-foreground">An active hard rule already covers {candidate.positionName}.</p>
              ) : pattern.confidenceLevel === "HIGH" ? (
                <form
                  action={approveLearnedPattern.bind(
                    null,
                    position.id,
                    `${candidate.positionName} — ${candidate.conditionText}`,
                    `Learned from ${pattern.sampleSize} historical events (${pattern.matchCount} matched, ${Math.round(pattern.confidenceScore * 100)}%): ${candidate.conditionText}.`,
                    { type: "fixed", quantity: avgQuantity },
                    1,
                  )}
                >
                  <Button type="submit" variant="secondary">
                    Approve as Rule
                  </Button>
                </form>
              ) : (
                <p className="text-xs text-muted-foreground">Confidence not yet high enough to recommend approving.</p>
              )}
            </div>
          </Card>
        ))}
        {results.length === 0 && (
          <Card>
            <p className="text-sm text-muted-foreground">Not enough historical data yet to compute any patterns.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
