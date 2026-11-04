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
declare target_encounter uuid; cols int; rows int;
begin
 select c.encounter_id,e.map_columns,e.map_rows into target_encounter,cols,rows
 from public.order_combatants c join public.order_encounters e on e.id=c.encounter_id
 where c.id=p_combatant;
 if target_encounter is null or not public.order_can_direct_encounter(target_encounter) then
  raise exception 'Only the encounter director can move tokens' using errcode='42501'; end if;
 if p_x is not null and (p_x<0 or p_x>=cols) then raise exception 'X out of range'; end if;
 if p_y is not null and (p_y<0 or p_y>=rows) then raise exception 'Y out of range'; end if;
 if (p_x is null)<>(p_y is null) then raise exception 'Both coordinates must be set'; end if;
 if p_x is not null and exists(select 1 from public.order_combatants where order_combatants.encounter_id=target_encounter
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


-- Encounter dice requests are attached to a specific linked player account.
-- Only the GM can create requests, only the target can resolve them, and rolls
-- are generated by the existing server-side dice engine.
create table if not exists public.order_roll_requests(
 id uuid primary key default gen_random_uuid(),
 encounter_id uuid not null references public.order_encounters(id) on delete cascade,
 character_id text not null references public.characters(id) on delete cascade,
 player_user_id uuid not null references auth.users(id) on delete cascade,
 requested_by uuid not null references auth.users(id),
 kind text not null check(kind in ('ability','saving_throw','skill','attack','contest')),
 label text not null check(length(label) between 2 and 100),
 formula text not null check(length(formula)<=24),
 dc integer not null check(dc between 0 and 99),
 state text not null default 'pending' check(state in ('pending','resolved','cancelled')),
 result_total integer,
 result_roll_id bigint references public.order_encounter_rolls(id),
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index if not exists order_roll_requests_encounter_idx on public.order_roll_requests(encounter_id,created_at desc);
alter table public.order_roll_requests enable row level security;
revoke all on public.order_roll_requests from anon,authenticated,public;

create or replace function public.order_list_roll_requests(p_encounter uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $list$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'name',c.data->>'name','character_id',r.character_id,'player_user_id',r.player_user_id,
  'kind',r.kind,'label',r.label,'formula',r.formula,'dc',r.dc,'state',r.state,
  'result_total',r.result_total,'created_at',r.created_at
 ) order by r.created_at desc),'[]'::jsonb) into result
 from public.order_roll_requests r join public.characters c on c.id=r.character_id
 where r.encounter_id=p_encounter and (r.player_user_id=auth.uid() or public.order_can_direct_encounter(p_encounter));
 return result;
end
$list$;
revoke all on function public.order_list_roll_requests(uuid) from public;
grant execute on function public.order_list_roll_requests(uuid) to authenticated;

create or replace function public.order_request_dice(
 p_encounter uuid,p_character text,p_kind text,p_label text,p_formula text,p_dc int)
returns uuid language plpgsql volatile security definer set search_path=''
as $request$
declare target_user uuid; new_id uuid; normalized text;
begin
 if not public.order_can_direct_encounter(p_encounter) then
  raise exception 'GM permissions required' using errcode='42501'; end if;
 if not exists(select 1 from public.order_encounters where id=p_encounter and status='active') then
  raise exception 'The encounter must be active'; end if;
 if p_kind not in ('ability','saving_throw','skill','attack','contest')
   or length(trim(coalesce(p_label,''))) not between 2 and 100
   or p_dc is null or p_dc not between 0 and 99 then raise exception 'Invalid roll request'; end if;
 normalized:=lower(regexp_replace(coalesce(p_formula,''),'\s+','','g'));
 if normalized !~ '^([1-9][0-9]?)d(4|6|8|10|12|20|100)(kh1|kl1)?([+-][0-9]{1,2})?$' then
  raise exception 'Invalid roll formula'; end if;
 select c.player_user_id into target_user from public.characters c where c.id=p_character;
 if target_user is null then raise exception 'Character must be linked to a player account'; end if;
 if not exists(select 1 from public.order_combatants co where co.encounter_id=p_encounter and co.character_id=p_character) then
  raise exception 'Character must be present in the encounter'; end if;
 insert into public.order_roll_requests(encounter_id,character_id,player_user_id,requested_by,kind,label,formula,dc)
 values(p_encounter,p_character,target_user,auth.uid(),p_kind,left(trim(p_label),100),normalized,p_dc)
 returning id into new_id;
 return new_id;
