// Runs the repo's oxfmt on the given files (via node, so no shell is needed on Windows).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const formatFiles = (...files) => {
  const pkgPath = createRequire(import.meta.url).resolve('oxfmt/package.json');
  const { bin } = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const oxfmt = join(dirname(pkgPath), typeof bin === 'string' ? bin : bin.oxfmt);
  execFileSync(process.execPath, [oxfmt, ...files], { stdio: 'inherit' });
};
