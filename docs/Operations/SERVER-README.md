# Imperium Noctis — Windows MySQL backend

Imperium Noctis member portal uses a Windows-hosted Node.js API, local MySQL database, and React/Vite frontend. It supports account approvals, character dossiers, binding requests, RP preferences, FC rules, events, encounters, dice, syndicate ranks, character progression, and completed-event XP.

The older Supabase code is retained for compatibility only. **Use the Windows/MySQL instructions below for the current member portal.**

## Requirements

- Windows host, Node.js **22+**, local MySQL database `eclipse_order`, and a private `server/.env`
- Existing database administrator access for additive schema installation
- The frontend `VITE_ECLIPSE_API_URL` pointing at this Node API
- A database backup **before** every schema change or public release

Never commit your `.env`, passwords, database dumps, or member records. Keep MySQL restricted to localhost and do not publish port 3306.

## Initial setup and subsequent updates

In `server/.env`, configure the private database credentials and the expected frontend origin. The administrator password used during migration is prompted for interactively and should not be stored in GitHub.

For local development, use a configuration such as:

```ini
API_PORT=3182
API_PUBLIC_ENABLED=false
API_PUBLIC_HOST=api.rosefires.com
API_ALLOWED_ORIGIN=http://localhost:5173
API_LOCAL_ORIGIN=http://localhost:5173
MIGRATION_DB_USER=root
```

Preserve your existing `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_PORT` values. From the `server` folder:

```powershell
npm ci
npm run setup:local
npm start
```

`setup:local` is re-runnable and installs additive tables/changes for sessions, registrations, feature records, syndicate ranks (`007_syndicate_ranks`), and **event XP (`008_event_xp`)**. It does not overwrite existing Domina accounts or delete character sheets. Restart Node after updating.

On the Windows host, check:

- `http://127.0.0.1:3182/health` — process responds
- `http://127.0.0.1:3182/ready` — MySQL is reachable

A healthy process is not proof that permissions and migrations have been fully tested.

## Existing member RP starter preferences

After taking a private database backup, run `npm run setup:local` in `server/` to install migration **127**, which adds the `starter_seeds_applied` marker to existing RP profiles without modifying their saved entries or sharing choices. Restart the API. When any member (including an existing one) opens their RP preferences, missing starter labels appear with **Maybe**, preserving case-insensitive matching names and all existing ratings. These suggestions remain unsaved and private until the member explicitly saves; the save marks this one-time offering complete. Entries deliberately removed thereafter do not reappear. Existing sharing remains opt-in and nothing is auto-published by this migration. If a profile already has 60 entries, no additional items are offered.

## First Domina account, registration and sign-in

Only when the database has no accounts, the **local** member portal offers first-Domina setup. Public requests to `/auth/setup-domina` are disabled. Do not attempt to re-create an existing Domina account.

Members request access through the member portal. New requests are pending until a Domina approves or rejects them. Account roles (Domina, High Command, Handler, Member) control permissions; the five syndicate ranks (Domina, Oyabun, Kusushi, Operative, Kumi-in / Initiate) are a separate membership hierarchy. Bound-character ranks are also separate.

Sessions are revocable and expire. Passwords are hashed server-side. Self-declared 18+ status is not age verification. Email verification/recovery and persistent abuse throttling still require production review.

## Local frontend

From the repository root, create a private `.env.local`:

```ini
VITE_ECLIPSE_API_URL=http://127.0.0.1:3182
```

Then run:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173`. The same API URL switch selects the Windows/MySQL portal in deployed builds. If it is absent, the app shows the **legacy** Supabase/browser-ledger path; do not confuse that path with current Windows/MySQL behavior.

## Event XP and progression

GM event XP is awarded only after an event is completed, to an approved signup or participating combatant. The server records the XP award once per character/event in `order_event_xp_awards`; repeated awards are rejected. Earned ability-point spending remains on character dossiers. There is no active shop, wallet, paycheck or ration system.

## Testing

From the repo root, run `npm test` and `npm run build`; from `server/`, run `npm test`. A MySQL integration suite may require specific local test credentials: a skipped suite must not be presented as verified database behavior. Separately test sign-in, approvals, all account roles, OOC withdrawal and private data, event completion and XP, server restart, and repeated sign-ins.

## Public launch

Follow **[Cloudflare launch](CLOUDFLARE-LAUNCH.md)** using the existing tunnel and documented `https://api.rosefires.com` hostname. The Node service continues to bind `127.0.0.1:3182` and Cloudflare routes to it. The public API must be explicitly enabled with exact HTTPS origin/host settings, tested throttling, encrypted backups and an actual browser login check. Do not expose `/ready` or first-account setup publicly.

Until backed up, hardened, and independently tested, a successful GitHub Pages deployment is **not** a declaration that the self-hosted API is ready for all FC members. The Windows PC, MySQL and Node process must remain running; a healthy tunnel cannot replace a stopped backend.

## Event stories and chapter ratings

Event directors can set **Difficulty (D1–D10)**, **Impact (I1–I5)**, mark a posting **FC MSQ** when it advances the Order's main storyline, and add up to 12 named chapters, each with its own difficulty and description. The public **Events & signups** board displays these details; signup and encounter permissions are unchanged. Existing events retain all their data and remain unrated until edited.

**Windows/MySQL database upgrade required:** After backing up the database and pulling this update on the Windows host, run `npm run setup:local` from `server/` and restart the Node API. This applies the repeatable, additive `011_event_story.sql` migration. Publishing only the frontend without migrating MySQL is not sufficient.

Character creation and sheet updates now allow at most **three** trained skill proficiencies. Existing selections are not silently removed; characters with more than three must uncheck extras before saving the sheet.

## Encounter scene archives

DMs can archive a draft or completed encounter, restore an archived encounter, or permanently delete it after archiving. Active and paused encounters must be finished before archiving. Archiving retains the map, signups, dice history and combatant records; permanent deletion removes the scene and its linked records.

**Database upgrade:** Back up MySQL, then run `npm run setup:local` in `server/` to apply the additive, rerunnable `012_encounter_archives.sql` migration. Restart the API afterward. Deploy the matching frontend and backend together so scene actions use the new API endpoints.

Dice roll errors now distinguish inactive encounters, paused participation, missing player characters, and unconfirmed RP declarations/themes. An authorized encounter DM can make DM rolls without adding their own player character.

## NPC allies in encounters

DMs can add **NPC allies** from Combatants using the same initiative, hit points, armor class, conditions and map placement as other combatants. These friendly NPCs have their own teal ally markers, appear in initiative and are controlled solely by the encounter DM. They are not player characters, do not require a player account, and do not confer player signup or player-controlled roll permissions. Saved NPC/creature stat blocks may be added either as enemies or as NPC allies.

**Windows/MySQL setup:** Back up the database, pull the updated frontend/backend, and run `npm run setup:local` in the `server/` folder, then restart the Node API. The rerunnable `013_npc_allies.sql` migration extends the combatant kind enum without changing existing player or enemy combatants.
