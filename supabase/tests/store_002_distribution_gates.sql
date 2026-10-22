-- Focused real PostgreSQL tests; every user, product, release and audit rolls back.
-- The fake hashes/paths below exercise policy only. They are not plugin evidence.
begin;
create temporary table distribution_test_ids(name text primary key, id uuid not null default gen_random_uuid());
insert into distribution_test_ids(name) values ('admin'),('owner'),('other');
create temporary table distribution_test_results(test text primary key, passed boolean not null);
grant select on distribution_test_ids to service_role, anon, authenticated;
grant select, insert on distribution_test_results to service_role, anon, authenticated;

create function pg_temp.distribution_check(p_ok boolean, p_name text) returns void
language plpgsql security invoker as $$
begin
  if p_ok is distinct from true then raise exception 'STORE-002 CHECK FAILED: %', p_name; end if;
  insert into pg_temp.distribution_test_results values(p_name, true);
end;
$$;
create function pg_temp.distribution_expect_failure(p_sql text, p_state text, p_message text, p_name text)
returns void language plpgsql security invoker as $$
declare v_state text; v_message text; failed boolean := false;
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> p_state or (p_message is not null and v_message <> p_message) then
      raise exception 'UNEXPECTED ERROR for %: % %', p_name, v_state, v_message;
    end if;
    failed := true;
  end;
  perform pg_temp.distribution_check(failed, p_name);
end;
$$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'store002-sql-'||id||'@example.invalid',now(),
    case when name='other' then '{"admin":true}'::jsonb else '{}'::jsonb end from distribution_test_ids;
insert into public.store_admins(user_id,bootstrap_reason)
  select id,'Rolled-back STORE-002 policy test only' from distribution_test_ids where name='admin';

set local role service_role;
do $$
declare
  a uuid := (select id from pg_temp.distribution_test_ids where name='admin');
  u uuid := (select id from pg_temp.distribution_test_ids where name='owner');
  o uuid := (select id from pg_temp.distribution_test_ids where name='other');
  product text := 'store002-sql-' || replace(a::text,'-','');
  data jsonb; refs jsonb; notices jsonb; result jsonb; missing_data jsonb; dl jsonb;
  rid uuid; missing_id uuid; stable_id uuid; v2_id uuid; field text; i integer := 0; before_count bigint;
