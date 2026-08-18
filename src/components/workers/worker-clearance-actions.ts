import type { UserRole } from '@/lib/types';
import type { WorkerClearanceAction, WorkerClearance } from '@/lib/api';

type WorkerClearanceStatus = WorkerClearance['status'];

const submitterRoles = new Set<UserRole>(['Admin', 'Contractor Admin', 'Supervisor']);
const reviewerRoles = new Set<UserRole>(['Admin', 'Operator Admin', 'Manager']);

export function getWorkerClearanceActions(
  role: UserRole,
  status: WorkerClearanceStatus,
): WorkerClearanceAction[] {
  if ((status === 'Pending' || status === 'Returned') && submitterRoles.has(role)) {
    return ['submit'];
  }

  if (!reviewerRoles.has(role)) {
    return [];
  }

  if (status === 'Submitted') {
    return ['start-review', 'return'];
  }

  if (status === 'UnderReview') {
    return ['clear', 'return'];
  }

  return [];
}
