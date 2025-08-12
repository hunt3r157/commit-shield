#!/usr/bin/env node
// commit-shield CLI (npx-friendly)
// Commands:
//   commit-shield init [--no-hooks]    -> writes scripts into ./scripts and installs git hooks
//   commit-shield check [pre-commit|pre-push] -> runs checks without installing anything
// Node 18+

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const cmd = args[0] || 'help';
const HOOK = (args[1] && !args[1].startsWith('-')) ? args[1] : 'pre-commit';
const NO_HOOKS = args.includes('--no-hooks');

const ROOT = getGitRoot() || process.cwd();
const SCRIPTS_DIR = path.join(ROOT, 'scripts');

if (cmd === 'init') {
  mkdirSync(SCRIPTS_DIR, { recursive: true });
  // Write guard and installer
  writeFileSync(path.join(SCRIPTS_DIR, 'commit-shield.mjs'), GUARD_SOURCE, 'utf8');
  writeFileSync(path.join(SCRIPTS_DIR, 'install.mjs'), INSTALL_SOURCE, 'utf8');
  chmodSync(path.join(SCRIPTS_DIR, 'commit-shield.mjs'), 0o755);

  if (!NO_HOOKS) {
    try {
      execSync(`node ${path.join(SCRIPTS_DIR, 'install.mjs')}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }

  console.log('commit-shield initialized.');
  process.exit(0);
}

if (cmd === 'check') {
  const problems = runChecks({ hook: HOOK, root: ROOT });
  if (problems.length) {
    for (const p of problems) {
      console.error(`• ${p.file} — ${p.rule}`);
    }
    process.exit(1);
  } else {
    console.log('✓ commit-shield checks passed');
    process.exit(0);
  }
}

console.log(`
commit-shield — tiny pre-commit & pre-push guard
Usage:
  npx commit-shield init [--no-hooks]
  npx commit-shield check [pre-commit|pre-push]
`);
process.exit(1);

// --------------- helpers & embedded sources ---------------
function getGitRoot() {
  try { return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

const GUARD_SOURCE = `#!/usr/bin/env node
${readFileSync(path.join(ROOT, 'scripts', 'commit-shield.mjs'), 'utf8') if existsSync(path.join(ROOT, 'scripts', 'commit-shield.mjs')) else ""}`;

const INSTALL_SOURCE = `// Installs native Git hooks that call commit-shield
import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = ( () => { try { return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); } catch { return process.cwd(); } } )();
const hooksDir = path.join(root, '.git', 'hooks');

if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

for (const hook of ['pre-commit', 'pre-push']) {
  const p = path.join(hooksDir, hook);
  const content = \`#!/bin/sh
node \\`git rev-parse --show-toplevel\\`/scripts/commit-shield.mjs \${hook} 
\`;
  writeFileSync(p, content, 'utf8');
  chmodSync(p, 0o755);
  console.log(\`Installed \${hook} hook → \${p}\`);
}

console.log('commit-shield installed.');
`;

// An inline implementation of the guard to support `npx commit-shield check` without installing files.
function runChecks({ hook, root }) {
  const CONFIG_PATH = path.join(root, 'commit-shield.config.json');
  const DEFAULTS = {
    maxFileSizeMB: 5,
    disallowGlobs: ['node_modules/**','dist/**','build/**'],
    disallowFilenames: ['.env','.env.*','*serviceAccount*.json','*-firebase-adminsdk-*.json'],
    disallowContentPatterns: [
      '-----BEGIN [A-Z ]*PRIVATE KEY-----',
      '\"type\"\\s*:\\s*\"service_account\"',
      '\"private_key\"\\s*:\\s*\"-----BEGIN',
      'AIza[0-9A-Za-z_\\-]{35}',
      'AKIA[0-9A-Z]{16}',
      'ghp_[0-9A-Za-z]{36}',
      'xox[baprs]-[0-9A-Za-z-]+'
    ],
    ignoreGlobs: ['.git/**'],
  };
  let userCfg = {};
  try { if (existsSync(CONFIG_PATH)) userCfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); } catch {}

  const CFG = { ...DEFAULTS, ...userCfg };
  const problems = [];

  const disallowRegexes = [
    ...CFG.disallowGlobs.map(globToRegex),
    ...CFG.disallowFilenames.map(globToRegex),
  ];
  const ignoreRegexes = CFG.ignoreGlobs.map(globToRegex);
  const contentRegexes = CFG.disallowContentPatterns.map(p => new RegExp(p, 'm'));

  const files = listFiles({ hook, root });
  for (const file of files) {
    if (ignoreRegexes.some(rx => rx.test(file))) continue;
    for (const rx of disallowRegexes) {
      if (rx.test(file)) {
        problems.push({ file, rule: \`Path matches disallowed pattern: \${rx.source}\` });
        break;
      }
    }
    try {
      const sizeMB = statSync(path.join(root, file)).size / (1024 * 1024);
      if (sizeMB > CFG.maxFileSizeMB) {
        problems.push({ file, rule: \`File too large (\${sizeMB.toFixed(2)} MB > \${CFG.maxFileSizeMB} MB)\` });
      }
    } catch {}
    try {
      const s = statSync(path.join(root, file));
      if (s.size <= 1.5 * 1024 * 1024) {
        const buf = readFileSync(path.join(root, file));
        if (looksText(buf)) {
          const text = buf.toString('utf8');
          for (const rx of contentRegexes) {
            if (rx.test(text)) {
              problems.push({ file, rule: \`Suspicious content: /\${rx.source}/\` });
            }
          }
        }
      }
    } catch {}
  }
  return problems;
}

function listFiles({ hook, root }) {
  function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }
  const out = sh('git diff --cached --name-only -z');
  const files = out.split('\0').filter(Boolean);
  if (!files.length && hook === 'pre-push') {
    let base, head;
    try { base = sh('git rev-parse HEAD^').trim(); }
    catch { base = sh('git hash-object -t tree /dev/null').trim(); }
    head = sh('git rev-parse HEAD').trim();
    return sh(\`git diff --name-only -z \${base} \${head}\`).split('\0').filter(Boolean);
  }
  return files;
}

function globToRegex(glob) {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i+1] === '*') { re += '.*'; i++; } else { re += '[^/]*'; }
    } else if (c === '?') {
      re += '.';
    } else if ('\\.^$+{}()|[]'.includes(c)) {
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
  let printable = 0;
  const len = Math.min(buf.length, 4096);
  for (let i = 0; i < len; i++) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126)) printable++;
  }
  return printable / len > 0.8;
}