end
$request$;
revoke all on function public.order_request_dice(uuid,text,text,text,text,int) from public;
grant execute on function public.order_request_dice(uuid,text,text,text,text,int) to authenticated;

create or replace function public.order_resolve_dice_request(p_request uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $resolve$
declare target public.order_roll_requests%rowtype; result jsonb; total int;
begin
 select * into target from public.order_roll_requests where id=p_request for update;
 if not found or target.state<>'pending' or target.player_user_id<>auth.uid() then
  raise exception 'Only the requested player may roll their pending check' using errcode='42501'; end if;
 result:=public.order_roll_encounter(target.encounter_id,target.formula,'public');
 total:=(result->>'total')::integer;
 update public.order_roll_requests set state='resolved',result_total=total,
 result_roll_id=(result->>'id')::bigint,resolved_at=now() where id=p_request;
 return jsonb_build_object('total',total,'dc',target.dc,'success',total>=target.dc,'roll',result);
end
$resolve$;
revoke all on function public.order_resolve_dice_request(uuid) from public;
grant execute on function public.order_resolve_dice_request(uuid) to authenticated;

create or replace function public.order_cancel_dice_request(p_request uuid)
returns void language plpgsql volatile security definer set search_path=''
as $cancel$
begin
 update public.order_roll_requests set state='cancelled'
 where id=p_request and state='pending' and (player_user_id=auth.uid() or
   public.order_can_direct_encounter(encounter_id));
 if not found then raise exception 'Not authorized to cancel this request' using errcode='42501'; end if;
end
$cancel$;
revoke all on function public.order_cancel_dice_request(uuid) from public;
grant execute on function public.order_cancel_dice_request(uuid) to authenticated;

-- Atomic GM combat actions avoid overwriting another director's HP update.
create or replace function public.order_adjust_combatant_hp(p_combatant uuid,p_delta int)
returns integer language plpgsql volatile security definer set search_path=''
as $hp$
declare encounter uuid; new_hp int;
begin
 select encounter_id into encounter from public.order_combatants where id=p_combatant;
 if not public.order_can_direct_encounter(encounter) then raise exception 'GM permissions required' using errcode='42501'; end if;
 if p_delta is null or p_delta not between -999999 and 999999 then raise exception 'Invalid HP adjustment'; end if;
 update public.order_combatants set hp=greatest(0,least(max_hp,hp+p_delta))
 where id=p_combatant returning hp into new_hp;
 return new_hp;
end
$hp$;
revoke all on function public.order_adjust_combatant_hp(uuid,int) from public;
grant execute on function public.order_adjust_combatant_hp(uuid,int) to authenticated;


-- Advanced action rolls: server-authoritative attack vs AC, checks/saves vs DC,
-- natural 20/1 handling, and combat context in saved history.
alter table public.order_encounter_rolls
 add column if not exists roll_kind text not null default 'custom'
   check (roll_kind in ('custom','ability','saving_throw','skill','attack','contest','damage','healing','death_save','concentration')),
 add column if not exists target_combatant_id uuid references public.order_combatants(id) on delete set null,
 add column if not exists target_dc integer check (target_dc between 0 and 99),
 add column if not exists outcome text check (outcome in ('success','failure','critical_success','critical_failure','no_check'));

create or replace function public.order_roll_action(
 p_encounter uuid,p_formula text,p_visibility text,p_kind text,
 p_target uuid default null,p_dc int default null)
returns jsonb language plpgsql volatile security definer set search_path=''
as $action$
declare
 result jsonb; roll_id bigint; rolled integer[]; total int; chosen int; target_ac int;
 resolved_dc int; outcome_text text:='no_check'; bonus_mode text; roll_sides int;
begin
 if p_kind not in ('custom','ability','saving_throw','skill','attack','contest','damage','healing','death_save','concentration') then
  raise exception 'Unknown dice action'; end if;
 if p_dc is not null and p_dc not between 0 and 99 then raise exception 'Invalid target DC'; end if;
 if p_target is not null then
  select c.ac into target_ac from public.order_combatants c where c.id=p_target and c.encounter_id=p_encounter;
  if target_ac is null then raise exception 'Target combatant not in encounter'; end if;
 end if;
 if p_kind='attack' and p_target is null then
  raise exception 'Select a target before rolling an attack'; end if;
 if p_kind in ('attack','ability','saving_throw','skill','contest','death_save','concentration') and
  lower(regexp_replace(coalesce(p_formula,''),'\s+','','g')) !~
    '^(1d20|2d20(kh1|kl1))([+-][0-9]{1,2})?
 roll_id:=(result->>'id')::bigint;
 total:=(result->>'total')::int;
 rolled:=array(select jsonb_array_elements_text(result->'rolls')::int);
 bonus_mode:=(regexp_match(lower(p_formula),'(kh1|kl1)'))[1];
 roll_sides:=coalesce((regexp_match(lower(p_formula),'d(4|6|8|10|12|20|100)'))[1]::int,0);
 chosen:=case when bonus_mode='kh1' then greatest(rolled[1],rolled[2])
  when bonus_mode='kl1' then least(rolled[1],rolled[2]) else rolled[1] end;
 resolved_dc:=case when p_kind='attack' then target_ac
  when p_kind='death_save' then 10 else p_dc end;
 if p_kind in ('attack','ability','saving_throw','skill','contest','death_save','concentration') and resolved_dc is not null then
  outcome_text:=case when total>=resolved_dc then 'success' else 'failure' end;
  -- In D&D 5e, natural 20/1 automatically affect attack rolls.
  -- Ordinary ability checks and saving throws use the total vs DC.
  if roll_sides=20 and p_kind in ('attack','death_save') then
   if chosen=20 then outcome_text:='critical_success';
   elsif chosen=1 then outcome_text:='critical_failure';
   end if;
  end if;
 end if;
 update public.order_encounter_rolls set roll_kind=p_kind,
  target_combatant_id=p_target,target_dc=resolved_dc,outcome=outcome_text
 where id=roll_id and rolled_by=auth.uid();
 return result||jsonb_build_object('kind',p_kind,'outcome',outcome_text,
  'target_dc',resolved_dc,'target_combatant_id',p_target);
end
$action$;
revoke all on function public.order_roll_action(uuid,text,text,text,uuid,int) from public;
grant execute on function public.order_roll_action(uuid,text,text,text,uuid,int) to authenticated;

-- Expose the added, non-private roll metadata. GM-private filtering stays at API level.
create or replace function public.order_list_encounter_rolls(p_encounter uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $rolls$
declare result jsonb;
begin
 if public.order_my_role() is null or not public.order_adult_approved() then
  raise exception 'Save the 18+ declaration under My RP profile to see encounter rolls' using errcode='42501'; end if;
 if not exists(select 1 from public.order_encounters where id=p_encounter) then
  raise exception 'Encounter not found'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'rolled_by',r.rolled_by,'formula',r.formula,'rolls',r.rolls,
   'total',r.total,'visibility',r.visibility,'created_at',r.created_at,
   'kind',r.roll_kind,'outcome',r.outcome,'target_dc',r.target_dc,
   'target_combatant_id',r.target_combatant_id
 ) order by r.id desc),'[]'::jsonb)
 into result from (
  select * from public.order_encounter_rolls
  where encounter_id=p_encounter and
   (visibility='public' or rolled_by=auth.uid() or public.order_can_direct_encounter(p_encounter))
  order by id desc limit 100
 ) r;
 return result;
