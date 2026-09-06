# Flowline

Flowline is a live event timing platform for planning a run of show, operating a server-authoritative timer, and synchronizing speaker or stage displays.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/flowline/` — React/Vite operator workspace and presentation display
- `artifacts/api-server/src/routes/flowline.ts` — Flowline HTTP API implementation
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/api-client-react/` and `lib/api-zod/` — generated clients and validation schemas
- `lib/db/src/schema/events.ts` — event, agenda, display, and live-session persistence
- `artifacts/api-server/src/lib/seed.ts` — example Horizon Summit workspace data

## Architecture decisions

- The server owns timer state. Clients render local one-second ticks between authoritative refreshes.
- Overtime remains an advancing state and can be paused, resumed, reset, or moved to the next segment.
- Agenda imports are previewed first and applied in one database transaction to prevent partial or scrambled schedules.
- Live-session transitions update agenda status in the same transaction so operator and display views agree.
- Authentication is intentionally not enabled until an external identity provider is approved; do not add homegrown password storage.

## Product

- Create persistent events with venue, date, and timezone.
- Build, reorder, update, delete, or import a run of show.
- Start, pause, resume, reset, extend, and advance a live event timer.
- Send operator messages and production cues to registered presentation displays.
- Use responsive operator controls on desktop or mobile.
- Open display-specific speaker/stage presentation links with synchronized timing.

## User preferences

- Keep Flowline original; do not copy StageTimer branding, design, copy, or trade dress.

## Gotchas

- Run API code generation after every OpenAPI change, before typechecking callers.
- Do not write agenda imports as concurrent single-row requests; use the atomic import endpoint.
- A session can be `overtime` while its clock is still advancing.
- Auth routes are visual placeholders until the user approves an identity-provider integration.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
