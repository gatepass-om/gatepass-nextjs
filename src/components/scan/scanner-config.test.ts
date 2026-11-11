import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { scannerCamera, scannerOptions } from './scanner-config.ts';

const { Html5Qrcode } = createRequire(import.meta.url)('html5-qrcode');

test('the installed QR reader accepts the camera selection used by the scanner', () => {
  assert.doesNotThrow(() => Html5Qrcode.prototype.createVideoConstraints(scannerCamera));
});

test('the decoding window fits a narrow mobile camera preview', () => {
  assert.equal(typeof scannerOptions.qrbox, 'function');
  const size = scannerOptions.qrbox(300, 168);
  assert.ok(size.width <= 300 && size.height < 168);
  assert.equal(size.width, size.height);
});
