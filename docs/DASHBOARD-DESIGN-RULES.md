# Imperium Noctis Dashboard — Mandatory UI/UX Design Rules

**Status:** Required for all future frontend work  
**Applies to:** The authenticated Imperium Noctis dashboard, including World Administration, Industry & Projects, maps, diplomacy, settlement management, military systems, economy, crafting, and staff tools.  
**Reference implementation:** `src/imperial-theme.css`, `src/world-administration.css`, `src/world-industry.css`, `src/portal-controls.css`, `src/order-navigation.css`.  
**Anti-reference:** The original `src/military-installations.css` purple-panel treatment is **not** a visual precedent.  
**Design direction:** An immersive **Garlean / New Cassia imperial command interface** that is polished, readable, responsive, consistent, and feels like a strategy game instead of an administrative form.

> **Primary rule:** New functionality must look native to the EXISTING dashboard. Match the surrounding section before designing any new components. No independent visual rebrands.

## 1. What the site should feel like

- A coherent dark **iron, steel, military-blue/charcoal** command console, with restrained **scarlet**, **brass**, and pale neutral accents; use existing design tokens and local styles.
- A game-like strategy / grand-strategy control room, informed by Hearts of Iron IV-style management density, **not** a generic SaaS analytics dashboard, mobile app, or purple fantasy RPG.
- Elegant but functional: data-rich, purposeful, grounded in the existing map and simulation. Show real states, inventories, ownership, capabilities, production, and consequences.
- Real UI text for Order personnel or players. No developer notes, schema names, migration messages, architectural explanations, “fictional” disclaimers, or implementation commentary visible on gameplay screens.
- Visual continuity is more important than making an isolated new panel “beautiful” on its own.

## 2. Colors and themes — mandatory

Use the existing imperial and World Administration theme, not new arbitrary palettes. Existing values to follow:

| Purpose | Existing reference |
|---|---|
| Main page / application background | `#131b23`, `#141e29`, `#11161c` |
| World Administration panel background | `#1a2530`, `#182733`, `#1b2a36` |
| Input / inset surfaces | `#202a33`, `#101f2a` |
| Borders / dividers | `#40515b`, `#405462`, `#435565` |
| Primary text | `#e7e9e7`, `#e7e4df` |
| Muted labels | `#a1b0b9`, `#acbdc9` |
| Brass / gold emphasis | `#cca673`, `#debf8c`, `#f1dabc` |
| Imperial scarlet / danger | `#a8313d`, `#963f49`, `#bd545c` |
| Operational / success state | existing muted green (`#a9dfc3`) |

Rules:
1. **No purple or violet page/panel palette** for new work. The purple Military Installations panel was a visual regression.
2. Keep sidebar, page headings, tabs, panels, forms, badges, overlays, and buttons within one coherent visual system.
3. Accent colors have meaning: brass for active/selected/important; scarlet for critical/danger/destructive actions; green for functioning/ready; amber for damaged/rebuilding; muted gray for unavailable.
4. Avoid neon colors, candy gradients, bright card fills, glassmorphism, giant shadows, glow-heavy effects, and decorative noise.
5. **Do not invent local CSS color tokens** when existing `--imperial-*`, `--wa-*`, or `--eo-ui-*` variables already express the intent. Where current styles are literal colors, match their established palette before extracting shared variables.
6. Do not touch the distinct public-site theme simply to style a dashboard section.

## 3. Shape, typography, and scale

