---
aliases:
  - Eclipse Order Docs
  - Documentation Home
tags: [eclipse-order, documentation]
---

# Eclipse Order — Documentation Vault

> [!important] Source of truth
> This `docs/` directory is the **single project documentation folder** for the Eclipse Order site, Windows API and living-world work. Open `docs/` as an [Obsidian](https://obsidian.md/) vault or synchronize it with a local Git clone. The root `README.md` (GitHub repository entrypoint) and root `AGENTS.md` (code contributor instructions) stay at repository root intentionally.

## System handbook — how everything works

**Start here for day-to-day dashboard gameplay:** [[System Guides/00-SYSTEM-HANDBOOK|System Handbook]]. It includes step-by-step settlement rebuilding, world ownership, civilian needs, industry, construction, power, logistics, diplomacy/NPCs, characters/events, accounts, the chamber, venue operations and Windows API troubleshooting. For a ruined or abandoned settlement, go directly to [[System Guides/01-SETTLEMENT-REBUILDING|How to rebuild a settlement]]. The [[System Guides/13-SYSTEM-DEPENDENCIES-AND-GAPS|system dependency map]] separates implemented behavior from unfinished integration.

## Continue the Living World project

1. **[[LIVING-WORLD-WAR-COMMAND-MASTER-PLAN]]** — full design specification, gameplay architecture, safety and milestones.
2. **[[LIVING-WORLD-TODO]]** — actionable tasks with checked/pending status. Update after each merged PR.
3. **[[WORLD-ADMIN-TROUBLESHOOTING]]** — editing and Windows API repairs.
4. **[[ROADMAP]]** — original site release-readiness record. This is a *separate* historical checklist.
5. **[[OPERATIONS]]** — production deployment, backup and permission checks.
6. **[[WINDOWS-SELF-HOSTING]]** — current Windows API and MySQL hosting.
7. **[[TESTING-WITHOUT-PLAYERS]]** — test gates.

## Site and RP systems

- [[PLATFORM-FOUNDATION-PLAN]]
- [[GOVERNANCE-CHARTER-0.2]]
- [[LIVE-GOVERNANCE]]
- [[SENATE-CHAMBER-18-SEATS]]
- [[SENATE-POLITICS-PREVIEW]]
- [[CHARACTER-JOB-PROGRESSION]]
- [[EVENT-PLANNING]]
- [[BATTLEMAP-DICE]]
- [[OPTIONAL-SENATE]]

## Deployment and archived setup

- [[Operations/SERVER-README|Windows API setup guide]]
- [[Operations/CLOUDFLARE-LAUNCH|Cloudflare launch]]
- [[Governance/SYNDICATE-RANKS|Syndicate rank notes]]
- [[Legacy/SUPABASE-SETUP|Legacy Supabase setup]] (historical PostgreSQL only)
- [[Legacy/SUPABASE-ROLES-SETUP|Legacy Supabase roles]] (historical PostgreSQL only)

## Obsidian and Git

To keep an editable local Obsidian vault, clone the repository and open the **`docs` directory** as the vault. Commit Markdown changes back through Git; using an Obsidian Git extension is optional. Do not commit `.obsidian/workspace.json`, API passwords, MySQL backups, member data or private RP consent information.

Obsidian wikilinks work within this directory; standard Markdown links work in GitHub. The GitHub repository still contains source code outside the vault.
