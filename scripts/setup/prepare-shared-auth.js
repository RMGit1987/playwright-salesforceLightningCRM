const { spawnSync } = require('child_process');

const baseArgs = ['playwright', 'test', 'tests/auth.setup.ts', '--project=setup', '--workers=1'];
const extraArgs = process.argv.slice(2);
const allArgs = [...baseArgs, ...extraArgs];

const result =
  process.platform === 'win32'
    ? spawnSync(`npx ${allArgs.join(' ')}`, {
        env: process.env,
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync('npx', allArgs, {
        env: process.env,
        stdio: 'inherit',
      });

process.exit(typeof result.status === 'number' ? result.status : 1);
