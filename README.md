# Eclipse Order Dashboard

A responsive, single-page roleplay ledger for character records, rank privileges, tabletop dice checks, and an in-world Black Market reference catalogue.

## Features

- Full-width desktop command center and mobile-friendly navigation.
- Searchable character roster with rank filtering, rank changes, editing and confirmed deletion.
- Character sheets with six D&D-style attributes, gil, HP, assignments, notes and rank allowances.
- Configurable d4/d6/d8/d10/d12/d20/d100 rolls with visible attribute and rank modifiers.
- Read-only market catalogue with rank filters and pricing.
- JSON export/import with confirmation, size limits and duplicate-ID handling.
- Automatic migration of existing `fc_slaves` and `fc_slaves_modular` browser ledgers.

## Start locally

```bash
npm ci
npm run dev
```

To verify a production build:

```bash
npm run build
npm run preview
```

## Data and security limitations

**This is a browser-local demo/workspace, not a secure multiplayer website.** It deliberately has no login or fake administrator gate. All edits are stored only in the current browser's `localStorage` under `eclipse-order-ledger-v3`; there is no shared database, user verification, server access control, commerce processing, or synchronized permissions. Do not store passwords or sensitive personal data in this app.

Before clearing browser data or changing devices, export the ledger under **Workspace & backup**. Importing a JSON backup **replaces** the current browser ledger after confirmation.

The previous frontend included a hard-coded administrator credential. It must be regarded as disclosed and changed anywhere it might have been reused; removing the reference from current source cannot erase Git history.

A real multi-user release requires a backend with server-side identity, roles, authorization and persistent database storage. Never implement staff-only permissions solely through React state or browser storage.

## Deployment

The existing GitHub Pages workflow deploys only pushes to `main`; this overhaul can be reviewed in a pull request without deploying it. After merging, configure **Settings → Pages → GitHub Actions** if necessary. Vite's base path is configured in `vite.config.js` for the repository Pages URL.
