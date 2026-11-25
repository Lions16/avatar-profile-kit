/** Los dos dueños genéricos de un avatar. Cada proyecto decide a qué tabla corresponde cada uno. */
export type AvatarOwnerKind = "internal" | "member";

export const AVATAR_OWNER_KINDS: readonly AvatarOwnerKind[] = ["internal", "member"];

export interface AvatarMime {
  mime: string;
  extension: string;
}

export interface AvatarColumnConfig {
  /** Tabla con la columna avatar_path, con schema incluido. */
  table: string;
  organizationColumn: string;
  /** Columna que identifica al dueño (auth_user_id para internal, employee_id para member, etc.). */
  ownerColumn: string;
  avatarColumn: string;
  nameColumn: string;
}

export interface AvatarMembershipConfig {
  table: string;
  organizationColumn: string;
  userColumn: string;
  rolesColumn: string;
  activeColumn?: string | null;
}

export interface AvatarMemberLinkConfig {
  table: string;
  organizationColumn: string;
  userColumn: string;
  memberColumn: string;
  activeColumn?: string | null;
}

export interface AvatarSqlConfig {
  createPrivateSchema: boolean;
  /** Funciones auxiliares: prefijo + sufijos _is_member, _has_role, _is_master, _owner_id, _is_valid_path. */
  policyPrefix: string;
  /** Si se indica, se crean triggers de auditoría sobre las columnas avatar_path. */
  auditFunction?: string | null;
}

/** Formato de la ruta: con segmento de rol (internal|member) o solo con el dueño. */
export type AvatarPathLayout = "kind" | "owner";

export interface AvatarConfig {
  bucket: string;
  pathLayout: AvatarPathLayout;
  pathFolder: string;
  signedUrlTtlSeconds: number;
  maxBytes: number;
  allowedMimeTypes: readonly AvatarMime[];
  rpcSetAvatarPath: string;
  policyPrefix: string;
  /** Roles con lectura de cualquier avatar de su organización. */
  adminRoles: readonly string[];
  /** Rol con bypass explícito en la policy de lectura; null lo desactiva. */
  masterRole?: string | null;
  /** true cuando el id del perfil member es el propio auth.uid(). */
  memberOwnerIsAuthUser: boolean;
  schemas: {
    internal: AvatarColumnConfig;
    member: AvatarColumnConfig;
  };
  membership: AvatarMembershipConfig;
  memberLink?: AvatarMemberLinkConfig | null;
  sql: AvatarSqlConfig;
}

/** Identidad del perfil que se está editando. Nunca incluye org_id en la UI. */
export interface AvatarOwner {
  kind: AvatarOwnerKind;
  organizationId: string;
  ownerId: string;
  name: string;
}

export interface AvatarPathParts {
  organizationId: string;
  /** null cuando la ruta no incluye el segmento de rol (pathLayout = "owner"). */
  kind: AvatarOwnerKind | null;
  ownerId: string;
  fileName: string;
}
