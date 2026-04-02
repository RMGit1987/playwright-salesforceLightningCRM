import fs from 'fs';
import path from 'path';
import { loadEnv } from './loadEnv';

loadEnv();

export type SharedSalesforceUser = {
  username: string;
  password: string;
};

export function getSeedDir(): string {
  return path.join(process.cwd(), 'playwright', '.seed');
}

export function getSharedSalesforceUserPath(): string {
  return path.join(getSeedDir(), 'salesforce-user.json');
}

export function getAuthDir(): string {
  return path.join(process.cwd(), 'playwright', '.auth');
}

export function getSalesforceStorageStatePath(): string {
  return path.join(getAuthDir(), 'salesforce-user.json');
}

export function ensureRuntimeDirs(): void {
  fs.mkdirSync(getSeedDir(), { recursive: true });
  fs.mkdirSync(getAuthDir(), { recursive: true });
}

export function getConfiguredSalesforceUser(): SharedSalesforceUser {
  const username = process.env.SALESFORCE_USERNAME?.trim();
  const password = process.env.SALESFORCE_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error(
      'Salesforce credentials are not configured. Set SALESFORCE_USERNAME and SALESFORCE_PASSWORD in .env.',
    );
  }

  return { username, password };
}

export async function readSharedSalesforceUser(): Promise<SharedSalesforceUser> {
  const filePath = getSharedSalesforceUserPath();
  if (fs.existsSync(filePath)) {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data) as SharedSalesforceUser;
  }

  return getConfiguredSalesforceUser();
}

export function writeSharedSalesforceUser(user: SharedSalesforceUser): void {
  ensureRuntimeDirs();
  fs.writeFileSync(getSharedSalesforceUserPath(), `${JSON.stringify(user, null, 2)}\n`, 'utf8');
}
