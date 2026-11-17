export type LatestRequestResult<T> =
  | { status: 'accepted'; value: T }
  | { status: 'failed'; error: unknown }
  | { status: 'stale' };

export function createLatestRequestCoordinator() {
  let latestRequestId = 0;
  let latestRequestKey: string | undefined;
  let requestInFlight = false;
  let trailingRequest: PendingRequest | null = null;

  type PendingRequest = {
    id: number;
    request: () => Promise<unknown>;
    resolve: (result: LatestRequestResult<unknown>) => void;
  };

  async function execute(task: PendingRequest) {
    requestInFlight = true;
    let result: LatestRequestResult<unknown>;
    try {
      const value = await task.request();
      result = task.id === latestRequestId
        ? { status: 'accepted', value }
        : { status: 'stale' };
    } catch (error) {
      result = task.id === latestRequestId
        ? { status: 'failed', error }
        : { status: 'stale' };
    }
    task.resolve(result);
    requestInFlight = false;

    const nextRequest = trailingRequest;
    trailingRequest = null;
    if (nextRequest) {
      void execute(nextRequest);
    }
  }

  return {
    run<T>(request: () => Promise<T>, requestKey?: string): Promise<LatestRequestResult<T>> {
      const reusesCurrentGeneration = requestKey !== undefined && requestKey === latestRequestKey;
      if (!reusesCurrentGeneration) {
        latestRequestId += 1;
        latestRequestKey = requestKey;
      }
      const requestId = latestRequestId;
      return new Promise<LatestRequestResult<T>>((resolve) => {
        const pending: PendingRequest = {
          id: requestId,
          request,
          resolve: resolve as (result: LatestRequestResult<unknown>) => void,
        };
        if (!requestInFlight) {
          void execute(pending);
          return;
        }

        trailingRequest?.resolve({ status: 'stale' });
        trailingRequest = pending;
      });
    },
    invalidate() {
      latestRequestId += 1;
      latestRequestKey = undefined;
      trailingRequest?.resolve({ status: 'stale' });
      trailingRequest = null;
    },
  };
}

export function getDashboardFreshness(
  nowMs: number,
  generatedAtUtc: string | null | undefined,
  refreshFailed: boolean,
) {
  if (refreshFailed) {
    return {
      isStale: true,
      message: generatedAtUtc
        ? 'Refresh failed · showing last successful data'
        : 'Refresh failed',
    } as const;
  }

  if (!generatedAtUtc) {
    return { isStale: false, message: null } as const;
  }

  const generatedAtMs = Date.parse(generatedAtUtc);
  const isStale = !Number.isFinite(generatedAtMs)
    || nowMs - generatedAtMs > 2 * 60 * 1000;
  return isStale
    ? { isStale: true, message: 'Data may be stale' } as const
    : { isStale: false, message: null } as const;
}
