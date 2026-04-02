import { expect, Page, type Locator } from '@playwright/test';
import { autoHealClick, autoHealFill, autoHealWaitVisible } from './autoHeal';
import { logInfo } from './logger';

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTruthyEnv(name: string): boolean {
  return ['1', 'true', 'yes'].includes((process.env[name] || '').toLowerCase());
}

function buildSalesforceUrl(page: Page, path: string): string {
  const currentUrl = page.url();

  if (/^https?:\/\//i.test(currentUrl) && !/^chrome-error:|^about:blank/i.test(currentUrl)) {
    return new URL(path, currentUrl).toString();
  }

  const configuredBaseUrl = process.env.SALESFORCE_BASE_URL || process.env.SALESFORCE_LOGIN_URL;
  if (configuredBaseUrl) {
    return new URL(path, configuredBaseUrl).toString();
  }

  return path;
}

async function describeLocatorState(page: Page, label: string, selector: string): Promise<string> {
  const locator = page.locator(selector).first();
  const count = await page.locator(selector).count().catch(() => 0);
  const visible = await locator.isVisible().catch(() => false);
  return `${label}: count=${count}, visible=${visible}, selector=${selector}`;
}

async function logLightningReadyDebugState(
  page: Page,
  stage: 'after-domcontentloaded' | 'after-shell-visible' | 'after-spinner-hidden',
): Promise<void> {
  if (!isTruthyEnv('PW_DEBUG_LIGHTNING_READY')) return;

  const shellStates = await Promise.all([
    describeLocatorState(page, 'one-appnav', 'one-appnav'),
    describeLocatorState(page, 'one-app-nav-bar', 'one-app-nav-bar'),
    describeLocatorState(page, 'global header', '.slds-global-header'),
    describeLocatorState(page, 'context bar', '.slds-context-bar'),
    describeLocatorState(page, 'main', 'main'),
    describeLocatorState(page, 'role main', '[role="main"]'),
  ]);

  const spinnerStates = await Promise.all([
    describeLocatorState(page, 'slds spinner', '.slds-spinner'),
    describeLocatorState(page, 'lightning spinner', 'lightning-spinner'),
    describeLocatorState(page, 'spinnerContainer', '.spinnerContainer'),
    describeLocatorState(page, 'loadingSpinner', '.loadingSpinner'),
    describeLocatorState(page, 'status spinner', '[role="status"] .slds-spinner'),
  ]);

  logInfo(`Lightning ready debug pause at ${stage} | url=${page.url()}`);
  for (const state of [...shellStates, ...spinnerStates]) {
    logInfo(`Lightning ready selector state | ${state}`);
  }
}

async function pauseForLightningReadyDebug(
  page: Page,
  stage: 'after-domcontentloaded' | 'after-shell-visible' | 'after-spinner-hidden',
): Promise<void> {
  if (!isTruthyEnv('PW_DEBUG_LIGHTNING_READY')) return;

  const requestedStage = (process.env.PW_DEBUG_LIGHTNING_READY_STAGE || '').toLowerCase();
  if (requestedStage && requestedStage !== stage) return;

  await logLightningReadyDebugState(page, stage);
  await page.pause();
}

export async function waitForLightningReady(page: Page, timeoutMs: number = 30_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await pauseForLightningReadyDebug(page, 'after-domcontentloaded');

  const shell = page.locator(
    'one-appnav, one-app-nav-bar, .slds-global-header, .slds-context-bar, main, [role="main"]',
  );
  await shell.first().waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => undefined);
  await pauseForLightningReadyDebug(page, 'after-shell-visible');

  const spinner = page.locator(
    '.slds-spinner, lightning-spinner, .spinnerContainer, .loadingSpinner, [role="status"] .slds-spinner',
  );
  await spinner.first().waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  await pauseForLightningReadyDebug(page, 'after-spinner-hidden');
}

