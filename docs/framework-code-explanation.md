# Framework Code Explanation

This guide is the code-level companion to the root README and `tests/README.md`.

Its purpose is to explain the framework runtime itself:
- why the core functions exist
- why important variables are declared the way they are
- what the return types mean
- how the pieces fit together during a real Playwright run

This follows the same spirit as the explanatory style used in the `bookstore-fastapi` reference repo: not just "what to call", but "why this was built this way".

## Runtime Flow

At a high level, the framework executes in this order:

1. `playwright.config.ts` loads environment variables and builds the run configuration.
2. `global-setup.ts` prepares shared runtime folders and shared Salesforce credentials.
3. The `setup` project can create browser auth state in `playwright/.auth/salesforce-user.json`.
4. The `authenticated-chromium` project reuses that storage state for UI, hybrid, and performance tests.
5. `tests/fixtures/base.fixture.ts` adds framework-level fixtures such as `salesforceApi`, `salesforceUser`, and failure capture.
6. Core helpers in `utils/` provide Lightning readiness, bounded locator fallback, TOTP generation, quarantine support, and logging.
7. `reporters/failure-intelligence-reporter.ts` writes failure-focused artifacts at the end of the run.

## 1. `playwright.config.ts`

File purpose:
- central runtime composition for the framework
- decides projects, output folders, retries, grep filters, browser mode, and report wiring

### `parseIntegerEnv(name: string): number | undefined`

Purpose:
- convert optional numeric env values such as `PW_WORKERS` and `PW_RETRIES` into safe numbers

Why the variables are declared this way:
- `value` is read as a string because all environment variables arrive as strings
- `parsed` is separated from `value` so the code can validate conversion before returning it

Why the return type is `number | undefined`:
- `undefined` means "no usable override was provided"
- this is more expressive than returning `0`, because `0` could be a real value in some contexts
- it lets the config later decide whether to spread a property into the final config object

### `parseBooleanEnv(name: string, defaultValue: boolean): boolean`

Purpose:
- normalize flexible env inputs like `0`, `false`, and `no`

Why the parameters look this way:
- `name` keeps the helper generic
- `defaultValue` allows each caller to define the safe fallback instead of hardcoding one default for all booleans

Why the return type is `boolean`:
- the config always needs an actual on/off answer by the time Playwright config is created

### Top-level run variables

Important variables:
- `runId`
- `runDir`
- `reportDir`
- `blobReportDir`
- `resultsJsonPath`
- `artifactsDir`
- `logsDir`
- `autoHealEnabled`
- `quarantineEntries`
- `grep`
- `grepInvert`
- `workers`
- `retries`
- `headless`
- `enableFirefox`

Why they are top-level constants:
- these values define one coherent run and should stay stable for the life of the config
- top-level constants make the run model predictable and visible in one place

Why `runId` is derived early:
- later tools such as reports, CI summaries, and artifact uploads depend on one shared run identity

Why `process.env.PW_RUN_*` variables are reassigned:
- this lets later runtime pieces read the same derived paths without recalculating them
- it keeps the config as the single source of truth for artifact locations

### Marker file logic

Purpose:
- avoid logging the same run-directory information repeatedly when the config is evaluated more than once

Why a file-based marker is used instead of only an in-memory flag:
- Playwright can spawn workers and processes
- a file marker survives process boundaries better than a simple module variable

### `baseReporters`

Purpose:
- define the core reporting stack for local and CI use

Why it is an array:
- Playwright accepts multiple reporters
- the framework wants human-readable console output, HTML output, JSON output, and the custom failure-intelligence reporter at the same time

Why it is typed as `any[]`:
- Playwright reporter tuple typing can be awkward across mixed reporter forms
- `any[]` keeps the config concise while still allowing the framework to pass the right runtime shape

### `defineConfig({...})`

Purpose:
- produce the final Playwright configuration object

Important design choices:
- `fullyParallel: false`
  the framework favors stability and predictable Salesforce state over maximum speed
