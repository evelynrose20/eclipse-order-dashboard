-- Eclipse Order platform foundations, revision 1.
-- Run AFTER supabase/schema.sql and supabase/roles-and-sheets.sql.
-- IMPORTANT: DO NOT run this migration before the roles RPC migration.
-- All records are subject to member permissions enforced by SECURITY DEFINER RPC.
-- Scene agreement is OOC permission to roleplay a fictional scenario; it can be revoked at any time.

-- Adults-only RP session eligibility is a manual staff-review flag.
-- It is NOT identity or documentary age verification.
alter table public.order_members add column if not exists adult_approved boolean not null default false;

create or replace function public.order_adult_approved()
returns boolean language sql stable security definer set search_path = ''
as $eligible$
 select coalesce((select m.adult_approved from public.order_members m where m.user_id=auth.uid()),false)
$eligible$;
revoke all on function public.order_adult_approved() from public;
grant execute on function public.order_adult_approved() to authenticated;

create or replace function public.order_set_adult_approved(p_user_id uuid,p_approved boolean)
returns void language plpgsql volatile security definer set search_path = ''
as $setadult$
begin
 if public.order_my_role() <> 'domina' then
   raise exception 'Only the Domina can approve adult RP access' using errcode='42501';
 end if;
 update public.order_members set adult_approved=p_approved where user_id=p_user_id;
 if not found then raise exception 'Account is not an approved member'; end if;
end
$setadult$;
revoke all on function public.order_set_adult_approved(uuid,boolean) from public;
grant execute on function public.order_set_adult_approved(uuid,boolean) to authenticated;

create or replace function public.order_list_members()
returns jsonb language plpgsql stable security definer set search_path = ''
as $members$
declare output jsonb;
begin
 if public.order_my_role() not in ('domina','high_command') then
   raise exception 'Only command may browse the member directory' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'user_id',m.user_id,'role',m.role,'standing',m.standing,
  'adult_approved',m.adult_approved,'email',u.email
 ) order by u.email),'[]'::jsonb) into output
 from public.order_members m join auth.users u on u.id=m.user_id;
 return output;
end
$members$;
revoke all on function public.order_list_members() from public;
grant execute on function public.order_list_members() to authenticated;

