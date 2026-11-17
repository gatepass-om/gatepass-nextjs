'use client';

import type { GeoRegion } from '@/lib/location-governance-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function LocationValidationPanel({
  geofences,
  selectedRegionId,
  latitude,
  longitude,
  validationResult,
  onRegionChange,
  onLatitudeChange,
  onLongitudeChange,
  onValidate,
}: {
  geofences: GeoRegion[];
  selectedRegionId: string;
  latitude: string;
  longitude: string;
  validationResult: string | null;
  onRegionChange: (value: string) => void;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onValidate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Point Validation</CardTitle>
        <CardDescription>Manual check for mobile-app point-of-action validation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Geofence</Label>
          <Select value={selectedRegionId} onValueChange={onRegionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select geofence" />
            </SelectTrigger>
            <SelectContent>
              {geofences.map((region) => (
                <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input value={latitude} onChange={(event) => onLatitudeChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input value={longitude} onChange={(event) => onLongitudeChange(event.target.value)} />
          </div>
        </div>
        <Button className="w-full" onClick={onValidate} disabled={!selectedRegionId}>
          Validate Point
        </Button>
        {validationResult && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Result: <span className="font-medium">{validationResult}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
