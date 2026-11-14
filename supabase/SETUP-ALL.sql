-- IMPERIUM NOCTIS: COMBINED SETUP SCRIPT
-- For a NEW Supabase project or a reviewed forward migration. Back up first.
-- This does not automatically create Supabase Auth accounts or approve adult RP access.
-- Run in Supabase SQL Editor (trusted administrative context), not in the public website.


-- ===== START supabase/schema.sql =====
-- Run once in Supabase SQL Editor. Members are provisioned manually by an admin.
-- Enable email/password authentication in Supabase Auth; disable public sign-ups.
create table if not exists public.order_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  added_at timestamptz not null default now()
);
alter table public.order_members enable row level security;
drop policy if exists "Members can read their own membership" on public.order_members;
create policy "Members can read their own membership" on public.order_members
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_order_member()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.order_members where user_id = (select auth.uid())); $$;
revoke all on function public.is_order_member() from public;
grant execute on function public.is_order_member() to authenticated;

create table if not exists public.characters (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_by uuid not null default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now()
);
create or replace function public.touch_order_character()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at=now(); new.updated_by=auth.uid(); return new; end; $$;
drop trigger if exists touch_order_character on public.characters;
create trigger touch_order_character before insert or update on public.characters
for each row execute function public.touch_order_character();
alter table public.characters enable row level security;
drop policy if exists "Approved members read characters" on public.characters;
drop policy if exists "Approved members insert characters" on public.characters;
drop policy if exists "Approved members update characters" on public.characters;
drop policy if exists "Approved members delete characters" on public.characters;
create policy "Approved members read characters" on public.characters for select to authenticated using ((select public.is_order_member()));
create policy "Approved members insert characters" on public.characters for insert to authenticated with check ((select public.is_order_member()));
create policy "Approved members update characters" on public.characters for update to authenticated using ((select public.is_order_member())) with check ((select public.is_order_member()));
create policy "Approved members delete characters" on public.characters for delete to authenticated using ((select public.is_order_member()));
grant select on public.order_members to authenticated;
grant select,insert,update,delete on public.characters to authenticated;

-- After inviting a user through Authentication > Users, approve their account:
-- insert into public.order_members(user_id,role)
-- select id, 'admin' from auth.users where email = 'your-admin-email@example.com'
-- on conflict (user_id) do update set role=excluded.role;
-- Use 'member' in place of 'admin' for ordinary members.
-- IMPORTANT: Current collaborative policies allow BOTH roles to edit every record.

-- ===== END supabase/schema.sql =====


-- ===== START supabase/roles-and-sheets.sql =====
-- Imperium Noctis: roles + genuinely restricted character sheets.
-- Run in Supabase SQL Editor AFTER the base supabase/schema.sql.
-- Backup the project before running migrations.
--
-- FIRST: create your Supabase Auth user in Authentication > Users.
-- LAST: assign yourself the Domina role with the commented SQL at the bottom.
--
-- The only API exposed to members is SECURITY DEFINER RPC, with explicit checks.
-- The underlying JSONB table is NOT directly selectable from browser clients.

alter table public.order_members drop constraint if exists order_members_role_check;
update public.order_members set role = 'high_command' where role = 'admin';
alter table public.order_members add constraint order_members_role_check
  check (role in ('domina','high_command','handler','member'));

alter table public.order_members
  add column if not exists standing text not null default 'Initiate';
alter table public.order_members drop constraint if exists order_members_standing_check;
alter table public.order_members add constraint order_members_standing_check
  check (standing in ('Initiate','Associate','Established','Veteran'));

alter table public.characters
  add column if not exists player_user_id uuid references auth.users(id) on delete set null,
  add column if not exists handler_user_id uuid references auth.users(id) on delete set null,
  add column if not exists collar_bound boolean not null default true;
create index if not exists order_characters_player_idx on public.characters(player_user_id);
create index if not exists order_characters_handler_idx on public.characters(handler_user_id);

