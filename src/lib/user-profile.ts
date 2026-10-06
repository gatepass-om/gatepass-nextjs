import type { User } from './types';

type UserProfilePayload = Partial<User> & {
  id: string;
  name: string;
  role: User['role'];
  identityNumber?: string | null;
  identityExpiresAtUtc?: string | null;
  employerName?: string | null;
};

export function normalizeUserProfile(payload: UserProfilePayload): User {
  return {
    ...payload,
    idNumber: payload.idNumber ?? payload.identityNumber ?? null,
    idExpiresAtUtc: payload.idExpiresAtUtc ?? payload.identityExpiresAtUtc ?? null,
    company: payload.company ?? payload.employerName ?? null,
  } as User;
}

export function isMaskedIdentityNumber(value?: string | null) {
  return Boolean(value && /[*•x]/i.test(value));
}
