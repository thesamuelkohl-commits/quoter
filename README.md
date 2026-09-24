# OTL Quoting & Budget Estimator

Internal quoting and budget-estimation tool for Orange Thread LIVE. Salespeople enter basic event
details and get a structured, explainable budget-estimate range built from OTL business rules,
equipment/labor pricing, and comparable historical shows — not an AI guess. See
`AI interprets. RULES calculate. DATA validates.` in `lib/engine/` for the guiding principle.

## Getting started

```bash
npm install
npm run db:seed   # creates prisma/dev.db and loads reference data + sample historical shows
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database is a local SQLite file (`prisma/dev.db`, gitignored) — no cloud account or network
dependency required. `npm run db:seed` is destructive to its own tables (it clears and re-seeds
labor/equipment/rules/historical-show data) and safe to re-run at any time.

## Project structure

- `app/` — Next.js App Router pages (Dashboard, New Estimate, Estimates, Historical Shows,
  Pricing, Rules, Insights, Admin)
- `lib/engine/` — the deterministic quoting engine: rules, crew staffing, equipment/labor pricing,
  comparable-event matching, confidence scoring, and the AI-interpretation seam. Pure functions,
  unit-tested independently of the UI/DB (`npm test`).
- `lib/actions/` — Next.js Server Actions that wire form submissions to the engine layer and
  Prisma.
- `lib/import/` — Excel/CSV parsing and column-mapping for the historical-data import flow.
- `prisma/schema.prisma` — the full V1 data model. `prisma/seed.ts` loads representative sample
  data (labor rates, equipment packages, crew rules including the breakout-technician ratio rule,
  travel/trucking assumptions, and ~18 generated historical shows).

## Commands

```bash
npm run dev        # start the dev server
npm run build       # production build
npm test            # run the engine-layer unit tests (vitest)
npm run lint         # eslint
npm run db:seed      # reset + reload sample data
npx prisma studio    # browse the local database
```

## Known V1 trade-offs

See the "Known Trade-offs / Future Tech Debt" section of the original project plan for the full
list. Highlights: SQLite is single-user/local only (move to Postgres before multiple concurrent
users); the AI-interpretation layer is a deterministic heuristic stub, not a live Claude call
(swap `lib/engine/ai-interpretation.ts`); Excel import maps flat one-row-per-event columns only.
