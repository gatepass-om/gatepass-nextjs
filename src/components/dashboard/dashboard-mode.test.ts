import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { shouldShowAttendanceAnalytics } from './dashboard-mode.ts';

test('checkpoint sites enable attendance analytics', () => {
  assert.equal(shouldShowAttendanceAnalytics({ checkpointSites: 1, smartAccessSites: 0 }), true);
});

test('smart-access alone enables attendance analytics', () => {
  assert.equal(shouldShowAttendanceAnalytics({ checkpointSites: 0, smartAccessSites: 1 }), true);
});

test('compliance-only sites do not show movement analytics', () => {
  assert.equal(shouldShowAttendanceAnalytics({ checkpointSites: 0, smartAccessSites: 0 }), false);
});

test('missing summary capability data fails closed', () => {
  assert.equal(shouldShowAttendanceAnalytics(null), false);
});
