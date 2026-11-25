// Adaptador local: el núcleo vive en avatar-profile-kit (paquete reutilizable).
// Se conserva la API pública que ya usan features/avatars y features/personnel.
import {
  buildAvatarPath,
  defineAvatarConfig,
  getAvatarInitials as kitInitials,
  validateAvatarFile as kitValidate,
} from "avatar-profile-kit";

export const config = defineAvatarConfig({
  bucket: "connect-personnel",
  pathLayout: "owner",
  adminRoles: ["admin", "hr"],
  masterRole: null,
  schemas: {
    internal: {
      table: "public.platform_usernames",
      organizationColumn: "organization_id",
      ownerColumn: "auth_user_id",
      avatarColumn: "avatar_path",
      nameColumn: "display_name",
    },
    member: {
      table: "public.employee_profiles",
      organizationColumn: "organization_id",
      ownerColumn: "employee_id",
      avatarColumn: "avatar_path",
      nameColumn: "display_name",
    },
  },
  memberLink: {
    table: "public.user_employee_links",
    organizationColumn: "organization_id",
    userColumn: "user_id",
    memberColumn: "employee_id",
    activeColumn: "active",
  },
});

export const MAX_AVATAR_BYTES = config.maxBytes;
export const ALLOWED_AVATAR_TYPES = config.allowedMimeTypes.map(entry => entry.mime) as readonly string[];
export type AvatarMimeType = (typeof ALLOWED_AVATAR_TYPES)[number];

export function isAllowedAvatarType(mimeType: string): boolean {
  return ALLOWED_AVATAR_TYPES.includes(mimeType.toLowerCase());
}

export function avatarExtension(mimeType: string): string {
  return config.allowedMimeTypes.find(entry => entry.mime === mimeType.toLowerCase())?.extension ?? "jpg";
}

export function validateAvatarFile(file: File | null | undefined): string | null {
  return kitValidate(file, config);
}

export function avatarStoragePath(
  organizationId: string,
  ownerId: string,
  mimeType: string,
  uniqueId: string = crypto.randomUUID(),
): string {
  // pathLayout = "owner": el segmento de rol no se escribe en la ruta.
  return buildAvatarPath({ organizationId, kind: "internal", ownerId, mimeType, uniqueId }, config);
}

export function getAvatarInitials(name: string): string {
  return kitInitials(name);
}
