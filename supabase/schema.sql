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
