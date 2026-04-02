# Playwright Salesforce Test Automation Framework

A modern Playwright-based test automation framework for Salesforce Lightning applications. Built with TypeScript, page object model, and auto-healing capabilities.

## Architecture

```
playwright-salesforce/
├── pageobjects/
│   ├── auth/                        # Authentication page objects
│   │   └── salesforce-login.page.ts
│   ├── salesforce/                  # Salesforce object page objects
│   │   ├── home.page.ts
│   │   ├── lead.page.ts
│   │   ├── opportunity.page.ts
│   │   ├── account.page.ts
│   │   ├── contact.page.ts
│   │   └── case.page.ts
│   └── components/                  # Reusable UI component page objects
│       ├── toast.page.ts
│       ├── modal.page.ts
│       └── list-view.page.ts
├── src/
│   └── domain/
│       └── salesforceApi/           # Salesforce REST API client
│           ├── salesforce.api.ts
│           └── salesforce.schemas.ts
├── tests/
│   ├── fixtures/                    # Custom test fixtures
│   │   └── base.fixture.ts
│   ├── auth.setup.ts                # Auth setup for authenticated state
│   ├── api/                         # REST API tests (SOQL, CRUD, Describe)
│   ├── ui/
│   │   ├── auth/                    # Authentication UI tests
│   │   ├── crm/                     # CRM workflow tests
│   │   │   ├── lead.spec.ts
│   │   │   ├── opportunity.spec.ts
│   │   │   ├── contact.spec.ts
│   │   │   └── case.spec.ts
│   │   ├── lightning/               # Lightning component tests
│   │   └── authenticated/           # Pre-authenticated tests
│   ├── hybrid/                      # API + UI combined tests
│   └── performance/                 # Page load timing tests
├── utils/                           # Shared utilities
│   ├── loadEnv.ts
│   ├── logger.ts
│   ├── testData.ts
│   └── stepLogger.ts
├── config/                          # Configuration files
├── reporters/                       # Custom reporters
├── playwright.config.ts
├── global-setup.ts
├── global-teardown.ts
├── tsconfig.json
├── package.json
└── .env
```

### Runtime Design

This repo uses the same layered Playwright structure as the reference auto-heal framework, but the runtime model is tuned for Salesforce:

- `setup` project:
  creates or refreshes the authenticated storage state in `playwright/.auth/salesforce-user.json`
- `authenticated-chromium` project:
  runs all Salesforce business workflows with saved auth state
- `chromium` project:
  runs auth-only specs without assuming a pre-existing session
- `api` project:
  runs REST-level Salesforce tests independently of UI auth
- optional `firefox` project:
  can be enabled with `PW_ENABLE_FIREFOX=1`, but is intentionally not the default path for Salesforce

### Framework Layers

- Page objects:
  own Salesforce object flows such as Lead, Account, Contact, Opportunity, Case, and Home
- Component page objects:
  own reusable Lightning concepts like toasts, dialogs, and list views
- `utils/salesforceLightning.ts`:
  centralizes Lightning readiness, object-home navigation, record-form detection, resilient picklist handling, and toast checks
- `utils/autoHeal.ts`:
  provides bounded fallback locators rather than opaque retries
- Fixtures:
  inject shared auth, API access, and failure-artifact capture
- Reporter + run folders:
  create per-run `test-results/run-*` folders with HTML report, JSON results, traces, screenshots, videos, page source, and URLs

### Salesforce-Specific Execution Model

The key runtime assumption in this repo is that Salesforce behaves more like a stateful business platform than a simple web app:

- authentication state matters more than in the reference practice-site repo
- MFA and trusted-browser behavior affect test execution strategy
- Lightning pages can render the shell before the actual object content is usable
- list views, toasts, dialogs, and comboboxes vary by object, org configuration, and current Lightning layout
- successful assertions often need multiple valid UI signals, not a single old-style selector

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
npx playwright install chromium
```

### Configuration

Copy `.env.example` to `.env` and configure your Salesforce credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Salesforce Developer Edition credentials:

```
SALESFORCE_USERNAME=your-username@example.com
SALESFORCE_PASSWORD=your-password
SALESFORCE_LOGIN_URL=https://your-org.lightning.force.com
SALESFORCE_AUTH_URL=https://your-org.my.salesforce.com
SALESFORCE_INSTANCE_URL=https://your-org.my.salesforce.com
```

URL guidance:
- use `SALESFORCE_LOGIN_URL` and `SALESFORCE_BASE_URL` for Salesforce browser navigation
- use `SALESFORCE_AUTH_URL` and `SALESFORCE_INSTANCE_URL` for API auth and REST calls
- for client credentials flow, prefer the My Domain host like `https://your-org.my.salesforce.com`
- do not point `SALESFORCE_AUTH_URL` at `https://login.salesforce.com` or a `*.lightning.force.com` host for this repo's API setup

### Salesforce MFA / 2FA Setup

This framework supports Salesforce MFA, but there are two different paths depending on how your org and device are configured.

#### Option 1: Manual approval during auth bootstrap

This is the simplest and currently the safest setup for a new org.

Recommended flow:
- Register your Salesforce user with an authenticator method in Salesforce.
- Run the `setup` project in headed Chrome.
- Approve the MFA challenge manually when Salesforce prompts for it.
- Let Playwright save the authenticated session to `playwright/.auth/salesforce-user.json`.
- Reuse that saved session for authenticated test projects.

This is the workflow we used successfully in this repo.

Relevant `.env` setting:

```env
SALESFORCE_MFA_TIMEOUT_MS=120000
```

Increase it if you need a larger manual approval window.

#### Option 2: TOTP-based MFA entry from `.env`

If Salesforce is configured with a TOTP authenticator method, the framework can generate the MFA code locally from the shared secret.

Supported variables:

```env
SALESFORCE_MFA_CODE=
SALESFORCE_TOTP_SECRET=
SALESFORCE_TOTP_URI=
SALESFORCE_TOTP_DIGITS=6
SALESFORCE_TOTP_PERIOD=30
SALESFORCE_TOTP_ALGORITHM=SHA1
```

Resolution order:
- `SALESFORCE_MFA_CODE`
- `SALESFORCE_TOTP_URI`
- `SALESFORCE_TOTP_SECRET`

Notes:
- Put real secrets only in `.env`, never in `.env.example`.
- `SALESFORCE_TOTP_URI` must be a real `otpauth://...` URI, not a Salesforce web URL.
- `SALESFORCE_TOTP_SECRET` must be the long-lived shared secret, not a temporary 6-digit code.

#### Important limitation

If you enrolled with Microsoft Authenticator or another authenticator app, this framework does not read codes directly out of the mobile app. The automation-friendly approach is to use the same TOTP shared secret that was used when the authenticator was registered.

If you no longer have the shared secret or QR payload:
- remove and re-register the authenticator method in Salesforce
- capture the setup key or `otpauth://...` URI during enrollment
- store that value in `.env`

#### Recommended repo workflow

For this repo, the practical day-to-day flow is:
- complete one headed `setup` run and approve MFA manually if needed
- confirm `playwright/.auth/salesforce-user.json` is created
- run authenticated specs with `--project=authenticated-chromium --no-deps`
- refresh the storage state only when the session expires or Salesforce asks for MFA again

### Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:smoke          # Smoke tests
npm run test:regression     # Regression tests
npm run test:crm            # CRM workflow tests
npm run test:lightning      # Lightning component tests
npm run test:api            # API tests
npm run test:performance    # Performance tests

# Run with specific browser
npm run test:chromium

