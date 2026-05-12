#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  access,
  cp,
  lstat,
  mkdir,
  readlink,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const historyDir = path.join(rootDir, ".local-history");
const snapshotsDir = path.join(historyDir, "snapshots");

const MANAGED_PATHS = [
  "src",
  "public",
  "prompts",
  "docs",
  "scripts",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  ".gitignore",
];

const SENSITIVE_OR_GENERATED_PATHS = [
  ".git",
  ".cache",
  ".local-history",
  "node_modules",
  "dist",
  ".env",
  "src/credentials",
  "src/credentials/service-account.json",
];

function normalizePath(input) {
  return input.split(path.sep).join("/");
}

function shouldSkip(relativePath) {
  const rel = normalizePath(relativePath);

  if (!rel || rel === ".") {
    return false;
  }

  return SENSITIVE_OR_GENERATED_PATHS.some((skip) => {
    return rel === skip || rel.startsWith(`${skip}/`);
  });
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function slugifyLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function getGitInfo() {
  try {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const status = execFileSync("git", ["status", "--short"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return { branch, status };
  } catch {
    return { branch: "", status: "" };
  }
}

async function copyManagedEntry(sourcePath, targetPath, relativePath) {
  if (shouldSkip(relativePath)) {
    return;
  }

  const stat = await lstat(sourcePath);

  if (stat.isSymbolicLink()) {
    const linkTarget = await readlink(sourcePath).catch(() => null);
    if (linkTarget) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await symlink(linkTarget, targetPath);
    }
    return;
  }

  if (stat.isDirectory()) {
    await mkdir(targetPath, { recursive: true });
    const entries = await readdir(sourcePath);

    for (const entry of entries) {
      const childRelative = path.join(relativePath, entry);
      if (shouldSkip(childRelative)) {
        continue;
      }

      await copyManagedEntry(
        path.join(sourcePath, entry),
        path.join(targetPath, entry),
        childRelative
      );
    }

    return;
  }

  if (stat.isFile()) {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { force: true });
  }
}

async function createSnapshot(label = "") {
  await mkdir(snapshotsDir, { recursive: true });

  const safeLabel = slugifyLabel(label);
  const id = safeLabel ? `${timestampId()}__${safeLabel}` : timestampId();
  const snapshotDir = path.join(snapshotsDir, id);
  const filesDir = path.join(snapshotDir, "files");

  await mkdir(filesDir, { recursive: true });

  const included = [];
  const missing = [];

  for (const managedPath of MANAGED_PATHS) {
    const sourcePath = path.join(rootDir, managedPath);

    if (!(await pathExists(sourcePath))) {
      missing.push(managedPath);
      continue;
    }

    await copyManagedEntry(sourcePath, path.join(filesDir, managedPath), managedPath);
    included.push(managedPath);
  }

  const manifest = {
    id,
    label,
    createdAt: new Date().toISOString(),
    rootDir,
    included,
    missing,
    excluded: SENSITIVE_OR_GENERATED_PATHS,
    git: getGitInfo(),
  };

  await writeFile(
    path.join(snapshotDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  console.log(`Created local snapshot: ${id}`);
  console.log(`Location: ${path.relative(rootDir, snapshotDir)}`);

  return id;
}

async function readManifest(id) {
  const manifestPath = path.join(snapshotsDir, id, "manifest.json");
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

async function listSnapshotIds() {
  if (!(await pathExists(snapshotsDir))) {
    return [];
  }

  const entries = await readdir(snapshotsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

async function resolveSnapshotId(input) {
  const ids = await listSnapshotIds();
  const exact = ids.find((id) => id === input);

  if (exact) {
    return exact;
  }

  const matches = ids.filter((id) => id.startsWith(input));

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error(`Snapshot prefix is ambiguous: ${input}\n${matches.join("\n")}`);
  }

  throw new Error(`Snapshot not found: ${input}`);
}

async function listSnapshots() {
  const ids = await listSnapshotIds();

  if (!ids.length) {
    console.log("No local snapshots found.");
    return;
  }

  for (const id of ids) {
    const manifest = await readManifest(id).catch(() => null);
    const label = manifest?.label ? ` | ${manifest.label}` : "";
    const branch = manifest?.git?.branch ? ` | branch: ${manifest.git.branch}` : "";
    console.log(`${id}${label}${branch}`);
  }
}

async function restoreSnapshot(inputId, force) {
  if (!inputId) {
    throw new Error("Missing snapshot id. Run: npm run snapshot:list");
  }

  if (!force) {
    throw new Error(
      "Restore replaces managed project files. Re-run with --force after confirming the snapshot id."
    );
  }

  const id = await resolveSnapshotId(inputId);
  const snapshotFilesDir = path.join(snapshotsDir, id, "files");

  if (!(await pathExists(snapshotFilesDir))) {
    throw new Error(`Snapshot files missing for: ${id}`);
  }

  await createSnapshot(`pre-restore-${id}`);

  for (const managedPath of MANAGED_PATHS) {
    await rm(path.join(rootDir, managedPath), { recursive: true, force: true });
  }

  const entries = await readdir(snapshotFilesDir);

  for (const entry of entries) {
    await cp(path.join(snapshotFilesDir, entry), path.join(rootDir, entry), {
      recursive: true,
      force: true,
      errorOnExist: false,
    });
  }

  console.log(`Restored local snapshot: ${id}`);
  console.log("A pre-restore snapshot was created first, so this restore can also be undone.");
}

async function pruneSnapshots(keepRaw) {
  const keep = Number(keepRaw || 20);

  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error("Keep count must be a positive integer.");
  }

  const ids = await listSnapshotIds();
  const toDelete = ids.slice(keep);

  for (const id of toDelete) {
    await rm(path.join(snapshotsDir, id), { recursive: true, force: true });
  }

  console.log(`Snapshots kept: ${Math.min(ids.length, keep)}`);
  console.log(`Snapshots deleted: ${toDelete.length}`);
}

function printHelp() {
  console.log(`Local version snapshots

Usage:
  npm run snapshot -- "before risky change"
  npm run snapshot:list
  npm run snapshot:restore -- <snapshot-id> --force
  npm run snapshot:prune -- 20

Managed paths:
  ${MANAGED_PATHS.join(", ")}

Excluded:
  ${SENSITIVE_OR_GENERATED_PATHS.join(", ")}
`);
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);

  if (command === "snapshot") {
    await createSnapshot(args.join(" "));
    return;
  }

  if (command === "list") {
    await listSnapshots();
    return;
  }

  if (command === "restore") {
    const id = args.find((arg) => !arg.startsWith("--"));
    const force = args.includes("--force");
    await restoreSnapshot(id, force);
    return;
  }

  if (command === "prune") {
    await pruneSnapshots(args[0]);
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(`Local version error: ${error.message}`);
  process.exit(1);
});
