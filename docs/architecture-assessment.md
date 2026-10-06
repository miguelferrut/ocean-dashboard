# Ocean Control Tower — Architecture Assessment (Phases 1–5)

Status: **Historical.** This was the pre-implementation analysis. The decisions in §9 were answered on 2026-10-06 (everyone sees all records; Excel upload stays the update path; duplicate invoices are errors; VIP and Contecón are out of v1). Where this document and `architecture.md` / `database-design.md` differ, those two are current. Notably, the schema uses one invoice-grain `shipments` table instead of BL/container/invoice tables, for the reasons given in `database-design.md`.

---

## 1. Repository analysis (Phase 1)

| Item | Finding |
|---|---|
| `README` (no `.md` extension) | Product vision: monitor containers, invoices, BLs, ASN, ETA, critical shipments, KPIs. Roadmap: Excel → Supabase → Auth → RBAC → analytics. |
| `Ocean_dashboardK13.html` | 1.07 MB single file. Now preserved at `legacy/Ocean_dashboardK13.html` (moved with `git mv`, content untouched, history kept). |
| Build tooling, tests, CI, lint, `.gitignore`, license | None. |
| Branches | Work happens on a feature branch; no `develop` branch yet. |

## 2. Legacy application assessment (Phase 2)

### 2.1 Anatomy of the file

| Section | Size | Notes |
|---|---|---|
| CSS (design tokens, light/dark theme) | ~95 KB | Good token system (`--teal`, `--amber`, `--red`, `--sea`…) — reusable as Tailwind theme. |
| **Embedded dataset `SAMPLE_DATA`** | **~775 KB (72 %)** | 710 real shipment rows incl. invoice values, BLs, containers, pedimento data. |
| Chinese translation table `ZH_EXACT` / `ZH_RULES` | ~30 KB | Full EN / 简体中文 UI. |
| Application JS | ~170 KB, ~100 functions | Global mutable state, `innerHTML` rendering (62 sites). |
| External deps | Chart.js 4.4.1, SheetJS 0.18.5 (CDN), Google Fonts | |

### 2.2 Features (to be preserved)

Eight pages, each with period / granularity / invoice-type filters:

1. **Executive summary** — KPIs, delivered in period vs. previous period, backlog.
2. **Delivery performance** — on-time vs. goal (`ETA_SAM_GOAL`), by broker / line / forwarder.
3. **Where time goes** — stage durations (ocean, port, customs, inland) vs. targets.
4. **Risk now and next** — risk scoring, urgency by week (4-week projection).
5. **VIP service** — VIP inspections, cost per VIP (from a second workbook "VIP Report").
6. **Operations tracker** — row-level tracker with status pills and search.
7. **Data quality** — unparseable dates/numbers, classification diagnostics.
8. **Contecón Trusted Mark** — terminal-specific customs proposal/infographic.

Cross-cutting: language toggle (EN/ZH), dark mode, Excel drag-and-drop (parsed in browser), optional Power Automate live feed (`FLOW_URL`, 5-min refresh, currently empty), "save snapshot" (re-exports a self-contained HTML with data baked in).

### 2.3 Business logic (must be ported 1:1 and unit-tested)