-- Migrate any existing legacy JSON ownership information, where available.
update public.characters set
  collar_bound = case when data ? 'collar_bound' then coalesce((data->>'collar_bound')::boolean,true) else true end
where data ? 'collar_bound';
-- Existing characters have no verified owner linkage until assigned by high command.

drop policy if exists "Approved members read characters" on public.characters;
drop policy if exists "Approved members insert characters" on public.characters;
drop policy if exists "Approved members update characters" on public.characters;
drop policy if exists "Approved members delete characters" on public.characters;
revoke all on public.characters from anon,authenticated,public;
revoke all on public.order_members from anon,authenticated,public;

-- Used only inside RPC. This function does not require an externally trusted role parameter.
create or replace function public.order_my_role()
returns text language sql stable security definer set search_path = ''
as $$
  select m.role from public.order_members m where m.user_id = auth.uid()
$$;
revoke all on function public.order_my_role() from public;
grant execute on function public.order_my_role() to authenticated;

create or replace function public.order_list_characters()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.order_my_role();
  output jsonb;
begin
  if actor is null or actor_role is null then
    raise exception 'Not an approved Imperium Noctis member' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
    case
      when c.collar_bound and c.player_user_id = actor and
          actor_role not in ('domina','high_command') and
          not (actor_role = 'handler' and c.handler_user_id = actor)
      then jsonb_build_object(
        'id',c.id,'name',c.data->>'name','player',c.data->>'player',
        'owner',c.data->>'owner','specialty',c.data->>'specialty',
        'rank',c.data->>'rank','hp',c.data->'hp',
        'collar_bound',true,'player_user_id',c.player_user_id,'view_mode','bound')
      else c.data || jsonb_build_object(
        'id',c.id,'player_user_id',c.player_user_id,
        'handler_user_id',c.handler_user_id,
        'collar_bound',c.collar_bound,'view_mode','full')
    end order by c.updated_at desc
  ),'[]'::jsonb) into output
  from public.characters c
  where actor_role in ('domina','high_command')
     or (actor_role = 'handler' and c.handler_user_id = actor)
     or c.player_user_id = actor;
  return output;
end;
$$;
revoke all on function public.order_list_characters() from public;
grant execute on function public.order_list_characters() to authenticated;

