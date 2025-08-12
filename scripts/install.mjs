// Installs native Git hooks that call commit-shield
import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const hooksDir = path.join(root, '.git', 'hooks');
const shield = path.join(root, 'scripts', 'commit-shield.mjs');

if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

for (const hook of ['pre-commit', 'pre-push']) {
  const p = path.join(hooksDir, hook);
  const content = `#!/bin/sh
node \`git rev-parse --show-toplevel\`/scripts/commit-shield.mjs ${hook} 
`;
  writeFileSync(p, content, 'utf8');
  chmodSync(p, 0o755);
  console.log(`Installed ${hook} hook → ${p}`);
}

console.log('commit-shield installed.');
