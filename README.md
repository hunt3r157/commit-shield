# commit-shield

A **zero‑config, tiny pre-commit & pre-push guard** that blocks accidental commits of secrets, huge files, and junk like `node_modules/`.

- ✅ Detects common secrets (private keys, service accounts, AWS/GitHub/Slack tokens, Google API keys)
- ✅ Blocks large files (default > 5 MB) and paths like `node_modules/`
- ✅ Works without Husky or extra deps — pure Node + native Git hooks
- ✅ One‑liner install, customizable via `commit-shield.config.json`

---

## Quick start

Add the two scripts to your repo and install hooks:

```bash
mkdir -p scripts
# copy these files from this repo if you downloaded a zip or cloned it:
cp scripts/commit-shield.mjs scripts/install.mjs ./scripts/

# then initialize hooks
node scripts/install.mjs

# optionally add a package.json script for your team
# "scripts": { "commit-shield:init": "node scripts/install.mjs" }
```

> After you publish this repository publicly on GitHub, you can also offer a cURL one-liner in your README that fetches these two files directly from raw.githubusercontent.com.

---

## What it catches (by default)

- **Secrets by content**
  - Private keys: `-----BEGIN … PRIVATE KEY-----`
  - Google service accounts: `"type": "service_account"`, `"private_key"`
  - Google API keys: `AIza...` (length ~39)
  - AWS access keys: `AKIA[0-9A-Z]{16}`
  - GitHub PATs: `ghp_[A-Za-z0-9]{36}`
  - Slack tokens: `xox[baprs]-…`
- **Dangerous filenames**: `.env`, `.env.*`, `*serviceAccount*.json`, `*-firebase-adminsdk-*.json`
- **Junk paths**: anything inside `node_modules/`, `dist/`, `build/` (customizable)
- **Large files**: > **5 MB** (customizable)

Tune via `commit-shield.config.json`.

---

## Files

- `scripts/commit-shield.mjs` — the checker (no deps, Node 18+)
- `scripts/install.mjs` — installs native git hooks
- `commit-shield.config.json` — optional overrides
- `LICENSE` — MIT

---

## CI (optional)

We include a minimal GitHub Action that runs on pushes and PRs. It calls commit‑shield in a "pre-push" style so it checks the last commit range.

---

## Why this exists

Teams keep leaking secrets and committing junk. Existing tools are great but often heavy (Husky, pre-commit, multiple deps) or require org‑wide services. `commit-shield` is purposely tiny and works anywhere you can run Node and Git.

---

## Roadmap

- [ ] Optional Git LFS suggestion for large file types
- [ ] Per-file allowlist with inline pragma `# commit-shield: allow` for generated code
- [ ] Better CI range detection on force-pushes and first commits
- [ ] Publish as `npx commit-shield` helper (init command)

---

## License

MIT © commit-shield contributors
