const { spawnSync } = require('child_process');

const extraArgs = process.argv.slice(2);
const result =
  process.platform === 'win32'
    ? spawnSync(`npx playwright test ${extraArgs.join(' ')}`, {
        env: process.env,
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync('npx', ['playwright', 'test', ...extraArgs], {
        env: process.env,
        stdio: 'inherit',
      });

process.exit(typeof result.status === 'number' ? result.status : 1);