- `forbidOnly: !!process.env.CI`
  `.only` is acceptable for local debugging but dangerous in CI
- `...(workers ? { workers } : {})`
  the property is injected only when explicitly configured, so Playwright defaults are preserved otherwise
- `...(grep ? { grep: new RegExp(grep) } : {})`
  filters are optional and should not appear in the config unless requested

### Project definitions

#### `setup`

Purpose:
- run `tests/auth.setup.ts` to create storage state

Why `storageState: undefined`:
- auth bootstrap must begin from a clean browser context
- reusing existing state here would defeat the purpose of setup

#### `authenticated-chromium`

Purpose:
- run the main browser-backed tests with saved Salesforce auth state

Why `dependencies: ['setup']` exists:
- this tells Playwright how auth state is meant to be prepared in normal runs

Why `storageState: getSalesforceStorageStatePath()`:
- the framework treats saved auth state as architecture, not a convenience

#### `chromium`

Purpose:
- isolate login-page tests that should not depend on saved auth state

#### `api`

Purpose:
- isolate REST-level tests from browser projects

Why this matters:
- API tests should not pay the cost of browser setup or storage state

## 2. `global-setup.ts`

File purpose:
- prepare shared runtime data before projects start

### `globalSetup(_config: FullConfig): Promise<void>`

Purpose:
- ensure runtime folders exist
- seed shared Salesforce credentials into `playwright/.seed/salesforce-user.json`
- leave a small marker proving setup ran

Why `_config` is present but unused:
- Playwright passes the full config to global setup
- the underscore shows the parameter is intentionally unused today but kept for the standard signature

Why the function is `async` and returns `Promise<void>`:
- Playwright expects async setup hooks to be awaitable
- `void` is correct because the setup’s job is side effects, not value production

Why the `try/catch` around credential seeding exists:
- browser-only or API-only runs may not always have UI credentials configured
- the framework prefers to warn and continue rather than crash the whole run too early

## 3. `global-teardown.ts`

File purpose:
- leave a deterministic end-of-run marker in the run logs

### `globalTeardown(): Promise<void>`

Purpose:
- write `teardown.log` into the current run directory

Why it returns early when `PW_RUN_DIR` is missing:
- teardown should be safe even in abnormal or minimal execution paths

Why the return type is `Promise<void>`:
- it performs filesystem side effects only

## 4. `utils/loadEnv.ts`

File purpose:
- central environment loading so individual files do not each invent their own dotenv behavior

### Module variable `loaded`

Purpose:
- prevent repeated dotenv loading

Why it is a module-level boolean:
- env loading is global framework state for the current process
- once loaded, repeated reads should be cheap and harmless

### `loadEnv(): void`

Purpose:
- load `.env`, then environment-specific variants if they exist

Why `candidates` is an array:
- the framework supports layered config files
- the order makes precedence explicit and easy to reason about

Why `override: false` is used:
- later loads should not overwrite values that were already set
- this protects explicit OS or CI env variables

Why the return type is `void`:
- callers only care that loading has happened
- config values are read from `process.env`, not returned directly

## 5. `utils/sharedSalesforceUser.ts`

File purpose:
- provide one place for shared Salesforce credential and storage-state paths

### `SharedSalesforceUser`

Purpose:
- define the exact shape the framework expects for shared UI credentials

Why this type is narrow:
- only `username` and `password` are needed for the shared user file
- narrower types reduce accidental over-coupling

### `getSeedDir(): string`

Purpose:
- return the runtime seed directory path

Why it returns `string`:
- the caller needs a concrete filesystem path, not a higher-level object

### `getSharedSalesforceUserPath(): string`

Purpose:
- return the JSON file path for shared user credentials

### `getAuthDir(): string`

Purpose:
- return the directory used for Playwright auth state

### `getSalesforceStorageStatePath(): string`

Purpose:
- give the framework one canonical location for saved storage state

