# avatar-profile-kit

Módulo **independiente** para avatares privados, diálogo de perfil y logout único. Vive en su propio repo (`https://github.com/Lions16/avatar-profile-kit`) y no contiene código de `CONICA-RRHH`; la app lo importa como dependencia git. Para desarrollo local se enlaza con `npm link`. Se puede consumir desde cualquier proyecto Next.js + Supabase.

Modelo genérico de dos dueños:

| Clave | Significado | En CONNECT (config incluida) |
|---|---|---|
| `internal` | cuenta interna del producto | `platform_usernames`, dueño `auth_user_id` |
| `member` | perfil del rol de negocio | `employee_profiles`, dueño `employee_id` vía `user_employee_links` |

No hay nombres de roles hardcodeados en la UI: `internal`/`member` son claves neutras. Los roles (`admin`, `master`, etc.) solo existen en la configuración SQL.

## Estado actual

- ✅ Core puro: validación (JPG/PNG/WebP, 2 MB), rutas, iniciales, configuración validada.
- ✅ Adaptadores Supabase: bucket privado, URL firmada y RPC de propiedad.
- ✅ React: `Avatar`, `useAvatarEditor`, `ProfileModal`, `ProfileDialog`, `InternalProfileDialog`, `MemberProfileDialog`, instalación PWA.
- ✅ SQL parametrizable: columnas, bucket + policies + helpers, RPC.
- ✅ Tests de lógica y de permisos con PGlite (SQL real, solo Auth se simula).
- ✅ **Integrado en `CONICA-RRHH`**: dependencia git `git+https://github.com/Lions16/avatar-profile-kit.git#main`, wrappers aplicados y `npm run check` de la app en verde (43 tests, build y auditoría). `npm link` mantiene la propagación inmediata en local.
- ✅ PWA publicada en la app (`public/manifest.webmanifest`, `public/sw.js`, iconos) y WebP permitido en el bucket `connect-personnel` mediante la migración `202611251400_avatar_webp_mime.sql`.

## Verificación del paquete

```powershell
cd 'C:\Proyecto predeterminado\avatar-profile-kit'
npm.cmd install
npm.cmd run check
```

## 1. Configuración (un solo lugar)

Edita `avatar-profile.config.json`. Campos principales:

- `bucket`: bucket privado (por defecto `connect-avatars`).
- `pathFolder`: carpeta dentro de la ruta (`avatar`).
- `maxBytes` / `allowedMimeTypes`: 2 MB y JPG/PNG/WebP.
- `schemas.internal` / `schemas.member`: tabla, columna de organización, columna dueño, columna `avatar_path`, columna nombre.
- `membership`: tabla de roles para los helpers SQL.
- `memberLink` (o `memberOwnerIsAuthUser: true`): cómo resolver el `member_id` desde `auth.uid()`.
- `adminRoles` / `masterRole`: lectura amplia y bypass explícito de lectura para `master`.
- `sql.auditFunction`: `private.record_audit` en este proyecto; `null` si el proyecto destino no tiene auditoría.

Hay dos presets incluidos:

- `avatar-profile.config.json`: diseño propio del paquete, bucket `connect-avatars` y ruta `<org>/<internal|member>/<owner>/avatar/<uuid>.<ext>`.
- `avatar-profile.connect-personnel.config.json`: compatible con la migración de avatares ya iniciada en CONNECT, bucket `connect-personnel`, ruta `<org>/<owner>/avatar/<uuid>.<ext>` (`pathLayout: "owner"`) y roles `admin`/`hr`. `masterRole` se puede activar cambiando ese valor a `"master"`.

Para otro proyecto basta otro JSON:

```powershell
npm.cmd run sql:render -- --config ./mi-config.json --out ./migrations-sugeridas
```

El comando imprime el SQL por stdout si no se pasa `--out`. **Nunca** escribas directamente en `supabase/migrations/` de la app sin revisarlo antes.

## 2. SQL generado

`sql/001_columns.sql.tpl`, `002_bucket_and_policies.sql.tpl` y `003_rpc.sql.tpl` se renderizan desde la configuración. La ruta generada es:

```text
<organization_id>/<internal|member>/<owner_id>/avatar/<uuid>.<jpg|png|webp>
```

Garantías del SQL:

- Bucket **privado**, `file_size_limit` y MIME types declarados también en `storage.buckets`.
- Policies de `storage.objects` para `select`, `insert`, `update` y `delete` solo sobre la carpeta propia, con bypass de roles configurado.
- Lectura de `master` explícita en la policy (`_is_master`). Para desactivarla: `masterRole: null`.
- RPC `apk_set_avatar_path` (`security definer`, `search_path = ''`) valida pertenencia, forma de ruta y existencia del perfil; `p_avatar_path = null` quita la foto.
- **No se concede `update` directo** sobre las tablas de perfil: solo la RPC.
- Triggers de auditoría opcionales sobre `avatar_path`.

Detalles en `sql/README.md`.

## 3. Uso en React

```tsx
import { createClient } from "@/lib/supabase/client"; // el cliente que ya tenga la app
import {
  InternalProfileDialog,
  type AvatarConfig,
} from "avatar-profile-kit/react";
import { createSupabaseAvatarStorage, createSupabaseAvatarRepository } from "avatar-profile-kit/supabase";
import { configFromJson } from "avatar-profile-kit";
import "avatar-profile-kit/styles.css";

const config: AvatarConfig = configFromJson(configJson);
const client = createClient();
const storage = createSupabaseAvatarStorage(client, config);
const repository = createSupabaseAvatarRepository(client, config);

<InternalProfileDialog
  open={open}
  owner={{ kind: "internal", organizationId, ownerId: authUserId, name: displayName }}
  storage={storage}
  repository={repository}
  config={config}
  onSave={close}
  onClose={close}
  onLogout={signOut}
/>
```

Para el perfil `member`, el mismo componente con `owner.kind = "member"` y `ownerId = employee_id` (o `MemberProfileDialog`, que cambia solo el título). La diferencia de ubicación la decide la app: `internal` se abre desde **Mi perfil**; `member` desde su propio diálogo.

`ProfileModal` también se puede usar sin avatar, para reutilizar el logout y el bottom sheet en otros flujos.

### Subida, vista y quita

- `Avatar` muestra URL firmada si recibe `src` o `resolveUrl`; si no hay imagen, muestra iniciales del nombre. Si usas MIME personalizados, pasa `accept` para el selector de archivo.
- `useAvatarEditor` gestiona `upload`, `remove`, `save`, `discard` y la renovación de la URL firmada antes de que caduque.
- Los archivos subidos pero no guardados se borran al cancelar/descartar; al guardar se borra el objeto anterior.

### Logout y PWA

- El botón de salida está en la esquina superior derecha del modal, en rojo y con min-height/min-width de 44 px; el footer contiene solo **Cancelar** y **Guardar**.
- Si `dirty === true`, cerrar o pulsar salida muestra una confirmación de cambios sin guardar antes de ejecutar la acción.
- El botón **Instalar aplicación** aparece dentro del mismo modal solo cuando el navegador dispara `beforeinstallprompt`; `usePwaInstall()` llama a `prompt()` antes de leer `userChoice`. Plantillas publicables en `assets/pwa/` y guía en `src/pwa/README.md`.

## 4. Estado de integración en `CONICA-RRHH`

| Paso | Estado |
|---|---|
| Botón "Mi perfil" → diálogo interno | ✅ Implementado en la app con sus propias server actions |
| Diálogo `member` por `employee_id` | ✅ Resuelto desde `user_employee_links` |
| Logout dentro del modal | ✅ Ya no hay `<form action={signOut}>` en el layout de la app |
| Subir/ver/quitar foto y RPCs | ✅ Migración `202611250030_avatars.sql` |
| WebP en `connect-personnel` | ✅ Migración `202611251400_avatar_webp_mime.sql` |
| Manifest, service worker e iconos | ✅ Publicados en `public/` y registrados en `src/app/layout.tsx` |
| Dependencia del kit | ✅ `git+https://github.com/Lions16/avatar-profile-kit.git#main`; Vercel la instala desde GitHub |
| Desarrollo local | ✅ `npm link ../avatar-profile-kit` crea el junction para propagación inmediata |
| Wrappers del kit en la app | ✅ `src/lib/avatar.ts`, `profile-modal.tsx`, `my-profile.tsx` y `layout.tsx` |
| Turbopack | ✅ `transpilePackages` + `turbopack.root` = directorio contenedor |
| Verificación final | ✅ kit 24/24 y app 43/43; build y `npm audit` limpios |

