---
tags: [discord, accounts, governance, permissions]
---
# Accounts, Discord approval, staff permissions and governance

**Discord-only authentication:** a user must authenticate through the configured Discord OAuth flow and satisfy guild membership checks. Approved Accounts determines website authorization, not permanent Discord membership. Staff should use the admin UI rather than modifying database rows.

**Approved Accounts:** approve/reject membership, assign roles/ranks, **Remove access** and review **Removed / rejected accounts**. Removal deactivates login, revokes sessions and preserves character sheets, prior records and audit history. Restoring requires current Discord membership. Discord guild membership is checked on authenticated sessions and by periodic server reconciliation; a confirmed departure/kick/ban can revoke approval. Discord API outages should not be treated as evidence of expulsion. The last active Domina is protected from automatic removal.

**Permissions:** use site roles and scoped assignments rather than assuming that any Discord server member is a game-master. A Domina/high-command action can be more privileged than member-only character editing. Check both the UI and server-side route restrictions.

**Governance:** leadership/council and optional Senate are separate from staff account management. Senate availability and seat assignments depend on configuration; do not assume the optional mode is enabled. Ratification, authority and charter rules are described in the governance documents.

**Code:** `LocalWorkspace.jsx`, `LocalAccounts.jsx`, `account-access.js`, `accounts.js`, `auth.js`, `discord-guild.js`, `governance-live.js`, `senate.js`. References: [[LIVE-GOVERNANCE]], [[OPTIONAL-SENATE]], [[GOVERNANCE-CHARTER-0.2]].
