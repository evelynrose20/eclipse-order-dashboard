-- Eclipse Order audit trail.
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