Why centralizing this matters:
- setup, config, and CI all need to agree on the same file path

### `ensureRuntimeDirs(): void`

Purpose:
- create the seed and auth directories if they do not exist

Why it returns `void`:
- callers only need the side effect

### `getConfiguredSalesforceUser(): SharedSalesforceUser`

Purpose:
- convert `process.env` values into a typed shared-user object

Why `trim()` is used:
- secrets copied into env files often accidentally include whitespace

Why it throws instead of returning `undefined`:
- a partially configured user is not meaningful for UI login
- failing fast here keeps auth problems obvious

### `readSharedSalesforceUser(): Promise<SharedSalesforceUser>`

Purpose:
- prefer the seeded runtime file if it exists, otherwise fall back to env config

Why it returns `Promise<SharedSalesforceUser>`:
- it uses async filesystem reads
- the caller should always receive a complete typed user object, not a maybe-value

### `writeSharedSalesforceUser(user: SharedSalesforceUser): void`

Purpose:
- persist the shared user to disk in a stable JSON format

Why `JSON.stringify(..., null, 2)` is used:
- the file is both machine-readable and easy for humans to inspect

## 6. `tests/fixtures/base.fixture.ts`

File purpose:
- extend Playwright’s base test with framework-level fixtures and failure capture

### `SalesforceFixtures`

Purpose:
- describe the extra fixtures added by this repo

Why a dedicated type exists:
- it lets TypeScript understand what is available inside test callbacks

### Custom `page` fixture

Purpose:
- attach auto-heal context
- capture page HTML and URL when a browser test fails unexpectedly

Why `context` is shaped as `AutoHealContext`:
- auto-heal suggestions need test title, project, and output directory, not the entire `testInfo` object
- a narrow context reduces accidental coupling

Why the fixture uses `try/finally`:
- cleanup and failure capture must happen even if the test throws

Why the status check uses `testInfo.status !== testInfo.expectedStatus`:
- this distinguishes truly unexpected outcomes from intentionally skipped or expected-failure cases

### `salesforceApi` fixture

Purpose:
- provide a ready-to-use API client backed by a Playwright `APIRequestContext`

Why it creates and disposes a request context per test:
- request state stays isolated
- cleanup remains deterministic

Why the fixture returns `SalesforceApiClient`:
- tests should use framework-level API methods instead of reconstructing raw requests everywhere

### `salesforceUser` fixture

Purpose:
- provide the shared Salesforce UI credentials to tests that need them

## 7. `utils/logger.ts`

File purpose:
- tiny timestamped logging helpers used across the framework

### `logInfo(message: string): void`
### `logWarn(message: string): void`
### `logError(message: string): void`

Purpose:
- standardize log shape across runtime helpers

Why the functions are this small:
- these are framework plumbing helpers, not a full logging subsystem
- consistency is more important here than complexity

## 8. `utils/quarantine.ts`

File purpose:
- load and query the quarantine manifest for unstable tests

### `QuarantineEntry`

Purpose:
- define the shape of one quarantined-test record

Why fields like `owner`, `issue`, and `enabled` are optional:
- quarantine records may begin simple and become richer over time

### `resolveManifestPath(): string`

Purpose:
- allow the manifest path to be overridden by env while keeping a stable default

### `readQuarantineManifest(): QuarantineManifest`

Purpose:
- read the manifest file and return an empty manifest when none exists

Why returning `{ tests: [] }` is better than throwing:
- missing quarantine config should not break normal execution

### `getEnabledQuarantineEntries(): QuarantineEntry[]`

Purpose:
- return only active quarantine records

Why `entry.enabled !== false` is used:
- entries are enabled by default unless explicitly disabled

### `findQuarantineEntry(title: string): QuarantineEntry | undefined`

Purpose:
- find the first matching quarantine rule for a test title

Why it tries `RegExp` first and falls back to `includes`:
- the manifest supports both regex-style and literal patterns
- bad regex should degrade gracefully rather than crash test discovery

