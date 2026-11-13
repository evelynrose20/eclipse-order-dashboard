# Family life stages, school and development

## Life stages
Newborn, infant, toddler, school age (stored as the existing `child` stage), and teenager (`teen`). Existing dependent records are preserved unchanged. The guardian controls changing the stage manually in Parenthood; recording an optional date of birth gives a real-calendar age and a suggested stage, but **does not automatically advance** the character or enforce a particular RP timeline. The age ranges are narrative defaults (newborn 0–1 month, infant to 12 months, toddler 1–3 years, school age 4–12 years, teen 13–17 years), not an assertion of clinical developmental milestones.

## Gameplay
Newborns retain infant-oriented feeding, hygiene, comfort and rest. Toddlers add play. School-age and teenage children gain education, fun and social needs; teenagers also gain independence. Activities use existing care events and the needs bars derive values from those saved activities. A child's skill board tracks learning, literacy, athletics, creativity, social confidence and independence from the recorded history, without creating adult character attributes or penalties.

Guardians may assign a school or academy and select weekdays. Attendance, homework, reading, mathematics, sports, hobbies, social time, independence and Household tutoring are player-recorded RP activities—there is no automatic attendance, NPC school simulation or financial system. Assigned Household caregivers may record these activities for authorized dependents; guardians alone can edit the school schedule and mark/reopen developmental milestones.

Skill values are capped at 100 and use a transparent per-event progression, not dice or grades. Milestone events are separately persisted and guardian-controlled.

## Database and deployment
Additive MySQL/MariaDB migration **133_dependent_school_life_stages.sql** adds a teenager stage, school configuration, permitted care action values and a private milestone table. Existing child data remains intact. Back up the Windows database, pull the approved merged revision, and apply database updates in the Windows API Control Center. The migration is rerunnable and CI exercises it twice against real MariaDB. Do not merge child dependent records into adult character sheets or implement payroll/shops as part of this system.
