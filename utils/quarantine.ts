import fs from 'fs';
import path from 'path';

export type QuarantineEntry = {
  id: string;
  titlePattern: string;
  reason: string;
  owner?: string;
  issue?: string;
  enabled?: boolean;
};

type QuarantineManifest = {
  version?: number;
  tests?: QuarantineEntry[];
};

function resolveManifestPath(): string {
  return process.env.QUARANTINE_MANIFEST_PATH || path.join(process.cwd(), 'config', 'quarantine-tests.json');
}

export function readQuarantineManifest(): QuarantineManifest {
  const manifestPath = resolveManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return { tests: [] };
  }

  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw) as QuarantineManifest;
}

export function getEnabledQuarantineEntries(): QuarantineEntry[] {
  const manifest = readQuarantineManifest();
  return (manifest.tests || []).filter((entry) => entry.enabled !== false);
}

export function findQuarantineEntry(title: string): QuarantineEntry | undefined {
  const entries = getEnabledQuarantineEntries();
  return entries.find((entry) => {
    try {
      return new RegExp(entry.titlePattern, 'i').test(title);
    } catch {
      return title.includes(entry.titlePattern);
    }
  });
}
