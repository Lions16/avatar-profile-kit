import type { AvatarColumnConfig, AvatarConfig, AvatarMime, AvatarSqlConfig } from "./types.js";
import { DEFAULT_ALLOWED_MIMES, DEFAULT_MAX_AVATAR_BYTES } from "./validation.js";
import { avatarPathRegex } from "./path.js";

export const DEFAULT_CONFIG: AvatarConfig = {
  bucket: "connect-avatars",
  pathLayout: "kind",
  pathFolder: "avatar",
  signedUrlTtlSeconds: 300,
  maxBytes: DEFAULT_MAX_AVATAR_BYTES,
  allowedMimeTypes: DEFAULT_ALLOWED_MIMES,
  rpcSetAvatarPath: "apk_set_avatar_path",
  policyPrefix: "apk_avatar",
  adminRoles: ["admin"],
  masterRole: null,
  memberOwnerIsAuthUser: false,
  schemas: {
    internal: {
      table: "public.profiles",
      organizationColumn: "organization_id",
      ownerColumn: "user_id",
      avatarColumn: "avatar_path",
      nameColumn: "display_name",
    },
    member: {
      table: "public.members",
      organizationColumn: "organization_id",
      ownerColumn: "user_id",
      avatarColumn: "avatar_path",
      nameColumn: "display_name",
    },
  },
  membership: {
    table: "public.memberships",
    organizationColumn: "organization_id",
    userColumn: "user_id",
    rolesColumn: "roles",
    activeColumn: "active",
  },
  memberLink: null,
  sql: {
    createPrivateSchema: true,
    policyPrefix: "apk_avatar",
    auditFunction: null,
  },
};

