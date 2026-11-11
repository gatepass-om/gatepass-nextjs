import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { scannerCamera, scannerOptions } from './scanner-config.ts';

const { Html5Qrcode } = createRequire(import.meta.url)('html5-qrcode');

test('the installed QR reader accepts the camera selection used by the scanner', () => {
  assert.doesNotThrow(() => Html5Qrcode.prototype.createVideoConstraints(scannerCamera));
});

test('the reader decodes the full frame and leaves the viewfinder to the preview', () => {
  assert.equal('qrbox' in scannerOptions, false);
});
