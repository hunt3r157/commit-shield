Commit-shield

Tiny, zero‑dependency pre-commit / pre-push guard for Git that prevents secrets, giant files, and junk from entering your repo. Works with plain Git hooks and Node ≥ 18. CI re-check included.




Table of contents

Overview

Key capabilities

How it works

Install

Option A — npx (recommended)

Option B — manual install

Monorepos

Configuration

Schema

Examples

CI integration (GitHub Actions)

Enterprise rollout patterns

Security & compliance

Troubleshooting

FAQ

Roadmap

Versioning & release

Contributing

Support

License

Overview

commit-shield is a lightweight guard rail for teams that want immediate, local protection against accidental leaks and noisy commits. It ships as:

Local hooks (pre-commit & pre-push) — zero extra tooling like Husky required

Regex‑based content checks — catches common secrets (keys/tokens)

Path/size filters — blocks node_modules/, build artifacts, and files > 5 MB by default

CI re-check — ensures server‑side enforcement on PRs/pushes

No telemetry, no network calls — privacy‑first by design

Key capabilities

Detects private keys, Google service accounts, AWS access keys, GitHub PATs, Slack tokens, .env files, and more

Blocks large files (default > 5 MB) and junk paths (node_modules/**, dist/**, build/**)

Simple JSON configuration per repo

Fails fast with actionable output and an intentional --no-verify escape hatch (policy‑controlled via CI)

How it works

The hook inspects staged files (git diff --cached) for pre-commit. For pre-push, it checks the last commit range as a courtesy.

It applies three classes of rules:

Path rules (globs): block known junk folders and dangerous filenames

Size rule: block files larger than a configurable threshold

Content rules (regex): scan text-ish files for common secret patterns

Text detection is a simple heuristic to avoid scanning binaries.

Install

Requires Node ≥ 18 and Git.

Option A — npx (recommended)

# inside your git repo
npx commit-shield init
# re-run safely for teammates at any time

Run a one-off check without installing hooks:

npx commit-shield check pre-push

Option B — manual install

mkdir -p scripts
# copy these two files from this repo to your project
cp scripts/commit-shield.mjs scripts/install.mjs ./scripts/
node scripts/install.mjs

Add a convenience script (optional):

// package.json
{
  "scripts": { "commit-shield:init": "node scripts/install.mjs" }
}

Monorepos

Install once at the top-level repo. Hooks apply across packages.

If you need per‑package policy, commit a commit-shield.config.json at the repo root (global rules) and add package‑specific patterns via CI jobs.

Configuration

Create commit-shield.config.json in the repo root. All keys are optional.

Schema

{
  "maxFileSizeMB": 5,
  "disallowGlobs": ["node_modules/**", "dist/**", "build/**"],
  "disallowFilenames": [".env", ".env.*", "*serviceAccount*.json", "*-firebase-adminsdk-*.json"],
  "disallowContentPatterns": [
    "-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "\\"type\\"\\s*:\\s*\\"service_account\\"",
    "\\"private_key\\"\\s*:\\s*\\"-----BEGIN",
    "AIza[0-9A-Za-z_\\-]{35}",
    "AKIA[0-9A-Z]{16}",
    "ghp_[0-9A-Za-z]{36}",
    "xox[baprs]-[0-9A-Za-z-]+"
  ],
  "ignoreGlobs": [".git/**"]
}

Notes

Patterns are treated as regex for disallowContentPatterns and globs for disallowGlobs/disallowFilenames.

Keep ignoreGlobs small — it acts as a hard exclude.

Examples

Block media and archives, raise file size limit to 10 MB:

{
  "maxFileSizeMB": 10,
  "disallowGlobs": [
    "node_modules/**", "dist/**", "build/**",
    "**/*.zip", "**/*.tar", "**/*.gz", "**/*.7z",
    "**/*.mp4", "**/*.mov", "**/*.mp3"
  ]
}

Add Azure & Stripe patterns:

{
  "disallowContentPatterns": [
    "(?:sv|sp|sig|se|sr)=[A-Za-z0-9%]+&sig=[A-Za-z0-9%/+]+",   
    "sk_live_[0-9a-zA-Z]{24}"                                 
  ]
}

CI integration (GitHub Actions)

This repo includes:

.github/workflows/ci.yml — runs commit-shield in a pre‑push style on pushes/PRs

.github/workflows/release.yml — publishes to npm on tags v*.*.* when NPM_TOKEN is configured

Minimal CI job (inline example):

name: commit-shield CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node scripts/commit-shield.mjs pre-push

Enterprise enforcement: Protect your main branches to require the CI check to pass. This neutralizes local --no-verify bypasses.

Enterprise rollout patterns

Template repos: bake commit-shield into your org templates.

Org policy: branch protection with required status checks.

Monorepo: configure at root; optionally run per‑package CI matrix jobs with different patterns.

Education: document a standard bypass policy (e.g., generated code) and require a PR approval when bypassing.

Security & compliance

Scope: best‑effort pattern checks to prevent common mistakes; not a substitute for dedicated secret scanners (e.g., org‑wide providers).

Privacy: no telemetry, no network calls, no data leaves the developer machine or CI.

Performance: scans staged files only; large binary files are size‑checked without content reads.

Bypass: git commit --no-verify remains available by Git design. Enforce via CI + branch protection.

Disclosure: report vulnerabilities privately via SECURITY.md.

Troubleshooting

The hook didn’t run

Ensure .git/hooks/pre-commit and pre-push exist and are executable. Re-run npx commit-shield init.

False positives

Add narrowly‑scoped patterns to ignoreGlobs, or reduce disallowContentPatterns.

Binary files flagged as text

Very large files are blocked by size alone. If needed, add explicit globs to ignoreGlobs.

Team member bypasses locally

Require the CI job on protected branches. Optionally, codify a PR template checklist.

FAQ

Why not Husky / pre-commit?Those are great. commit-shield focuses on zero‑dep, native Git hooks and works without extra tooling, while still pairing nicely with CI.

Does this scan the entire history?No. It’s a preventive guard on staged changes, plus CI re-checks.

Can I add custom rules?Yes, via commit-shield.config.json (globs & regexes).

Windows support?Yes — hooks are POSIX shell scripts invoking Node; Git for Windows provides a compatible shell.

Roadmap

Git LFS suggestions for large file types

Inline allow‑list pragma (# commit-shield: allow)

CI companion with smarter diff range detection

Additional built‑in secret patterns

Versioning & release

Semantic Versioning

Tag vX.Y.Z to trigger the Release workflow, which publishes to npm using NPM_TOKEN (see README section on publishing in repo).

Contributing

See CONTRIBUTING.md. By participating, you agree to the Code of Conduct.

Support

Bugs / feature requests: open an issue

Security: follow SECURITY.md

License

MIT © commit-shield contributors