# Run authenticated tests
npm run test:authstate
```

### Local Run Modes We Used In This Repo

These are the most useful commands for day-to-day Salesforce debugging and spec-by-spec execution.

#### Headed + Auto-Heal + Saved Auth State

These wrappers default to:
- `AUTO_HEAL=1`
- `PW_HEADLESS=0`
- `PW_CHANNEL=chrome`
- debug env flags cleared unless `PW_KEEP_DEBUG=1`

```bash
# Run one specific authenticated spec in headed mode
npm run test:spec:headed -- tests/ui/crm/case.spec.ts

# Run all CRM specs in headed mode
npm run test:crm:headed

# Run Lightning component specs in headed mode
npm run test:lightning:headed

# Run hybrid specs in headed mode
npm run test:hybrid:headed

# Run auth-only specs in headed mode
npm run test:auth:headed

# Run all authenticated specs in headed mode
npm run test:headed:autoheal
```

#### Common Variations

```bash
# List tests without running them
npm run test:spec:headed -- tests/ui/authenticated/session.spec.ts --list

# Run one spec without rerunning auth setup
npm run test:spec:headed -- tests/ui/crm/lead.spec.ts

# Run one spec with grep
npm run test:spec:headed -- tests/ui/crm/case.spec.ts --grep "@smoke"

# Keep debug env flags instead of clearing them
PW_KEEP_DEBUG=1 npm run test:spec:headed -- tests/ui/crm/case.spec.ts
```

#### Performance Local Run

For Salesforce, the safer local performance command is the saved-auth version below, so Playwright does not rerun `setup` and stop on MFA:

```bash
npm run test:performance:headed
```

#### API Local Run

The API suite needs either:
- `SALESFORCE_ACCESS_TOKEN`
- both `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET`

For the current repo design, `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET` should come from a Salesforce External Client App configured for Client Credentials Flow.

Salesforce-side setup:
- enable `Client Credentials Flow` on the External Client App
- assign a `Run As` integration user for that app
- confirm the `Run As` user is active, unlocked, and has `API Enabled`
- the `Run As` user may be the same Salesforce user you use for UI automation, as long as the app is explicitly configured to run as that username
- keep `SALESFORCE_AUTH_URL` pointed at your Salesforce org domain, for example `https://your-org.my.salesforce.com`
- keep `SALESFORCE_INSTANCE_URL` pointed at the same org-domain family, not the Lightning UI host

What we resolved in this repo:
- `https://login.salesforce.com` returned `invalid_grant` because this client credentials setup must target the org My Domain host
- `https://*.lightning.force.com` is a UI host and does not support the OAuth client credentials token request
- after setting the External Client App `Run As` user and using the `*.my.salesforce.com` host, the API suite authenticated and passed

Use these commands:

```bash
# Check whether API auth is configured
npm run test:api:authcheck

# Run the API suite only when auth is configured
npm run test:api:checked
```

#### Reports And Traces

```bash
# Open the latest HTML report
npm run report:latest

# Open the latest available trace from the newest run that has one
npm run trace:latest
```

#### Raw Playwright Commands We Used During Investigation

These are still useful when you want full control instead of the npm wrappers:

```powershell
$env:AUTO_HEAL='1'
$env:PW_HEADLESS='0'
$env:PW_CHANNEL='chrome'
npx playwright test tests/ui/crm/case.spec.ts --project=authenticated-chromium --workers=1 --no-deps
```

```powershell
$env:AUTO_HEAL='1'
$env:PW_HEADLESS='0'
$env:PW_CHANNEL='chrome'
npx playwright test tests/auth.setup.ts --project=setup --workers=1
```

## Debugging

These examples assume PowerShell on Windows and the repo root as the current working directory.

### Debug Auth Setup And Save Storage State

Use this when you want to do the initial Salesforce login in headed Chrome and allow manual MFA approval. This updates `playwright/.auth/salesforce-user.json`.

```powershell
$env:AUTO_HEAL='1'
$env:PW_HEADLESS='0'
$env:PW_CHANNEL='chrome'
$env:SALESFORCE_MFA_TIMEOUT_MS='180000'
npx playwright test tests/auth.setup.ts --project=setup --workers=1
```

### Debug Auth UI Smoke In Headed Mode

