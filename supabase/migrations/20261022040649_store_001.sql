-- STORE-001: backend-only private beta ledger. No checkout or plugin activation.
-- All application functions are SECURITY INVOKER and executable by service_role only.
-- Apply to a dedicated store Supabase project; do not seed an administrator here.
begin;

create table public.store_products (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{0,63}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 8000),
  status text not null default 'prelaunch' check (status in ('prelaunch', 'private_beta', 'unavailable')),
  regular_price_minor integer check (regular_price_minor between 0 and 100000000),
  promotional_price_minor integer check (promotional_price_minor between 0 and 100000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  checkout_price_id text check (length(checkout_price_id) between 1 and 200),
  commerce_enabled boolean not null default false check (not commerce_enabled),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (promotional_price_minor is null or
    (regular_price_minor is not null and promotional_price_minor <= regular_price_minor))
);

create table public.store_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  bootstrap_reason text not null check (length(btrim(bootstrap_reason)) between 1 and 1000)
);

create table public.store_releases (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.store_products(id) on delete restrict,
  version text not null check (length(version) <= 100 and
    version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'),
  coverage_major integer not null default 1 check (coverage_major between 1 and 999),
  platform text not null default 'windows-x64' check (platform = 'windows-x64'),
  format text not null default 'vst3' check (format = 'vst3'),
  channel text not null default 'private_beta' check (channel in ('private_beta', 'stable')),
  artifact_kind text not null check (artifact_kind in ('test', 'installer')),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  bucket text not null default 'store-installers' check (bucket = 'store-installers'),
  object_key text not null check (length(object_key) between 1 and 500
    and object_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    and object_key !~ '(^|/)\.\.?(/|$)' and object_key !~ '//'),
  file_size bigint not null check (file_size between 1 and 2147483648),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  release_notes text not null default '' check (length(release_notes) <= 20000),
  installation_notes text not null default '' check (length(installation_notes) <= 20000),
  signing_status text not null default 'not_applicable' check (signing_status in ('not_applicable', 'unsigned', 'verified')),
  approved_for_distribution boolean not null default false,
  approval_reference text check (length(btrim(approval_reference)) between 1 and 2000),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, object_key),
  unique (product_id, version, platform, format, channel, artifact_kind),
  check (coverage_major = greatest(split_part(version, '.', 1)::numeric, 1)),
  check (position('/' || sha256 || '/' in '/' || object_key) > 0),
  check (artifact_kind <> 'test' or (object_key ~ '\.(txt|json)$' and signing_status = 'not_applicable')),
  check (artifact_kind <> 'installer' or signing_status in ('unsigned', 'verified')),
  check ((approved_for_distribution and approved_by is not null and approved_at is not null and approval_reference is not null)
    or (not approved_for_distribution and approved_by is null and approved_at is null and approval_reference is null)),
  check (status <> 'published' or (approved_for_distribution and
    (artifact_kind = 'test' or signing_status = 'verified')))
);
create index store_releases_product_status_idx on public.store_releases (product_id, status, coverage_major);
create index store_releases_created_by_idx on public.store_releases (created_by);
create index store_releases_approved_by_idx on public.store_releases (approved_by);

create table public.store_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  product_id text not null references public.store_products(id) on delete restrict,
  intended_email text check (length(intended_email) between 3 and 320 and intended_email = lower(btrim(intended_email))),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete restrict,
  check ((revoked_at is null) = (revoked_by is null)),
  check ((redeemed_at is null) = (redeemed_by is null)),
  check (revoked_at is null or redeemed_at is null)
);
create index store_invites_product_idx on public.store_invites (product_id);
create index store_invites_creator_idx on public.store_invites (created_by);
create index store_invites_redeemed_by_idx on public.store_invites (redeemed_by);
create index store_invites_revoked_by_idx on public.store_invites (revoked_by);

create table public.store_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id text not null references public.store_products(id) on delete restrict,
  source text not null default 'complimentary_beta' check (source = 'complimentary_beta'),
  source_invite_id uuid not null unique references public.store_invites(id) on delete restrict,
  coverage_major integer not null default 1 check (coverage_major = 1),
  maintenance_updates boolean not null default true check (maintenance_updates),
  computer_limit integer not null default 2 check (computer_limit = 2),
  policy_version text not null default 'complimentary-v1' check (policy_version = 'complimentary-v1'),
  granted_at timestamptz not null default now(),
  expires_at timestamptz check (expires_at is null),
  unique (user_id, product_id)
);
create index store_entitlements_product_idx on public.store_entitlements (product_id);

