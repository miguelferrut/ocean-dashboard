# Development guide

## Prerequisites
Node 22 and npm. Optional: the Supabase CLI and Docker for a local database.

```bash
npm ci
cp .env.example .env.local    # point at a dev/staging Supabase project, never production
npm run dev                   # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run check` | lint, typecheck and unit tests. Run it before every push |
| `npm test` | Vitest unit tests (`domain/**/__tests__`) |
| `npm run build` | Production build |

Business rules belong in `domain/` as pure functions with tests. Pages stay thin: permission check, service call, render.

**Never commit real data.** `.xlsx`/`.csv` files are git-ignored. Tests use synthetic rows.

## Branching

```
main      ← production (protected: PR + green CI + 1 review, no direct pushes)
develop   ← integration, deploys a stable Preview for UAT
feat/<short-name>, fix/<short-name>, chore/<short-name>   ← from develop
hotfix/<short-name>   ← from main, merged back to main and develop
```

- **Why:** `main` always matches what users run, and `develop` gives the logistics team a stable place to test before release.
- **Trade-off:** one extra merge per release.
- **Scalability:** this can move to trunk-based development with feature flags once there is end-to-end test coverage.

## Pull requests

1. Keep PRs small and focused, using the template in `.github/pull_request_template.md`.
2. CI (`.github/workflows/ci.yml`) must pass: lint, typecheck, tests, build.
3. Check the Vercel Preview link before asking for review.
4. Squash-merge, with the PR title in Conventional Commit form.

## Commit convention — Conventional Commits

```
feat(import): reject duplicate invoice numbers
fix(dashboard): count overdue ETAs in the current week
docs: add deployment checklist
chore(deps): bump next to 15.5.x
```
Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`. Breaking changes: `feat!:` plus a `BREAKING CHANGE:` footer.

## Database changes

1. Add `supabase/migrations/<yyyymmddhhmmss>_<name>.sql`. Never edit a migration that has already been applied.
2. Every new table: `enable row level security`, plus explicit policies for each action.
3. Regenerate `types/database.types.ts`.
4. Run the Supabase security and performance advisors, and the checks in `supabase/tests/rls_checks.sql`.

## Adding a permission

Add it to `lib/auth/permissions.ts`, use `requirePermission()` on the page or `checkPermission()` in the action, and mirror it in the RLS policy if it affects data.