end
$rolls$;
 then
  raise exception 'D20 checks require 1d20, or 2d20kh1/kl1 for advantage or disadvantage';
 end if;
 result:=public.order_roll_encounter(p_encounter,p_formula,p_visibility);
 roll_id:=(result->>'id')::bigint;
 total:=(result->>'total')::int;
 rolled:=array(select jsonb_array_elements_text(result->'rolls')::int);
 bonus_mode:=(regexp_match(lower(p_formula),'(kh1|kl1)'))[1];
 roll_sides:=coalesce((regexp_match(lower(p_formula),'d(4|6|8|10|12|20|100)'))[1]::int,0);
 chosen:=case when bonus_mode='kh1' then greatest(rolled[1],rolled[2])
  when bonus_mode='kl1' then least(rolled[1],rolled[2]) else rolled[1] end;
 resolved_dc:=case when p_kind='attack' then target_ac
  when p_kind='death_save' then 10 else p_dc end;
 if p_kind in ('attack','ability','saving_throw','skill','contest','death_save','concentration') and resolved_dc is not null then
  outcome_text:=case when total>=resolved_dc then 'success' else 'failure' end;
  -- In D&D 5e, natural 20/1 automatically affect attack rolls.
  -- Ordinary ability checks and saving throws use the total vs DC.
  if roll_sides=20 and p_kind='attack' then
   if chosen=20 then outcome_text:='critical_success';
   elsif chosen=1 then outcome_text:='critical_failure';
   end if;
  end if;
 end if;
 update public.order_encounter_rolls set roll_kind=p_kind,
  target_combatant_id=p_target,target_dc=resolved_dc,outcome=outcome_text
 where id=roll_id and rolled_by=auth.uid();
 return result||jsonb_build_object('kind',p_kind,'outcome',outcome_text,
  'target_dc',resolved_dc,'target_combatant_id',p_target);
