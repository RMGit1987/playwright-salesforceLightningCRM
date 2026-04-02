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

  return runDirs[0];
}

function openPath(targetPath) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', targetPath], { detached: true, stdio: 'ignore' }).unref();
    return;
  }

  if (process.platform === 'darwin') {
    spawn('open', [targetPath], { detached: true, stdio: 'ignore' }).unref();
    return;
  }

  spawn('xdg-open', [targetPath], { detached: true, stdio: 'ignore' }).unref();
}

try {
  const latestRunDir = getLatestRunDir();
  const reportPath = path.join(latestRunDir, 'report', 'index.html');

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Latest run does not contain an HTML report: ${reportPath}`);
  }

  console.log(reportPath);

  if (!process.argv.includes('--print-only')) {
    openPath(reportPath);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
