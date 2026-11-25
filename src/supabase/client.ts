import type { SupabaseClient } from "@supabase/supabase-js";

/** Acepta cualquier tipado de esquema generado por el proyecto consumidor. */
export type AvatarSupabaseClient = SupabaseClient<any, any, any>;
