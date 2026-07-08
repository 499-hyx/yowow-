#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf-8"));
}

function listJson(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter((name) => name.endsWith(".json"))
    .map((name) => `${dir}/${name}`)
    .sort();
}

function asList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function asNonEmptyArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function fail(errors, file, message) {
  errors.push(`${file}: ${message}`);
}

function validateTrack(file, track, errors) {
  if (!track.track_id) fail(errors, file, "missing track_id");
  if (!track.track_name) fail(errors, file, "missing track_name");
  if (!track.audience && !track.buyer?.who) fail(errors, file, "missing audience/buyer.who");
  if (!asList(track.commercial_goal).length) fail(errors, file, "missing commercial_goal");
  if (!track.product_value) fail(errors, file, "missing product_value");
  if (!track.bridge?.internal_lens) fail(errors, file, "missing bridge.internal_lens");
  if (!asList(track.bridge?.external_vocab).length) fail(errors, file, "missing bridge.external_vocab");
  if (!asList(track.bridge?.forbidden_terms).length) fail(errors, file, "missing bridge.forbidden_terms");
  if (!asList(track.bridge?.search_directions).length && !asNonEmptyArray(track.example_bridges).length) {
    fail(errors, file, "missing bridge.search_directions/example_bridges");
  }
  if (!asList(track.proof_assets).length) fail(errors, file, "missing proof_assets");
}

function validatePlatform(file, platform, errors) {
  if (!platform.platform_id) fail(errors, file, "missing platform_id");
  if (!platform.platform_name) fail(errors, file, "missing platform_name");
  if (!platform.content_form) fail(errors, file, "missing content_form");
  if (!platform.title_logic) fail(errors, file, "missing title_logic");
  if (!platform.length_norm) fail(errors, file, "missing length_norm");
  if (!asList(platform.expression_rules).length) fail(errors, file, "missing expression_rules");
  if (!asList(platform.penalizes).length) fail(errors, file, "missing penalizes");
}

function validateAccount(file, account, ids, errors) {
  if (!account.account_id) fail(errors, file, "missing account_id");
  if (!account.display_name) fail(errors, file, "missing display_name");
  if (!ids.tracks.has(account.track_id)) fail(errors, file, `unknown track_id ${account.track_id}`);
  if (!ids.platforms.has(account.platform_id)) fail(errors, file, `unknown platform_id ${account.platform_id}`);
  if (!ids.positionings.has(account.positioning_id)) fail(errors, file, `unknown positioning_id ${account.positioning_id}`);
  const memory = account.memory ?? {};
  if (!memory.business) fail(errors, file, "missing memory.business");
  if (!memory.audience) fail(errors, file, "missing memory.audience");
  if (!memory.product_value) fail(errors, file, "missing memory.product_value");
  if (!asList(memory.anxiety_anchors).length) fail(errors, file, "missing memory.anxiety_anchors");
}

function idSet(files, key) {
  return new Set(files.map((file) => readJson(file)?.[key]).filter(Boolean));
}

function main() {
  const errors = [];
  const trackFiles = listJson("config/tracks");
  const platformFiles = listJson("config/platforms");
  const positioningFiles = listJson("config/positionings");
  const accountFiles = listJson("data/accounts");

  for (const file of trackFiles) validateTrack(file, readJson(file), errors);
  for (const file of platformFiles) validatePlatform(file, readJson(file), errors);

  const ids = {
    tracks: idSet(trackFiles, "track_id"),
    platforms: idSet(platformFiles, "platform_id"),
    positionings: idSet(positioningFiles, "positioning_id"),
  };
  for (const file of accountFiles) validateAccount(file, readJson(file), ids, errors);

  if (errors.length) {
    console.error("配置校验失败：");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`配置校验通过：${trackFiles.length} tracks, ${platformFiles.length} platforms, ${accountFiles.length} accounts`);
}

main();
