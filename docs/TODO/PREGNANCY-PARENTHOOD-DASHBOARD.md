---
title: Pregnancy & Parenthood — Dashboard TODO
status: in-progress
priority: active
area: Character Sheets / Servitude
tags:
  - todo
  - dashboard
  - roleplay
  - characters
---

# Pregnancy & Parenthood — Roll-Based Dashboard System

> [!note] First phase implemented in repository; deployment requires migration 114.
> Automatic IC heat/rut status for bound characters (no in-character enable/disable toggle), eight-rank resonance, on-dossier notices, manually registered pregnancies, private history, consent-qualified D100 conception events and owner-only editing are implemented. Discord/email push alerts, IC time skips, dependent NPC records, and staff/participant confirmation beyond the owner are not yet implemented.

## Goal
Support darker, consequence-driven adult RP through a clear dice-based pregnancy possibility, persistent character states, and IC consequences within the Domina's collection. Apply to eligible adult characters, including regular members and thralls, without turning it into a separate public-facing service.

## Requirements

- [x] Add a private **Pregnancy & Parenthood** section to existing character sheets and character management instead of duplicating characters.
- [x] Persist a server-generated fictional D100 conception result with a configurable baseline and eight-rank heat/rut modifiers (future integration with Encounter dice history remains open). Use a configurable **fictional D100 probability**, not a claim about real-world medical fertility rates.
- [x] Require the affected player's explicit, revocable **OOC opt-in** to pregnancy outcomes before an authorized roll. Standing consent may cover defined scenarios; consent to escort/sexual RP alone is insufficient.
- [x] Permit only the character owner to request an authorized roll; prevent event retries and same-day duplicates, and maintain a private audit history.
- [ ] Record relevant IC event date, participants/characters where agreed, roll result, resulting state, and a privacy-aware history.
- [x] Track pregnancy dates and week progression against a configurable story timeline. Future work: scheduled calendar birth events and IC time skips.
- [ ] Allow player-approved narrative outcomes and staff-managed corrections when records need repair; do not require forced irreversible medical or reproductive outcomes.
- [ ] Provide private family/parentage records and dependent NPC references. Keep minors out of sexualized scenes and the adult servitude mechanics.
- [ ] Support Steward/handler visibility limited by role and legitimate IC access. Do not publish private kink sheets, individual limits, or sensitive OOC information.
- [ ] Keep pregnancy separate from automatic slave rank changes, freedom, or advancement; allow IC assignment/accommodation changes through existing Order workflows.
- [ ] Present the feature in the dashboard's established UI design (see [[DASHBOARD-DESIGN-RULES]]); avoid another long, generic settings page.
- [x] Add migration 114, API authorization, dossier UI and initial tests for rank scaling, privacy and approval.

## Decisions to settle during implementation

- Exact fictional roll odds and eligible triggers
- Calendar progression speed and whether user-controlled time skips are supported
- Staff approval and participant confirmation flow
- Which details are visible to the character owner, involved participants, and Stewards
- How to represent an OOC opt-out or revised consent without implying an IC event automatically occurred

## Acceptance criteria

- Consent-qualified rolls are persisted and cannot be duplicated by refresh or retries.
- Only authorized users can view or modify sensitive character records.
- Existing character sheets, dice, calendar, and servitude records remain compatible.
- No pregnancy state or permanent outcome can be applied to an unwilling player's character.
- Child/dependent records remain non-sexual and separate from adult venue/servitude operations.

## Initial deployment

Back up the Windows database, pull latest `main`, run `npm run setup:local` from `server`, restart the API, and redeploy the frontend. The code merge does not apply SQL or send remote notifications. Phase alerts appear privately when the character dossier is opened.

## Bound cycle behavior and command visibility

The collar/brand's IC heat/rut status is derived automatically from the bound state, official servitude rank and stable cycle anchor. Players cannot disable that IC status with an in-dossier switch. Pregnancies and conception rolls remain separate, player-controlled opt-ins; OOC pause and consent withdrawal are independent of in-character status. Domina/High Command can always inspect the IC cycle and pregnancy stage, but do not gain private notes, OOC preferences or conception-roll details without the character owner's separate sharing approval. The dossier uses the existing Garlean steel-and-scarlet design and a compact settings dialog.
