#!/usr/bin/env node
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const esUrl = pathToFileURL(path.join(__dirname, 'commit-shield.mjs')).href;
  await import(esUrl);
})();
