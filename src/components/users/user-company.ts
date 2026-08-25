type CompanyAffiliation = {
  operatorId?: string | null;
  contractorId?: string | null;
  company?: string | null;
};

type NamedCompany = { id: string; name: string };

export function resolveUserCompanyName(
  user: CompanyAffiliation,
  contractors: NamedCompany[],
  operators: NamedCompany[],
) {
  if (user.contractorId) {
    return contractors.find((company) => company.id === user.contractorId)?.name
      ?? user.company
      ?? 'Unknown contractor';
  }
  if (user.operatorId) {
    return operators.find((company) => company.id === user.operatorId)?.name
      ?? user.company
      ?? 'Unknown operator';
  }
  return user.company || 'Not assigned';
}