begin
  perform public.store_admin_product(a,jsonb_build_object('id',product,'name','Rolled-back STORE-002 fixture','status','private_beta'));
  perform public.store_create_invite(a,md5(a::text)||md5(u::text),product,null,now()+interval '1 day');
  perform public.store_redeem(u,md5(a::text)||md5(u::text));
  notices := jsonb_build_array(jsonb_build_object('path','MANDATORY-NOTICES.txt','sha256',repeat('b',64),'file_size',27));
  refs := jsonb_build_object('installer_verification_reference','Synthetic sealed EXE hash check',
    'notices_reference','Synthetic exact ZIP notices check','fl_playback_reference','Synthetic exact-build FL playback confirmation',
    'licensing_reference','Synthetic documented distribution eligibility');
  data := jsonb_build_object('product_id',product,'version','0.2.0-sqltest','coverage_major',1,
    'artifact_kind','installer','channel','private_beta','status','draft','signing_status','unsigned',
    'object_key','installer/'||product||'/0.2.0/'||repeat('a',64)||'/fixture.zip',
    'sha256',repeat('a',64),'file_size',100,'package_format','zip','installer_path','FixtureSetup.exe',
    'installer_sha256',repeat('c',64),'installer_file_size',50,'mandatory_notices',notices) || refs;

  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',o,data),
    '42501','admin_required','non-admin cannot stage installer');
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,data||'{"status":"published"}'::jsonb),
    '23514','installer_requires_draft_ingestion','installer cannot ingest as published');
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,data||'{"approved_for_distribution":true,"approval_reference":"Synthetic approval"}'::jsonb),
    '23514','installer_requires_draft_ingestion','installer cannot ingest preapproved');
  perform pg_temp.distribution_expect_failure(format('insert into public.store_releases select (jsonb_populate_record(null::public.store_releases,%L::jsonb)).*',
    data||jsonb_build_object('id',gen_random_uuid(),'bucket','store-installers','format','vst3','platform','windows-x64',
      'approved_for_distribution',true,'approval_reference','Synthetic direct-table approval','approved_by',a,'approved_at',now(),
      'created_by',a,'created_at',now(),'updated_at',now(),'release_notes','','installation_notes','')),
    '23514','installer_requires_draft_ingestion','direct service insertion cannot bypass draft staging');
  foreach field in array array['installer_verification_reference','notices_reference','fl_playback_reference','licensing_reference'] loop
    perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
      data||jsonb_build_object(field,E'\t\n ')),'23514',null,'whitespace-only evidence rejected for '||field);
  end loop;
  result := public.store_admin_release(a,data - 'fl_playback_reference');
  rid := (result->>'id')::uuid;
  perform pg_temp.distribution_check(result->>'status'='draft' and not (result->>'approved_for_distribution')::boolean
    and result->>'fl_playback_reference' is null and result->>'approval_reference' is null
    and result->>'sha256'<>result->>'installer_sha256', 'draft separates container hash installer hash and absent approvals');
  perform pg_temp.distribution_expect_failure(format('select public.store_authorize_download(%L,%L)',u,rid),
    'P0001','download_unavailable','staged real-shaped package cannot download');
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,jsonb_build_object('id',rid,'status','published')),
    '23514',null,'publication requires separate explicit approval');

  -- Each independent gate must fail closed even with the remaining evidence.
  foreach field in array array['installer_sha256','installer_path','installer_file_size',
      'installer_verification_reference','notices_reference','fl_playback_reference','licensing_reference'] loop
    i := i + 1;
    missing_data := (data - field) || jsonb_build_object('version','0.2.'||i||'-sqltest',
      'object_key','installer/'||product||'/missing-'||i||'/'||repeat('a',64)||'/fixture.zip');
    result := public.store_admin_release(a,missing_data);
    missing_id := (result->>'id')::uuid;
    perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
      jsonb_build_object('id',missing_id,'status','published','approved_for_distribution',true,'approval_reference','Synthetic explicit owner approval')),
      '23514',null,'approval rejects missing '||field);
    perform pg_temp.distribution_check((select status='draft' and not approved_for_distribution from public.store_releases where id=missing_id),
      'rejected approval preserves draft for missing '||field);
  end loop;
  result := public.store_admin_release(a,data || jsonb_build_object('version','0.2.20-sqltest','mandatory_notices','[]'::jsonb,
    'object_key','installer/'||product||'/empty-notices/'||repeat('a',64)||'/fixture.zip'));
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
    jsonb_build_object('id',result->>'id','approved_for_distribution',true,'approval_reference','Synthetic explicit owner approval')),
    '23514',null,'approval requires bundled mandatory notices');
  result := public.store_admin_release(a,data || jsonb_build_object('version','0.2.21-sqltest','package_format','file',
    'object_key','installer/'||product||'/single-file/'||repeat('a',64)||'/fixture.exe'));
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
    jsonb_build_object('id',result->>'id','approved_for_distribution',true,'approval_reference','Synthetic explicit owner approval')),
    '23514',null,'new installer approval requires ZIP container');

  perform pg_temp.distribution_check(not public.store_notice_manifest_valid('{}'::jsonb),'notice manifest rejects non-array');
  perform pg_temp.distribution_check(not public.store_notice_manifest_valid(notices||notices),'notice manifest rejects duplicate paths');
  perform pg_temp.distribution_check(not public.store_notice_manifest_valid(jsonb_build_array((notices->0)||'{"path":"../notice.txt"}'::jsonb)),
    'notice manifest rejects traversal');
  perform pg_temp.distribution_check(not public.store_notice_manifest_valid(jsonb_build_array((notices->0)||'{"file_size":1.5}'::jsonb)),
    'notice manifest rejects fractional byte size');
  foreach field in array array['CON.txt','licenses/NUL.cpp','licenses/com1.h','licenses/notice.txt.','licenses/notice.txt ',
      'licenses//notice.txt','licenses/../notice.txt','/notice.txt','C:/notice.txt','licenses/notice:stream.txt'] loop
    perform pg_temp.distribution_check(not public.store_notice_manifest_valid(jsonb_build_array((notices->0)||jsonb_build_object('path',field))),
      'notice manifest rejects unsafe Windows path '||field);
  end loop;
  perform pg_temp.distribution_check(public.store_notice_manifest_valid(jsonb_build_array(
    (notices->0)||'{"path":"LICENSES/juce_core.h"}'::jsonb,(notices->0)||'{"path":"LICENSES/juce_core.cpp"}'::jsonb)),
    'required license source h and cpp files remain allowed');
  perform pg_temp.distribution_check(not public.store_notice_manifest_valid((select jsonb_agg((notices->0)||jsonb_build_object('path','notices/'||n||'.txt'))
    from generate_series(1,65) n)), 'notice manifest is bounded to 64 entries');
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,data ||
    jsonb_build_object('version','0.2.22-sqltest','mandatory_notices',jsonb_build_array((notices->0)||'{"extra":"unreviewed"}'::jsonb),
      'object_key','installer/'||product||'/bad-notices/'||repeat('a',64)||'/fixture.zip')),
    '23514',null,'malformed notice manifest cannot stage');

  foreach field in array array['package_format','installer_path','installer_sha256','installer_file_size','mandatory_notices'] loop
    perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
      jsonb_build_object('id',rid,field,null)),'23514','release_artifact_immutable','immutable package field '||field);
  end loop;
  foreach field in array array['installer_verification_reference','notices_reference','licensing_reference'] loop
    perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
      jsonb_build_object('id',rid,field,'Replacement claim')),'23514','release_gate_evidence_immutable','immutable first-write evidence '||field);
  end loop;
  result := public.store_admin_release(a,jsonb_build_object('id',rid,'fl_playback_reference',refs->>'fl_playback_reference'));
  perform pg_temp.distribution_check(result->>'fl_playback_reference'=refs->>'fl_playback_reference' and result->>'status'='draft',
    'missing FL evidence can be recorded without publishing');
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
    jsonb_build_object('id',rid,'fl_playback_reference',null)),'23514','release_gate_evidence_immutable','FL evidence cannot be cleared');
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
    jsonb_build_object('id',rid,'approved_for_distribution',true)),'23514',null,'fifth gate requires owner distribution reference');
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
    jsonb_build_object('id',rid,'approved_for_distribution',true,'approval_reference',E'\t\n ')),
    '23514',null,'owner distribution reference cannot be whitespace only');
  result := public.store_admin_release(a,jsonb_build_object('id',rid,'approved_for_distribution',true,'approval_reference','Synthetic explicit owner distribution approval'));
  perform pg_temp.distribution_check(result->>'approved_by'=a::text and result->>'approved_at' is not null and result->>'status'='draft',
    'separate approval records verified admin actor and time');
  perform pg_temp.distribution_expect_failure(format('select public.store_authorize_download(%L,%L)',u,rid),
    'P0001','download_unavailable','approved draft remains disabled');
  perform public.store_admin_release(a,jsonb_build_object('id',rid,'status','published'));
  dl := public.store_authorize_download(u,rid);
  perform pg_temp.distribution_check(dl->>'ttl_seconds'='60' and dl->>'object_key'=data->>'object_key'
    and dl->'release'->>'signing_status'='unsigned','five-gate approved private beta authorizes exact ZIP for owner');
  perform pg_temp.distribution_expect_failure(format('select public.store_authorize_download(%L,%L)',o,rid),
    'P0001','download_unavailable','private beta still requires permanent ownership');
  before_count := (select count(*) from public.store_download_events where user_id=u);
  perform public.store_admin_release(a,jsonb_build_object('id',rid,'status','draft'));
  perform pg_temp.distribution_expect_failure(format('select public.store_authorize_download(%L,%L)',u,rid),
    'P0001','download_unavailable','reversible disable prevents new links');
  perform pg_temp.distribution_check((select count(*)=before_count from public.store_download_events where user_id=u),
    'disabled release denial creates no authorization event');
  perform public.store_admin_release(a,jsonb_build_object('id',rid,'status','published'));
  perform pg_temp.distribution_check(public.store_authorize_download(u,rid)->>'download_event_id' is not null,
    'disabled approved release can be re-enabled');
  perform public.store_admin_product(a,jsonb_build_object('id',product,'status','unavailable'));
  perform pg_temp.distribution_expect_failure(format('select public.store_authorize_download(%L,%L)',u,rid),
    'P0001','download_unavailable','product unavailability still blocks eligible installer');
  perform public.store_admin_product(a,jsonb_build_object('id',product,'status','private_beta'));

  result := public.store_admin_release(a,data||jsonb_build_object('version','0.3.0-sqltest','channel','stable',
    'object_key','installer/'||product||'/stable-unsigned/'||repeat('a',64)||'/fixture.zip'));
  stable_id := (result->>'id')::uuid;
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
    jsonb_build_object('id',stable_id,'status','published','approved_for_distribution',true,'approval_reference','Synthetic owner approval')),
    '23514',null,'unsigned stable remains forbidden with all gates');
  result := public.store_admin_release(a,data||jsonb_build_object('version','0.3.1-sqltest','channel','stable','signing_status','verified',
    'object_key','installer/'||product||'/stable-signed/'||repeat('a',64)||'/fixture.zip'));
  stable_id := (result->>'id')::uuid;
  perform public.store_admin_release(a,jsonb_build_object('id',stable_id,'status','published','approved_for_distribution',true,'approval_reference','Synthetic owner approval'));
  perform pg_temp.distribution_check(public.store_authorize_download(u,stable_id)->>'download_event_id' is not null,
    'verified stable requires and accepts all gates');
  result := public.store_admin_release(a,data||jsonb_build_object('version','2.0.0-sqltest','coverage_major',2,
    'object_key','installer/'||product||'/v2/'||repeat('a',64)||'/fixture.zip'));
  v2_id := (result->>'id')::uuid;
  perform public.store_admin_release(a,jsonb_build_object('id',v2_id,'status','published','approved_for_distribution',true,'approval_reference','Synthetic owner approval'));
  perform pg_temp.distribution_expect_failure(format('select public.store_authorize_download(%L,%L)',u,v2_id),
    'P0001','download_unavailable','permanent v1 ownership does not expand to v2');
  perform public.store_admin_release(a,jsonb_build_object('id',rid,'status','withdrawn'));
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,jsonb_build_object('id',rid,'status','draft')),
    '23514','withdrawn_release_immutable','withdrawal remains terminal');
  perform pg_temp.distribution_check((select count(*)=1 and bool_and(expires_at is null) from public.store_entitlements where user_id=u),
    'disable withdrawal and failed gates preserve permanent grant');
  perform pg_temp.distribution_expect_failure(format('select public.store_admin_release(%L,%L::jsonb)',a,
    jsonb_build_object('id',rid,'approval_reference','Replacement owner claim')),'23514','release_approval_immutable','owner approval remains immutable');
