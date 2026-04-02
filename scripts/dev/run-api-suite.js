'use strict';

require('dotenv').config();

const { spawn } = require('child_process');

const hasAccessToken = !!process.env.SALESFORCE_ACCESS_TOKEN;
const hasOAuthClient = !!(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET);

if (!hasAccessToken && !hasOAuthClient) {
  console.error(
    'Salesforce API auth is not configured. Set SALESFORCE_ACCESS_TOKEN, or set both SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET in .env for client credentials flow.',
  );
  process.exit(1);
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child =
  process.platform === 'win32'
    ? spawn(`${npxCommand} playwright test tests/api --project=api`, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
        shell: true,
      })
    : spawn(npxCommand, ['playwright', 'test', 'tests/api', '--project=api'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      });

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
