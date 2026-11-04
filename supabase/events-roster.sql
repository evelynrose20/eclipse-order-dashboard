-- Eclipse Order: planned FC events, applications, party approval, new bound rank names.
-- Requirements: existing profile-encounters.sql and battlemap-dice.sql.
-- Back up database first. Run as one SQL Editor query.
begin;

-- Rename only recorded bound ranks; never change a character's collar or ownership.
update public.characters
set data=jsonb_set(data,'{rank}',to_jsonb(
  case data->>'rank'
   when 'Rank I: Unbroken' then 'Rank I: Fresh Intake / Unbroken'
   when 'Rank II: Indentured' then 'Rank II: Initiate / Indentured'
   when 'Rank III: Specialized' then 'Rank III: Trusted / Specialized'
   when 'Rank IV: Elite' then 'Rank IV: Elite / Favor of the Domina'
   else data->>'rank' end
),true)
where collar_bound and data->>'rank' in
 ('Rank I: Unbroken','Rank II: Indentured','Rank III: Specialized','Rank IV: Elite');

-- Reversible transitions now use the new intake rank.
create or replace function public.order_apply_status(p_request_id uuid)
returns void language plpgsql volatile security definer set search_path=''
as $apply$
declare r public.order_status_requests%rowtype; c public.characters%rowtype;
begin
 if public.order_my_role() not in ('domina','high_command') then
   raise exception 'Only command can apply a binding transition' using errcode='42501'; end if;
 select * into r from public.order_status_requests where id=p_request_id for update;
 if not found or r.state<>'approved' then raise exception 'Player approval required'; end if;
 select * into c from public.characters where id=r.character_id for update;
 if not found or c.player_user_id is distinct from r.player_user_id or c.collar_bound=r.requested_bound then
   raise exception 'Character player or status changed after approval'; end if;
 perform set_config('eclipse.verified_status_change','yes',true);
 update public.characters set collar_bound=r.requested_bound,
   data=data||jsonb_build_object('collar_bound',r.requested_bound,
     'rank',case when r.requested_bound then 'Rank I: Fresh Intake / Unbroken' else 'Unbound: Free' end)
 where id=r.character_id;
 perform set_config('eclipse.verified_status_change','',true);
 update public.order_status_requests set state='applied',applied_at=now() where id=p_request_id;
end
$apply$;
revoke all on function public.order_apply_status(uuid) from public;
grant execute on function public.order_apply_status(uuid) to authenticated;

alter table public.order_encounters
 add column if not exists event_starts_at timestamptz,
 add column if not exists event_location text not null default '' check (length(event_location)<=160),
 add column if not exists event_description text not null default '' check(length(event_description)<=2400),
 add column if not exists event_capacity integer not null default 8 check(event_capacity between 1 and 60),
 add column if not exists event_published boolean not null default false;

-- Existing active/finished events remain discoverable after migration.
update public.order_encounters set event_published=true where status in ('active','finished');

