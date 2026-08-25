import type { UserRole } from '@/lib/types';

type EditAffiliationInput = {
  role: UserRole;
  originalOperatorId?: string | null;
  originalContractorId?: string | null;
  selectedOperatorId?: string | null;
  selectedContractorId?: string | null;
};

const operatorRoles = new Set<UserRole>([
  'Operator Admin',
  'Manager',
  'Security',
  'Inspector',
]);

export function resolveEditAffiliation(input: EditAffiliationInput) {
  if (input.role === 'Contractor Admin') {
    return {
      operatorId: null,
      contractorId: input.selectedContractorId || input.originalContractorId || null,
    };
  }
  if (operatorRoles.has(input.role)) {
    return {
      operatorId: input.selectedOperatorId || input.originalOperatorId || null,
      contractorId: null,
    };
  }
  if (input.role === 'Worker' || input.role === 'Supervisor' || input.role === 'Visitor') {
    if (input.originalContractorId) {
      return { operatorId: null, contractorId: input.originalContractorId };
    }
    return { operatorId: input.originalOperatorId || null, contractorId: null };
  }
  return { operatorId: null, contractorId: null };
}