create table public.store_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique references public.store_invites(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  entitlement_id uuid not null unique references public.store_entitlements(id) on delete restrict,
  redeemed_at timestamptz not null default now()
);
create index store_redemptions_user_idx on public.store_redemptions (user_id);

create table public.store_download_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  release_id uuid not null references public.store_releases(id) on delete restrict,
  entitlement_id uuid not null references public.store_entitlements(id) on delete restrict,
  event_type text not null default 'link_authorized' check (event_type = 'link_authorized'),
  authorized_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > authorized_at and expires_at <= authorized_at + interval '60 seconds')
);
create index store_download_events_user_time_idx on public.store_download_events (user_id, authorized_at desc);
create index store_download_events_release_idx on public.store_download_events (release_id);
create index store_download_events_entitlement_idx on public.store_download_events (entitlement_id);

create table public.store_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('product_saved', 'invite_created', 'invite_revoked', 'release_created', 'release_updated')),
  target_id text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index store_admin_audit_actor_time_idx on public.store_admin_audit (actor_id, created_at desc);

create table public.store_rate_limits (
  key text primary key check (length(key) between 1 and 200),
  window_started_at timestamptz not null,
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index store_rate_limits_expiry_idx on public.store_rate_limits (expires_at);

-- Permanent records are append-only even when addressed by a trusted service key.
create function public.store_reject_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '23514', message = 'store_record_immutable';
end;
$$;
create trigger store_entitlements_immutable before update or delete on public.store_entitlements
  for each row execute function public.store_reject_mutation();
create trigger store_redemptions_immutable before update or delete on public.store_redemptions
  for each row execute function public.store_reject_mutation();
create trigger store_download_events_immutable before update or delete on public.store_download_events
  for each row execute function public.store_reject_mutation();
create trigger store_admin_audit_immutable before update or delete on public.store_admin_audit
  for each row execute function public.store_reject_mutation();

create function public.store_guard_release() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'store_record_immutable';
  end if;
  if (to_jsonb(new) - array['status', 'approved_for_distribution', 'approval_reference', 'approved_by', 'approved_at', 'updated_at'])
    is distinct from
    (to_jsonb(old) - array['status', 'approved_for_distribution', 'approval_reference', 'approved_by', 'approved_at', 'updated_at']) then
    raise exception using errcode = '23514', message = 'release_artifact_immutable';
  end if;
  if old.status = 'withdrawn' and new.status <> 'withdrawn' then
    raise exception using errcode = '23514', message = 'withdrawn_release_immutable';
  end if;
  if old.approved_for_distribution and
    (not new.approved_for_distribution or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at or new.approval_reference is distinct from old.approval_reference) then
    raise exception using errcode = '23514', message = 'release_approval_immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger store_release_artifact_immutable before update or delete on public.store_releases
  for each row execute function public.store_guard_release();

create function public.store_guard_invite() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'store_record_immutable';
  end if;
  if (to_jsonb(new) - array['revoked_at', 'revoked_by', 'redeemed_at', 'redeemed_by'])
    is distinct from (to_jsonb(old) - array['revoked_at', 'revoked_by', 'redeemed_at', 'redeemed_by'])
    or (old.revoked_at is not null and to_jsonb(new) is distinct from to_jsonb(old))
    or (old.redeemed_at is not null and to_jsonb(new) is distinct from to_jsonb(old)) then
    raise exception using errcode = '23514', message = 'invite_immutable';
  end if;
  return new;
end;
$$;
create trigger store_invite_immutable before update or delete on public.store_invites
  for each row execute function public.store_guard_invite();

-- The backend must first verify the bearer token through Auth getUser. It passes
-- the returned user id and the VERIFIED token's session_id; browser ids are ignored.
create function public.store_session_valid(p_user_id uuid, p_session_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = p_session_id and s.user_id = p_user_id
      and (s.not_after is null or s.not_after > now())
      and u.email_confirmed_at is not null and u.email is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  );
$$;

create function public.store_verified_email(p_user_id uuid) returns text
language plpgsql stable security invoker set search_path = '' as $$
declare v_email text;
begin
  select lower(btrim(email)) into v_email from auth.users
    where id = p_user_id and email_confirmed_at is not null and email is not null
      and deleted_at is null and (banned_until is null or banned_until <= now());
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'account_unavailable';
  end if;
  return v_email;
end;
$$;

create function public.store_require_admin(p_actor uuid) returns void
language plpgsql stable security invoker set search_path = '' as $$
begin
  perform public.store_verified_email(p_actor);
  if not exists (select 1 from public.store_admins where user_id = p_actor) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
end;
$$;

create function public.store_admin_product(p_actor uuid, p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_old public.store_products; v_new public.store_products;
begin
  perform public.store_require_admin(p_actor);
  if jsonb_typeof(p_data) is distinct from 'object' or
    p_data - array['id','name','description','status','regular_price_minor','promotional_price_minor','currency','checkout_price_id'] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'invalid_product';
  end if;
  select * into v_old from public.store_products where id = p_data->>'id' for update;
  if found then
    v_new := jsonb_populate_record(v_old, p_data);
    update public.store_products set name = v_new.name, description = v_new.description,
      status = v_new.status, regular_price_minor = v_new.regular_price_minor,
      promotional_price_minor = v_new.promotional_price_minor, currency = v_new.currency,
      checkout_price_id = v_new.checkout_price_id, updated_at = now()
      where id = v_old.id returning * into v_new;
  else
    insert into public.store_products (id, name, description, status, regular_price_minor, promotional_price_minor, currency, checkout_price_id)
      values (p_data->>'id', p_data->>'name', coalesce(p_data->>'description', ''), coalesce(p_data->>'status', 'prelaunch'),
        (p_data->>'regular_price_minor')::integer, (p_data->>'promotional_price_minor')::integer,
        coalesce(p_data->>'currency', 'USD'), nullif(p_data->>'checkout_price_id', '')) returning * into v_new;
  end if;
  insert into public.store_admin_audit(actor_id, action, target_id, details)
    values (p_actor, 'product_saved', v_new.id, jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)));
  return to_jsonb(v_new);
