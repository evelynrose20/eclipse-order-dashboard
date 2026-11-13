# Civic schools: staffed buildings, student places and family enrollment

## One authoritative school-building system
Schools are existing settlement education upgrades (world_settlement_upgrades, category school) constructed and repaired through World Administration and their civic building templates. This addition does not create a second class of school structures or grant extra settlement population.

School capacity is the minimum of effective classroom capacity (level, building condition and the published school-place template effect) and 20 student places per assigned teacher. A damaged, destroyed or unfinished school has no operational enrollment capacity. Staff is allocated from existing settlement workforce, never created for free. Combined teachers and support staff assigned to all school buildings in a settlement cannot exceed its existing workforce at allocation time. Existing settlement education advancement and preview use staffed seats rather than treating unstaffed buildings as functioning schools.

## Management and family use
Authorized civic command can edit teachers and support staff on the school building card in World Administration > Settlement Infrastructure > Education. The card displays staffed capacity, enrolled named dependents and remaining places. Staffing changes cannot reduce capacity below current enrolled named dependents.

A guardian may enroll a school-age or teenage dependent only in an operational building with teachers and an available place. The family UI lists the actual school building, its settlement, teacher count and available seats, while retaining the existing weekly attendance schedule. Enrollment is atomic, prevents overbooking and can be withdrawn by the guardian. School attendance and homework require a staffed operational school; home learning and tutoring remain separate.

School names, capacity and staff counts are visible to guardians, but other student identities and private family records are not. Household caregiver permissions remain unchanged. School staff is an allocation of existing civic workforce, not a salary or payroll system.

## Limits
The current civic simulation represents school-age population as demographic aggregates. Named RP dependents have individually tracked enrollment within existing school capacity, without changing authoritative settlement population totals. When a settlement's workforce changes through simulation, staff allocations will need further reconciliation to avoid overcommitting remaining workers; this feature does not create more workforce. NPC teacher schedules and school supply deliveries are future integrations.

## Deployment
Stacked on PR #149 (which depends on PR #148). Requires additive migration 135_civic_school_staffing_and_enrollment.sql after migrations 133 and 134. It preserves historical school names and attendance records. Back up the Windows MariaDB database and apply updates through the API Control Center after approval; GitHub cannot update the private server.
