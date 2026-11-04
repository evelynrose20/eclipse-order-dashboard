-- Eclipse Order: opt-in member-visible RP profiles and kink lists.
-- Forward migration. Apply after profile-encounters.sql and prior migrations.
-- This is personal player data; NOTHING is public by default.
-- No direct browser SELECT/UPDATE privilege exists on this table.
begin;

create table if not exists public.order_member_rp_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 share_content boolean not null default false,
 share_kinks boolean not null default false,
 kink_entries jsonb not null default '[]'::jsonb
   check(jsonb_typeof(kink_entries)='array' and jsonb_array_length(kink_entries)<=60
      and octet_length(kink_entries::text)<=10000),
 updated_at timestamptz not null default now()
);
alter table public.order_member_rp_profiles enable row level security;
revoke all on public.order_member_rp_profiles from public,anon,authenticated;

create or replace function public.order_get_my_rp_profile()
returns jsonb language plpgsql stable security definer set search_path=''
as $read$
declare result jsonb;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 select jsonb_build_object('display_name',p.display_name,
  'share_content',p.share_content,'share_kinks',p.share_kinks,
  'kink_entries',p.kink_entries,'updated_at',p.updated_at)
 into result from public.order_member_rp_profiles p where p.user_id=auth.uid();
 return coalesce(result,jsonb_build_object('display_name','','share_content',false,
  'share_kinks',false,'kink_entries','[]'::jsonb));
end
$read$;
revoke all on function public.order_get_my_rp_profile() from public;
grant execute on function public.order_get_my_rp_profile() to authenticated;

create or replace function public.order_save_my_rp_profile(
 p_display_name text,p_share_content boolean,p_share_kinks boolean,p_entries jsonb)
returns void language plpgsql volatile security definer set search_path=''
as $save$
declare item jsonb; title text; choice text; normalized_name text;
begin
 if public.order_my_role() is null then raise exception 'Membership required' using errcode='42501'; end if;
 normalized_name:=trim(coalesce(p_display_name,''));
 if length(normalized_name)>60 or p_share_content is null or p_share_kinks is null
   or p_entries is null or jsonb_typeof(p_entries)<>'array'
   or jsonb_array_length(p_entries)>60 or octet_length(p_entries::text)>10000 then
   raise exception 'Invalid profile data'; end if;
 if (p_share_content or p_share_kinks) and length(normalized_name)<2 then
   raise exception 'Choose a display name before publishing your profile'; end if;
 for item in select value from jsonb_array_elements(p_entries) loop
  if jsonb_typeof(item)<>'object' then raise exception 'Invalid preference entry'; end if;
  title:=trim(coalesce(item->>'label',''));choice:=item->>'rating';
  if length(title) not between 1 and 80 or coalesce(choice,'') not in ('favorite','yes','maybe','no')
    or (select count(*) from jsonb_object_keys(item))<>2 then
    raise exception 'Each entry needs a short label and Favorite, Yes, Maybe or No'; end if;
 end loop;
 insert into public.order_member_rp_profiles(user_id,display_name,share_content,share_kinks,kink_entries,updated_at)
 values(auth.uid(),normalized_name,p_share_content,p_share_kinks,p_entries,now())
 on conflict(user_id) do update set display_name=excluded.display_name,
  share_content=excluded.share_content,share_kinks=excluded.share_kinks,
  kink_entries=excluded.kink_entries,updated_at=now();
end
$save$;
revoke all on function public.order_save_my_rp_profile(text,boolean,boolean,jsonb) from public;
grant execute on function public.order_save_my_rp_profile(text,boolean,boolean,jsonb) to authenticated;

create or replace function public.order_list_shared_rp_profiles()
returns jsonb language plpgsql stable security definer set search_path=''
as $directory$
declare result jsonb;
begin
 if public.order_my_role() is null or not coalesce((
  select p.adult_declaration from public.order_profile_preferences p where p.user_id=auth.uid()),false)
 then raise exception 'Adult member profile required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'user_id',p.user_id,'display_name',p.display_name,
  'content_preferences',case when p.share_content then coalesce(c.content_preferences,'{}'::jsonb) else null end,
  'kink_entries',case when p.share_kinks then p.kink_entries else null end,
  'shares_content',p.share_content,'shares_kinks',p.share_kinks
 ) order by lower(p.display_name)),'[]'::jsonb)
 into result
 from public.order_member_rp_profiles p
 join public.order_profile_preferences c on c.user_id=p.user_id and c.adult_declaration
 join public.order_members m on m.user_id=p.user_id
 where (p.share_content or p.share_kinks) and length(trim(p.display_name))>=2;
 return result;
end
$directory$;
revoke all on function public.order_list_shared_rp_profiles() from public;
grant execute on function public.order_list_shared_rp_profiles() to authenticated;

commit;
