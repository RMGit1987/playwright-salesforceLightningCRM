import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let loaded = false;

export function loadEnv() {
  if (loaded) return;

  const candidates = [
    '.env',
    `.env.${process.env.NODE_ENV || 'staging'}`,
    `.env.${process.env.NODE_ENV || 'staging'}.local`,
  ];

  for (const relativePath of candidates) {
    const filePath = path.join(process.cwd(), relativePath);
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false });
    }
  }

  loaded = true;
}

loadEnv();
