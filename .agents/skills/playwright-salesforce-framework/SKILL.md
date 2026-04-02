name: Playwright Salesforce Framework

description: Use when designing, debugging, or maintaining resilient Playwright tests in this Salesforce repository, especially for Lightning readiness, saved-auth execution, MFA-aware login flows, bounded locator healing, and org-dependent Salesforce UI behavior.

# Playwright Salesforce Framework

Use this skill when working in this Salesforce Playwright repo, where Lightning behavior, auth state, and org-specific UI variation matter as much as the test code itself.

## Core Workflow

1. Prefer `authenticated-chromium --no-deps` for spec reruns after auth state exists.
2. Use headed Chrome first for Salesforce debugging.
3. Use the helpers in `utils/salesforceLightning.ts` for Lightning readiness, object-home navigation, record forms, picklists, and toasts.
4. Use bounded candidates in `utils/autoHeal.ts` instead of broad retry loops.
5. Verify visible, user-meaningful success signals instead of relying on one brittle selector.
6. Treat picklists, list views, and Lightning layouts as org-specific until proven otherwise.
7. Inspect the latest report, trace, screenshot, URL, and page source before changing locators.

## Files To Know

- `utils/salesforceLightning.ts`
- `utils/autoHeal.ts`
- `pageobjects/auth/salesforce-login.page.ts`
- `pageobjects/salesforce/`
- `pageobjects/components/`
- `tests/fixtures/base.fixture.ts`
- `playwright.config.ts`
- `reporters/failure-intelligence-reporter.ts`
- `README.md`

## Repo-Specific Rules

### 1. Treat Auth State As Architecture

- Use `tests/auth.setup.ts` and the `setup` project to create `playwright/.auth/salesforce-user.json`.
- Prefer saved auth state for almost all business-flow reruns.
- Do not assume a manually trusted Chrome session applies to a fresh Playwright context.

### 2. Treat MFA As A Supported Runtime Path

- Support manual MFA approval and TOTP-based entry from `.env`.
- Keep real secrets only in `.env`, never `.env.example`.
- If MFA reappears, treat it as a framework/runtime issue first, not a random test failure.

### 3. Use Lightning Readiness, Not Just DOM Readiness

- `domcontentloaded` alone is not enough for Salesforce.
- Distinguish shell readiness, object-home readiness, and record-form readiness.
- Do not click `New` just because the global nav is visible.

### 4. Respect The Live Org Context

- Prefer opening objects from Salesforce app navigation first.
- If direct URL fallback is needed, build from the active org origin.
- Be careful when crossing login-domain and Lightning-domain boundaries.

### 5. Keep Success Detection Visible And Context-Aware

- Do not treat the first matching `role="status"` node as a toast.
- Accept visible matching toasts, dialog outcomes, or record-view transitions as appropriate.
- In long workflows, assert the user-meaningful end state instead of one narrow transient signal.

### 6. Expect Org-Specific Drift In Picklists And Views

- Use bounded fallback values where the org may expose different picklist labels.
- Do not assume every list view has inline search.
- Do not assume a created record will always appear in the currently visible rows without filtering.

### 7. Keep The Debug Loop Tight

- Run one spec at a time in headed mode when stabilizing flows.
- Use the repo npm wrappers or equivalent raw commands with `AUTO_HEAL=1`, `PW_HEADLESS=0`, `PW_CHANNEL=chrome`, and `--workers=1`.
- Use `--no-deps` when you want to reuse existing auth state and skip setup reruns.
