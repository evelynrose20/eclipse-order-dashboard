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
