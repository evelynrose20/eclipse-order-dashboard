---
title: Pregnancy & Parenthood — Dashboard TODO
status: planned
priority: backlog
area: Character Sheets / Servitude
tags:
  - todo
  - dashboard
  - roleplay
  - characters
---

# Pregnancy & Parenthood — Roll-Based Dashboard System

> [!todo] Planned, not implemented
> Integrate a persistent, fictional pregnancy and parenthood system into the Eclipse Order Dashboard. This note is a product TODO, **not** a feature already built.

## Goal
Support darker, consequence-driven adult RP through a clear dice-based pregnancy possibility, persistent character states, and IC consequences within the Domina's collection. Apply to eligible adult characters, including regular members and thralls, without turning it into a separate public-facing service.

## Requirements

- [ ] Add a private **Pregnancy & Parenthood** section to existing character sheets and character management instead of duplicating characters.
- [ ] Connect outcome resolution to the existing dice system. Use a configurable **fictional D100 probability**, not a claim about real-world medical fertility rates.
- [ ] Require the affected player's explicit, revocable **OOC opt-in** to pregnancy outcomes before an authorized roll. Standing consent may cover defined scenarios; consent to escort/sexual RP alone is insufficient.
- [ ] Only allow appropriately authorized events to trigger rolls; prevent rerolling to erase a result, accidental duplicates, or unauthorized staff outcomes. Maintain an audit log.
- [ ] Record relevant IC event date, participants/characters where agreed, roll result, resulting state, and a privacy-aware history.
- [ ] Track fictional pregnancy status and milestones against the campaign's IC calendar, including scheduled birth-related events.
- [ ] Allow player-approved narrative outcomes and staff-managed corrections when records need repair; do not require forced irreversible medical or reproductive outcomes.
- [ ] Provide private family/parentage records and dependent NPC references. Keep minors out of sexualized scenes and the adult servitude mechanics.
- [ ] Support Steward/handler visibility limited by role and legitimate IC access. Do not publish private kink sheets, individual limits, or sensitive OOC information.
- [ ] Keep pregnancy separate from automatic slave rank changes, freedom, or advancement; allow IC assignment/accommodation changes through existing Order workflows.
- [ ] Present the feature in the dashboard's established UI design (see [[DASHBOARD-DESIGN-RULES]]); avoid another long, generic settings page.
- [ ] Add migration, API authorization, frontend UI, tests for permissions and idempotency, and concise user-facing documentation.

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