Use this to verify the login experience itself under the auth-only project.

```powershell
$env:AUTO_HEAL='1'
$env:PW_HEADLESS='0'
$env:PW_CHANNEL='chrome'
npx playwright test tests/ui/auth/login.spec.ts --project=chromium --workers=1
```

### Reuse Existing Storage State For One Spec

Use `--no-deps` so Playwright does not rerun the `setup` project and overwrite your current authenticated state.

```powershell
$env:AUTO_HEAL='1'
$env:PW_HEADLESS='0'
$env:PW_CHANNEL='chrome'
npx playwright test tests/ui/crm/case.spec.ts --project=authenticated-chromium --workers=1 --grep "@smoke @critical create a new case" --no-deps
```

### Inspect `waitForLightningReady()` In Playwright Inspector

The framework supports an env-gated pause inside `utils/salesforceLightning.ts` so you can stop exactly where Lightning readiness is checked.

Available stages:
- `after-domcontentloaded`
- `after-shell-visible`
- `after-spinner-hidden`

Example:

```powershell
$env:PWDEBUG='1'
$env:PW_HEADLESS='0'
$env:PW_CHANNEL='chrome'
$env:PW_DEBUG_LIGHTNING_READY='1'
$env:PW_DEBUG_LIGHTNING_READY_STAGE='after-shell-visible'
npx playwright test tests/ui/crm/case.spec.ts --project=authenticated-chromium --workers=1 --grep "@smoke @critical create a new case" --no-deps
```

When the pause triggers:
- Playwright Inspector opens.
- The terminal logs which Lightning shell and spinner selectors matched, their counts, and whether they were visible.
- You can inspect the live page in Chrome DevTools at the same time.

### Open The Latest HTML Report

```powershell
$latest = Get-ChildItem ".\\test-results" -Directory |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $latest) {
  Write-Error "No test-results run folders found."
} else {
  $report = Join-Path $latest.FullName "report\\index.html"
  if (Test-Path $report) {
    Invoke-Item $report
  } else {
    Write-Error "Report not found: $report"
  }
}
```

### Open The Latest Trace

```powershell
$latest = Get-ChildItem ".\\test-results" -Directory |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$trace = Get-ChildItem $latest.FullName -Recurse -Filter trace.zip |
  Select-Object -First 1

if ($trace) {
  npx playwright show-trace $trace.FullName
} else {
  Write-Error "No trace.zip found under $($latest.FullName)"
}
```

### Validate The Current Authenticated Session Quickly

This is a fast way to confirm that the saved storage state is still usable.

```powershell
$env:AUTO_HEAL='1'
$env:PW_HEADLESS='0'
$env:PW_CHANNEL='chrome'
npx playwright test tests/ui/authenticated/session.spec.ts --project=authenticated-chromium --workers=1 --no-deps
```

## How This Repo Differs From The Reference Auto-Heal Framework

This repo started from the same framework philosophy as `playwright-autoheal-framework-2026`, but the Salesforce AUT forced a more specialized design.

### What Stayed The Same

- bounded auto-heal instead of silent retries
- custom failure intelligence reporting
- layered suite split across UI, API, hybrid, and performance
- page object model and custom fixtures
- per-run artifact folders and CI-friendly scripts
- env-driven execution and grep/retry/worker controls

### What Changed For Salesforce

- Authentication model:
  the reference repo can treat login as a normal test flow; this repo needs a dedicated `setup` project, saved storage state, and MFA-aware auth handling
- Browser strategy:
  the reference repo is comfortable as a normal cross-browser framework; this repo is intentionally Chrome-first because Salesforce session trust and Lightning behavior matter more than nominal browser breadth
- Readiness strategy:
  the reference repo mainly waits for page/document readiness; this repo needs Lightning shell readiness, object-home readiness, and record-form readiness
- Navigation strategy:
  the reference repo can usually rely on direct paths; this repo prefers Salesforce navigation items first, then falls back carefully to object URLs on the active org host
