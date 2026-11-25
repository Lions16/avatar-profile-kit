import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { defineAvatarConfig } from "../src/core/config.js";
import { renderSqlTemplates } from "../src/sql/render.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FILE = "99999999-9999-4999-8999-999999999999";
const filePath = (org: string, kind: "internal" | "member", owner: string) => `${org}/${kind}/${owner}/avatar/${FILE}.jpg`;

test("policies de storage y RPC protegen ambos perfiles, organizaciones y bypass", async t => {
  const db = new PGlite();
  const [orgA, orgB, internalA, internalB, memberUserA, memberUserB, adminA, masterA, outsider, personA, personB] =
    Array.from({ length: 11 }, (_, index) => id(index + 1));

  const config = defineAvatarConfig({
    masterRole: "master",
    memberOwnerIsAuthUser: false,
    schemas: {
      internal: {
        table: "public.platform_usernames",
        organizationColumn: "organization_id",
        ownerColumn: "auth_user_id",
        avatarColumn: "avatar_path",
        nameColumn: "display_name",
      },
      member: {
        table: "public.employee_profiles",
        organizationColumn: "organization_id",
        ownerColumn: "employee_id",
        avatarColumn: "avatar_path",
        nameColumn: "display_name",
      },
    },
    memberLink: {
      table: "public.user_employee_links",
      organizationColumn: "organization_id",
      userColumn: "user_id",
      memberColumn: "employee_id",
      activeColumn: "active",
    },
  });
  const rendered = await renderSqlTemplates(config);

  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;

      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated, anon;
      grant all on storage.objects to authenticated;

      create schema private;
      create table public.organizations(id uuid primary key, name text);
      create table public.memberships(organization_id uuid, user_id uuid, roles text[], active boolean not null default true);
      create table public.platform_usernames(id uuid primary key default gen_random_uuid(), organization_id uuid, auth_user_id uuid, display_name text, avatar_path text);
      create table public.employees(id uuid primary key, organization_id uuid, display_name text);
      create table public.employee_profiles(id uuid primary key default gen_random_uuid(), organization_id uuid, employee_id uuid, display_name text, avatar_path text);
      create table public.user_employee_links(organization_id uuid, user_id uuid, employee_id uuid, active boolean not null default true);
      revoke all on public.platform_usernames, public.employee_profiles from public, anon, authenticated;
      grant select on public.platform_usernames, public.employee_profiles to authenticated;
    `);

    for (const sql of Object.values(rendered)) await db.exec(sql);

    await db.exec(`
      insert into auth.users(id) values
        ('${internalA}'),('${internalB}'),('${memberUserA}'),('${memberUserB}'),('${adminA}'),('${masterA}'),('${outsider}');
      insert into public.organizations(id, name) values ('${orgA}', 'A'), ('${orgB}', 'B');
      insert into public.memberships(organization_id, user_id, roles) values
        ('${orgA}', '${internalA}', array['employee']),
        ('${orgA}', '${internalB}', array['employee']),
        ('${orgA}', '${memberUserA}', array['employee']),
        ('${orgA}', '${memberUserB}', array['employee']),
        ('${orgA}', '${adminA}', array['admin']),
        ('${orgA}', '${masterA}', array['master']);
      insert into public.platform_usernames(organization_id, auth_user_id, display_name) values
        ('${orgA}', '${internalA}', 'Interno A'), ('${orgA}', '${internalB}', 'Interno B');
      insert into public.employees(id, organization_id, display_name) values
        ('${personA}', '${orgA}', 'Persona A'), ('${personB}', '${orgA}', 'Persona B');
      insert into public.employee_profiles(organization_id, employee_id, display_name) values
        ('${orgA}', '${personA}', 'Persona A'), ('${orgA}', '${personB}', 'Persona B');
      insert into public.user_employee_links(organization_id, user_id, employee_id) values
        ('${orgA}', '${memberUserA}', '${personA}'), ('${orgA}', '${memberUserB}', '${personB}');
    `);

    const ownInternal = filePath(orgA, "internal", internalA);
    const otherInternal = filePath(orgA, "internal", internalB);
    const ownMember = filePath(orgA, "member", personA);
    const otherMember = filePath(orgA, "member", personB);
    const otherOrg = filePath(orgB, "internal", internalA);

    const seed = async (...paths: string[]) => {
      await db.exec("reset role");
      for (const path of paths) {
        await db.query(`insert into storage.objects(bucket_id, name) values ('${config.bucket}', $1)`, [path]);
      }
    };
    const asUser = async (user: string) => {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`);
    };
    const visible = async () => (await db.query<{ name: string }>("select name from storage.objects")).rows.map(row => row.name);

    await seed(ownInternal, otherInternal, ownMember, otherMember, otherOrg);

    await t.test("internal lee su carpeta pero nunca la de otro usuario ni otra organización", async () => {
      await asUser(internalA);
      const rows = await visible();
      assert.ok(rows.includes(ownInternal));
      assert.ok(!rows.includes(otherInternal));
      assert.ok(!rows.includes(otherOrg));
    });

    await t.test("member lee su avatar resuelto desde el vínculo, no el de otro miembro", async () => {
      await asUser(memberUserA);
      const rows = await visible();
      assert.ok(rows.includes(ownMember));
      assert.ok(!rows.includes(otherMember));
      assert.ok(!rows.includes(ownInternal));
    });

    await t.test("admin y master tienen bypass explícito de lectura", async () => {
      await asUser(adminA);
      assert.ok((await visible()).includes(otherMember));
      await asUser(masterA);
      assert.ok((await visible()).includes(ownInternal));
    });

    await t.test("la escritura directa de avatar_path está prohibida", async () => {
      await asUser(internalA);
      await assert.rejects(
        db.exec("update public.platform_usernames set avatar_path='x'"),
        /permission denied/,
      );
    });

    await t.test("la RPC permite guardar y quitar el propio avatar", async () => {
      await asUser(internalA);
      await db.query("select public.apk_set_avatar_path($1,'internal',$2,$3)", [orgA, internalA, ownInternal]);
      await db.exec("reset role");
      const saved = await db.query<{ avatar_path: string }>(
        "select avatar_path from public.platform_usernames where auth_user_id=$1",
        [internalA],
      );
      assert.equal(saved.rows[0]?.avatar_path, ownInternal);

      await asUser(internalA);
      await db.query("select public.apk_set_avatar_path($1,'internal',$2,null)", [orgA, internalA]);
      await db.exec("reset role");
      const cleared = await db.query<{ avatar_path: string | null }>(
        "select avatar_path from public.platform_usernames where auth_user_id=$1",
        [internalA],
      );
      assert.equal(cleared.rows[0]?.avatar_path, null);
    });

    await t.test("la RPC rechaza dueño ajeno, otra organización y rutas inválidas", async () => {
      await asUser(internalA);
      await assert.rejects(
        db.query("select public.apk_set_avatar_path($1,'internal',$2,$3)", [orgA, internalB, otherInternal]),
        /No autorizado/,
      );
      await assert.rejects(
        db.query("select public.apk_set_avatar_path($1,'internal',$2,$3)", [orgB, internalA, otherOrg]),
        /No autorizado/,
      );
      await assert.rejects(
        db.query("select public.apk_set_avatar_path($1,'internal',$2,$3)", [
          orgA, internalA, `${orgA}/internal/${internalA}/avatar/${FILE}.gif`,
        ]),
        /Ruta de avatar inválida/,
      );
    });

    await t.test("member guarda su avatar vía RPC", async () => {
      await asUser(memberUserA);
      await db.query("select public.apk_set_avatar_path($1,'member',$2,$3)", [orgA, personA, ownMember]);
      await db.exec("reset role");
      const saved = await db.query<{ avatar_path: string }>(
        "select avatar_path from public.employee_profiles where employee_id=$1",
        [personA],
      );
      assert.equal(saved.rows[0]?.avatar_path, ownMember);
    });

    await t.test("storage solo permite subir a la carpeta propia", async () => {
      await asUser(internalA);
      await db.query(`insert into storage.objects(bucket_id, name) values ('${config.bucket}', $1)`, [
        `${orgA}/internal/${internalA}/avatar/${id(50)}.png`,
      ]);
      await assert.rejects(
        db.query(`insert into storage.objects(bucket_id, name) values ('${config.bucket}', $1)`, [
          `${orgA}/internal/${internalB}/avatar/${id(51)}.png`,
        ]),
        /row-level security|permission denied/i,
      );
    });

    await t.test("anónimo no lee ni ejecuta la RPC", async () => {
      await db.exec("reset role; set role anon;");
      await assert.rejects(db.query("select name from storage.objects"), /permission denied/);
      await assert.rejects(
        db.query("select public.apk_set_avatar_path($1,'internal',$2,null)", [orgA, internalA]),
        /permission denied/,
      );
    });
  } finally {
    await db.close();
  }
});

