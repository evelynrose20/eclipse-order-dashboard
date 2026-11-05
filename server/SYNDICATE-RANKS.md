# Official Eclipse Order syndicate hierarchy

The five syndicate titles are distinct from **technical permissions** and **binding ranks**:

| Rank | In-character description |
| --- | --- |
| Domina | Supreme Leader / Head of Syndicate |
| Oyabun | Senior Boss / Officer |
| Kusushi | Specialist / Alchemist / Enforcer |
| Operative | Standard Member / Agent |
| Kumi-in / Initiate | New Recruit / Probationary |

The account record stores `syndicate_rank` separately from `account_role`.
The account role remains one of `domina`, `high_command`, `handler` or `member`, and continues to govern API security. An Oyabun title does **not** automatically grant administrator access. Binding ranks (Rank I–IV) remain on character records and are unaffected.

The Domina can assign ranks under **Order accounts** in the MySQL-backed dashboard. Newly approved recruits default to `Kumi-in / Initiate`; current Domina-permission accounts receive the Domina syndicate title. Existing non-Domina accounts are **not** automatically promoted based on older standings; set their titles explicitly.

## Windows installation

To use the new ranks in the Windows backend, back up the `eclipse_order` MySQL database, update your checkout to the merged `main` branch, then from `server` run:

```powershell
npm run setup:local
npm start
```

`setup:local` applies additive migration `007_syndicate_ranks.sql`, preserving existing accounts, sessions and character sheets. Re-running setup is supported. This step requires the local MySQL administrator password, which remains private and must never be committed to GitHub.

The public GitHub Pages UI deploys automatically from main but requires the updated Windows API and migration to use the new dropdown. Updating the website alone cannot modify MySQL on your PC.