create table if not exists public.order_status_requests (
 id uuid primary key default gen_random_uuid(),
 character_id text not null references public.characters(id) on delete cascade,
 player_user_id uuid not null references auth.users(id) on delete cascade,
 requested_by uuid not null references auth.users(id),
 requested_bound boolean not null,
 state text not null default 'pending' check(state in ('pending','approved','declined','applied','cancelled')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 applied_at timestamptz
);
create index if not exists order_status_requests_player on public.order_status_requests(player_user_id);
alter table public.order_status_requests enable row level security;
revoke all on public.order_status_requests from anon, authenticated, public;

-- A direct character write (including legacy RPC) cannot change binding state.
-- Only a server-authorized, confirmed transition may set the transaction flag.
create or replace function public.order_guard_collar_change()
returns trigger language plpgsql security invoker set search_path = ''
as $guard$
begin
 if tg_op='INSERT' then
   if new.collar_bound and new.player_user_id is not null then
     raise exception 'Create linked characters unbound; request a voluntary status change' using errcode='42501';
   end if;
   return new;
 end if;
 if new.collar_bound is distinct from old.collar_bound then
   if current_setting('eclipse.verified_status_change',true) is distinct from 'yes' then
     raise exception 'Binding changes require confirmed player approval' using errcode='42501';
   end if;
 end if;
 if new.collar_bound and new.player_user_id is distinct from old.player_user_id then
   raise exception 'A bound character cannot be transferred to a different player' using errcode='42501';
 end if;
 -- Do not allow the mirrored JSON attributes to claim a false binding status.
 -- A free character may not be given a bound rank through the legacy editing RPC.
 if (new.data ? 'collar_bound' and (new.data->>'collar_bound')::boolean is distinct from new.collar_bound)
    or (not new.collar_bound and new.data->>'rank' is distinct from 'Unbound: Free')
    or (new.collar_bound and new.data->>'rank' = 'Unbound: Free') then
   raise exception 'Character rank and collar state must agree' using errcode='42501';
 end if;
 return new;
end
$guard$;
drop trigger if exists order_guard_collar_change on public.characters;
create trigger order_guard_collar_change before insert or update on public.characters
for each row execute function public.order_guard_collar_change();

create or replace function public.order_request_status(p_character_id text,p_bound boolean)
returns uuid language plpgsql volatile security definer set search_path = ''
as $request$
declare
  c public.characters%rowtype;
  who uuid := auth.uid();
  actor_role text := public.order_my_role();
  new_id uuid;
begin
 if actor_role is null then raise exception 'Not approved' using errcode='42501'; end if;
 select * into c from public.characters where id=p_character_id;
 if not found or c.player_user_id is null then
   raise exception 'Assign an approved player account before requesting status changes';
 end if;
 if c.collar_bound=p_bound then raise exception 'Character already has this binding status'; end if;
 if who <> c.player_user_id and actor_role not in ('domina','high_command') and
   not (actor_role='handler' and c.handler_user_id=who) then
   raise exception 'You cannot request status changes for this character' using errcode='42501';
 end if;
 if exists(select 1 from public.order_status_requests
     where character_id=p_character_id and state in ('pending','approved')) then
   raise exception 'There is already an unresolved status request';
 end if;
 insert into public.order_status_requests(character_id,player_user_id,requested_by,requested_bound)
 values(p_character_id,c.player_user_id,who,p_bound) returning id into new_id;
 return new_id;
end
$request$;
revoke all on function public.order_request_status(text,boolean) from public;
grant execute on function public.order_request_status(text,boolean) to authenticated;

create or replace function public.order_list_status_requests()
returns jsonb language plpgsql stable security definer set search_path = ''
as $list$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Not approved' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'character_id',r.character_id,'name',c.data->>'name',
   'requested_bound',r.requested_bound,'state',r.state,
   'player_user_id',r.player_user_id,'requested_by',r.requested_by,
   'created_at',r.created_at,'decided_at',r.decided_at
 ) order by r.created_at desc),'[]'::jsonb) into result
 from public.order_status_requests r join public.characters c on c.id=r.character_id
 where r.player_user_id=auth.uid() or public.order_my_role() in ('domina','high_command')
    or (public.order_my_role()='handler' and c.handler_user_id=auth.uid());
 return result;
end
$list$;
revoke all on function public.order_list_status_requests() from public;
grant execute on function public.order_list_status_requests() to authenticated;

create or replace function public.order_decide_status(p_request_id uuid,p_approve boolean)
returns void language plpgsql volatile security definer set search_path = ''
as $decide$
declare r public.order_status_requests%rowtype;
begin
 select * into r from public.order_status_requests where id=p_request_id for update;
 if not found or r.player_user_id <> auth.uid() or r.state<>'pending' then
   raise exception 'Only the linked player can decide a pending request' using errcode='42501';
 end if;
 update public.order_status_requests
 set state=case when p_approve then 'approved' else 'declined' end,decided_at=now()
 where id=p_request_id;
end
$decide$;
revoke all on function public.order_decide_status(uuid,boolean) from public;
grant execute on function public.order_decide_status(uuid,boolean) to authenticated;

