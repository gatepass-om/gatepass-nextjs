'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CreditCard, Printer, Search } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import {
  getWorkerCardBranding,
  getWorkerDocumentDataUrl,
  markWorkerCardsPrinted,
  searchWorkerCards,
  type PagedResult,
  type WorkerCard,
  type WorkerCardBranding,
} from '@/lib/api';
import { buildWorkerCardBatchPrintHtml } from '@/components/workers/worker-card-print';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PaginationControls } from '@/components/ui/pagination-controls';

const emptyPage: PagedResult<WorkerCard> = {
  items: [],
  page: 1,
  pageSize: 25,
  totalCount: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

export default function CardProductionPage() {
  const { loading, isAuthorized, UnauthorizedComponent } = useAuthProtection([
    'Admin',
    'Operator Admin',
    'Contractor Admin',
  ]);
  const { token } = useSession();
  const { toast } = useToast();
  const [result, setResult] = useState(emptyPage);
  const [branding, setBranding] = useState<WorkerCardBranding | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [cards, cardBranding] = await Promise.all([
      searchWorkerCards(token, { search, page, pageSize: 25 }),
      getWorkerCardBranding(token),
    ]);
    setResult(cards);
    setBranding(cardBranding);
    setSelected(current => new Set([...current].filter(id => cards.items.some(card => card.id === id))));
  }, [page, search, token]);

  useEffect(() => {
    void load().catch(error => toast({
      variant: 'destructive',
      title: 'Card queue unavailable',
      description: error.message ?? 'The worker card production queue could not be loaded.',
    }));
  }, [load, toast]);

  const toggle = (cardId: string, checked: boolean) => {
    setSelected(current => {
      const next = new Set(current);
      if (checked) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  };

  const batchPrint = async () => {
    if (!token || !branding) return;
    const cards = result.items.filter(card => selected.has(card.id));
    if (cards.length === 0) return;
    setBusy(true);
    try {
      const assets = await Promise.all(cards.map(async card => ({
        card,
        qrDataUrl: await QRCode.toDataURL(card.credential, {
          width: 480,
          margin: 1,
          errorCorrectionLevel: 'Q',
        }),
        photoDataUrl: card.photoDocumentId
          ? await getWorkerDocumentDataUrl(token, card.photoDocumentId)
          : null,
      })));
      const printWindow = window.open('', '_blank', 'width=900,height=650');
      if (!printWindow) throw new Error('Allow pop-ups to print worker cards.');
      printWindow.document.write(buildWorkerCardBatchPrintHtml({ branding, cards: assets }));
      printWindow.document.close();
      await markWorkerCardsPrinted(token, cards.map(card => card.id));
      setSelected(new Set());
      await load();
      toast({ title: `${cards.length} worker card${cards.length === 1 ? '' : 's'} sent to print` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Batch print failed',
        description: error.message ?? 'The selected worker cards could not be printed.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>Loading…</p>;
  if (!isAuthorized) return <UnauthorizedComponent />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Worker Card Production</h1>
        <p className="text-muted-foreground">
          Search, select, and batch-print branded CR80 worker identity cards.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Production queue</CardTitle>
          <CardDescription>
            Cards prove worker identity only. Identity verification does not authorize entry; each site applies its own
            approval, security, compliance, or open-area operating model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={event => {
              event.preventDefault();
              setPage(1);
              void load();
            }}
          >
            <Input
              className="max-w-sm"
              aria-label="Search card production queue"
              placeholder="Worker name, ID, or card number"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <Button type="submit" variant="outline"><Search className="mr-2 h-4 w-4" /> Search</Button>
            <Button type="button" disabled={busy || selected.size === 0} onClick={() => void batchPrint()}>
              <Printer className="mr-2 h-4 w-4" /> Batch print selected ({selected.size})
            </Button>
          </form>

          {result.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active worker cards match this queue.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {result.items.map(card => (
                <li key={card.id} className="flex items-center gap-3 p-3">
                  <Checkbox
                    aria-label={`Select ${card.cardNumber}`}
                    checked={selected.has(card.id)}
                    disabled={busy}
                    onCheckedChange={checked => toggle(card.id, checked === true)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{card.workerName} · {card.workerCode}</p>
                    <p className="text-xs text-muted-foreground">{card.employerName} · {card.cardNumber}</p>
                  </div>
                  <Badge variant={card.status === 'Printed' ? 'secondary' : 'default'}>{card.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <PaginationControls
            noun="worker cards"
            page={result.page}
            totalPages={result.totalPages}
            hasPreviousPage={result.hasPreviousPage}
            hasNextPage={result.hasNextPage}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
