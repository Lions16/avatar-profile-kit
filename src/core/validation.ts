import type { AvatarConfig, AvatarMime } from "./types.js";

export const DEFAULT_MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const DEFAULT_ALLOWED_MIMES: readonly AvatarMime[] = [
  { mime: "image/jpeg", extension: "jpg" },
  { mime: "image/png", extension: "png" },
  { mime: "image/webp", extension: "webp" },
];

export function isAllowedAvatarMime(mimeType: string, config?: Pick<AvatarConfig, "allowedMimeTypes">): boolean {
  const allowed = config?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIMES;
  return allowed.some(entry => entry.mime === mimeType.toLowerCase());
}

export function avatarExtension(mimeType: string, config?: Pick<AvatarConfig, "allowedMimeTypes">): string | null {
  const allowed = config?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIMES;
  return allowed.find(entry => entry.mime === mimeType.toLowerCase())?.extension ?? null;
}

/**
 * Validación de cliente. La misma información debe declararse en el bucket
 * (file_size_limit / allowed_mime_types) y en la policy de storage.
 */
const EXTENSION_LABELS: Record<string, string> = { jpg: "JPG", jpeg: "JPG", png: "PNG", webp: "WebP" };

function allowedFormats(allowed: readonly AvatarMime[]): string {
  const names = allowed.map(entry => EXTENSION_LABELS[entry.extension.toLowerCase()] ?? entry.extension.toUpperCase());
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
}

export function validateAvatarFile(
  file: Pick<File, "size" | "type"> | null | undefined,
  config?: Pick<AvatarConfig, "maxBytes" | "allowedMimeTypes">,
): string | null {
  if (!file || file.size < 1) return "Selecciona una fotografía.";

  const allowed = config?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIMES;
  const maxBytes = config?.maxBytes ?? DEFAULT_MAX_AVATAR_BYTES;
  if (file.size > maxBytes) return `La fotografía debe pesar máximo ${Math.floor(maxBytes / (1024 * 1024))} MB.`;
  if (!file.type || !isAllowedAvatarMime(file.type, config)) return `La fotografía debe ser ${allowedFormats(allowed)}.`;
  return null;
}