create table if not exists public.order_event_signups(
 id uuid primary key default gen_random_uuid(),
 encounter_id uuid not null references public.order_encounters(id) on delete cascade,
 character_id text not null references public.characters(id) on delete cascade,
 player_user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'requested'
   check (status in ('requested','approved','declined','withdrawn')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(encounter_id,character_id)
);
create index if not exists order_event_signups_event on public.order_event_signups(encounter_id,status);
create index if not exists order_event_signups_player on public.order_event_signups(player_user_id,status);
alter table public.order_event_signups enable row level security;
revoke all on public.order_event_signups from anon,authenticated,public;

-- Plan details, schedule and published visibility are managed by event directors.
create or replace function public.order_edit_event(
 p_encounter uuid,p_name text,p_description text,p_location text,
 p_starts_at timestamptz,p_capacity integer,p_published boolean,p_themes text[])
returns void language plpgsql volatile security definer set search_path=''
as $event$
declare current_status text;
begin
 if not public.order_can_direct_encounter(p_encounter) then
  raise exception 'Only the event director may change the event' using errcode='42501'; end if;
 select status into current_status from public.order_encounters where id=p_encounter for update;
 if current_status<>'draft' then raise exception 'Event planning is locked once combat starts'; end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 140 or
  length(coalesce(p_description,''))>2400 or length(coalesce(p_location,''))>160 or
  p_capacity not between 1 and 60 or
  cardinality(coalesce(p_themes,'{}'::text[]))>9 or exists(
    select 1 from unnest(coalesce(p_themes,'{}'::text[])) t
    where t not in ('violence','horror','captivity','mind_control','humiliation',
       'body_horror','romance','sexual_themes','character_death')
  ) then raise exception 'Invalid event information'; end if;
 if p_published and p_starts_at is null then
  raise exception 'Set an event date and time before publishing signups'; end if;
 if p_published and exists(
  select 1 from public.order_event_signups s
  join public.order_profile_preferences p on p.user_id=s.player_user_id
  where s.encounter_id=p_encounter and s.status='approved'
   and exists (select 1 from unnest(p_themes) t
      where not coalesce((p.content_preferences->>t)::boolean,false))
 ) then raise exception 'Review existing approvals before changing the event themes'; end if;
 update public.order_encounters set name=trim(p_name),
  event_description=coalesce(p_description,''),event_location=coalesce(p_location,''),
  event_starts_at=p_starts_at,event_capacity=p_capacity,event_published=p_published,
  themes=coalesce(p_themes,'{}'::text[])
 where id=p_encounter;
end
$event$;
revoke all on function public.order_edit_event(uuid,text,text,text,timestamptz,integer,boolean,text[]) from public;
grant execute on function public.order_edit_event(uuid,text,text,text,timestamptz,integer,boolean,text[]) to authenticated;

-- Players only sign up their OWN linked characters, never nominate other players.
create or replace function public.order_signup_event(p_encounter uuid,p_character text)
returns void language plpgsql volatile security definer set search_path=''
as $signup$
declare owner_user uuid; evt public.order_encounters%rowtype;
begin
 if public.order_my_role() is null or not public.order_adult_approved() then
  raise exception 'Complete your profile declaration before signing up' using errcode='42501'; end if;
 select * into evt from public.order_encounters where id=p_encounter for update;
 if not found or evt.status<>'draft' or not evt.event_published then
  raise exception 'This event is not accepting signups'; end if;
 select player_user_id into owner_user from public.characters where id=p_character;
 if owner_user is distinct from auth.uid() then
  raise exception 'You can only sign up your own character' using errcode='42501'; end if;
 if exists(select 1 from unnest(evt.themes) t where not coalesce(
  (select (p.content_preferences->>t)::boolean from public.order_profile_preferences p
    where p.user_id=auth.uid()),false)) then
  raise exception 'Your RP profile has not opted into every declared event category' using errcode='42501'; end if;
 if exists(select 1 from public.order_event_signups where encounter_id=p_encounter
   and player_user_id=auth.uid() and status in ('requested','approved')
   and character_id<>p_character) then
  raise exception 'You already have a different character signed up'; end if;
 insert into public.order_event_signups(encounter_id,character_id,player_user_id,status)
 values(p_encounter,p_character,auth.uid(),'requested')
 on conflict(encounter_id,character_id) do update set
  status='requested',updated_at=now();
end
$signup$;
revoke all on function public.order_signup_event(uuid,text) from public;
grant execute on function public.order_signup_event(uuid,text) to authenticated;

create or replace function public.order_list_event_signups(p_encounter uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $list$
declare output jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',s.id,'character_id',s.character_id,'character_name',c.data->>'name',
  'status',s.status,'created_at',s.created_at,
  'mine',s.player_user_id=auth.uid()
 ) order by s.created_at),'[]'::jsonb)
 into output from public.order_event_signups s
 join public.characters c on c.id=s.character_id
 where s.encounter_id=p_encounter
  and (s.player_user_id=auth.uid() or public.order_can_direct_encounter(p_encounter));
 return output;
end
$list$;
revoke all on function public.order_list_event_signups(uuid) from public;
grant execute on function public.order_list_event_signups(uuid) to authenticated;

-- GM approves registration, then assigns the character to the party in setup.
-- Registration does not automatically add a combatant.
create or replace function public.order_decide_event_signup(p_signup uuid,p_approved boolean)
returns void language plpgsql volatile security definer set search_path=''
as $decide$
declare s public.order_event_signups%rowtype; evt public.order_encounters%rowtype;
begin
 select * into s from public.order_event_signups where id=p_signup for update;
 if not found or not public.order_can_direct_encounter(s.encounter_id) then
  raise exception 'Only the event director can decide signups' using errcode='42501'; end if;
 select * into evt from public.order_encounters where id=s.encounter_id for update;
 if evt.status<>'draft' or s.status not in ('requested','approved') then
  raise exception 'Signup cannot be changed after combat starts'; end if;
 if p_approved and s.status<>'approved' and
  (select count(*) from public.order_event_signups
    where encounter_id=s.encounter_id and status='approved')>=evt.event_capacity then
  raise exception 'Event party capacity has been reached'; end if;
 update public.order_event_signups set
  status=case when p_approved then 'approved' else 'declined' end,updated_at=now()
 where id=p_signup;
