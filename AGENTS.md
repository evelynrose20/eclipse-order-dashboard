# Eclipse Order — Instructions for future AI code edits

## Architecture
React + Vite frontend; Supabase Auth and Postgres RPCs. Dashboard.jsx handles character UI; OrderSheets.jsx displays full and collar-bound sheets; RPPlatform.jsx implements free/bound status requests; Encounters.jsx implements D&D encounter mechanics and dice; ProfileConsent.jsx holds private player content preferences; supabase.js contains the RPC client; supabase/*.sql contains server-side permissions.

## Non-negotiable rules
1. All private data access must be authorized by server-side RPC and Postgres permissions. Do not rely on disabled buttons, CSS hiding or client-side roles.
2. Bound players must never receive their sealed ability scores, spells, inventory, features or private notes in API responses.
3. Free and bound character status must change both directions, preserve the complete sheet, and require explicit player OOC approval.
4. In-character fiction cannot remove out-of-character pause, decline, revoke or leave controls. RP content preferences must live on the private player profile, not public sheets or repeated scene consent forms.
5. Adult-RP access requires both a player 18+ declaration and Domina-controlled eligibility approval. Do not implement ID collection/document storage; the declaration and staff decision are not proof of age.
6. GM-private encounter dice results and GM notes must not be disclosed to unauthorized accounts. Content categories should be checked by server RPC without revealing an individual's private preference record to staff or other players.
7. Never commit service-role keys, database passwords, login passwords or sensitive OOC disclosures.
8. Database schema changes require a forward SQL migration, backup and permission tests. GitHub build success does not run migrations.
9. Do not enable production deployment from feature branches or merge without the user's release approval.
10. Keep private RP and backup data out of GitHub, public artifacts and error logs.

## Safe AI edit workflow
- Create a branch; identify affected schema, permissions and user interface.
- Prefer configurable admin settings over hardcoded new constants.
- Add tests and run npm ci, npm test and npm run build.
- Verify permissions with a Domina, a bound member, an unbound member and an unrelated handler.
- Open a pull request for review and document the migration and rollback requirements.
- Never claim database authorization is tested unless a real test Supabase instance was exercised.
