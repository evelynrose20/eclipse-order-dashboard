# Senate political chamber and preview

## Early preview (Senate disabled)

Open **Member Portal → Governance → The Senate → Explore Senate overview preview**. This is available while the five-seat Council remains the governing body. The panel uses locally bundled example parties, 15 sample elected-seat positions, three Heads, sample bills and a coalition. The **Preview next phase** button cycles the illustrative election progress bar. Nothing in this view creates parties, elections, bills, votes or appointees. Its banner always says **Chamber preview — sample data**. Close the preview to return to the inactive Senate.

## Live Senate

Once the Domina convenes the Senate, the same interface loads persisted data from `GET /governance/senate/politics`. The existing three Head appointments and Senate bill voting remain available through the collapsible *Senate appointments and legislative controls* section. Existing bill votes are displayed in the overview.

### Political features
- Approved members may found one party, join a party, or stand as independent candidates. Party founders are their party's initial leader. Party records contain name, abbreviation, manifesto and color. A member can belong to at most one party.
- Domina opens elections (14–365-day configurable terms). Stages: nominations → campaign → voting → Domina confirmation → investiture. One active election at a time.
- During nominations, a member can nominate themselves. Their registered party membership determines their slate. Unaffiliated nominees run independently.
- Eligible approved members get **one private ballot** for a party slate, with an optional candidate preference. Independent slate votes require a candidate preference. Votes cannot be changed after casting. Only aggregated tallies are published, after the voting phase.
- Seat allocation uses the Hare quota and largest remainders, capped by available candidates. Candidate preference votes rank winners on each list. Unfillable places remain vacant.
- All provisional seats require Domina confirmation, with recorded IC reasons for rejection. A rejected winner is replaced by the next eligible nominee of the same slate if available. Until all 15 positions are confirmed or marked vacant, no investiture is allowed.
- Investiture replaces **only the 15 elected Senate seats**, transactionally. The Domina and two appointed Heads remain unchanged. Manual Senate-seat assignments are no longer available once an election has been completed.
- Party leaders can propose coalitions with at least two parties; invited party leaders explicitly accept membership. The Domina can also organize coalitions and dissolve them. A coalition does not override an individual senator's vote.
- The interface preserves existing Council/Senate alternation and does **not** change Discord/OOC roles or moderation/safety permissions.

### Deployment

Back up the local MySQL database and run `npm run setup:local` from the Windows API's `server` folder to install migration `040_senate_politics.sql`. Deploy the frontend and API together. Preview is UI-only and uses no seeded database examples. There are no elections or parties created by migration.

### Pending extensions

The overview reads existing bills and ballots, but does not yet implement a threaded debate board or bill amendments. A formal voter eligibility snapshot, time-scheduled phase transitions and election appeal process can be added separately, without sacrificing the preview or existing chamber records.
