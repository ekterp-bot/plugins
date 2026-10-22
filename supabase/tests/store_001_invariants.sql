-- Real PostgreSQL integration checks. Run as trusted postgres on a dedicated
-- preview/local database after migration. Every fixture is rolled back.
-- This verifies DB behavior, not Auth email delivery, HTTP, or object transfer.
begin;
create temporary table store_test_ids(name text primary key, id uuid not null default gen_random_uuid());
insert into store_test_ids(name) values ('admin'),('tester'),('other'),('unverified'),('session'),('expired_session');
create temporary table store_test_results(test text primary key, passed boolean not null);
grant select on store_test_ids to service_role, anon, authenticated;
grant select, insert on store_test_results to service_role, anon, authenticated;

create function pg_temp.store_check(p_ok boolean, p_name text) returns void language plpgsql security invoker as $$
begin
  if p_ok is distinct from true then raise exception 'STORE CHECK FAILED: %', p_name; end if;
  insert into pg_temp.store_test_results values(p_name, true);
end;
$$;
create function pg_temp.store_expect_failure(p_sql text, p_state text, p_message text, p_name text)
returns void language plpgsql security invoker as $$
declare v_state text; v_message text; v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> p_state or (p_message is not null and v_message <> p_message) then
      raise exception 'UNEXPECTED ERROR for %: % %', p_name, v_state, v_message;
    end if;
    v_failed := true;
  end;
  perform pg_temp.store_check(v_failed, p_name);
end;
$$;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
  select id, 'store-sql-' || id || '@example.invalid',
    case when name <> 'unverified' then now() end,
    case when name = 'other' then '{"role":"admin","admin":true}'::jsonb else '{}'::jsonb end
  from store_test_ids where name in ('admin','tester','other','unverified');
insert into auth.sessions(id, user_id, not_after)
  select s.id, u.id, case when s.name='expired_session' then now() - interval '1 second' else now() + interval '1 hour' end
  from store_test_ids s cross join store_test_ids u where s.name in ('session','expired_session') and u.name='tester';
insert into public.store_admins(user_id, bootstrap_reason)
  select id, 'Rolled-back SQL integration fixture only' from store_test_ids where name='admin';
insert into public.store_invites(code_hash,product_id,expires_at,created_by)
  select repeat('e',64),'nebula',now()-interval '1 day',id from store_test_ids where name='admin';

set local role service_role;
do $$
declare
  a uuid := (select id from pg_temp.store_test_ids where name='admin');
  u uuid := (select id from pg_temp.store_test_ids where name='tester');
  o uuid := (select id from pg_temp.store_test_ids where name='other');
  n uuid := (select id from pg_temp.store_test_ids where name='unverified');
  s uuid := (select id from pg_temp.store_test_ids where name='session');
  es uuid := (select id from pg_temp.store_test_ids where name='expired_session');
  invitation jsonb; grant_result jsonb; release_result jsonb; dl jsonb; rid uuid;
  release_data jsonb; draft_id uuid; v2_id uuid;
