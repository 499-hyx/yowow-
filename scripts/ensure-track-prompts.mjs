#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASE = path.dirname(SCRIPT_DIR);
const ID_RE = /^[a-z0-9-]+$/;
const FIXTURE_TRACK_RE = /^(mvp-internal|status-preflight|selftest)-/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function ensureDir(dir) {
  if (fs.existsSync(dir)) return false;
  fs.mkdirSync(dir, { recursive: true });
  return true;
}

function trackFiles(base) {
  const dir = path.join(base, "config", "tracks");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name));
}

export function ensureTrackPrompts({ base = DEFAULT_BASE, log = true } = {}) {
  const created = [];
  for (const file of trackFiles(base)) {
    let track;
    try {
      track = readJson(file);
    } catch (error) {
      if (log) console.warn(`[track-prompts] 跳过无法读取的赛道 JSON: ${path.relative(base, file)} (${error.message})`);
      continue;
    }
    const trackId = track.track_id || path.basename(file, ".json");
    if (!ID_RE.test(trackId)) {
      if (log) console.warn(`[track-prompts] 跳过非法 track_id: ${trackId}`);
      continue;
    }
    if (FIXTURE_TRACK_RE.test(trackId)) {
      if (log) console.warn(`[track-prompts] 跳过测试赛道: ${trackId}`);
      continue;
    }

    const searchDir = path.join(base, "prompts", "赛道热点", trackId);
    const analysisDir = path.join(base, "prompts", "分析提示词", trackId);
    if (ensureDir(searchDir)) created.push(searchDir);
    if (ensureDir(analysisDir)) created.push(analysisDir);
  }
  if (log && created.length) {
    for (const dir of created) console.log(`[track-prompts] created ${path.relative(base, dir)}`);
  }
  return created;
}

export function watchTrackPrompts({ base = DEFAULT_BASE, log = true } = {}) {
  const dir = path.join(base, "config", "tracks");
  fs.mkdirSync(dir, { recursive: true });
  ensureTrackPrompts({ base, log });

  let timer;
  const syncSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ensureTrackPrompts({ base, log }), 150);
  };
  const watcher = fs.watch(dir, syncSoon);
  return {
    close() {
      clearTimeout(timer);
      watcher.close();
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const watch = process.argv.includes("--watch");
  if (watch) {
    watchTrackPrompts();
    console.log("[track-prompts] watching config/tracks");
  } else {
    ensureTrackPrompts();
  }
}
