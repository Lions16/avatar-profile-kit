"use client";

import type { ReactNode } from "react";
import type { AvatarConfig, AvatarOwner } from "../core/types.js";
import type { AvatarRepository } from "../supabase/repository.js";
import type { AvatarStorage } from "../supabase/storage.js";
import { Avatar, type AvatarSize } from "./Avatar.js";
import { ProfileModal, type ProfileModalProps } from "./ProfileModal.js";
import { useAvatarEditor } from "./useAvatar.js";

export interface ProfileDialogProps
  extends Omit<ProfileModalProps, "title" | "children" | "onClose" | "onSave"> {
  owner: AvatarOwner;
  storage: AvatarStorage;
  repository: AvatarRepository;
  config: AvatarConfig;
  title?: string;
  initialAvatarPath?: string | null;
  avatarSize?: AvatarSize;
  /** Campos adicionales del perfil. Nunca incluyas pago, estado activo ni org_id. */
  children?: ReactNode;
  extraDirty?: boolean;
  onClose?: () => void | Promise<void>;
  onSave?: () => void | Promise<void>;
}

/** Diálogo genérico: la app decide abrirlo desde Mi perfil (internal) o desde su propio diálogo (member). */
export function ProfileDialog({
  owner,
  storage,
  repository,
  config,
  title = "Mi perfil",
  initialAvatarPath,
  avatarSize = "lg",
  children,
  extraDirty = false,
  onClose,
  onSave,
  labels,
  ...modalProps
}: ProfileDialogProps) {
  const avatar = useAvatarEditor({ owner, storage, repository, config, initialPath: initialAvatarPath });

  const handleClose = async () => {
    await avatar.discard();
    await onClose?.();
  };

  const handleSave = async () => {
    const savedAvatar = await avatar.save();
    if (!savedAvatar) return;
    await onSave?.();
  };

  return (
    <ProfileModal
      {...modalProps}
      title={title}
      labels={labels}
      dirty={avatar.dirty || extraDirty}
      saving={avatar.saving || modalProps.saving === true}
      onClose={handleClose}
      onSave={handleSave}
    >
      <div className="apk-profile__avatar">
        <Avatar
          name={owner.name}
          src={avatar.url}
          size={avatarSize}
          editable
          uploading={avatar.uploading || avatar.loading}
          error={avatar.error}
          labels={labels}
          onUpload={file => void avatar.upload(file)}
          onRemove={() => void avatar.remove()}
        />
      </div>
      {children}
    </ProfileModal>
  );
}

/** Cuenta interna (staff/admin/master genérico): se abre desde "Mi perfil". */
export function InternalProfileDialog(props: ProfileDialogProps) {
  return <ProfileDialog {...props} title={props.title ?? "Mi perfil"} />;
}

/** Perfil del rol de negocio (member): se abre desde su propio diálogo de perfil. */
export function MemberProfileDialog(props: ProfileDialogProps) {
  return <ProfileDialog {...props} title={props.title ?? "Mi perfil de colaborador"} />;
}
