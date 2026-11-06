import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const runtime = ['src/model-api.mjs', 'src/redaction.mjs', 'src/contracts.mjs', 'src/local-evidence.mjs', 'demo.mjs'];
const allowed = new Set(['node:crypto', 'node:fs/promises', 'node:path', 'node:os', 'node:url', 'node:assert/strict']);
let failures = 0;
for (const path of runtime) {
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
    const imported = match[1];
    if (!imported.startsWith('.') && !allowed.has(imported)) { console.error('Forbidden runtime import', path, imported); failures++; }
    if (imported.startsWith('.')) {
      const target = resolve(root, dirname(path), imported);
      if (relative(root, target).startsWith('..')) { console.error('Import escapes package', path); failures++; }
    }
  }
  if (/process\.env|process\s*\[\s*['"]env|dotenv|require\s*\(|\bfetch\s*\(/.test(source)) { console.error('Forbidden environment/network route', path); failures++; }
}
const files = [];
async function walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { if (['node_modules', 'evidence'].includes(entry.name)) continue; const p = resolve(dir, entry.name); if (entry.isDirectory()) await walk(p); else if (p.endsWith('.mjs')) files.push(p); } }
await walk(root);
for (const path of files) { const r = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' }); if (r.status !== 0) { console.error(r.stderr); failures++; } }
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (!pkg.private || Object.keys(pkg.dependencies ?? {}).length || pkg.scripts.postinstall || pkg.scripts.deploy) failures++;
console.log(JSON.stringify({ syntaxFiles: files.length, runtimeFiles: runtime.length, runtimeDependencies: Object.keys(pkg.dependencies ?? {}).length, boundaryFailures: failures }));
if (failures) process.exit(1);
const tests = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', './vitest.config.mjs'], { stdio: 'inherit' });
process.exit(tests.status ?? 1);