export interface AvatarConfigInput
  extends Partial<Omit<AvatarConfig, "schemas" | "membership" | "memberLink" | "sql" | "allowedMimeTypes">> {
  allowedMimeTypes?: readonly AvatarMime[];
  schemas?: {
    internal?: Partial<AvatarColumnConfig>;
    member?: Partial<AvatarColumnConfig>;
  };
  membership?: Partial<AvatarConfig["membership"]>;
  memberLink?: AvatarConfig["memberLink"];
  sql?: Partial<AvatarSqlConfig>;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} no es un identificador SQL seguro: ${value}`);
}

/** Devuelve "schema"."tabla" después de validar cada parte. */
export function qualifiedTable(table: string, label: string): string {
  const parts = table.split(".");
  if (parts.length !== 2) throw new Error(`${label} debe tener la forma schema.tabla: ${table}`);
  const [schema, name] = parts as [string, string];
  assertIdentifier(schema, `${label}.schema`);
  assertIdentifier(name, `${label}.table`);
  return `"${schema}"."${name}"`;
}

function assertStringList(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item)) {
    throw new Error(`${label} debe ser una lista de textos no vacíos.`);
  }
}

function assertConfigShape(input: AvatarConfigInput): void {
  if (input.allowedMimeTypes !== undefined) {
    if (!Array.isArray(input.allowedMimeTypes)) throw new Error("allowedMimeTypes debe ser una lista.");
    assertStringList(input.allowedMimeTypes.map(entry => entry?.mime), "allowedMimeTypes[].mime");
    assertStringList(input.allowedMimeTypes.map(entry => entry?.extension), "allowedMimeTypes[].extension");
    if (!input.allowedMimeTypes.length) throw new Error("allowedMimeTypes no puede estar vacío.");
  }
  if (input.adminRoles !== undefined) assertStringList(input.adminRoles, "adminRoles");
  for (const key of ["schemas", "membership", "sql"] as const) {
    const value = input[key];
    if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) {
      throw new Error(`${key} debe ser un objeto.`);
    }
  }
}

export function defineAvatarConfig(input: AvatarConfigInput = {}): AvatarConfig {
  assertConfigShape(input);
  const schemas = {
    internal: { ...DEFAULT_CONFIG.schemas.internal, ...input.schemas?.internal },
    member: { ...DEFAULT_CONFIG.schemas.member, ...input.schemas?.member },
  };
  const config: AvatarConfig = {
    ...DEFAULT_CONFIG,
    ...input,
    schemas,
    membership: { ...DEFAULT_CONFIG.membership, ...input.membership },
    memberLink: input.memberLink === undefined ? DEFAULT_CONFIG.memberLink : input.memberLink,
    sql: {
      ...DEFAULT_CONFIG.sql,
      ...input.sql,
      policyPrefix: input.sql?.policyPrefix ?? input.policyPrefix ?? DEFAULT_CONFIG.policyPrefix,
    },
  };

  assertSqlSafeConfig(config);
  return config;
}

export function assertSqlSafeConfig(config: AvatarConfig): void {
  if (!/^[a-z][a-z0-9_-]{1,62}$/.test(config.bucket)) throw new Error("Nombre de bucket inválido.");
  if (config.pathLayout !== "kind" && config.pathLayout !== "owner") throw new Error("pathLayout debe ser 'kind' u 'owner'.");
  if (!/^[a-z][a-z0-9_-]{0,39}$/.test(config.policyPrefix)) throw new Error("Prefijo SQL inválido.");
  if (!/^[a-z][a-z0-9_]*$/.test(config.rpcSetAvatarPath)) throw new Error("Nombre de RPC inválido.");
  if (config.maxBytes < 1 || config.signedUrlTtlSeconds < 30) throw new Error("Límites de avatar inválidos.");
  if (!config.adminRoles.length) throw new Error("Debe definir al menos un rol administrador.");

  if (!config.allowedMimeTypes.length) throw new Error("Debe definir al menos un tipo MIME.");
  const mimes = config.allowedMimeTypes.map(entry => entry.mime.toLowerCase());
  const extensions = config.allowedMimeTypes.map(entry => entry.extension.toLowerCase());
  if (new Set(mimes).size !== mimes.length || new Set(extensions).size !== extensions.length) {
    throw new Error("Los tipos MIME y sus extensiones no pueden repetirse.");
  }
  for (const entry of config.allowedMimeTypes) {
    if (!/^[a-z]+\/[a-z0-9.+-]+$/.test(entry.mime.toLowerCase())) throw new Error(`MIME inválido: ${entry.mime}`);
    if (!/^[a-z0-9]{1,10}$/.test(entry.extension.toLowerCase())) throw new Error(`Extensión inválida: ${entry.extension}`);
  }

  qualifiedTable(config.schemas.internal.table, "internal.table");
  qualifiedTable(config.schemas.member.table, "member.table");
  qualifiedTable(config.membership.table, "membership.table");
  if (config.memberLink) qualifiedTable(config.memberLink.table, "memberLink.table");
  if (config.sql.auditFunction) {
    const parts = config.sql.auditFunction.split(".");
    if (parts.length !== 2) throw new Error("auditFunction debe tener la forma schema.funcion.");
    parts.forEach(part => assertIdentifier(part, "auditFunction"));
  }

  for (const column of [
    config.schemas.internal.organizationColumn,
    config.schemas.internal.ownerColumn,
    config.schemas.internal.avatarColumn,
    config.schemas.internal.nameColumn,
    config.schemas.member.organizationColumn,
    config.schemas.member.ownerColumn,
    config.schemas.member.avatarColumn,
    config.schemas.member.nameColumn,
    config.membership.organizationColumn,
    config.membership.userColumn,
    config.membership.rolesColumn,
  ]) assertIdentifier(column, "columna");
  if (config.membership.activeColumn) assertIdentifier(config.membership.activeColumn, "membership.activeColumn");
  if (config.memberLink) {
    for (const column of [
      config.memberLink.organizationColumn,
      config.memberLink.userColumn,
      config.memberLink.memberColumn,
    ]) assertIdentifier(column, "columna de vínculo");
    if (config.memberLink.activeColumn) assertIdentifier(config.memberLink.activeColumn, "memberLink.activeColumn");
  }

  avatarPathRegex(config);
}

export function configFromJson(value: unknown): AvatarConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("La configuración debe ser un objeto JSON.");
  return defineAvatarConfig(value as AvatarConfigInput);
}
