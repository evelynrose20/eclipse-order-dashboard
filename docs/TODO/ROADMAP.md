# Eclipse Order — release readiness

This checklist distinguishes **implemented in the repository** from **verified in the running Windows deployment**. A successful GitHub build does not demonstrate database, authorization, or public API correctness.

## Built in the Windows/MySQL codebase

- [x] Membership requests, Domina approvals, account roles and five syndicate ranks
- [x] Character roster, full/limited dossiers, server-controlled permissions and reversible binding requests
- [x] Character classes, level progression, earned ability points and dossier controls
- [x] Private RP preferences, opt-in profile sharing and OOC participation controls
- [x] FC event preparation, signup approval, encounters, battle maps, dice and saved monsters
- [x] Completed-event XP award ledger with per-event/character duplicate protection
- [x] Removed active shop, paycheck, wallet, purchase and ration-claiming features
- [x] Frontend build and automated repository test workflows


## Long-term rebuild: design captured, not launched

The approved direction for the immersive public site, Discord hybrid permissions, five-seat Council, dual-approval fronts, custom spell review, faction systems and living criminal economy is recorded in [Platform Foundation Plan](PLATFORM-FOUNDATION-PLAN.md) and [Governance Charter](GOVERNANCE-CHARTER-0.2.md). **None of those replacement production systems is live yet.**

- [x] Governance design captured and safely testable with fabricated actors (pure prototype only)
- [ ] Disposable database + fake users and multi-account authorization tests
- [ ] Discord test guild, role-reconciliation and failure-mode tests
- [ ] Staff-only Council and approval workflow pilots behind feature flags
- [ ] Front-business licensing, faction progression and economy simulations
- [ ] Original RPG rules, class migration and approved spell system
- [ ] Public website, onboarding and old-account migration testing

See [Testing without players](TESTING-WITHOUT-PLAYERS.md) for the verification gates. No production schema or authentication changes were made by the prototype.

## Required before general member launch

- [ ] Back up the Windows MySQL database, run `npm run setup:local` (including migration `008_event_xp`), and confirm the API returns ready
- [ ] Test a full event: draft, publish, signup, approval, participation, completion, XP award, duplicate rejection, level progression
- [ ] Verify access control using Domina, officer/GM, ordinary member, bound player and unrelated account/handler; test private OOC information and GM-only dice
- [ ] Test binding approval/withdrawal and OOC pause independently of in-character restrictions
- [ ] Configure and verify public Cloudflare Tunnel, allowed HTTPS origin, login/registration rate limits, and browser sign-in
- [ ] Provide a tested, encrypted offsite MySQL backup and restoration process
- [ ] Review account recovery/email verification, persistent abuse throttling, monitoring and incident response before wide public registration
- [ ] Perform mobile/accessibility and end-to-end browser checks, including offline/reconnect, expired sessions and empty states

## Optional later improvements (not launch blockers)

- Spell-slot/rest tracking, automatic resistances and concentration, advanced contested checks, encounter balancing and a larger compendium
- Configurable house-rule tools and additional accessibility refinements

The historical Supabase migration files support the retired compatibility path and must **not** be used as Windows/MySQL setup instructions. Release details: [Operations](OPERATIONS.md) and [Windows API](Operations/SERVER-README.md).
