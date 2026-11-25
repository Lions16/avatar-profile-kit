import type { AvatarConfig, AvatarOwner } from "../core/types.js";
import { AvatarKitError } from "../core/errors.js";
import type { AvatarSupabaseClient } from "./client.js";

/** Adaptador de la tabla de perfil. Nunca expone org_id, pago, estado activo ni roles en la UI. */
export interface AvatarRepository {
  getPath(owner: AvatarOwner): Promise<string | null>;
  /** p_avatar_path = null quita la foto. La RPC valida propiedad y forma de la ruta. */
  setPath(owner: AvatarOwner, path: string | null): Promise<void>;
}

export function createSupabaseAvatarRepository(client: AvatarSupabaseClient, config: AvatarConfig): AvatarRepository {
  const schemaFor = (owner: AvatarOwner) => config.schemas[owner.kind];

  return {
    async getPath(owner) {
      const schema = schemaFor(owner);
      const { data, error } = await client
        .from(schema.table)
        .select(schema.avatarColumn)
        .eq(schema.organizationColumn, owner.organizationId)
        .eq(schema.ownerColumn, owner.ownerId)
        .maybeSingle();
      if (error) throw new AvatarKitError("LOAD_FAILED", error.message || "No se pudo leer el avatar.", error);
      const value = (data as Record<string, unknown> | null)?.[schema.avatarColumn];
      return typeof value === "string" ? value : null;
    },

    async setPath(owner, path) {
      const { error } = await client.rpc(config.rpcSetAvatarPath, {
        p_organization_id: owner.organizationId,
        p_owner_kind: owner.kind,
        p_owner_id: owner.ownerId,
        p_avatar_path: path,
      });
      if (!error) return;

      const code = error.code === "42501" ? "FORBIDDEN" : "SAVE_FAILED";
      throw new AvatarKitError(code, error.message || "No se pudo guardar el avatar.", error);
    },
  };
}
