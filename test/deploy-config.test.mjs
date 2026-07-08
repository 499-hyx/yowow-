import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

test("Vercel deployment runs the project build script", () => {
  const vercel = readJson("vercel.json");
  const pkg = readJson("package.json");

  assert.equal(pkg.engines.node, "20.x");
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.installCommand, "npm install");
  assert.equal(vercel.buildCommand, "npm run build");
  assert.match(pkg.scripts.build, /ensure-track-prompts\.mjs/);
  assert.match(pkg.scripts.build, /next-with-env\.mjs build/);
  assert.match(pkg.scripts.start, /next-with-env\.mjs start/);
});

test("production env contract only requires the Turso mirror", () => {
  const envExample = fs.readFileSync(".env.example", "utf-8");
  const envNames = envExample
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("=")[0]);

  assert.deepEqual(envNames, ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]);
  assert.doesNotMatch(envExample, /ANTHROPIC_API_KEY|MODEL_NAME|ANTHROPIC_BASE_URL/);
});
