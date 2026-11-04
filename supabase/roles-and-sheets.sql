-- Eclipse Order: roles + genuinely restricted character sheets.
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
    raise exception 'Not an approved Eclipse Order member' using errcode = '42501';
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
        'collar_bound',true,'view_mode','bound')
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
    raise exception 'Not an approved Eclipse Order member' using errcode = '42501';
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
