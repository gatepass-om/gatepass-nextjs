'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Pentagon, Circle as CircleIcon, Undo2, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { OpsMap, type OpsZone, type OpsMapDraft } from '@/components/maps/ops-map';
import {
  createGeoRegion,
  updateGeoRegion,
  type GeoRegion,
} from '@/lib/location-governance-api';

const GOVERNANCE_MODES = [
  { value: 'MonitorDuringWorkSession', label: 'Monitor during work session' },
  { value: 'ValidateAtAccessAction', label: 'Validate at access action' },
  { value: 'ValidateAtRequest', label: 'Validate at request' },
  { value: 'Disabled', label: 'Disabled' },
];

type SiteOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  region: GeoRegion | null;
  sites: SiteOption[];
  contextZones: OpsZone[];
  onSaved: () => void;
};

export function GeofenceDialog({ open, onOpenChange, token, region, sites, contextZones, onSaved }: Props) {
  const { toast } = useToast();
  const isEdit = Boolean(region);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [siteId, setSiteId] = useState('none');
  const [shape, setShape] = useState<'Circle' | 'Polygon'>('Circle');
  const [governanceMode, setGovernanceMode] = useState('MonitorDuringWorkSession');
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(300);
  const [isActive, setIsActive] = useState(true);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(1500);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (region) {
      setName(region.name);
      setDescription(region.description ?? '');
      setSiteId(region.siteId ?? 'none');
      setShape(region.shape === 'Polygon' ? 'Polygon' : 'Circle');
      setGovernanceMode(region.governanceMode || 'MonitorDuringWorkSession');
      setGracePeriodSeconds(region.gracePeriodSeconds ?? 300);
      setIsActive(region.isActive);
      setCenter(
        region.centerLatitude != null && region.centerLongitude != null
          ? [region.centerLatitude, region.centerLongitude]
          : null
      );
      setRadiusMeters(region.radiusMeters ?? 1500);
      setPoints((region.polygon ?? []).map((p) => [p.latitude, p.longitude] as [number, number]));
    } else {
      setName('');
      setDescription('');
      setSiteId('none');
      setShape('Circle');
      setGovernanceMode('MonitorDuringWorkSession');
      setGracePeriodSeconds(300);
      setIsActive(true);
      setCenter(null);
      setRadiusMeters(1500);
      setPoints([]);
    }
  }, [open, region]);

  const draft: OpsMapDraft = useMemo(() => {
    if (shape === 'Circle') return { kind: 'circle', center, radiusMeters };
    return { kind: 'polygon', points };
  }, [shape, center, radiusMeters, points]);

  const mapCenter: [number, number] = center ?? points[0] ?? [21, 57];

  const handleMapClick = (lat: number, lng: number) => {
    if (shape === 'Circle') {
      setCenter([Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
    } else {
      setPoints((prev) => [...prev, [Number(lat.toFixed(5)), Number(lng.toFixed(5))]]);
    }
  };

  const canSave =
    name.trim().length > 0 &&
    (shape === 'Circle' ? center != null && radiusMeters > 0 : points.length >= 3);

  const handleSave = async () => {
    if (!token || !canSave) return;
    setSaving(true);
    try {
      const base = {
        name: name.trim(),
        description: description.trim() || null,
        siteId: siteId === 'none' ? null : siteId,
        shape,
        governanceMode,
        gracePeriodSeconds,
      };
      const body =
        shape === 'Circle'
          ? {
              ...base,
              centerLatitude: center![0],
              centerLongitude: center![1],
              radiusMeters,
              polygon: [],
            }
          : {
              ...base,
              centerLatitude: null,
              centerLongitude: null,
              radiusMeters: null,
              polygon: points.map(([latitude, longitude]) => ({ latitude, longitude })),
            };

      if (isEdit && region) {
        await updateGeoRegion(token, region.id, { ...body, isActive } as Partial<GeoRegion>);
        toast({ title: 'Geofence updated', description: `${name} saved.` });
      } else {
        await createGeoRegion(token, body);
        toast({ title: 'Geofence created', description: `${name} added.` });
      }
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: error.message || 'Could not save geofence.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl gap-0 overflow-y-auto p-0 md:overflow-hidden">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {isEdit ? 'Edit geofence' : 'New geofence'}
          </DialogTitle>
          <DialogDescription>
            Define a monitored work region. Click the map to {shape === 'Circle' ? 'set the center' : 'add boundary points'}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:h-[560px] md:grid-cols-[1fr_1.1fr]">
          {/* form */}
          <div className="space-y-4 overflow-y-auto border-border p-6 md:border-r">
            <div className="space-y-1.5">
              <Label htmlFor="gf-name">Name</Label>
              <Input id="gf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marmul Work Zone" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gf-desc">Description</Label>
              <Textarea id="gf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional notes" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Shape</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button type="button" size="sm" variant={shape === 'Circle' ? 'default' : 'outline'} onClick={() => setShape('Circle')}>
                    <CircleIcon className="mr-1.5 h-3.5 w-3.5" /> Circle
                  </Button>
                  <Button type="button" size="sm" variant={shape === 'Polygon' ? 'default' : 'outline'} onClick={() => setShape('Polygon')}>
                    <Pentagon className="mr-1.5 h-3.5 w-3.5" /> Polygon
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gf-site">Site</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger id="gf-site"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No site (region-wide)</SelectItem>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Governance mode</Label>
              <Select value={governanceMode} onValueChange={setGovernanceMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOVERNANCE_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {shape === 'Circle' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Radius</Label>
                  <span className="text-sm font-medium tabular-nums text-foreground">{(radiusMeters / 1000).toFixed(2)} km</span>
                </div>
                <Slider value={[radiusMeters]} min={100} max={10000} step={50} onValueChange={(v) => setRadiusMeters(v[0])} />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Input value={center?.[0] ?? ''} onChange={(e) => setCenter([Number(e.target.value) || 0, center?.[1] ?? 0])} placeholder="Latitude" />
                  <Input value={center?.[1] ?? ''} onChange={(e) => setCenter([center?.[0] ?? 0, Number(e.target.value) || 0])} placeholder="Longitude" />
                </div>
                {!center && <p className="text-xs text-warning">Click the map to set the center point.</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Boundary points</Label>
                  <span className="text-sm font-medium tabular-nums text-foreground">{points.length} point{points.length === 1 ? '' : 's'}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length}>
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Undo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPoints([])} disabled={!points.length}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear
                  </Button>
                </div>
                {points.length < 3 && <p className="text-xs text-warning">Click the map to add at least 3 points.</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gf-grace">Grace period (s)</Label>
                <Input id="gf-grace" type="number" value={gracePeriodSeconds} onChange={(e) => setGracePeriodSeconds(Number(e.target.value) || 0)} />
              </div>
              {isEdit && (
                <div className="flex items-end justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <Label htmlFor="gf-active" className="cursor-pointer">Active</Label>
                  <Switch id="gf-active" checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}
            </div>
          </div>

          {/* map editor */}
          <div className="h-[400px] bg-card md:h-full">
            <OpsMap
              className="h-full w-full"
              zones={contextZones.filter((z) => z.id !== region?.id)}
              draft={draft}
              center={mapCenter}
              zoom={center || points.length ? 11 : 6}
              onMapClick={handleMapClick}
              fit={false}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={!canSave || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create geofence'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
