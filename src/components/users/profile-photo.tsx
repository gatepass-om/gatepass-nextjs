'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { getWorkerDocumentPreviewUrl, listWorkerDocuments, uploadWorkerDocument } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumPhotoBytes = 5 * 1024 * 1024;

export function WorkerProfilePhoto({
  workerId,
  name,
  fallbackUrl,
  canEdit,
}: {
  workerId: string;
  name: string;
  fallbackUrl?: string | null;
  canEdit: boolean;
}) {
  const { token } = useSession();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(fallbackUrl ?? null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const accessToken: string = token ?? '';
    if (!accessToken) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadPhoto() {
      try {
        const documents = await listWorkerDocuments(accessToken, workerId);
        const latestPhoto = documents
          .filter((document) => document.documentType === 'Photo')
          .sort((left, right) => right.uploadedAtUtc.localeCompare(left.uploadedAtUtc))[0];
        if (!latestPhoto) {
          if (!cancelled) setPreviewUrl(fallbackUrl ?? null);
          return;
        }

        objectUrl = await getWorkerDocumentPreviewUrl(accessToken, latestPhoto.id);
        if (!cancelled) setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setPreviewUrl(fallbackUrl ?? null);
      }
    }

    void loadPhoto();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fallbackUrl, refreshKey, token, workerId]);

  const uploadPhoto = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !token) return;
    if (!acceptedImageTypes.has(file.type)) {
      toast({ variant: 'destructive', title: 'Use a JPG, PNG, or WebP image.' });
      return;
    }
    if (file.size > maximumPhotoBytes) {
      toast({ variant: 'destructive', title: 'Profile pictures must be 5 MB or smaller.' });
      return;
    }

    setBusy(true);
    try {
      await uploadWorkerDocument(token, workerId, file, 'Photo');
      setRefreshKey((current) => current + 1);
      toast({ title: 'Profile picture updated' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Profile picture could not be updated',
        description: error.message ?? 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  }, [token, toast, workerId]);

  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
        <AvatarImage src={previewUrl ?? undefined} alt={`${name}'s profile picture`} className="object-cover" />
        <AvatarFallback className="text-3xl font-semibold">{initials}</AvatarFallback>
      </Avatar>
      {canEdit ? <>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void uploadPhoto(event)} />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {previewUrl ? 'Change picture' : 'Upload picture'}
        </Button>
      </> : null}
    </div>
  );
}
