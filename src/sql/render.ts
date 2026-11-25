import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AvatarConfig } from "../core/types.js";
import { assertSqlSafeConfig, qualifiedTable } from "../core/config.js";
import { avatarPathRegex } from "../core/path.js";

const TEMPLATE_FILES = [
  "001_columns.sql.tpl",
  "002_bucket_and_policies.sql.tpl",
  "003_rpc.sql.tpl",
] as const;

export type RenderedSql = Record<(typeof TEMPLATE_FILES)[number], string>;

const quoted = (identifier: string) => `"${identifier}"`;
const literalArray = (values: readonly string[]) => `array[${values.map(value => `'${value.replaceAll("'", "''")}'`).join(", ")}]::text[]`;

function assertRole(value: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Rol SQL inválido: ${value}`);
}

/** Convierte la configuración en valores seguros para sustituir en las plantillas. */
export function buildTemplateValues(config: AvatarConfig): Record<string, string> {
  assertSqlSafeConfig(config);
  for (const role of [...config.adminRoles, ...(config.masterRole ? [config.masterRole] : [])]) assertRole(role);

  const internal = config.schemas.internal;
  const member = config.schemas.member;
  const membership = config.membership;
  const link = config.memberLink;
  const prefix = config.policyPrefix;
  const ownerLayout = config.pathLayout === "owner";

  const memberOwnerExpression = config.memberOwnerIsAuthUser
    ? "auth.uid()"
    : link
      ? `(select l.${quoted(link.memberColumn)} from ${qualifiedTable(link.table, "memberLink.table")} l `
        + `where l.${quoted(link.organizationColumn)} = p_organization_id `
        + `and l.${quoted(link.userColumn)} = auth.uid() `
        + `and (${link.activeColumn ? `l.${quoted(link.activeColumn)}` : "true"}) limit 1)`
      : "null::uuid";

  const auditFunction = config.sql.auditFunction;
  const auditTriggers = auditFunction
    ? [
        `drop trigger if exists ${prefix}_internal_avatar_audit on ${qualifiedTable(internal.table, "internal.table")};`,
        `create trigger ${prefix}_internal_avatar_audit after update of ${quoted(internal.avatarColumn)} `
          + `on ${qualifiedTable(internal.table, "internal.table")} for each row execute function ${auditFunction}();`,
        `drop trigger if exists ${prefix}_member_avatar_audit on ${qualifiedTable(member.table, "member.table")};`,
        `create trigger ${prefix}_member_avatar_audit after update of ${quoted(member.avatarColumn)} `
          + `on ${qualifiedTable(member.table, "member.table")} for each row execute function ${auditFunction}();`,
      ].join("\n")
    : "";

  return {
    bucket: config.bucket,
    prefix,
    rpcName: config.rpcSetAvatarPath,
    folder: config.pathFolder,
    maxBytes: String(config.maxBytes),
    mimeTypesArray: literalArray(config.allowedMimeTypes.map(entry => entry.mime)),
    adminRolesArray: literalArray(config.adminRoles),
    masterRolesArray: config.masterRole ? literalArray([config.masterRole]) : "array[]::text[]",
    pathRegex: avatarPathRegex(config),
    ownerSegmentIndex: ownerLayout ? "2" : "3",
    kindFromPathExpression: ownerLayout ? "null::text" : `private.${prefix}_kind_from_path(name)`,
    kindMismatchCondition: ownerLayout
      ? "false"
      : `private.${prefix}_kind_from_path(p_avatar_path) is distinct from p_owner_kind`,
    internalTable: qualifiedTable(internal.table, "internal.table"),
    internalOrgColumn: quoted(internal.organizationColumn),
    internalOwnerColumn: quoted(internal.ownerColumn),
    internalAvatarColumn: quoted(internal.avatarColumn),
    internalNameColumn: quoted(internal.nameColumn),
    memberTable: qualifiedTable(member.table, "member.table"),
    memberOrgColumn: quoted(member.organizationColumn),
    memberOwnerColumn: quoted(member.ownerColumn),
    memberAvatarColumn: quoted(member.avatarColumn),
    memberNameColumn: quoted(member.nameColumn),
    membershipTable: qualifiedTable(membership.table, "membership.table"),
    membershipOrgColumn: quoted(membership.organizationColumn),
    membershipUserColumn: quoted(membership.userColumn),
    membershipRolesColumn: quoted(membership.rolesColumn),
    membershipActiveClause: membership.activeColumn ? `m.${quoted(membership.activeColumn)}` : "true",
    memberOwnerExpression,
    createPrivateSchema: config.sql.createPrivateSchema
      ? "create schema if not exists private; grant usage on schema private to authenticated;"
      : "",
    auditTriggers,
  };
}

function replacePlaceholders(template: string, values: Record<string, string>): string {
  const result = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
  const leftovers = [...result.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]);
  if (leftovers.length) throw new Error(`Placeholders sin resolver: ${leftovers.join(", ")}`);
  return result;
}

export async function renderSqlTemplates(
  config: AvatarConfig,
  sqlDir: string | URL = new URL("../../sql/", import.meta.url),
): Promise<RenderedSql> {
  const values = buildTemplateValues(config);
  const directory = typeof sqlDir === "string" ? sqlDir : fileURLToPath(sqlDir);
  const rendered = {} as RenderedSql;
  for (const file of TEMPLATE_FILES) {
    const template = await readFile(`${directory}/${file}`, "utf8");
    rendered[file] = replacePlaceholders(template, values);
  }
  return rendered;
}