| Rule | Legacy definition |
|---|---|
| **Status** (`deriveStatus`) | Empty_Return ≤ today → *Delivered/Empty Return*; SAM_Discharge or ATA_SAM ≤ today → *Delivered at Sanhua*; Customs_Release ≤ today → *In transit to Plant*; Effective_Discharge or ATA_Port ≤ today → *In Port (MX)*; ATD_Port ≤ today → *In transit to port*; else *In origin (CH)*. **Differs from the Excel formula** (Excel adds "In customs" via Modulation_Status and "Review status"). Must pick one source of truth. |
| **Invoice type** | Invoice № contains `P` → Prototype; else Needs AAA? / AAA_ready / material "alumin" → Aluminum; else Normal. |
| **ETA_SAM_GOAL** | Allowance Normal 7 d, Aluminum 12 d, Prototype 20 d (in the workbook the column is now hard-coded values — formula lost). |
| **FLAGGED** | ATA_SAM > goal → DELAYED; or goal < today and not delivered → DELAYED; else ON TIME. |
| **Targets** | customs 10 d, inland 3 d, ocean tolerance 1 d, schedule tolerance 2 d, projection 14 d. |
| **Broker SLA stages** | Reference 1 d, Proforma 2 d, BL revalidation 2 d, Pedimento payment 1 d, total customs cycle 6 d. |
| **Risk points** | In port 1, customs pending 2, ETA missed 3, critical 5, past-due to plant 8. |
| **Normalisation** | Aliases (`CYN→CNY`, `HAPAG LLOYD→HAPAG-LLOYD`, `XINGANG→TIANJIN`…); `TBD/N/A/NEED/PENDING/-` mean *null*; origin suffix "-Manzanillo/-Altamira" stripped. |
| **Grouping** | Rows are per invoice; the dashboard aggregates to **container** (key = container № else `INV:` + invoice). |

### 2.4 Workflows

Logistics analyst updates Excel (SharePoint/OneDrive) → opens the HTML → drags the workbook in → reviews pages → exports snapshot HTML and emails it. No identity, no audit, no concurrency, everyone sees everything.

### 2.5 Technical debt

- Monolith: data + i18n + CSS + logic in one file; no modules, types, or tests.
- Global mutable state (`STATE`, `rows`, `containers`, filter vars); full re-render on any change.
- `TODAY` computed once at page load → stale after midnight.
- Business rules duplicated and divergent between Excel formulas and JS.
- Workbook columns contain line breaks/typos (`Pedimento_\nApproved_Date`, `REALIZED APPOIMNET`), `#VALUE!` errors, mixed types (dates as strings, invoice № as int).

### 2.6 Security risks (highest priority)

1. **🔴 Real operational data is committed to Git** inside the HTML (710 rows: invoice values, BLs, pedimento numbers, broker references). If this repo is or becomes public, that is a data leak; it also lives forever in history. *Recommendation:* confirm repo visibility is private; after the new app ships, consider purging the blob from history (`git filter-repo`) and keeping only a sanitised legacy copy.
2. Snapshot export emails the full dataset as an HTML attachment — uncontrolled distribution.
3. 62 `innerHTML` sinks with data from spreadsheets — an `esc()` helper exists but is not provably applied everywhere (stored-XSS risk once data comes from many users).
4. CDN scripts without SRI hashes.
5. `FLOW_URL` design would put a Power Automate SAS URL (a bearer secret) in client code.
6. No authentication, authorisation, or audit trail.

### 2.7 Accessibility

Positives: `lang`, `:focus-visible`, `aria-selected` on tabs, 66 `aria-*` attributes, respects `prefers-color-scheme`.
Gaps: 12 `<canvas>` charts with no text alternative/data table; colour-only status semantics (pills, heatmap `h0–h4`); tab pattern lacks arrow-key handling/`role=tabpanel`; dynamically injected content not announced (`aria-live`); small 13px muted text may fail AA contrast in dark mode.

### 2.8 Performance

1.07 MB HTML must be parsed before first paint; all 8 pages + 12 charts render eagerly; filters recompute everything over all rows client-side; SheetJS (~900 KB) is loaded even when not importing. Fine at 700 rows, will degrade at 10k+ (the workbook already has 10 515 formatted rows).

## 3. Workbook analysis (input to Phase 4)

| Sheet | State | Rows | Role |
|---|---|---|---|
| **Ocean_Traffic_Report** (`Table1`) | visible | 719 data rows, 84 cols | **System of record.** One row per invoice. 565 containers, 330 BLs, 704 invoice № (9 duplicated). |
| China_ Report | hidden | 3 535 | Supplier packing list: one row per **invoice line / part** (part №, qty, customer part №, free-time days, plant ETA). |
| Invoice_Validation | hidden | 218 | Ad-hoc check matching CN invoice ↔ original invoice. |
| Ocean_Status_Report | hidden | 218 | `INDEX/MATCH` view over Table1 — derived, not stored. |
| Cuadro de instrucciones | hidden | 30 | Broker instruction letter template (XLOOKUP over Table1) — becomes a generated document. |
| DATA | hidden | 9 | **Lookup lists**: brokers, claves, instrucción especial, BL types, terminals, carriers, modulation, yes/no, plants delivery, statuses, currencies, suppliers. |
| Sheet1 / Hoja1 | visible | 75 / 21 | Scratch comparisons — not migrated. |