## 9. `utils/autoHeal.ts`

File purpose:
- provide bounded locator fallback rather than uncontrolled retry behavior

### `AutoHealContext`

Purpose:
- hold only the context needed to write useful auto-heal observations

### `LocatorCandidate`

Purpose:
- pair a human-readable label with a real Playwright locator

Why both fields matter:
- the locator drives automation
- the label makes artifacts and logs understandable to humans

### `AutoHealRecord`

Purpose:
- define the exact record shape written to `autoheal-suggestions.jsonl`

### `getContext(): AutoHealContext`

Purpose:
- safely return a context object even when none is set

Why it returns `{}` instead of `undefined`:
- later code can read optional properties without repeated null checks

### `isAutoHealEnabled(): boolean`

Purpose:
- gate all auto-heal recording behind an env flag

### `getOutputFile(): string`

Purpose:
- compute the output path for auto-heal suggestions

Why it falls back across multiple env vars:
- different run paths may define different artifact roots

### `appendRecord(record: AutoHealRecord): Promise<void>`

Purpose:
- append one JSON line to the auto-heal suggestions file

Why JSON Lines:
- each observation is written incrementally
- the file remains easy to stream and merge

### `recordAutoHealObservation(...)`

Purpose:
- merge page state with the current context and write one observation

### `resolveVisibleLocator(...)`

Purpose:
- try locator candidates in order until one becomes visible

Why `candidates[0]` is treated as `primary`:
- the first locator is the preferred selector
- later matches are treated as fallback behavior worth recording

Why the return type is `Promise<Locator>`:
- callers need the resolved locator so they can click, fill, or wait on the actual chosen element

### `resolveEditableLocator(...)`

Purpose:
- refine visible resolution for text input scenarios where visibility alone is not enough

Why `isEditable()` is checked:
- a visible container or wrapper is not always a fillable field

### `autoHealClick(...)`

Purpose:
- resolve a visible locator and click it

Why the return type is `Promise<void>`:
- the caller only needs the click side effect

### `autoHealFill(...)`

Purpose:
- resolve an editable locator and fill it

Why it returns `Promise<Locator>` instead of `void`:
- some callers need the chosen locator for later decisions

Why it falls back from `fill()` to `pressSequentially()`:
- some Salesforce fields behave better with real typing than direct fill injection

### `autoHealWaitVisible(...)`

Purpose:
- expose visibility resolution as a reusable helper for callers that only need waiting behavior

## 10. `utils/salesforceLightning.ts`

File purpose:
- centralize Lightning-specific readiness, navigation, record-form, picklist, and toast behavior

This file exists because Salesforce UI readiness is not the same as simple DOM readiness.

### `escapeRegex(text: string): string`

Purpose:
- safely convert dynamic text into regex-safe text

Why it returns `string`:
- it prepares strings for later `RegExp` construction

### `isTruthyEnv(name: string): boolean`

Purpose:
- small helper for debug flags like `PW_DEBUG_LIGHTNING_READY`

### `buildSalesforceUrl(page: Page, path: string): string`

Purpose:
- build an org-correct absolute URL for direct navigation fallback

Why it prefers `page.url()` first:
- the current live org origin is more trustworthy than stale config when already available

Why it falls back to configured base URLs:
- early in a run, the page may still be blank or on an error page

### `describeLocatorState(...)`

Purpose:
- summarize one selector’s count and visibility for Lightning debug logging

### `logLightningReadyDebugState(...)`

Purpose:
- collect detailed shell and spinner state when debug mode is enabled

Why it is separated from the pause logic:
- the framework sometimes needs logging behavior without immediately mixing that with pause conditions

### `pauseForLightningReadyDebug(...)`

Purpose:
- pause Playwright Inspector at specific Lightning-readiness stages

### `waitForLightningReady(page: Page, timeoutMs = 30_000): Promise<void>`

Purpose:
- wait for DOM content, a visible Lightning shell, and spinner disappearance

