# Testing the Eclipse Order with zero real players

You can detect many failures **before** having a player community.

## Current safe test run

From the repository root, run:

```powershell
npm test
npm run build
npm test --prefix server
```

The governance simulator resides in `server/src/governance-policy.js`; it is **not imported into the live API**, and the tests use fabricated identities and no database or Discord connection. Run governance-only tests with:

```powershell
node --test server/test/governance-simulation.test.js
```

This checks fixed Council voting thresholds, vacancies, seven-day ratification, blocked self-approval, role revocation, scoped approval, and two-stage business activation. GitHub Actions can also run these tests on PRs.

## Future test environments

1. **Disposable MySQL database** named separately from the live `eclipse_order` and populated only with fabricated users, characters, factions, items and businesses.
2. **Test Discord guild**, distinct from the real FC. Assign safe test roles; never grant bot Administrator privileges.
3. **Automated scenario generator** for many simultaneous applications, Council votes, license upgrades, unusual character states and race conditions.
4. **Manual acceptance checklists** using a Domina, staff reviewer, member, applicant, bound-character owner and unassociated stranger, all as **synthetic test personas**.
5. **Controlled preview mode** to observe what a particular permission scope sees. This is different from production authorization impersonation.
6. **Backup restoration drill** and a disabled-feature rollback switch before enabling new modules.

## What these tests cannot prove

Unit tests cannot prove actual UI usability, genuine players' RP enjoyment, Discord availability, a live economy's long-run balance or the security of a complete production integration. Those need staged release, real-world verification and later player feedback.

**Never test experimental migrations on live member data.** Do not run sample seeders against production.
