import type { AvatarConfig } from "../core/types.js";
import { AvatarKitError } from "../core/errors.js";
import type { AvatarSupabaseClient } from "./client.js";

/** Adaptador de storage: el único sitio que conoce el bucket privado. */
export interface AvatarStorage {
  upload(path: string, file: File): Promise<void>;
  remove(path: string): Promise<void>;
  sign(path: string, ttlSeconds: number): Promise<string | null>;
}

export function createSupabaseAvatarStorage(client: AvatarSupabaseClient, config: AvatarConfig): AvatarStorage {
  const bucket = () => client.storage.from(config.bucket);

  return {
    async upload(path, file) {
      const { error } = await bucket().upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw new AvatarKitError("UPLOAD_FAILED", error.message || "No se pudo subir la fotografía.", error);
    },

    async remove(path) {
      const { error } = await bucket().remove([path]);
      if (error) throw new AvatarKitError("REMOVE_FAILED", error.message || "No se pudo quitar la fotografía.", error);
    },

    async sign(path, ttlSeconds) {
      const { data, error } = await bucket().createSignedUrl(path, ttlSeconds);
      if (error) throw new AvatarKitError("SIGN_FAILED", error.message || "No se pudo abrir la fotografía.", error);
      return data?.signedUrl ?? null;
    },
  };
}
