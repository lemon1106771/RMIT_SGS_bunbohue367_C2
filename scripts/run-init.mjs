#!/usr/bin/env node
// `npm run init` entry point. Runs scripts/init-tidecloak.sh with the right bash on every OS:
//   macOS / Linux : the bash on PATH
//   Windows       : Git Bash (never WSL's C:\Windows\System32\bash.exe)
// Node only, no dependencies.
//
// Dry run (prints the chosen shell, starts nothing): CLEARAID_INIT_DRY_RUN=1 node scripts/run-init.mjs

import { spawn } from "node:child_process";
import path from "node:path";
import { findGitBash, GIT_BASH_HELP, isWindows, repoRoot } from "./platform.mjs";

const script = path.join("scripts", "init-tidecloak.sh");
const extraArgs = process.argv.slice(2);

let shell = "bash";
let shellArgs = [script, ...extraArgs];
const env = { ...process.env };

if (isWindows) {
  const found = findGitBash();
  if (!found) {
    console.error(GIT_BASH_HELP);
    process.exit(1);
  }
  shell = found.path;
  // -l gives Git Bash its full PATH (curl, jq installed under Git's usr/bin or mingw64/bin);
  // CHERE_INVOKING keeps the working directory instead of jumping to the home folder.
  shellArgs = ["-l", script.replace(/\\/g, "/"), ...extraArgs];
  env.CHERE_INVOKING = "1";
  if (process.env.CLEARAID_INIT_DRY_RUN) console.log(`shell resolved via ${found.via}`);
}

if (process.env.CLEARAID_INIT_DRY_RUN) {
  console.log(`shell: ${shell}`);
  console.log(`args:  ${shellArgs.join(" ")}`);
  console.log(`cwd:   ${repoRoot}`);
  process.exit(0);
}

const child = spawn(shell, shellArgs, { cwd: repoRoot, env, stdio: "inherit" });

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error(isWindows ? GIT_BASH_HELP : "bash was not found on PATH. Install bash and try again.");
  } else {
    console.error(`Could not start ${shell}: ${err.message}`);
  }
  process.exit(1);
});

// Let the shell script handle Ctrl+C itself; just make sure we exit with its status.
process.on("SIGINT", () => {});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
