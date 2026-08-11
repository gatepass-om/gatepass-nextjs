'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createReportScheduleRequest,
  listReportSchedulesRequest,
  updateReportScheduleRequest,
  type ReportSchedule,
  type SaveReportSchedule,
} from '@/lib/api';
import type { Site } from '@/lib/types';

type Props = {
  token: string;
  sites: Site[];
};

const defaultTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function ReportSchedulesPanel({ token, sites }: Props) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('all');
  const [frequency, setFrequency] = useState<SaveReportSchedule['frequency']>('Daily');
  const [localTime, setLocalTime] = useState('06:00');
  const [timeZoneId, setTimeZoneId] = useState(defaultTimeZone);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    try {
      setSchedules(await listReportSchedulesRequest(token));
      setError(null);
    } catch {
      setError('Scheduled reports could not be loaded. Try again.');
    }
  }, [token]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  function toRequest(isActive: boolean): SaveReportSchedule {
    const [hour, minute] = localTime.split(':').map(Number);
    return {
      name: name.trim(),
      siteId: siteId === 'all' ? null : siteId,
      frequency,
      timeZoneId,
      localHour: hour,
      localMinute: minute,
      dayOfWeek: frequency === 'Weekly' ? dayOfWeek : null,
      dayOfMonth: frequency === 'Monthly' ? dayOfMonth : null,
      isActive,
    };
  }

  async function createSchedule() {
    if (!name.trim()) {
      setError('Give the schedule a clear name.');
      return;
    }

    setSaving(true);
    try {
      await createReportScheduleRequest(token, toRequest(true));
      setName('');
      setShowForm(false);
      await loadSchedules();
    } catch {
      setError('The schedule could not be saved. Check the time and site, then try again.');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(schedule: ReportSchedule, isActive: boolean) {
    setSaving(true);
    try {
      await updateReportScheduleRequest(token, schedule.id, {
        name: schedule.name,
        siteId: schedule.siteId,
        frequency: schedule.frequency as SaveReportSchedule['frequency'],
        timeZoneId: schedule.timeZoneId,
        localHour: schedule.localHour,
        localMinute: schedule.localMinute,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
        isActive,
      });
      await loadSchedules();
    } catch {
      setError('The schedule could not be updated. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ops-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Scheduled reports</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Automatically prepare compliance CSV files. Staff can download them from the existing export history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          {showForm ? 'Close schedule form' : 'Add report schedule'}
        </button>
      </div>

      {showForm ? (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium text-foreground">
            Schedule name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Daily compliance pack" className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-foreground">
            Site
            <select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal">
              <option value="all">All sites I can view</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-foreground">
            Repeat
            <select value={frequency} onChange={(event) => setFrequency(event.target.value as SaveReportSchedule['frequency'])} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal">
              <option value="Daily">Every day</option>
              <option value="Weekly">Every week</option>
              <option value="Monthly">Every month</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-foreground">
            Local time
            <input type="time" value={localTime} onChange={(event) => setLocalTime(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal" />
          </label>
          {frequency === 'Weekly' ? (
            <label className="grid gap-1 text-xs font-medium text-foreground">
              Day of week
              <select value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value))} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
          ) : null}
          {frequency === 'Monthly' ? (
            <label className="grid gap-1 text-xs font-medium text-foreground">
              Day of month
              <input type="number" min={1} max={31} value={dayOfMonth} onChange={(event) => setDayOfMonth(Number(event.target.value))} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal" />
            </label>
          ) : null}
          <label className="grid gap-1 text-xs font-medium text-foreground">
            Time zone
            <input value={timeZoneId} onChange={(event) => setTimeZoneId(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal" />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={createSchedule} disabled={saving} className="h-10 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? 'Saving…' : 'Save schedule'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-xs text-danger">{error}</p> : null}

      {schedules.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No recurring reports are configured.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{schedule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {schedule.frequency} at {String(schedule.localHour).padStart(2, '0')}:{String(schedule.localMinute).padStart(2, '0')} {schedule.timeZoneId}
                  {' · '}next {new Date(schedule.nextRunAtUtc).toLocaleString()}
                </p>
              </div>
              <button type="button" disabled={saving} onClick={() => setActive(schedule, !schedule.isActive)} className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50">
                {schedule.isActive ? 'Pause' : 'Resume'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
