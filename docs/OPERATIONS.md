# Imperium Noctis — operations and release checks

## Supported deployment

The supported member portal is the React/Vite frontend configured with `VITE_ECLIPSE_API_URL`, served from GitHub Pages, backed by the Windows Node/MySQL service. The API binds to `127.0.0.1:3182`; Cloudflare Tunnel publishes the API only when explicitly enabled and verified. The older `supabase/` SQL and legacy frontend route are retained for compatibility, **not** for the Windows launch.

## Database changes

1. Make a private backup of the `eclipse_order` MySQL database and confirm it can be restored.
2. Pull the intended server revision. Keep `server/.env` private.
3. From `server/`, run `npm ci`, then `npm run setup:local`. The setup executes additive migrations `005_features`, `007_syndicate_ranks` and `008_event_xp` and retains existing accounts/character sheets.
4. Restart the backend with `npm start`. Check `http://127.0.0.1:3182/health` and `/ready` locally. Healthy HTTP alone does not prove migrations or permissions are correct.
5. Verify migration records and test an actual completed-event XP award using test accounts.

Never apply `supabase/*.sql` to MySQL or publish the administrator DB password. No MySQL migration is run by the frontend GitHub Pages workflow.

## Permissions, OOC safety and member acceptance

Test each action in separate sessions for Domina, a GM/officer, an unrelated member, a bound player and their assigned handler:

1. Pending account cannot sign in; approved account can; expired/revoked sessions stop working.
2. Only authorized roles can change account roles/ranks, create/manage events, view GM-only notes and award event XP.
3. Private RP/kink preferences are off by default; sharing and withdrawal take effect promptly. Unrelated users cannot query private fields.
4. Bound players receive the limited dossier response, not hidden private sheet data. Binding/unbinding requires the player's explicit OOC approval and preserves the sheet.
5. OOC stop, withdrawal, and consent changes work regardless of IC status.
6. Events: draft privacy, publishing, signups, approval, roster assignment, initiative, combat/dice history and refresh persistence.
7. XP: only completed events, only eligible participants, one award per character/event; level progression remains consistent after reload.

An account's 18+ declaration is not conclusive age verification. Community admission and moderation policies remain staff responsibilities.

## Public routing and launch

Follow [Cloudflare launch](Operations/CLOUDFLARE-LAUNCH.md). Confirm the site's **exact** HTTPS origin in `API_ALLOWED_ORIGIN`, the expected `API_PUBLIC_HOST`, the tunnel route, preflight CORS and sign-in from the published site. Ensure `/auth/setup-domina` and `/ready` are unavailable over the public API. Configure Cloudflare rate limits on login and registration; avoid HTML challenges on JSON API requests without client support.

## Recovery and ongoing operations

Automated encrypted offsite backups, verified restores, email recovery/verification, persistent rate limiting and monitoring are **not confirmed production-ready**. Arrange those before unrestricted signup. Protect the Windows host from sleep and unexpected shutdown; a healthy Cloudflare tunnel does not keep Node or MySQL running. Keep credentials, private OOC data, database exports and diagnostic logs out of public artifacts.

## Release procedure

Create a branch and PR; review CI, migration impact and the complete permission matrix. Verify the running server and browser separately; merge only after explicit release approval. Record the deployed frontend commit and installed migration versions. Preserve a rollback plan and a usable pre-release backup. 