end;
$$;

create function public.store_create_invite(p_actor uuid, p_code_hash text, p_product_id text, p_email text, p_expires_at timestamptz) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_invite public.store_invites;
begin
  perform public.store_require_admin(p_actor);
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '366 days'
    or p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_invite';
  end if;
  perform 1 from public.store_products where id = p_product_id and status <> 'unavailable' for share;
  if not found then
    raise exception using errcode = '22023', message = 'invalid_product';
  end if;
  insert into public.store_invites (code_hash, product_id, intended_email, expires_at, created_by)
    values (p_code_hash, p_product_id, nullif(lower(btrim(p_email)), ''), p_expires_at, p_actor) returning * into v_invite;
  insert into public.store_admin_audit (actor_id, action, target_id, details)
    values (p_actor, 'invite_created', v_invite.id::text, jsonb_build_object('product_id', p_product_id, 'expires_at', p_expires_at));
  return to_jsonb(v_invite) - 'code_hash';
end;
$$;

create function public.store_revoke_invite(p_actor uuid, p_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_invite public.store_invites;
begin
  perform public.store_require_admin(p_actor);
  select * into v_invite from public.store_invites where id = p_id for update;
  if not found or v_invite.redeemed_at is not null then
    raise exception using errcode = 'P0001', message = 'invite_unavailable';
  end if;
  if v_invite.revoked_at is null then
    update public.store_invites set revoked_at = now(), revoked_by = p_actor where id = p_id returning * into v_invite;
    insert into public.store_admin_audit (actor_id, action, target_id) values (p_actor, 'invite_revoked', p_id::text);
  end if;
  return to_jsonb(v_invite) - 'code_hash';
end;
$$;

create function public.store_redeem(p_user_id uuid, p_code_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_email text; v_invite public.store_invites; v_grant public.store_entitlements;
begin
  v_email := public.store_verified_email(p_user_id);
  select * into v_invite from public.store_invites where code_hash = p_code_hash for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'invite_unavailable';
  end if;
  if v_invite.redeemed_by = p_user_id then
    select * into v_grant from public.store_entitlements where source_invite_id = v_invite.id and user_id = p_user_id;
    if not found then raise exception using errcode = 'P0001', message = 'invite_unavailable'; end if;
    return jsonb_build_object('entitlement', to_jsonb(v_grant), 'existing', true);
  end if;
  if v_invite.redeemed_at is not null or v_invite.revoked_at is not null or v_invite.expires_at <= now()
    or (v_invite.intended_email is not null and v_invite.intended_email <> v_email) then
    raise exception using errcode = 'P0001', message = 'invite_unavailable';
  end if;
  perform 1 from public.store_products where id = v_invite.product_id and status <> 'unavailable' for share;
  if not found then raise exception using errcode = 'P0001', message = 'invite_unavailable'; end if;
  insert into public.store_entitlements(user_id, product_id, source_invite_id)
    values (p_user_id, v_invite.product_id, v_invite.id)
    on conflict (user_id, product_id) do nothing returning * into v_grant;
  if not found then
    -- Another invite already granted this product. Leave this unused invite intact.
    raise exception using errcode = 'P0001', message = 'invite_unavailable';
  end if;
  update public.store_invites set redeemed_by = p_user_id, redeemed_at = now() where id = v_invite.id;
  insert into public.store_redemptions(invite_id, user_id, entitlement_id) values (v_invite.id, p_user_id, v_grant.id);
  return jsonb_build_object('entitlement', to_jsonb(v_grant), 'existing', false);
end;
$$;

create function public.store_admin_release(p_actor uuid, p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_old public.store_releases; v_new public.store_releases; v_is_new boolean; v_approve boolean;
begin
  perform public.store_require_admin(p_actor);
  if jsonb_typeof(p_data) is distinct from 'object' or p_data - array[
    'id','product_id','version','coverage_major','platform','format','channel','artifact_kind','status','bucket','object_key',
    'file_size','sha256','release_notes','installation_notes','signing_status','approved_for_distribution','approval_reference'] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'invalid_release';
  end if;
  select * into v_old from public.store_releases where id = (p_data->>'id')::uuid for update;
  v_is_new := not found;
  if v_is_new and p_data->>'id' is not null then
    raise exception using errcode = '22023', message = 'invalid_release';
  end if;
  v_approve := coalesce((p_data->>'approved_for_distribution')::boolean, v_old.approved_for_distribution, false);
  if v_is_new then
    insert into public.store_releases(product_id, version, coverage_major, platform, format, channel, artifact_kind, status,
      bucket, object_key, file_size, sha256, release_notes, installation_notes, signing_status, created_by,
      approved_for_distribution, approval_reference, approved_by, approved_at)
    values (p_data->>'product_id', p_data->>'version', coalesce((p_data->>'coverage_major')::integer, 1),
      coalesce(p_data->>'platform', 'windows-x64'), coalesce(p_data->>'format', 'vst3'), coalesce(p_data->>'channel', 'private_beta'),
      p_data->>'artifact_kind', coalesce(p_data->>'status', 'draft'), coalesce(p_data->>'bucket', 'store-installers'),
      p_data->>'object_key', (p_data->>'file_size')::bigint, p_data->>'sha256', coalesce(p_data->>'release_notes', ''),
      coalesce(p_data->>'installation_notes', ''), coalesce(p_data->>'signing_status', 'not_applicable'), p_actor,
      v_approve, case when v_approve then p_data->>'approval_reference' end,
      case when v_approve then p_actor end, case when v_approve then now() end) returning * into v_new;
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
      approved_by = v_new.approved_by, approved_at = v_new.approved_at where id = v_old.id returning * into v_new;
  end if;
  insert into public.store_admin_audit(actor_id, action, target_id, details)
    values (p_actor, case when v_is_new then 'release_created' else 'release_updated' end, v_new.id::text,
      jsonb_build_object('status', v_new.status, 'sha256', v_new.sha256, 'approved_for_distribution', v_new.approved_for_distribution));
  return to_jsonb(v_new);
end;
$$;

-- A fixed-window limiter uses a unique row per HMAC-derived key across instances.
-- Denied attempts stay bounded at limit+1. Use different key namespaces per action.
create function public.store_rate_limit(p_key text, p_limit integer, p_window_seconds integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_row public.store_rate_limits; v_now timestamptz := clock_timestamp();
begin
  if p_key is null or length(p_key) not between 1 and 200 or p_limit is null or p_limit not between 1 and 100000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit';
  end if;
  insert into public.store_rate_limits as current(key, window_started_at, hits, expires_at)
    values (p_key, v_now, 1, v_now + make_interval(secs => p_window_seconds))
    on conflict (key) do update set
      hits = case when current.expires_at <= v_now then 1 else least(current.hits + 1, p_limit + 1) end,
      window_started_at = case when current.expires_at <= v_now then v_now else current.window_started_at end,
      expires_at = case when current.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds) else current.expires_at end
    returning * into v_row;
  return jsonb_build_object('allowed', v_row.hits <= p_limit,
    'remaining', greatest(p_limit - v_row.hits, 0),
    'retry_after_seconds', greatest(1, ceil(extract(epoch from v_row.expires_at - v_now))::integer));
end;
$$;

create function public.store_authorize_download(p_user_id uuid, p_release_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_release public.store_releases; v_grant public.store_entitlements; v_event public.store_download_events;
begin
  perform public.store_verified_email(p_user_id);
  -- SHARE lock serializes publication/withdrawal with this authorization decision.
  select * into v_release from public.store_releases where id = p_release_id for share;
  if not found or v_release.status <> 'published' or not v_release.approved_for_distribution
    or (v_release.artifact_kind = 'installer' and v_release.signing_status <> 'verified') then
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

-- Explicit ACLs avoid depending on old/new Data API auto-exposure defaults.
do $$
declare item record;
begin
  for item in select tablename from pg_tables where schemaname = 'public' and tablename like 'store\_%' escape '\' loop
    execute format('alter table public.%I enable row level security', item.tablename);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', item.tablename);
    execute format('grant select on table public.%I to service_role', item.tablename);
  end loop;
  for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'store\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', item.signature);
    execute format('grant execute on function %s to service_role', item.signature);
  end loop;
end;
$$;
grant insert, update on public.store_products, public.store_releases, public.store_invites, public.store_rate_limits to service_role;
grant insert on public.store_entitlements, public.store_redemptions, public.store_download_events, public.store_admin_audit to service_role;
-- No DELETE/TRUNCATE grant, no service INSERT/UPDATE for administrator membership.
grant usage on schema auth to service_role;
grant select (id, user_id, not_after) on auth.sessions to service_role;
grant select (id, email, email_confirmed_at, deleted_at, banned_until) on auth.users to service_role;

insert into public.store_products(id, name, description, status)
  values ('nebula', 'ProjectNebula', 'Windows x64 VST3 effect. Private beta access requires an invitation.', 'private_beta');

-- No public Storage policies. Authenticated browsers cannot enumerate or fetch.
-- On a pre-existing project, refuse to silently adopt an existing public bucket.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'store-installers' and public) then
    raise exception 'store-installers already exists as a public bucket';
  end if;
end;
$$;
insert into storage.buckets(id, name, public) values ('store-installers', 'store-installers', false)
  on conflict (id) do nothing;
-- Restrictive exclusions keep a pre-existing broad permissive Storage policy
-- from accidentally exposing this bucket. They grant no access to any bucket.
create policy store_installers_no_browser_objects on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'store-installers') with check (bucket_id <> 'store-installers');
create policy store_installers_no_browser_bucket on storage.buckets as restrictive
  for all to anon, authenticated
  using (id <> 'store-installers') with check (id <> 'store-installers');

comment on table public.store_entitlements is 'Permanent complimentary v1 grant; two-computer policy is not plugin activation enforcement.';
comment on table public.store_download_events is 'Link authorization only; not proof of signing success, transfer, installation, or listening.';
comment on table public.store_admins is 'Trusted operator bootstrap only. No application role can create or edit admin memberships.';
comment on column public.store_invites.code_hash is 'HMAC-SHA256 hex verifier; raw invitation codes and server pepper are never stored.';
comment on column public.store_releases.coverage_major is 'License family, independent of a pre-release build version; v2 is ineligible for a v1 grant.';
commit;
