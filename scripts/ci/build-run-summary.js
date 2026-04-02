const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadQuarantineEntries() {
  const manifestPath =
    process.env.QUARANTINE_MANIFEST_PATH ||
    path.join(process.cwd(), 'config', 'quarantine-tests.json');
  const manifest = readJson(manifestPath, { tests: [] });
  return Array.isArray(manifest.tests) ? manifest.tests.filter((entry) => entry.enabled !== false) : [];
}

function loadAutoHealStats(runDir) {
  const filePath = path.join(runDir, 'artifacts', 'autoheal-suggestions.jsonl');
  const byTitle = new Map();
  if (!fs.existsSync(filePath)) {
    return { total: 0, byTitle };
  }

  const lines = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const testTitle = entry.testTitle || 'unknown';
      byTitle.set(testTitle, (byTitle.get(testTitle) || 0) + 1);
    } catch {
      // Ignore malformed auto-heal lines.
    }
  }

  return { total: lines.length, byTitle };
}

function loadFailureInsights(runDir) {
  const filePath = path.join(runDir, 'failure-insights.jsonl');
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function normalizeSuiteTitles(titles) {
  return titles.filter((title) => title && !/\.spec\.[cm]?[jt]sx?$/i.test(title));
}

function collectTestsFromSuite(suite, titlePath, bucket) {
  const nextTitlePath = suite.title ? [...titlePath, suite.title] : titlePath;

  if (Array.isArray(suite.specs)) {
    for (const spec of suite.specs) {
      const ancestors = normalizeSuiteTitles(nextTitlePath);
      const fullTitle = [...ancestors, spec.title].filter(Boolean).join(' › ');
      const selector = `${spec.file} :: ${fullTitle}`;

      for (const test of spec.tests || []) {
        const results = Array.isArray(test.results) ? test.results : [];
        const finalResult = results[results.length - 1] || { status: 'skipped' };
        const attemptStatuses = results.map((result) => result.status);
        const hasNonPassAttempt = attemptStatuses.some((status) => !['passed', 'skipped'].includes(status));

        let outcome = finalResult.status || 'skipped';
        if (outcome === 'passed' && hasNonPassAttempt) outcome = 'flaky';
        if (['interrupted', 'timedOut'].includes(outcome)) outcome = 'failed';

        bucket.push({
          file: spec.file,
          line: spec.line,
          title: spec.title,
          fullTitle,
          selector,
          projectName: test.projectName || test.projectId || 'unknown',
          expectedStatus: test.expectedStatus || 'passed',
          finalStatus: outcome,
          attemptCount: results.length,
          attemptStatuses,
        });
      }
    }
  }

  if (Array.isArray(suite.suites)) {
    for (const child of suite.suites) collectTestsFromSuite(child, nextTitlePath, bucket);
  }
}

function collectTests(resultsJson) {
  const tests = [];
  for (const suite of resultsJson.suites || []) collectTestsFromSuite(suite, [], tests);
  return tests;
}

function matchQuarantineReasons(entries, selector) {
  return entries
    .filter((entry) => entry.titlePattern && new RegExp(entry.titlePattern, 'i').test(selector))
    .map((entry) => {
      const extras = [entry.reason, entry.issue].filter(Boolean).join(' ');
      return extras || 'No reason provided.';
    });
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
}

function writeMultiLineOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  const delimiter = `EOF_${name.toUpperCase()}`;
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `${name}<<${delimiter}\n${value}\n${delimiter}\n`,
    'utf8',
  );
}

const args = parseArgs(process.argv.slice(2));
const runDir = path.resolve(args['run-dir'] || process.env.RUN_DIR || process.env.PW_RUN_DIR || '');
const label = args.label || 'Playwright Run';
const mode = args.mode || 'standard';

if (!runDir) {
  throw new Error('build-run-summary: --run-dir or RUN_DIR is required.');
}

const resultsPath = path.join(runDir, 'results.json');
const resultsJson = readJson(resultsPath, null);
if (!resultsJson) {
  throw new Error(`build-run-summary: results.json not found under ${runDir}`);
}

const tests = collectTests(resultsJson);
const quarantineEntries = loadQuarantineEntries();
const autoHealStats = loadAutoHealStats(runDir);
const failureInsights = loadFailureInsights(runDir);

const totals = {
  total: tests.length,
  passed: tests.filter((test) => test.finalStatus === 'passed').length,
  failed: tests.filter((test) => test.finalStatus === 'failed').length,
  skipped: tests.filter((test) => test.finalStatus === 'skipped').length,
  flaky: tests.filter((test) => test.finalStatus === 'flaky').length,
};

const flakyTests = tests.filter((test) => test.finalStatus === 'flaky');
const failedTests = tests.filter((test) => test.finalStatus === 'failed');
const manualInterventionTests = mode === 'quarantine-autoheal' ? failedTests : [];

