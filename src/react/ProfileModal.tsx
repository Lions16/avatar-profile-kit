"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { mergeLabels, type ProfileModalLabels } from "./labels.js";
import { PwaInstallButton } from "./PwaInstall.js";

export interface ProfileModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  dirty?: boolean;
  saving?: boolean;
  onClose: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  showInstall?: boolean;
  labels?: Partial<ProfileModalLabels>;
}

type PendingAction = "close" | "logout" | null;

/**
 * Bottom sheet en móvil. El logout vive aquí, arriba a la derecha y separado
 * del formulario; el footer solo contiene Cancelar y Guardar.
 */
export function ProfileModal({
  open,
  title,
  subtitle,
  children,
  dirty = false,
  saving = false,
  onClose,
  onSave,
  onLogout,
  showInstall = true,
  labels,
}: ProfileModalProps) {
  const copy = mergeLabels(labels);
  const [pending, setPending] = useState<PendingAction>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const keepRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const confirmId = useId();

  const requestClose = useCallback(() => {
    if (dirty) setPending("close");
    else void onClose();
  }, [dirty, onClose]);

  const requestLogout = useCallback(() => {
    if (dirty) setPending("logout");
    else void onLogout();
  }, [dirty, onLogout]);

  const confirmPending = () => {
    const action = pending;
    setPending(null);
    if (action === "close") void onClose();
    if (action === "logout") void onLogout();
  };

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = bodyRef.current?.querySelector<HTMLElement>("button, input, textarea, select, [href]");
    (first ?? sheetRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !pending) return;
    keepRef.current?.focus();
  }, [open, pending]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (pending) setPending(null);
        else requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, pending, requestClose]);

  if (!open) return null;

  return (
    <div
      className="apk-modal"
      onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}
    >
      <section ref={sheetRef} tabIndex={-1} className="apk-modal__sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="apk-modal__header">
          <div className="apk-modal__heading">
            <h2 id={titleId} className="apk-modal__title">{title}</h2>
            {subtitle ? <p className="apk-modal__subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="apk-modal__logout" onClick={requestLogout}>
            {copy.logout}
          </button>
        </header>

        <div className="apk-modal__body" ref={bodyRef}>
          {children}
          {showInstall ? (
            <div className="apk-modal__install">
              <PwaInstallButton labels={labels} />
            </div>
          ) : null}
        </div>

        <footer className="apk-modal__footer">
          <button type="button" className="apk-modal__cancel" onClick={requestClose}>{copy.cancel}</button>
          <button type="button" className="apk-modal__save" onClick={() => void onSave()} disabled={saving}>
            {saving ? copy.saving : copy.save}
          </button>
        </footer>

        {pending ? (
          <div className="apk-confirm" role="alertdialog" aria-modal="true" aria-labelledby={confirmId}>
            <div className="apk-confirm__box">
              <h3 id={confirmId} className="apk-confirm__title">{copy.discardTitle}</h3>
              <p className="apk-confirm__message">{copy.discardMessage}</p>
              <div className="apk-confirm__actions">
                <button ref={keepRef} type="button" className="apk-confirm__keep" onClick={() => setPending(null)}>
                  {copy.discardKeepEditing}
                </button>
                <button type="button" className="apk-confirm__discard" onClick={confirmPending}>
                  {copy.discardConfirm}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
