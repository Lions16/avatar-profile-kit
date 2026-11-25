"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarConfig, AvatarOwner } from "../core/types.js";
import { errorMessage } from "../core/errors.js";
import { buildAvatarPath, validateAvatarFile } from "../core/index.js";
import type { AvatarRepository } from "../supabase/repository.js";
import type { AvatarStorage } from "../supabase/storage.js";

export interface UseAvatarEditorOptions {
  owner: AvatarOwner;
  storage: AvatarStorage;
  repository: AvatarRepository;
  config: AvatarConfig;
  /** Si se omite, se carga desde el repositorio al montar. */
  initialPath?: string | null;
}

export interface AvatarEditorController {
  path: string | null;
  url: string | null;
  loading: boolean;
  uploading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
  upload(file: File): Promise<boolean>;
  remove(): Promise<void>;
  save(): Promise<boolean>;
  discard(): Promise<void>;
  reload(): Promise<void>;
}

export function useAvatarEditor(options: UseAvatarEditorOptions): AvatarEditorController {
  const { owner, initialPath } = options;
  const storageRef = useRef(options.storage);
  const repositoryRef = useRef(options.repository);
  const configRef = useRef(options.config);
  const ownerRef = useRef(owner);
  storageRef.current = options.storage;
  repositoryRef.current = options.repository;
  configRef.current = options.config;
  ownerRef.current = owner;

  const [persistedPath, setPersistedPath] = useState<string | null>(initialPath ?? null);
  const [path, setPath] = useState<string | null>(initialPath ?? null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialPath === undefined);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await repositoryRef.current.getPath(ownerRef.current);
      if (!mountedRef.current) return;
      setPersistedPath(next);
      setPath(next);
      setError(null);
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause, "No se pudo leer el avatar."));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialPath !== undefined) return;
    setPath(null);
    setPersistedPath(null);
    setUrl(null);
    void reload();
  }, [initialPath, reload, owner.organizationId, owner.kind, owner.ownerId]);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!path) return () => { cancelled = true; };
    void storageRef.current
      .sign(path, configRef.current.signedUrlTtlSeconds)
      .then(signed => {
        if (!cancelled && mountedRef.current) setUrl(signed);
      })
      .catch(cause => {
        if (!cancelled && mountedRef.current) setError(errorMessage(cause, "No se pudo abrir la fotografía."));
      });
    return () => { cancelled = true; };
  }, [path]);

  // Las URL firmadas caducan: se renuevan antes de que venza el TTL configurado.
  useEffect(() => {
    if (!path) return;
    const intervalMs = Math.max(30_000, configRef.current.signedUrlTtlSeconds * 800);
    const timer = window.setInterval(() => {
      void storageRef.current
        .sign(path, configRef.current.signedUrlTtlSeconds)
        .then(signed => {
          if (mountedRef.current) setUrl(signed);
        })
        .catch(() => undefined);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [path]);

  const upload = useCallback(async (file: File) => {
    const validation = validateAvatarFile(file, configRef.current);
    if (validation) {
      setError(validation);
      return false;
    }
    setUploading(true);
    setError(null);
    try {
      const next = buildAvatarPath(
        {
          organizationId: ownerRef.current.organizationId,
          kind: ownerRef.current.kind,
          ownerId: ownerRef.current.ownerId,
          mimeType: file.type,
        },
        configRef.current,
      );
      await storageRef.current.upload(next, file);
      uploadedRef.current.add(next);
      setPath(next);
      return true;
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause, "No se pudo subir la fotografía."));
      return false;
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }, []);

  const remove = useCallback(async () => {
    setError(null);
    const previous = path;
    if (previous && uploadedRef.current.has(previous)) {
      uploadedRef.current.delete(previous);
      try {
        await storageRef.current.remove(previous);
      } catch (cause) {
        if (mountedRef.current) setError(errorMessage(cause, "No se pudo quitar la fotografía."));
      }
    }
    if (mountedRef.current) setPath(null);
  }, [path]);

  const save = useCallback(async () => {
    if (path === persistedPath) return true;
    setSaving(true);
    setError(null);
    try {
      await repositoryRef.current.setPath(ownerRef.current, path);
      const previous = persistedPath;
      if (previous && previous !== path) {
        await storageRef.current.remove(previous).catch(() => undefined);
      }
      uploadedRef.current.clear();
      if (mountedRef.current) setPersistedPath(path);
      return true;
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause, "No se pudo guardar el avatar."));
      return false;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [path, persistedPath]);

  const discard = useCallback(async () => {
    for (const uploaded of uploadedRef.current) {
      await storageRef.current.remove(uploaded).catch(() => undefined);
    }
    uploadedRef.current.clear();
    if (mountedRef.current) {
      setPath(persistedPath);
      setError(null);
    }
  }, [persistedPath]);

  return {
    path,
    url,
    loading,
    uploading,
    saving,
    dirty: path !== persistedPath,
    error,
    upload,
    remove,
    save,
    discard,
    reload,
  };
}
