// Unit tests for the pure logic in lib/ (parsing, validation, tank matching).
// No test framework: compiles those modules to CommonJS with tsc, then runs
// Node's built-in test runner on tests/*.test.cjs. Type checking is `npm run typecheck`.
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '.test-build';
// Modules with no React Native / Supabase imports at runtime.
const PURE_MODULES = [
  'lib/numbers.ts',
  'lib/tankForm.ts',
  'lib/tankMatch.ts',
  'lib/entryDraft.ts',
  'lib/analysisForm.ts',
  'lib/parser/schema.ts',
  'lib/parser/normalize.ts',
  'lib/parser/rules.ts',
  'lib/errors.ts',
  'lib/storage.ts',
  'lib/cache.ts',
  'lib/outbox.ts',
  'lib/tankOverlay.ts',
  'lib/format.ts',
];

rmSync(OUT, { recursive: true, force: true });
execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '--ignoreConfig',
    ...PURE_MODULES,
    '--outDir', OUT,
    '--rootDir', 'lib',
    '--module', 'commonjs',
    '--moduleResolution', 'node10',
    '--ignoreDeprecations', '6.0',
    '--target', 'es2022',
    '--esModuleInterop',
    '--skipLibCheck',
    '--noCheck',
  ],
  { stdio: 'inherit' },
);
writeFileSync(join(OUT, 'package.json'), '{ "type": "commonjs" }\n');

const files = readdirSync('tests')
  .filter((name) => name.endsWith('.test.cjs'))
  .map((name) => join('tests', name));
execFileSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