create or replace function public.order_save_character(payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.order_my_role();
  record_id text := payload->>'id';
  existing public.characters%rowtype;
  permitted boolean;
  merged jsonb;
  new_player uuid;
  new_handler uuid;
  new_bound boolean;
  field text;
begin
  if actor is null or actor_role is null then
    raise exception 'Not an approved Imperium Noctis member' using errcode = '42501';
  end if;
  if jsonb_typeof(payload) <> 'object' or
     record_id is null or length(record_id) not between 1 and 128 or
     nullif(trim(payload->>'name'),'') is null then
    raise exception 'Invalid character record';
  end if;
  select * into existing from public.characters where id = record_id for update;
  if not found then
    if actor_role not in ('domina','high_command') then
      raise exception 'Only high command can create character records' using errcode='42501';
    end if;
    new_player := nullif(payload->>'player_user_id','')::uuid;
    new_handler := nullif(payload->>'handler_user_id','')::uuid;
    new_bound := coalesce((payload->>'collar_bound')::boolean,false);
    -- Ensure assignments reference approved members; prevent assigning strangers.
    if new_player is not null and not exists(select 1 from public.order_members where user_id=new_player) then
      raise exception 'Character player must be an approved member';
    end if;
    if new_handler is not null and not exists(
      select 1 from public.order_members where user_id=new_handler and role in ('domina','high_command','handler')
    ) then raise exception 'Assigned handler must have a handler or command role'; end if;
    insert into public.characters(id,data,player_user_id,handler_user_id,collar_bound)
      values(record_id,payload - 'view_mode',new_player,new_handler,new_bound);
  else
    permitted := actor_role in ('domina','high_command')
      or (actor_role='handler' and existing.handler_user_id=actor)
      or (actor_role='member' and existing.player_user_id=actor and not existing.collar_bound);
    if not permitted then
      raise exception 'You cannot edit this character sheet' using errcode='42501';
    end if;
    if actor_role in ('domina','high_command') then
      new_player := nullif(payload->>'player_user_id','')::uuid;
      new_handler := nullif(payload->>'handler_user_id','')::uuid;
      new_bound := coalesce((payload->>'collar_bound')::boolean,existing.collar_bound);
      if new_player is not null and not exists(select 1 from public.order_members where user_id=new_player) then
        raise exception 'Character player must be an approved member';
      end if;
      if new_handler is not null and not exists(
        select 1 from public.order_members where user_id=new_handler and role in ('domina','high_command','handler')
      ) then raise exception 'Invalid handler assignment'; end if;
      merged := payload - 'view_mode';
    else
      -- Non-command roles cannot change rank, collar, ownership or assignments.
      -- A handler may edit sheet mechanics, but never the account binding.
      -- Free members may edit only permitted personal sheet fields.
      merged := existing.data;
      foreach field in array array[
        'name','specialty','notes','hp','str','dex','con','int','wis','cha',
        'level','class_name','species','background','alignment','experience',
        'armor_class','speed','proficiency_bonus','hit_dice','max_hp','temp_hp',
        'saving_throws','skills','inventory','features','spells','proficiencies',
        'conditions','personality','ideals','bonds','flaws'
      ] loop
        if payload ? field then merged := jsonb_set(merged,array[field],payload->field,true); end if;
      end loop;
      new_player := existing.player_user_id;
      new_handler := existing.handler_user_id;
      new_bound := existing.collar_bound;
    end if;
    update public.characters set
      data=merged, player_user_id=new_player,handler_user_id=new_handler,collar_bound=new_bound
    where id=record_id;
  end if;
  return jsonb_build_object('id',record_id);
end;
$$;
revoke all on function public.order_save_character(jsonb) from public;
grant execute on function public.order_save_character(jsonb) to authenticated;

create or replace function public.order_delete_character(record_id text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if public.order_my_role() not in ('domina','high_command') then
    raise exception 'Only high command can delete characters' using errcode='42501';
  end if;
  delete from public.characters where id=record_id;
end;
$$;
revoke all on function public.order_delete_character(text) from public;
grant execute on function public.order_delete_character(text) to authenticated;

create or replace function public.order_list_members()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  output jsonb;
begin
  if public.order_my_role() not in ('domina','high_command','handler') then
    raise exception 'Not allowed to browse member directory' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',m.user_id,'role',m.role,'standing',m.standing,'email',u.email
  ) order by u.email),'[]'::jsonb)
  into output from public.order_members m join auth.users u on u.id=m.user_id;
  return output;
end;
$$;
revoke all on function public.order_list_members() from public;
grant execute on function public.order_list_members() to authenticated;

