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
  type WorkerDocument,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DOC_TYPES = [
  { value: 'IdDocument', label: 'ID document' },
  { value: 'Certificate', label: 'Certificate' },
  { value: 'TrainingRecord', label: 'Training record' },
  { value: 'MedicalFitness', label: 'Medical fitness' },
  { value: 'CompetencyEvidence', label: 'Competency evidence' },
  { value: 'Other', label: 'Other' },
];

export function WorkerDocuments({ workerId, canManage = true }: { workerId: string; canManage?: boolean }) {
  const { token } = useSession();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<WorkerDocument[]>([]);
  const [docType, setDocType] = useState('Certificate');
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    try {
      await uploadWorkerDocument(token, workerId, file, docType);
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
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }}
            />
            <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
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
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => token && downloadWorkerDocument(token, doc.id, doc.fileName)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => void handleDelete(doc)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
