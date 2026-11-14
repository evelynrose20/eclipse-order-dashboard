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
