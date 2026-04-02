import { test } from '@playwright/test';
import { logInfo } from './logger';

export async function step<T>(title: string, action: () => Promise<T>) {
  return test.step(title, async () => {
    logInfo(`STEP START: ${title}`);
    const startedAt = Date.now();
    const result = await action();
    logInfo(`STEP PASS: ${title} (${Date.now() - startedAt}ms)`);
    return result;
  });
}
