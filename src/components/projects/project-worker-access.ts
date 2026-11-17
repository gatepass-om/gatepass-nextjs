import type { Site, User } from '@/lib/types';

type ProjectWorker = Pick<User, 'id' | 'name' | 'email' | 'role' | 'contractorId' | 'idNumber'>;

export function getEligibleProjectWorkers(
  users: ProjectWorker[],
  contractorId: string | null | undefined,
  search: string,
  selectedWorkerIds: string[],
  showSelectedOnly: boolean,
) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const selected = new Set(selectedWorkerIds);

  return users.filter((worker) => {
    if (worker.role !== 'Worker') return false;
    if (contractorId && worker.contractorId !== contractorId) return false;
    if (showSelectedOnly && !selected.has(worker.id)) return false;
    if (!normalizedSearch) return true;
    return [worker.name, worker.email, worker.idNumber]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  });
}

export function getProjectSites(projectSites: Site[]) {
  return projectSites.toSorted((left, right) => left.name.localeCompare(right.name));
}
