const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeSuiteTitles(titles) {
  return titles.filter((title) => title && !/\.spec\.[cm]?[jt]sx?$/i.test(title));
}

function collectFailedTestsFromSuite(suite, titlePath, bucket) {
  const nextTitlePath = suite.title ? [...titlePath, suite.title] : titlePath;

  if (Array.isArray(suite.specs)) {
    for (const spec of suite.specs) {
      const ancestors = normalizeSuiteTitles(nextTitlePath);
      const fullTitle = [...ancestors, spec.title].filter(Boolean);

      for (const test of spec.tests || []) {
        const results = Array.isArray(test.results) ? test.results : [];
        const finalResult = results[results.length - 1];
        if (!finalResult) continue;
        if (!['failed', 'timedOut', 'interrupted'].includes(finalResult.status)) {
          continue;
        }

        const projectName = test.projectName || test.projectId || 'unknown';
        const line = spec.line || 1;
        const column = spec.column || 1;
        const selector = [`[${projectName}]`, `${spec.file}:${line}:${column}`, ...fullTitle].join(' › ');
        bucket.push(selector);
      }
    }
  }

  if (Array.isArray(suite.suites)) {
    for (const child of suite.suites) {
      collectFailedTestsFromSuite(child, nextTitlePath, bucket);
    }
  }
}

function collectFailedTests(resultsJson) {
  const failedTests = [];
  for (const suite of resultsJson.suites || []) {
    collectFailedTestsFromSuite(suite, [], failedTests);
  }
  return failedTests;
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
}

const args = parseArgs(process.argv.slice(2));
const runDir = path.resolve(args['run-dir'] || process.env.RUN_DIR || process.env.PW_RUN_DIR || '');
const outputFile = path.resolve(args['output-file'] || path.join(runDir, 'failed-tests.txt'));

if (!runDir) {
  throw new Error('extract-failed-tests: --run-dir or RUN_DIR is required.');
}

const resultsPath = path.join(runDir, 'results.json');
if (!fs.existsSync(resultsPath)) {
  throw new Error(`extract-failed-tests: results.json not found under ${runDir}`);
}

const resultsJson = readJson(resultsPath);
const failedTests = collectFailedTests(resultsJson);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${failedTests.join('\n')}${failedTests.length ? '\n' : ''}`, 'utf8');

writeOutput('failed_test_count', failedTests.length);
writeOutput('failed_test_list_path', outputFile);

console.log(`failed_test_count=${failedTests.length}`);
console.log(`failed_test_list_path=${outputFile}`);
