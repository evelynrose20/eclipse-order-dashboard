# Optional Senate — Eclipse Order

## Activation and authority
The Senate is **not established at installation**. MySQL seeds `order_senate_settings.enabled=0`; only an authenticated account with the `domina` account role can activate or suspend the chamber through Governance → Senate. Suspended Senate records and votes remain stored but no new legislative actions can occur. This does not modify the five-seat Council or its Charter 0.2 rules.

The Senate is an **in-character deliberative body**, not an alternate administrator, moderation committee, or override of the Domina. Senate passage is a recorded resolution and cannot automatically enact financial transfers, permissions, front licenses, account restrictions, member binding, changes to OOC consent, game mechanics, or the Council's reserved powers. Reserved Council and Domina ratification processes remain separate.

## Membership and motions
The Domina appoints and removes senators from approved active accounts. An account gets one Senate seat; no proxy votes or duplicate ballots. An appointed senator or the Domina may draft a motion. Only the Domina may formally open a draft for voting; at least two eligible senators are required.

When voting opens, eligible active senators are snapshotted in `order_senate_electorate` with a fixed count and quorum requirement. New appointments do not retroactively join an opened ballot. Removal prevents further voting; existing ballots are preserved. Senators may cast or revise one ballot while a motion is open. Choices are yes, no, or abstain.

Quorum is at least two senators and is calculated at opening using the configured threshold (50%, 60%, 67%, 75%, or 100%). Abstentions count as participation. A motion passes only when quorum is met and yes votes exceed no votes; otherwise it is rejected when the Domina closes it. The Domina may withdraw a draft or open motion; sponsors can withdraw their own.

All activation, appointment, drafting, voting, withdrawal, and closure actions are logged. Ballot summaries are visible; individual recorded votes are only returned to the Domina through this API. This is an IC political record, not a secret ballot implementation.

## Deployment
Back up the live MySQL database before updating. Apply additive migration `server/sql/033_optional_senate.sql` with the existing `npm run setup:local` script under `server/`. No SQL change enables the Senate automatically. Test a Domina account and ordinary member account in separate sessions after setup. Merely merging frontend and backend files does **not** apply the database migration or enable the Senate.

## Current limits
The existing Council chamber, office appointments and approval queue remain **demonstration-only** and cannot be represented as live records. The Senate has member appointment, draft motion, vote, tally and audit persistence, but no parliamentary committees, election cycles, floor schedules, amendment histories, or treaty enforcement. Those would be distinct future work, not capabilities implied by Senate activation.
