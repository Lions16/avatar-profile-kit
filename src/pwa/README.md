# Plantilla PWA

El módulo solo muestra **Instalar aplicación** cuando el navegador emite `beforeinstallprompt`. Para que eso ocurra, la app destino debe publicar un manifest y un service worker. El paquete incluye copias listas para copiar en `assets/pwa/`:

- `assets/pwa/manifest.webmanifest` → `public/manifest.webmanifest`
- `assets/pwa/sw.js` → `public/sw.js`

Sustituye `__APP_NAME__`, `__APP_SHORT_NAME__`, `__APP_DESCRIPTION__`, `__START_URL__` y `__THEME_COLOR__`, y publica iconos en `public/icons/icon-192.png` y `icon-512.png`.

En `src/app/layout.tsx` (o el layout raíz del framework):

```tsx
export const metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Mi aplicación" },
};
```

Registro del service worker desde un componente cliente o un script del layout, preferiblemente solo en producción:

```tsx
useEffect(() => {
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js");
  }
}, []);
```

El service worker de la plantilla **no almacena páginas autenticadas**: solo cachea el manifiesto y los iconos, y mantiene un handler de `fetch` para cumplir el requisito de instalabilidad de Chrome.

## Estado en `CONICA-RRHH`

La app ya publica `public/manifest.webmanifest`, `public/sw.js` y los iconos; el registro está en `src/app/layout.tsx` y solo se activa en producción. No hace falta copiar nada para usar el modal actual.

## Dentro del modal

No hay que hacer nada: `ProfileModal` incluye `PwaInstallButton` por defecto. Para ocultarlo, pasa `showInstall={false}`. Para traducirlo, usa `labels={{ installApp: "..." }}`. El hook `usePwaInstall()` expone `canInstall` y `install()`; la instalación llama a `prompt()` antes de esperar `userChoice`.
