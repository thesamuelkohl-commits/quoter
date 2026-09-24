import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { applyColumnMapping, approveImportBatch } from "@/lib/actions/import";
import { TARGET_FIELDS } from "@/lib/import/column-mapper";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PREVIEW_LIMIT = 25;

export default async function ImportBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const batch = await prisma.historicalImportBatch.findUnique({
    where: { id: batchId },
    include: { rows: { orderBy: { rowIndex: "asc" } } },
  });
  if (!batch) notFound();

  const headers = batch.rows.length > 0 ? Object.keys(batch.rows[0].rawData as Record<string, unknown>) : [];
  const currentMapping = (batch.columnMapping as Record<string, string> | null) ?? {};

  const isMapped = batch.status !== "UPLOADED";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/historical-shows/import" className="hover:underline">
            Import
          </Link>{" "}
          / {batch.originalFilename}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{batch.originalFilename}</h1>
          <Badge tone={batch.status === "COMPLETED" ? "success" : "neutral"}>{batch.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{batch.rows.length} rows detected. The original file is kept on disk for audit.</p>
      </div>

      {!isMapped ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Map Columns</CardTitle>
          </CardHeader>
          <p className="mb-4 text-xs text-muted-foreground">
            We guessed a mapping from your column headers — double-check each one before continuing. Columns left as &quot;Ignore&quot;
            won&apos;t be imported.
          </p>
          <form action={applyColumnMapping.bind(null, batch.id)} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((header) => (
                <div key={header} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-foreground">{header}</label>
                  <Select name={`map_${header}`} defaultValue={currentMapping[header] ?? ""}>
                    <option value="">Ignore this column</option>
                    {TARGET_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end">
              <Button type="submit">Apply Mapping &amp; Preview</Button>
            </div>
          </form>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Review &amp; Approve</CardTitle>
            </CardHeader>
            <p className="mb-4 text-xs text-muted-foreground">
              Showing the first {Math.min(PREVIEW_LIMIT, batch.rows.length)} of {batch.rows.length} mapped rows. Re-map columns above if
              something looks wrong, or approve to add these as historical events (marked &quot;imported unverified&quot; until reviewed
              further).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-3">#</th>
                    <th className="py-1.5 pr-3">Event Name</th>
                    <th className="py-1.5 pr-3">Client</th>
                    <th className="py-1.5 pr-3">City</th>
                    <th className="py-1.5 pr-3">Attendees</th>
                    <th className="py-1.5 pr-3">Final Price</th>
                    <th className="py-1.5 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.rows.slice(0, PREVIEW_LIMIT).map((row) => {
                    const data = (row.mappedData as Record<string, unknown> | null) ?? {};
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-3 text-muted-foreground">{row.rowIndex + 1}</td>
                        <td className="py-1.5 pr-3 font-medium text-foreground">{(data.eventName as string) ?? "—"}</td>
                        <td className="py-1.5 pr-3">{(data.clientName as string) ?? "—"}</td>
                        <td className="py-1.5 pr-3">{(data.city as string) ?? "—"}</td>
                        <td className="py-1.5 pr-3">{(data.attendees as number) ?? "—"}</td>
                        <td className="py-1.5 pr-3">
                          {data.finalSellingPrice ? `$${Math.round(data.finalSellingPrice as number).toLocaleString()}` : "—"}
                        </td>
                        <td className="py-1.5 pr-3">
                          <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>{row.status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            {batch.status !== "COMPLETED" && (
              <form action={approveImportBatch.bind(null, batch.id)}>
                <Button type="submit">Approve &amp; Import All Rows</Button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
