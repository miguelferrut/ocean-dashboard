# Deployment

| Piece | Where |
|---|---|
| App | Vercel project `ocean-control-tower` (https://ocean-control-tower-one.vercel.app), linked to `miguelferrut/ocean-dashboard` |
| Database / Auth / Storage | Supabase project `ocean-control-tower` (ref `mchhedhxlfkthfoiroee`) |
| Production branch | `main`. Every other branch and PR gets a Preview deployment |

## Environment variables

| Name | Scope | Sensitive | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all | no | `https://mchhedhxlfkthfoiroee.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | no | Anon or publishable key. Public by design; RLS protects data |
| `NEXT_PUBLIC_SITE_URL` | production | no | `https://ocean-control-tower-one.vercel.app`. Used in email links |
| `SUPABASE_SERVICE_ROLE_KEY` | production, preview | **yes** | Supabase → Project Settings → API keys → `service_role` / secret key. Only used to invite and disable users |

`.env.example` documents the same variables for local use.

## One-time Supabase setup (dashboard)

1. **Turn off public sign-ups:** Authentication → Sign In / Providers → turn off *Allow new users to sign up*. Accounts are invite-only. New accounts are also inactive by default, as a second safeguard.
2. **URL configuration:** Authentication → URL Configuration
   - Site URL: the production URL.
   - Redirect URLs: `https://<prod-domain>/**` and `https://ocean-control-tower-*-miguelferrut-7344.vercel.app/**` (previews), plus `http://localhost:3000/**`.
3. **Email templates** (Authentication → Emails), so links work in any browser:
   - *Invite user:* `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/update-password">Accept the invitation</a>`
   - *Reset password:* `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password">Reset your password</a>`
4. **SMTP:** the built-in sender is rate-limited (a few emails an hour). Configure a custom SMTP sender (Authentication → SMTP) before inviting the whole team.
5. **First admin:** Authentication → Users → *Invite user* (or *Add user*). Then, in the SQL editor:
   ```sql
   update public.profiles set role = 'admin', is_active = true where email = 'you@company.com';
   ```
   From then on, admins invite everyone else from the app's **Users** page.

## Migrations

Applied migrations are tracked by Supabase. For a new environment:
```bash
npx supabase link --project-ref <ref>
npx supabase db push          # applies supabase/migrations/* in order
```
After a schema change, regenerate types: `npx supabase gen types typescript --project-id <ref> > types/database.types.ts`.

## Deploying

Pushing to any branch deploys a Preview. Merging to `main` deploys Production. Build command: `next build`. Output is auto-detected. Node 22.

## Production checklist

- [ ] GitHub repository is **private** (the legacy HTML contains real shipment data; consider purging it from history with `git filter-repo`)
- [ ] All four env vars set in Vercel; `SUPABASE_SERVICE_ROLE_KEY` marked Sensitive and absent from the Development target
- [ ] Public sign-ups disabled; redirect URLs and email templates set; custom SMTP configured
- [ ] First admin created; test accounts for each role signed in successfully
- [ ] Supabase security and performance advisors show no errors
- [ ] Point-in-time recovery / daily backups enabled on the Supabase plan in use
- [ ] Upload the current workbook and compare dashboard counts with the legacy dashboard for the same file
- [ ] Vercel Deployment Protection reviewed (the app already requires login)
- [ ] Branch protection on `main`: PR required, CI green, 1 review
