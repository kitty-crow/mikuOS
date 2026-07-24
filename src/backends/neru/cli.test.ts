import assert from "node:assert/strict";
import test from "node:test";
import { neruCliRequest, neruCommand, requestedKernel } from "./cli.js";

test("leaves the existing Thistle and Teto CLI path unchanged", () => {
  assert.equal(neruCliRequest(["--kernel=teto"], {}), undefined);
  assert.equal(neruCliRequest(["--kernel", "thistle"], {}), undefined);
  assert.equal(neruCliRequest([], {}), undefined);
});

test("accepts NERU and Linux as the same kernel selection", () => {
  assert.equal(requestedKernel(["--kernel=neru"], {}), "neru");
  assert.equal(requestedKernel(["--kernel=linux"], {}), "linux");
  assert.ok(neruCliRequest([], { MIKUOS_KERNEL: "neru" }));
});

test("passes the same selected root into the kernel-only NERU runtime", () => {
  const request = neruCliRequest(
    [
      "--kernel=neru",
      "--root=/tmp/mikuos-root",
      "--neru-output=/tmp/neru",
      "--neru-variant=wasm32_nommu",
    ],
    {},
  );
  if (!request) throw new Error("expected NERU request");
  const command = neruCommand(request, "/usr/bin/bun");
  assert.equal(command.executable, "/usr/bin/bun");
  assert.equal(command.argv.includes("--fs-root"), true);
  assert.equal(command.argv.includes("/tmp/mikuos-root"), true);
  assert.equal(command.argv.includes("--userland"), false);
  assert.equal(command.argv.some(value => value.endsWith("/.thistle.base/")), false);
  assert.equal(command.argv.includes("--boot"), true);
});

test("rejects an ephemeral NERU root", () => {
  assert.throws(
    () => neruCliRequest(["--kernel=neru", "--no-root"], {}),
    /requires the same persistent root/,
  );
});
