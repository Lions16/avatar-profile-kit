import type { AvatarConfig, AvatarOwnerKind, AvatarPathParts } from "./types.js";
import { DEFAULT_ALLOWED_MIMES } from "./validation.js";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const SAFE_FOLDER = /^[a-z0-9][a-z0-9_-]{0,39}$/;
type PathConfig = Pick<AvatarConfig, "pathLayout" | "pathFolder" | "allowedMimeTypes">;

export interface BuildAvatarPathInput {
  organizationId: string;
  kind: AvatarOwnerKind;
  ownerId: string;
  mimeType: string;
  uniqueId?: string;
}

/**
 * pathLayout = "kind":  <org>/<kind>/<owner>/<folder>/<uuid>.<ext>
 * pathLayout = "owner": <org>/<owner>/<folder>/<uuid>.<ext>
 */
export function buildAvatarPath(input: BuildAvatarPathInput, config?: Pick<PathConfig, "pathLayout" | "pathFolder" | "allowedMimeTypes">): string {
  for (const [label, value] of [
    ["organizationId", input.organizationId],
    ["ownerId", input.ownerId],
  ] as const) {
    if (!new RegExp(`^${UUID}$`).test(value)) throw new Error(`${label} debe ser un UUID válido.`);
  }

  const folder = config?.pathFolder ?? "avatar";
  if (!SAFE_FOLDER.test(folder)) throw new Error("Nombre de carpeta de avatar inválido.");

  const allowed = config?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIMES;
  const extension = allowed.find(entry => entry.mime === input.mimeType.toLowerCase())?.extension;
  if (!extension) throw new Error("Tipo de avatar no permitido.");

  const uniqueId = input.uniqueId ?? globalThis.crypto?.randomUUID?.();
  if (!uniqueId) throw new Error("No se pudo generar el identificador del archivo.");
  if (!new RegExp(`^${UUID}$`).test(uniqueId)) throw new Error("uniqueId debe ser un UUID válido.");

  const tail = `${folder}/${uniqueId}.${extension}`;
  return config?.pathLayout === "owner"
    ? `${input.organizationId}/${input.ownerId}/${tail}`
    : `${input.organizationId}/${input.kind}/${input.ownerId}/${tail}`;
}

export function parseAvatarPath(path: string): AvatarPathParts | null {
  const withKind = new RegExp(`^(${UUID})/(internal|member)/(${UUID})/([a-z0-9][a-z0-9_-]{0,39})/(${UUID})\\.([a-z0-9]+)$`);
  const ownerOnly = new RegExp(`^(${UUID})/(${UUID})/([a-z0-9][a-z0-9_-]{0,39})/(${UUID})\\.([a-z0-9]+)$`);

  const kindMatch = withKind.exec(path);
  if (kindMatch) {
    return {
      organizationId: kindMatch[1]!,
      kind: kindMatch[2] as AvatarOwnerKind,
      ownerId: kindMatch[3]!,
      fileName: `${kindMatch[5]!}.${kindMatch[6]!}`,
    };
  }

  const ownerMatch = ownerOnly.exec(path);
  if (ownerMatch) {
    return {
      organizationId: ownerMatch[1]!,
      kind: null,
      ownerId: ownerMatch[2]!,
      fileName: `${ownerMatch[4]!}.${ownerMatch[5]!}`,
    };
  }
  return null;
}

export function isAvatarPath(path: string | null | undefined, config?: PathConfig): boolean {
  if (!path) return false;
  const parts = parseAvatarPath(path);
  if (!parts) return false;

  const layout = config?.pathLayout ?? "kind";
  if (layout === "kind" && parts.kind === null) return false;
  if (layout === "owner" && parts.kind !== null) return false;

  const folder = config?.pathFolder ?? "avatar";
  const pathFolder = layout === "owner" ? path.split("/")[2] : path.split("/")[3];
  if (pathFolder !== folder) return false;

  const allowed = config?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIMES;
  return allowed.some(entry => parts.fileName.endsWith(`.${entry.extension}`));
}

/** Expresión regular usada por la policy de storage. Depende de la configuración. */
export function avatarPathRegex(config?: PathConfig): string {
  const folder = config?.pathFolder ?? "avatar";
  if (!SAFE_FOLDER.test(folder)) throw new Error("Nombre de carpeta de avatar inválido.");
  const allowed = config?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIMES;
  const extensions = allowed.map(entry => entry.extension).join("|");
  const base = config?.pathLayout === "owner" ? `^${UUID}/${UUID}` : `^${UUID}/(internal|member)/${UUID}`;
  return `${base}/${folder}/${UUID}\\.(${extensions})$`;
}

export function getAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map(part => Array.from(part)[0]?.toUpperCase() ?? "");
  if (letters[0] && letters[1]) return `${letters[0]}${letters[1]}`;
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}
