# Wiring aplicado en CONICA-RRHH

Este directorio contiene las versiones de referencia que se aplicaron en la app. El objetivo era conservar sus server actions, sus migraciones y su trabajo paralelo, pero reutilizar el paquete para la lógica pura y la UI del modal.

> **No copiar ciegamente en otro proyecto**: la app ya publica manifest, service worker e iconos, ya tiene el logout dentro del modal y ya añadió la migración WebP. Copiar una versión antigua de `layout.tsx` desde aquí eliminaría el registro PWA.

## Cambios aplicados (6 archivos)

| Archivo del repo | Versión propuesta aquí | Qué hace |
|---|---|---|
| `package.json` | `package.json` | Añade `avatar-profile-kit` como dependencia git HTTPS; en local se usa `npm link` |
| `next.config.ts` | ver fragmento abajo | `transpilePackages` + `turbopack.root` para resolver el paquete hermano |
| `src/lib/avatar.ts` | `src/lib/avatar.ts` | Adaptador: re-exporta validación/rutas/iniciales del paquete manteniendo la API actual |
| `src/features/avatars/components/profile-modal.tsx` | `src/features/avatars/components/profile-modal.tsx` | Usa `Avatar` y `ProfileModal` del paquete; conserva `saveAvatar` del repo |
| `src/features/avatars/components/my-profile.tsx` | `src/features/avatars/components/my-profile.tsx` | Pasa `organizationId` al modal |
| `src/app/layout.tsx` | `src/app/layout.tsx` | Importa los estilos del paquete (`apk-`, sin colisiones) y registra la PWA en producción |

`next.config.ts` no se reemplaza completo; se añaden estas líneas:

```ts
import path from "node:path";

const config: NextConfig = {
  transpilePackages: ["avatar-profile-kit"],
  turbopack: { root: path.resolve(process.cwd(), "..") },
  // ...resto de la configuración existente
};
```

Sin `turbopack.root`, Next 16 con Turbopack no resuelve el junction aunque Node sí importe el paquete correctamente.

**No se modificaron** `supabase/migrations/202611250030_avatars.sql`, `supabase/migrations/202611251400_avatar_webp_mime.sql`, `src/features/avatars/actions.ts`, `src/features/avatars/data.ts`, `tests/avatar.test.ts`, `public/` ni el sidebar: el trabajo paralelo ya cubre la migración, el logout fuera del header, el enlace a Mi perfil y la PWA.

## Estado y verificación

```powershell
cd 'C:\Proyecto predeterminado\CONICA-RRHH'
npm.cmd install
npm.cmd run check
```

- ✅ La app instala el kit desde `git+https://github.com/Lions16/avatar-profile-kit.git#main`; una instalación limpia tipo Vercel (`npm ci` en un directorio sin el kit hermano) compila y genera `dist/` mediante `prepare`.
- ✅ `npm run check` de la app: 43/43 tests, build de Next 16.4.6 y `npm audit --omit=dev` sin vulnerabilidades.
- ✅ `npm run check` del kit: 24/24 tests.
- ✅ Propagación comprobada con un export temporal: apareció en la app tras recompilar el kit y desapareció al retirarlo.

## Cómo se reflejan los cambios del kit

- Los cambios en `dist/` se ven al instante desde la app (junction).
- Los cambios en `src/` requieren `npm run build` en el kit; `prepare` ya lo ejecuta al instalar. Para desarrollo continuo: `npm run dev:watch` en el kit.
- Si npm bloquea scripts: `npm install-scripts approve avatar-profile-kit`.

## Decisiones

- La ruta sigue siendo `<org>/<owner>/avatar/<uuid>.<ext>` en el bucket `connect-personnel`, igual que la migración existente (`pathLayout: "owner"`).
- El modal del paquete aporta: bottom sheet con safe-area, logout rojo ≥44 px arriba a la derecha, confirmación de cambios sin guardar, footer solo Cancelar/Guardar y botón de instalación PWA.
- La subida sigue pasando por `saveAvatar` (server action), porque esa validación de propiedad ya existe y evita duplicar writes.
- `masterRole` queda `null` porque este repo no modela `master`; se activa cambiando un valor en `src/lib/avatar.ts` y en el preset SQL si algún día se añade.