create or replace function public.order_set_member_role(target_user_id uuid, target_role text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor_role text := public.order_my_role();
  prior_role text;
begin
  if actor_role not in ('domina','high_command') then
    raise exception 'Only command may change roles' using errcode='42501';
  end if;
  if target_role not in ('domina','high_command','handler','member') then
    raise exception 'Invalid role';
  end if;
  select role into prior_role from public.order_members where user_id=target_user_id for update;
  if prior_role is null then raise exception 'User must be approved first'; end if;
  if actor_role = 'high_command' and
    (target_role in ('domina','high_command') or prior_role in ('domina','high_command')) then
    raise exception 'Only the Domina may change command roles' using errcode='42501';
  end if;
  if target_user_id = auth.uid() and prior_role = 'domina' and target_role <> 'domina' then
    raise exception 'Transfer Domina to another account before demoting yourself';
  end if;
  update public.order_members set role=target_role where user_id=target_user_id;
end;
$$;
revoke all on function public.order_set_member_role(uuid,text) from public;
grant execute on function public.order_set_member_role(uuid,text) to authenticated;

create or replace function public.order_set_member_standing(target_user_id uuid, new_standing text)
returns void language plpgsql volatile security definer set search_path = ''
as $standing$
begin
  if public.order_my_role() not in ('domina','high_command') then
    raise exception 'Only high command may adjust member standing' using errcode='42501';
  end if;
  if new_standing not in ('Initiate','Associate','Established','Veteran') then
    raise exception 'Invalid standing';
  end if;
  update public.order_members set standing=new_standing where user_id=target_user_id;
  if not found then raise exception 'Approved member not found'; end if;
end;
$standing$;
revoke all on function public.order_set_member_standing(uuid,text) from public;
grant execute on function public.order_set_member_standing(uuid,text) to authenticated;

-- Give the real owner's Supabase Auth account the unique highest role.
-- Change the email below to the email used to sign up in Authentication > Users.
-- IMPORTANT: Run this only while authenticated to the trusted Supabase SQL Editor,
-- never as a frontend request.
--
-- insert into public.order_members(user_id,role)
-- select id,'domina' from auth.users where email='YOUR_EMAIL_HERE'
-- on conflict(user_id) do update set role=excluded.role;

-- To approve a member or a handler:
-- insert into public.order_members(user_id,role)
-- select id,'member' from auth.users where email='MEMBER_EMAIL_HERE'
-- on conflict(user_id) do update set role=excluded.role;

-- ===== END supabase/roles-and-sheets.sql =====


-- ===== START supabase/platform-foundations.sql =====
-- Imperium Noctis platform foundations, revision 1.
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
 if not exists(select 1 from public.order_scenes
   where id=p_scene_id and (state<>'closed' or p_consent=false)) then
   raise exception 'Closed scenes cannot accept new consent, but withdrawal remains available';
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

-- ===== END supabase/platform-foundations.sql =====


-- ===== START supabase/advanced-dice.sql =====
-- Advanced dice formulas and GM-private roll visibility.
-- Run after platform-foundations.sql.
alter table public.order_dice_rolls
  add column if not exists formula text,
  add column if not exists visibility text not null default 'public';
alter table public.order_dice_rolls drop constraint if exists order_dice_rolls_visibility_check;
alter table public.order_dice_rolls add constraint order_dice_rolls_visibility_check
  check(visibility in ('public','gm_private'));

create or replace function public.order_roll_expression(p_scene_id uuid,p_expression text,p_visibility text default 'public')
returns jsonb language plpgsql volatile security definer set search_path = ''
as $dice$
declare
 m text[]; n int; sides int; modifier int; mode text; val int;
 values_rolled int[] := '{}'::int[]; score int := 0; roll_id bigint;
 host_id uuid;
begin
 if public.order_my_role() is null or not public.order_adult_approved() then
   raise exception 'Adult RP access is required' using errcode='42501';
 end if;
 select hosted_by into host_id from public.order_scenes where id=p_scene_id and state='active';
 if host_id is null then raise exception 'Scene must be active'; end if;
 if not exists(select 1 from public.order_scene_participation
   where scene_id=p_scene_id and user_id=auth.uid()
   and ooc_consent=true and paused=false) then
   raise exception 'An active OOC scene opt-in is required to roll' using errcode='42501';
 end if;
 if p_visibility not in ('public','gm_private') then raise exception 'Invalid visibility'; end if;
 if p_visibility='gm_private' and auth.uid()<>host_id and public.order_my_role() not in ('domina','high_command') then
   raise exception 'Only scene hosts or high command may make GM-private rolls' using errcode='42501';
 end if;
 m := regexp_match(
   lower(regexp_replace(coalesce(p_expression,''),'\s+','','g')),
   '^([1-9][0-9]?)d(4|6|8|10|12|20|100)(kh1|kl1)?([+-][0-9]{1,2})?$');
 if m is null then raise exception 'Use formulas such as 1d20+5, 2d6-1, 2d20kh1+3'; end if;
 n := m[1]::int; sides:=m[2]::int; mode:=coalesce(m[3],'normal'); modifier:=coalesce(m[4],'0')::int;
 if n>20 or (mode<>'normal' and (n<>2 or sides<>20)) then
   raise exception 'Maximum 20 dice; advantage/disadvantage use exactly 2d20';
 end if;
 for i in 1..n loop
   val:=1+floor(random()*sides)::int;
   values_rolled:=array_append(values_rolled,val);
   score:=score+val;
 end loop;
 if mode='kh1' then score:=greatest(values_rolled[1],values_rolled[2]); end if;
 if mode='kl1' then score:=least(values_rolled[1],values_rolled[2]); end if;
 score:=score+modifier;
 insert into public.order_dice_rolls(scene_id,rolled_by,sides,count,modifier,rolls,total,formula,visibility)
 values(p_scene_id,auth.uid(),sides,n,modifier,values_rolled,score,
   lower(regexp_replace(p_expression,'\s+','','g')),p_visibility)
 returning id into roll_id;
 return jsonb_build_object('id',roll_id,'rolls',values_rolled,
   'modifier',modifier,'total',score,'formula',p_expression,'visibility',p_visibility);
end
$dice$;
revoke all on function public.order_roll_expression(uuid,text,text) from public;
grant execute on function public.order_roll_expression(uuid,text,text) to authenticated;

create or replace function public.order_list_dice(p_scene_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $rolls$
declare result jsonb; host_id uuid;
begin
 if public.order_my_role() is null or not public.order_adult_approved() then
   raise exception 'Adult RP access required' using errcode='42501';
 end if;
 select hosted_by into host_id from public.order_scenes where id=p_scene_id;
 if host_id is null then raise exception 'Scene not found'; end if;
 if not exists(select 1 from public.order_scene_participation
   where scene_id=p_scene_id and user_id=auth.uid() and ooc_consent=true)
   and host_id<>auth.uid() and public.order_my_role() not in ('domina','high_command') then
   raise exception 'Scene participation required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'rolled_by',r.rolled_by,'sides',r.sides,'count',r.count,
  'modifier',r.modifier,'rolls',r.rolls,'total',r.total,
  'formula',r.formula,'visibility',r.visibility,'created_at',r.created_at
 ) order by r.id desc),'[]'::jsonb)
 into result from (select * from public.order_dice_rolls
   where scene_id=p_scene_id
   and (visibility='public' or rolled_by=auth.uid() or host_id=auth.uid()
     or public.order_my_role() in ('domina','high_command'))
   order by id desc limit 100) r;
 return result;
