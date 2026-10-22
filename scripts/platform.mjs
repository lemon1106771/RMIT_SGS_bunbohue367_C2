// Shared helpers for run-init.mjs and doctor.mjs. Node only, no dependencies.
//
// Test hooks (used to dry-run the Windows branch on any OS):
//   CLEARAID_PLATFORM=win32   pretend to be Windows
//   CLEARAID_GIT_BASH=<path>  use this bash instead of searching (also a real override
//                             for Git installed in an unusual place)

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const platform = process.env.CLEARAID_PLATFORM || process.platform;
export const isWindows = platform === "win32";
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// WSL's launcher (C:\Windows\System32\bash.exe) and the Microsoft Store stubs are NOT Git Bash:
// they would run the script inside a Linux VM that cannot reach Docker Desktop's tools.
function isForbiddenBash(p) {
  const n = p.replace(/\//g, "\\").toLowerCase();
  return n.includes("\\windows\\system32\\") || n.includes("\\windows\\sysnative\\") || n.includes("\\windowsapps\\");
}

function gitRootCandidates(env) {
  const roots = [];
  const add = (...parts) => {
    if (parts.every(Boolean)) roots.push(path.join(...parts));
  };
  add(env.ProgramFiles, "Git");
  add(env.ProgramW6432, "Git");
  add(env["ProgramFiles(x86)"], "Git");
  add(env.LOCALAPPDATA, "Programs", "Git");
  add(env.USERPROFILE, "scoop", "apps", "git", "current");
  add(env.SCOOP, "apps", "git", "current");
  return roots;
}

/**
 * Find Git Bash on Windows. Returns { path, via } or null.
 * Never returns WSL's bash.
 */
export function findGitBash(env = process.env) {
  const tried = [];
  const accept = (p, via) => {
    tried.push(p);
    if (p && isFile(p) && !isForbiddenBash(p)) return { path: p, via };
    return null;
  };

  if (env.CLEARAID_GIT_BASH) {
    const hit = accept(env.CLEARAID_GIT_BASH, "CLEARAID_GIT_BASH");
    if (hit) return hit;
  }

  // 1. Well-known install locations.
  for (const root of gitRootCandidates(env)) {
    const hit = accept(path.join(root, "bin", "bash.exe"), "install folder");
    if (hit) return hit;
  }

  // 2. Ask git itself: `git --exec-path` is <GitRoot>/mingw64/libexec/git-core (or
  //    <GitRoot>/libexec/git-core on some builds), so walk up and look for bin/bash.exe.
  const g = spawnSync("git", ["--exec-path"], { encoding: "utf8", timeout: 10000, windowsHide: true });
  if (g.status === 0 && g.stdout.trim()) {
    const exec = g.stdout.trim();
    for (const up of [2, 3, 4]) {
      let dir = exec;
      for (let i = 0; i < up; i++) dir = path.dirname(dir);
      const hit = accept(path.join(dir, "bin", "bash.exe"), "git --exec-path");
      if (hit) return hit;
    }
  }

  // 3. Any bash.exe on PATH that is not WSL / a Store stub (for example MSYS2).
  for (const dir of (env.PATH || env.Path || "").split(path.delimiter)) {
    if (!dir) continue;
    const hit = accept(path.join(dir, "bash.exe"), "PATH");
    if (hit) return hit;
  }
  return null;
}

export const GIT_BASH_HELP = [
  "Git Bash was not found. On Windows this project runs its setup script with Git Bash.",
  "Install Git for Windows (it includes Git Bash):",
  "  winget install --id Git.Git -e",
  "  or download https://git-scm.com/download/win",
  "Then OPEN A NEW terminal and run the command again.",
  "Note: C:\\Windows\\System32\\bash.exe is WSL, not Git Bash, and cannot be used.",
  "If Git is installed somewhere unusual, set CLEARAID_GIT_BASH to the full path of its bin\\bash.exe.",
].join("\n");

/** Run a command, return { ok, out } without throwing. */
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 30000, windowsHide: true, ...opts });
  return {
    ok: !r.error && r.status === 0,
    missing: Boolean(r.error && r.error.code === "ENOENT"),
    timedOut: Boolean(r.error && r.error.code === "ETIMEDOUT"),
    out: `${r.stdout || ""}${r.stderr || ""}`.trim(),
  };
}

export function fileExists(p) {
  return existsSync(p);
}
