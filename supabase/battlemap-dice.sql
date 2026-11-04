-- Eclipse Order: battle map and streamlined adult-only onboarding.
-- Requires profile-encounters.sql already installed. Run once in Supabase SQL Editor.
-- Profile age declaration controls encounter access. No ID scans/documents.
-- Staff are still responsible for appropriate community moderation.

create or replace function public.order_adult_approved()
returns boolean language sql stable security definer set search_path=''
as $adult$
 select coalesce((select p.adult_declaration from public.order_profile_preferences p
   where p.user_id=auth.uid()),false)
$adult$;
revoke all on function public.order_adult_approved() from public;
grant execute on function public.order_adult_approved() to authenticated;

-- Update the existing add-combatant RPC to rely on player's saved profile declaration.
create or replace function public.order_add_combatant(p_encounter uuid,p_name text,p_kind text,
 p_character text,p_initiative integer,p_hp integer,p_ac integer)
returns uuid language plpgsql volatile security definer set search_path=''
as $add$
declare result uuid;
begin
 if not public.order_can_direct_encounter(p_encounter) then raise exception 'Not an encounter director' using errcode='42501'; end if;
 if p_kind not in ('npc','player') or length(trim(coalesce(p_name,'')))<1 or
 p_initiative not between -100 and 100 or p_hp not between 1 and 999999 or p_ac not between 0 and 99 then
  raise exception 'Invalid combatant data'; end if;
 if p_kind='player' then
   if p_character is null or not exists(
    select 1 from public.characters c
    join public.order_members m on m.user_id=c.player_user_id
    join public.order_profile_preferences p on p.user_id=c.player_user_id
    where c.id=p_character and p.adult_declaration
      and not exists(
        select 1 from public.order_encounter_pauses z
        where z.encounter_id=p_encounter and z.user_id=c.player_user_id and z.paused
      )
      and not exists (
        select 1 from unnest((select themes from public.order_encounters where id=p_encounter)) t
        where not coalesce((p.content_preferences->>t)::boolean,false)
      )
   ) then raise exception 'Player is not eligible or has not opted into this encounter content'; end if;
 elsif p_character is not null then raise exception 'Only player combatants may link a character record'; end if;
 insert into public.order_combatants(encounter_id,name,kind,character_id,initiative,hp,max_hp,ac)
 values(p_encounter,left(trim(p_name),120),p_kind,p_character,p_initiative,p_hp,p_hp,p_ac) returning id into result;
 return result;
end
$add$;

alter table public.order_encounters
 add column if not exists map_columns integer not null default 16 check(map_columns between 8 and 30),
 add column if not exists map_rows integer not null default 10 check(map_rows between 6 and 20),
 add column if not exists map_style text not null default 'dungeon' check(map_style in ('dungeon','forest','parchment'));
alter table public.order_combatants
 add column if not exists tile_x integer,
 add column if not exists tile_y integer;

create or replace function public.order_set_encounter_map(p_encounter uuid,p_columns int,p_rows int,p_style text)
returns void language plpgsql volatile security definer set search_path=''
as $map$
begin
 if not public.order_can_direct_encounter(p_encounter) then raise exception 'GM access required' using errcode='42501'; end if;
 if p_columns not between 8 and 30 or p_rows not between 6 and 20 or
  p_style not in ('dungeon','forest','parchment') then raise exception 'Invalid map setup'; end if;
 update public.order_encounters set map_columns=p_columns,map_rows=p_rows,map_style=p_style where id=p_encounter;
 update public.order_combatants set tile_x=null,tile_y=null where encounter_id=p_encounter
  and (tile_x>=p_columns or tile_y>=p_rows);
end
$map$;
revoke all on function public.order_set_encounter_map(uuid,int,int,text) from public;
grant execute on function public.order_set_encounter_map(uuid,int,int,text) to authenticated;

create or replace function public.order_move_token(p_combatant uuid,p_x int,p_y int)
returns void language plpgsql volatile security definer set search_path=''
as $move$
declare encounter_id uuid; cols int; rows int;
begin
 select c.encounter_id,e.map_columns,e.map_rows into encounter_id,cols,rows
 from public.order_combatants c join public.order_encounters e on e.id=c.encounter_id
 where c.id=p_combatant;
 if encounter_id is null or not public.order_can_direct_encounter(encounter_id) then
  raise exception 'Only the encounter director can move tokens' using errcode='42501'; end if;
 if p_x is not null and (p_x<0 or p_x>=cols) then raise exception 'X out of range'; end if;
 if p_y is not null and (p_y<0 or p_y>=rows) then raise exception 'Y out of range'; end if;
 if (p_x is null)<>(p_y is null) then raise exception 'Both coordinates must be set'; end if;
 if p_x is not null and exists(select 1 from public.order_combatants where order_combatants.encounter_id=encounter_id
   and tile_x=p_x and tile_y=p_y and id<>p_combatant) then
  raise exception 'That square is occupied'; end if;
 update public.order_combatants set tile_x=p_x,tile_y=p_y where id=p_combatant;
end
$move$;
revoke all on function public.order_move_token(uuid,int,int) from public;
grant execute on function public.order_move_token(uuid,int,int) to authenticated;

-- Preserve GM-only notes. The original encounter listing is replaced to return map
-- configuration and each token's tile coordinates without revealing profile preferences.
create or replace function public.order_list_encounters()
returns jsonb language plpgsql stable security definer set search_path=''
as $list$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 if not public.order_adult_approved() then raise exception 'Save the 18+ declaration under My RP profile to use encounters' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',e.id,'name',e.name,'notes',case when public.order_can_direct_encounter(e.id) then e.notes else '' end,
  'themes',e.themes,'status',e.status,'round_number',e.round_number,'turn_index',e.turn_index,
  'map_columns',e.map_columns,'map_rows',e.map_rows,'map_style',e.map_style,
  'created_by',e.created_by,'created_at',e.created_at,
  'combatants',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',c.id,'name',c.name,'kind',c.kind,'character_id',c.character_id,
    'initiative',c.initiative,'hp',c.hp,'max_hp',c.max_hp,'ac',c.ac,'conditions',c.conditions,
    'tile_x',c.tile_x,'tile_y',c.tile_y,
    'notes',case when public.order_can_direct_encounter(e.id) then c.notes else '' end)
    order by c.initiative desc,c.created_at,c.id)
   from public.order_combatants c where c.encounter_id=e.id),'[]'::jsonb)
 ) order by e.created_at desc),'[]'::jsonb)
 into result from public.order_encounters e;
 return result;
end
$list$;

-- Existing GM privacy and password restrictions are unchanged.
