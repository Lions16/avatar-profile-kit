"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { getAvatarInitials } from "../core/path.js";
import { mergeLabels, type ProfileModalLabels } from "./labels.js";

export type AvatarSize = "sm" | "md" | "lg";

export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

export interface AvatarProps {
  name: string;
  /** Ruta privada del avatar; se resuelve con resolveUrl cuando no se pasa src. */
  path?: string | null;
  /** URL ya firmada. Tiene prioridad sobre path (null fuerza las iniciales). */
  src?: string | null;
  resolveUrl?: (path: string) => Promise<string | null>;
  size?: AvatarSize;
  /** Configura el selector de archivo cuando el proyecto usa MIME types personalizados. */
  accept?: string;
  editable?: boolean;
  uploading?: boolean;
  error?: string | null;
  labels?: Partial<ProfileModalLabels>;
  onUpload?: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}

function useResolvedSrc(path: string | null | undefined, src: string | null | undefined, resolveUrl?: (path: string) => Promise<string | null>) {
  const [resolved, setResolved] = useState<string | null>(null);
  const resolverRef = useRef(resolveUrl);
  resolverRef.current = resolveUrl;

  useEffect(() => {
    let cancelled = false;
    if (src !== undefined) {
      setResolved(src);
      return () => { cancelled = true; };
    }
    if (!path || !resolverRef.current) {
      setResolved(null);
      return () => { cancelled = true; };
    }
    void resolverRef.current(path)
      .then(url => { if (!cancelled) setResolved(url); })
      .catch(() => { if (!cancelled) setResolved(null); });
    return () => { cancelled = true; };
  }, [path, src]);

  return src !== undefined ? src : resolved;
}

/** Avatar con iniciales como fallback. Sin dependencias de Supabase: la URL firmada la inyecta el llamador. */
export function Avatar({
  name,
  path = null,
  src,
  resolveUrl,
  size = "md",
  accept = AVATAR_ACCEPT,
  editable = false,
  uploading = false,
  error = null,
  labels,
  onUpload,
  onRemove,
}: AvatarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resolvedSrc = useResolvedSrc(path, src, resolveUrl);
  const copy = mergeLabels(labels);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && onUpload) void onUpload(file);
  };

  return (
    <div className={`apk-avatar apk-avatar--${size}`}>
      <span className="apk-avatar__frame">
        {resolvedSrc ? (
          <img className="apk-avatar__image" src={resolvedSrc} alt={`${copy.photoAlt} de ${name}`} />
        ) : (
          <span className="apk-avatar__initials" aria-hidden="true">{getAvatarInitials(name)}</span>
        )}
      </span>
      {editable ? (
        <>
          <button
            type="button"
            className="apk-avatar__action apk-avatar__action--edit"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={copy.changePhoto}
            title={copy.changePhoto}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
          {onRemove ? (
            <button
              type="button"
              className="apk-avatar__action apk-avatar__action--remove"
              onClick={() => void onRemove()}
              disabled={uploading}
              aria-label={copy.removePhoto}
              title={copy.removePhoto}
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            className="apk-avatar__file"
            accept={accept}
            onChange={handleChange}
            disabled={uploading}
            aria-label={copy.changePhoto}
          />
        </>
      ) : null}
      {uploading ? <span className="apk-avatar__busy" role="status">…</span> : null}
      {error ? <p className="apk-avatar__error" role="alert">{error}</p> : null}
    </div>
  );
}