Why the flow is multi-stage:
- Salesforce may show a rendered shell before the page is genuinely usable

Why the return type is `Promise<void>`:
- the caller only cares that the page is ready enough to continue

### `waitForLightningObjectHome(...)`

Purpose:
- verify that an object home page is truly ready, not just that a URL changed

Why `expect.poll(...)` is used:
- Lightning surfaces often become usable through gradual rendering
- polling multiple user-meaningful conditions is more robust than one brittle selector

### `openLightningObjectHome(...)`

Purpose:
- open a Salesforce object via app navigation first, then fall back to direct URL if needed

Why navigation-first matters:
- it better reflects how Salesforce wants the user to move through the app
- some orgs behave differently when pages are opened only by direct URL

### `waitForRecordForm(...)`

Purpose:
- wait for any of several valid record-form surfaces

Why the return type is `Promise<Locator>`:
- later field helpers need the resolved form root for scoped element queries

### `clickNewRecord(...)`

Purpose:
- open the new-record dialog with bounded selector fallbacks

### `clickSaveRecord(...)`

Purpose:
- save a record and then re-wait for Lightning readiness

Why it calls `waitForLightningReady()` after save:
- save actions often trigger page re-rendering, navigation, or toast activity

### `expectLightningToast(...)`

Purpose:
- wait for a visible toast matching specific text

Why `expect.poll(...)` is used here too:
- Lightning toasts can exist in the DOM without being the visible user-facing toast

### `fillLightningTextField(...)`

Purpose:
- fill a field inside the active record form using label-, name-, and data-based fallbacks

Why the parameters include both `labelPattern` and `apiName`:
- Salesforce markup varies by org and component
- sometimes the visible label is the best anchor
- sometimes the API-name-based attribute is the most stable anchor

### `selectLightningComboboxOption(...)`

Purpose:
- open a combobox and choose one expected option

### `selectLightningComboboxOptionFromCandidates(...)`

Purpose:
- try multiple acceptable business values until one works

Why it returns `Promise<string>`:
- the caller may need to know which candidate actually matched in the live org

### `openLightningCombobox(...)`

Purpose:
- centralize the many ways a Lightning combobox can be opened

### `isLightningUrl(url: string): boolean`

Purpose:
- tiny helper to tell whether the page is already inside Lightning

## 11. `utils/totp.ts`

File purpose:
- generate Salesforce MFA codes locally when the framework has a TOTP secret or URI

### `TotpAlgorithm`

Purpose:
- restrict supported algorithms to known valid values

Why a union type is used:
- it prevents accidental unsupported strings at compile time

### `TotpConfig`

Purpose:
- describe the data needed to generate a TOTP code

Why `digits`, `period`, and `algorithm` are optional:
- the framework has sensible defaults for the common case

### `normalizeBase32(secret: string): string`

Purpose:
- remove formatting noise from a secret before decoding

### `decodeBase32(secret: string): Buffer`

Purpose:
- convert a Base32 secret into raw bytes for HMAC use

Why the return type is `Buffer`:
- the crypto API expects binary key material, not a formatted string

### `parsePositiveInteger(value: string | null, fallback: number): number`

Purpose:
- safely parse env-style numeric strings

### `parseAlgorithm(value: string | null): TotpAlgorithm`

Purpose:
- normalize an env string into one of the allowed algorithm values

### `parseOtpAuthUri(uri: string): TotpConfig`

Purpose:
- extract secret and timing configuration from an `otpauth://` URI

Why it throws on malformed URI:
- a bad MFA secret should fail clearly instead of silently producing wrong codes

### `buildCounterBuffer(counter: bigint): Buffer`

Purpose:
- encode the moving TOTP counter into the 8-byte format expected by HOTP/TOTP

Why `bigint` is used:
- counters are conceptually integer sequence values, and `bigint` maps cleanly to the spec

### `generateTotpCode(config: TotpConfig, atTimeMs = Date.now()): string`

