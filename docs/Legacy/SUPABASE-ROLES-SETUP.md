# Imperium Noctis: character sheets and Order hierarchy

This is a stacked integration branch. **Do not merge it into main until Supabase is set up and the account permissions have been tested.**

## Database migration (required)

1. In Supabase **SQL Editor**, run `supabase/schema.sql` from the parent database branch if you haven't already.
2. Run **`supabase/roles-and-sheets.sql`** from this branch. This is a **required** security migration. It removes direct browser access to the character JSON and exposes server-checked RPCs.
3. In **Authentication → Users**, create or invite the Domina's real email/password account. Do not put credentials into GitHub.
4. In the SQL file, find the Domina bootstrap example at the bottom. Replace `YOUR_EMAIL_HERE` with that user's email, remove the comment prefix from the three SQL lines, and execute them. This inserts/updates the account's `order_members` role as `domina`.
5. Add other members in Supabase Authentication → Users. Use the adjacent approved-member SQL example to register each user's `order_members` entry (initial role: `member`).
6. Sign into the website with the Domina's own account. Use **Order accounts** to change approved accounts to **High Command**, **Master/Mistress (handler)**, or **Member**.
7. Create character records under **Character roster → New character**. Link the player by the approved email account and assign a handler. Toggle **Collar binding** to seal or unseal the player's sheet.
8. Test each role using separate browsers or private sessions before deployment.

## Permissions

| Account role | Full sheet access | Character management | Member role management |
| --- | --- | --- | --- |
| Domina | All | All | All roles |
| High Command | All | All | Promote or demote handler/member, not command |
| Master/Mistress | Assigned characters only | Edit assigned sheets, never change account links/collar/rank | None |
| Member | Own unbound sheet | Edit own unbound mechanics | None |
| Collar-bound player | Only the server-redacted view | No sheet editing while bound | None |

Normal membership progression is independent of authentication permissions: **Initiate → Associate → Established → Veteran**. Changing these standings does not grant extra access. The owner can rename or adjust these titles in a later balance pass.

The collar is a fictional roleplay mechanism. When bound, a player's browser receives **no attribute scores, skills, spells, inventory, features or private notes** from the database. The application does not merely hide these in CSS; the SQL RPC constructs a reduced response. Server checks prevent ordinary members from writing to bound character records.

## Character sheets

Complete views now include level, class/job, species, background, alignment, XP, Armor Class, initiative, movement speed, HP, temporary HP, hit dice, proficiency bonus, the six attributes, saving throw proficiencies, all 18 common D&D 5e skills, features, equipment, spells, languages, conditions, personality, ideals, bonds and flaws. These are generic tabletop fields and may be adapted to your FFXIV RP house rules.

## Security notes

- All browser character access uses Supabase's `order_list_characters`, `order_save_character` and `order_delete_character` RPCs. Raw `public.characters` access by authenticated users is explicitly revoked.
- All roles are derived from the Supabase user ID on the **server**, never from user-submitted role fields.
- High Command cannot grant itself the Domina role.
- A handler must have a verified user-ID assignment before the full character record is available. Display-name assignments from old records alone do not authorize access.
- Existing accounts with the previous `admin` role are migrated to `high_command`. Explicitly bootstrap **one Domina** through SQL.
- The client refreshes data every 30 seconds, not through realtime subscriptions.
- Run a security test with a bound player's own credentials before public deployment.
- Keep backup exports securely: command-level exports contain all recorded character details.

## Deployment

This PR is stacked on the Supabase branch, which itself is stacked on the redesign branch. Merge only in dependency order **after** the two SQL migrations and real account login testing. A passing GitHub Actions Vite build confirms syntax, not a fully configured database.