end;
$$;

set local role anon;
select pg_temp.distribution_expect_failure('select * from public.store_releases','42501',null,'anonymous release metadata read denied');
select pg_temp.distribution_expect_failure('select public.store_release_ready(null::public.store_releases)','42501',null,'anonymous readiness helper denied');
set local role authenticated;
select pg_temp.distribution_expect_failure('select public.store_admin_release(gen_random_uuid(),''{}''::jsonb)','42501',null,'browser release RPC denied');
select pg_temp.distribution_expect_failure('select public.store_notice_manifest_valid(''[]''::jsonb)','42501',null,'browser notice helper denied');
reset role;
select pg_temp.distribution_check((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname like 'store\_%' escape '\' and c.relkind='r'),'store tables retain RLS');
select pg_temp.distribution_check(not has_table_privilege('service_role','public.store_admins','INSERT')
  and not has_table_privilege('service_role','public.store_entitlements','UPDATE')
  and not has_table_privilege('service_role','public.store_entitlements','DELETE'),'admin and permanent grant permissions remain restricted');
select pg_temp.distribution_check((select not public from storage.buckets where id='store-installers'), 'installer storage remains private');
select jsonb_build_object('passed',count(*),'checks',jsonb_agg(test order by test)) as verification from distribution_test_results;
rollback;
