export type AccessRequestApprovalUpdate = {
  status: 'Approved';
  validFromUtc: string;
  expiresAtUtc?: string;
  isPermanent: boolean;
};

export function buildAccessApprovalUpdate(
  validFrom: Date,
  expiresAt: Date | 'Permanent',
): AccessRequestApprovalUpdate {
  const validFromUtc = validFrom.toISOString();

  if (expiresAt === 'Permanent') {
    return {
      status: 'Approved',
      validFromUtc,
      isPermanent: true,
    };
  }

  if (expiresAt.getTime() <= validFrom.getTime()) {
    throw new Error('Access expiry must be after the access start time.');
  }

  return {
    status: 'Approved',
    validFromUtc,
    expiresAtUtc: expiresAt.toISOString(),
    isPermanent: false,
  };
}
