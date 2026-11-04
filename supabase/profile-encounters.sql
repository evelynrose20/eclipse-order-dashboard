-- Eclipse Order: player-profile content preferences and encounter tracker.
-- Apply AFTER SETUP-ALL.sql. Do not re-run old combined setup after this migration.
-- Preferences belong to the PLAYER, not a character or scene.
-- No IDs, dates of birth, or identity documents are stored here.
-- Category opt-ins are not proof of age and do not override OOC stop/withdrawal.

create table if not exists public.order_profile_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 adult_declaration boolean not null default false,
 content_preferences jsonb not null default '{}'::jsonb
   check (jsonb_typeof(content_preferences)='object'),
 updated_at timestamptz not null default now()
);
alter table public.order_profile_preferences enable row level security;
revoke all on public.order_profile_preferences from anon, authenticated, public;

create or replace function public.order_get_my_preferences()
returns jsonb language plpgsql stable security definer set search_path=''
as $prefs$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 select jsonb_build_object('adult_declaration',p.adult_declaration,
   'content_preferences',p.content_preferences,'updated_at',p.updated_at)
 into result from public.order_profile_preferences p where p.user_id=auth.uid();
 return coalesce(result,jsonb_build_object('adult_declaration',false,'content_preferences','{}'::jsonb));
end
$prefs$;
revoke all on function public.order_get_my_preferences() from public;
grant execute on function public.order_get_my_preferences() to authenticated;

create or replace function public.order_save_my_preferences(p_adult boolean,p_preferences jsonb)
returns void language plpgsql volatile security definer set search_path=''
as $save$
declare k text; v jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 if p_adult is null or jsonb_typeof(p_preferences)<>'object' or
    octet_length(p_preferences::text)>3000 then raise exception 'Invalid profile preferences'; end if;
 for k,v in select key,value from jsonb_each(p_preferences) loop
  if k not in ('violence','horror','captivity','mind_control','humiliation','body_horror','romance','sexual_themes','character_death') or jsonb_typeof(v)<>'boolean' then
   raise exception 'Invalid content category or selection';
  end if;
 end loop;
 insert into public.order_profile_preferences(user_id,adult_declaration,content_preferences,updated_at)
 values(auth.uid(),p_adult,p_preferences,now())
 on conflict(user_id) do update set adult_declaration=excluded.adult_declaration,
 content_preferences=excluded.content_preferences,updated_at=now();
end
$save$;
revoke all on function public.order_save_my_preferences(boolean,jsonb) from public;
grant execute on function public.order_save_my_preferences(boolean,jsonb) to authenticated;

