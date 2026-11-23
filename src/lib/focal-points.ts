import type { Contractor } from '@/lib/types';

/** Names of the companies this person is assigned to as focal point. */
export function focalCompanyNames(userId: string | undefined, contractors: Pick<Contractor, 'name' | 'focalPointUserId'>[]): string[] {
  if (!userId) return [];
  return contractors
    .filter((company) => company.focalPointUserId === userId)
    .map((company) => company.name)
    .sort((a, b) => a.localeCompare(b));
}

/** Warning shown before an action that ends someone's focal-point duties. */
export function focalPointLossWarning(names: string[]): string | null {
  if (names.length === 0) return null;
  return `This person is the focal point for ${names.join(', ')}. Operator admins will be alerted to assign a new focal point.`;
}
