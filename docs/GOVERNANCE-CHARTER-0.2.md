# Imperium Noctis — governance charter (design draft 0.2)

**Status: planning artifact; not enacted by deployed software.** This document consolidates the decisions from the governance planning sessions. It is not an authorization grant.

## Finalized decisions

- **IC hierarchy:** Domina > Oyabun > Kusushi > Operative > Kumi-in / Initiate.
- **Council:** five established voting seats: Domina (chair), Chief of Operations, Master of Commerce, Faction Envoy, Prefect of Internal Affairs. Each occupant has at most one vote, even if holding multiple offices.
- **Appointment:** Domina appoints Council officers. No fixed term: until resignation, removal or departure. Office history survives changes.
- **Voting:** quorum 3 of the founding 5 seats. Ordinary motions pass when voting closes and yes votes outnumber no votes, with quorum. Major motions require **4 yes votes**. Reserved motions require **4 yes votes plus Domina ratification**.
- **Vacancies:** established seat count stays five and **thresholds do not fall** when vacant. Three occupied seats cannot pass a major motion. Domina must fill vacancies to recover capacity.
- **Ratification:** seven calendar days from formal presentation of passed reserved motion. No reply returns motion for Council review; **never automatic approval**. A refusal also returns it for review.
- **Reserved matters:** charter changes; creation/dissolution of permanent Council voting offices; major treaties, territorial changes, major central asset commitments, constitutional hierarchy changes and dissolution of major divisions. Ordinary Council decisions do not require Domina ratification.
- **Office scopes:** Chief of Operations handles operations; Master of Commerce handles enterprise policy and business licensing; Faction Envoy handles diplomacy; Prefect of Internal Affairs coordinates membership/internal IC affairs. Additional specialist appointments must be scoped.
- **IC/OOC separation:** council decisions govern the *fictional imperial faction*, not OOC moderation, consent records, account ownership, privacy or security permissions.

## Authority matrix (proposed defaults)

| Decision | IC authority | Website authority | Council? |
|---|---|---|---|
| Ordinary membership | Recruitment office | Recruitment reviewer | No |
| Servitude-story admission | IC introduction officer | OOC consent/eligibility reviewer | No |
| Routine licensed enterprise | Master of Commerce / delegated Oyabun | Independent economic reviewer | No |
| Strategic enterprise | Commerce + senior review | Economic administration | Sometimes |
| Major enterprise / reserved investment | Council; Domina if reserved | Financial + economic administration | Yes |
| Ordinary event | Chief of Operations / delegated director | Assigned Event Director | No |
| Significant faction operation | Council | Faction Steward / GM | Yes |
| Major treaty or territorial change | Council + Domina ratification | Authorized World Steward | Yes |
| Class rules / spell balancing | No IC council mandate | Assigned OOC rules reviewers | No |
| IC discipline | Designated IC officer; Council for serious fictional matters | OOC safety review if relevant | Sometimes |
| OOC moderation or Discord security | **Not an IC matter** | Independent authorized website staff | No |

## Licensed-enterprise rule

Player-run businesses affiliated with the Order are **licensed enterprises**. Each business requires separate in-character and website approval before becoming operational. Ownership, services, territory, partners, trade permissions and finances remain explicitly licensed; material expansions require review. Existing database identifiers and API routes containing `front` are retained for compatibility. Enterprises can support civilian prosperity, imperial supply chains, research and reconstruction without being criminal cover operations.

## Council execution and continuity

Motions should preserve sponsor, version, eligible electorate, vote ledger, recusal, decision, timestamp and ratification deadline. A passed/ratified motion creates a **mandate** for appropriately authorized staff; it must not directly grant unrestricted website powers or perform unchecked financial changes. Appointment changes never rewrite old votes. Absence, succession, contested motions and meeting procedures still need further planning.

## Privacy and safety boundaries

IC ranks, bindings and offices cannot grant access to other members' confidential OOC consent or control their real accounts. Consent can be withdrawn; OOC safety and moderation decisions sit outside Council authority. IC disciplinary consequences cannot bypass consent or platform safety. No routine user or reviewer may approve their own sensitive request.
