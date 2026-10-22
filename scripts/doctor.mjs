#!/usr/bin/env node
// `npm run doctor`: checks that this machine can run `npm run init` and `npm run dev`.
// One line per check, OK or FAIL plus the fix. Exit code 1 if anything fails.
// Node only, no dependencies. Never prints the contents of .env.
//
//   node scripts/doctor.mjs            run the checks
//   node scripts/doctor.mjs --fix-env  also rewrite .env with LF line endings

import net from "node:net";
import path from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { findGitBash, isWindows, platform, repoRoot, run } from "./platform.mjs";

const results = [];
const check = (name, ok, detail, fix) => {
  results.push({ name, ok });
  const tag = ok ? "[ OK ]" : "[FAIL]";
  console.log(`${tag} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok && fix) {
    for (const line of String(fix).split("\n")) console.log(`       fix: ${line}`);
  }
};

const mac = platform === "darwin";
console.log(`WholeLeaf doctor (${platform}, ${process.arch}, Node ${process.versions.node})\n`);

// --- Node ---------------------------------------------------------------------------------
const major = Number(process.versions.node.split(".")[0]);
check(
  "Node.js >= 20",
  major >= 20,
  `found ${process.versions.node}`,
  "install the current LTS from https://nodejs.org (or: winget install OpenJS.NodeJS.LTS / brew install node), then open a new terminal",
);

// --- Dependencies installed -----------------------------------------------------------------
check(
  "npm dependencies installed",
  existsSync(path.join(repoRoot, "node_modules", "next")),
  "",
  "run: npm install",
);

// --- Git Bash (Windows) ---------------------------------------------------------------------
let gitBash = null;
if (isWindows) {
  gitBash = findGitBash();
  check(
    "Git Bash (Windows)",
    Boolean(gitBash),
    gitBash ? gitBash.path : "not found (C:\\Windows\\System32\\bash.exe is WSL and does not count)",
    "install Git for Windows: winget install --id Git.Git -e   (or https://git-scm.com/download/win)\nthen OPEN A NEW terminal. If Git is in an unusual folder, set CLEARAID_GIT_BASH to its bin\\bash.exe",
  );
}

// --- Docker ---------------------------------------------------------------------------------
const dockerVersion = run("docker", ["--version"]);
check(
  "docker installed",
  dockerVersion.ok,
  dockerVersion.ok ? dockerVersion.out : "",
  mac
    ? "install Docker Desktop: https://www.docker.com/products/docker-desktop/ (or: brew install --cask docker), then start it"
    : "install Docker Desktop: https://www.docker.com/products/docker-desktop/ (or: winget install Docker.DockerDesktop), start it, then open a new terminal",
);

let daemonUp = false;
if (dockerVersion.ok) {
  const info = run("docker", ["info", "--format", "{{.OSType}}"], { timeout: 30000 });
  daemonUp = info.ok;
  const osType = info.out.split("\n").pop().trim();
  check(
    "docker daemon running",
    info.ok,
    info.ok ? `${osType} containers` : info.timedOut ? "docker info timed out" : "",
    "start Docker Desktop and wait until it reports 'running' (whale icon steady), then re-run this check",
  );
  if (info.ok && osType === "windows") {
    check("docker uses Linux containers", false, "Windows containers are active", "right-click the Docker Desktop tray icon -> Switch to Linux containers");
  }
} else {
  check("docker daemon running", false, "skipped (docker not installed)", "install Docker first");
}

// --- jq and curl (the init script needs them; on Windows they must be visible inside Git Bash) -
function toolCheck(tool, fixMac, fixWin, fixLinux) {
  if (isWindows) {
    if (gitBash) {
      const r = run(gitBash.path, ["-l", "-c", `command -v ${tool}`], { env: { ...process.env, CHERE_INVOKING: "1" } });
      check(`${tool} (inside Git Bash)`, r.ok, r.ok ? r.out.split("\n").pop() : "", fixWin);
    } else {
      const r = run(tool, ["--version"]);
      check(`${tool}`, r.ok, r.ok ? r.out.split("\n")[0].slice(0, 40) : "Git Bash not found, checked the normal PATH only", fixWin);
    }
  } else {
    const r = run(tool, ["--version"]);
    check(tool, r.ok, r.ok ? r.out.split("\n")[0].slice(0, 40) : "", mac ? fixMac : fixLinux);
  }
}
toolCheck("jq", "brew install jq", "winget install jqlang.jq   then CLOSE and reopen the terminal (so PATH refreshes)", "sudo apt install jq   (or your distro's package manager)");
toolCheck("curl", "curl ships with macOS; reinstall Xcode command line tools: xcode-select --install", "curl ships with Git for Windows; reinstall Git for Windows", "sudo apt install curl");

// --- Ports ----------------------------------------------------------------------------------
function connects(port, host) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    const done = (v) => {
      s.destroy();
      resolve(v);
    };
    s.setTimeout(1500, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}
function canListen(port, host) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", (e) => resolve(e.code === "EADDRINUSE" || e.code === "EACCES" ? false : true));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}
async function portFree(port) {
  // Connect probes catch listeners that a bind probe misses (macOS lets a wildcard bind succeed next
  // to a 127.0.0.1-only listener); the bind probes catch listeners that refuse our connection.
  if (await connects(port, "127.0.0.1")) return false;
  if (await connects(port, "::1")) return false;
  if (!(await canListen(port))) return false;
  if (!(await canListen(port, "127.0.0.1"))) return false;
  return true;
}
async function ownTideCloak() {
  if (!daemonUp) return false;
  const r = run("docker", ["ps", "--filter", "name=^tidecloak$", "--format", "{{.Names}}"]);
  return r.ok && r.out.split("\n").includes("tidecloak");
}

const free8080 = await portFree(8080);
if (free8080) {
  check("port 8080 free (TideCloak)", true, "");
} else if (await ownTideCloak()) {
  check("port 8080 free (TideCloak)", true, "held by the existing 'tidecloak' container; npm run init replaces it");
} else {
  check(
    "port 8080 free (TideCloak)",
    false,
    "something is listening on it",
    isWindows
      ? "find it: netstat -ano | findstr :8080   then stop that program (or: docker ps)"
      : "find it: lsof -nP -iTCP:8080 -sTCP:LISTEN   then stop that program (or: docker ps)",
  );
}
check(
  "port 3000 free (the app)",
  await portFree(3000),
  "",
  isWindows
    ? "find it: netstat -ano | findstr :3000   then stop that program (probably an old 'npm run dev')"
    : "find it: lsof -nP -iTCP:3000 -sTCP:LISTEN   then stop that program (probably an old 'npm run dev')",
);

// --- .env -----------------------------------------------------------------------------------
const envPath = path.join(repoRoot, ".env");
const hasEnv = existsSync(envPath);
check(".env exists", hasEnv, "", "copy .env.example to .env (Mac: cp .env.example .env   Windows cmd: copy .env.example .env) and fill it in");

if (hasEnv) {
  let raw = readFileSync(envPath, "utf8");
  const hasCrlf = raw.includes("\r");
  if (hasCrlf && process.argv.includes("--fix-env")) {
    raw = raw.replace(/\r\n?/g, "\n");
    writeFileSync(envPath, raw);
    console.log("       (--fix-env: rewrote .env with LF line endings)");
    check(".env uses LF line endings", true, "fixed just now");
  } else {
    check(
      ".env uses LF line endings",
      !hasCrlf,
      hasCrlf ? "found Windows CRLF line endings" : "",
      "run: node scripts/doctor.mjs --fix-env   (or in your editor switch the line ending of .env to LF)",
    );
  }

  const vars = {};
  for (let line of raw.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    line = line.replace(/^export\s+/, "");
    const i = line.indexOf("=");
    if (i < 1) continue;
    let v = line.slice(i + 1).trim();
    if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) v = v.slice(1, -1);
    vars[line.slice(0, i).trim()] = v;
  }
  const keys = [
    ["KC_BOOTSTRAP_ADMIN_PASSWORD", "choose a password for the local TideCloak admin and put it after the = sign"],
    ["TIDE_LICENSE_EMAIL", "put a real email address you control after the = sign (placeholders like example.com are rejected)"],
    ["TIDE_TERMS_ACCEPTED", "set it to yes only after reading https://tide.org/legal and agreeing"],
  ];
  for (const [key, fix] of keys) {
    const fromEnv = (process.env[key] || "").trim() !== "";
    const set = (vars[key] || "") !== "" || fromEnv;
    check(`.env has ${key}`, set, set ? "set (value hidden)" : "missing or empty", `${fix} (file: ${envPath})`);
  }
}

// --- Summary --------------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0
    ? "\nAll checks passed. Next: npm run init (first time only), then npm run dev."
    : `\n${failed} check${failed === 1 ? "" : "s"} failed. Fix the items above and run: npm run doctor`,
);
process.exit(failed === 0 ? 0 : 1);
