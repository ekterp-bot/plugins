-- STORE-002: private draft ingestion is separate from installer distribution.
-- No data, administrator memberships, grants, or Storage policies are changed.
begin;

create function public.store_package_path_valid(p_path text) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare segment text;
begin
  if p_path is null or length(p_path) not between 1 and 500 then return false; end if;
  foreach segment in array string_to_array(p_path, '/') loop
    -- Relative ASCII paths only. Windows ignores trailing spaces/dots and has
    -- reserved device names even when an extension is appended.
    if segment !~ '^[A-Za-z0-9._-][A-Za-z0-9._ -]*$' or segment ~ '[. ]$'
      or segment ~* '^(con|prn|aux|nul|com[1-9]|lpt[1-9])([.]|$)' then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.store_package_path_valid(text) from public, anon, authenticated;
grant execute on function public.store_package_path_valid(text) to service_role;

alter table public.store_releases
  add column package_format text not null default 'file' check (package_format in ('file', 'zip')),
  add column installer_path text check (installer_path is null or
    (public.store_package_path_valid(installer_path) and installer_path ~ '[.]exe$')),
  add column installer_sha256 text check (installer_sha256 ~ '^[a-f0-9]{64}$'),
  add column installer_file_size bigint check (installer_file_size between 1 and 2147483648),
  add column mandatory_notices jsonb not null default '[]'::jsonb,
  add column installer_verification_reference text check (length(btrim(installer_verification_reference)) between 1 and 2000
    and installer_verification_reference ~ '[^[:space:]]'),
  add column notices_reference text check (length(btrim(notices_reference)) between 1 and 2000 and notices_reference ~ '[^[:space:]]'),
  add column fl_playback_reference text check (length(btrim(fl_playback_reference)) between 1 and 2000 and fl_playback_reference ~ '[^[:space:]]'),
  add column licensing_reference text check (length(btrim(licensing_reference)) between 1 and 2000 and licensing_reference ~ '[^[:space:]]');

-- The trusted importer verifies actual ZIP entries and bytes. This helper only
-- validates the bounded, immutable evidence manifest; it cannot inspect Storage.
create function public.store_notice_manifest_valid(p_notices jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare item jsonb; seen_paths text[] := array[]::text[];
begin
  if jsonb_typeof(p_notices) is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_notices) > 64 then return false; end if;
  for item in select value from jsonb_array_elements(p_notices) loop
    if jsonb_typeof(item) is distinct from 'object'
      or not (item ?& array['path','sha256','file_size'])
      or item - array['path','sha256','file_size'] <> '{}'::jsonb
      or jsonb_typeof(item->'path') is distinct from 'string'
      or jsonb_typeof(item->'sha256') is distinct from 'string'
      or jsonb_typeof(item->'file_size') is distinct from 'number' then return false; end if;
    if not public.store_package_path_valid(item->>'path')
      or item->>'sha256' !~ '^[a-f0-9]{64}$'
      or item->>'file_size' !~ '^[1-9][0-9]{0,9}$' then return false; end if;
    if (item->>'file_size')::bigint > 2147483648
      or lower(item->>'path') = any(seen_paths) then return false; end if;
    seen_paths := array_append(seen_paths, lower(item->>'path'));
  end loop;
  return true;
end;
$$;
revoke all on function public.store_notice_manifest_valid(jsonb) from public, anon, authenticated;
grant execute on function public.store_notice_manifest_valid(jsonb) to service_role;

alter table public.store_releases
  add constraint store_release_notice_manifest_check check (public.store_notice_manifest_valid(mandatory_notices)),
  add constraint store_release_package_extension_check check (package_format <> 'zip' or object_key ~ '[.]zip$'),
  add constraint store_release_test_package_check check (artifact_kind <> 'test' or
    (package_format = 'file' and installer_path is null and installer_sha256 is null and installer_file_size is null
      and mandatory_notices = '[]'::jsonb and installer_verification_reference is null and notices_reference is null
      and fl_playback_reference is null and licensing_reference is null));

