import fs from 'fs';
import path from 'path';
import { Locator, Page } from '@playwright/test';
import { logInfo, logWarn } from './logger';

export type AutoHealContext = {
  testTitle?: string;
  projectName?: string;
  outputDir?: string;
};

export type LocatorCandidate = {
  label: string;
  locator: Locator;
};

type AutoHealRecord = {
  timestamp: string;
  testTitle?: string;
  projectName?: string;
  url?: string;
  action: 'click' | 'fill' | 'wait' | 'assert';
  primaryLabel: string;
  usedLabel: string;
  usedLocator: string;
  note?: string;
};

declare global {
  var __autohealContext: AutoHealContext | undefined;
}

function getContext(): AutoHealContext {
  return globalThis.__autohealContext || {};
}

function isAutoHealEnabled(): boolean {
  return ['1', 'true', 'yes'].includes((process.env.AUTO_HEAL || '').toLowerCase());
}

function getOutputFile(): string {
  const artifactsDir =
    process.env.PW_ARTIFACTS_DIR || process.env.PW_RUN_DIR || path.join(process.cwd(), 'test-results');
  const filePath = path.join(artifactsDir, 'autoheal-suggestions.jsonl');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return filePath;
}

async function appendRecord(record: AutoHealRecord): Promise<void> {
  if (!isAutoHealEnabled()) return;
  try {
    await fs.promises.appendFile(getOutputFile(), `${JSON.stringify(record)}\n`, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
    logWarn(`Auto-heal record could not be written: ${message}`);
  }
}

export async function recordAutoHealObservation(
  page: Page,
  observation: Omit<AutoHealRecord, 'timestamp' | 'testTitle' | 'projectName' | 'url'>,
): Promise<void> {
  const context = getContext();
  await appendRecord({
    timestamp: new Date().toISOString(),
    testTitle: context.testTitle,
    projectName: context.projectName,
    url: page.url(),
    ...observation,
  });
}

async function resolveVisibleLocator(
  page: Page,
  candidates: LocatorCandidate[],
  action: AutoHealRecord['action'],
  timeoutMs: number,
  note?: string,
): Promise<Locator> {
  if (!candidates.length) {
    throw new Error(`Auto-heal was called for "${action}" without locator candidates.`);
  }

  const primary = candidates[0];
  const context = getContext();
  for (const [index, candidate] of candidates.entries()) {
    try {
      const target = candidate.locator.first();
      await target.waitFor({ state: 'visible', timeout: timeoutMs });

      if (index > 0) {
        await appendRecord({
          timestamp: new Date().toISOString(),
          testTitle: context.testTitle,
          projectName: context.projectName,
          url: page.url(),
          action,
          primaryLabel: primary.label,
          usedLabel: candidate.label,
          usedLocator: target.toString(),
          note,
        });
        logInfo(`Auto-heal used fallback locator "${candidate.label}" for action "${action}".`);
      }

      return target;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
      logWarn(`Auto-heal candidate failed (${candidate.label}): ${message}`);
    }
  }

  throw new Error(`Auto-heal exhausted all locator candidates for action "${action}".`);
}

async function resolveEditableLocator(
  page: Page,
  candidates: LocatorCandidate[],
  timeoutMs: number,
  note?: string,
): Promise<Locator> {
  const locator = await resolveVisibleLocator(page, candidates, 'fill', timeoutMs, note);
  const editable = await locator.isEditable().catch(() => false);
  if (editable) return locator;

  for (const candidate of candidates.slice(1)) {
    const fallback = await resolveVisibleLocator(page, [candidate], 'fill', timeoutMs, note).catch(() => null);
    if (!fallback) continue;

    const canEdit = await fallback.isEditable().catch(() => false);
    if (canEdit) return fallback;
  }

  throw new Error('Auto-heal found a visible locator, but none of the candidates were editable.');
}

export async function autoHealClick(
  page: Page,
  candidates: LocatorCandidate[],
  timeoutMs: number = 5_000,
  note?: string,
): Promise<void> {
  const locator = await resolveVisibleLocator(page, candidates, 'click', timeoutMs, note);
  await locator.click();
}

export async function autoHealFill(
  page: Page,
  candidates: LocatorCandidate[],
  value: string,
  timeoutMs: number = 5_000,
  note?: string,
): Promise<Locator> {
  const locator = await resolveEditableLocator(page, candidates, timeoutMs, note);
  try {
    await locator.fill(value);
  } catch {
    await locator.click();
    await locator.pressSequentially(value);
  }
  return locator;
}

export async function autoHealWaitVisible(
  page: Page,
  candidates: LocatorCandidate[],
  timeoutMs: number = 5_000,
  note?: string,
): Promise<Locator> {
  return resolveVisibleLocator(page, candidates, 'wait', timeoutMs, note);
}
