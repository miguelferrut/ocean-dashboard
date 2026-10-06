# Ocean Control Tower

Internal logistics platform for import, customs and operations teams. It tracks ocean shipments from the origin port to the SAM plant, through Mexican ports and customs.

**Stack:** Next.js 15 (App Router, TypeScript, Tailwind CSS v4) · Supabase (Postgres + RLS, Auth, Storage) · Vercel

## Features

- Email/password sign-in, password reset, invite-only accounts
- Roles: **Admin**, **Supervisor**, **User**, enforced in the UI, in server actions and by Postgres Row Level Security
- Dashboard: active containers, delays, critical shipments, on-time rate, customs time, arrivals forecast, broker performance
- Shipment tracker with search by **invoice**, **container** or **BL**, filters, and a milestone timeline per invoice
- Excel import of the *Ocean Master Data Base* workbook, with a row-level validation report (duplicate invoices are rejected)
- Audit log of every change to shipments, users and settings

## Quick start

```bash
npm ci
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

## Documentation

| Doc | |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System design, decisions and trade-offs, security model |
| [docs/database-design.md](docs/database-design.md) | Schema, business rules, indexes, RLS |
| [docs/api-design.md](docs/api-design.md) | Server actions, routes, import contract |
| [docs/deployment.md](docs/deployment.md) | Vercel and Supabase setup, env vars, production checklist |
| [docs/development-guide.md](docs/development-guide.md) | Local setup, branching, PR and commit conventions |
| [docs/architecture-assessment.md](docs/architecture-assessment.md) | Original analysis of the legacy dashboard |

The original single-file dashboard is kept in [`legacy/`](legacy/) for reference.
