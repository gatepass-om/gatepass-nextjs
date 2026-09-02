import type { CreateUserInput } from '@/lib/api';

const supportedModes = new Set([
  'Web',
  'MobileApp',
  'PrintedCard',
  'Kiosk',
  'Sms',
  'SupervisorAssisted',
]);

const supportedRoles = new Set([
  'Admin',
  'Operator Admin',
  'Contractor Admin',
  'Manager',
  'Security',
  'Visitor',
  'Worker',
  'Supervisor',
  'Inspector',
]);

export type BulkRosterError = {
  row: number;
  message: string;
};

export type BulkRosterPreview = {
  rows: CreateUserInput[];
  errors: BulkRosterError[];
  sourceRowCount: number;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '');
}

function isYes(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback;
  return ['yes', 'true', '1', 'y'].includes(value.trim().toLowerCase());
}

function findValue(headers: string[], values: string[], ...names: string[]) {
  const index = headers.findIndex((header) => names.includes(header));
  return index < 0 ? undefined : values[index]?.trim();
}

function readRequired(headers: string[], name: string, aliases: string[], errors: BulkRosterError[]) {
  if (!headers.some((header) => aliases.includes(header))) {
    errors.push({ row: 1, message: `Missing required column: ${name}.` });
  }
}

export function inspectBulkRosterCsv(csv: string): BulkRosterPreview {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], errors: [], sourceRowCount: 0 };

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const errors: BulkRosterError[] = [];
  readRequired(headers, 'Name', ['name', 'fullname'], errors);
  readRequired(headers, 'National ID', ['idnumber', 'nationalid', 'nationalidnumber', 'identitynumber'], errors);
  readRequired(headers, 'Email', ['email'], errors);
  if (errors.length > 0) return { rows: [], errors, sourceRowCount: lines.length - 1 };

  const nationalIds = new Set<string>();
  const emails = new Set<string>();
  const rows: CreateUserInput[] = [];

  lines.slice(1).forEach((line, index) => {
    const row = index + 2;
    const values = parseCsvLine(line);
    const name = findValue(headers, values, 'name', 'fullname') || '';
    const idNumber = findValue(headers, values, 'idnumber', 'nationalid', 'nationalidnumber', 'identitynumber') || '';
    const email = findValue(headers, values, 'email') || '';
    const role = findValue(headers, values, 'role') || 'Worker';
    const rowErrors: string[] = [];

    if (!name) rowErrors.push('Name is required.');
    if (!idNumber) rowErrors.push('National ID is required.');
    if (!email) rowErrors.push('Email is required.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push('Email is invalid.');
    if (!supportedRoles.has(role)) rowErrors.push(`Role "${role}" is not supported.`);
    if (idNumber && nationalIds.has(idNumber)) rowErrors.push('National ID is duplicated in this roster.');
    if (email && emails.has(email.toLowerCase())) rowErrors.push('Email is duplicated in this roster.');

    nationalIds.add(idNumber);
    emails.add(email.toLowerCase());
    if (rowErrors.length > 0) {
      errors.push({ row, message: rowErrors.join(' ') });
      return;
    }

    const interaction = findValue(headers, values, 'interactionmode', 'preferredinteractionmode') || 'PrintedCard';
    const preferredInteractionMode = supportedModes.has(interaction)
      ? interaction as CreateUserInput['preferredInteractionMode']
      : 'PrintedCard';

    rows.push({
      name,
      email,
      idNumber,
      role,
      workerCode: findValue(headers, values, 'workercode', 'employeenumber') || undefined,
      company: findValue(headers, values, 'employer', 'company') || undefined,
      nationality: findValue(headers, values, 'nationality') || undefined,
      preferredName: findValue(headers, values, 'preferredname') || undefined,
      preferredLanguage: findValue(headers, values, 'preferredlanguage', 'language') || 'en',
      preferredInteractionMode,
      interactiveAccountEnabled: isYes(findValue(headers, values, 'signin', 'interactiveaccountenabled'), false),
      personalDeviceAvailable: isYes(findValue(headers, values, 'phoneavailable', 'personaldeviceavailable'), false),
      canReceiveSms: isYes(findValue(headers, values, 'canreceivesms'), false),
      needsAssistedWorkflow: isYes(findValue(headers, values, 'assisted', 'needsassistedworkflow'), false),
      offlineCardRequired: preferredInteractionMode === 'PrintedCard'
        || isYes(findValue(headers, values, 'offlinecardrequired'), false),
      registrationChannel: 'BulkImport',
      sendWelcomeEmail: false,
    });
  });

  return { rows, errors, sourceRowCount: lines.length - 1 };
}

export function parseBulkRosterCsv(csv: string): CreateUserInput[] {
  return inspectBulkRosterCsv(csv).rows;
}
