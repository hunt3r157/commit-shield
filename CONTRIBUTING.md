# Contributing

Thanks for helping improve **commit-shield**!

## Setup
- Requires Node 18+
- Clone the repo, create a feature branch, and run your changes against a test repo.

## Development tips
- The guard is dependency-free. Please keep it light.
- Add/update regexes with references in PR description.
- If you add options, document them in README and the sample `commit-shield.config.json`.

## Release
- Bump version in `package.json` (SemVer).
- Create a tag `vX.Y.Z` and push. GitHub Action will publish to npm when `NPM_TOKEN` is configured.
