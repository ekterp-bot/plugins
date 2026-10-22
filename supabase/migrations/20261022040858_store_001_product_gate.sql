-- Availability and release withdrawal are checked under row locks when issuing
-- a new link. Neither operation changes permanent complimentary ownership.
begin;
create or replace function public.store_authorize_download(p_user_id uuid, p_release_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_product_id text; v_release public.store_releases; v_grant public.store_entitlements; v_event public.store_download_events;
begin
  perform public.store_verified_email(p_user_id);
  -- The product id is immutable. Discover it first, then consistently lock the
  -- product before the release so edits cannot race the availability decision.
  select product_id into v_product_id from public.store_releases where id = p_release_id;
  if not found then raise exception using errcode = 'P0001', message = 'download_unavailable'; end if;
  perform 1 from public.store_products where id = v_product_id and status <> 'unavailable' for share;
  if not found then raise exception using errcode = 'P0001', message = 'download_unavailable'; end if;
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
revoke all on function public.store_authorize_download(uuid,uuid) from public, anon, authenticated;
grant execute on function public.store_authorize_download(uuid,uuid) to service_role;
commit;