-- Approval references attest to the exact immutable package and installer, not
-- arbitrary builds sharing a version label. Strings are recorded evidence, not
-- a DB claim to have hashed bytes, reviewed licenses, or heard FL Studio audio.
create function public.store_release_ready(p_release public.store_releases) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select coalesce((p_release).approved_for_distribution
    and (p_release).approved_by is not null and (p_release).approved_at is not null
    and (p_release).approval_reference is not null
    and ((p_release).artifact_kind = 'test' or (
      (p_release).artifact_kind = 'installer' and (p_release).package_format = 'zip'
      and (p_release).approval_reference ~ '[^[:space:]]'
      and (p_release).installer_path is not null and (p_release).installer_sha256 is not null
      and (p_release).installer_file_size is not null and jsonb_array_length((p_release).mandatory_notices) > 0
      and (p_release).installer_verification_reference is not null and (p_release).notices_reference is not null
      and (p_release).fl_playback_reference is not null and (p_release).licensing_reference is not null
      and ((p_release).signing_status = 'verified'
        or ((p_release).signing_status = 'unsigned' and (p_release).channel = 'private_beta'))
    )), false);
$$;
revoke all on function public.store_release_ready(public.store_releases) from public, anon, authenticated;
grant execute on function public.store_release_ready(public.store_releases) to service_role;

-- This is the original STORE-001 publication constraint, verified by name and
-- definition in the dedicated preview. Its replacement keeps stable signing strict.
alter table public.store_releases drop constraint store_releases_check5;
alter table public.store_releases add constraint store_release_publication_ready
  check (status <> 'published' or approved_for_distribution);
alter table public.store_releases add constraint store_release_installer_approval_ready
  check (artifact_kind <> 'installer' or not approved_for_distribution or (
    package_format = 'zip' and approval_reference ~ '[^[:space:]]' and installer_path is not null and installer_sha256 is not null
    and installer_file_size is not null and jsonb_array_length(mandatory_notices) > 0
    and installer_verification_reference is not null and notices_reference is not null
    and fl_playback_reference is not null and licensing_reference is not null
    and (signing_status = 'verified' or (signing_status = 'unsigned' and channel = 'private_beta'))));

create or replace function public.store_guard_release() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare ref_name text;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'store_record_immutable';
  end if;
  if tg_op = 'INSERT' then
    if new.artifact_kind = 'installer' and (new.status <> 'draft' or new.approved_for_distribution
      or new.approval_reference is not null or new.approved_by is not null or new.approved_at is not null) then
      raise exception using errcode = '23514', message = 'installer_requires_draft_ingestion';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - array['status','approved_for_distribution','approval_reference','approved_by','approved_at','updated_at',
      'installer_verification_reference','notices_reference','fl_playback_reference','licensing_reference'])
    is distinct from
    (to_jsonb(old) - array['status','approved_for_distribution','approval_reference','approved_by','approved_at','updated_at',
      'installer_verification_reference','notices_reference','fl_playback_reference','licensing_reference']) then
    raise exception using errcode = '23514', message = 'release_artifact_immutable';
  end if;
  if old.status = 'withdrawn' and new.status <> 'withdrawn' then
    raise exception using errcode = '23514', message = 'withdrawn_release_immutable';
  end if;
  foreach ref_name in array array['installer_verification_reference','notices_reference','fl_playback_reference','licensing_reference'] loop
    if to_jsonb(old)->>ref_name is not null and to_jsonb(new)->>ref_name is distinct from to_jsonb(old)->>ref_name then
      raise exception using errcode = '23514', message = 'release_gate_evidence_immutable';
    end if;
  end loop;
  if old.approved_for_distribution and
    (not new.approved_for_distribution or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at or new.approval_reference is distinct from old.approval_reference) then
    raise exception using errcode = '23514', message = 'release_approval_immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger store_release_artifact_immutable on public.store_releases;
