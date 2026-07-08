#!/usr/bin/env node
import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "next.cmd" : "next";
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/next-with-env.mjs <next-command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NEXT_IGNORE_INCORRECT_LOCKFILE: "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