begin
  perform pg_temp.store_check(public.store_session_valid(u,s), 'live verified session accepted');
  perform pg_temp.store_check(not public.store_session_valid(o,s), 'session bound to verified user id');
  perform pg_temp.store_check(not public.store_session_valid(u,gen_random_uuid()), 'missing revoked session denied');
  perform pg_temp.store_check(not public.store_session_valid(u,es), 'expired session denied');
  perform pg_temp.store_expect_failure(format('select public.store_require_admin(%L)',o),'42501','admin_required','user-editable metadata cannot grant admin');
  perform pg_temp.store_expect_failure(format('insert into public.store_admins(user_id,bootstrap_reason) values(%L,%L)',o,'self grant'),'42501',null,'service application cannot self-grant admin');
  perform public.store_admin_product(a,'{"id":"nebula","regular_price_minor":9900,"promotional_price_minor":7900}'::jsonb);
  perform pg_temp.store_check((select regular_price_minor=9900 and promotional_price_minor=7900 and not commerce_enabled from public.store_products where id='nebula'),'draft prices persist and commerce stays disabled');
  perform pg_temp.store_expect_failure(format('select public.store_admin_product(%L,%L::jsonb)',a,'{"id":"nebula","promotional_price_minor":10000}'),'23514',null,'invalid promotional price rejected');
  perform pg_temp.store_expect_failure('update public.store_products set commerce_enabled=true where id=''nebula''','23514',null,'commerce cannot be enabled');

  invitation := public.store_create_invite(a,repeat('a',64),'nebula','store-sql-'||u||'@example.invalid',now()+interval '1 day');
  perform pg_temp.store_check(not (invitation ? 'code_hash'), 'invite RPC does not return verifier');
  perform pg_temp.store_expect_failure(format('select public.store_redeem(%L,%L)',n,repeat('a',64)),'P0001','account_unavailable','unverified user denied');
  perform pg_temp.store_expect_failure(format('select public.store_redeem(%L,%L)',o,repeat('a',64)),'P0001','invite_unavailable','wrong verified email denied');
  perform pg_temp.store_expect_failure(format('select public.store_redeem(%L,%L)',u,repeat('e',64)),'P0001','invite_unavailable','expired invite denied');
  perform pg_temp.store_expect_failure(format('select public.store_redeem(%L,%L)',u,repeat('f',64)),'P0001','invite_unavailable','unknown invite denied generically');
  grant_result := public.store_redeem(u,repeat('a',64));
  perform pg_temp.store_check((grant_result->>'existing')::boolean=false
    and grant_result->'entitlement'->>'coverage_major'='1'
    and grant_result->'entitlement'->>'computer_limit'='2'
    and (grant_result->'entitlement'->>'maintenance_updates')::boolean
    and grant_result->'entitlement'->>'expires_at' is null, 'redemption creates permanent v1 maintenance two-computer grant');
  perform pg_temp.store_check((public.store_redeem(u,repeat('a',64))->>'existing')::boolean, 'same caller redemption is idempotent');
  perform pg_temp.store_expect_failure(format('select public.store_redeem(%L,%L)',o,repeat('a',64)),'P0001','invite_unavailable','consumed invite denied to another caller');
  perform public.store_create_invite(a,repeat('b',64),'nebula',null,now()+interval '1 day');
  perform pg_temp.store_expect_failure(format('select public.store_redeem(%L,%L)',u,repeat('b',64)),'P0001','invite_unavailable','second code cannot duplicate entitlement');
  perform pg_temp.store_check((select redeemed_at is null from public.store_invites where code_hash=repeat('b',64)), 'second unused invite is not consumed');
  invitation := public.store_create_invite(a,repeat('c',64),'nebula',null,now()+interval '1 day');
  perform public.store_revoke_invite(a,(invitation->>'id')::uuid);
  perform pg_temp.store_expect_failure(format('select public.store_redeem(%L,%L)',o,repeat('c',64)),'P0001','invite_unavailable','revoked invite denied');
  perform pg_temp.store_expect_failure(format('select public.store_revoke_invite(%L,%L)',a,(select id from public.store_invites where code_hash=repeat('a',64))),'P0001','invite_unavailable','redeemed invite cannot revoke permanent ownership');

  release_data := jsonb_build_object('product_id','nebula','version','1.0.0-sqltest','coverage_major',1,'artifact_kind','test',
    'status','published','object_key','test/1.0.0-sqltest/'||repeat('a',64)||'/fixture.txt','file_size',10,'sha256',repeat('a',64),
    'approved_for_distribution',true,'approval_reference','Synthetic test; no installer');
  release_result := public.store_admin_release(a,release_data);
  rid := (release_result->>'id')::uuid;
  dl := public.store_authorize_download(u,rid);
  perform pg_temp.store_check(dl->>'ttl_seconds'='60' and dl->>'download_event_id' is not null, 'entitled approved release authorizes 60 second link');
  perform pg_temp.store_check((select event_type='link_authorized' from public.store_download_events where id=(dl->>'download_event_id')::uuid),'event describes authorization only');
  perform pg_temp.store_expect_failure(format('select public.store_authorize_download(%L,%L)',o,rid),'P0001','download_unavailable','other account cannot download');
  perform public.store_admin_product(a,'{"id":"nebula","status":"unavailable"}'::jsonb);
  perform pg_temp.store_expect_failure(format('select public.store_authorize_download(%L,%L)',u,rid),'P0001','download_unavailable','unavailable product cannot issue links');
  perform pg_temp.store_check((select count(*)=1 from public.store_entitlements where user_id=u),'product unavailability preserves ownership');
  perform public.store_admin_product(a,'{"id":"nebula","status":"private_beta"}'::jsonb);
  perform pg_temp.store_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,jsonb_build_object('id',rid,'release_notes','changed')),'23514','release_artifact_immutable','release metadata is immutable');
  perform pg_temp.store_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,release_data||'{"version":"2.0.0-sqltest","object_key":"test/2.0.0/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/fixture.txt"}'::jsonb),'23514',null,'v2 cannot be mislabeled v1 coverage');
  release_result := public.store_admin_release(a,release_data||jsonb_build_object('version','2.0.0-sqltest','coverage_major',2,'object_key','test/2.0.0/'||repeat('a',64)||'/fixture.txt'));
  v2_id := (release_result->>'id')::uuid;
  perform pg_temp.store_expect_failure(format('select public.store_authorize_download(%L,%L)',u,v2_id),'P0001','download_unavailable','v1 grant does not cover v2');
  release_result := public.store_admin_release(a,release_data||jsonb_build_object('version','1.0.1-sqltest','status','draft','approved_for_distribution',false,'approval_reference',null,'object_key','test/1.0.1/'||repeat('a',64)||'/fixture.txt'));
  draft_id := (release_result->>'id')::uuid;
  perform pg_temp.store_expect_failure(format('select public.store_authorize_download(%L,%L)',u,draft_id),'P0001','download_unavailable','unapproved draft cannot download');
  perform pg_temp.store_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,release_data||jsonb_build_object('version','1.0.2-sqltest','artifact_kind','installer','signing_status','unsigned','object_key','installer/1.0.2/'||repeat('a',64)||'/fixture.exe')),'23514',null,'unsigned installer cannot publish');
  perform public.store_admin_release(a,jsonb_build_object('id',rid,'status','withdrawn'));
  perform pg_temp.store_expect_failure(format('select public.store_authorize_download(%L,%L)',u,rid),'P0001','download_unavailable','withdrawn release cannot issue links');
  perform pg_temp.store_check((select count(*)=1 from public.store_entitlements where user_id=u),'withdrawal preserves permanent entitlement');
  perform pg_temp.store_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,jsonb_build_object('id',rid,'status','published')),'23514','withdrawn_release_immutable','withdrawn artifact cannot republish');
  perform pg_temp.store_expect_failure('update public.store_entitlements set computer_limit=3','42501',null,'service cannot modify entitlements');
  perform pg_temp.store_expect_failure('delete from public.store_admin_audit','42501',null,'service cannot delete audit');
  perform pg_temp.store_check((public.store_rate_limit('sql-test:'||u,2,60)->>'allowed')::boolean,'rate limit first attempt allowed');
  perform pg_temp.store_check((public.store_rate_limit('sql-test:'||u,2,60)->>'allowed')::boolean,'rate limit second attempt allowed');
  perform pg_temp.store_check(not (public.store_rate_limit('sql-test:'||u,2,60)->>'allowed')::boolean,'rate limit third attempt denied');
end;
$$;
set local role anon;
select pg_temp.store_expect_failure('select * from public.store_entitlements','42501',null,'anonymous ledger read denied');
select pg_temp.store_expect_failure('select public.store_rate_limit(''anon'',1,60)','42501',null,'anonymous RPC execution denied');
set local role authenticated;
select pg_temp.store_expect_failure('select * from public.store_invites','42501',null,'authenticated invite read denied');
select pg_temp.store_expect_failure('select public.store_redeem(gen_random_uuid(),repeat(''a'',64))','42501',null,'authenticated direct redeem RPC denied');
reset role;
select pg_temp.store_expect_failure('update public.store_entitlements set granted_at=now()','23514','store_record_immutable','entitlements immutable even for trusted SQL updates');
select pg_temp.store_check((select not public from storage.buckets where id='store-installers'),'storage bucket is private');
select pg_temp.store_check((select count(*)=2 from pg_policies where policyname in ('store_installers_no_browser_objects','store_installers_no_browser_bucket') and permissive='RESTRICTIVE'),'restrictive storage exclusions installed');
select jsonb_build_object('passed',count(*),'checks',jsonb_agg(test order by test)) as verification from store_test_results;
rollback;
