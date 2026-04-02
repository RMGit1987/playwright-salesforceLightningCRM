import fs from 'fs';
import path from 'path';

export default async function globalTeardown() {
  const runDir = process.env.PW_RUN_DIR;
  if (!runDir) return;

  const marker = path.join(runDir, 'logs', 'teardown.log');
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, `Global teardown completed at ${new Date().toISOString()}\n`, 'utf8');
}
