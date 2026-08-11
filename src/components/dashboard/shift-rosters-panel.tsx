'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createShiftRosterRequest,
  listEligibleShiftRosterWorkersRequest,
  listShiftRostersRequest,
  updateShiftRosterRequest,
  type SaveShiftRoster,
  type ShiftRoster,
  type ShiftRosterWorkerOption,
} from '@/lib/api';
import type { Site } from '@/lib/types';

type Props = {
  token: string;
  sites: Site[];
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const defaultTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function ShiftRostersPanel({ token, sites }: Props) {
  const [rosters, setRosters] = useState<ShiftRoster[]>([]);
  const [workerOptions, setWorkerOptions] = useState<ShiftRosterWorkerOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [startLocalTime, setStartLocalTime] = useState('07:00');
  const [endLocalTime, setEndLocalTime] = useState('19:00');
  const [timeZoneId, setTimeZoneId] = useState(defaultTimeZone);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4]);
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedWorkerIds = useMemo(() => new Set(workerIds), [workerIds]);

  const loadRosters = useCallback(async () => {
    try {
      setRosters(await listShiftRostersRequest(token));
      setError(null);
    } catch {
      setError('Shift rosters could not be loaded. Try again.');
    }
  }, [token]);

  useEffect(() => {
    void loadRosters();
  }, [loadRosters]);

  useEffect(() => {
    if (!showForm || !siteId) {
      setWorkerOptions([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoadingWorkers(true);
      try {
        setWorkerOptions(await listEligibleShiftRosterWorkersRequest(token, siteId, workerSearch));
        setError(null);
      } catch {
        setError('Eligible workers could not be loaded for this site.');
      } finally {
        setLoadingWorkers(false);
      }
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [showForm, siteId, token, workerSearch]);

  function toggleDay(day: number) {
    setDaysOfWeek((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort());
  }

  function toggleWorker(workerId: string) {
    setWorkerIds((current) => current.includes(workerId)
      ? current.filter((value) => value !== workerId)
      : [...current, workerId]);
  }

  function clearForm() {
    setName('');
    setWorkerIds([]);
    setWorkerSearch('');
    setShowForm(false);
  }

  async function createRoster() {
    if (!name.trim()) {
      setError('Give the roster a clear name.');
      return;
    }
    if (!siteId) {
      setError('Choose the site where this crew works.');
      return;
    }
    if (daysOfWeek.length === 0) {
      setError('Choose at least one work day.');
      return;
    }

    setSaving(true);
    try {
      await createShiftRosterRequest(token, {
        name: name.trim(),
        siteId,
        timeZoneId,
        startLocalTime,
        endLocalTime,
        daysOfWeek,
        workerIds,
        isActive: true,
      });
      clearForm();
      await loadRosters();
    } catch {
      setError('The roster could not be saved. Check the site, times, days, and selected workers.');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(roster: ShiftRoster, isActive: boolean) {
    setSaving(true);
    try {
      const request: SaveShiftRoster = {
        name: roster.name,
        siteId: roster.siteId,
        timeZoneId: roster.timeZoneId,
        startLocalTime: roster.startLocalTime,
        endLocalTime: roster.endLocalTime,
        daysOfWeek: roster.daysOfWeek,
        workerIds: roster.workerIds,
        isActive,
      };
      await updateShiftRosterRequest(token, roster.id, request);
      await loadRosters();
    } catch {
      setError('The roster could not be updated. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ops-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Shift rosters</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Define who is expected at a site. Absence statistics only use active rosters.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
          {showForm ? 'Close roster form' : 'Add shift roster'}
        </button>
      </div>

      {showForm ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-xs font-medium">
              Roster name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Day maintenance crew" className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Site
              <select
                value={siteId}
                onChange={(event) => {
                  setSiteId(event.target.value);
                  setWorkerIds([]);
                  setWorkerSearch('');
                }}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal"
              >
                <option value="">Choose a site</option>
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Starts
              <input type="time" value={startLocalTime} onChange={(event) => setStartLocalTime(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Ends
              <input type="time" value={endLocalTime} onChange={(event) => setEndLocalTime(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal" />
            </label>
          </div>

          <div>
            <p className="text-xs font-medium text-foreground">Work days</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {dayNames.map((day, index) => (
                <label key={day} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm">
                  <input type="checkbox" checked={daysOfWeek.includes(index)} onChange={() => toggleDay(index)} />
                  {day}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <label className="grid flex-1 gap-1 text-xs font-medium">
                  Find workers eligible for this site
                  <input
                    value={workerSearch}
                    onChange={(event) => setWorkerSearch(event.target.value)}
                    disabled={!siteId}
                    placeholder={siteId ? 'Type a name or worker code' : 'Choose a site first'}
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal"
                  />
                </label>
                <button
                  type="button"
                  disabled={workerOptions.length === 0}
                  onClick={() => setWorkerIds((current) => Array.from(new Set([...current, ...workerOptions.map((worker) => worker.id)])))}
                  className="h-10 rounded-md border border-border px-3 text-xs font-medium disabled:opacity-50"
                >
                  Select all shown
                </button>
              </div>
              <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-border p-2">
                {loadingWorkers ? (
                  <p className="p-2 text-xs text-muted-foreground">Loading workers…</p>
                ) : !siteId ? (
                  <p className="p-2 text-xs text-muted-foreground">Choose a site to see eligible workers.</p>
                ) : workerOptions.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">No matching eligible workers.</p>
                ) : workerOptions.map((worker) => (
                  <label key={worker.id} className="flex min-h-10 items-center gap-3 rounded px-2 text-sm hover:bg-muted">
                    <input type="checkbox" checked={selectedWorkerIds.has(worker.id)} onChange={() => toggleWorker(worker.id)} />
                    <span>{worker.name}{worker.workerCode ? ` · ${worker.workerCode}` : ''}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="grid gap-1 text-xs font-medium">
                Time zone
                <input value={timeZoneId} onChange={(event) => setTimeZoneId(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal" />
              </label>
              <p className="text-xs text-muted-foreground">{workerIds.length} worker{workerIds.length === 1 ? '' : 's'} selected.</p>
              <button type="button" onClick={createRoster} disabled={saving} className="h-10 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? 'Saving…' : 'Save roster'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-xs text-danger">{error}</p> : null}

      {rosters.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No shift rosters are configured.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {rosters.map((roster) => (
            <li key={roster.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{roster.name}</p>
                <p className="text-xs text-muted-foreground">
                  {roster.siteName} · {roster.startLocalTime}–{roster.endLocalTime} · {roster.daysOfWeek.map((day) => dayNames[day]).join(', ')} · {roster.memberCount} workers
                </p>
              </div>
              <button type="button" disabled={saving} onClick={() => setActive(roster, !roster.isActive)} className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50">
                {roster.isActive ? 'Pause' : 'Resume'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
