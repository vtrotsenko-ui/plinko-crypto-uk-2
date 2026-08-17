#!/usr/bin/env tsx
/**
 * Packages the built static site into a single zip archive for local QA.
 * Output: 1win-argentina-site.zip at repo root (contains index.html at top level).
 */

import { mkdir, rm, cp, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SITE_DIR = path.join(ROOT_DIR, "sites", "1win-argentina");
const STAGING = path.join(ROOT_DIR, ".cache", "zip-staging");
const ZIP_PATH = path.join(ROOT_DIR, "1win-argentina-site.zip");

async function main(): Promise<void> {
  await access(path.join(SITE_DIR, "index.html"));
  await rm(STAGING, { recursive: true, force: true });
  await mkdir(STAGING, { recursive: true });
  await cp(SITE_DIR, STAGING, { recursive: true });
  await rm(ZIP_PATH, { force: true });

  const result = spawnSync("zip", ["-r", "-q", ZIP_PATH, "."], { cwd: STAGING, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`zip failed: ${result.stderr || result.stdout}`);
  }
  console.log(`[info] wrote ${path.relative(ROOT_DIR, ZIP_PATH)}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
