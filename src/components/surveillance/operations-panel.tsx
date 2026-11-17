'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, FileVideo, Loader2 } from 'lucide-react';
import type { Site } from '@/lib/types';
import type { SurveillanceCamera, SurveillanceProvider } from '@/lib/surveillance-api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type NewCameraInput = {
  surveillanceProviderId: string;
  siteId: string;
  name: string;
  cameraKind: string;
  model: string;
  serialNumber: string;
};

export function RegisterCameraDialog({
  providers,
  sites,
  canManage,
  busy,
  onCreateCamera,
}: {
  providers: SurveillanceProvider[];
  sites: Site[];
  canManage: boolean;
  busy: boolean;
  onCreateCamera: (input: NewCameraInput) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [kind, setKind] = useState('Fixed');
  const activeProviders = providers.filter((provider) => provider.isActive);

  useEffect(() => {
    if (!open) {
      setProviderId('');
      setSiteId('');
      setName('');
      setModel('');
      setSerial('');
      setKind('Fixed');
    }
  }, [open]);

  const canSubmit =
    canManage && !busy && Boolean(providerId) && Boolean(siteId) && name.trim() !== '' && model.trim() !== '' && serial.trim() !== '';

  const submitCamera = async () => {
    if (!providerId || !siteId || !name.trim() || !model.trim() || !serial.trim()) return;
    const ok = await onCreateCamera({
      surveillanceProviderId: providerId,
      siteId,
      name: name.trim(),
      cameraKind: kind,
      model: model.trim(),
      serialNumber: serial.trim(),
    });
    if (ok) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button disabled={!canManage} onClick={() => setOpen(true)}>
        <Camera className="mr-2 h-4 w-4" />
        Register camera
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Register camera
          </DialogTitle>
          <DialogDescription>Add a site-scoped camera or thermal monitoring device.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[75vh] gap-3 overflow-y-auto md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>{activeProviders.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger>
              <SelectContent>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camera-name">Name</Label>
            <Input id="camera-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camera-model">Model</Label>
            <Input id="camera-model" value={model} onChange={(event) => setModel(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camera-serial">Serial</Label>
            <Input id="camera-serial" value={serial} onChange={(event) => setSerial(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Fixed', 'Ptz', 'Thermal', 'MultiSensor', 'Other'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={() => void submitCamera()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {canManage ? 'Register camera' : 'Read only'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequestEvidenceDialog({
  cameras,
  busy,
  onRequestClip,
}: {
  cameras: SurveillanceCamera[];
  busy: boolean;
  onRequestClip: (cameraId: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [cameraId, setCameraId] = useState('');
  const clipCameras = useMemo(() => cameras.filter((camera) => camera.isActive), [cameras]);

  useEffect(() => {
    if (!open) setCameraId('');
  }, [open]);

  const submitClip = async () => {
    if (!cameraId) return;
    const ok = await onRequestClip(cameraId);
    if (ok) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileVideo className="mr-2 h-4 w-4" />
        Request evidence
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileVideo className="h-4 w-4 text-primary" />
            Request evidence
          </DialogTitle>
          <DialogDescription>Queue a ten-minute evidence window from the selected VMS camera.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Camera</Label>
          <Select value={cameraId} onValueChange={setCameraId}>
            <SelectTrigger><SelectValue placeholder="Camera" /></SelectTrigger>
            <SelectContent>{clipCameras.map((camera) => <SelectItem key={camera.id} value={camera.id}>{camera.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button disabled={!cameraId || busy} onClick={() => void submitClip()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request last 10 minutes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