-- Encounter tracking: a structured tabletop tool, separate from OOC preferences.
create table if not exists public.order_encounters(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 2 and 140),
 notes text not null default '' check(length(notes)<=2000),
 themes text[] not null default '{}'::text[],
 created_by uuid not null references auth.users(id),
 status text not null default 'draft' check(status in ('draft','active','finished')),
 round_number integer not null default 1 check(round_number between 1 and 9999),
 turn_index integer not null default 0 check(turn_index>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.order_combatants(
 id uuid primary key default gen_random_uuid(),
 encounter_id uuid not null references public.order_encounters(id) on delete cascade,
 name text not null check(length(name) between 1 and 120),
 character_id text references public.characters(id) on delete set null,
 kind text not null check(kind in ('player','npc')),
 initiative integer not null default 0 check(initiative between -100 and 100),
 hp integer not null default 10 check(hp between 0 and 999999),
 max_hp integer not null default 10 check(max_hp between 1 and 999999),
 ac integer not null default 10 check(ac between 0 and 99),
 conditions text[] not null default '{}'::text[],
 notes text not null default '' check(length(notes)<=1500),
 created_at timestamptz not null default now()
);
create index if not exists order_combatants_encounter on public.order_combatants(encounter_id);
create table if not exists public.order_encounter_rolls(
 id bigint generated always as identity primary key,
 encounter_id uuid not null references public.order_encounters(id) on delete cascade,
 rolled_by uuid not null references auth.users(id),
 formula text not null,
 rolls integer[] not null,
 total integer not null,
 visibility text not null check(visibility in ('public','gm_private')),
 created_at timestamptz not null default now()
);
alter table public.order_encounters enable row level security;
alter table public.order_combatants enable row level security;
alter table public.order_encounter_rolls enable row level security;
revoke all on public.order_encounters,public.order_combatants,public.order_encounter_rolls from anon,authenticated,public;

create or replace function public.order_can_direct_encounter(p_encounter uuid)
returns boolean language sql stable security definer set search_path=''
as $auth$
 select public.order_my_role() in ('domina','high_command') or exists(
  select 1 from public.order_encounters e where e.id=p_encounter and e.created_by=auth.uid()
  and public.order_my_role()='handler'
 )
$auth$;
revoke all on function public.order_can_direct_encounter(uuid) from public;
grant execute on function public.order_can_direct_encounter(uuid) to authenticated;

create or replace function public.order_list_encounters()
returns jsonb language plpgsql stable security definer set search_path=''
as $list$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 if not public.order_adult_approved() or not coalesce((
   select p.adult_declaration from public.order_profile_preferences p where p.user_id=auth.uid()
 ),false) then raise exception 'Adult-only access not enabled for this account' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',e.id,'name',e.name,'notes',case when public.order_can_direct_encounter(e.id) then e.notes else '' end,'themes',e.themes,'status',e.status,
  'round_number',e.round_number,'turn_index',e.turn_index,
  'created_by',e.created_by,'created_at',e.created_at,
  'combatants',coalesce((
   select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'kind',c.kind,
    'character_id',c.character_id,'initiative',c.initiative,'hp',c.hp,'max_hp',c.max_hp,
    'ac',c.ac,'conditions',c.conditions,'notes',
      case when public.order_can_direct_encounter(e.id) then c.notes else '' end)
    order by c.initiative desc,c.created_at,c.id)
   from public.order_combatants c where c.encounter_id=e.id),'[]'::jsonb)
 ) order by e.created_at desc),'[]'::jsonb) into result from public.order_encounters e;
 return result;
end
$list$;
revoke all on function public.order_list_encounters() from public;
grant execute on function public.order_list_encounters() to authenticated;

create or replace function public.order_create_encounter(p_name text,p_notes text,p_themes text[])
returns uuid language plpgsql volatile security definer set search_path=''
as $create$
declare result uuid;
begin
 if public.order_my_role() not in ('domina','high_command','handler') then
  raise exception 'Only scene directors may create encounters' using errcode='42501'; end if;
 if length(trim(coalesce(p_name,'')))<2 then raise exception 'Enter an encounter name'; end if;
 if cardinality(coalesce(p_themes,'{}'::text[]))>9 or exists(
  select 1 from unnest(p_themes) key where key not in
  ('violence','horror','captivity','mind_control','humiliation','body_horror','romance','sexual_themes','character_death')
 ) then raise exception 'Invalid encounter themes'; end if;
 insert into public.order_encounters(name,notes,themes,created_by)
 values(left(trim(p_name),140),left(coalesce(p_notes,''),2000),coalesce(p_themes,'{}'::text[]),auth.uid())
 returning id into result;
 return result;
end
$create$;
revoke all on function public.order_create_encounter(text,text,text[]) from public;
grant execute on function public.order_create_encounter(text,text,text[]) to authenticated;

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
    where c.id=p_character and m.adult_approved and p.adult_declaration
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
revoke all on function public.order_add_combatant(uuid,text,text,text,integer,integer,integer) from public;
grant execute on function public.order_add_combatant(uuid,text,text,text,integer,integer,integer) to authenticated;