> `file:../avatar-profile-kit` funcionaba en local pero **no en Vercel**: cada repo se clona solo, `../avatar-profile-kit` no existe y `npm ci` deja un junction roto. Por eso se migró a dependencia git.

Se probó la propagación con un export temporal en `src/core/index.ts`: tras `npm run build` en el kit, la app importó el nuevo valor **sin reinstalar ni reiniciar**; al retirarlo, desapareció. El marcador ya fue eliminado.

### 4.1 Cómo se reflejan los cambios en la app

- En local, `npm link ../avatar-profile-kit` crea un **junction** en `node_modules`: los cambios en `dist/` son visibles de inmediato.
- Los cambios en `src/` requieren `npm run build` en el kit. El script `prepare` ya lo hace al instalar desde Git; para desarrollo usa `npm run dev:watch` en una terminal.
- Para actualizar la versión desplegada: haz commit/push en este repo y luego `npm install` (o redeploy) en cada app consumidora.
- Si npm bloquea los scripts de instalación: `npm install-scripts approve avatar-profile-kit`.
- Después de cambiar estilos, el build vuelve a copiar `src/react/styles.css` a `dist/react/styles.css`.

### 4.2 Para integrar el siguiente proyecto

1. Añade la dependencia git y, solo en local, ejecuta `npm link ../avatar-profile-kit`.
2. Añade dos líneas en `next.config.ts`; `turbopack.root` debe ser el **padre común** de la app y del kit, porque Turbopack no resuelve archivos fuera de esa raíz:

   ```ts
   const config: NextConfig = {
     transpilePackages: ["avatar-profile-kit"],
     turbopack: { root: path.resolve(process.cwd(), "..") },
   };
   ```

3. Adapta los wrappers de `integration/CONICA-RRHH/` conservando las server actions y migraciones propias de cada app.
4. Crea un JSON de configuración y renderiza el SQL con `npm run sql:render -- --config ./mi-config.json --out ./migrations-sugeridas`; revísalo antes de aplicarlo.
5. Ejecuta `npm run check` en el kit y en la app. Antes de `next build`, asegúrate de que el kit esté compilado.

## 5. API pública del paquete

| Subpath | Contenido |
|---|---|
| `avatar-profile-kit` | tipos, configuración, validación, rutas y errores |
| `avatar-profile-kit/react` | `Avatar`, `useAvatarEditor`, `ProfileModal`, `ProfileDialog`, `InternalProfileDialog`, `MemberProfileDialog`, `usePwaInstall` |
| `avatar-profile-kit/supabase` | adaptadores de storage y repositorio |
| `avatar-profile-kit/pwa` | `watchInstallPrompt`, `requestPwaInstall`, `isStandaloneScreen` |
| `avatar-profile-kit/sql-render` | `renderSqlTemplates` y `buildTemplateValues` |
| `avatar-profile-kit/styles.css` | estilos con prefijo `apk-` |
| `avatar-profile-kit/pwa/manifest.webmanifest` y `.../pwa/sw.js` | plantillas incluidas en el paquete |

Para verificar: `npm.cmd run check`. Para inspeccionar el contenido publicado: `npm.cmd pack --dry-run`.

## Criterios de aceptación cubiertos por el módulo

| Criterio | Dónde |
|---|---|
| Subir/ver/quitar foto en ambos perfiles | `useAvatarEditor` + adaptadores + RPC |
| Iniciales legibles sin foto | `getAvatarInitials` + `Avatar` |
| Logout en el mismo lugar, no en header/sidebar | `ProfileModal` (la app debe retirar el botón antiguo) |
| ≤2 MB, JPG/PNG/WebP | validación TS + `storage.buckets` + policies |
| Modal bottom sheet con safe-area e inputs 16 px | `src/react/styles.css` |
| Sin pago, estado activo ni org_id en la UI | los tipos de `AvatarOwner` solo exponen `kind`, ids y nombre |

## Fuera de alcance

Cambio de correo o contraseña desde el perfil; migración automática de la app; sustitución del logout actual sin tu aprobación.