end
$decide$;
revoke all on function public.order_decide_event_signup(uuid,boolean) from public;
grant execute on function public.order_decide_event_signup(uuid,boolean) to authenticated;

create or replace function public.order_withdraw_event_signup(p_signup uuid)
returns void language plpgsql volatile security definer set search_path=''
as $withdraw$
begin
 update public.order_event_signups set status='withdrawn',updated_at=now()
 where id=p_signup and player_user_id=auth.uid() and status in ('requested','approved');
 if not found then raise exception 'You cannot withdraw this signup' using errcode='42501'; end if;
end
$withdraw$;
revoke all on function public.order_withdraw_event_signup(uuid) from public;
grant execute on function public.order_withdraw_event_signup(uuid) to authenticated;

create or replace function public.order_add_approved_player(p_signup uuid)
returns uuid language plpgsql volatile security definer set search_path=''
as $party$
declare signup public.order_event_signups%rowtype; c public.characters%rowtype; new_id uuid;
begin
 select * into signup from public.order_event_signups where id=p_signup for update;
 if not found or signup.status<>'approved' or not public.order_can_direct_encounter(signup.encounter_id) then
  raise exception 'GM approval required before adding a player to the party' using errcode='42501'; end if;
 if not exists(select 1 from public.order_encounters where id=signup.encounter_id and status='draft') then
  raise exception 'Cannot change the party after combat begins'; end if;
 if exists(select 1 from public.order_combatants where encounter_id=signup.encounter_id
  and character_id=signup.character_id) then raise exception 'Character already in party'; end if;
 select * into c from public.characters where id=signup.character_id;
 if c.player_user_id is distinct from signup.player_user_id then raise exception 'Character account changed'; end if;
 new_id:=public.order_add_combatant(signup.encounter_id,c.data->>'name','player',signup.character_id,0,
  greatest(1,coalesce((c.data->>'max_hp')::int,(c.data->>'hp')::int,20)),
  coalesce((c.data->>'armor_class')::int,10));
 return new_id;
end
$party$;
revoke all on function public.order_add_approved_player(uuid) from public;
grant execute on function public.order_add_approved_player(uuid) to authenticated;

-- Add schedule + visibility metadata to read response. Preserve GM-only notes.
create or replace function public.order_list_encounters()
returns jsonb language plpgsql stable security definer set search_path=''
as $events$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 if not public.order_adult_approved() then
  raise exception 'Confirm your 18+ declaration in My RP profile' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',e.id,'name',e.name,
  'notes',case when public.order_can_direct_encounter(e.id) then e.notes else '' end,
  'description',e.event_description,'location',e.event_location,
  'starts_at',e.event_starts_at,'capacity',e.event_capacity,'published',e.event_published,
  'signup_count',(select count(*) from public.order_event_signups s
    where s.encounter_id=e.id and s.status='approved'),
  'pending_count',case when public.order_can_direct_encounter(e.id) then
   (select count(*) from public.order_event_signups s
    where s.encounter_id=e.id and s.status='requested') else 0 end,
  'themes',e.themes,'status',e.status,'round_number',e.round_number,'turn_index',e.turn_index,
  'map_columns',e.map_columns,'map_rows',e.map_rows,'map_style',e.map_style,
  'map_image_url',e.map_image_url,'created_by',e.created_by,'created_at',e.created_at,
  'combatants',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',c.id,'name',c.name,'kind',c.kind,'character_id',c.character_id,
    'initiative',c.initiative,'hp',c.hp,'max_hp',c.max_hp,'ac',c.ac,
    'conditions',c.conditions,'tile_x',c.tile_x,'tile_y',c.tile_y,
    'notes',case when public.order_can_direct_encounter(e.id) then c.notes else '' end)
    order by c.initiative desc,c.created_at,c.id)
   from public.order_combatants c where c.encounter_id=e.id),'[]'::jsonb)
 ) order by e.event_starts_at nulls last,e.created_at desc),'[]'::jsonb)
 into result from public.order_encounters e
 where e.event_published or public.order_can_direct_encounter(e.id);
 return result;
end
$events$;
revoke all on function public.order_list_encounters() from public;
grant execute on function public.order_list_encounters() to authenticated;

commit;