create or replace function public.order_edit_combatant(p_id uuid,p_hp integer,p_initiative integer,p_ac integer,p_conditions text[])
returns void language plpgsql volatile security definer set search_path=''
as $edit$
declare encounter uuid;
begin
 select encounter_id into encounter from public.order_combatants where id=p_id;
 if not public.order_can_direct_encounter(encounter) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_hp is null or p_hp<0 or p_hp>999999 or p_initiative not between -100 and 100 or
 p_ac not between 0 and 99 or cardinality(p_conditions)>12 or
 exists(select 1 from unnest(p_conditions) v where length(v)>40) then
 raise exception 'Invalid combatant update'; end if;
 update public.order_combatants set hp=least(p_hp,max_hp),initiative=p_initiative,
 ac=p_ac,conditions=p_conditions where id=p_id;
end
$edit$;
revoke all on function public.order_edit_combatant(uuid,integer,integer,integer,text[]) from public;
grant execute on function public.order_edit_combatant(uuid,integer,integer,integer,text[]) to authenticated;

create or replace function public.order_delete_combatant(p_id uuid)
returns void language plpgsql volatile security definer set search_path=''
as $delete$
declare encounter uuid;
begin
 select encounter_id into encounter from public.order_combatants where id=p_id;
 if not public.order_can_direct_encounter(encounter) then raise exception 'Not authorized' using errcode='42501'; end if;
 delete from public.order_combatants where id=p_id;
end
$delete$;
revoke all on function public.order_delete_combatant(uuid) from public;
grant execute on function public.order_delete_combatant(uuid) to authenticated;

create or replace function public.order_encounter_turn(p_encounter uuid,p_action text)
returns void language plpgsql volatile security definer set search_path=''
as $turn$
declare e public.order_encounters%rowtype; total int; next_idx int;
begin
 if not public.order_can_direct_encounter(p_encounter) then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into e from public.order_encounters where id=p_encounter for update;
 if not found then raise exception 'Encounter not found'; end if;
 select count(*) into total from public.order_combatants where encounter_id=p_encounter;
 if p_action='start' then
  if total=0 then raise exception 'Add a combatant first'; end if;
  update public.order_encounters set status='active',round_number=1,turn_index=0 where id=p_encounter;
 elsif p_action='next' then
  if e.status<>'active' or total=0 then raise exception 'Encounter is not active'; end if;
  next_idx:=e.turn_index+1;
  update public.order_encounters set turn_index=case when next_idx>=total then 0 else next_idx end,
   round_number=case when next_idx>=total then least(round_number+1,9999) else round_number end
   where id=p_encounter;
 elsif p_action='finish' then
  update public.order_encounters set status='finished' where id=p_encounter;
 else raise exception 'Unknown action'; end if;
end
$turn$;
revoke all on function public.order_encounter_turn(uuid,text) from public;
grant execute on function public.order_encounter_turn(uuid,text) to authenticated;

