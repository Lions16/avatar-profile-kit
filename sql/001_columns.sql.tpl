-- avatar-profile-kit / 001: columnas avatar_path.
-- Generado desde avatar-profile.config.json. No editar el SQL: edita la config y vuelve a renderizar.
begin;

alter table {{internalTable}} add column if not exists {{internalAvatarColumn}} text;
alter table {{memberTable}} add column if not exists {{memberAvatarColumn}} text;

create index if not exists {{prefix}}_internal_lookup_idx
  on {{internalTable}} ({{internalOrgColumn}}, {{internalOwnerColumn}});
create index if not exists {{prefix}}_member_lookup_idx
  on {{memberTable}} ({{memberOrgColumn}}, {{memberOwnerColumn}});

{{auditTriggers}}

commit;
