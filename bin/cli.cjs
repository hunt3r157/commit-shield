#!/usr/bin/env node
// CommonJS shim → loads our ESM CLI reliably
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const esUrl = pathToFileURL(path.join(__dirname, 'cli.mjs')).href;
  await import(esUrl);
})();
