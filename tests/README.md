# Tests Design Strategy

This folder holds the executable test layers for the Salesforce Playwright framework. The goal is to keep each layer focused, reusable, and easy to extend without turning every new scenario into a one-off test.

## Test Layers

### `tests/api`

Purpose:
- verify Salesforce REST behavior without browser dependencies
- cover SOQL query behavior, describe metadata, CRUD operations, response contracts, and lightweight response-time checks

Auth model:
- uses `salesforceApi` from `tests/fixtures/base.fixture.ts`
- authenticates with `SALESFORCE_ACCESS_TOKEN` or Salesforce Client Credentials Flow
- does not use Playwright browser storage state

When to add tests here:
- endpoint coverage
- auth and contract validation
- create, read, update, delete lifecycles
- request and response behavior that does not need the UI

### `tests/ui`

Purpose:
- verify Salesforce Lightning workflows and object behavior as a user experiences them
- cover login, object navigation, record creation flows, list views, toasts, and authenticated session reuse

Auth model:
- most UI suites should run in `authenticated-chromium`
- the `setup` project in `tests/auth.setup.ts` creates `playwright/.auth/salesforce-user.json`
- UI test files should prefer reusing saved auth state instead of re-logging in on every test

When to add tests here:
- Lightning page interactions
- page-object driven business flows
- user-visible validation and UX behavior

### `tests/hybrid`

Purpose:
- verify cross-surface business journeys where UI and API expectations need to stay aligned
- prove that important workflows behave correctly end to end

Auth model:
- still browser-backed
- should reuse the same saved UI storage state strategy as `tests/ui`

When to add tests here:
- one layer creates or changes data and another layer verifies business impact
- the scenario is valuable as a full workflow, not just as another API or UI-only check

### `tests/performance`

Purpose:
- measure practical Salesforce page load timing for important pages
- guard against major regressions in real Lightning navigation

Auth model:
- browser-backed
- depends on authenticated storage state and Lightning readiness helpers

When to add tests here:
- page timing thresholds
- key workflow readiness checkpoints

## Auth Setup Strategy

There are two independent auth paths in this repo.

### Browser auth for UI, hybrid, and performance

- `tests/auth.setup.ts` logs in and saves storage state to `playwright/.auth/salesforce-user.json`
- `authenticated-chromium` depends on the `setup` project in [`playwright.config.ts`](../playwright.config.ts)
- day-to-day local reruns should prefer `--project=authenticated-chromium --no-deps` once auth state already exists

### API auth for `tests/api`

- API tests do not use browser storage state
- prefer Salesforce Client Credentials Flow with:

```env
SALESFORCE_CLIENT_ID=your-external-client-app-client-id
SALESFORCE_CLIENT_SECRET=your-external-client-app-client-secret
SALESFORCE_AUTH_URL=https://your-org.my.salesforce.com
SALESFORCE_INSTANCE_URL=https://your-org.my.salesforce.com
```

Salesforce-side requirements:
- the External Client App has `Client Credentials Flow` enabled
- the app has an explicit `Run As` user
- the `Run As` user is active, unlocked, and has `API Enabled`

Important host rule:
- use `*.my.salesforce.com` for `SALESFORCE_AUTH_URL` and `SALESFORCE_INSTANCE_URL`
- do not use `login.salesforce.com` or `*.lightning.force.com` for the token request in this repo's API setup

## Storage State Rules

- Treat storage state as architecture, not as a test convenience.
- UI, hybrid, and performance tests should reuse `playwright/.auth/salesforce-user.json` through the `authenticated-chromium` project.
- Avoid re-running login steps in normal business-flow specs unless the test is specifically about authentication.
- Refresh storage state only when the session expires, trusted-browser state changes, or Salesforce asks for MFA again.
- API tests must not depend on UI storage state; they should authenticate through `salesforceApi`.

## Tag Strategy

- `@smoke` marks fast authenticated business-path coverage that should run early in CI after storage state is prepared.
- `@regression` marks the broader browser-backed coverage that should run after smoke using the same saved storage state.
- `@critical` marks must-pass tests within smoke, regression, or API layers.
- `@e2e` marks longer CRM lifecycle journeys. In this repo they are also tagged `@regression` so they naturally join the later browser-backed phase.
- `@hybrid`, `@api`, and `@perf` identify the layer or test intent in addition to any smoke or regression tag.

## Reusable Helpers And Fixtures

### Core fixture

[`tests/fixtures/base.fixture.ts`](./fixtures/base.fixture.ts) provides:
- `test` and `expect`
- `salesforceApi` for REST calls
- `salesforceUser` for shared configured credentials
- automatic failure capture for page HTML and URL when a browser test fails