end
$action$;
revoke all on function public.order_roll_action(uuid,text,text,text,uuid,int) from public;
grant execute on function public.order_roll_action(uuid,text,text,text,uuid,int) to authenticated;

-- Expose the added, non-private roll metadata. GM-private filtering stays at API level.
create or replace function public.order_list_encounter_rolls(p_encounter uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $rolls$
declare result jsonb;
begin
 if public.order_my_role() is null or not public.order_adult_approved() then
  raise exception 'Save the 18+ declaration under My RP profile to see encounter rolls' using errcode='42501'; end if;
 if not exists(select 1 from public.order_encounters where id=p_encounter) then
  raise exception 'Encounter not found'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'rolled_by',r.rolled_by,'formula',r.formula,'rolls',r.rolls,
   'total',r.total,'visibility',r.visibility,'created_at',r.created_at,
   'kind',r.roll_kind,'outcome',r.outcome,'target_dc',r.target_dc,
   'target_combatant_id',r.target_combatant_id
 ) order by r.id desc),'[]'::jsonb)
 into result from (
  select * from public.order_encounter_rolls
  where encounter_id=p_encounter and
   (visibility='public' or rolled_by=auth.uid() or public.order_can_direct_encounter(p_encounter))
  order by id desc limit 100
 ) r;
 return result;
end
$rolls$;


-- Applying rolled damage/healing is idempotent: one roll can alter HP only once.
create table if not exists public.order_roll_hp_applications(
 roll_id bigint primary key references public.order_encounter_rolls(id) on delete cascade,
 combatant_id uuid not null references public.order_combatants(id) on delete cascade,
 delta integer not null,
 applied_by uuid not null references auth.users(id),
 applied_at timestamptz not null default now()
);
alter table public.order_roll_hp_applications enable row level security;
revoke all on public.order_roll_hp_applications from anon,authenticated,public;

create or replace function public.order_apply_roll_hp(p_roll_id bigint,p_target uuid)
returns integer language plpgsql volatile security definer set search_path=''
as $apply$
declare r public.order_encounter_rolls%rowtype; target_encounter uuid; delta_hp integer; updated_hp integer;
begin
 select * into r from public.order_encounter_rolls where id=p_roll_id for update;
 if not found or r.roll_kind not in ('damage','healing') then
  raise exception 'The selected roll is not a damage or healing roll'; end if;
 if not public.order_can_direct_encounter(r.encounter_id) then
  raise exception 'Only the encounter director can apply HP rolls' using errcode='42501'; end if;
 select encounter_id into target_encounter from public.order_combatants where id=p_target for update;
 if target_encounter is distinct from r.encounter_id then
  raise exception 'Combatant must belong to the same encounter'; end if;
 delta_hp:=case when r.roll_kind='healing' then greatest(0,r.total) else -greatest(0,r.total) end;
 insert into public.order_roll_hp_applications(roll_id,combatant_id,delta,applied_by)
 values(r.id,p_target,delta_hp,auth.uid());
 updated_hp:=public.order_adjust_combatant_hp(p_target,delta_hp);
 return updated_hp;
end
$apply$;
revoke all on function public.order_apply_roll_hp(bigint,uuid) from public;
grant execute on function public.order_apply_roll_hp(bigint,uuid) to authenticated;
