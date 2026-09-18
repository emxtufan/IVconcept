import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Everything that ends up inside the Vercel functions runs as real Node ESM,
 * where relative imports must carry the `.js` extension. Vite and the test
 * runner both resolve extensionless imports, so a missing extension only fails
 * in production, at runtime - exactly how `/var/task/src/routes` went missing.
 */
const projectRoot = new URL('..', import.meta.url).pathname;
const serverRoots = ['api', 'server'];
const sharedFiles = ['src/seo.ts', 'src/routes.ts'];

function collect(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) return collect(fullPath);
    return fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') ? [fullPath] : [];
  });
}

function serverSideFiles() {
  const fromRoots = serverRoots.flatMap((root) => collect(path.join(projectRoot, root)));
  const shared = sharedFiles.map((file) => path.join(projectRoot, file));
  return [...fromRoots, ...shared];
}

test('every relative import in the server graph carries a .js extension', () => {
  const offenders: string[] = [];

  for (const file of serverSideFiles()) {
    const source = readFileSync(file, 'utf8');
    const specifiers = [...source.matchAll(/\bfrom\s+'(\.[^']*)'/g)].map((match) => match[1]);

    for (const specifier of specifiers) {
      if (specifier.endsWith('.js') || specifier.endsWith('.json')) continue;
      offenders.push(`${path.relative(projectRoot, file)} -> ${specifier}`);
    }
  }

  assert.deepEqual(offenders, [], `Add the .js extension to these imports:\n${offenders.join('\n')}`);
});

test('the shared modules never read Vite build variables', () => {
  // `src/routes.ts` and `src/seo.ts` are imported by the Vercel page function.
  // `import.meta.env` only exists once Vite has replaced it, so it would be
  // undefined there. (`applyPageMetadata` does touch the DOM, but only the
  // browser ever calls it - the server imports `getPageMetadata` alone.)
  for (const file of sharedFiles) {
    const source = readFileSync(path.join(projectRoot, file), 'utf8');
    assert.doesNotMatch(source, /\bimport\.meta\.env\b/, `${file} must not read Vite build variables`);
  }
});