create or replace function public.order_cancel_status(p_request_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $cancel$
begin
 update public.order_status_requests set state='cancelled',decided_at=now()
 where id=p_request_id and state in ('pending','approved')
   and (player_user_id=auth.uid() or requested_by=auth.uid());
 if not found then raise exception 'No cancellable status request found' using errcode='42501'; end if;
end
$cancel$;
revoke all on function public.order_cancel_status(uuid) from public;
grant execute on function public.order_cancel_status(uuid) to authenticated;

create or replace function public.order_apply_status(p_request_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $apply$
declare r public.order_status_requests%rowtype; c public.characters%rowtype;
begin
 if public.order_my_role() not in ('domina','high_command') then
   raise exception 'Only high command may complete character status transitions' using errcode='42501';
 end if;
 select * into r from public.order_status_requests where id=p_request_id for update;
 if not found or r.state<>'approved' then raise exception 'Player approval required'; end if;
 select * into c from public.characters where id=r.character_id for update;
 if not found or c.player_user_id is distinct from r.player_user_id
   or c.collar_bound=r.requested_bound then
   raise exception 'Character ownership or status changed since approval'; end if;
 perform set_config('eclipse.verified_status_change','yes',true);
 update public.characters set
   collar_bound=r.requested_bound,
   data=data || jsonb_build_object(
     'collar_bound',r.requested_bound,
     'rank', case when r.requested_bound then 'Rank I: Unbroken' else 'Unbound: Free' end
   ) where id=r.character_id;
 perform set_config('eclipse.verified_status_change','',true);
 update public.order_status_requests set state='applied',applied_at=now() where id=p_request_id;
end
$apply$;
revoke all on function public.order_apply_status(uuid) from public;
grant execute on function public.order_apply_status(uuid) to authenticated;

-- Adult-only OOC opt-in. Do not store descriptive sexual content or sensitive boundaries.
create table if not exists public.order_scenes (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 3 and 140),
 summary text not null check(length(summary) between 20 and 1200),
 themes text not null check(length(themes) between 10 and 1000),
 hosted_by uuid not null references auth.users(id),
 state text not null default 'planned' check(state in ('planned','active','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.order_scene_participation (
 scene_id uuid not null references public.order_scenes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 ooc_consent boolean not null default false,
 paused boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(scene_id,user_id)
);
alter table public.order_scenes enable row level security;
alter table public.order_scene_participation enable row level security;
revoke all on public.order_scenes,public.order_scene_participation from anon,authenticated,public;

create or replace function public.order_create_scene(p_title text,p_summary text,p_themes text)
returns uuid language plpgsql volatile security definer set search_path = ''
as $scene$
declare new_id uuid;
begin
 if public.order_my_role() not in ('domina','high_command','handler') then
   raise exception 'Only approved scene hosts may create scenes' using errcode='42501';
 end if;
 if not public.order_adult_approved() then raise exception 'Adult RP access must be reviewed and approved first' using errcode='42501'; end if;
 insert into public.order_scenes(title,summary,themes,hosted_by)
 values(left(trim(p_title),140),left(trim(p_summary),1200),left(trim(p_themes),1000),auth.uid())
 returning id into new_id;
 return new_id;
end
$scene$;
revoke all on function public.order_create_scene(text,text,text) from public;
grant execute on function public.order_create_scene(text,text,text) to authenticated;

create or replace function public.order_list_scenes()
returns jsonb language plpgsql stable security definer set search_path = ''
as $scenes$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Not approved' using errcode='42501'; end if;
 if not public.order_adult_approved() then raise exception 'Adult RP access must be reviewed and approved first' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',s.id,'title',s.title,'summary',s.summary,'themes',s.themes,'hosted_by',s.hosted_by,
   'state',s.state,'created_at',s.created_at,'participants',(
     select count(*) from public.order_scene_participation p
     where p.scene_id=s.id and p.ooc_consent=true and p.paused=false
   ),
   'my_consent',coalesce((select p.ooc_consent from public.order_scene_participation p
     where p.scene_id=s.id and p.user_id=auth.uid()),false),
   'my_paused',coalesce((select p.paused from public.order_scene_participation p
     where p.scene_id=s.id and p.user_id=auth.uid()),false)
 ) order by s.created_at desc),'[]'::jsonb) into result
 from public.order_scenes s;
 return result;
end
$scenes$;
revoke all on function public.order_list_scenes() from public;
grant execute on function public.order_list_scenes() to authenticated;

create or replace function public.order_scene_consent(p_scene_id uuid,p_consent boolean,p_paused boolean)
returns void language plpgsql volatile security definer set search_path = ''
as $consent$
begin
 if public.order_my_role() is null then raise exception 'Not approved' using errcode='42501'; end if;
 if not public.order_adult_approved() then raise exception 'Adult RP access must be reviewed and approved first' using errcode='42501'; end if;
 if not exists(select 1 from public.order_scenes where id=p_scene_id and state<>'closed') then
   raise exception 'Scene is not accepting participation';
 end if;
 insert into public.order_scene_participation(scene_id,user_id,ooc_consent,paused)
 values(p_scene_id,auth.uid(),p_consent,case when p_consent then p_paused else true end)
 on conflict(scene_id,user_id) do update set
 ooc_consent=excluded.ooc_consent,paused=excluded.paused,updated_at=now();
end
$consent$;
revoke all on function public.order_scene_consent(uuid,boolean,boolean) from public;
grant execute on function public.order_scene_consent(uuid,boolean,boolean) to authenticated;

