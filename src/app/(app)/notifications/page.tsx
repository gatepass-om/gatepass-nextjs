'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BriefcaseBusiness, CheckCircle2, ClipboardCheck, MailCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchUserNotifications, markUserNotificationRead, type UserNotification } from '@/lib/api';
import { useSession } from '@/providers/session-provider';

export default function NotificationsPage() {
  const router = useRouter();
  const { token } = useSession();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try { setNotifications(await fetchUserNotifications(token)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load notifications.'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => filter === 'unread' ? notifications.filter((item) => !item.isRead) : notifications, [filter, notifications]);
  const unread = notifications.filter((item) => !item.isRead).length;

  async function openNotification(notification: UserNotification) {
    if (!token) return;
    if (!notification.isRead) {
      const updated = await markUserNotificationRead(token, notification.id);
      setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
    }
    if (notification.link) router.push(notification.link);
  }

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button></header>
    {error ? <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger-ink">{error}</div> : null}
    <section className="overflow-hidden rounded-xl border border-border bg-card "><div className="flex items-center justify-between border-b border-border p-4"><div className="flex gap-1"><button onClick={() => setFilter('all')} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === 'all' ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-muted'}`}>All</button><button onClick={() => setFilter('unread')} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === 'unread' ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-muted'}`}>Unread {unread ? `(${unread})` : ''}</button></div></div>
      {loading ? <div className="space-y-3 p-4">{[1,2,3].map((item) => <Skeleton key={item} className="h-24" />)}</div> : visible.length ? <div className="divide-y divide-border">{visible.map((notification) => <button key={notification.id} onClick={() => void openNotification(notification)} className={`flex w-full items-start gap-4 p-5 text-left transition hover:bg-muted ${notification.isRead ? '' : 'bg-pending-soft/40'}`}><span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notification.isRead ? 'bg-muted text-muted-foreground' : 'bg-pending-soft text-pending-ink'}`}>{notification.isRead ? <MailCheck className="h-5 w-5" /> : <Bell className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-foreground">{notification.title}</span>{!notification.isRead ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span> : null}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{notification.message}</span><span className="mt-2 block text-xs text-muted-foreground">{formatDateTime(notification.createdAtUtc)}</span></span>{notification.link ? <span className="mt-2 text-xs font-semibold text-pending-ink">Open</span> : null}</button>)}</div> : <div className="px-6 py-16 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" /><h3 className="mt-3 font-semibold text-foreground">You’re all caught up</h3></div>}
    </section>
  </div>;
}

function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