end
$rolls$;
revoke all on function public.order_list_dice(uuid) from public;
grant execute on function public.order_list_dice(uuid) to authenticated;

-- Legacy order_roll_dice remains for compatibility but always creates PUBLIC rolls.
-- Use the formula RPC for advantage, disadvantage, and GM-private rolls.

-- ===== END supabase/advanced-dice.sql =====


-- ===== START supabase/audit.sql =====
-- Imperium Noctis audit trail.
-- Apply after platform-foundations.sql.
-- Stores staff change records (not private scene preferences) for 180 days
-- by policy. Retention pruning must be scheduled separately.

create table if not exists public.order_audit_events(
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id) on delete set null,
 event_type text not null,
 target_id text not null,
 previous_record jsonb,
 next_record jsonb,
 happened_at timestamptz not null default now()
);
alter table public.order_audit_events enable row level security;
revoke all on public.order_audit_events from anon,authenticated,public;
create index if not exists order_audit_events_at on public.order_audit_events(happened_at desc);

create or replace function public.order_audit_character_write()
returns trigger language plpgsql security definer set search_path = ''
as $audit$
begin
  insert into public.order_audit_events(actor,event_type,target_id,previous_record,next_record)
  values(auth.uid(),
    case when tg_op='INSERT' then 'character.created'
         when tg_op='UPDATE' then 'character.updated'
         else 'character.deleted' end,
    coalesce(new.id,old.id),
    case when tg_op='INSERT' then null else
      jsonb_build_object('rank',old.data->>'rank','collar_bound',old.collar_bound,
        'player_user_id',old.player_user_id,'handler_user_id',old.handler_user_id)
    end,
    case when tg_op='DELETE' then null else
      jsonb_build_object('rank',new.data->>'rank','collar_bound',new.collar_bound,
        'player_user_id',new.player_user_id,'handler_user_id',new.handler_user_id)
    end
  );
  return coalesce(new,old);
