import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { shouldShowAttendanceAnalytics } from './dashboard-mode.ts';

const openSite = {
  id: 'open-site',
  operatorId: 'operator-a',
  usesSecurityCheckpoints: false,
  usesSmartAccess: false,
};

const controlledSite = {
  id: 'controlled-site',
  operatorId: 'operator-b',
  usesSecurityCheckpoints: true,
  usesSmartAccess: false,
};

test('hides attendance analytics for an operator whose sites do not track check-ins', () => {
  assert.equal(
    shouldShowAttendanceAnalytics([openSite, controlledSite], 'operator-a', ''),
    false,
  );
});

test('shows attendance analytics for an operator with a controlled entry operation', () => {
  assert.equal(
    shouldShowAttendanceAnalytics([openSite, controlledSite], 'operator-b', ''),
    true,
  );
});

test('uses the selected site capability instead of other sites in the operator scope', () => {
  assert.equal(
    shouldShowAttendanceAnalytics(
      [
        openSite,
        { ...controlledSite, operatorId: 'operator-a' },
      ],
      'operator-a',
      'open-site',
    ),
    false,
  );
});

test('hides attendance analytics when the operation has no configured sites', () => {
  assert.equal(shouldShowAttendanceAnalytics([], 'operator-a', ''), false);
});