const lines = [
  `${label} Summary`,
  `Total: ${totals.total}`,
  `Passed: ${totals.passed}`,
  `Failed: ${totals.failed}`,
  `Skipped: ${totals.skipped}`,
  `Flaky: ${totals.flaky}`,
  `Auto-heal fallback actions recorded: ${autoHealStats.total}`,
  `Failure insights captured: ${failureInsights.length}`,
];

if (flakyTests.length) {
  lines.push('', 'Flaky tests detected during this run:');
  for (const test of flakyTests) {
    lines.push(`- ${test.selector} [${test.projectName}] (attempts: ${test.attemptStatuses.join(' -> ')})`);
  }
}

if (mode === 'quarantine-autoheal') {
  if (manualInterventionTests.length) {
    lines.push('', 'Tests still needing manual intervention after the auto-heal rerun:');
    for (const test of manualInterventionTests) {
      const reasons = matchQuarantineReasons(quarantineEntries, test.selector);
      const autoHealCount = autoHealStats.byTitle.get(test.title) || 0;
      const suffix = reasons.length ? ` Reason: ${reasons.join(' ')}` : '';
      lines.push(
        `- ${test.selector} [${test.projectName}] (attempts: ${test.attemptStatuses.join(' -> ')}, auto-heal fallbacks: ${autoHealCount})${suffix}`,
      );
    }
  } else {
    lines.push('', 'No quarantined tests require manual intervention after the auto-heal run.');
  }
}

if (failureInsights.length) {
  lines.push('', 'Why tests failed:');
  for (const insight of failureInsights) {
    const location = insight.file ? `${insight.file}:${insight.line || 1}` : 'unknown location';
    const sourceSuffix = insight.pageSourcePath ? ` | page source: ${insight.pageSourcePath}` : '';
    lines.push(`- [${insight.projectName}] ${location} :: ${insight.errorSummary}${sourceSuffix}`);
  }
}

const markdownLines = [
  `### ${label} Summary`,
  `- Total: ${totals.total}`,
  `- Passed: ${totals.passed}`,
  `- Failed: ${totals.failed}`,
  `- Skipped: ${totals.skipped}`,
  `- Flaky: ${totals.flaky}`,
  `- Auto-heal fallback actions: ${autoHealStats.total}`,
  `- Failure insights captured: ${failureInsights.length}`,
];

if (flakyTests.length) {
  markdownLines.push('', 'Flaky tests detected during this run:');
  for (const test of flakyTests) {
    markdownLines.push(`- ${test.selector} [${test.projectName}] (attempts: ${test.attemptStatuses.join(' -> ')})`);
  }
}

if (mode === 'quarantine-autoheal') {
  if (manualInterventionTests.length) {
    markdownLines.push('', 'Tests still needing manual intervention after the auto-heal rerun:');
    for (const test of manualInterventionTests) {
      const reasons = matchQuarantineReasons(quarantineEntries, test.selector);
      const autoHealCount = autoHealStats.byTitle.get(test.title) || 0;
      const suffix = reasons.length ? ` Reason: ${reasons.join(' ')}` : '';
      markdownLines.push(
        `- ${test.selector} [${test.projectName}] (attempts: ${test.attemptStatuses.join(' -> ')}, auto-heal fallbacks: ${autoHealCount})${suffix}`,
      );
    }
  } else {
    markdownLines.push('', 'No quarantined tests require manual intervention after the auto-heal run.');
  }
}

if (failureInsights.length) {
  markdownLines.push('', 'Why tests failed:');
  for (const insight of failureInsights) {
    const location = insight.file ? `${insight.file}:${insight.line || 1}` : 'unknown location';
    const sourceSuffix = insight.pageSourcePath ? ` | page source: ${insight.pageSourcePath}` : '';
    markdownLines.push(`- [${insight.projectName}] ${location} :: ${insight.errorSummary}${sourceSuffix}`);
  }
}

const summaryJson = {
  label,
  mode,
  totals,
  autoHealFallbackActions: autoHealStats.total,
  failureInsights,
  flakyTests,
  failedTests,
  manualInterventionTests,
};

fs.writeFileSync(path.join(runDir, 'summary.txt'), `${lines.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(runDir, 'summary.md'), `${markdownLines.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(runDir, 'summary.json'), `${JSON.stringify(summaryJson, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(runDir, 'flaky-tests.json'), `${JSON.stringify(flakyTests, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  path.join(runDir, 'manual-intervention-tests.json'),
  `${JSON.stringify(manualInterventionTests, null, 2)}\n`,
  'utf8',
);

writeOutput('total', totals.total);
writeOutput('passed', totals.passed);
writeOutput('failed', totals.failed);
writeOutput('skipped', totals.skipped);
writeOutput('flaky', totals.flaky);
writeOutput('auto_heal_fallbacks', autoHealStats.total);
writeOutput('manual_intervention_count', manualInterventionTests.length);
writeOutput('has_failures', totals.failed > 0 ? 'true' : 'false');
writeOutput('has_flaky', totals.flaky > 0 ? 'true' : 'false');
writeMultiLineOutput('summary_markdown', markdownLines.join('\n'));

console.log(lines.join('\n'));
