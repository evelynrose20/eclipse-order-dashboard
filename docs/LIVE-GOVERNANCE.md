# Live Imperium Noctis Governance — Charter and Council
The Governance page is a live, database-backed Order workspace. No fictional example motions, applicants or appointments are seeded. The optional Senate is separately activated and continues to default to **off**.

## Charter
The Domina can edit the charter title, its entire in-character text, and the numeric voting rules: quorum (2–5), major/reserved affirmative votes (3–5), and reserved ratification deadline (1–90 days). Changes are versioned and entered in an audit ledger. Concurrent edits fail with a revision conflict, requiring a refresh. The historic version is preserved in `order_governance_charter_history`. Each Council motion snapshots voting thresholds when it opens, preventing later edits from retroactively changing its outcome.

The original five Council offices remain fixed: Domina, Chief of Operations, Master of Commerce, Faction Envoy, and Prefect of Internal Affairs. The Domina chair comes from the real Domina account role. The Domina may appoint or vacate the four other offices using approved accounts. Existing ballots remain immutable historical records even if the office changes; voters may revise their ballots while voting remains open and they still hold an office.

## Proceedings
Council members and the Domina may propose motions. Only the Domina may open or close the ballot. The electorate is snapshotted on opening. A motion must meet quorum. Ordinary motions pass if yes exceeds no; major/reserved motions need the configured number of yes votes. Abstentions count toward quorum. Reserved motions remain unratified until the Domina explicitly ratifies them before the deadline. An expired or declined reserved motion is returned for review, never automatically ratified.

The IC Council is not a website security role. A passing motion records a governance result only and cannot directly operate the treasury, edit account permissions, disclose RP preferences, override player consent, change class rules, or bypass OOC moderation.

## Approval Queue
The Governance approval queue shows **real Order Front records** from the existing `/fronts` API. Its IC and website approval controls call the existing backend authorization checks. It does not claim to represent other application types whose live APIs are managed elsewhere. A front still requires both independent approvals to operate.

## Windows deployment
1. Back up your MySQL database.
2. Pull the merged code and, from `server/`, run `npm run setup:local` with your existing private environment file; this applies additive migration `034_live_governance.sql` (and any earlier pending migrations).
3. Restart the Windows API and refresh the website. Verify with separate Domina, officer, and ordinary member accounts.

Merging GitHub code does not alter the live MySQL database. Automated GitHub tests verify code and schema checks, not your particular production records or staff permissions.
