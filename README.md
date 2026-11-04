# Eclipse Order — FC RP & D&D Dashboard

An adult-roleplay FC management system with D&D-style character records, magical collar mechanics, Order account hierarchy, OOC-first scene participation, and shared server-recorded dice.

## Development status

**Not yet production-ready.** This branch is part of a stacked draft PR (#6). The production GitHub Pages site is not upgraded by editing this feature branch. Supabase SQL has not been applied or verified by the GitHub build check.

## Features implemented in this branch

- Responsive dark command dashboard, character roster and full D&D-style character sheets.
- Supabase Auth and PostgreSQL RPCs with Domina, High Command, assigned Handler (Master/Mistress), and Member permissions.
- Separate normal member standings and reversible free/bound character status.
- Server-restricted bound character views that keep the full sheet intact.
- Explicit linked-player OOC approval before either free→bound or bound→free status transition.
- Persistent RP scenes with scope/themes stated before opting in, plus pause and revoke controls.
- Shared server-generated dice with formulas, advantage/disadvantage, recorded history and GM-private visibility.
- Command-only account eligibility flags, audit events, and plain-text house rules/settings editing.
- JSON export and migration support; automated database offsite backups are **not yet configured**.

## Set up and verify

Read [Operations](docs/OPERATIONS.md) and [Roadmap](docs/ROADMAP.md). For a fresh Supabase project, run the combined [setup SQL](supabase/SETUP-ALL.sql) in the trusted Supabase SQL Editor. **Back up before migrations.** Create a real Supabase Auth account and bootstrap its role as Domina, then independently review each member's adult-RP eligibility. The flag is not proof of age.

The public Supabase URL and publishable key are configured in Vite production settings. Never use a secret/service-role key in frontend environment variables.

Local commands:

```sh
npm ci
npm test
npm run dev
npm run build
```

## Security and consent

- Backend authorization is mandatory: never infer permission solely from React.
- The fictional character can lack IC consent, but real OOC participants must consent to the described scene. That consent can be declined, paused or revoked.
- The status-request approval and OOC scene agreement are separate controls.
- Adult-RP participation is blocked until Domina review, but you still need an appropriate real-world age-verification and moderation process before opening to members.
- The scene system currently lacks private invites, granular lines/veils and safety-incident workflows; see the roadmap.
- The old repository's hard-coded password remains exposed in Git history: rotate it anywhere it was reused.

## Safe AI assistance

See [AGENTS.md](AGENTS.md) for architecture, invariants, testing, permission rules and the proper feature-branch workflow. Small UI and rules-editor changes should use a reviewed pull request, not direct production edits.

## Deployment

GitHub Pages deployment remains limited to `main`. Dependencies and SQL migrations must be reviewed and applied before merging the stacked branches into production. Use a staging Supabase project for real permission checks and database restore tests.
