import type { CreateUserInput } from '@/lib/api';

const supportedModes = new Set([
  'Web',
  'MobileApp',
  'PrintedCard',
  'Kiosk',
  'Sms',
  'SupervisorAssisted',
]);

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

const normalizeHeader = (value: string) => value.trim().toLowerCase().replaceAll(/[\s_-]+/g, '');
const isYes = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  return ['yes', 'true', '1', 'y'].includes(value.trim().toLowerCase());
};

export function parseBulkRosterCsv(csv: string): CreateUserInput[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const find = (values: string[], ...names: string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    return index < 0 ? undefined : values[index]?.trim();
  };

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const interaction = find(values, 'interactionmode', 'preferredinteractionmode') || 'PrintedCard';
    const preferredInteractionMode = supportedModes.has(interaction)
      ? interaction as CreateUserInput['preferredInteractionMode']
      : 'PrintedCard';
    return {
      name: find(values, 'name', 'fullname') || '',
      email: find(values, 'email') || undefined,
      role: find(values, 'role') || 'Worker',
      workerCode: find(values, 'workercode', 'employeenumber') || undefined,
      company: find(values, 'employer', 'company') || undefined,
      nationality: find(values, 'nationality') || undefined,
      preferredName: find(values, 'preferredname') || undefined,
      preferredLanguage: find(values, 'preferredlanguage', 'language') || 'en',
      preferredInteractionMode,
      interactiveAccountEnabled: isYes(find(values, 'signin', 'interactiveaccountenabled'), false),
      personalDeviceAvailable: isYes(find(values, 'phoneavailable', 'personaldeviceavailable'), false),
      canReceiveSms: isYes(find(values, 'canreceivesms'), false),
      needsAssistedWorkflow: isYes(find(values, 'assisted', 'needsassistedworkflow'), false),
      offlineCardRequired: preferredInteractionMode === 'PrintedCard'
        || isYes(find(values, 'offlinecardrequired'), false),
      registrationChannel: 'BulkImport',
      sendWelcomeEmail: false,
    };
  });
}
