import test from "node:test";
import assert from "node:assert/strict";
import { isStandaloneScreen, requestPwaInstall, watchInstallPrompt, type PwaInstallPrompt } from "../src/pwa/install.js";

type Listener = (event: Event) => void;

function installPrompt(outcome: "accepted" | "dismissed", calls: string[], fail = false): PwaInstallPrompt {
  const userChoice = Promise.resolve({ outcome, platform: "web" });
  return {
    type: "beforeinstallprompt",
    prompt: async () => {
      calls.push("prompt");
      if (fail) throw new Error("El navegador rechazó el prompt.");
    },
    get userChoice() {
      calls.push("userChoice");
      return userChoice;
    },
  } as unknown as PwaInstallPrompt;
}

function withFakeWindow<T>(run: (listeners: Map<string, Set<Listener>>, fakeWindow: Record<string, unknown>) => T): T {
  const globals = globalThis as unknown as { window?: unknown };
  const previous = globals.window;
  const listeners = new Map<string, Set<Listener>>();
  const fakeWindow = {
    navigator: {},
    matchMedia: () => ({ matches: false }),
    addEventListener: (type: string, listener: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => listeners.get(type)?.delete(listener),
  };
  globals.window = fakeWindow;
  try {
    return run(listeners, fakeWindow);
  } finally {
    if (previous === undefined) delete globals.window;
    else globals.window = previous;
  }
}

test("requestPwaInstall muestra el prompt antes de leer la decisión", async () => {
  const calls: string[] = [];
  assert.equal(await requestPwaInstall(installPrompt("accepted", calls)), true);
  assert.deepEqual(calls, ["prompt", "userChoice"]);

  const rejected: string[] = [];
  assert.equal(await requestPwaInstall(installPrompt("accepted", rejected, true)), false);
  assert.deepEqual(rejected, ["prompt"]);

  const dismissed: string[] = [];
  assert.equal(await requestPwaInstall(installPrompt("dismissed", dismissed)), false);
});

test("watchInstallPrompt captura, reenvía y libera los eventos PWA", () => {
  withFakeWindow(listeners => {
    const available: PwaInstallPrompt[] = [];
    let installed = 0;
    const stop = watchInstallPrompt(event => available.push(event), () => installed++);

    let prevented = false;
    const before = { type: "beforeinstallprompt", preventDefault: () => { prevented = true; } } as unknown as Event;
    for (const listener of listeners.get("beforeinstallprompt") ?? []) listener(before);
    assert.equal(prevented, true);
    assert.equal(available.length, 1);

    for (const listener of listeners.get("appinstalled") ?? []) listener(new Event("appinstalled"));
    assert.equal(installed, 1);

    stop();
    assert.equal(listeners.get("beforeinstallprompt")?.size, 0);
    assert.equal(listeners.get("appinstalled")?.size, 0);
  });
});

test("isStandaloneScreen detecta el modo standalone", () => {
  withFakeWindow((_listeners, fakeWindow) => {
    assert.equal(isStandaloneScreen(), false);
    fakeWindow.matchMedia = () => ({ matches: true });
    assert.equal(isStandaloneScreen(), true);
  });
});
