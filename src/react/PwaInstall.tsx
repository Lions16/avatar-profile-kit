"use client";

import { useCallback, useEffect, useState } from "react";
import { isStandaloneScreen, requestPwaInstall, watchInstallPrompt, type PwaInstallPrompt } from "../pwa/install.js";
import { mergeLabels, type ProfileModalLabels } from "./labels.js";

export interface PwaInstallHook {
  canInstall: boolean;
  install(): Promise<boolean>;
}

/** Devuelve canInstall=false cuando el navegador no ofrece la instalación o ya está instalada. */
export function usePwaInstall(): PwaInstallHook {
  const [prompt, setPrompt] = useState<PwaInstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneScreen());
    return watchInstallPrompt(
      event => setPrompt(event),
      () => {
        setPrompt(null);
        setStandalone(true);
      },
    );
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return false;
    const accepted = await requestPwaInstall(prompt);
    setPrompt(null);
    return accepted;
  }, [prompt]);

  return { canInstall: !standalone && prompt !== null, install };
}

export function PwaInstallButton({ labels }: { labels?: Partial<ProfileModalLabels> }) {
  const { canInstall, install } = usePwaInstall();
  const copy = mergeLabels(labels);
  if (!canInstall) return null;
  return (
    <button type="button" className="apk-pwa__button" onClick={() => void install()}>
      {copy.installApp}
    </button>
  );
}
