# Supabase shared ledger setup

**Status:** Database preparation only. The dashboard UI has NOT yet been wired to this client. Keep this branch unmerged until that integration is completed and tested.

## Why Supabase?

The static GitHub Pages site cannot securely connect straight to a remote MySQL server. Supabase supplies an authenticated Postgres REST API with row-level security. Only public project settings go into the built frontend.

## Setup

1. Create a project at https://supabase.com/dashboard using the Free plan.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Open **Authentication → Providers → Email** and disable public sign-ups if the Order is invitation-only.
4. Invite a user using **Authentication → Users** (or provision the account manually).
5. Add approved user IDs to `public.order_members` by running the commented example at the end of the SQL schema.
6. Copy `.env.example` to `.env.local` for local development.
7. Enter the project URL and publishable key as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
8. For GitHub Pages deployment, add both variables to the repository's Actions variables and pass them into the build job; this deployment wiring is still to be completed after the UI integration.

**Never put the Supabase database password, secret key, service_role key or any member password into GitHub or Vite environment variables.** The public publishable key may be used in the frontend because SQL row-level security protects the database.

## Permissions

Only approved members can access character records. The initial schema grants all approved members collaborative read/write access; the role field is stored for later admin-only workflows. It does not yet enforce admin-only rank edits, approvals or deletions.

## Existing data

Legacy localStorage records are not automatically uploaded. The visual overhaul's JSON export and import can be used as a migration mechanism after the UI connection is completed. Always export a backup before switching the site to shared storage.

## Deployment

Keep the branch separate until UI integration and browser testing are done. The GitHub Pages site will continue serving the existing version until an explicit merge into main.
