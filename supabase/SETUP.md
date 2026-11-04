# Supabase shared ledger setup

**Status:** The dashboard is wired to Supabase, but this project must have the SQL schema and approved users configured before login and shared records will work. Do not merge into the live site until setup and testing are complete.

## Why Supabase?

The static GitHub Pages site cannot securely connect straight to a remote MySQL server. Supabase supplies an authenticated Postgres REST API with row-level security. Only public project settings go into the built frontend.

## Setup

1. Create a project at https://supabase.com/dashboard using the Free plan.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Open **Authentication → Providers → Email** and disable public sign-ups if the Order is invitation-only.
4. Invite a user using **Authentication → Users** (or provision the account manually).
5. Add approved user IDs to `public.order_members` by running the commented example at the end of the SQL schema.
6. The public project URL and publishable key are already configured in `.env.production` for the Vite build. For local development, copy `.env.example` to `.env.local` and enter the same public values.
7. Run `npm ci && npm run build` and check the GitHub Actions verification job.
8. Sign in with a Supabase Auth user who appears in `public.order_members`.

**Never put the Supabase database password, secret key, service_role key or any member password into GitHub or Vite environment variables.** The public publishable key may be used in the frontend because SQL row-level security protects the database.

## Permissions

Only approved members can access character records. The initial schema grants all approved members collaborative read/write access; the role field is stored for later admin-only workflows. It does not yet enforce admin-only rank edits, approvals or deletions.

## Existing data

Legacy localStorage records are not automatically uploaded. Before merging, export the old ledger using the visual overhaul's local version. After merging, sign in and import the JSON file under Workspace & backup. Always export a backup before switching the site to shared storage.

## Deployment

Keep this branch separate until Supabase project provisioning, SQL setup, sign-in and browser testing are done. The GitHub Pages site will continue serving the existing version until an explicit merge into main.

## Connection

Project URL: `https://bcvqeqjvzkkrfpnughsb.supabase.co`

Do not use the `/rest/v1/` suffix for the project URL; the client adds that path itself. The publishable key is public and bundled with the frontend. The Supabase database password and secret/service-role keys must never appear in the site.

## Data behavior

Authenticated approved members share the same roster, edits, and deletions. The frontend polls for changes every 30 seconds; this is not realtime subscription-based synchronization. The initial policies allow all approved members to edit every record; staff-only rank edits and deletes would need stronger RLS policies.
