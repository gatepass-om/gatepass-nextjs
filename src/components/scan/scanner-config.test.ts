import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { scannerCamera, scannerOptions, scannerSampleWidth, scannerVideoLayout } from './scanner-config.ts';

const { Html5Qrcode } = createRequire(import.meta.url)('html5-qrcode');

test('the installed QR reader accepts the camera selection used by the scanner', () => {
  assert.doesNotThrow(() => Html5Qrcode.prototype.createVideoConstraints(scannerCamera));
});

test('the reader decodes the full frame and leaves the viewfinder to the preview', () => {
  assert.equal('qrbox' in scannerOptions, false);
});

test('the video is sampled at full width and scaled to cover a phone preview', () => {
  // A portrait phone camera (1080x1440) shown in a 291x218 card.
  const layout = scannerVideoLayout(291, 218, 1080, 1440);
  assert.equal(layout.width, scannerSampleWidth);
  assert.equal(layout.height, Math.round(scannerSampleWidth * 1440 / 1080));
  assert.ok(layout.width * layout.scale >= 291 - 0.5 && layout.height * layout.scale >= 218 - 0.5);
  assert.ok(layout.left <= 0 && layout.top <= 0);
});

test('the requested camera stream is valid and high resolution', () => {
  assert.equal(scannerOptions.videoConstraints.facingMode, scannerCamera.facingMode);
  assert.ok(scannerOptions.videoConstraints.width.ideal >= scannerSampleWidth);
});