export async function waitForLightningObjectHome(
  page: Page,
  objectLabel?: string,
  timeoutMs: number = 30_000,
): Promise<void> {
  await waitForLightningReady(page, timeoutMs);

  const objectHeadingPattern = objectLabel ? new RegExp(`^${escapeRegex(objectLabel)}$`, 'i') : undefined;

  await expect
    .poll(
      async () => {
        const mainText = (await page.locator('main, [role="main"]').first().innerText().catch(() => '')).trim();
        const newButtonVisible = await page
          .getByRole('button', { name: /^new$/i })
          .first()
          .isVisible()
          .catch(() => false);
        const objectHeadingVisible = objectHeadingPattern
          ? await page.getByRole('heading', { name: objectHeadingPattern }).first().isVisible().catch(() => false)
          : false;
        const recentHeadingVisible = await page
          .getByRole('heading', { name: /recently viewed/i })
          .first()
          .isVisible()
          .catch(() => false);
        const listSurfaceCount = await page
          .locator(
            'main article, main table, main [role="grid"], main lightning-datatable, main records-lwc-record-layout, main flexipage-component2',
          )
          .count()
          .catch(() => 0);

        return newButtonVisible || ((objectHeadingVisible || recentHeadingVisible || listSurfaceCount > 0) && mainText.length > 20);
      },
      {
        timeout: timeoutMs,
        intervals: [500, 1_000, 2_000],
      },
    )
    .toBeTruthy();
}

export async function openLightningObjectHome(
  page: Page,
  objectApiName: string,
  objectNavLabel: string,
  timeoutMs: number = 30_000,
): Promise<void> {
  const objectUrlPattern = new RegExp(`/lightning/o/${escapeRegex(objectApiName)}/(home|list)`, 'i');
  const navLabelPattern = new RegExp(`^${escapeRegex(objectNavLabel)}$`, 'i');

  await waitForLightningReady(page, timeoutMs);

  if (!objectUrlPattern.test(page.url()) || /\/list(?:\?|$)/i.test(page.url())) {
    const openedFromNav = await autoHealClick(
      page,
      [
        { label: `${objectNavLabel} nav link`, locator: page.getByRole('link', { name: navLabelPattern }) },
        { label: `${objectNavLabel} nav title`, locator: page.locator(`a[title="${objectNavLabel}"]`) },
      ],
      10_000,
      `Open the Salesforce ${objectNavLabel} object from the app navigation.`,
    )
      .then(() => true)
      .catch(() => false);

    if (!openedFromNav) {
      await page.goto(buildSalesforceUrl(page, `/lightning/o/${objectApiName}/home`));
    }
  }

  await page.waitForURL(objectUrlPattern, { timeout: timeoutMs }).catch(() => undefined);
  await waitForLightningObjectHome(page, objectNavLabel, timeoutMs);
}

export async function waitForRecordForm(page: Page, timeoutMs: number = 15_000): Promise<Locator> {
  return autoHealWaitVisible(
    page,
    [
      {
        label: 'record dialog with save action',
        locator: page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^save$/i }) }),
      },
      { label: 'records base record form', locator: page.locator('records-base-record-form') },
      { label: 'records detail panel', locator: page.locator('records-lwc-detail-panel') },
      { label: 'records modal wrapper', locator: page.locator('records-modal-lwc-detail-panel-wrapper') },
      { label: 'lightning record edit form', locator: page.locator('lightning-record-edit-form') },
      { label: 'record edit container', locator: page.locator('.record-edit-container') },
    ],
    timeoutMs,
    'Wait for the Salesforce record-create form using visible modal candidates.',
  );
}

export async function clickNewRecord(page: Page): Promise<void> {
  await autoHealClick(
    page,
    [
      { label: 'New button role', locator: page.getByRole('button', { name: /^new$/i }) },
      { label: 'New button title', locator: page.locator('button[title="New"], a[title="New"]') },
      { label: 'New text action', locator: page.locator('button, a').filter({ hasText: /^new$/i }) },
    ],
    10_000,
    'Open the Salesforce new-record dialog with resilient candidates.',
  );
  await waitForRecordForm(page);
}

export async function clickSaveRecord(page: Page): Promise<void> {
  await autoHealClick(
    page,
    [
      { label: 'Save button role', locator: page.getByRole('button', { name: /^save$/i }) },
      { label: 'Save button title', locator: page.locator('button[title="Save"], button[name="SaveEdit"]') },
      { label: 'Save text action', locator: page.locator('button').filter({ hasText: /^save$/i }) },
    ],
    10_000,
    'Save the Salesforce record with resilient button candidates.',
  );
  await waitForLightningReady(page);
}

