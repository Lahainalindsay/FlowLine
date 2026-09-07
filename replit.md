# StageTime

StageTime is a live event timing platform for planning a run of show, operating a server-authoritative timer, and synchronizing speaker or stage displays.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY`. Stripe uses the attached Replit connection; no raw Stripe key is required.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/flowline/` — StageTime React/Vite operator workspace and presentation display
- `artifacts/api-server/src/routes/flowline.ts` — StageTime HTTP API implementation (legacy path retained for compatibility)
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/api-client-react/` and `lib/api-zod/` — generated clients and validation schemas
- `lib/db/src/schema/events.ts` — event, agenda, display, and live-session persistence
- `artifacts/api-server/src/lib/seed.ts` — example Horizon Summit workspace data

## Architecture decisions

- The server owns timer state. Clients render local one-second ticks between authoritative refreshes.
- Overtime remains an advancing state and can be paused, resumed, reset, or moved to the next segment.
- Agenda imports are previewed first and applied in one database transaction to prevent partial or scrambled schedules.
- Live-session transitions update agenda status in the same transaction so operator and display views agree.
- Clerk owns operator authentication; operator APIs derive ownership from the verified server session.
- Guest displays use revocable, expiring access rows, hashed short codes, and HMAC-signed read-only tokens.
- Stripe is accessed only with `@replit/connectors-sdk` through the attached proxy-only connection. The app never retrieves, stores, logs, or configures raw Stripe credentials.
- Stripe webhook bodies are used solely to extract a strictly validated `evt_` ID (and require `stripe-signature`). Because the connector intentionally withholds the signing secret, the server retrieves that event through the authenticated proxy and processes only this canonical response. Idempotent entitlement upserts make webhook retries safe.
- Replit Publish applies the development database schema diff to production. We use development `drizzle-kit push` for additive changes only; there is no startup DDL or custom production migration script.
- Checkout attempts are allocated under a workspace subscription row lock and use a durable, server-generated Stripe idempotency key. Retries reuse an open same-plan session rather than creating another subscription.

## Product

- Create persistent events with venue, date, and timezone.
- Build, reorder, update, delete, or import a run of show.
- Start, pause, resume, reset, extend, and advance a live event timer.
- Send operator messages and production cues to registered presentation displays.
- Use responsive operator controls on desktop or mobile.
- Open display-specific speaker/stage presentation links with synchronized timing.
- Sign in with a private operator account; event records are isolated by Clerk user ownership.
- Pair unauthenticated guest devices with a QR code or six-character code for read-only timer access.

## Migration-safe legacy identifiers

- User-facing branding is StageTime. Internal `flowline` package folders, API source paths, database table names, and database index names remain intentionally unchanged to preserve deployed integrations and existing data.

## Gotchas

- Run API code generation after every OpenAPI change, before typechecking callers.
- Do not write agenda imports as concurrent single-row requests; use the atomic import endpoint.
- A session can be `overtime` while its clock is still advancing.
- Public guest tokens never authorize operator commands; keep all event mutations behind Clerk authentication and ownership checks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
