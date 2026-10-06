# Architecture

Ocean Control Tower is an internal Next.js 15 application on Vercel, backed by Supabase (Postgres, Auth, Storage).

```
Browser ──HTTPS──► Vercel — Next.js 15 (App Router)
                    ├─ middleware.ts            refresh session cookie, send anonymous users to /login
                    ├─ (app)/layout.tsx         signed-in + active check, role-filtered navigation
                    ├─ Server Components        read through the user's Supabase client → RLS applies
                    ├─ Server Actions           zod-validated, permission-checked mutations
                    └─ Route handlers           /auth/callback, /auth/confirm (email links)
                               │  user JWT (anon key)          │  service-role key (Auth admin API only)
                               ▼                               ▼
                    Supabase ── Postgres: RLS on every table, audit triggers, shipments_view
                             ── Auth: email + password, invite-only
                             ── Storage: private `imports` bucket (original workbooks)
```

## Folder layout

| Path | Contents |
|---|---|
| `app/(auth)` | Login, forgot password, set new password, and the auth server actions |
| `app/(app)` | Authenticated area: dashboard, shipments, imports, admin |
| `app/auth/*` | Email-link handlers (PKCE code exchange, token-hash verification) |
| `components/ui` | Design-system primitives (Button, Card, Badge, Field, StatTile…) |
| `components/*` | Feature components (app shell, charts, forms) |
| `domain/` | **Pure business rules**: normalisation, invoice type, status order, KPIs. No I/O, fully unit-tested |
| `services/` | Server-only data access: Supabase queries, Excel reading, import orchestration |
| `lib/supabase` | Server, browser, admin and middleware clients |
| `lib/auth` | Permission map and session helpers (`requirePermission`, `checkPermission`) |
| `types/` | Database types |
| `supabase/migrations` | Schema, RLS and storage, applied in order |
| `legacy/` | The original single-file dashboard, kept for reference |

## Key decisions

### 1. RLS is the authority; the app checks permissions too
Pages call `requirePermission()`, actions call `checkPermission()`, and Postgres RLS enforces the same rules.
- **Why:** a UI or action bug can't leak or change data, because every query runs as the signed-in user.
- **Trade-off:** rules live in two places (the `PERMISSIONS` map and SQL policies). They're small and side by side in the docs.
- **Scalability:** new tables get a policy in their migration. Per-user record scoping (assigned brokers or plants) can be added later by changing only the `shipments_select` policy.

### 2. Business status is computed in Postgres
`shipments_view` derives `status`, `flagged`, `goal_date` and `days_in_progress` from stored dates and `current_date`.
- **Why:** these depend on "today", so storing them would make them stale. One SQL definition replaces the Excel formulas and the legacy JS copy.
- **Trade-off:** the logic is SQL, not TypeScript. Status order, colours and roll-ups live in `domain/status.ts`.
- **Scalability:** the view is a plain `SELECT`, so it can become a materialised view, or feed Power BI, without touching the UI.

### 3. KPIs are computed on the server in TypeScript (for now)
`fetchKpiRows()` pulls a narrow projection of 13 columns, and `domain/kpi.ts` aggregates it by container.
- **Why:** at about 700 invoices (around 3k a year), this is fast, deterministic, and unit-tested with an injected "today".
- **Trade-off:** the cost grows linearly with the data.
- **Scalability:** past about 50k rows, move the aggregations into SQL functions or materialised views. The function signatures stay the same.

### 4. Excel import goes through Storage
The browser uploads to a private bucket. A server action then streams only `Ocean_Traffic_Report` with ExcelJS, validates it, and upserts by `invoice_no`.
- **Why:** Vercel limits request bodies to 4.5 MB and the master workbook is already 3.3 MB. Keeping the file in Storage also gives an audit trail of every upload.
- **Trade-off:** two steps (upload, then process) instead of one.
- **Scalability:** a scheduled job or Power Automate flow can drop files into the same bucket later.

### 5. Plain-HTML charts
The dashboard's three charts are single-series bars rendered on the server.
- **Why:** no client JS on the dashboard (about 106 kB first load), accessible table fallbacks, and no chart library to maintain.
- **Trade-off:** no zoom or pan.
- **Scalability:** add a charting library with `next/dynamic` for pages that need interactive charts.

## Security model

- **Authentication:** Supabase Auth, email and password. Sign-up is invite-only. The admin invites, and the user sets a password through the emailed link.
- **New accounts are inactive by default** (`profiles.is_active = false`). Even if public sign-up were left on, a self-registered account can read nothing.
- **Roles** live in `public.profiles.role`, never in user-editable JWT metadata. RLS reads them through `private.user_role()` / `private.has_role()`. These are `SECURITY DEFINER` functions in a schema the API doesn't expose.
- **Privilege escalation guard:** a trigger blocks non-admins from changing `role`, `is_active` or `email`, even on their own row.
- **Disabled users** are blocked twice: `is_active = false` denies all data through RLS, and an Auth ban stops sign-in.
- **The service-role key** is server-only (`import "server-only"`). It is used only for the Auth admin API, after an admin check.
- **Audit:** triggers on `shipments`, `profiles` and `app_settings` write to `audit_log`. Updates store only the changed fields.
- **Headers:** HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, and a minimal permissions policy.
- **Input:** every action validates with zod. Search terms are escaped for `ilike` and quoted inside `or()` filters. Redirect targets must be internal paths.

## Roles

| Capability | Admin | Supervisor | User |
|---|:-:|:-:|:-:|
| Dashboard, shipments, search | ✅ | ✅ | ✅ |
| Upload Excel / view import reports | ✅ | ✅ | — |
| Delete shipments (database only) | ✅ | — | — |
| Invite, change role, disable users | ✅ | — | — |
| Edit goals and targets, view audit | ✅ | — | — |

All active users can see all records (business decision, 2026-10-06). Per-user scoping is a future change to one policy. See `database-design.md`.

## Out of scope for v1 (deliberately)

The legacy VIP and Contecón pages, the EN/中文 toggle, editing shipments in the app (Excel stays the source), and the China packing-list sheet.
