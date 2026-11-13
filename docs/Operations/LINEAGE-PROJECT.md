# Imperial Lineage Project — separate lineage, gestation and parenthood views

The project is a fictional research and inheritance registry. It does not assign unapproved physical changes or modify character species, appearance, ownership, or bound rank.

## Research workflow

Staff can create or edit a research program and its cases. Cases retain the existing Standard heredity mode; **Voidsent lineage** is a separate classification, with role-specific observed trait markers and independently recorded parenthood findings.

- **Source:** aetheric and dream markers only; intended for a largely cybernetic source such as Rosa, with no forced physical transformation.
- **Carrier:** minor observed changes (skin pigmentation, hair pigmentation, eyes, low-level resonance), suitable for Thrall-001.
- **Descendant:** anticipated or documented fictional hereditary traits (violet skin, umbral aura, black scales, pointed tail, stable voidsent essence, etc.). These records are descriptive only; they do not generate child characters.
- A case can conceal voidsent classification until staff explicitly reveals it. Until then, the participant sees only limited visible markers and participant-facing notes, not private research methods or staff observations.

## Two views of the same cases

**Imperial Lineage Project** appears in member navigation (including thralls). Staff see the full research registry, program editor, and the **Research Cases**, **Lineage & Traits**, **Lineage Gestation** and **Lineage Parenthood** tabs. Members see the same four tab categories, but the API returns only cases belonging to their own character with currently approved research access. They cannot edit other records, gain staff research notes, or bypass character-owner consent.

The character owner can allow or withdraw linkage using the existing Pregnancy section on their dossier. Withdrawal detaches existing cases without deleting general research history.

## Conception and pregnancy

Lineage gestation **reuses the established opt-in D100 conception roll and real character pregnancy record**—no second pregnancy counter is created. An eligible carrier can open the lineage-specific conception dialog. The API checks the owning character, explicit research permission, voidsent carrier case, existing conception opt-in, current pregnancy, and duplicate-event keys before recording anything. It stores the lineage case ID on the conception event and, if successful, on the existing pregnancy record. Ordinary conception has no case ID. When approved, staff can also link an existing pregnancy to research as a manual association; this remains distinct from a lineage-origin conception.

A pregnancy and its post-conception state remain under the normal character consent rules. Lineage parenthood records research notes and possible hereditary markers. **They do not create dependent player/NPC profiles and do not place minors into adult RP systems.**

## Deployment

**Migration 128 (128_lineage_paths.sql) is required on the Windows API database.** Back up MySQL and verify the backup can be restored, pull the corresponding server and frontend revision, run setup:local from the Windows API Control Center, and restart the API. Existing pregnancy and conception rows retain their existing status and default to no lineage case association. The migration is additive and rerunnable; GitHub does not apply it to the Windows server automatically.

## Gestation timing

A successful **voidsent-origin lineage conception** creates the normal consent-controlled pregnancy record with a **4 IC day** term. A normal conception event continues to create a **90 IC day (three-month)** term. The Lineage Gestation and character Pregnancy panels both read the term stored on the pregnancy, so they show the same progress; short gestation uses a day-based view rather than the normal weekly development display. Delivery is never automatic: the existing character owner/staff outcome process remains in place. Associating an ordinary pregnancy with a lineage case after conception does not retroactively shorten it. Existing records retain their current terms.