-- OOC pause/withdrawal is independent of role and character status.
create table if not exists public.order_encounter_pauses(
 encounter_id uuid not null references public.order_encounters(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 paused boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(encounter_id,user_id)
);
alter table public.order_encounter_pauses enable row level security;
revoke all on public.order_encounter_pauses from anon,authenticated,public;

create or replace function public.order_set_my_encounter_pause(p_encounter uuid,p_paused boolean)
returns void language plpgsql volatile security definer set search_path=''
as $pause$
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 if not exists(select 1 from public.order_encounters where id=p_encounter) then raise exception 'Encounter not found'; end if;
 insert into public.order_encounter_pauses(encounter_id,user_id,paused)
 values(p_encounter,auth.uid(),coalesce(p_paused,true))
 on conflict(encounter_id,user_id) do update set paused=excluded.paused,updated_at=now();
end
$pause$;
revoke all on function public.order_set_my_encounter_pause(uuid,boolean) from public;
grant execute on function public.order_set_my_encounter_pause(uuid,boolean) to authenticated;

create or replace function public.order_my_encounter_check(p_encounter uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $check$
declare missing text[]; adult boolean; paused boolean;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 select p.adult_declaration into adult from public.order_profile_preferences p where p.user_id=auth.uid();
 select coalesce(q.paused,false) into paused from public.order_encounter_pauses q where q.encounter_id=p_encounter and q.user_id=auth.uid();
 select coalesce(array_agg(t), '{}'::text[]) into missing
 from unnest((select themes from public.order_encounters where id=p_encounter)) t
 where not coalesce((select (p.content_preferences->>t)::boolean
   from public.order_profile_preferences p where p.user_id=auth.uid()),false);
 return jsonb_build_object('adult_declaration',coalesce(adult,false),
    'adult_approved',public.order_adult_approved(),
    'paused',coalesce(paused,false),'missing_themes',missing);
end
$check$;
revoke all on function public.order_my_encounter_check(uuid) from public;
grant execute on function public.order_my_encounter_check(uuid) to authenticated;

create or replace function public.order_roll_encounter(p_encounter uuid,p_formula text,p_visibility text default 'public')
returns jsonb language plpgsql volatile security definer set search_path=''
as $roll$
declare m text[]; dice_count int; faces int; mode text; bonus int; i int; v int; results int[]:='{}'; score int:=0; result_id bigint;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 if not coalesce((public.order_my_encounter_check(p_encounter)->>'adult_declaration')::boolean,false)
    or not public.order_adult_approved() then
   raise exception 'Adult-only eligibility must be confirmed before participation' using errcode='42501'; end if;
 if coalesce((public.order_my_encounter_check(p_encounter)->>'paused')::boolean,false) then
   raise exception 'You have paused this encounter OOC' using errcode='42501'; end if;
 if jsonb_array_length(public.order_my_encounter_check(p_encounter)->'missing_themes')>0 then
   raise exception 'Your profile does not opt in to every declared encounter theme' using errcode='42501'; end if;
 if not exists(select 1 from public.order_encounters where id=p_encounter and status='active') then
  raise exception 'Encounter not active'; end if;
 if p_visibility not in ('public','gm_private') or
  (p_visibility='gm_private' and not public.order_can_direct_encounter(p_encounter)) then
  raise exception 'Roll visibility not allowed' using errcode='42501'; end if;
 m:=regexp_match(lower(regexp_replace(coalesce(p_formula,''),'\s+','','g')),
 '^([1-9][0-9]?)d(4|6|8|10|12|20|100)(kh1|kl1)?([+-][0-9]{1,2})?$');
 if m is null then raise exception 'Invalid dice formula'; end if;
 dice_count:=m[1]::int;faces:=m[2]::int;mode:=coalesce(m[3],'');bonus:=coalesce(m[4],'0')::int;
 if dice_count>20 or (mode<>'' and (dice_count<>2 or faces<>20)) then raise exception 'Invalid dice count or advantage mode'; end if;
 for i in 1..dice_count loop
  v:=1+floor(random()*faces)::int;results:=array_append(results,v);score:=score+v;
 end loop;
 if mode='kh1' then score:=greatest(results[1],results[2]); end if;
 if mode='kl1' then score:=least(results[1],results[2]); end if;
 score:=score+bonus;
 insert into public.order_encounter_rolls(encounter_id,rolled_by,formula,rolls,total,visibility)
 values(p_encounter,auth.uid(),lower(regexp_replace(p_formula,'\s+','','g')),results,score,p_visibility)
 returning id into result_id;
 return jsonb_build_object('id',result_id,'rolls',results,'total',score,'formula',p_formula,'visibility',p_visibility);
end
$roll$;
revoke all on function public.order_roll_encounter(uuid,text,text) from public;
grant execute on function public.order_roll_encounter(uuid,text,text) to authenticated;

create or replace function public.order_list_encounter_rolls(p_encounter uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $rolls$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'rolled_by',r.rolled_by,'formula',r.formula,'rolls',r.rolls,
   'total',r.total,'visibility',r.visibility,'created_at',r.created_at) order by r.id desc),'[]'::jsonb)
 into result from (select * from public.order_encounter_rolls
 where encounter_id=p_encounter and (visibility='public' or rolled_by=auth.uid() or public.order_can_direct_encounter(p_encounter))
 order by id desc limit 100) r;
 return result;
end
$rolls$;
revoke all on function public.order_list_encounter_rolls(uuid) from public;
grant execute on function public.order_list_encounter_rolls(uuid) to authenticated;