end
$audit$;
drop trigger if exists order_audit_character_write on public.characters;
create trigger order_audit_character_write after insert or update or delete on public.characters
for each row execute function public.order_audit_character_write();

create or replace function public.order_list_audit(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = ''
as $list$
declare result jsonb;
begin
 if public.order_my_role() not in ('domina','high_command') then
   raise exception 'Only command can inspect administrative audit events' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'actor',e.actor,'event_type',e.event_type,'target_id',e.target_id,
   'previous_record',e.previous_record,'next_record',e.next_record,'happened_at',e.happened_at
 ) order by e.id desc),'[]'::jsonb) into result
 from (select * from public.order_audit_events
       order by id desc limit least(greatest(coalesce(p_limit,100),1),200)) e;
 return result;
end
$list$;
revoke all on function public.order_list_audit(integer) from public;
grant execute on function public.order_list_audit(integer) to authenticated;

-- ===== END supabase/audit.sql =====


-- ===== START supabase/settings.sql =====
-- Code-free editing for public FC rules and session guidance.
-- Apply after the other RP platform migrations.
create table if not exists public.order_settings (
  setting_key text primary key check (setting_key in ('welcome','house_rules','scene_guidelines')),
  content text not null check (length(content)<=12000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.order_settings enable row level security;
revoke all on public.order_settings from anon,authenticated,public;
insert into public.order_settings(setting_key,content) values
 ('welcome','Welcome to the Imperium Noctis.'),
 ('house_rules','Character mechanics and dice follow the current FC house rules.'),
 ('scene_guidelines','All adult RP scenes require explicit, revocable out-of-character opt-in. In-character refusal never overrides player-level OOC controls.')
on conflict(setting_key) do nothing;

create or replace function public.order_read_settings()
returns jsonb language plpgsql stable security definer set search_path = ''
as $settings$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Not approved' using errcode='42501'; end if;
 select coalesce(jsonb_object_agg(setting_key,content),'{}'::jsonb) into result
 from public.order_settings;
 return result;
end
$settings$;
revoke all on function public.order_read_settings() from public;
grant execute on function public.order_read_settings() to authenticated;

create or replace function public.order_write_setting(p_key text,p_content text)
returns void language plpgsql volatile security definer set search_path = ''
as $write$
begin
 if public.order_my_role() not in ('domina','high_command') then
   raise exception 'Only command may edit published FC rules' using errcode='42501';
 end if;
 if p_key not in ('welcome','house_rules','scene_guidelines') or
    p_content is null or length(p_content)>12000 then
   raise exception 'Invalid setting key or text size';
 end if;
 insert into public.order_settings(setting_key,content,updated_at,updated_by)
 values(p_key,p_content,now(),auth.uid())
 on conflict(setting_key) do update set
  content=excluded.content,updated_at=now(),updated_by=auth.uid();
end
$write$;
revoke all on function public.order_write_setting(text,text) from public;
grant execute on function public.order_write_setting(text,text) to authenticated;

-- ===== END supabase/settings.sql =====
