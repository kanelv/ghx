#!/usr/bin/env node

import { runCli } from '../cli.js';

runCli().catch((err) => {
  console.error(`Fatal: ${err?.message || String(err)}`);
  process.exit(1);
});
