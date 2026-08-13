import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const root = resolve(__dirname, '..');
const excludedDirectories = new Set([
  '.agents', '.git', '.scratch', '.workbuddy', 'data', 'node_modules',
  'playwright-report', 'test-results',
]);
const textExtensions = new Set([
  '.cjs', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.sh',
  '.ts', '.tsx', '.yaml', '.yml',
]);

type Finding = { file: string; line: number; rule: string };
const findings: Finding[] = [];

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name) ? [] : walk(path);
    }
    if (!entry.isFile()) return [];
    if (entry.name === '.env') return [];
    return textExtensions.has(extname(entry.name)) || entry.name === '.env.example' ? [path] : [];
  });
}

function lineNumber(content: string, offset: number): number {
  return content.slice(0, offset).split('\n').length;
}

function report(file: string, content: string, rule: string, pattern: RegExp): void {
  for (const match of content.matchAll(pattern)) {
    findings.push({ file: relative(root, file), line: lineNumber(content, match.index ?? 0), rule });
  }
}

for (const file of walk(root)) {
  const content = readFileSync(file, 'utf8');

  // Provider-shaped secrets are high confidence even after code is bundled.
  report(file, content, 'provider-shaped credential', /\b(?:sk-[A-Za-z0-9_-]{16,}|AKLT[A-Za-z0-9]{12,}|AKID[A-Za-z0-9]{12,})\b/g);

  // UUID-shaped provider keys are common. Require nearby credential context to
  // avoid treating ordinary content IDs as secrets.
  report(
    file,
    content,
    'credential-like UUID literal',
    /(?:api[_-]?key|authorization|bearer|secret|token)[^\n]{0,100}\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
  );

  // Secret-bearing environment variables may not fall back to a literal.
  report(
    file,
    content,
    'secret environment fallback',
    /process\.env\.(?:[A-Z0-9_]*(?:API_KEY|TOKEN|PASSWORD|SECRET)[A-Z0-9_]*)\s*(?:\|\||\?\?)\s*["'][^"']+["']/g,
  );

  // Catch direct source assignments to credential-bearing identifiers. Empty
  // template values and values read exclusively from process.env are allowed.
  report(
    file,
    content,
    'hard-coded secret assignment',
    /\b(?:const|let|var)\s+[A-Za-z0-9_]*(?:apiKey|api_key|accessToken|authToken|password|passwd|secret)[A-Za-z0-9_]*\s*=\s*["'][^"'\n]+["']/gi,
  );
}

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
for (const [index, line] of envExample.split('\n').entries()) {
  if (/^(?:[A-Z0-9_]*(?:API_KEY|TOKEN|PASSWORD|SECRET)[A-Z0-9_]*)=.+$/.test(line.trim())) {
    findings.push({ file: '.env.example', line: index + 1, rule: 'non-empty secret template value' });
  }
}

const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');
for (const requiredRule of ['.env', '.env.*', '!.env.example', '/data/*.db', '/data/*.db-*']) {
  if (!gitignore.split('\n').includes(requiredRule)) {
    findings.push({ file: '.gitignore', line: 1, rule: `missing ignore rule: ${requiredRule}` });
  }
}

const deployScript = readFileSync(join(root, 'deploy.sh'), 'utf8');
if (/\bcp\s+\.env\.example\s+\.env\b/.test(deployScript)) {
  findings.push({ file: 'deploy.sh', line: 1, rule: 'deployment overwrites environment configuration' });
}
if (!deployScript.includes('[ ! -f data/curio.db ]')) {
  findings.push({ file: 'deploy.sh', line: 1, rule: 'deployment does not protect existing database boundary' });
}

const syncScript = readFileSync(join(root, 'scripts/sync-deploy.sh'), 'utf8');
for (const protectedPath of ['--exclude=.env', "--exclude='.env.*'", '--exclude=data/']) {
  if (!syncScript.includes(protectedPath)) {
    findings.push({ file: 'scripts/sync-deploy.sh', line: 1, rule: `missing protected sync path: ${protectedPath}` });
  }
}
if (syncScript.includes('--delete')) {
  findings.push({ file: 'scripts/sync-deploy.sh', line: 1, rule: 'deployment sync may delete server-only files' });
}

if (findings.length > 0) {
  console.error('CREDENTIAL_SAFETY_FAIL');
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.rule}]`);
  }
  process.exit(1);
}

console.log(`CREDENTIAL_SAFETY_PASS files=${walk(root).length}`);
