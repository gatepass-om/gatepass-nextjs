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

/**
 * Converts the date pickers' day values into the instants sent to the API, clamped to the project window.
 * A day boundary in the browser's zone (e.g. local midnight in Oman, UTC+4) can fall outside a project that
 * starts mid-day in UTC, and the server rejects any pass that leaves the project window.
 */
export function toWorkPassWindow(
  fromDay: string,
  toDay: string,
  project: { validFromUtc: string; validToUtc: string },
): { validFromUtc: string; validToUtc: string } {
  const projectStart = new Date(project.validFromUtc).getTime();
  const projectEnd = new Date(project.validToUtc).getTime();
  // The API stores microseconds but JS truncates to milliseconds, so a start clamped to the project's own start
  // is rounded up by 1ms to stay on or after it.
  const start = Math.max(new Date(`${fromDay}T00:00:00`).getTime(), projectStart + 1);
  const end = Math.min(new Date(`${toDay}T23:59:59`).getTime(), projectEnd);
  return { validFromUtc: new Date(start).toISOString(), validToUtc: new Date(end).toISOString() };
}
