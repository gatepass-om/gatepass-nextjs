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

  return <div className="space-y-6 p-4 sm:p-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-blue-600"><Bell className="h-4 w-4" /> Personal inbox</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Notifications</h1><p className="mt-1 text-sm text-slate-500">Project decisions, worker-access actions and confirmations assigned to you.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button></header>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    <section className="grid gap-3 sm:grid-cols-3"><Summary label="Unread" value={unread} icon={Bell} tone="blue" /><Summary label="Project workflow" value={notifications.filter((item) => item.category.startsWith('Project')).length} icon={BriefcaseBusiness} tone="violet" /><Summary label="Access workflow" value={notifications.filter((item) => item.category.includes('Access') || item.category.includes('WorkPass')).length} icon={ClipboardCheck} tone="emerald" /></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div className="flex gap-1"><button onClick={() => setFilter('all')} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>All</button><button onClick={() => setFilter('unread')} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === 'unread' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Unread {unread ? `(${unread})` : ''}</button></div><span className="text-xs text-slate-400">Email is also sent when an address is available</span></div>
      {loading ? <div className="space-y-3 p-4">{[1,2,3].map((item) => <Skeleton key={item} className="h-24" />)}</div> : visible.length ? <div className="divide-y divide-slate-100">{visible.map((notification) => <button key={notification.id} onClick={() => void openNotification(notification)} className={`flex w-full items-start gap-4 p-5 text-left transition hover:bg-slate-50 ${notification.isRead ? '' : 'bg-blue-50/40'}`}><span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notification.isRead ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>{notification.isRead ? <MailCheck className="h-5 w-5" /> : <Bell className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950">{notification.title}</span>{!notification.isRead ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span> : null}</span><span className="mt-1 block text-sm leading-6 text-slate-600">{notification.message}</span><span className="mt-2 block text-xs text-slate-400">{formatDateTime(notification.createdAtUtc)}</span></span>{notification.link ? <span className="mt-2 text-xs font-semibold text-blue-700">Open</span> : null}</button>)}</div> : <div className="px-6 py-16 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" /><h3 className="mt-3 font-semibold text-slate-900">You’re all caught up</h3><p className="mt-1 text-sm text-slate-500">New project and access decisions will appear here.</p></div>}
    </section>
  </div>;
}

function Summary({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Bell; tone: 'blue' | 'violet' | 'emerald' }) { const colors = { blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700', emerald: 'bg-emerald-50 text-emerald-700' }; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p></div><span className={`rounded-xl p-2.5 ${colors[tone]}`}><Icon className="h-5 w-5" /></span></div></div>; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
