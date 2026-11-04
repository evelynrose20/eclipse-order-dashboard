# Eclipse Order — Operations and deployment guide

## Migration order
**Fastest for a fresh project:** open supabase/SETUP-ALL.sql, copy it into Supabase SQL Editor and run once after backing up the project. The combined script includes every migration below. If parts have already been applied, review the current schema and take a backup before applying further SQL.

Alternatively, run these from Supabase SQL Editor in order:
1. supabase/schema.sql
2. supabase/roles-and-sheets.sql
3. supabase/platform-foundations.sql
4. supabase/advanced-dice.sql
5. supabase/audit.sql
6. supabase/settings.sql

These files are not deployed to Supabase automatically by GitHub. The real Domina account must be provisioned via Supabase Authentication → Users, then assigned via the commented bootstrap SQL in roles-and-sheets.sql. Other member accounts must be approved too. Adult RP access must be reviewed and approved by the Domina; the approval flag is not documentary age verification.

## Critical acceptance tests before production
- Confirm Domina can administer accounts; High Command cannot grant itself Domina.
- A member can see their own free sheet, not someone else's.
- Bound character APIs return only redacted information; direct REST calls must not expose hidden fields.
- Free → bound and bound → free transitions both require player OOC approval and preserve the full record.
- Linked characters cannot be transferred while bound or rebound through the ordinary character editor.
- A handler sees only assigned characters and cannot read full member email records.
- Adult-unapproved accounts cannot enter RP scene operations.
- Scene agreement lists the complete scope and themes before opting in; pause and revoke always work OOC.
- Opted-in players can roll and see shared server-recorded results. A paused or revoked player cannot roll.
- Advantage and disadvantage use 2d20kh1 and 2d20kl1. GM-private rolls must stay hidden in API responses.
- Audit records are written for command review.
- Test browser reload, mobile layout, network failure, session expiry, and database restore.

## Backups and retention
Automated offsite Postgres backups are NOT configured. Supabase Free is unsuitable as the sole long-term copy of irreplaceable RP data. Keep encrypted, access-controlled backups outside the public repository, use multiple historical copies, and test restoring one to a separate database before production. Administrative audit history has no automated pruning yet. Define and implement a retention/deletion policy.

## Deployment
The branches are stacked: dashboard overhaul → Supabase → character roles → RP platform. A parent PR merged into a feature branch does not necessarily mean the site is deployed from main. Never merge or publish the new version before SQL, access controls and browser workflows have been tested.

## Low-maintenance routine
Monthly: verify backups and error logs. Quarterly: restore a backup in staging, review dependencies and rerun permission tests. For small AI edits, use AGENTS.md and require a PR with green tests.
