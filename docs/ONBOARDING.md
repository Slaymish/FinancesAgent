# FinanceAgent Onboarding

Quick notes to get oriented.

## Quickstart (end-to-end)

```bash
pnpm i
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm --filter @finance-agent/api seed:sample
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/health

## Repo map

- `apps/api/` — Fastify API + Prisma
- `apps/web/` — Next.js frontend
- `apps/api/prisma/schema.prisma` — canonical schema

## Key flow (one sentence)

Akahu → Postgres → metrics pack → UI.

## Where to start reading

1. `apps/api/src/routes/pipeline.ts`
2. `apps/api/src/akahu/client.ts`
3. `apps/api/src/akahu/categoriser.ts`
4. `apps/web/app/page.tsx`

## Notes

- API dotenv lives at `apps/api/.env`.
- API is ESM, so internal imports use `.js` extensions.