Columns 68–83 of Table1 are helper formulas / scratch (`TRANSIT TO PORT`, `WK NUMBER`, empty columns) → computed in SQL views, not stored. `Plant Delivery` references an **external workbook** (`[1]PLANT DELIVERY`) — must become a real table.

## 4. Proposed architecture (Phase 3)

```
Browser ──HTTPS──► Vercel (Next.js 15, App Router)
                     ├─ middleware.ts      refresh Supabase session, gate /app/*
                     ├─ Server Components  read via Supabase server client (user JWT → RLS applies)
                     ├─ Server Actions     mutations, zod-validated, permission-checked
                     └─ Route Handlers     /api/import (Excel ingest), /api/export
                                │
                                ▼
                        Supabase (Postgres + Auth + Storage)
                          RLS on every table · audit triggers · SQL views for KPIs
```

**Key decisions**

| Decision | Reasoning / benefit | Trade-off | 5-year impact |
|---|---|---|---|
| Server Components read with the **user's JWT**, never the service-role key | RLS is the single enforcement point; a UI bug cannot leak data | Slightly more care in query design | New modules inherit security for free |
| Service-role key used only in admin user-management actions (server-only module, `import "server-only"`) | Least privilege | Two clients to maintain | Auditable, small surface |
| **Business rules in Postgres** (generated columns + views: `v_shipment_status`, `v_kpi_*`) mirrored by a typed TS `domain/` package for UI previews | One source of truth replacing Excel formulas + JS copies; KPIs scale with indexes, not browser CPU | SQL is less familiar to some devs | Enables Power BI / other consumers on the same views |
| Excel import as a **server-side staging pipeline** (`import_batches` → `staging_rows` → validate → upsert) | Keeps today's workflow, adds validation report (replaces "Data quality" page) and audit | More code than client parsing | Swap source to API/Power Automate later without touching UI |
| Charts: Recharts loaded via `next/dynamic` per page | Small initial bundle | — | |
| i18n: `next-intl` with EN + zh-CN, reuse `ZH_EXACT` strings | Preserves an existing feature used by the China team | — | Add ES easily |
| Tailwind with legacy design tokens as CSS variables | Visual continuity, dark mode for free | — | Consistent design system |
| Testing: Vitest (domain rules vs. legacy fixtures), Playwright (auth + search), pgTAP/SQL tests for RLS | Business rules are the riskiest part to port | CI time | Safe refactors for years |

**Folder layout**

```
app/(auth)/login, reset-password, update-password
app/(app)/dashboard, shipments, shipments/[id], search, vip, quality, admin/users, admin/settings
components/ui (Button, Card, Table, Badge, Dialog…)  components/charts  components/shipments
lib/supabase/{server,client,admin,middleware}.ts   lib/auth/permissions.ts
services/ (shipment.service.ts, import.service.ts, kpi.service.ts)
domain/ (status.ts, invoice-type.ts, risk.ts, normalize.ts — pure, tested)
types/database.types.ts (generated)   hooks/   supabase/migrations, seed.sql
docs/   legacy/   middleware.ts
```

## 5. Database design (Phase 4 — draft)

