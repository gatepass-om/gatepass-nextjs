import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfile = readFileSync(new URL('../../../Dockerfile', import.meta.url), 'utf8');
const javascriptConfig = new URL('../../../next.config.mjs', import.meta.url);

test('production runtime uses a JavaScript Next config without installing TypeScript on startup', () => {
  assert.equal(existsSync(javascriptConfig), true);
  assert.match(dockerfile, /COPY --from=build \/app\/next\.config\.mjs \.\/next\.config\.mjs/);
  assert.doesNotMatch(dockerfile, /next\.config\.ts/);
});
