-- Focused real DB check for export audit. All fixtures and audit events rollback.
begin;
create temporary table export_test_ids(name text primary key,id uuid not null default gen_random_uuid());
insert into export_test_ids(name) values('admin'),('customer');
insert into auth.users(id,email,email_confirmed_at)
  select id,'store-export-sql-'||id||'@example.invalid',now() from export_test_ids;
insert into public.store_admins(user_id,bootstrap_reason)
  select id,'Rolled-back export audit test' from export_test_ids where name='admin';
create temporary table export_test_results(test text primary key);
grant select on export_test_ids to service_role;
grant insert,select on export_test_results to service_role;
set local role service_role;
do $$
declare
  a uuid := (select id from pg_temp.export_test_ids where name='admin');
  c uuid := (select id from pg_temp.export_test_ids where name='customer');
  counts jsonb := '{"products":1,"invitations":2,"entitlements":1,"releases":1,"downloads":4,"audit":8}'::jsonb;
  result jsonb; denied boolean;
begin
  result := public.store_record_export(a,counts);
  if result->>'action'<>'export_prepared' or result->'details'<>counts
    or not exists(select 1 from public.store_admin_audit where id=(result->>'id')::uuid and actor_id=a) then
    raise exception 'Valid export audit was not persisted';
  end if;
  insert into pg_temp.export_test_results values('admin export records counts-only audit');
  denied:=false;
  begin perform public.store_record_export(c,counts); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Non-admin export audit allowed'; end if;
  insert into pg_temp.export_test_results values('non-admin export audit denied');
  denied:=false;
  begin perform public.store_record_export(a,counts||'{"raw_code":"forbidden"}'::jsonb); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Non-count audit fields allowed'; end if;
  insert into pg_temp.export_test_results values('extra sensitive fields denied');
  denied:=false;
  begin perform public.store_record_export(a,counts||'{"products":1.5}'::jsonb); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Fractional audit count allowed'; end if;
  insert into pg_temp.export_test_results values('fractional count denied');
  denied:=false;
  begin perform public.store_record_export(a,counts||'{"products":20001}'::jsonb); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Out of range audit count allowed'; end if;
  insert into pg_temp.export_test_results values('out of range count denied');
  if (select count(*) from public.store_admin_audit where actor_id=a)<>1 then raise exception 'Rejected exports wrote audit rows'; end if;
  insert into pg_temp.export_test_results values('rejected payloads leave no audit rows');
end;
$$;
reset role;
do $$
begin
  if has_function_privilege('anon','public.store_record_export(uuid,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.store_record_export(uuid,jsonb)','EXECUTE') then
    raise exception 'Export audit callable by browser roles';
  end if;
  insert into pg_temp.export_test_results values('browser roles cannot execute export audit');
end;
$$;
select jsonb_build_object('passed',count(*),'checks',jsonb_agg(test order by test)) as verification from export_test_results;
rollback;
