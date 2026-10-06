# Database design

Supabase project `ocean-control-tower` (ref `mchhedhxlfkthfoiroee`, region us-east-1, Postgres 17).
Migrations live in `supabase/migrations/` and are applied in filename order.

## Entities

```
auth.users 1─1 profiles (role, is_active)
                 │ uploaded_by
import_batches 1─* import_issues
      │ last_import_id
shipments  (one row per commercial invoice; unique invoice_no)
      └─ shipments_view  (+ status, flagged, goal_date, days_in_progress)
app_settings (goal allowances, targets)        audit_log (append-only)
storage.objects in bucket `imports` (original workbooks, under <user_id>/)
```

### Why one `shipments` table at invoice grain?
The source of truth is the Excel `Ocean_Traffic_Report`, which has one row per invoice. There, container- and BL-level facts (ETA, ATA, release dates) are repeated on every invoice row, and the file is re-imported in full every time.

- **Benefits:** imports are a simple, idempotent upsert on `invoice_no`. There's no risk of a container's dates disagreeing between tables mid-import. Every Excel row maps to exactly one database row, so the import report can cite Excel row numbers.
- **Trade-off:** container- and BL-level data is denormalised. Containers are rolled up at read time (`domain/kpi.ts → toContainers`: least-advanced status, strictest goal, latest arrival).
- **When to normalise:** once data is edited in the app instead of Excel, split it into `bills_of_lading` → `containers` → `invoices`, so a milestone is entered once per container. The view keeps its shape, so the UI won't change.

## `shipments` columns

Every column in `Ocean_Traffic_Report` that carries information is stored. Derived and helper columns (`Status`, `FLAGGED`, `Days_in_progress`, `Historical_AllPublic`, `TRANSIT TO PORT`, `WK NUMBER`…) are **not** stored. The view recomputes them. Mapping: `domain/excel-columns.ts`.

| Group | Columns |
|---|---|
| Identifiers | `invoice_no` (unique, upper-case), `bl_no`, `container_no`, `asn` |
| Parties / routing | origin, incoterm, forwarder, shipping line, coordinator, plant, project, material type, IMMEX, suppliers, broker (+ reference), terminal, carrier, vessel, voyage, plant delivery |
| Commercial | `invoice_total_value` ≥ 0, `currency` ∈ {CNY, USD}, `weight_kg` ≥ 0, `pallets` ≥ 0, `invoice_type` enum |
| Customs | clave, instrucción especial, MET VAL, previo, China BL type, `needs_aaa`, pedimento №, seal, `modulation_status` ∈ {GREEN, RED}, `is_critical` (null = TBD), Carta Porte, GPS link |
| Milestones (`date`) | file shipping, ATD, ETA port (origin / updated), BL in OneDrive, instruction, reference received, AAA ready, BL revalidation, proforma, pedimento approved / paid, ATA port, VIP / VIP result, effective discharge, customs appointment ETA, customs release, transport assignment, impact date, ETA SAM goal / real, ATA SAM, SAM discharge, empty return |
| Lineage | `last_import_id`, `created_at`, `updated_at` (trigger), `updated_by` |

## Derived values (`shipments_view`, `security_invoker = true`)

**Goal date:** `eta_sam_goal` from the file. If it's empty, `effective_discharge_date` plus the allowance from `app_settings.goal_allowance_days` for the invoice type: Normal 7, Aluminum 12, Prototype 20.

**Status:** the Excel `Status` formula's order, with one fix from the legacy dashboard. A date in the future is a plan, not a milestone reached. Excel's `ISNUMBER()` treated planned dates as done.

| Order | Condition (dates must be ≤ today) | Status |
|---|---|---|
| 1 | empty return | Delivered at Sanhua/Empty Return |
| 2 | SAM discharge | Delivered at Sanhua |
| 3 | customs release = today and modulation not GREEN/RED | In customs |
| 4 | customs release | In transit to Plant |
| 5 | effective discharge | In Port (MX) |
| 6 | ETA port (updated) exists | In transit to port |
| 7 | no ATD | In origin (CH) |
| 8 | otherwise | Review status |

**FLAGGED:** DELAYED if ATA SAM > goal, or if the goal has passed and there is no ATA SAM. Otherwise ON TIME.

**Invoice type** (stored at import, `domain/invoice-type.ts`): Prototype if there's a `P` right after the 6-digit date in the invoice number. Aluminum if Needs AAA? is true, AAA_ready says NEED(S) or holds a date, or the material mentions aluminum. Otherwise Normal.

## Indexes

| Index | Purpose |
|---|---|
| `shipments_invoice_no_key` (unique) | upsert target, exact lookup |
| B-tree `bl_no`, `container_no` | exact lookups, sibling invoices |
| GIN `pg_trgm` on `invoice_no`, `bl_no`, `container_no` | "contains" search from the search box |
| B-tree `eta_port_update`, `ata_sam`, `customs_release_date` | date-range filters and ordering |
| FK indexes on `last_import_id`, `updated_by`, `uploaded_by`, `import_issues.batch_id` | joins and cascades |
| `audit_log (table_name, record_id)`, `(created_at desc)` | record history, recent changes |

## Constraints

- `invoice_no` is NOT NULL, unique, trimmed and upper-case (CHECK).
- Enumerations: `app_role`, `invoice_type`. CHECKs on currency, modulation and import status/severity.
- Non-negative CHECKs on value, weight and pallets.
- The importer converts values that would violate a CHECK into empty values with a warning, so one bad cell never blocks a whole file.
- **Duplicate invoice numbers are data errors** (business decision 2026-10-06). Every row sharing the number is rejected and listed in the import report. The existing database row is left as it was.

## RLS policies

| Table | select | insert | update | delete |
|---|---|---|---|---|
| shipments | any active user | admin, supervisor | admin, supervisor | admin |
| profiles | self or admin | trigger only | self (non-privileged fields) or admin | cascade from auth |
| app_settings | any active user | admin | admin | admin |
| import_batches | admin, supervisor | admin, supervisor (as self) | uploader | — |
| import_issues | admin, supervisor | uploader of the batch | — | cascade |
| audit_log | admin | trigger only | — | — |
| storage `imports` | admin, supervisor | admin, supervisor, own folder only | — | — |

The helpers are `private.user_role()` and `private.has_role(app_role[])`. They're `SECURITY DEFINER` and live in a schema PostgREST doesn't expose. They return null/false for inactive users, so disabling a user removes all data access at once. `public.my_role()` is a `SECURITY INVOKER` wrapper the UI can call.

## Auditing

`private.audit_row()` runs after insert, update or delete on `shipments`, `profiles` and `app_settings`. On update it stores only the changed keys (`old_data` / `new_data`), ignoring `updated_at`, `updated_by` and `last_import_id`. Re-importing an unchanged workbook therefore writes no audit rows. `actor_id` is `auth.uid()`. Retention: about 5k rows a month at today's volume. Add a monthly partition or a 2-year purge job when it passes 1M rows.

## Future scaling path

1. Per-user scoping: add `user_assignments(user_id, broker|plant|forwarder)` and change `shipments_select` to join it.
2. In-app editing: normalise to BL → container → invoice, and keep `shipments_view` as the compatibility layer.
3. Heavier analytics: materialised `container_summary` refreshed after each import, or SQL functions for KPIs.
4. The China packing list (`China_ Report`): an `invoice_lines` table keyed by `invoice_no`.
