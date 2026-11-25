"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/features/auth/actions";
import { ProfileModal } from "./profile-modal";

export type MyProfileProps = {
  organizationId: string;
  name: string;
  code?: string | null;
  avatarSrc?: string | null;
  title?: string;
  subtitle?: string;
};

export function MyProfile({ organizationId, name, code, avatarSrc, title = "Mi perfil", subtitle }: MyProfileProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const handleSaved = () => { router.refresh(); };
  const handleLogout = async () => { await signOut(); };
  return <ProfileModal open={open} onClose={() => setOpen(false)} organizationId={organizationId} title={title} subtitle={subtitle} name={name} code={code} avatarSrc={avatarSrc} onLogout={handleLogout} onSaved={handleSaved} />;
}
