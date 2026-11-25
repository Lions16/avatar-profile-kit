-- avatar-profile-kit / 003: única escritura de avatar_path, con validación de propiedad.
begin;

create or replace function public.{{rpcName}}(
  p_organization_id uuid,
  p_owner_kind text,
  p_owner_id uuid,
  p_avatar_path text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_owner_kind not in ('internal', 'member') then
    raise exception 'Tipo de perfil inválido' using errcode = '22023';
  end if;
  if not private.{{prefix}}_is_member(p_organization_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not (
    private.{{prefix}}_owner_id(p_organization_id, p_owner_kind) = p_owner_id
    or private.{{prefix}}_has_role(p_organization_id, {{adminRolesArray}})
    or private.{{prefix}}_is_master(p_organization_id)
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_avatar_path is not null and (
    not private.{{prefix}}_is_valid_path(p_avatar_path)
    or private.{{prefix}}_org_from_path(p_avatar_path) is distinct from p_organization_id
    or {{kindMismatchCondition}}
    or private.{{prefix}}_owner_from_path(p_avatar_path) is distinct from p_owner_id
  ) then
    raise exception 'Ruta de avatar inválida' using errcode = '22023';
  end if;

  if p_owner_kind = 'internal' then
    update {{internalTable}}
    set {{internalAvatarColumn}} = p_avatar_path
    where {{internalOrgColumn}} = p_organization_id and {{internalOwnerColumn}} = p_owner_id;
  else
    update {{memberTable}}
    set {{memberAvatarColumn}} = p_avatar_path
    where {{memberOrgColumn}} = p_organization_id and {{memberOwnerColumn}} = p_owner_id;
  end if;

  if not found then
    raise exception 'Perfil no disponible' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.{{rpcName}}(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.{{rpcName}}(uuid, text, uuid, text) to authenticated;

commit;
