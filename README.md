# Eclipse Order — FC roleplay and encounter ledger

The Eclipse Order dashboard supports FC membership management, character dossiers, private out-of-character (OOC) preferences, binding requests, planned events, and tabletop-style encounters.

## Current architecture

The main supported deployment is a **React/Vite frontend on GitHub Pages** using the **Windows Node.js/MySQL API** through `VITE_ECLIPSE_API_URL`. The backend listens on `127.0.0.1:3182`; the existing Cloudflare Tunnel may publish it at `https://api.rosefires.com` after configuration and security verification.

The codebase also retains the older Supabase/browser-ledger route when `VITE_ECLIPSE_API_URL` is unset. That is a **legacy compatibility mode**, not the recommended member portal. Do not mix its setup/migration instructions with the Windows/MySQL deployment. Historical `supabase/` SQL is retained for reference; **do not run it against MySQL**.

A successful frontend deployment only verifies static assets. It does not run MySQL migrations or prove the Windows API, Cloudflare Tunnel, or member permissions are working.

## Member experience

- Request membership; a Domina approves or rejects the application before access is granted.
- Keep a private RP profile, including an 18+ self-declaration and content preferences. Optional sharing of RP/kink information is separately controlled and off by default.
- View and maintain permitted character dossiers. Bound-character restrictions are applied on the server; the linked player keeps OOC control of participation and status-change consent.
- Join published events with an eligible linked character, withdraw OOC, and participate in GM-managed encounters, dice, and battle maps.
- Receive **XP only through completed FC events**: authorized GMs select an eligible participant and record a one-time award per character/event.
- Spend earned progression points through the character dossier. New characters do not start with a full allotment of earned points.

The Order's normal syndicate ranks are **Domina, Oyabun, Kusushi, Operative, and Kumi-in / Initiate**. Account permissions and bound-character ranks are separate.

**No shop, wallet, paychecks, purchases, or ration-claiming economy is part of the current dashboard.** Old database tables and historical migration files may remain to preserve records, but they are not active player features.

## Safety and privacy

Roleplay content preferences are private by default. A profile selection is not blanket consent. Players must always be able to pause, decline, withdraw, or revoke OOC participation regardless of in-character status. An 18+ checkbox records a self-declaration; it does not verify identity or age. Do not put OOC preferences, user passwords, private records, or DB backups in GitHub.

## Windows development and setup

Requires Node.js 22+, a local MySQL `eclipse_order` database, a private `server/.env`, and the existing local MySQL permissions. See [Windows setup](server/README.md) for prerequisites and account bootstrap.

From the `server` folder, after backing up MySQL and pulling updates:

```powershell
npm ci
npm run setup:local
npm start
```

`setup:local` applies the additive feature, syndicate-rank and **008_event_xp** migrations; it does not delete existing accounts. Keep its administrator password private. Use the health and readiness checks described in the server guide.

For local frontend development, set `VITE_ECLIPSE_API_URL=http://127.0.0.1:3182` in the root `.env.local`, then run from the repository root:

```powershell
npm ci
npm test
npm run build
npm run dev
```

Use `http://localhost:5173`. Run backend tests separately with `cd server; npm test`. The MySQL integration suite requires a configured test database; a skipped integration suite is not a passing live-db verification.

## Release readiness

Before inviting members, verify migrations against the actual Windows MySQL instance, account roles and private-record permissions with distinct users, the full event/XP workflow, Cloudflare HTTPS/CORS and auth throttling, session expiry, and encrypted backups with a tested restore. Email verification/recovery and production operations remain open work. See [release roadmap](docs/ROADMAP.md), [operations checklist](docs/OPERATIONS.md), and [Cloudflare launch guide](server/CLOUDFLARE-LAUNCH.md).

The GitHub Pages workflow may deploy on updates to `main`; a PR does **not** automatically apply database migrations. Never commit credentials or expose MySQL port 3306.

## Event stories and chapter ratings

Event directors can set **Difficulty (D1–D10)**, **Impact (I1–I5)**, mark a posting **FC MSQ** when it advances the Order's main storyline, and add up to 12 named chapters, each with its own difficulty and description. The public **Events & signups** board displays these details; signup and encounter permissions are unchanged. Existing events retain all their data and remain unrated until edited.

**Windows/MySQL database upgrade required:** After backing up the database and pulling this update on the Windows host, run `npm run setup:local` from `server/` and restart the Node API. This applies the repeatable, additive `011_event_story.sql` migration. Publishing only the frontend without migrating MySQL is not sufficient.

Character creation and sheet updates now allow at most **three** trained skill proficiencies. Existing selections are not silently removed; characters with more than three must uncheck extras before saving the sheet.