Purpose:
- generate a correctly padded TOTP code

Why the return type is `string` instead of `number`:
- leading zeroes matter in MFA codes

### `resolveSalesforceMfaCodeFromEnv(): string | undefined`

Purpose:
- resolve MFA input from the environment in a clear precedence order

Resolution order:
1. `SALESFORCE_MFA_CODE`
2. `SALESFORCE_TOTP_URI`
3. `SALESFORCE_TOTP_SECRET`

Why the return type is `string | undefined`:
- MFA may or may not be configured for automation
- `undefined` tells the caller to fall back to manual approval behavior

## 12. `pageobjects/auth/salesforce-login.page.ts`

File purpose:
- encapsulate Salesforce login and MFA flow behavior

### `getMfaCompletionTimeoutMs(): number`

Purpose:
- convert the MFA timeout env value into a safe runtime number

Why the fallback is `120_000`:
- MFA approval is slower and more human-dependent than normal page waits

### `SalesforceLoginPage`

Purpose:
- group login locators and auth-related actions around a single `Page`

Why locator properties are `readonly`:
- these references are part of the page object definition and should not be reassigned later

### `goto(): Promise<void>`

Purpose:
- navigate to the login root

### `loginIfNeeded(username: string, password: string): Promise<void>`

Purpose:
- avoid unnecessary re-login when the current page is already in a valid Lightning session

Why it first visits `/lightning/page/home`:
- that URL is a fast and meaningful probe for authenticated state

### `login(username: string, password: string): Promise<void>`

Purpose:
- perform the actual username/password entry using bounded auto-heal candidates

Why locator candidate arrays are used:
- Salesforce login markup can vary slightly by host or page version

### `expectSuccessfulLogin(): Promise<void>`

Purpose:
- confirm the flow reached Lightning, handling MFA if the org challenges the user

Why it first waits for `lightning|verification|challenge|mfa`:
- both successful auth and MFA challenge are valid intermediate outcomes

### `expectLoginError(): Promise<void>`

Purpose:
- assert that login failed in the expected user-visible way

### `expectMfaChallenge(): Promise<void>`

Purpose:
- assert that the page entered MFA challenge state

### `handleMfaIfPresent(verificationCode?: string): Promise<boolean>`

Purpose:
- detect MFA state, optionally fill a code, and submit it

Why the return type is `Promise<boolean>`:
- the caller may need to know whether MFA handling logic was invoked at all

Why `verificationCode` is optional:
- callers can either pass a code directly or let the helper resolve it from env

## 13. `src/domain/salesforceApi/salesforce.api.ts`

File purpose:
- wrap Salesforce REST API access behind a typed framework client

### `SalesforceAuthResponse`

Purpose:
- define only the token-response fields the framework cares about

Why many fields are optional:
- Salesforce responses can vary slightly by flow and context
- the framework should not over-assume fields it does not truly require

### `SalesforceApiClient`

Purpose:
- hold API request state, auth state, and reusable record/query operations

Why these private fields exist:
- `accessToken`
  cached auth for the life of the client
- `instanceUrl`
  one resolved base URL for later API calls
- `authError`
  preserves the best auth failure explanation for later throwing

### `constructor(request: APIRequestContext, instanceUrl?: string)`

Purpose:
- build the client around Playwright’s request context

Why `instanceUrl` is optional:
- tests can override it, but most runs should inherit it from env

### `buildAuthUrlCandidates(): string[]`

Purpose:
- produce the ordered list of candidate OAuth hosts to try

Why `new URL(value).origin` is used:
- token requests need the origin, not a full path

Why Lightning hosts are filtered out:
- `*.lightning.force.com` is valid for UI navigation but not for the OAuth token endpoint in this framework

Why the return type is `string[]`:
- auth may need multiple candidates, especially when env config is inconsistent or partially set

### `authenticate(): Promise<void>`

Purpose:
- obtain an access token via client credentials flow, or fall back to a provided raw token

