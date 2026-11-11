import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { waitForScannerVideo } from './scanner-video.ts';

test('camera startup waits for the playing event and reader UI readiness', async () => {
  const video = new EventTarget();
  const controller = new AbortController();
  let ready = false;
  let settled = false;
  const pending = waitForScannerVideo(video, () => ready, controller.signal).then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false, 'the start promise must not enable pause before video setup');
  ready = true;
  video.dispatchEvent(new Event('playing'));
  await pending;
  assert.equal(settled, true);
});

test('leaving during video startup cancels the readiness wait', async () => {
  const controller = new AbortController();
  const pending = waitForScannerVideo(new EventTarget(), () => false, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('a camera that never plays reports a timeout instead of loading forever', async () => {
  await assert.rejects(waitForScannerVideo(new EventTarget(), () => false, new AbortController().signal, 1), /did not become ready/);
});
