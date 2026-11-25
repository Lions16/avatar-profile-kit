-- avatar-profile-kit / 002: bucket privado, helpers de propiedad y policies por carpeta.
begin;

{{createPrivateSchema}}

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('{{bucket}}', '{{bucket}}', false, {{maxBytes}}, {{mimeTypesArray}})
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.{{prefix}}_is_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from {{membershipTable}} m
    where m.{{membershipOrgColumn}} = p_organization_id
      and m.{{membershipUserColumn}} = auth.uid()
      and ({{membershipActiveClause}})
  );
$$;

create or replace function private.{{prefix}}_has_role(p_organization_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from {{membershipTable}} m
    where m.{{membershipOrgColumn}} = p_organization_id
      and m.{{membershipUserColumn}} = auth.uid()
      and m.{{membershipRolesColumn}} && p_roles
      and ({{membershipActiveClause}})
  );
$$;

create or replace function private.{{prefix}}_is_master(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select {{masterRolesArray}} <> array[]::text[]
    and private.{{prefix}}_has_role(p_organization_id, {{masterRolesArray}});
$$;

create or replace function private.{{prefix}}_owner_id(p_organization_id uuid, p_owner_kind text)
returns uuid language sql stable security definer set search_path = '' as $$
  select case p_owner_kind
    when 'internal' then (
      select i.{{internalOwnerColumn}} from {{internalTable}} i
      where i.{{internalOrgColumn}} = p_organization_id
        and i.{{internalOwnerColumn}} = auth.uid()
      limit 1
    )
    when 'member' then {{memberOwnerExpression}}
    else null::uuid
  end;
$$;

create or replace function private.{{prefix}}_is_valid_path(p_path text)
returns boolean language sql immutable as $$
  select coalesce(p_path ~ '{{pathRegex}}', false);
$$;

create or replace function private.{{prefix}}_org_from_path(p_path text)
returns uuid language sql immutable as $$
  select case when private.{{prefix}}_is_valid_path(p_path) then split_part(p_path, '/', 1)::uuid else null::uuid end;
$$;

create or replace function private.{{prefix}}_kind_from_path(p_path text)
returns text language sql immutable as $$
  select case when private.{{prefix}}_is_valid_path(p_path) then split_part(p_path, '/', 2) else null end;
$$;

create or replace function private.{{prefix}}_owner_from_path(p_path text)
returns uuid language sql immutable as $$
  select case when private.{{prefix}}_is_valid_path(p_path) then split_part(p_path, '/', {{ownerSegmentIndex}})::uuid else null::uuid end;
$$;

create or replace function private.{{prefix}}_can_edit(p_organization_id uuid, p_owner_kind text, p_owner_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.{{prefix}}_is_member(p_organization_id)
    and (
      (
        p_owner_kind is null and (
          private.{{prefix}}_owner_id(p_organization_id, 'internal') = p_owner_id
          or private.{{prefix}}_owner_id(p_organization_id, 'member') = p_owner_id
        )
      )
      or private.{{prefix}}_owner_id(p_organization_id, p_owner_kind) = p_owner_id
      or private.{{prefix}}_has_role(p_organization_id, {{adminRolesArray}})
      or private.{{prefix}}_is_master(p_organization_id)
    );
$$;

revoke all on function private.{{prefix}}_is_member(uuid) from public, anon, authenticated;
revoke all on function private.{{prefix}}_has_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.{{prefix}}_is_master(uuid) from public, anon, authenticated;
revoke all on function private.{{prefix}}_owner_id(uuid, text) from public, anon, authenticated;
revoke all on function private.{{prefix}}_is_valid_path(text) from public, anon, authenticated;
revoke all on function private.{{prefix}}_org_from_path(text) from public, anon, authenticated;
revoke all on function private.{{prefix}}_kind_from_path(text) from public, anon, authenticated;
revoke all on function private.{{prefix}}_owner_from_path(text) from public, anon, authenticated;
revoke all on function private.{{prefix}}_can_edit(uuid, text, uuid) from public, anon, authenticated;

grant execute on function private.{{prefix}}_is_member(uuid) to authenticated;
grant execute on function private.{{prefix}}_has_role(uuid, text[]) to authenticated;
grant execute on function private.{{prefix}}_is_master(uuid) to authenticated;
grant execute on function private.{{prefix}}_owner_id(uuid, text) to authenticated;
grant execute on function private.{{prefix}}_is_valid_path(text) to authenticated;
grant execute on function private.{{prefix}}_org_from_path(text) to authenticated;
grant execute on function private.{{prefix}}_kind_from_path(text) to authenticated;
grant execute on function private.{{prefix}}_owner_from_path(text) to authenticated;
grant execute on function private.{{prefix}}_can_edit(uuid, text, uuid) to authenticated;

drop policy if exists {{prefix}}_storage_read on storage.objects;
create policy {{prefix}}_storage_read on storage.objects for select to authenticated
using (
  bucket_id = '{{bucket}}'
  and private.{{prefix}}_is_valid_path(name)
  and private.{{prefix}}_is_member(private.{{prefix}}_org_from_path(name))
  and (
    private.{{prefix}}_can_edit(
      private.{{prefix}}_org_from_path(name),
      {{kindFromPathExpression}},
      private.{{prefix}}_owner_from_path(name)
    )
    or private.{{prefix}}_is_master(private.{{prefix}}_org_from_path(name)) -- bypass explícito de lectura
  )
);

drop policy if exists {{prefix}}_storage_insert on storage.objects;
create policy {{prefix}}_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = '{{bucket}}'
  and private.{{prefix}}_is_valid_path(name)
  and private.{{prefix}}_can_edit(
    private.{{prefix}}_org_from_path(name),
    {{kindFromPathExpression}},
    private.{{prefix}}_owner_from_path(name)
  )
);

drop policy if exists {{prefix}}_storage_update on storage.objects;
create policy {{prefix}}_storage_update on storage.objects for update to authenticated
using (
  bucket_id = '{{bucket}}'
  and private.{{prefix}}_can_edit(
    private.{{prefix}}_org_from_path(name),
    {{kindFromPathExpression}},
    private.{{prefix}}_owner_from_path(name)
  )
)
with check (
  bucket_id = '{{bucket}}'
  and private.{{prefix}}_is_valid_path(name)
  and private.{{prefix}}_can_edit(
    private.{{prefix}}_org_from_path(name),
    {{kindFromPathExpression}},
    private.{{prefix}}_owner_from_path(name)
  )
);

drop policy if exists {{prefix}}_storage_delete on storage.objects;
create policy {{prefix}}_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = '{{bucket}}'
  and private.{{prefix}}_can_edit(
    private.{{prefix}}_org_from_path(name),
    {{kindFromPathExpression}},
    private.{{prefix}}_owner_from_path(name)
  )
);

commit;