- Use **compact military-console geometry**: square or slightly softened corners, typically **2–6 px** in the existing authenticated UI. Do not introduce unrelated 13–16 px rounded cards, pill-heavy designs, or oversized curved banners.
- Use the existing font stack: `--imperial-heading` (Barlow Condensed), `--imperial-display` (Rajdhani), and `--imperial-ui` (IBM Plex Sans). Inherit from the current section where possible.
- Hierarchy: major section heading ~22–28 px; panel heading ~15–20 px; normal UI text ~12–14 px; labels and supporting metadata ~10–12 px. Preserve readability and responsive scaling, rather than forcing fixed sizes everywhere.
- Uppercase + tracked labels are for small military section headings or status metadata, **not every sentence**.
- Buttons, tabs, inputs, tables and selectors should have consistent height, padding, border weight, hover, focus and disabled states.
- Use the existing Font Awesome icon system already in the dashboard. Prefer relevant icons; do not use emoji as application icons.
- Avoid gratuitous full-width hero sections: only one compact section heading when the parent page already provides a header.

## 4. Layout and density

1. **Do not stack a second dashboard inside a dashboard.** If World Administration already has a page header, KPI row and navigation tabs, a sub-panel should begin with its working controls/content—not repeat a giant hero, another broad KPI strip, and another oversized title.
2. Prefer compact, meaningful panes with immediate interaction. The user should see actual gameplay/management content above the fold.
3. Avoid oversized empty space. Empty states should be **one concise, in-context panel** with one useful primary action, not a large empty center plus a separate empty sidebar.
4. Use established World Administration layouts: `.wa-panel`, `.wa-industry-workspace`, `.wa-industry-layout`, `.wa-industry-directory`, `.wa-industry-detail`, `.wa-industry-blockhead`, and related patterns where applicable.
5. Use tables / dense status rows for repeated entities, rather than one tall card per data point. Use columns for truly related values only.
6. Provide search, filters, meaningful status indicators, and sorting when the list is large; don't force endless scrolling.
7. Make a selected location or entity visually obvious, with its current state, owning/controlling faction, actionable resources, and next available actions.
8. Avoid long-page workflows. Use **modal dialogs / command windows** for editing a settlement, installation, route, blueprint, or detailed entity; don't replace a working popup with a giant inline form.
9. Preserve visible map relationships. Military installations, farms, factories, settlements, rail lines, roads, ports and zones should reuse existing map objects and location data rather than create duplicate “map placement” flows.
10. Desktop is the primary strategy-workspace context. On narrower screens, adapt responsively without truncating critical data or making controls unusable.

## 5. Interface interaction rules

- **Overview → select → detail → action** is the preferred interaction. Use compact directories / tables and a detailed pane or modal.
- Editing uses a clearly titled dialog with a Close/Cancel action, validated inputs, a single obvious Save/Confirm action, and an error shown near the operation. Modals must be keyboard-accessible, focus-managed, and not block scroll recovery.
- Prefer local tabs to enormous vertical pages; do not create multiple redundant views/toggles of information the page already shows together.
- Don't require the user to re-enter map objects, existing settlements, or equipment that are already registered elsewhere.
- Disabled actions must explain prerequisites to the user in plain, in-world language.
- A state transition should change meaningful domain state, not merely flip a decorative label. Use the server as the source of truth and persist progress.
- Confirmation is for destructive/irreversible actions; avoid repetitive confirmation dialogs for routine navigation.
- Preserve histories, archived records, previous achievements, and restoration options. No destructive data migration merely to simplify UI.

## 6. Game systems must feel connected

- A facility or installation is part of the **same world**, with actual map location, controlling faction, conditions, troops/resources, supply routes, and other existing systems.
- Data such as magitek and construction supplies should come from the already-established industry inventories, equipment lots, and simulation—not free-form duplicated quantities.
- Site damage, repair, construction, workforce, heat, power, logistics and ammo should have coherent prerequisites and effects. Don't make a new “set anything to 999999” staff shortcut that bypasses simulation.
- NPC-owned systems should follow the same world constraints. Autonomous NPC progression cannot silently create unlimited goods, structures, workers, or equipment.
- Newly added mechanics must respect user-defined historical/FFXIV lore where those names and relationships are already established.
- No new game subsystem should feel like a disconnected settings console or expose debugging/migration information to players.

## 7. Copywriting / player-facing text