create or replace function public.order_scene_state(p_scene_id uuid,p_state text)
returns void language plpgsql volatile security definer set search_path = ''
as $state$
begin
 if p_state not in ('planned','active','closed') then raise exception 'Invalid scene state'; end if;
 if not public.order_adult_approved() then raise exception 'Adult RP access must be reviewed and approved first' using errcode='42501'; end if;
 update public.order_scenes set state=p_state,updated_at=now()
 where id=p_scene_id and (hosted_by=auth.uid() or public.order_my_role() in ('domina','high_command'));
 if not found then raise exception 'Not authorized to manage this scene' using errcode='42501'; end if;
end
$state$;
revoke all on function public.order_scene_state(uuid,text) from public;
grant execute on function public.order_scene_state(uuid,text) to authenticated;

-- Server-side dice rolls with bounds. Any member can roll only for a joined,
-- actively consented scene; GM/command can roll without a character.
create table if not exists public.order_dice_rolls (
 id bigint generated always as identity primary key,
 scene_id uuid not null references public.order_scenes(id) on delete cascade,
 rolled_by uuid not null references auth.users(id),
 sides integer not null check (sides between 2 and 100),
 count integer not null check (count between 1 and 20),
 modifier integer not null check (modifier between -100 and 100),
 rolls integer[] not null,
 total integer not null,
 created_at timestamptz not null default now()
);
alter table public.order_dice_rolls enable row level security;
revoke all on public.order_dice_rolls from anon,authenticated,public;

create or replace function public.order_roll_dice(p_scene_id uuid,p_count integer,p_sides integer,p_modifier integer)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $dice$
declare
  roll_values integer[] := '{}'::integer[];
  r integer; i integer; sum_rolls integer := 0; roll_id bigint;
begin
 if public.order_my_role() is null then raise exception 'Not approved' using errcode='42501'; end if;
 if not public.order_adult_approved() then raise exception 'Adult RP access must be reviewed and approved first' using errcode='42501'; end if;
 if p_count is null or p_count not between 1 and 20 or
    p_sides is null or p_sides not between 2 and 100 or
    p_modifier is null or p_modifier not between -100 and 100 then
    raise exception 'Dice parameters out of bounds';
 end if;
 if not exists(
   select 1 from public.order_scenes s
   join public.order_scene_participation p on p.scene_id=s.id
   where s.id=p_scene_id and s.state='active'
     and p.user_id=auth.uid() and p.ooc_consent and not p.paused
 ) then raise exception 'You must opt in to this active scene to roll' using errcode='42501'; end if;
 for i in 1..p_count loop
   r:=1+floor(random()*p_sides)::integer;
   roll_values:=array_append(roll_values,r);
   sum_rolls:=sum_rolls+r;
 end loop;
 insert into public.order_dice_rolls(scene_id,rolled_by,sides,count,modifier,rolls,total)
 values(p_scene_id,auth.uid(),p_sides,p_count,p_modifier,roll_values,sum_rolls+p_modifier)
 returning id into roll_id;
 return jsonb_build_object('id',roll_id,'rolls',roll_values,'modifier',p_modifier,
   'total',sum_rolls+p_modifier,'created_at',now());
end
$dice$;
revoke all on function public.order_roll_dice(uuid,integer,integer,integer) from public;
grant execute on function public.order_roll_dice(uuid,integer,integer,integer) to authenticated;

create or replace function public.order_list_dice(p_scene_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $rolls$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Not approved' using errcode='42501'; end if;
 if not public.order_adult_approved() then raise exception 'Adult RP access must be reviewed and approved first' using errcode='42501'; end if;
 if not exists(select 1 from public.order_scenes where id=p_scene_id) then
   raise exception 'Scene not found';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'rolled_by',r.rolled_by,'sides',r.sides,'count',r.count,
  'modifier',r.modifier,'rolls',r.rolls,'total',r.total,'created_at',r.created_at
 ) order by r.id desc),'[]'::jsonb)
 into result from (select * from public.order_dice_rolls
   where scene_id=p_scene_id order by id desc limit 100) r;
 return result;
end
$rolls$;
revoke all on function public.order_list_dice(uuid) from public;
grant execute on function public.order_list_dice(uuid) to authenticated;
