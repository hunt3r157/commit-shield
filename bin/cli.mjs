// ESM CLI for commit-shield
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync, statSync } from 'node:fs';
import path, { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const cmd   = args[0] || 'help';
const HOOK  = (args[1] && !args[1].startsWith('-')) ? args[1] : 'pre-commit';
const NO_HOOKS = args.includes('--no-hooks');

const ROOT = getGitRoot() || process.cwd();
const SCRIPTS_DIR = join(ROOT, 'scripts');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT  = join(__dirname, '..');

// Always read sources bundled inside the npm package:
const GUARD_SOURCE   = readFileSync(join(PKG_ROOT, 'scripts', 'commit-shield.mjs'), 'utf8');
const INSTALL_SOURCE = readFileSync(join(PKG_ROOT, 'scripts', 'install.mjs'), 'utf8');

// ------- commands -------
if (cmd === 'init') {
  mkdirSync(SCRIPTS_DIR, { recursive: true });
  const guardPath = join(SCRIPTS_DIR, 'commit-shield.mjs');
  const installPath = join(SCRIPTS_DIR, 'install.mjs');

  writeFileSync(guardPath, GUARD_SOURCE, 'utf8');
  chmodSync(guardPath, 0o755);
  writeFileSync(installPath, INSTALL_SOURCE, 'utf8');

  if (!NO_HOOKS) execSync(`node "${installPath}"`, { stdio: 'inherit' });
  console.log('commit-shield initialized.');
  process.exit(0);
}

if (cmd === 'check') {
  const problems = runChecks({ hook: HOOK, root: ROOT });
  if (problems.length) {
    for (const p of problems) console.error(`• ${p.file} — ${p.rule}`);
    process.exit(1);
  }
  console.log('✓ commit-shield checks passed');
  process.exit(0);
}

console.log(`commit-shield — tiny pre-commit & pre-push guard
Usage:
  npx commit-shield init [--no-hooks]
  npx commit-shield check [pre-commit|pre-push]
`);
process.exit(1);

// ------- helpers -------
function getGitRoot() {
  try { return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

function runChecks({ hook, root }) {
  const CONFIG_PATH = join(root, 'commit-shield.config.json');
  const DEFAULTS = {
    maxFileSizeMB: 5,
    disallowGlobs: ['node_modules/**','dist/**','build/**'],
    disallowFilenames: ['.env','.env.*','*serviceAccount*.json','*-firebase-adminsdk-*.json'],
    disallowContentPatterns: [
      '-----BEGIN [A-Z ]*PRIVATE KEY-----',
      '\\"type\\"\\s*:\\s*\\"service_account\\"',
      '\\"private_key\\"\\s*:\\s*\\"-----BEGIN',
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

  const disallowRegexes = [
    ...CFG.disallowGlobs.map(globToRegex),
    ...CFG.disallowFilenames.map(globToRegex),
  ];
  const ignoreRegexes = CFG.ignoreGlobs.map(globToRegex);
  const contentRegexes = CFG.disallowContentPatterns.map(p => new RegExp(p, 'm'));

  const files = listFiles({ hook, root });
  const problems = [];

  for (const file of files) {
    if (ignoreRegexes.some(rx => rx.test(file))) continue;

    for (const rx of disallowRegexes) {
      if (rx.test(file)) { problems.push({ file, rule: `Path matches disallowed pattern: ${rx.source}` }); break; }
    }

    try {
      const sizeMB = statSync(join(root, file)).size / (1024 * 1024);
      if (sizeMB > CFG.maxFileSizeMB) problems.push({ file, rule: `File too large (${sizeMB.toFixed(2)} MB > ${CFG.maxFileSizeMB} MB)` });
    } catch {}

    try {
      const s = statSync(join(root, file));
      if (s.size <= 1.5 * 1024 * 1024) {
        const buf = readFileSync(join(root, file));
        if (looksText(buf)) {
          const text = buf.toString('utf8');
          for (const rx of contentRegexes) if (rx.test(text)) problems.push({ file, rule: `Suspicious content: /${rx.source}/` });
        }
      }
    } catch {}
  }
  return problems;
}

function listFiles({ hook, root }) {
  function sh(c) { return execSync(c, { encoding: 'utf8' }); }
  const out = sh('git diff --cached --name-only -z');
  const files = out.split('\0').filter(Boolean);
  if (!files.length && hook === 'pre-push') {
    let base, head;
    try { base = sh('git rev-parse HEAD^').trim(); }
    catch { base = sh('git hash-object -t tree /dev/null').trim(); }
    head = sh('git rev-parse HEAD').trim();
    return sh(`git diff --name-only -z ${base} ${head}`).split('\0').filter(Boolean);
  }
  return files;
}

function globToRegex(glob) {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i+1] === '**'[0]) { re += '.*'; i++; } else { re += '[^/]*'; }
    } else if (c === '?') re += '.';
    else if ('\\.^$+{}()|[]'.includes(c)) re += '\\' + c;
    else if (c === '/') re += '/';
    else re += c;
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