Why `errors: string[]` is accumulated:
- failed multi-host auth attempts are much easier to debug when every attempt is preserved

Why the method returns `Promise<void>`:
- successful authentication is stored on the client instance rather than returned directly

### `ensureAuthenticated(): Promise<void>`

Purpose:
- guarantee token and instance URL are present before any API call proceeds

Why this is private:
- it is internal framework plumbing for the public API methods

### `createRecord(...)`
### `getRecord(...)`
### `updateRecord(...)`
### `deleteRecord(...)`
### `query(...)`
### `describe(...)`

Shared purpose:
- expose the main Salesforce REST operations the suite currently needs

Shared design choices:
- each method calls `ensureAuthenticated()` first
- each method resolves `version` from env with a stable default
- each method returns the raw Playwright `APIResponse`

Why the return type stays as the raw response:
- tests sometimes need different assertions on status, body, and timing
- keeping the raw response preserves flexibility without hiding transport details

## 14. `reporters/failure-intelligence-reporter.ts`

File purpose:
- turn failure output into compact, human-readable troubleshooting artifacts

### `FailureInsight`

Purpose:
- define the summary shape written to JSONL and Markdown

### `FailureIntelligenceReporter`

Purpose:
- collect unexpected failures and write structured outputs at the end of the run

### `onBegin(_config, _suite): void`

Purpose:
- resolve output file paths and ensure their parent directory exists

Why the parameters are unused:
- the reporter interface requires them even though this implementation only needs the run directory

### `onTestEnd(test, result): Promise<void>`

Purpose:
- convert one failed test result into a framework-specific failure summary

Why `errorSummary` is reduced to the first meaningful line:
- reports are more useful when they are short and scannable first

Why attachment names and paths are captured:
- the framework already saves page source and URL on browser failures, so the reporter should surface those artifacts

### `onEnd(): void`

Purpose:
- write a Markdown summary for quick human review after the run

## Why This Framework Looks The Way It Does

Several design patterns repeat across the framework on purpose:

### 1. Narrow return types where possible

Examples:
- `boolean` for env gates
- `string` for canonical paths
- `Promise<void>` for side-effect helpers
- `Promise<Locator>` only when the caller truly needs the resolved element

Reason:
- the code becomes easier to compose when each function exposes only what the caller really needs

### 2. Early normalization of environment input

Examples:
- integer parsing in config and MFA timeout handling
- host normalization in the API client
- Base32 normalization in TOTP generation

Reason:
- env input is one of the least trustworthy inputs in a framework
- validating and normalizing it early keeps failures easier to reason about

### 3. Shared paths and shared state are centralized

Examples:
- `getSalesforceStorageStatePath()`
- `getSharedSalesforceUserPath()`
- `PW_RUN_*` env values

Reason:
- when multiple files depend on the same artifact path, one canonical helper prevents drift

### 4. Salesforce-specific behavior is abstracted, not spread across tests

Examples:
- Lightning readiness helpers
- login and MFA page object
- API auth client
- auto-heal locator helpers

Reason:
- the test files should express business intent, not rebuild framework plumbing

### 5. The framework prefers bounded flexibility over silent magic

Examples:
- locator candidates are explicit and ordered
- combobox fallback values are bounded lists
- auth host candidates are visible and logged

Reason:
- this keeps the framework adaptable without making failures impossible to debug

## Suggested Reading Order

If someone is onboarding to this repo’s code, the best order is:

1. `playwright.config.ts`
2. `global-setup.ts`
3. `utils/sharedSalesforceUser.ts`
4. `tests/fixtures/base.fixture.ts`
5. `pageobjects/auth/salesforce-login.page.ts`
6. `utils/salesforceLightning.ts`
7. `utils/autoHeal.ts`
8. `src/domain/salesforceApi/salesforce.api.ts`
9. `reporters/failure-intelligence-reporter.ts`

That order moves from framework bootstrapping to runtime helpers to business-facing test support.