### High-value helpers

- `utils/salesforceLightning.ts`
  use for Lightning readiness, object-home loading, record forms, picklists, and visible success signals
- `utils/autoHeal.ts`
  use bounded locator fallback logic instead of broad retries
- `utils/testData.ts`
  use builders such as `buildLeadPayload()` for realistic, unique data
- `pageobjects/auth/salesforce-login.page.ts`
  use for login and MFA-aware flows
- `pageobjects/salesforce/*`
  use page objects for object-specific user actions

## Layer Design Strategy

### API layer strategy

Default coverage buckets:
- happy path for each client method or endpoint shape
- auth setup and invalid auth behavior
- response contract validation
- CRUD lifecycle checks with explicit cleanup
- performance sanity for lightweight read paths

Authoring rules:
- keep one primary behavior per test
- use unique data for creates
- delete records you create unless the test intentionally verifies persistence
- keep request construction in the API client, not copied into every spec

Sample API test:

```ts
import { test, expect } from '../fixtures/base.fixture';

test('@api create and delete a lead via API', async ({ salesforceApi }) => {
  await salesforceApi.authenticate();

  const createResponse = await salesforceApi.createRecord('Lead', {
    LastName: `API Test Lead ${Date.now()}`,
    Company: 'API Test Corp',
    Status: 'Open - Not Contacted',
  });

  expect(createResponse.status()).toBe(201);
  const createBody = await createResponse.json();
  expect(createBody.success).toBe(true);

  const deleteResponse = await salesforceApi.deleteRecord('Lead', createBody.id);
  expect([200, 204]).toContain(deleteResponse.status());
});
```

### UI layer strategy

Default coverage buckets:
- object creation and save flows
- validation and picklist behavior
- navigation and list views
- success-state verification through visible, user-meaningful signals

Authoring rules:
- prefer page objects over inline selectors
- use Lightning readiness helpers before interacting with content
- reuse authenticated storage state instead of logging in inside each test
- verify meaningful end state instead of one brittle transient signal

Sample UI test skeleton:

```ts
import { test, expect } from '../fixtures/base.fixture';
import { LeadPage } from '../../pageobjects/salesforce/lead.page';

test('@smoke create lead from the lead object', async ({ page }) => {
  const leadPage = new LeadPage(page);

  await leadPage.goto();
  await leadPage.clickNew();
  await leadPage.fillLeadForm({
    lastName: `Lead${Date.now()}`,
    company: 'Test Company',
  });
  await leadPage.saveAndExpectSuccess();

  await expect(page).toHaveURL(/\/lightning\/r\/Lead\//);
});
```

### Hybrid layer strategy

Default coverage buckets:
- end-to-end business journeys across surfaces
- UI creation with downstream verification
- synchronization between user-visible outcomes and backend state

Authoring rules:
- only add hybrid tests when the cross-surface proof is the actual value
- keep the flow short and business-relevant
- avoid repeating pure UI or pure API coverage that already exists elsewhere

Sample hybrid test skeleton:

```ts
import { test, expect } from '../fixtures/base.fixture';
import { LeadPage } from '../../pageobjects/salesforce/lead.page';
import { buildLeadPayload } from '../../utils/testData';

test('@hybrid create lead in UI and verify behavior', async ({ page }) => {
  const leadPage = new LeadPage(page);
  const leadData = buildLeadPayload();

  await leadPage.goto();
  await leadPage.clickNew();
  await leadPage.fillLeadForm(leadData);
  await leadPage.saveAndExpectSuccess();

  await expect(page).toHaveURL(/\/lightning\/r\/Lead\//);
});
```

### Performance layer strategy

Default coverage buckets:
- page-load thresholds for key entry points
- readiness timing after Lightning shell and page content stabilize

Authoring rules:
- measure real user entry points
- use `waitForLightningReady()` before asserting timing success
- keep thresholds realistic for the org and environment

Sample performance test skeleton:

```ts
import { test, expect } from '../fixtures/base.fixture';
import { waitForLightningReady } from '../../utils/salesforceLightning';

test('@perf lead list loads within threshold', async ({ page }) => {
  const start = Date.now();
  await page.goto('/lightning/o/Lead/list');
  await waitForLightningReady(page);
  expect(Date.now() - start).toBeLessThan(30_000);
});
```

## Practical Commands

```bash
# Full non-UI suite
npm run test:api:checked

# Refresh browser auth state
npx playwright test tests/auth.setup.ts --project=setup --workers=1

# Reuse existing browser auth state for one spec
npx playwright test tests/ui/crm/case.spec.ts --project=authenticated-chromium --workers=1 --no-deps
```