- Assertion strategy:
  the reference repo often validates visible page widgets directly; this repo frequently needs multiple acceptable success signals because Lightning can move from modal to record page faster than a traditional toast stays visible
- Picklist strategy:
  the reference repo can often assume stable option names; this repo uses bounded option candidates because Salesforce org configuration changes real values such as account type options
- List-view strategy:
  the reference repo assumes simpler list/search behavior; this repo must account for Lightning views like pipeline inspection where search or row visibility is not always the best sync signal

### Practical Summary

The earlier repo teaches how to build a resilient Playwright framework.

This repo teaches how to adapt that framework to a stateful enterprise platform where:
- auth state is part of the architecture
- UI readiness is multi-stage
- org metadata changes selectors and values
- user-facing flows are slower and more contextual
- not every visible state should be treated as the canonical truth

## Proposed Repo Skill Direction

The reference repo already has a framework skill.

For this repo, the niche skill should not just repeat generic Playwright guidance. It should preserve the good generic instructions from the reference skill and add the Salesforce-specific execution rules we learned here:

- prefer `authenticated-chromium --no-deps` for spec-by-spec reruns once auth state exists
- treat MFA, trusted-browser behavior, and storage state as part of the framework design
- use Lightning readiness and object-home helpers before interacting with page content
- prefer visible matching toasts or record-view transitions over brittle single-signal success checks
- expect org-specific picklist drift and use bounded candidate values where appropriate
- verify list updates using the view’s actual UX model, not assumptions from simpler apps

### Active Repo Skill

The active repo-local agent skill for this framework now lives at:
- [SKILL.md](/c:/Users/rohit/OneDrive%20-%20CAR%20Group%20Limited/IO/GitHub/playwright-salesforce/.agents/skills/playwright-salesforce-framework/SKILL.md)

This is the canonical agent guidance that travels with the repo and is intended to be available on any machine where this repository is checked out.

This repo now includes a temporary draft skill analysis file at:
- [playwright-salesforce-skills-draft.md](/c:/Users/rohit/OneDrive%20-%20CAR%20Group%20Limited/IO/GitHub/playwright-salesforce/docs/playwright-salesforce-skills-draft.md)

It is intentionally a draft and does not replace or activate a final repo `skills.md` yet.

## Test Coverage

### CRM Workflows
- **Lead Management**: Create, validate, list leads
- **Opportunity Management**: Create, stage tracking, list opportunities
- **Account Management**: Create, with industry/type, verify in list
- **Contact Management**: Create, validation, linked to accounts
- **Case Management**: Create, status/priority, SLA validation

### UI Automation (Lightning)
- **Dynamic Lightning Components**: Shadow DOM, dynamic rendering
- **Toast Notifications**: Verify success/error messages
- **Modal Dialogs**: Open/close, form validation
- **List Views**: Search, filter, pagination
- **Form Validation**: Required fields, picklist values
- **Navigation**: Tabs, App Launcher, breadcrumbs

### API Automation
- **SOQL Queries**: Account, Contact, Lead, Case
- **Describe SObject**: Field metadata validation
- **CRUD Operations**: Create, Read, Update, Delete records
- **Response Validation**: Zod schema validation
- **Performance**: Response time thresholds

### Hybrid Tests
- Create records via UI, verify via list views
- End-to-end record creation workflows

### Performance
- Page load timing thresholds for all major pages

## Framework Patterns

### Page Object Model
All page objects follow a consistent pattern:
- Semantic locators (`getByRole`, `getByLabel`, `getByText`)
- Separate `goto()`, action methods, and assertion helpers
- Constructor defines `Locator` properties

### Custom Fixtures
The `base.fixture.ts` provides:
- `page` - Enhanced with failure capture (HTML source + URL on failure)
- `salesforceApi` - Pre-configured API client
- `salesforceUser` - Shared user credentials

