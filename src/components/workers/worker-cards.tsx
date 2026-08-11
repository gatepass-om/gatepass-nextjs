'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CreditCard, Printer, RefreshCw, ShieldX } from 'lucide-react';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import {
  getWorkerCardBranding,
  getWorkerDocumentDataUrl,
  issueWorkerCard,
  listWorkerCards,
  listWorkerDocuments,
  markWorkerCardPrinted,
  replaceWorkerCard,
  revokeWorkerCard,
  type WorkerCard,
  type WorkerCardBranding,
  type WorkerDocument,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildWorkerCardPrintHtml } from './worker-card-print';

const defaultBranding: WorkerCardBranding = {
  companyName: 'GATEPASS',
  cardLabel: 'WORKER ID · QR VERIFIED',
  primaryColor: '#075985',
  secondaryColor: '#EDF6FB',
  footerText: 'Live status must be verified when scanned',
};

export function WorkerCards({ workerId }: { workerId: string }) {
  const { token } = useSession();
  const { toast } = useToast();
  const [cards, setCards] = useState<WorkerCard[]>([]);
  const [photos, setPhotos] = useState<WorkerDocument[]>([]);
  const [photoDocumentId, setPhotoDocumentId] = useState('');
  const [photoCropX, setPhotoCropX] = useState(0.5);
  const [photoCropY, setPhotoCropY] = useState(0.5);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [branding, setBranding] = useState<WorkerCardBranding>(defaultBranding);
  const [previewHtml, setPreviewHtml] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [cardRows, documents, cardBranding] = await Promise.all([
      listWorkerCards(token, workerId),
      listWorkerDocuments(token, workerId),
      getWorkerCardBranding(token),
    ]);
    setCards(cardRows);
    setBranding(cardBranding);
    const validCard = cardRows.find(card => card.isValid);
    if (validCard) {
      setPhotoCropX(validCard.photoCropX);
      setPhotoCropY(validCard.photoCropY);
      setPhotoZoom(validCard.photoZoom);
    }
    const verifiedPhotos = documents.filter(document =>
      document.documentType === 'Photo'
      && document.reviewStatus === 'Verified'
      && document.contentType.startsWith('image/'));
    setPhotos(verifiedPhotos);
    setPhotoDocumentId(current =>
      verifiedPhotos.some(photo => photo.id === current) ? current : verifiedPhotos[0]?.id ?? '');
  }, [token, workerId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const activeCard = cards.find(card => card.isValid);

  const mutate = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await operation();
      await load();
      toast({ title: success });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Card operation failed',
        description: error.message ?? 'The worker card could not be updated.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleIssue = () => mutate(
    () => issueWorkerCard(token!, workerId, {
      photoDocumentId: photoDocumentId || undefined,
      photoCropX,
      photoCropY,
      photoZoom,
    }),
    'Worker card issued',
  );

  const handleReplace = (card: WorkerCard) => mutate(
    () => replaceWorkerCard(token!, card.id, {
      photoDocumentId: photoDocumentId || card.photoDocumentId || undefined,
      photoCropX,
      photoCropY,
      photoZoom,
    }),
    'Worker card replaced',
  );

  const handleRevoke = (card: WorkerCard) => {
    const reason = window.prompt('Reason for revoking this card:')?.trim();
    if (!reason) return;
    void mutate(() => revokeWorkerCard(token!, card.id, reason), 'Worker card revoked');
  };

  const renderCard = async (card: WorkerCard, autoPrint: boolean) => {
    if (!token) return;
    const [qrDataUrl, photoDataUrl] = await Promise.all([
      QRCode.toDataURL(card.credential, { width: 480, margin: 1, errorCorrectionLevel: 'Q' }),
      card.photoDocumentId
        ? getWorkerDocumentDataUrl(token, card.photoDocumentId)
        : Promise.resolve<string | null>(null),
    ]);
    return buildWorkerCardPrintHtml({ card, branding, qrDataUrl, photoDataUrl, autoPrint });
  };

  const handlePreview = async (card: WorkerCard) => {
    setBusy(true);
    try {
      setPreviewHtml(await renderCard(card, false) ?? '');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Preview failed',
        description: error.message ?? 'The worker card preview could not be generated.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async (card: WorkerCard) => {
    if (!token) return;
    setBusy(true);
    try {
      const html = await renderCard(card, true);
      const printWindow = window.open('', '_blank', 'width=900,height=650');
      if (!printWindow) throw new Error('Allow pop-ups to print worker cards.');
      printWindow.document.write(html ?? '');
      printWindow.document.close();
      await markWorkerCardPrinted(token, card.id);
      await load();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Print failed',
        description: error.message ?? 'The worker card could not be printed.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Worker cards</CardTitle>
        <CardDescription>
          Issue CR80-size photo ID cards with revocable QR credentials. Printing works with standard card printers or Save as PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={photoDocumentId} onValueChange={setPhotoDocumentId}>
            <SelectTrigger className="w-[260px]" aria-label="Verified worker photo">
              <SelectValue placeholder="No verified photo available" />
            </SelectTrigger>
            <SelectContent>
              {photos.map(photo => <SelectItem key={photo.id} value={photo.id}>{photo.fileName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          {!activeCard && (
            <Button type="button" size="sm" disabled={busy || photos.length === 0} onClick={handleIssue}>
              Issue card
            </Button>
          )}
          {photos.length === 0 && (
            <p className="text-xs text-muted-foreground">Upload a Photo document and have it verified before issuing.</p>
          )}
        </div>
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-medium">
            Horizontal crop
            <input
              className="w-full"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={photoCropX}
              aria-label="Card photo horizontal crop"
              disabled={busy || photos.length === 0}
              onChange={event => setPhotoCropX(Number(event.target.value))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            Vertical crop
            <input
              className="w-full"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={photoCropY}
              aria-label="Card photo vertical crop"
              disabled={busy || photos.length === 0}
              onChange={event => setPhotoCropY(Number(event.target.value))}
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            Zoom
            <input
              className="w-full"
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={photoZoom}
              aria-label="Card photo zoom"
              disabled={busy || photos.length === 0}
              onChange={event => setPhotoZoom(Number(event.target.value))}
            />
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !activeCard}
          onClick={() => activeCard && void handlePreview(activeCard)}
        >
          Preview active card
        </Button>

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cards have been issued.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {cards.map(card => (
              <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{card.cardNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Issued {new Date(card.issuedAtUtc).toLocaleDateString()}
                    {card.expiresAtUtc ? ` · expires ${new Date(card.expiresAtUtc).toLocaleDateString()}` : ''}
                  </p>
                  <Badge variant={card.isValid ? 'default' : 'secondary'}>{card.status}</Badge>
                  {card.revocationReason && <p className="mt-1 text-xs text-destructive">{card.revocationReason}</p>}
                </div>
                {card.isValid && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void handlePrint(card)}>
                      <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void handleReplace(card)}>
                      Replace
                    </Button>
                    <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => handleRevoke(card)}>
                      <ShieldX className="mr-2 h-4 w-4" /> Revoke
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={previewHtml.length > 0} onOpenChange={(open) => !open && setPreviewHtml('')}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Worker card print preview</DialogTitle>
            <DialogDescription>CR80 output using the configured customer branding and saved crop.</DialogDescription>
          </DialogHeader>
          <iframe
            title="Worker card print preview"
            srcDoc={previewHtml}
            className="h-[360px] w-full rounded-md border bg-white"
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