test("pathLayout owner: misma protección con ruta <org>/<owner>/avatar", async t => {
  const db = new PGlite();
  const [org, internal, other, memberUser, person] = Array.from({ length: 5 }, (_, index) => id(200 + index + 1));
  const config = defineAvatarConfig({
    bucket: "connect-personnel",
    pathLayout: "owner",
    policyPrefix: "apk_owner_test",
    adminRoles: ["admin", "hr"],
    schemas: {
      internal: {
        table: "public.platform_usernames",
        organizationColumn: "organization_id",
        ownerColumn: "auth_user_id",
        avatarColumn: "avatar_path",
        nameColumn: "display_name",
      },
      member: {
        table: "public.employee_profiles",
        organizationColumn: "organization_id",
        ownerColumn: "employee_id",
        avatarColumn: "avatar_path",
        nameColumn: "display_name",
      },
    },
    memberLink: {
      table: "public.user_employee_links",
      organizationColumn: "organization_id",
      userColumn: "user_id",
      memberColumn: "employee_id",
      activeColumn: "active",
    },
  });
  const rendered = await renderSqlTemplates(config);

  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated, anon;
      grant all on storage.objects to authenticated;
      create schema private;
      create table public.organizations(id uuid primary key);
      create table public.memberships(organization_id uuid, user_id uuid, roles text[], active boolean not null default true);
      create table public.platform_usernames(id uuid primary key, organization_id uuid, auth_user_id uuid, display_name text, avatar_path text);
      create table public.employees(id uuid primary key, organization_id uuid, display_name text);
      create table public.employee_profiles(id uuid primary key, organization_id uuid, employee_id uuid, display_name text, avatar_path text);
      create table public.user_employee_links(organization_id uuid, user_id uuid, employee_id uuid, active boolean not null default true);
      revoke all on public.platform_usernames, public.employee_profiles from public, anon, authenticated;
      grant select on public.platform_usernames, public.employee_profiles to authenticated;
    `);
    for (const sql of Object.values(rendered)) await db.exec(sql);
    await db.exec(`
      insert into auth.users(id) values ('${internal}'),('${other}'),('${memberUser}');
      insert into public.organizations(id) values ('${org}');
      insert into public.memberships(organization_id, user_id, roles) values
        ('${org}', '${internal}', array['employee']), ('${org}', '${memberUser}', array['employee']);
      insert into public.platform_usernames(id, organization_id, auth_user_id, display_name) values
        ('${id(210)}', '${org}', '${internal}', 'Interno'), ('${id(211)}', '${org}', '${other}', 'Otro');
      insert into public.employees(id, organization_id, display_name) values ('${person}', '${org}', 'Persona');
      insert into public.employee_profiles(id, organization_id, employee_id, display_name) values
        ('${id(212)}', '${org}', '${person}', 'Persona');
      insert into public.user_employee_links(organization_id, user_id, employee_id) values ('${org}', '${memberUser}', '${person}');
    `);

    const own = `${org}/${internal}/avatar/${FILE}.png`;
    const foreign = `${org}/${other}/avatar/${FILE}.png`;
    await db.exec("reset role");
    await db.query("insert into storage.objects(bucket_id, name) values ('connect-personnel', $1), ('connect-personnel', $2)", [own, foreign]);

    await t.test("solo lee su propia carpeta", async () => {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub','${internal}',false); set role authenticated;`);
      const rows = (await db.query<{ name: string }>("select name from storage.objects")).rows.map(row => row.name);
      assert.deepEqual(rows, [own]);
    });

    await t.test("la RPC acepta la ruta sin segmento de rol y rechaza extensiones inválidas", async () => {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub','${internal}',false); set role authenticated;`);
      await db.query("select public.apk_set_avatar_path($1,'internal',$2,$3)", [org, internal, own]);
      await assert.rejects(
        db.query("select public.apk_set_avatar_path($1,'internal',$2,$3)", [
          org, internal, `${org}/${internal}/avatar/${FILE}.gif`,
        ]),
        /Ruta de avatar inválida/,
      );
    });
  } finally {
    await db.close();
  }
});
