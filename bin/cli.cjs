#!/usr/bin/env node
// Small CJS wrapper so npm's .bin always works and loads our ESM CLI
(async () => {
  await import(new URL('./commit-shield.mjs', import.meta.url));
})();
