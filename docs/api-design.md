# API design

There is no public REST API. The browser talks to the Next.js server, and the server talks to Supabase as the signed-in user. The one exception is a direct browser → Storage upload, which RLS restricts.

## Server Actions

All actions are in `"use server"` modules, validate input with zod, and check permissions before doing anything.

| Action | Module | Permission | Input | Effect |
|---|---|---|---|---|
| `signIn` | `app/(auth)/actions.ts` | public | email, password, next | Password sign-in; redirects to `next` (internal paths only) |
| `signOut` | same | signed in | — | Ends the session |
| `requestPasswordReset` | same | public | email | Sends a reset email; same response whether or not the account exists |
| `updatePassword` | same | signed in (from an email link) | password, confirm | ≥10 chars with a letter and a number |
| `runImport` | `app/(app)/imports/actions.ts` | `shipments:import` | storagePath, fileName | Parses the uploaded workbook and upserts shipments; returns a summary |
| `inviteUser` | `app/(app)/admin/actions.ts` | `users:manage` | email, fullName, role | Auth invite and profile activation |
| `updateUser` | same | `users:manage` | userId, role, isActive | Role and status change, Auth ban/unban; admins can't demote themselves |
| `updateSettings` | same | `settings:manage` | allowances, targets | Upserts `app_settings` |

Actions return `{ error }` / `{ message }` for forms, or a discriminated union (`runImport`). They never throw raw database errors at the client.

## Route handlers

| Route | Purpose |
|---|---|
| `GET /auth/callback?code=&next=` | PKCE code exchange (password reset requested from this app) |
| `GET /auth/confirm?token_hash=&type=&next=` | Token-hash verification (invite and recovery email templates) |

## Read services (`services/`, server-only)

| Function | Returns |
|---|---|
| `fetchKpiRows()` | Every shipment's KPI projection, paged 1000 at a time |
| `listShipments(query)` | Filtered, searched, paginated rows plus an exact count |
| `getShipment(id)` | One shipment with derived fields, plus sibling invoices in the same container or BL |
| `listBrokers()` | Distinct brokers for the filter |
| `getSettings()` | Goal allowances and targets, with defaults |

### Search semantics
- Input is upper-cased with whitespace removed (identifiers are stored that way).
- `field = invoice | container | bl` searches that column. Without a field, it searches all three with OR.
- "Contains" matching (`ilike %term%`) uses the trigram indexes. `%`, `_` and `\` are escaped.
- A search with exactly one match redirects to that shipment.

## Import contract

1. The client uploads to `imports/<user_id>/<timestamp>_<name>.xlsx`. The Storage policy requires admin or supervisor and the user's own folder. The bucket accepts only `.xlsx`, up to 50 MB.
2. The client calls `runImport({ storagePath, fileName })`. The server re-checks the permission and that the path is under the user's own folder.
3. The server creates an `import_batches` row, streams `Ocean_Traffic_Report`, maps headers (tolerant of case, spaces and line breaks), and normalises values.
4. Rows are upserted in chunks of 500 on `invoice_no`, and issues go to `import_issues`. The batch is marked `completed` or `failed`.
5. Imports never delete. An invoice that's missing from the file keeps its last values.

## Future: external API
If other systems (Power BI, ERP) need data, expose read-only Postgres views to a dedicated role through PostgREST with its own key, or add `/api/v1/*` route handlers with API-key auth and rate limiting. Don't reuse the service-role key.
