// scripts/rin-bump.cjs
//
// Bump the fork-local .rin.N counter and write the new value into
// package.json's "version" field. electron-builder validates this field
// via semver, so we write the SEMVER form ("0.14.5-rin.0", dash) there.
// The DISPLAY form ("0.14.5.rin.0", period) is what we want users to
// see and what electron-builder.config.cjs uses for artifactName —
// it reads that from .rin-version.
//
//   Display (user-visible):   0.14.5.rin.0
//   Semver (package.json):    0.14.5-rin.0
//   Artifact filename:        Wave-win32-x64-0.14.5.rin.0.exe
//
// State files (both gitignored):
//   .rin-version        — current DISPLAY version, e.g. "0.14.5.rin.0"
//   .rin-version-prev   — saved semver form of package.json, for restore
//
// Usage:
//   node scripts/rin-bump.cjs          # bump + write to package.json
//   node scripts/rin-bump.cjs --reset  # reset to 0.14.5.rin.0
//   node scripts/rin-bump.cjs --restore  # restore package.json to saved
//   node scripts/rin-bump.cjs --print  # just print current display version

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const RIN_FILE = path.resolve(repoRoot, ".rin-version");
const RIN_PREV_FILE = path.resolve(repoRoot, ".rin-version-prev");
const pkgPath = path.resolve(repoRoot, "package.json");

function readPackage() {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
}

function writePackage(pkg) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");
}

function readRin() {
    if (!fs.existsSync(RIN_FILE)) return null;
    const v = fs.readFileSync(RIN_FILE, "utf8").trim();
    return v || null;
}

function writeRin(v) {
    fs.writeFileSync(RIN_FILE, v + "\n");
}

// Extract base major.minor.patch and prerelease counter from either form:
//   "0.14.5"        -> { base: "0.14.5", n: null }
//   "0.14.5.rin.0"  -> { base: "0.14.5", n: 0 }
//   "0.14.5-rin.0"  -> { base: "0.14.5", n: 0 }
function parseRin(v) {
    const m = /^(\d+\.\d+\.\d+)(?:[\.\-]rin\.(\d+))?$/.exec(v ?? "");
    if (!m) return null;
    return { base: m[1], n: m[2] ? parseInt(m[2], 10) : null };
}

function displayToSemver(display) {
    return display.replace(/\.rin\.(\d+)$/, "-rin.$1");
}

function semverToDisplay(semver) {
    return semver.replace(/-rin\.(\d+)$/, ".rin.$1");
}

function bump() {
    const pkg = readPackage();
    const base = parseRin(pkg.version)?.base;
    if (!base) {
        throw new Error(`package.json version "${pkg.version}" doesn't look like X.Y.Z[.rin.N|-rin.N]`);
    }
    const cur = parseRin(readRin() ?? pkg.version);
    const nextN = (cur?.n ?? -1) + 1;
    const nextDisplay = `${base}.rin.${nextN}`;
    const nextSemver = `${base}-rin.${nextN}`;

    // Save previous pkg.version (semver form) for restore (only first time)
    if (!fs.existsSync(RIN_PREV_FILE) && pkg.version !== nextSemver) {
        fs.writeFileSync(RIN_PREV_FILE, pkg.version + "\n");
    }

    pkg.version = nextSemver;
    writePackage(pkg);
    writeRin(nextDisplay);
    const prevStr = cur && cur.n != null ? semverToDisplay(`${cur.base}-rin.${cur.n}`) : cur ? cur.base : "(unset)";
    console.log(`[rin] ${prevStr} -> ${nextDisplay}`);
    return nextDisplay;
}

function reset() {
    const pkg = readPackage();
    const base = parseRin(pkg.version)?.base;
    if (!base) {
        throw new Error(`package.json version "${pkg.version}" doesn't look like X.Y.Z[.rin.N|-rin.N]`);
    }
    const nextDisplay = `${base}.rin.0`;
    const nextSemver = `${base}-rin.0`;

    if (!fs.existsSync(RIN_PREV_FILE) && pkg.version !== nextSemver) {
        fs.writeFileSync(RIN_PREV_FILE, pkg.version + "\n");
    }

    pkg.version = nextSemver;
    writePackage(pkg);
    writeRin(nextDisplay);
    console.log(`[rin] reset -> ${nextDisplay}`);
    return nextDisplay;
}

function restore() {
    if (!fs.existsSync(RIN_PREV_FILE)) {
        console.log("[rin] nothing to restore (.rin-version-prev missing)");
        return null;
    }
    const prev = fs.readFileSync(RIN_PREV_FILE, "utf8").trim();
    const pkg = readPackage();
    pkg.version = prev;
    writePackage(pkg);
    fs.unlinkSync(RIN_PREV_FILE);
    console.log(`[rin] restored package.json version -> ${prev}`);
    return prev;
}

const arg = process.argv[2];
if (arg === "--reset") {
    reset();
} else if (arg === "--restore") {
    restore();
} else if (arg === "--print") {
    console.log(readRin() ?? semverToDisplay(readPackage().version));
} else {
    bump();
}
