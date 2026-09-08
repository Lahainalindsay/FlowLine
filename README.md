# FlowLine

FlowLine is a pnpm workspace containing the StageTime React/Vite frontend, Express API, shared OpenAPI clients, and PostgreSQL/Drizzle schema.

## Deploying to Railway

1. Create a Railway project and deploy this GitHub repository.
2. Add a Railway PostgreSQL service.
3. In the app service variables, set `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
4. Add the required application variables: `NODE_ENV=production`, `SESSION_SECRET`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, and `BASE_PATH=/`.
5. Use the Railway build command from `railway.toml`: `pnpm install --frozen-lockfile && pnpm run build`.
6. Use the Railway start command from `railway.toml`: `pnpm start`.
7. Apply database migrations after `DATABASE_URL` is set: `pnpm db:migrate`.
8. Generate a Railway domain for the app service.
9. In Clerk, configure the Railway production domain as an allowed origin and add the Railway sign-in/sign-up redirect URLs:
   - `https://<railway-domain>/`
   - `https://<railway-domain>/sign-in`
   - `https://<railway-domain>/sign-up`
10. Smoke test the deployment:
   - `GET https://<railway-domain>/health`
   - Open `https://<railway-domain>/`
   - Sign in through Clerk
   - Create or open an event
   - Confirm the event stream and public display stream stay connected

Railway runs the app as one production service. Express serves `/api/*` and the built Vite frontend from `artifacts/flowline/dist/public`. Replit support remains in `.replit` and the `.replit-artifact` configs.
