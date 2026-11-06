# Eclipse Order — FC roleplay and encounter ledger

The Eclipse Order dashboard supports FC membership management, character dossiers, private out-of-character (OOC) preferences, binding requests, planned events, and tabletop-style encounters.

## Current architecture

The main supported deployment is a **React/Vite frontend on GitHub Pages** using the **Windows Node.js/MySQL API** through `VITE_ECLIPSE_API_URL`. The backend listens on `127.0.0.1:3182`; the existing Cloudflare Tunnel may publish it at `https://api.rosefires.com` after configuration and security verification.

The codebase also retains the older Supabase/browser-ledger route when `VITE_ECLIPSE_API_URL` is unset. That is a **legacy compatibility mode**, not the recommended member portal. Do not mix its setup/migration instructions with the Windows/MySQL deployment. Historical `supabase/` SQL is retained for reference; **do not run it against MySQL**.

A successful frontend deployment only verifies static assets. It does not run MySQL migrations or prove the Windows API, Cloudflare Tunnel, or member permissions are working.

## Public website and member portal

The site now opens on a **public landing page** describing The Eclipse Order's lore, hierarchy, roleplay, expectations, and membership request process. Visitors do not need to sign in to read it. The existing member dashboard and account registration/login are still available via the **Member sign-in** / **Request membership** links.

Because GitHub Pages does not automatically rewrite arbitrary deep URLs to the app shell, public links use the safe **`?portal`** query route (for example `https://<deployed-site>/?portal`). Hosting environments with SPA fallback also accept `/portal`. Both paths preserve the existing Windows/MySQL authentication and dashboard; the query path is the reliable option for static GitHub Pages deployments. The public homepage itself requires no API response or database access.

The new public site has original Eclipse Order copy and visual design inspired structurally by an external FC reference, not that FC's characters, locations, mechanics, or assets. No recruitment location, estate address, Discord invitation, or privacy-sensitive member data is invented or exposed. Customize operational facts before publicly promoting the page.

## Discord member verification diagnostics

The callback now returns to the actual repository Pages site at `https://evelynrose20.github.io/eclipse-order-dashboard/?portal` instead of the account-root 404. If configuring a different host, `DISCORD_FRONTEND_URL` in private `server/.env` must be the exact deployed frontend location.

Discord's HTTP 404 is ambiguous: error code `10007` means **Unknown Member**, while `10004` means **Unknown Guild**. Incorrect bot access also causes membership checks to fail. The dedicated Discord access screen distinguishes real missing membership from configuration errors and Discord outages.

When a known member (especially a server owner) is rejected, run locally on the Windows backend:

```powershell
cd server
npm run discord:check -- YOUR_DISCORD_USER_ID
```

This returns the configured `guild_name` and `guild_id`, membership status, and safe Discord HTTP/error codes. Compare these against **Copy Server ID** in Discord and verify that `DISCORD_BOT_TOKEN` belongs to the bot actually inside that guild. No secrets are logged. A successful verification should show `"status": "member"`. Restart the backend after editing `.env`.

## Discord-only sign-in and membership verification

The member portal uses **Discord exclusively**: there are no email/password sign-in or registration routes. A member must be in The Eclipse Order's configured Discord guild, pass membership screening, and have an **approved** Order account. A Discord identity by itself cannot grant moderator access or change character ownership, syndicate ranks, or RP roles.

**Deployment and configuration (private Windows server):**

1. **Before deploying, preserve existing data and admin access:** back up MySQL. Existing accounts are never matched to Discord by email or username. If an existing account was not linked under the previous Discord integration, link it locally using `npm run discord:account -- link "existing-account@example.com" 123456789012345678` from `server/`. The Discord ID must belong to that same person, confirmed by an administrator in Discord Developer Mode. This command does not transfer characters.
**Recovering an existing owner account after the first Discord login:** If the portal says your verified Discord account is pending even though you already have a Domina account, do **not** approve the newly generated applicant or create another owner. From the Windows server, back up MySQL and run `npm run discord:account -- link "YOUR_EXISTING_ACCOUNT_EMAIL" YOUR_DISCORD_USER_ID` in `server/`. The local command now safely transfers a Discord link from a new, unapproved, unused applicant to the selected existing account. It refuses to take a link from another established account, and preserves the original Domina role, characters, and permissions. Sign out and retry Discord login after recovery. Use Discord Developer Mode → Copy User ID for the numeric ID. This cannot be done just by pushing a frontend build: it operates on your private Windows MySQL database. Do not share your Discord bot token, client secret, or database password. The `owner` command is only for a genuinely empty installation without an active Domina, not for repairing an existing owner account.

2. Run `npm run setup:local` in `server/` to apply rerunnable migrations `014_discord_oauth.sql` and `015_discord_membership.sql`. Restart the backend after updating the environment.
3. In the [Discord Developer Portal](https://discord.com/developers/applications), configure the same OAuth2 application's client ID and secret, and the exact HTTPS callback URL, e.g. `https://api.rosefires.com/auth/discord/callback`. The website requests `identify` for login. **Only when the visitor selects “Request to join the Order’s Discord”** does it request `identify guilds.join`.
4. The **same application’s bot** must already be a member of the Order's server. Set `DISCORD_GUILD_ID` (server ID) and `DISCORD_BOT_TOKEN` in private `server/.env`. The bot must be able to retrieve individual guild members and have **Create Instant Invite** permission for the Discord `guilds.join` endpoint. Never put bot tokens or the OAuth client secret in source control or frontend variables.
5. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` and `DISCORD_FRONTEND_URL` in the same private file. The frontend URL must share the origin of `API_ALLOWED_ORIGIN`; for GitHub Pages it may include the repository path. Ensure `API_PUBLIC_ENABLED=true` and `API_PUBLIC_HOST` match the secure API tunnel. Verify the bot's membership permission before publicly switching the login page.
6. Users sign in with Discord. If they are not in the guild, the UI offers a **separate opt-in** to request joining. Discord membership screening, when enabled, must be completed within Discord before access is allowed. First-time Discord identities automatically receive **pending** Order accounts; only Order command can approve them.
7. If the project has no active Domina, an administrator at the Windows server may promote the first Discord-linked application using `npm run discord:account -- owner 123456789012345678`. It refuses if an active Domina already exists. This never bypasses Discord guild membership.

**Security:** server-side bot guild membership is checked at Discord OAuth completion and checked on existing authenticated API sessions with a short cache. Unavailable Discord membership checks fail closed; 404 means the user is not in the guild; Discord membership screening is not treated as complete access. Users may choose whether to authorize joining through Discord. The server does not use Discord email, an invite link, or public profile to establish account ownership. Existing opaque session tokens are issued only to approved accounts. The old password login, password registration and local password-based first-account setup are disabled.

**Bad End FC notice:** the public website and Discord sign-in page identify The Eclipse Order as an adult Bad End-focused RP community, explaining lasting fictional consequences including character death, captivity and servitude, while making out-of-character player consent and safety paramount.

## Member experience

- Sign in with Discord, join the Order's Discord server if needed, and await Order command's approval before portal access.
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
