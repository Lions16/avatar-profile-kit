export interface PwaInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function isStandaloneScreen(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || navigatorWithStandalone.standalone === true;
}

/** Muestra el prompt del navegador y devuelve si la instalación fue aceptada. */
export async function requestPwaInstall(prompt: PwaInstallPrompt): Promise<boolean> {
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    return choice.outcome === "accepted";
  } catch {
    return false;
  }
}

/** Captura beforeinstallprompt para mostrar "Instalar aplicación" dentro del modal de perfil. */
export function watchInstallPrompt(
  onAvailable: (event: PwaInstallPrompt) => void,
  onInstalled: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleBeforeInstall = (event: Event) => {
    event.preventDefault();
    onAvailable(event as PwaInstallPrompt);
  };
  window.addEventListener("beforeinstallprompt", handleBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    window.removeEventListener("appinstalled", onInstalled);
  };
}
