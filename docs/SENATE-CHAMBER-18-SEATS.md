# Governance of the Imperium Noctis

The Order has one governing chamber at a time.

- Until the Domina convenes the Senate, the original five-seat Council retains its offices and proceedings.
- Once convened, **the Senate replaces the Council**, rather than becoming a separate advisory body. Council appointment and voting actions are suspended at the server and its menus are removed from the active governance screen.
- Suspending the Senate restores the Council's authority without deleting either chamber's past motions or ballots.
- The Senate has **15 fixed senatorial seats** and **3 heads**: the Domina as the first Head and two independently appointed Heads whose titles the Domina can edit. Every appointed head or senator gets at most one vote. Vacant seats remain visible. One approved account cannot occupy multiple seats.
- The Senate is **disabled by default** unless previously activated. An enabled Senate stays enabled after migrating to this structure.
- On each Senate bill, the electorate is taken from currently appointed eligible senators and heads at opening; its quorum is the configured percentage of the occupied electorate, with at least two voters. Ballots and results remain in the historical record. Previously started bills are not silently reset.
- The Order Charter remains available for editing. The five-seat Council's quorum and voting thresholds are hidden while the Senate presides; Senate quorum is configured in its chamber instead.
- IC authority does not change website account roles, moderation or privacy permissions.

## Database migration

Run the additive `server/sql/036_senate_governing_chamber.sql` via `server/npm run setup:local` after backing up the database. Existing senator memberships are migrated into numbered seats (up to 15) only on initial installation of this migration. Previously cast ballots, Council motions and Senate bills are retained. The two newly appointed heads are initially vacant.

Deploy the matching Windows API and website code. Merging GitHub does not update the local MySQL database.
