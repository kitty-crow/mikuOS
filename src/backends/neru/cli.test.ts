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

test("orchestrates an ahead-of-time build from the shared userland root", () => {
  const request = neruCliRequest(
    ["--kernel=neru", "--neru-output=/tmp/neru", "--neru-variant=wasm32_nommu"],
    {},
  );
  if (!request) throw new Error("expected NERU request");
  const command = neruCommand(request, "/usr/bin/bun");
  assert.equal(command.executable, "/usr/bin/bun");
  assert.equal(command.argv.includes("--userland"), true);
  assert.equal(command.argv.some(value => value.endsWith("/.thistle.base/")), true);
  assert.equal(command.argv.includes("--boot"), true);
  assert.equal(command.argv.includes("--image"), false);
  assert.equal(command.argv.includes("--guest-image"), false);
});
