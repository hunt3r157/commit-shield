#!/usr/bin/env node
// commit-shield: tiny pre-commit / pre-push guard (no deps)
// Works on Node 18+. MIT License.

import { execSync } from 'node:child_process';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = exec('git rev-parse --show-toplevel').trim();
const CONFIG_PATH = path.join(ROOT, 'commit-shield.config.json');

const ANSI = {
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
};

const DEFAULTS = {
  maxFileSizeMB: 5,
  disallowGlobs: [
    'node_modules/**',
    'dist/**',
    'build/**',
  ],
  disallowFilenames: [
    '.env', '.env.*',
    '*serviceAccount*.json',
    '*-firebase-adminsdk-*.json',
  ],
  disallowContentPatterns: [
    '-----BEGIN [A-Z ]*PRIVATE KEY-----',
    '"type"\s*:\s*"service_account"',
    '"private_key"\s*:\s*"-----BEGIN',
    'AIza[0-9A-Za-z_\-]{35}',
    'AKIA[0-9A-Z]{16}',
    'ghp_[0-9A-Za-z]{36}',
    'xox[baprs]-[0-9A-Za-z-]+'
  ],
  ignoreGlobs: [
    '.git/**',
  ],
};

const config = (() => {
  try { return existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {}; }
  catch { return {}; }
})();

const CFG = { ...DEFAULTS, ...config };

const HOOK = process.argv[2] || 'pre-commit';
const staged = listStaged();
const problems = [];

const disallowRegexes = [
  ...CFG.disallowGlobs.map(globToRegex),
  ...CFG.disallowFilenames.map(globToRegex),
];
const ignoreRegexes = CFG.ignoreGlobs.map(globToRegex);
const contentRegexes = CFG.disallowContentPatterns.map(p => new RegExp(p, 'm'));

for (const file of staged) {
  if (isIgnored(file)) continue;
  // path rules
  for (const rx of disallowRegexes) {
    if (rx.test(file)) {
      problems.push({ file, rule: `Path matches disallowed pattern: ${rx.source}` });
      break;
    }
  }
  // size rule
  try {
    const sizeMB = statSync(path.join(ROOT, file)).size / (1024 * 1024);
    if (sizeMB > CFG.maxFileSizeMB) {
      problems.push({ file, rule: `File too large (${sizeMB.toFixed(2)} MB > ${CFG.maxFileSizeMB} MB)` });
    }
  } catch {}
  // content rules (only if file is text-ish and <= 1.5 MB)
  try {
    const s = statSync(path.join(ROOT, file));
    if (s.size <= 1.5 * 1024 * 1024) {
      const buf = readFileSync(path.join(ROOT, file));
      if (looksText(buf)) {
        const text = buf.toString('utf8');
        for (const rx of contentRegexes) {
          if (rx.test(text)) {
            problems.push({ file, rule: `Suspicious content: /${rx.source}/` });
          }
        }
      }
    }
  } catch {}
}

if (problems.length) {
  console.error(ANSI.red(`\n✖ Commit blocked by commit-shield (${problems.length} issue${problems.length>1?'s':''})`));
  for (const p of problems) {
    console.error(`  • ${ANSI.bold(p.file)} — ${p.rule}`);
  }
  console.error(`\n${ANSI.yellow('Fix the issues, or bypass with')} git commit --no-verify`);
  console.error(`${ANSI.cyan('Customize rules in')} commit-shield.config.json`);
  process.exit(1);
}

console.log(ANSI.green('✓ commit-shield checks passed'));
process.exit(0);

// ————— helpers —————
function exec(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}

function listStaged() {
  // staged (added/modified/copied/renamed) files for commit
  const out = exec('git diff --cached --name-only -z');
  const files = out.split('\0').filter(Boolean);
  // On pre-push, if nothing staged, fallback to last commit as a courtesy
  if (!files.length && HOOK === 'pre-push') {
    let base, head;
    try {
      base = exec('git rev-parse HEAD^').trim();
    } catch {
      // first commit on branch: compare to empty tree
      base = exec('git hash-object -t tree /dev/null').trim();
    }
    head = exec('git rev-parse HEAD').trim();
    const changed = exec(`git diff --name-only -z ${base} ${head}`).split('\0').filter(Boolean);
    return changed;
  }
  return files;
}

function isIgnored(file) {
  return ignoreRegexes.some(rx => rx.test(file));
}

function globToRegex(glob) {
  // simple glob -> regex (supports **, *, ?, and dotfiles)
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i+1] === '*') { re += '.*'; i++; } else { re += '[^/]*'; }
    } else if (c === '?') {
      re += '.';
    } else if ('\.^$+{}()|[]'.includes(c)) {
      re += '\\' + c;
    } else if (c === '/') {
      re += '/';
    } else {
      re += c;
    }
  }
  re += '$';
  return new RegExp(re);
}

function looksText(buf) {
  // Treat as text if most bytes are printable or whitespace
  let printable = 0;
  const len = Math.min(buf.length, 4096);
  for (let i = 0; i < len; i++) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126)) printable++;
  }
  return printable / len > 0.8;
}
