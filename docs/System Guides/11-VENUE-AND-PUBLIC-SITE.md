---
tags: [website, venue, recruitment]
---
# Public website, recruitment, lore and venue

**Public site:** home/about, recruitment, events, faction and world descriptions, lore archive, venue, contact and governance pages. These are reader-facing views and should never expose staff admin controls, private character details or raw API error messages.

**Venue:** The Midnight Eclipse venue has its own management, public status, roster, menu and rules functions. The public venue open/closed indicator and scheduled events are independent of actual Discord account approvals and the World Admin city simulation. A venue session is not automatically a world settlement or NPC event.

**Recruitment:** publish whether applications are Open or Closed and the current reason. Login is Discord-only with server membership verification; prospective visitors may be shown the Discord join route. A recruitment submission is not equivalent to an Approved Account or staff rank.

**Lore and chronology:** the current public faction identity and character names should come from the latest approved lore rather than archival drafts. Prior Eastern/Thirteenth/older faction branding may be historical or superseded. Only publish the current player-approved version. Do not repurpose historical documents as current site copy without review.

**Where to edit:** venue management pages and FAQ/lore editors; staff account approval remains in account administration; website deployment is separate from the Windows API.

**Code:** `PublicSite.jsx`, `VenueManagement.jsx`, `VenueStatus.jsx`, `VenueMenu.jsx`, `LoreArchive.jsx`, `recruitment.js`, `venue.js`, `faq.js`. Additional references: [[VENUE-MANAGEMENT]], [[VENUE-ROSTER-EDITING]].