**Use:** “Military Installations,” “Castrum,” “Garrison,” “War Stores,” “Stationed Magitek,” “Structural Integrity,” “Rebuilding,” “Operational,” “Supply Depot.”  
**Avoid:** “Turn crafting into a living storyline,” “legacy records retained,” “the Windows API requires migration,” “project materials are committed explicitly,” or other technical meta-commentary in visible gameplay screens.

- Keep introductions to **one brief in-world sentence**, or omit them when the title and controls are self-explanatory.
- Labels should tell the player what a control changes. Do not tell them how the underlying React, API, or database architecture works.
- State clear consequence and requirement: “12 shells available,” “Depot lacks ammunition,” “Repairs require iron and workers,” “Castrum disabled.”
- Technical diagnostics belong in logs or a deliberate admin diagnostics area, **not regular UI**.

## 8. What was wrong with the Military Installations screenshot (2026-11-09)

The new panel visually diverged from the parent Industry & Projects page:

- A **purple/lavender-black theme** replaced the surrounding steel-blue/charcoal imperial palette.
- Very rounded 13–16 px card corners conflicted with the existing 2–6 px geometry.
- The already-visible Industry heading and four overview cards were followed by **another giant hero and four mostly duplicate metric cards**.
- A large empty center, an isolated miniature sidebar, and duplicated “Establish installation” buttons wasted screen space.
- The UI looked like a separate application dropped into a tab rather than a polished part of World Administration.

**Correct direction:** Keep the existing page frame and tab bar. Make the Military Installations tab a compact native steel-blue workspace with a small action toolbar, a practical location list, meaningful installation detail/status, and modal-based creation/editing. Show its operational substance instead of another dashboard heading.

## 9. Implementation acceptance criteria — EVERY frontend PR

Before committing or merging a new screen:

- [ ] Read the CSS/components immediately surrounding the feature and identify its native design patterns.
- [ ] Confirm colors, typography, icon style, corner radius, spacing, form controls, and tabs match existing World Administration / dashboard styles.
- [ ] No isolated purple/fantasy/modern-SaaS rebrand; no giant duplicate hero or KPI block.
- [ ] The first desktop viewport shows useful working content, not excessive decoration or empty states.
- [ ] Empty, populated, loading, error, selected, damaged, and archived/rebuilding states are all coherent.
- [ ] Entity editing is in a compact, accessible popup where appropriate; no needless long-page editing.
- [ ] All inputs are validated, actions have usable errors, buttons work, and no transient render errors occur.
- [ ] Data is sourced from the existing map, inventories, equipment, and progression systems where applicable.
- [ ] Responsive desktop/tablet/mobile checks are completed; keyboard focus and text contrast remain legible.
- [ ] No developer-facing descriptions, migration notes, debug copy, placeholder mechanics, or invented values on gameplay pages.
- [ ] Run repository tests/build, review screenshots **next to surrounding established pages**, and fix visual inconsistencies before calling a feature complete.
- [ ] Do not delete data or discard an existing feature unrelated to the requested change.

## 10. Mandatory workflow for AI and contributors

1. **Inspect first:** Read `AGENTS.md`, this file, the target JSX/CSS, its parent page, adjacent pages, and theme definitions.
2. **Reuse first:** Prefer established components and CSS patterns. Create a new stylesheet only when necessary; it must extend the existing theme.
3. **Compare:** Check the new screen beside its parent and neighboring tabs using screenshots at desktop width and a narrower viewport.
4. **Test:** Build, run UI tests, test server permissions and state changes. Fix failures before claiming success.
5. **Preserve:** Do not roll back unrelated working features, reset live records, or delete archived state.
6. **Review:** The visual standard is a required acceptance gate. A working API is not enough if the UI looks out of place.

**When existing code conflicts with this document, follow the existing coherent World Administration / imperial design direction, then correct the divergent code. Do not treat the latest addition as the new design standard.**
