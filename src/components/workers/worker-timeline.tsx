'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock3, Download, RefreshCw } from 'lucide-react';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import {
  downloadWorkerTimeline,
  getWorkerTimeline,
  type WorkerTimeline as WorkerTimelineData,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaginationControls } from '@/components/ui/pagination-controls';

const PAGE_SIZE = 20;
const categories = ['All', 'Compliance', 'Document', 'Card', 'Access', 'Presence', 'Audit'];

export function WorkerTimeline({ workerId }: { workerId: string }) {
  const { token } = useSession();
  const { toast } = useToast();
  const [timeline, setTimeline] = useState<WorkerTimelineData | null>(null);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setTimeline(await getWorkerTimeline(token, workerId, {
        page,
        pageSize: PAGE_SIZE,
        category: category === 'All' ? undefined : category,
      }));
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Timeline unavailable',
        description: error.message ?? 'The worker timeline could not be loaded.',
      });
    } finally {
      setLoading(false);
    }
  }, [category, page, token, toast, workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportTimeline = async () => {
    if (!token) return;
    try {
      await downloadWorkerTimeline(token, workerId);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error.message ?? 'The worker timeline could not be exported.',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5" />
              Worker timeline
            </CardTitle>
            <CardDescription>
              Unified compliance, document, card, access, presence, and audit history.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void exportTimeline()}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[220px]" aria-label="Timeline category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>

        {loading && !timeline ? (
          <p className="text-sm text-muted-foreground">Loading worker history…</p>
        ) : !timeline?.items.length ? (
          <p className="text-sm text-muted-foreground">No timeline events match this filter.</p>
        ) : (
          <ol className="space-y-3 border-l pl-4">
            {timeline.items.map(item => (
              <li key={item.id} className="relative rounded-md border bg-card p-3">
                <span className="absolute -left-[1.35rem] top-4 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.occurredAtUtc).toLocaleString()}
                      {item.siteName ? ` · ${item.siteName}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary">{item.category}</Badge>
                </div>
                {item.details && <p className="mt-2 text-sm text-muted-foreground">{item.details}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.action}{item.status ? ` · ${item.status}` : ''}{item.actor ? ` · ${item.actor}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}

        <PaginationControls
          noun="worker timeline"
          page={timeline?.page ?? page}
          totalPages={timeline?.totalPages ?? 0}
          hasPreviousPage={timeline?.hasPreviousPage ?? false}
          hasNextPage={timeline?.hasNextPage ?? false}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}