### Test Data Generation
Uses `@faker-js/faker` for realistic test data:
- `buildLeadPayload()` - Random lead data
- `buildAccountPayload()` - Random account data
- `buildContactPayload()` - Random contact data
- `buildOpportunityPayload()` - Random opportunity data
- `buildCasePayload()` - Random case data

### Tags
- `@smoke` - Critical path tests
- `@regression` - Full regression suite
- `@critical` - Must-pass tests
- `@e2e` - Long-form CRM lifecycle coverage
- `@hybrid` - API + UI combined
- `@perf` - Performance tests
- `@api` - API-only tests

## API Tests

For API tests, configure Salesforce Client Credentials Flow in `.env`:

```
SALESFORCE_CLIENT_ID=your-external-client-app-client-id
SALESFORCE_CLIENT_SECRET=your-external-client-app-client-secret
SALESFORCE_AUTH_URL=https://your-org.my.salesforce.com
SALESFORCE_INSTANCE_URL=https://your-org.my.salesforce.com
```

API tests will be skipped if OAuth credentials are not configured.

If the API login fails under Client Credentials Flow, check these Salesforce-side items first:
- the External Client App has `Client Credentials Flow` enabled
- the app has a valid `Run As` user configured
- the integration user has `API Enabled`
- the `Run As` user is active and unlocked
- `SALESFORCE_AUTH_URL` points to the correct Salesforce org-domain host instead of `login.salesforce.com`
- `SALESFORCE_INSTANCE_URL` also uses the org-domain host instead of a `*.lightning.force.com` URL

Current verified working pattern:

```
SALESFORCE_BASE_URL=https://your-org.lightning.force.com
SALESFORCE_LOGIN_URL=https://your-org.lightning.force.com
SALESFORCE_AUTH_URL=https://your-org.my.salesforce.com
SALESFORCE_INSTANCE_URL=https://your-org.my.salesforce.com
```

In this repo, `npm run test:api:checked` is the current full non-UI suite. The `hybrid` and `performance` layers still depend on browser-authenticated Salesforce flows.

For layer-by-layer test design guidance and sample test patterns, see [tests/README.md](/c:/Users/rohit/OneDrive%20-%20CAR%20Group%20Limited/IO/GitHub/playwright-salesforce/tests/README.md).

For framework-level code explanations covering why core functions, variables, and return types are designed the way they are, see [framework-code-explanation.md](/c:/Users/rohit/OneDrive%20-%20CAR%20Group%20Limited/IO/GitHub/playwright-salesforce/docs/framework-code-explanation.md).

## CI/CD

The repo now supports a layered GitHub Actions flow:
- bootstrap one Salesforce authenticated storage state in CI
- run browser-backed `@smoke` tests with `authenticated-chromium --no-deps`
- run browser-backed `@regression` tests later in the workflow using the same saved storage state
- run API tests independently with client credentials flow
- optionally run performance tests after regression using the same saved storage state

GitHub Actions secrets expected by the workflow:
- `SALESFORCE_USERNAME`
- `SALESFORCE_PASSWORD`
- `SALESFORCE_BASE_URL`
- `SALESFORCE_LOGIN_URL`
- `SALESFORCE_AUTH_URL`
- `SALESFORCE_INSTANCE_URL`
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`
- `SALESFORCE_TOTP_SECRET` or `SALESFORCE_TOTP_URI` when CI must satisfy MFA non-interactively
- `SALESFORCE_TOTP_PERIOD` and `SALESFORCE_TOTP_ALGORITHM` only if your authenticator setup differs from the defaults
- `SALESFORCE_MFA_TIMEOUT_MS` only if CI needs a non-default wait window

Useful CI-oriented commands:
```bash
npm run test:ci:auth
npm run test:ci:smoke
npm run test:ci:regression
npm run test:api:checked
npm run test:ci:performance
```

In CI, the browser-backed jobs should avoid rerunning the `setup` dependency after auth bootstrap and should instead reuse the saved file at `playwright/.auth/salesforce-user.json`.

## License

MIT
