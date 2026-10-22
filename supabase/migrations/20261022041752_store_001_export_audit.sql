begin;
alter table public.store_admin_audit drop constraint store_admin_audit_action_check;
alter table public.store_admin_audit add constraint store_admin_audit_action_check
  check (action in ('product_saved', 'invite_created', 'invite_revoked', 'release_created', 'release_updated', 'export_prepared'));

-- The API calls this after preparing its authorized export and before returning
-- any records. Only row counts enter the audit; the export contents never do.
create function public.store_record_export(p_actor uuid, p_counts jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_value jsonb; v_audit public.store_admin_audit;
begin
  perform public.store_require_admin(p_actor);
  if jsonb_typeof(p_counts) is distinct from 'object'
    or not (p_counts ?& array['products','invitations','entitlements','releases','downloads','audit'])
    or p_counts - array['products','invitations','entitlements','releases','downloads','audit'] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'invalid_export_counts';
  end if;
  for v_value in select value from jsonb_each(p_counts) loop
    if jsonb_typeof(v_value) <> 'number' or v_value::text !~ '^(0|[1-9][0-9]{0,4})$' then
      raise exception using errcode = '22023', message = 'invalid_export_counts';
    end if;
    if (v_value::text)::integer > 20000 then
      raise exception using errcode = '22023', message = 'invalid_export_counts';
    end if;
  end loop;
  insert into public.store_admin_audit(actor_id,action,target_id,details)
    values(p_actor,'export_prepared','store',p_counts) returning * into v_audit;
  return to_jsonb(v_audit);
end;
$$;
revoke all on function public.store_record_export(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.store_record_export(uuid,jsonb) to service_role;
commit;
