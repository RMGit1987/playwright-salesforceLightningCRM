# Playwright Salesforce Skill Draft

Temporary analysis draft only.

This file is not an active repo skill and does not replace any final `skills.md` or `.agents/skills/.../SKILL.md`.

## Goal

Capture what should be inherited from the reference repo skill in `playwright-autoheal-framework-2026`, then add the niche instructions that are specific to Salesforce Lightning automation in this repo.

## What The Older Repo Skill Already Covers Well

These instructions are still valuable and should carry forward almost unchanged:

- prefer semantic locators first
- use bounded fallback locator candidates instead of ad hoc retries
- use `utils/autoHeal.ts` rather than inventing local retry logic
- avoid hard waits
- group tests clearly and keep page objects responsible for interactions
- use fixtures for shared setup
- use hybrid tests where backend state and UI state need to meet
- use custom reporting to capture failure context
- keep quarantine metadata specific and removable
- keep TypeScript strict and avoid `any`

## What This Salesforce Repo Adds

These are the new repo-specific learnings that were not central in the earlier generic framework:

### 1. Auth State Is Part Of The Architecture

- treat `setup` as a first-class project, not just a convenience
- use saved storage state for almost all Salesforce business-flow reruns
- prefer `authenticated-chromium --no-deps` for spec-by-spec debugging once auth exists
- understand that manual browser trust does not automatically apply to fresh Playwright contexts

### 2. MFA Has To Be Designed, Not Just Handled

- support both manual approval and TOTP-based MFA paths
- do not assume “Don’t ask again” in a personal Chrome session will carry over to Playwright
- store real secrets only in `.env`
- treat MFA timeout, device trust, and storage-state refresh as framework concerns

### 3. Lightning Readiness Is Multi-Stage

- waiting for `domcontentloaded` is necessary but not sufficient
- distinguish between shell readiness, object-home readiness, and record-form readiness
- do not click `New` just because the Lightning chrome is visible
- prefer centralized readiness helpers in `utils/salesforceLightning.ts`

### 4. Navigation Must Respect The Live Org Context

- prefer opening Salesforce objects from the actual app navigation first
- if direct URL fallback is needed, build it from the active org origin instead of assuming `baseURL` is always the right host
- be careful with transitions between login domains and Lightning domains

### 5. Success Signals Need To Be Visible And Context-Aware

- do not treat the first matching `role="status"` node as a toast
- only accept visible matching success surfaces
- allow for Lightning flows where a modal save immediately transitions to a record view
- in long workflows, verify the user-meaningful end state instead of relying on one fragile UI signal

### 6. Picklists And Layouts Are Org-Dependent

- use bounded candidate values where the org may expose different option labels
- do not assume generic values like `Customer` are valid in every org
- keep fallbacks short, deliberate, and explainable

### 7. List Views Are Not Always Simple Searchable Tables

- do not assume every list view has a visible inline search field
- do not assume a newly created record appears in the first visible page of rows
- use the actual UX model of the view:
  row presence, KPI count, status text, filter state, or direct record navigation

### 8. Chrome-First Is Intentional Here

- this repo is not anti-cross-browser, but it is Chrome-first by design
- Salesforce auth trust, MFA behavior, and Lightning stability matter more than symmetric browser coverage for daily debugging
- Firefox should stay opt-in until a suite proves it adds value

## Proposed Final Skill Shape

The final repo skill should stay concise and avoid repeating basic Playwright advice unless it directly affects Salesforce work in this repo.

### Recommended Trigger Description

Use when designing, debugging, or maintaining Playwright automation in this Salesforce repository, especially for Lightning page readiness, saved-auth execution, MFA-aware flows, bounded locator healing, and org-dependent UI behavior.

### Recommended Core Workflow

1. Reuse saved auth state whenever possible.
2. Debug with headed Chrome first.
3. Use `utils/salesforceLightning.ts` for readiness and object navigation.
4. Use `utils/autoHeal.ts` with bounded candidates only where drift is realistic.
5. Prefer visible, user-meaningful success signals.
6. Treat picklists, list views, and Lightning layout behavior as org-specific.
7. Use per-spec reruns and inspect the latest report/trace before changing selectors.

## Candidate Final Skill Draft

```md
name: Playwright Salesforce Framework

description: Use when designing, debugging, or maintaining resilient Playwright tests in this Salesforce repository, especially for Lightning readiness, saved-auth execution, MFA-aware login flows, bounded locator healing, and org-dependent Salesforce UI behavior.

# Playwright Salesforce Framework

## Core Workflow

1. Prefer `authenticated-chromium --no-deps` for spec reruns after auth state exists.
2. Use headed Chrome first for Salesforce debugging.
3. Use `waitForLightningReady`, object-home helpers, and record-form helpers before interacting with page content.
4. Use bounded auto-heal candidates, not broad retry loops.
5. Verify visible, meaningful success signals instead of hidden status nodes.
6. Expect org-specific picklist values and layout differences.
7. Use reports, traces, screenshots, page source, and URL artifacts before patching locators.

## Files To Know

- `utils/salesforceLightning.ts`
- `utils/autoHeal.ts`
- `pageobjects/auth/salesforce-login.page.ts`
- `tests/fixtures/base.fixture.ts`
- `playwright.config.ts`
- `reporters/failure-intelligence-reporter.ts`
- `README.md`

## Repo-Specific Rules

- Treat MFA and storage state as architecture concerns.
- Prefer app-nav object opening before direct object URL fallback.
- Build direct Lightning URLs from the active org context when needed.
- Do not assume every list view exposes a usable search control.
- Do not assume a created record will always be visible in the current rows without filtering.
- Accept that Lightning may move to record view faster than a toast remains visible.
```

## Final Recommendation

The final repo `skills.md` should be:

- shorter than the current README
- more Salesforce-runtime-specific than the older framework skill
- focused on workflow, guardrails, and file entry points
- not overloaded with generic Playwright advice the model already knows

## Review Questions

Before finalizing the real repo skill, decide:

- Should the final skill live as `skills.md` in repo root, or as `.agents/skills/playwright-salesforce-framework/SKILL.md`?
- Do you want the final skill to stay mostly framework-focused, or also include AUT-specific org conventions such as current picklist fallbacks and preferred views?
- Should Chrome-first guidance be mandatory in the skill, or only the recommended default?