```
profiles ─┬─< user_assignments >── (broker | plant | forwarder scope)
          └─ role: admin | supervisor | user
suppliers, forwarders, shipping_lines, brokers, terminals, carriers, plants, projects, ports  (lookup tables from DATA sheet)

bills_of_lading (bl_no UNIQUE, vessel, voyage, shipping_line_id, forwarder_id, origin_port_id, china_bl_type, atd_port, eta_port_origin, eta_port_update, ata_port)
   └─< containers (container_no UNIQUE per BL, seal_no, terminal_id, carrier_id, cartaporte_id, gps_link,
                  effective_discharge, customs_appointment_eta, customs_release, transport_assignment,
                  eta_sam_real, ata_sam, sam_discharge, empty_return, modulation_status, plant_delivery)
          └─< invoices (invoice_no UNIQUE, asn, plant_id, project_id, material_type, immex, clave,
                        value, currency CHECK IN ('CNY','USD'), weight_kg, pallets, needs_aaa, aaa_ready_date,
                        critical, impact_date, invoice_type GENERATED, eta_sam_goal, broker_id, broker_reference,
                        instruction_date, reference_received_date, bl_revalidation_date, proforma_date,
                        pedimento_no, pedimento_approved_date, pedimento_payment_date, vip_date, vip_result_date)
                └─< invoice_lines (part_no, customer_part_no, description, qty)   ← China_ Report
import_batches, import_rows (raw jsonb + errors)   audit_log (table, row_id, action, old, new, actor, at)
app_settings (targets, goal allowances, risk weights — editable by admin, today hard-coded in JS)
```

- Indexes: unique on `bl_no`, `container_no`, `invoice_no`; trigram (`pg_trgm`) GIN indexes on the three for partial search; B-tree on `eta_port_update`, `ata_sam`, `customs_release`, FK columns.
- Constraints: date ordering checks as **warnings** in the import report (real data violates them), `NOT NULL` on identifiers, enums for status/modulation.
- Status, FLAGGED, days-in-progress, risk score → **views**, not stored columns (they depend on `today`).
- 9 duplicate invoice numbers + 30 numeric invoice numbers must be resolved during migration (see §9).

## 6. RBAC & security model

| Capability | Admin | Supervisor | User |
|---|:-:|:-:|:-:|
| Manage users / settings | ✅ | — | — |
| Import Excel | ✅ | ✅ | — |
| View all shipments & dashboards | ✅ | ✅ (scope) | — |
| Edit shipment milestones | ✅ | ✅ (scope) | limited fields, assigned only |
| Search Invoice / Container / BL | ✅ | ✅ | ✅ (assigned) |

Enforced three times: middleware (route), server action (`requirePermission()`), **RLS** (authoritative; role read from `profiles` via a `security definer` helper, not from user-editable metadata). Disabled users: `profiles.is_active=false` + Supabase admin ban. Audit via trigger on every write table.

## 7. Migration strategy (Phase 5)

1. Ship schema + importer; import `Ocean_Traffic_Report` + `China_ Report` + `DATA` lists into **staging**, produce a quality report.
2. **Parallel run (2–4 weeks):** team keeps updating Excel, uploads it to the app daily; compare KPIs against the legacy HTML (golden-file tests on the 710 sample rows).
3. Make the app the system of record: edits happen in-app; Excel becomes an export.
4. Retire legacy HTML (kept read-only in `/legacy`).

## 8. GitHub & Vercel (Phases 10 preview)

`main` (production, protected, PR + 1 review + green CI) ← `develop` (Vercel preview/staging) ← `feat/*`, `fix/*`, `chore/*`. Conventional Commits. CI: lint, typecheck, unit, build, Playwright on preview. Vercel: Production = `main`, Preview = all PRs, separate Supabase projects for staging and production. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by design, protected by RLS), `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`).

## 9. Decisions needed before implementation

1. **"Assigned records"** — what does a Supervisor/User get assigned to? Proposal: scope by **broker, plant, and/or forwarder** (plus optional per-container owner = `Name` column).
2. **Status source of truth** — legacy JS rules or Excel formula (with "In customs" / modulation)? Proposal: Excel formula + explicit "Review status" bucket.
3. **Data entry going forward** — keep Excel upload as primary (phase 1) or move edits in-app immediately?
4. **Supabase/Vercel** — create new projects, or use existing ones (connectors are available in this session)?
5. **Duplicates** — 9 invoice numbers appear twice; treat as data errors or allow (invoice per container split)?
6. Keep **VIP Report** and **Contecón** pages in v1, or defer?
7. Is this GitHub repo private? (embedded data, §2.6).
