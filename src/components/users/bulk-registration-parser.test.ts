import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node runs this local TypeScript helper directly in the existing test setup.
import { inspectBulkRosterCsv } from './bulk-registration-parser.ts';

test('roster preview maps National ID and reports missing mandatory fields by row', () => {
  const result = inspectBulkRosterCsv([
    'Name,National ID,Email,Nationality,Role',
    'Aisha Al Balushi,12345678,aisha@example.com,Omani,Worker',
    'Missing ID,,missing-id@example.com,Omani,Worker',
    'Missing email,88776655,,Omani,Worker',
  ].join('\n'));

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].idNumber, '12345678');
  assert.deepEqual(result.errors.map((error) => error.row), [3, 4]);
  assert.match(result.errors[0].message, /National ID/);
  assert.match(result.errors[1].message, /Email/);
});

test('roster preview reports an unsupported role before import', () => {
  const result = inspectBulkRosterCsv([
    'Name,National ID,Email,Nationality,Role',
    'Invalid Role,12345678,invalid@example.com,Omani,Unknown Role',
  ].join('\n'));

  assert.equal(result.rows.length, 0);
  assert.equal(result.errors[0].row, 2);
  assert.match(result.errors[0].message, /Role/);
});
