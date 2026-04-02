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

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
}

const args = parseArgs(process.argv.slice(2));
const inputDir = path.resolve(args['input-dir'] || 'failed-lists');
const outputFile = path.resolve(args['output-file'] || path.join(inputDir, 'failed-tests.txt'));
const lines = walk(inputDir)
  .filter((filePath) => filePath.endsWith('.txt'))
  .flatMap((filePath) => fs.readFileSync(filePath, 'utf8').split(/\r?\n/))
  .map((line) => line.trim())
  .filter(Boolean);

const uniqueLines = Array.from(new Set(lines)).sort();
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${uniqueLines.join('\n')}${uniqueLines.length ? '\n' : ''}`, 'utf8');

writeOutput('failed_test_count', uniqueLines.length);
writeOutput('failed_test_list_path', outputFile);
console.log(`failed_test_count=${uniqueLines.length}`);
console.log(`failed_test_list_path=${outputFile}`);
