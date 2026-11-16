import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
import { buildTodayTasks, startOfDay, toExpiryRows, toGateRows } from './today.ts';

const item = (key: string, count: number, severity: string, extra: Record<string, unknown> = {}) => ({
  key, label: key, count, overdueCount: 0, severity, href: `/${key}`, applicable: true, ...extra,
});

test('tasks skip empty and inapplicable items and put the most urgent first', () => {
  const tasks = buildTodayTasks([
    item('a-info', 3, 'info'),
    item('b-empty', 0, 'danger'),
    item('c-na', 5, 'danger', { applicable: false }),
    item('d-danger', 1, 'danger'),
    item('e-warn', 2, 'warning', { overdueCount: 1 }),
  ] as never);
  assert.deepEqual(tasks.map((task: { key: string }) => task.key), ['d-danger', 'e-warn', 'a-info']);
  assert.equal(tasks[1].overdue, 1);
  assert.equal(tasks[2].overdue, 0);
});

test('pending subcontractor registrations are added only when there are some', () => {
  assert.equal(buildTodayTasks([], { pendingSubcontractors: 0 }).length, 0);
  const tasks = buildTodayTasks([], { pendingSubcontractors: 2 });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].href, '/companies');
});

test('gate rows are newest first and a denied decision shows its reason', () => {
  const rows = toGateRows([
    { id: '1', userName: 'A', gateName: 'Main', activityType: 'CheckIn', occurredAtUtc: '2026-11-11T07:00:00Z' },
    { id: '2', userName: 'B', gateName: 'Main', activityType: 'CheckIn', decisionOutcome: 'Denied', failureReason: 'No permit', occurredAtUtc: '2026-11-11T08:00:00Z' },
    { id: '3', userName: 'C', gateName: 'Main', activityType: 'CheckOut', occurredAtUtc: '2026-11-11T06:00:00Z' },
  ]);
  assert.deepEqual(rows.map((row: { id: string }) => row.id), ['2', '1', '3']);
  assert.deepEqual(rows.map((row: { outcome: string }) => row.outcome), ['denied', 'in', 'out']);
  assert.equal(rows[0].detail, 'No permit');
  assert.equal(rows[1].detail, 'Main');
  assert.equal(toGateRows(rows.concat(rows, rows, rows) as never, 3).length, 3);
});

test('expiry rows list only the buckets that have people in them', () => {
  const rows = toExpiryRows({ expired: 0, next7Days: 2, days8To30: 0, days31To60: 9, days61To90: 9 });
  assert.deepEqual(rows.map((row: { key: string }) => row.key), ['week']);
});

test('each expiry row opens the people it counted, not the whole register', () => {
  const rows = toExpiryRows({ expired: 1, next7Days: 2, days8To30: 3, days31To60: 0, days61To90: 0 });
  const href = (key: string) => rows.find((row: { key: string }) => row.key === key)!.href;
  assert.equal(href('expired'), '/users?credentialStatus=Expired');
  // The band has to travel with the link, or "next 7 days" opens everyone expiring within a month.
  assert.equal(href('week'), '/users?credentialStatus=Expiring&within=7');
  assert.equal(href('month'), '/users?credentialStatus=Expiring&within=30');
});

test('a day starts at local midnight', () => {
  const start = startOfDay(new Date(2026, 10, 11, 15, 30));
  assert.equal(start.getHours(), 0);
  assert.equal(start.getDate(), 11);
});
