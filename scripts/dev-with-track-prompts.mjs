#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureTrackPrompts, watchTrackPrompts } from "./ensure-track-prompts.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(SCRIPT_DIR);
const NEXT_BIN = process.platform === "win32" ? "next.cmd" : "next";

ensureTrackPrompts({ base: ROOT });
const watcher = watchTrackPrompts({ base: ROOT });

const child = spawn(NEXT_BIN, ["dev", ...process.argv.slice(2)], {
  cwd: ROOT,
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NEXT_IGNORE_INCORRECT_LOCKFILE: "1",
  },
  stdio: "inherit",
});

function shutdown(signal) {
  watcher.close();
  if (!child.killed) child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  watcher.close();
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  watcher.close();
  console.error(error.message);
  process.exit(1);
});
