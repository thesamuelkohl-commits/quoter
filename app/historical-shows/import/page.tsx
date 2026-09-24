import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { uploadHistoricalImport } from "@/lib/actions/import";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ImportHistoricalShowsPage() {
  const batches = await prisma.historicalImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { rows: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/historical-shows" className="hover:underline">
            Historical Shows
          </Link>{" "}
          / Import
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Import from Excel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a spreadsheet of past shows. You&apos;ll map its columns to OTL fields and review every row before anything is added to
          the historical database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload a file</CardTitle>
        </CardHeader>
        <form action={uploadHistoricalImport} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground" htmlFor="file">
              Excel or CSV file
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              required
              className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-foreground"
            />
          </div>
          <Button type="submit">Upload &amp; Continue</Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past Imports</CardTitle>
        </CardHeader>
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {batches.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <Link href={`/historical-shows/import/${b.id}`} className="font-medium text-foreground hover:underline">
                  {b.originalFilename}
                </Link>
                <span className="flex items-center gap-3 text-muted-foreground">
                  {b._count.rows} rows
                  <Badge tone={b.status === "COMPLETED" ? "success" : "neutral"}>{b.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
