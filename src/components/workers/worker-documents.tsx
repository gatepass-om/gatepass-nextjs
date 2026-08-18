'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileUp, Trash2, FileText } from 'lucide-react';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import {
  listWorkerDocuments,
  uploadWorkerDocument,
  downloadWorkerDocument,
  deleteWorkerDocument,
  reviewWorkerDocument,
  type WorkerDocument,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CertificateType } from '@/lib/types';

const DOC_TYPES = [
  { value: 'IdDocument', label: 'ID document' },
  { value: 'Certificate', label: 'Certificate' },
  { value: 'TrainingRecord', label: 'Training record' },
  { value: 'MedicalFitness', label: 'Medical fitness' },
  { value: 'CompetencyEvidence', label: 'Competency evidence' },
  { value: 'Photo', label: 'Worker card photo' },
  { value: 'Other', label: 'Other' },
];

export function WorkerDocuments({
  workerId,
  certificateTypes = [],
  canManage = true,
}: {
  workerId: string;
  certificateTypes?: CertificateType[];
  canManage?: boolean;
}) {
  const { token, user } = useSession();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<WorkerDocument[]>([]);
  const [docType, setDocType] = useState('Certificate');
  const [certificateTypeId, setCertificateTypeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setDocuments(await listWorkerDocuments(token, workerId));
    } catch {
      // best-effort
    }
  }, [token, workerId]);

  useEffect(() => { void load(); }, [load]);

  const handleUpload = async (file: File) => {
    if (!token) return;
    if (docType === 'Certificate' && !certificateTypeId) {
      toast({ variant: 'destructive', title: 'Certificate type required', description: 'Choose the certificate this evidence supports.' });
      return;
    }
    setBusy(true);
    try {
      await uploadWorkerDocument(token, workerId, file, docType, docType === 'Certificate' ? certificateTypeId : undefined);
      toast({ title: 'Document uploaded', description: file.name });
      await load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message ?? 'Could not upload the document.' });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: WorkerDocument) => {
    if (!token) return;
    try {
      await deleteWorkerDocument(token, doc.id);
      toast({ title: 'Document removed', description: doc.fileName });
      await load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: error.message ?? 'Could not remove the document.' });
    }
  };

  const canReview = user?.role === 'Admin'
    || user?.role === 'Operator Admin'
    || user?.role === 'Manager';

  const handleReview = async (doc: WorkerDocument, decision: 'Verified' | 'Rejected') => {
    if (!token) return;
    const note = reviewNotes[doc.id]?.trim();
    if (decision === 'Rejected' && !note) {
      toast({ variant: 'destructive', title: 'Reason required', description: 'Add a review note before rejecting evidence.' });
      return;
    }
    setBusy(true);
    try {
      const reviewed = await reviewWorkerDocument(token, doc.id, decision, note);
      setDocuments(current => current.map(item => item.id === reviewed.id ? reviewed : item));
      setReviewNotes(current => ({ ...current, [doc.id]: '' }));
      toast({ title: 'Document reviewed', description: `${doc.fileName} is ${reviewed.reviewStatus.toLowerCase()}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Review failed', description: error.message ?? 'Could not review the document.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Documents</CardTitle>
        <CardDescription>ID, certificates, training records and medical evidence backing this worker.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger aria-label="Document type" className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {docType === 'Certificate' && (
              <Select value={certificateTypeId} onValueChange={setCertificateTypeId}>
                <SelectTrigger aria-label="Certificate type for evidence" className="w-[240px]">
                  <SelectValue placeholder="Certificate type" />
                </SelectTrigger>
                <SelectContent>
                  {certificateTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={docType === 'Photo' ? 'image/jpeg,image/png,image/webp' : undefined}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }}
            />
            <Button type="button" variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" /> {busy ? 'Uploading…' : 'Upload document'}
            </Button>
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">{doc.documentType} · {(doc.sizeBytes / 1024).toFixed(0)} KB</p>
                  <Badge className="mt-1" variant={doc.reviewStatus === 'Verified' ? 'default' : doc.reviewStatus === 'Rejected' ? 'destructive' : 'secondary'}>
                    {doc.reviewStatus}
                  </Badge>
                  {doc.reviewNote && <p className="mt-1 text-xs text-muted-foreground">{doc.reviewNote}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {canReview && doc.reviewStatus === 'Pending' && (
                    <div className="flex max-w-sm flex-col items-end gap-2">
                      <Textarea
                        aria-label={`Review note for ${doc.fileName}`}
                        value={reviewNotes[doc.id] ?? ''}
                        onChange={event => setReviewNotes(current => ({ ...current, [doc.id]: event.target.value }))}
                        placeholder="Review note or rejection reason"
                        className="min-h-16"
                      />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={busy} onClick={() => void handleReview(doc, 'Verified')}>Verify</Button>
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void handleReview(doc, 'Rejected')}>Reject</Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => token && downloadWorkerDocument(token, doc.id, doc.fileName)}>
                    <Download className="h-4 w-4" />
                    <span className="sr-only">Download {doc.fileName}</span>
                  </Button>
                  {canManage && doc.reviewStatus === 'Pending' && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => void handleDelete(doc)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                      <span className="sr-only">Delete {doc.fileName}</span>
                    </Button>
                  )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
