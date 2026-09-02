import assert from "node:assert/strict";
import { test } from "node:test";
import postgres from "postgres";
import { bootstrapInstance } from "../src/instance.mjs";

const valid = {
  "org-name": "Facility Test",
  "org-slug": "facility-test",
  "owner-email": "owner@example.com",
  "owner-name": "Owner",
  "github-user-id": "123",
  "github-login": "owner",
  "github-account-id": "456",
  "github-installation-id": "789",
  "github-account-login": "facility-test",
  json: true,
};

test("bootstrap validates all identity and installation bindings before connecting", async () => {
  assert.equal(await bootstrapInstance({ ...valid, "github-user-id": "not-a-number" }, { databaseUrl: "postgres://unused" }), 1);
});

test("bootstrap is transactional, idempotent for identical input, and rejects conflicts", async (t) => {
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://facility:facility@localhost:5461/facility_test";
  const admin = postgres(databaseUrl, { max: 1, connect_timeout: 2 });
  try { await admin`select 1`; } catch { await admin.end(); t.skip("Postgres unreachable"); return; }
  const schema = `cli_bootstrap_${Date.now()}`;
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  try {
    await admin.unsafe(`
      CREATE TABLE "${schema}".roles (id text primary key, org_id text, name text);
      CREATE TABLE "${schema}".orgs (id text primary key, name text, slug text unique, settings jsonb);
      CREATE TABLE "${schema}".users (id text primary key, email text unique, name text, status text);
      CREATE TABLE "${schema}".user_identities (id text primary key, user_id text, provider text, provider_subject text, login text, metadata jsonb);
      CREATE TABLE "${schema}".org_members (id text primary key, org_id text, user_id text, role_id text);
      CREATE TABLE "${schema}".github_installations (id text primary key, org_id text, installation_id bigint, account_id bigint, account_login text, target_type text);
      INSERT INTO "${schema}".roles (id, org_id, name) VALUES ('role_bundled_owner', null, 'owner');
    `);
    const scoped = new URL(databaseUrl);
    scoped.searchParams.set("options", `-csearch_path=${schema}`);
    assert.equal(await bootstrapInstance(valid, { databaseUrl: scoped.toString() }), 0);
    assert.equal(await bootstrapInstance(valid, { databaseUrl: scoped.toString() }), 0);
    assert.equal(await bootstrapInstance({ ...valid, "github-user-id": "124" }, { databaseUrl: scoped.toString() }), 1);
    assert.equal(await bootstrapInstance({ ...valid, "owner-name": "Different owner" }, { databaseUrl: scoped.toString() }), 1);
    const rows = await admin.unsafe(`SELECT count(*)::int AS count FROM "${schema}".orgs`);
    assert.equal(rows[0].count, 1);
  } finally {
    await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});
