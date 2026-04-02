import fs from 'fs';
import path from 'path';
import { test as base, expect, request } from '@playwright/test';
import { SalesforceApiClient } from '../../src/domain/salesforceApi/salesforce.api';
import { AutoHealContext } from '../../utils/autoHeal';
import { loadEnv } from '../../utils/loadEnv';
import { readSharedSalesforceUser, SharedSalesforceUser } from '../../utils/sharedSalesforceUser';

loadEnv();

type SalesforceFixtures = {
  salesforceApi: SalesforceApiClient;
  salesforceUser: SharedSalesforceUser;
};

export const test = base.extend<SalesforceFixtures>({
  page: async ({ page }, use, testInfo) => {
    const context: AutoHealContext = {
      testTitle: testInfo.title,
      projectName: testInfo.project.name,
      outputDir: testInfo.outputDir,
    };

    globalThis.__autohealContext = context;
    try {
      await use(page);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        const htmlPath = path.join(testInfo.outputDir, 'failure-page-source.html');
        const urlPath = path.join(testInfo.outputDir, 'failure-page-url.txt');
        try {
          fs.mkdirSync(testInfo.outputDir, { recursive: true });
          fs.writeFileSync(htmlPath, await page.content(), 'utf8');
          fs.writeFileSync(urlPath, `${page.url()}\n`, 'utf8');
          testInfo.attachments.push({
            name: 'failure-page-source',
            path: htmlPath,
            contentType: 'text/html',
          });
          testInfo.attachments.push({
            name: 'failure-page-url',
            path: urlPath,
            contentType: 'text/plain',
          });
        } catch {
          // Ignore capture failures so the original test result stays intact.
        }
      }
      delete globalThis.__autohealContext;
    }
  },

  salesforceApi: async ({ playwright }, use) => {
    const context = await request.newContext();
    const client = new SalesforceApiClient(context);
    await use(client);
    await context.dispose();
  },

  salesforceUser: async ({}, use) => {
    await use(await readSharedSalesforceUser());
  },
});

export { expect };
