# Plantillas SQL

Los archivos `*.sql.tpl` no se aplican directamente: se renderizan desde `avatar-profile.config.json`.

```powershell
npm.cmd run sql:render -- --config ./avatar-profile.config.json --out ./migrations-sugeridas
```

Salida:

| Archivo | Contenido |
|---|---|
| `001_columns.sql` | `avatar_path` en ambas tablas, índices y triggers de auditoría opcionales |
| `002_bucket_and_policies.sql` | bucket privado, helpers de pertenencia/propiedad y policies de `storage.objects` |
| `003_rpc.sql` | `apk_set_avatar_path`, única escritura permitida de `avatar_path` |

Reglas:

- Los identificadores se validan en TypeScript y se escriben entre comillas dobles; los roles se validan antes de inyectarlos como literales SQL.
- La policy de lectura incluye el bypass de `master` como cláusula explícita. Si `masterRole` es `null`, la cláusula evalúa `false`.
- La policy de subida usa el mismo helper de propiedad que la RPC, de modo que no se pueda subir un archivo a la carpeta de otro dueño aunque se llame directamente a Storage.
- El preset `avatar-profile.connect-personnel.config.json` reutiliza el bucket existente de la app; el preset principal usa `connect-avatars` para no mezclar retenciones ni policies. Si reutilizas un bucket ajeno, revisa sus policies y amplía `allowed_mime_types` para que coincida con la config (en `CONICA-RRHH` eso ya hace la migración `202611251400_avatar_webp_mime.sql`).
- Los tests `tests/permissions.test.ts` aplican estas plantillas renderizadas con PGlite y comprueban aislamiento entre organizaciones, dueños, roles y anónimo.
