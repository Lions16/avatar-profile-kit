"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAvatar } from "../actions";
import { Avatar, ProfileModal as KitProfileModal, type AvatarSize } from "avatar-profile-kit/react";
import type { FormState } from "@/lib/form-state";

export type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  title: string;
  subtitle?: string;
  name: string;
  code?: string | null;
  avatarSrc?: string | null;
  size?: AvatarSize;
  onLogout?: () => void | Promise<void>;
  onSaved?: () => void;
};

/** Modal del repo construido sobre el modal reutilizable del paquete. */
export function ProfileModal({
  open,
  onClose,
  organizationId,
  title,
  subtitle,
  name,
  code,
  avatarSrc,
  size = "lg",
  onLogout,
  onSaved,
}: ProfileModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = file !== null || removing;

  const handleSave = async () => {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    if (removing) formData.set("intent", "remove");
    else if (file) formData.set("photo", file);

    setSaving(true);
    setError(null);
    let result: FormState;
    try {
      result = await saveAvatar({}, formData);
    } catch {
      result = { error: "No se pudo guardar la fotografía." };
    }
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setFile(null);
    setRemoving(false);
    router.refresh();
    onSaved?.();
  };

  const handleClose = () => {
    setFile(null);
    setRemoving(false);
    setError(null);
    onClose();
  };

  return (
    <KitProfileModal
      open={open}
      title={title}
      subtitle={subtitle}
      dirty={dirty}
      saving={saving}
      onClose={handleClose}
      onSave={handleSave}
      onLogout={async () => { await onLogout?.(); }}
    >
      <Avatar
        name={name}
        src={avatarSrc}
        size={size}
        editable
        uploading={saving}
        error={error}
        onUpload={selected => {
          setFile(selected);
          setRemoving(false);
          setError(null);
        }}
        onRemove={() => {
          setRemoving(true);
          setFile(null);
          setError(null);
        }}
      />
      {code ? <p className="small">{code}</p> : null}
    </KitProfileModal>
  );
}
