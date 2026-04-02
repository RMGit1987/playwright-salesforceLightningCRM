'use strict';

const { spawn } = require('child_process');

const env = { ...process.env };
env.AUTO_HEAL = env.AUTO_HEAL || '1';
env.PW_HEADLESS = env.PW_HEADLESS || '0';
env.PW_CHANNEL = env.PW_CHANNEL || 'chrome';

if (!['1', 'true', 'yes'].includes((env.PW_KEEP_DEBUG || '').toLowerCase())) {
  delete env.PWDEBUG;
  delete env.PW_DEBUG_LIGHTNING_READY;
  delete env.PW_DEBUG_LIGHTNING_READY_STAGE;
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const playwrightArgs = ['playwright', 'test', ...process.argv.slice(2)];

function quoteArg(value) {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

const child =
  process.platform === 'win32'
    ? spawn([npxCommand, ...playwrightArgs].map(quoteArg).join(' '), {
        cwd: process.cwd(),
        env,
        stdio: 'inherit',
        shell: true,
      })
    : spawn(npxCommand, playwrightArgs, {
        cwd: process.cwd(),
        env,
        stdio: 'inherit',
      });

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
