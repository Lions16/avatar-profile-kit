import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { defineAvatarConfig, configFromJson } from "../src/core/config.js";
import { avatarPathRegex, buildAvatarPath, getAvatarInitials, isAvatarPath, parseAvatarPath } from "../src/core/path.js";
import { validateAvatarFile } from "../src/core/validation.js";
import { renderSqlTemplates } from "../src/sql/render.js";

const UUID = "11111111-1111-4111-8111-111111111111";

test("iniciales legibles con uno o dos nombres", () => {
  assert.equal(getAvatarInitials("Ana Pérez"), "AP");
  assert.equal(getAvatarInitials("  ana   pérez  "), "AP");
  assert.equal(getAvatarInitials("Ana"), "A");
  assert.equal(getAvatarInitials("   "), "?");
});

test("validación de cliente: 2 MB y solo jpg/png/webp", () => {
  assert.equal(validateAvatarFile({ size: 1024, type: "image/jpeg" }), null);
  assert.equal(validateAvatarFile({ size: 2 * 1024 * 1024, type: "image/png" }), null);
  assert.match(String(validateAvatarFile({ size: 2 * 1024 * 1024 + 1, type: "image/png" })), /2 MB/);
  assert.match(String(validateAvatarFile({ size: 100, type: "image/gif" })), /JPG, PNG o WebP/);
  assert.match(String(validateAvatarFile(null)), /Selecciona una fotografía/);
});

test("ruta privada cerrada y verificable", () => {
  const path = buildAvatarPath({
    organizationId: UUID,
    kind: "member",
    ownerId: "22222222-2222-4222-8222-222222222222",
    mimeType: "image/webp",
    uniqueId: "33333333-3333-4333-8333-333333333333",
  });
  assert.equal(
    path,
    `${UUID}/member/22222222-2222-4222-8222-222222222222/avatar/33333333-3333-4333-8333-333333333333.webp`,
  );
  assert.equal(isAvatarPath(path), true);
  assert.equal(parseAvatarPath(path)?.kind, "member");
  assert.equal(isAvatarPath("/etc/passwd"), false);
  assert.equal(isAvatarPath(`${UUID}/member/22222222-2222-4222-8222-222222222222/avatar/x.gif`), false);
  assert.match(avatarPathRegex(), /\\\.\(jpg\|png\|webp\)\$/);
});

test("ruta owner-only compatible con la migración en curso", () => {
  const config = defineAvatarConfig({ bucket: "connect-personnel", pathLayout: "owner" });
  const owner = "22222222-2222-4222-8222-222222222222";
  const path = buildAvatarPath({ organizationId: UUID, kind: "internal", ownerId: owner, mimeType: "image/jpeg", uniqueId: UUID }, config);
  assert.equal(path, `${UUID}/${owner}/avatar/${UUID}.jpg`);
  assert.equal(isAvatarPath(path, config), true);
  assert.equal(parseAvatarPath(path)?.kind, null);
  assert.equal(isAvatarPath(`${UUID}/internal/${owner}/avatar/${UUID}.jpg`, config), false);
});

test("configuración sensible por defecto y rechazo de identificadores inseguros", () => {
  const config = defineAvatarConfig({ bucket: "mi-bucket", adminRoles: ["admin", "master"] });
  assert.equal(config.maxBytes, 2 * 1024 * 1024);
  assert.equal(config.bucket, "mi-bucket");
  assert.deepEqual(config.adminRoles, ["admin", "master"]);
  assert.throws(() => defineAvatarConfig({ bucket: "bucket;drop" }), /bucket inválido/);
  assert.throws(
    () => defineAvatarConfig({ schemas: { internal: { table: "public.profiles; drop table x" } } }),
    /identificador SQL seguro/,
  );
  assert.throws(() => configFromJson(null), /objeto JSON/);
  assert.throws(() => defineAvatarConfig({ allowedMimeTypes: "image/jpeg" as never }), /allowedMimeTypes debe ser una lista/);
  assert.throws(() => defineAvatarConfig({ adminRoles: [] }), /al menos un rol administrador/);
  assert.throws(
    () => defineAvatarConfig({ allowedMimeTypes: [{ mime: "image/jpeg", extension: "jpg);drop" }] }),
    /Extensión inválida/,
  );
});

test("la validación nombra los formatos configurados", () => {
  const config = defineAvatarConfig({ allowedMimeTypes: [{ mime: "image/png", extension: "png" }] });
  assert.match(String(validateAvatarFile({ size: 10, type: "image/gif" }, config)), /PNG/);
  assert.equal(validateAvatarFile({ size: 10, type: "image/png" }, config), null);
});

test("buildAvatarPath rechaza identificadores que el SQL no aceptaría", () => {
  assert.throws(
    () => buildAvatarPath({ organizationId: "org-1", kind: "internal", ownerId: UUID, mimeType: "image/jpeg" }),
    /organizationId debe ser un UUID/,
  );
  assert.throws(
    () => buildAvatarPath({ organizationId: UUID, kind: "internal", ownerId: "dueño", mimeType: "image/jpeg" }),
    /ownerId debe ser un UUID/,
  );
  assert.throws(
    () => buildAvatarPath({ organizationId: UUID, kind: "internal", ownerId: UUID, mimeType: "image/jpeg", uniqueId: "x" }),
    /uniqueId debe ser un UUID/,
  );
});

test("los presets incluidos renderizan SQL sin placeholders", async () => {
  for (const name of ["avatar-profile.config.json", "avatar-profile.connect-personnel.config.json"]) {
    const raw = JSON.parse(await readFile(new URL(`../${name}`, import.meta.url), "utf8")) as unknown;
    const config = configFromJson(raw);
    const rendered = await renderSqlTemplates(config);
    assert.equal(Object.keys(rendered).length, 3);
    for (const sql of Object.values(rendered)) assert.doesNotMatch(sql, /\{\{\w+\}\}/);
    assert.match(rendered["002_bucket_and_policies.sql.tpl"], new RegExp(`'${config.bucket}'`));
  }
});