export async function expectLightningToast(page: Page, text: RegExp, timeoutMs: number = 15_000): Promise<void> {
  const toastSelector =
    '.slds-notify__content, [role="alert"], [role="status"], lightning-toast, [data-key="toast"], .toastContent';

  await expect
    .poll(
      async () => {
        const matches = page.locator(toastSelector).filter({ hasText: text });
        const count = await matches.count().catch(() => 0);

        for (let index = 0; index < count; index += 1) {
          if (await matches.nth(index).isVisible().catch(() => false)) {
            return true;
          }
        }

        return false;
      },
      {
        timeout: timeoutMs,
        intervals: [250, 500, 1_000],
      },
    )
    .toBeTruthy();
}

export async function fillLightningTextField(
  page: Page,
  labelPattern: RegExp,
  apiName: string,
  value: string,
  options?: { multiline?: boolean },
): Promise<void> {
  const form = await waitForRecordForm(page);
  const tagName = options?.multiline ? 'textarea' : 'input';
  await autoHealFill(
    page,
    [
      { label: `${apiName} label`, locator: form.getByLabel(labelPattern) },
      { label: `${apiName} ${tagName} name`, locator: form.locator(`${tagName}[name="${apiName}"]`) },
      { label: `${apiName} field id`, locator: form.locator(`[data-field-id*="${apiName}"] ${tagName}`) },
      {
        label: `${apiName} target selection`,
        locator: form.locator(`[data-target-selection-name*="${apiName}"] ${tagName}`),
      },
    ],
    value,
    10_000,
    `Fill Salesforce field ${apiName} with resilient locator candidates.`,
  );
}

export async function selectLightningComboboxOption(
  page: Page,
  labelPattern: RegExp,
  apiName: string,
  value: string,
): Promise<void> {
  await openLightningCombobox(page, labelPattern, apiName);
  const optionPattern = new RegExp(`^${escapeRegex(value)}$`, 'i');

  await autoHealClick(
    page,
    [
      { label: `${apiName} option role`, locator: page.getByRole('option', { name: optionPattern }) },
      {
        label: `${apiName} combobox item`,
        locator: page.locator('lightning-base-combobox-item, [role="option"]').filter({ hasText: optionPattern }),
      },
    ],
    10_000,
    `Select Salesforce picklist value ${value} for ${apiName}.`,
  );

  await waitForLightningReady(page);
}

export async function selectLightningComboboxOptionFromCandidates(
  page: Page,
  labelPattern: RegExp,
  apiName: string,
  values: string[],
): Promise<string> {
  const attempted = new Set<string>();

  for (const value of values) {
    if (!value || attempted.has(value)) continue;
    attempted.add(value);

    await openLightningCombobox(page, labelPattern, apiName);
    const optionPattern = new RegExp(`^${escapeRegex(value)}$`, 'i');

    const selected = await autoHealClick(
      page,
      [
        { label: `${apiName} option role`, locator: page.getByRole('option', { name: optionPattern }) },
        {
          label: `${apiName} combobox item`,
          locator: page.locator('lightning-base-combobox-item, [role="option"]').filter({ hasText: optionPattern }),
        },
      ],
      5_000,
      `Select Salesforce picklist value ${value} for ${apiName}.`,
    )
      .then(() => true)
      .catch(() => false);

    if (selected) {
      await waitForLightningReady(page);
      return value;
    }
  }

  throw new Error(`No visible Salesforce picklist option matched any candidate for ${apiName}: ${values.join(', ')}`);
}

export async function openLightningCombobox(
  page: Page,
  labelPattern: RegExp,
  apiName: string,
): Promise<void> {
  const form = await waitForRecordForm(page);

  await autoHealClick(
    page,
    [
      { label: `${apiName} combobox label`, locator: form.getByLabel(labelPattern) },
      { label: `${apiName} lightning combobox`, locator: form.locator(`lightning-combobox[data-field="${apiName}"] button`) },
      { label: `${apiName} field id button`, locator: form.locator(`[data-field-id*="${apiName}"] button`) },
      {
        label: `${apiName} target selection button`,
        locator: form.locator(`[data-target-selection-name*="${apiName}"] button`),
      },
    ],
    10_000,
    `Open Salesforce picklist ${apiName} with bounded fallback candidates.`,
  );
}

export function isLightningUrl(url: string): boolean {
  return /\/lightning\//i.test(url);
}
