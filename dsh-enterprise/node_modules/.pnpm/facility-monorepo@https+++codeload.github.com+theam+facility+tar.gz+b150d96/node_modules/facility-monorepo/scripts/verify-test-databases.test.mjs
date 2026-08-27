import assert from "node:assert/strict";
import test from "node:test";
import { recreateTestDatabase, TEST_DATABASES } from "./verify-test-databases.mjs";

test("verification recreates each allowlisted disposable database", () => {
  for (const database of TEST_DATABASES) {
    const calls = [];
    recreateTestDatabase(database, (command, args) => calls.push([command, args]));

    assert.equal(calls.length, 3);
    assert.match(calls[0][1].at(-1), new RegExp(`datname = '${database}'`));
    assert.deepEqual(calls[1][1].slice(-4), ["-U", "facility", "--if-exists", database]);
    assert.deepEqual(calls[2][1].slice(-3), ["-U", "facility", database]);
  }
});

test("verification refuses to recreate arbitrary databases", () => {
  assert.throws(
    () => recreateTestDatabase("facility", () => assert.fail("must fail before executing")),
    /Refusing to recreate non-test database/,
  );
});