create trigger store_release_artifact_immutable before insert or update or delete on public.store_releases
  for each row execute function public.store_guard_release();

create or replace function public.store_admin_release(p_actor uuid, p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_old public.store_releases; v_new public.store_releases; v_is_new boolean; v_approve boolean; ref_name text;
begin
  perform public.store_require_admin(p_actor);
  if jsonb_typeof(p_data) is distinct from 'object' or p_data - array[
    'id','product_id','version','coverage_major','platform','format','channel','artifact_kind','status','bucket','object_key',
    'file_size','sha256','release_notes','installation_notes','signing_status','approved_for_distribution','approval_reference',
    'package_format','installer_path','installer_sha256','installer_file_size','mandatory_notices',
    'installer_verification_reference','notices_reference','fl_playback_reference','licensing_reference'] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'invalid_release';
  end if;
  foreach ref_name in array array['installer_verification_reference','notices_reference','fl_playback_reference','licensing_reference'] loop
    if p_data ? ref_name and jsonb_typeof(p_data->ref_name) not in ('string','null') then
      raise exception using errcode = '22023', message = 'invalid_release';
    end if;
  end loop;
  select * into v_old from public.store_releases where id = (p_data->>'id')::uuid for update;
  v_is_new := not found;
  if v_is_new and p_data->>'id' is not null then
    raise exception using errcode = '22023', message = 'invalid_release';
  end if;
  v_approve := coalesce((p_data->>'approved_for_distribution')::boolean, v_old.approved_for_distribution, false);
  if v_is_new then
    if p_data->>'artifact_kind' = 'installer' and p_data->>'approval_reference' is not null then
      raise exception using errcode = '23514', message = 'installer_requires_draft_ingestion';
    end if;
    insert into public.store_releases(product_id, version, coverage_major, platform, format, channel, artifact_kind, status,
      bucket, object_key, file_size, sha256, release_notes, installation_notes, signing_status, created_by,
      approved_for_distribution, approval_reference, approved_by, approved_at,
      package_format, installer_path, installer_sha256, installer_file_size, mandatory_notices,
      installer_verification_reference, notices_reference, fl_playback_reference, licensing_reference)
    values (p_data->>'product_id', p_data->>'version', coalesce((p_data->>'coverage_major')::integer, 1),
      coalesce(p_data->>'platform', 'windows-x64'), coalesce(p_data->>'format', 'vst3'), coalesce(p_data->>'channel', 'private_beta'),
      p_data->>'artifact_kind', coalesce(p_data->>'status', 'draft'), coalesce(p_data->>'bucket', 'store-installers'),
      p_data->>'object_key', (p_data->>'file_size')::bigint, p_data->>'sha256', coalesce(p_data->>'release_notes', ''),
      coalesce(p_data->>'installation_notes', ''), coalesce(p_data->>'signing_status', 'not_applicable'), p_actor,
      v_approve, case when v_approve then p_data->>'approval_reference' end,
      case when v_approve then p_actor end, case when v_approve then now() end,
      coalesce(p_data->>'package_format','file'), p_data->>'installer_path', p_data->>'installer_sha256',
      (p_data->>'installer_file_size')::bigint, coalesce(p_data->'mandatory_notices','[]'::jsonb),
      p_data->>'installer_verification_reference', p_data->>'notices_reference', p_data->>'fl_playback_reference',
      p_data->>'licensing_reference') returning * into v_new;
  else
    v_new := jsonb_populate_record(v_old, p_data);
    if v_approve and not v_old.approved_for_distribution then
      v_new.approved_by := p_actor; v_new.approved_at := now();
    end if;
    update public.store_releases set product_id = v_new.product_id, version = v_new.version,
      coverage_major = v_new.coverage_major, platform = v_new.platform, format = v_new.format, channel = v_new.channel,
      artifact_kind = v_new.artifact_kind, status = v_new.status, bucket = v_new.bucket, object_key = v_new.object_key,
      file_size = v_new.file_size, sha256 = v_new.sha256, release_notes = v_new.release_notes,
      installation_notes = v_new.installation_notes, signing_status = v_new.signing_status,
      approved_for_distribution = v_new.approved_for_distribution, approval_reference = v_new.approval_reference,
      approved_by = v_new.approved_by, approved_at = v_new.approved_at,
      package_format = v_new.package_format, installer_path = v_new.installer_path,
      installer_sha256 = v_new.installer_sha256, installer_file_size = v_new.installer_file_size,
      mandatory_notices = v_new.mandatory_notices, installer_verification_reference = v_new.installer_verification_reference,
      notices_reference = v_new.notices_reference, fl_playback_reference = v_new.fl_playback_reference,
      licensing_reference = v_new.licensing_reference where id = v_old.id returning * into v_new;
  end if;
  insert into public.store_admin_audit(actor_id, action, target_id, details)
    values (p_actor, case when v_is_new then 'release_created' else 'release_updated' end, v_new.id::text,
      jsonb_build_object('status', v_new.status, 'sha256', v_new.sha256, 'installer_sha256', v_new.installer_sha256,
        'approved_for_distribution', v_new.approved_for_distribution,
        'installer_verified', v_new.installer_verification_reference is not null,
        'notices_verified', v_new.notices_reference is not null, 'fl_playback_confirmed', v_new.fl_playback_reference is not null,
        'licensing_documented', v_new.licensing_reference is not null));
  return to_jsonb(v_new);
end;
$$;

create or replace function public.store_authorize_download(p_user_id uuid, p_release_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_product_id text; v_release public.store_releases; v_grant public.store_entitlements; v_event public.store_download_events;
begin
  perform public.store_verified_email(p_user_id);
  select product_id into v_product_id from public.store_releases where id = p_release_id;
  if not found then raise exception using errcode = 'P0001', message = 'download_unavailable'; end if;
  perform 1 from public.store_products where id = v_product_id and status <> 'unavailable' for share;
  if not found then raise exception using errcode = 'P0001', message = 'download_unavailable'; end if;
  select * into v_release from public.store_releases where id = p_release_id for share;
  if not found or v_release.status <> 'published' or not public.store_release_ready(v_release) then
    raise exception using errcode = 'P0001', message = 'download_unavailable';
  end if;
  select * into v_grant from public.store_entitlements
    where user_id = p_user_id and product_id = v_release.product_id and coverage_major = v_release.coverage_major;
  if not found then raise exception using errcode = 'P0001', message = 'download_unavailable'; end if;
  insert into public.store_download_events(user_id, release_id, entitlement_id, expires_at)
    values (p_user_id, v_release.id, v_grant.id, now() + interval '60 seconds') returning * into v_event;
  return jsonb_build_object('release', to_jsonb(v_release), 'download_event_id', v_event.id,
    'bucket', v_release.bucket, 'object_key', v_release.object_key, 'ttl_seconds', 60, 'expires_at', v_event.expires_at);
end;
$$;

revoke all on function public.store_guard_release(), public.store_admin_release(uuid,jsonb),
  public.store_authorize_download(uuid,uuid) from public, anon, authenticated;
grant execute on function public.store_guard_release(), public.store_admin_release(uuid,jsonb),
  public.store_authorize_download(uuid,uuid) to service_role;

comment on column public.store_releases.sha256 is 'SHA-256 of the immutable downloadable container, distinct from its contained installer.';
comment on column public.store_releases.installer_sha256 is 'Exact sealed installer SHA-256 verified by the trusted importer; immutable after draft ingestion.';
comment on column public.store_releases.mandatory_notices is 'Immutable notice paths, SHA-256 values, and byte sizes for the same downloadable ZIP; actual bytes verified by importer.';
comment on function public.store_release_ready(public.store_releases) is 'Evidence/approval eligibility only. Download also requires published status, available product, verified account and permanent covered entitlement.';
commit;
