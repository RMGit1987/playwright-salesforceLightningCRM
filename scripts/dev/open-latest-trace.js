'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function getLatestRunDir() {
  const testResultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(testResultsDir)) {
    throw new Error(`No test-results directory found at ${testResultsDir}`);
  }

  const runDirs = fs
    .readdirSync(testResultsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(testResultsDir, entry.name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  if (runDirs.length === 0) {
    throw new Error(`No run directories found in ${testResultsDir}`);
  }

  return runDirs;
}

function findTraceFiles(rootDir) {
  const matches = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === 'trace.zip') {
        matches.push(fullPath);
      }
    }
  }

  return matches.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
}

try {
  const runDirs = getLatestRunDir();
  let tracePath = null;

  for (const runDir of runDirs) {
    const traceFiles = findTraceFiles(runDir);
    if (traceFiles.length > 0) {
      tracePath = traceFiles[0];
      break;
    }
  }

  if (!tracePath) {
    throw new Error(`No trace.zip found under ${path.join(process.cwd(), 'test-results')}`);
  }
  console.log(tracePath);

  if (process.argv.includes('--print-only')) {
    process.exit(0);
  }

  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(npxCommand, ['playwright', 'show-trace', tracePath], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
