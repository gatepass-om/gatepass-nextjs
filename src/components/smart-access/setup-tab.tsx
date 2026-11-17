'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Cloud,
  DoorOpen,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  RadioTower,
  Route,
  Save,
  ShieldCheck,
  Smartphone,
  Unplug,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Site } from '@/lib/types';
import {
  type AccessControlDevice,
  type AccessPolicyMapping,
  type TestSmartAccessProviderResult,
  type PhysicalAccessPoint,
  type SmartAccessProvider,
  createSmartAccessDevice,
  createSmartAccessPoint,
  createSmartAccessPolicyMapping,
  createSmartAccessProvider,
  testSmartAccessProvider,
} from '@/lib/smart-access-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { EmptyRow } from './common';

type ProviderProfileKey =
  | 'smartair'
  | 'cumulus'
  | 'assa-connected'
  | 'mobile-credential'
  | 'generic-connected'
  | 'generic-offline';

type SaveTarget = 'provider' | 'access-point' | 'device' | 'mapping' | 'test' | 'onboarding' | null;
type OnboardingStep = 'provider' | 'connection' | 'inventory' | 'finish';

type ProviderProfile = {
  key: ProviderProfileKey;
  name: string;
  shortName: string;
  description: string;
  integrationKey: string;
  providerKind: number;
  icon: LucideIcon;
  model: string;
  externalIdLabel: string;
  capabilities: {
    onlineProvisioning: boolean;
    remoteCommands: boolean;
    eventIngestion: boolean;
    statusPolling: boolean;
    offlineMobileSync: boolean;
  };
};

type SetupProps = {
  token: string | null;
  canConfigure: boolean;
  sites: Site[];
  providers: SmartAccessProvider[];
  accessPoints: PhysicalAccessPoint[];
  devices: AccessControlDevice[];
  mappings: AccessPolicyMapping[];
  onCreated: () => void;
  onError: (title: string, error: unknown) => void;
  onSuccess: (title: string, description: string) => void;
};

const PROVIDER_PROFILES: ProviderProfile[] = [
  {
    key: 'smartair',
    name: 'ASSA ABLOY SMARTair',
    shortName: 'SMARTair',
    description: 'SOAP platform integration for T1000 doors, mobile credentials, and event polling.',
    integrationKey: 'assa-abloy-smartair',
    providerKind: 2,
    icon: LockKeyhole,
    model: 'SMARTair',
    externalIdLabel: 'SMARTair door ID',
    capabilities: {
      onlineProvisioning: true,
      remoteCommands: true,
      eventIngestion: true,
      statusPolling: true,
      offlineMobileSync: true,
    },
  },
  {
    key: 'cumulus',
    name: 'ASSA ABLOY CUMULUS',
    shortName: 'CUMULUS',
    description: 'Keyless Administration and Integration API for mobile keys, devices, and webhooks.',
    integrationKey: 'assa-abloy-cumulus',
    providerKind: 2,
    icon: Cloud,
    model: 'CUMULUS',
    externalIdLabel: 'CUMULUS device ID',
    capabilities: {
      onlineProvisioning: true,
      remoteCommands: true,
      eventIngestion: true,
      statusPolling: true,
      offlineMobileSync: true,
    },
  },
  {
    key: 'assa-connected',
    name: 'ASSA ABLOY Connected',
    shortName: 'Connected',
    description: 'Connected access-control provider with remote command and status support.',
    integrationKey: 'assa-abloy-connected',
    providerKind: 2,
    icon: RadioTower,
    model: 'Connected Lock',
    externalIdLabel: 'Provider device ID',
    capabilities: {
      onlineProvisioning: true,
      remoteCommands: true,
      eventIngestion: true,
      statusPolling: true,
      offlineMobileSync: false,
    },
  },
  {
    key: 'mobile-credential',
    name: 'ASSA ABLOY Mobile Credential',
    shortName: 'Mobile',
    description: 'Mobile credential sync provider for offline or app-mediated lock access.',
    integrationKey: 'assa-abloy-mobile-credential',
    providerKind: 4,
    icon: Smartphone,
    model: 'Mobile Credential Lock',
    externalIdLabel: 'Mobile credential lock ID',
    capabilities: {
      onlineProvisioning: true,
      remoteCommands: false,
      eventIngestion: true,
      statusPolling: false,
      offlineMobileSync: true,
    },
  },
  {
    key: 'generic-connected',
    name: 'Generic Connected',
    shortName: 'Generic API',
    description: 'HTTP-backed provider for connected readers, controllers, or locks.',
    integrationKey: 'generic-connected',
    providerKind: 1,
    icon: Building2,
    model: 'Connected Device',
    externalIdLabel: 'External device ID',
    capabilities: {
      onlineProvisioning: true,
      remoteCommands: true,
      eventIngestion: true,
      statusPolling: true,
      offlineMobileSync: false,
    },
  },
  {
    key: 'generic-offline',
    name: 'Generic Offline Sync',
    shortName: 'Offline',
    description: 'Provider model for battery-free, mobile-sync, or manually synchronized locks.',
    integrationKey: 'generic-offline-sync',
    providerKind: 3,
    icon: Unplug,
    model: 'Offline Lock',
    externalIdLabel: 'Offline lock ID',
    capabilities: {
      onlineProvisioning: false,
      remoteCommands: false,
      eventIngestion: true,
      statusPolling: false,
      offlineMobileSync: true,
    },
  },
];

function firstId<T extends { id: string }>(items: T[]) {
  return items[0]?.id ?? '';
}

function requireJson(value: string) {
  if (!value.trim()) return '{}';
  JSON.parse(value);
  return value.trim();
}

function profileForIntegrationKey(integrationKey: string) {
  return PROVIDER_PROFILES.find((profile) => profile.integrationKey === integrationKey);
}

function sectionTitle(step: string, title: string, description: string, Icon: LucideIcon) {
  return (
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{step}</Badge>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  );
}

export function SmartAccessSetupTab({
  token,
  canConfigure,
  sites,
  providers,
  accessPoints,
  devices,
  mappings,
  onCreated,
  onError,
  onSuccess,
}: SetupProps) {
  const [saving, setSaving] = useState<SaveTarget>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('provider');
  const [selectedProfileKey, setSelectedProfileKey] = useState<ProviderProfileKey>('smartair');

  const selectedProfile = PROVIDER_PROFILES.find((profile) => profile.key === selectedProfileKey) ?? PROVIDER_PROFILES[0];
  const existingProviderForProfile = providers.find((provider) => provider.integrationKey === selectedProfile.integrationKey);

  const [providerName, setProviderName] = useState('');
  const [providerBaseUrl, setProviderBaseUrl] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [mobileAppType, setMobileAppType] = useState('MOBILE_APP_TYPE_BLE');
  const [alwaysAllowCode, setAlwaysAllowCode] = useState('15');
  const [noAccessCode, setNoAccessCode] = useState('0');
  const [createMissingUsers, setCreateMissingUsers] = useState(false);
  const [defaultUserGroup, setDefaultUserGroup] = useState('');
  const [defaultUserCarrier, setDefaultUserCarrier] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [integratorUserId, setIntegratorUserId] = useState('');
  const [integratorAccessKey, setIntegratorAccessKey] = useState('');
  const [systemId, setSystemId] = useState('');
  const [integrationBaseUrl, setIntegrationBaseUrl] = useState('');
  const [webhookCallbackUrl, setWebhookCallbackUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [provisionPath, setProvisionPath] = useState('');
  const [revokePath, setRevokePath] = useState('');
  const [commandPath, setCommandPath] = useState('');
  const [providerJsonOverride, setProviderJsonOverride] = useState('');
  const [connectionResult, setConnectionResult] = useState<TestSmartAccessProviderResult | null>(null);
  const [selectedDoorIds, setSelectedDoorIds] = useState<string[]>([]);
  const [importDiscoveredDoors, setImportDiscoveredDoors] = useState(true);
  const [createDefaultPolicy, setCreateDefaultPolicy] = useState(true);
  const [onboardingSiteId, setOnboardingSiteId] = useState('');

  const [accessPointSiteId, setAccessPointSiteId] = useState('');
  const [accessPointName, setAccessPointName] = useState('');
  const [accessPointExternalReference, setAccessPointExternalReference] = useState('');
  const [accessPointType, setAccessPointType] = useState('2');

  const [deviceProviderId, setDeviceProviderId] = useState('');
  const [deviceSiteId, setDeviceSiteId] = useState('');
  const [deviceAccessPointId, setDeviceAccessPointId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceKind, setDeviceKind] = useState('1');
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceSerialNumber, setDeviceSerialNumber] = useState('');
  const [deviceExternalId, setDeviceExternalId] = useState('');
  const [deviceSupportsCommands, setDeviceSupportsCommands] = useState(true);
  const [deviceSupportsPolling, setDeviceSupportsPolling] = useState(true);
  const [deviceSupportsOfflineSync, setDeviceSupportsOfflineSync] = useState(true);

  const [mappingSiteId, setMappingSiteId] = useState('');
  const [mappingProviderId, setMappingProviderId] = useState('');
  const [mappingAccessPointId, setMappingAccessPointId] = useState('');
  const [mappingName, setMappingName] = useState('Default smart access');
  const [mappingPriority, setMappingPriority] = useState('100');
  const [mappingManual, setMappingManual] = useState(false);
  const [mappingExclusive, setMappingExclusive] = useState(false);

  const defaultProviderName = providerName || selectedProfile.name;
  const configuredProfiles = useMemo(
    () => new Set(providers.map((provider) => provider.integrationKey)),
    [providers]
  );

  const providerConfigJson = useMemo(() => {
    if (providerJsonOverride.trim()) return providerJsonOverride;

    if (selectedProfile.key === 'smartair') {
      return JSON.stringify({
        simulationEnabled: false,
        operatorName,
        operatorPassword,
        smartairMobileAppType: mobileAppType,
        smartairAlwaysAllowTimetableCode: Number(alwaysAllowCode || 15),
        smartairNoAccessTimetableCode: Number(noAccessCode || 0),
        smartairCreateMissingUsers: createMissingUsers,
        smartairDefaultUserGroup: defaultUserGroup || undefined,
        smartairDefaultUserCarrier: defaultUserCarrier || undefined,
      });
    }

    if (selectedProfile.key === 'cumulus') {
      return JSON.stringify({
        simulationEnabled: false,
        apiKey,
        integratorUserId,
        integratorAccessKey,
        systemId: systemId || undefined,
        integrationBaseUrl: integrationBaseUrl || undefined,
        webhookCallbackUrl: webhookCallbackUrl || undefined,
      });
    }

    return JSON.stringify({
      simulationEnabled: false,
      provisionPath: provisionPath || undefined,
      revokePath: revokePath || undefined,
      commandPath: commandPath || undefined,
      webhook: webhookSecret
        ? {
            secret: webhookSecret,
            signatureHeaderName: 'X-GatePass-Signature',
          }
        : undefined,
    });
  }, [
    alwaysAllowCode,
    apiKey,
    commandPath,
    createMissingUsers,
    defaultUserCarrier,
    defaultUserGroup,
    integratorAccessKey,
    integratorUserId,
    integrationBaseUrl,
    mobileAppType,
    noAccessCode,
    operatorName,
    operatorPassword,
    providerJsonOverride,
    provisionPath,
    revokePath,
    selectedProfile.key,
    systemId,
    webhookCallbackUrl,
    webhookSecret,
  ]);

  const providerCandidates = useMemo(() => {
    const preferred = providers.find((provider) => provider.integrationKey === selectedProfile.integrationKey);
    return preferred ? [preferred, ...providers.filter((provider) => provider.id !== preferred.id)] : providers;
  }, [providers, selectedProfile.integrationKey]);

  const effectiveAccessPointSiteId = accessPointSiteId || firstId(sites);
  const effectiveDeviceProviderId = deviceProviderId || firstId(providerCandidates);
  const selectedDeviceProvider = providers.find((provider) => provider.id === effectiveDeviceProviderId);
  const selectedDeviceProfile = selectedDeviceProvider
    ? profileForIntegrationKey(selectedDeviceProvider.integrationKey) ?? selectedProfile
    : selectedProfile;
  const effectiveDeviceSiteId = deviceSiteId || effectiveAccessPointSiteId || firstId(sites);
  const visibleAccessPointsForDevice = accessPoints.filter((point) => !effectiveDeviceSiteId || point.siteId === effectiveDeviceSiteId);
  const effectiveDeviceAccessPointId = deviceAccessPointId || firstId(visibleAccessPointsForDevice);
  const effectiveMappingSiteId = mappingSiteId || effectiveDeviceSiteId || firstId(sites);
  const visibleAccessPointsForMapping = accessPoints.filter((point) => !effectiveMappingSiteId || point.siteId === effectiveMappingSiteId);
  const effectiveMappingProviderId = mappingProviderId || effectiveDeviceProviderId;
  const effectiveMappingAccessPointId = mappingAccessPointId || effectiveDeviceAccessPointId || firstId(visibleAccessPointsForMapping);
  const effectiveOnboardingSiteId = onboardingSiteId || firstId(sites);
  const discoveredDoors = connectionResult?.doors ?? [];
  const selectedDiscoveredDoors = discoveredDoors.filter((door) => selectedDoorIds.includes(door.externalId));
  const connectionReady = connectionResult?.minimalFunctionalityReady === true;
  const onboardingStepIndex = ['provider', 'connection', 'inventory', 'finish'].indexOf(onboardingStep);
  const onboardingProgress = ((onboardingStepIndex + 1) / 4) * 100;

  const setupProgress = [
    { label: 'Provider', complete: providers.length > 0 },
    { label: 'Location', complete: accessPoints.length > 0 },
    { label: 'Device', complete: devices.length > 0 },
    { label: 'Policy', complete: mappings.length > 0 },
  ];

  const ensureAllowed = () => {
    if (!token || !canConfigure) throw new Error('Admin access is required.');
  };

  const resetConnectionResult = () => {
    setConnectionResult(null);
    setSelectedDoorIds([]);
  };

  const selectProfile = (profile: ProviderProfile) => {
    setSelectedProfileKey(profile.key);
    setProviderName(profile.name);
    setOnboardingStep('provider');
    resetConnectionResult();
  };

  const handleTestProvider = async () => {
    setSaving('test');
    try {
      ensureAllowed();
      const result = await testSmartAccessProvider(token!, {
        integrationKey: selectedProfile.integrationKey,
        providerKind: selectedProfile.providerKind,
        baseUrl: providerBaseUrl.trim(),
        configurationJson: requireJson(providerConfigJson),
      });
      setConnectionResult(result);
      setSelectedDoorIds(result.doors.map((door) => door.externalId));
      if (result.minimalFunctionalityReady) {
        onSuccess('Connection Verified', result.message);
        setOnboardingStep('inventory');
      } else {
        onError('Connection Needs Attention', new Error(result.message));
      }
    } catch (error) {
      setConnectionResult(null);
      onError('Connection Test Failed', error);
    } finally {
      setSaving(null);
    }
  };

  const handleFinishOnboarding = async () => {
    setSaving('onboarding');
    try {
      ensureAllowed();
      const provider = existingProviderForProfile ?? await createSmartAccessProvider(token!, {
        name: defaultProviderName.trim(),
        integrationKey: selectedProfile.integrationKey,
        providerKind: selectedProfile.providerKind,
        supportsOnlineProvisioning: selectedProfile.capabilities.onlineProvisioning,
        supportsRemoteCommands: selectedProfile.capabilities.remoteCommands,
        supportsEventIngestion: selectedProfile.capabilities.eventIngestion,
        supportsStatusPolling: selectedProfile.capabilities.statusPolling,
        supportsOfflineMobileSync: selectedProfile.capabilities.offlineMobileSync,
        baseUrl: providerBaseUrl.trim() || null,
        configurationJson: requireJson(providerConfigJson),
      });

      let importedCount = 0;
      if (importDiscoveredDoors && effectiveOnboardingSiteId && selectedDiscoveredDoors.length > 0) {
        for (const door of selectedDiscoveredDoors) {
          const accessPoint = await createSmartAccessPoint(token!, {
            siteId: effectiveOnboardingSiteId,
            name: door.name.trim() || `SMARTair door ${door.externalId}`,
            accessPointType: 2,
            externalReference: door.externalId,
            supportsEntry: true,
            supportsExit: true,
          });

          await createSmartAccessDevice(token!, {
            smartAccessProviderId: provider.id,
            siteId: effectiveOnboardingSiteId,
            physicalAccessPointId: accessPoint.id,
            name: door.name.trim() || `SMARTair door ${door.externalId}`,
            deviceKind: 1,
            model: door.rawType || door.model || selectedProfile.model,
            serialNumber: `${selectedProfile.shortName}-${door.externalId}`,
            externalDeviceId: door.externalId,
            isBatteryFree: selectedProfile.key === 'generic-offline',
            supportsRemoteCommands: selectedProfile.capabilities.remoteCommands,
            supportsStatusPolling: selectedProfile.capabilities.statusPolling,
            supportsOfflineSync: selectedProfile.capabilities.offlineMobileSync,
          });
          importedCount += 1;
        }
      }

      if (createDefaultPolicy && effectiveOnboardingSiteId) {
        await createSmartAccessPolicyMapping(token!, {
          siteId: effectiveOnboardingSiteId,
          name: `${defaultProviderName.trim()} approved access`,
          description: 'Created from provider onboarding.',
          smartAccessProviderId: provider.id,
          appliesToWorkers: true,
          appliesToVisitors: false,
          isDefaultForApprovedRequests: true,
          requiresManualProvisioning: false,
          priority: 100,
          isExclusive: false,
        });
      }

      onSuccess(
        'Provider Onboarded',
        importedCount > 0
          ? `${provider.name} is configured with ${importedCount} imported door${importedCount === 1 ? '' : 's'}.`
          : `${provider.name} is configured.`
      );
      setOnboardingOpen(false);
      onCreated();
    } catch (error) {
      onError('Onboarding Failed', error);
    } finally {
      setSaving(null);
    }
  };

  const handleCreateProvider = async () => {
    setSaving('provider');
    try {
      ensureAllowed();
      await createSmartAccessProvider(token!, {
        name: defaultProviderName.trim(),
        integrationKey: selectedProfile.integrationKey,
        providerKind: selectedProfile.providerKind,
        supportsOnlineProvisioning: selectedProfile.capabilities.onlineProvisioning,
        supportsRemoteCommands: selectedProfile.capabilities.remoteCommands,
        supportsEventIngestion: selectedProfile.capabilities.eventIngestion,
        supportsStatusPolling: selectedProfile.capabilities.statusPolling,
        supportsOfflineMobileSync: selectedProfile.capabilities.offlineMobileSync,
        baseUrl: providerBaseUrl.trim() || null,
        configurationJson: requireJson(providerConfigJson),
      });
      onSuccess('Provider Created', `${defaultProviderName.trim()} is ready for device inventory.`);
      onCreated();
    } catch (error) {
      onError('Provider Creation Failed', error);
    } finally {
      setSaving(null);
    }
  };

  const handleCreateAccessPoint = async () => {
    setSaving('access-point');
    try {
      ensureAllowed();
      await createSmartAccessPoint(token!, {
        siteId: effectiveAccessPointSiteId,
        name: accessPointName.trim(),
        accessPointType: Number(accessPointType),
        externalReference: accessPointExternalReference.trim() || null,
        supportsEntry: true,
        supportsExit: true,
      });
      onSuccess('Access Point Created', `${accessPointName.trim()} can now be linked to a device.`);
      onCreated();
    } catch (error) {
      onError('Access Point Creation Failed', error);
    } finally {
      setSaving(null);
    }
  };

  const handleCreateDevice = async () => {
    setSaving('device');
    try {
      ensureAllowed();
      await createSmartAccessDevice(token!, {
        smartAccessProviderId: effectiveDeviceProviderId,
        siteId: effectiveDeviceSiteId,
        physicalAccessPointId: effectiveDeviceAccessPointId || null,
        name: deviceName.trim(),
        deviceKind: Number(deviceKind),
        model: (deviceModel || selectedDeviceProfile.model).trim(),
        serialNumber: deviceSerialNumber.trim(),
        externalDeviceId: deviceExternalId.trim(),
        isBatteryFree: selectedDeviceProfile.key === 'generic-offline',
        supportsRemoteCommands: deviceSupportsCommands,
        supportsStatusPolling: deviceSupportsPolling,
        supportsOfflineSync: deviceSupportsOfflineSync,
      });
      onSuccess('Device Created', `${deviceName.trim()} is now in Smart Access inventory.`);
      onCreated();
    } catch (error) {
      onError('Device Creation Failed', error);
    } finally {
      setSaving(null);
    }
  };

  const handleCreateMapping = async () => {
    setSaving('mapping');
    try {
      ensureAllowed();
      await createSmartAccessPolicyMapping(token!, {
        siteId: effectiveMappingSiteId,
        name: mappingName.trim(),
        description: 'Created from Smart Access setup.',
        smartAccessProviderId: effectiveMappingProviderId || null,
        physicalAccessPointId: effectiveMappingAccessPointId || null,
        appliesToWorkers: true,
        appliesToVisitors: false,
        isDefaultForApprovedRequests: true,
        requiresManualProvisioning: mappingManual,
        priority: Number(mappingPriority || 100),
        isExclusive: mappingExclusive,
      });
      onSuccess('Policy Mapping Created', `${mappingName.trim()} will provision approved workers.`);
      onCreated();
    } catch (error) {
      onError('Policy Mapping Failed', error);
    } finally {
      setSaving(null);
    }
  };

  if (!canConfigure) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
          <CardDescription>Provider and device configuration is available to Admin users.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Provider Onboarding</CardTitle>
              <CardDescription>Connection, provider record, door inventory, and policy setup.</CardDescription>
            </div>
            <Button onClick={() => setOnboardingOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New provider
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PROVIDER_PROFILES.map((profile) => {
                const Icon = profile.icon;
                const configured = configuredProfiles.has(profile.integrationKey);
                return (
                  <div key={profile.key} className="rounded-md border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{profile.shortName}</span>
                      </div>
                      {configured && <Badge variant="outline">Configured</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{profile.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Readiness</CardTitle>
            <CardDescription>Records required for automatic provisioning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupProgress.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm font-medium">{item.label}</span>
                {item.complete ? (
                  <Badge className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="secondary">Missing</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Providers</CardTitle>
          <CardDescription>Connections currently registered for this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Base URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.length === 0 ? <EmptyRow colSpan={3} label="No providers configured." /> : providers.map((provider) => {
                const profile = profileForIntegrationKey(provider.integrationKey);
                return (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell><Badge variant="outline">{profile?.shortName ?? provider.integrationKey}</Badge></TableCell>
                    <TableCell className="max-w-[360px] truncate text-muted-foreground">{provider.baseUrl ?? '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Smart Access Provider</DialogTitle>
            <DialogDescription>{selectedProfile.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Step {onboardingStepIndex + 1} of 4</span>
                <span className="text-muted-foreground">
                  {onboardingStep === 'provider' && 'Provider'}
                  {onboardingStep === 'connection' && 'Connection'}
                  {onboardingStep === 'inventory' && 'Inventory'}
                  {onboardingStep === 'finish' && 'Finish'}
                </span>
              </div>
              <Progress value={onboardingProgress} className="h-2" />
            </div>

            {onboardingStep === 'provider' && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {PROVIDER_PROFILES.map((profile) => {
                    const Icon = profile.icon;
                    const selected = selectedProfile.key === profile.key;
                    const configured = configuredProfiles.has(profile.integrationKey);
                    return (
                      <button
                        key={profile.key}
                        type="button"
                        onClick={() => selectProfile(profile)}
                        className={`rounded-md border p-4 text-left transition hover:border-primary/50 hover:bg-muted/40 ${
                          selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5 text-primary" />
                            <span className="font-semibold">{profile.shortName}</span>
                          </div>
                          {configured && <Badge variant="outline">Configured</Badge>}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{profile.description}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboarding-provider-name">Provider name</Label>
                  <Input id="onboarding-provider-name" value={defaultProviderName} onChange={(event) => setProviderName(event.target.value)} />
                </div>
                {existingProviderForProfile && (
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Already configured</AlertTitle>
                    <AlertDescription>{existingProviderForProfile.name} already uses this integration key.</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {onboardingStep === 'connection' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="provider-base-url">Base URL</Label>
                    <Input
                      id="provider-base-url"
                      value={providerBaseUrl}
                      onChange={(event) => {
                        setProviderBaseUrl(event.target.value);
                        resetConnectionResult();
                      }}
                      placeholder={selectedProfile.key === 'smartair' ? 'https://host:8181/TesaSmartairPlatform' : 'https://provider.example/api'}
                    />
                  </div>

                  {selectedProfile.key === 'smartair' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="smartair-operator">Operator name</Label>
                        <Input
                          id="smartair-operator"
                          value={operatorName}
                          onChange={(event) => {
                            setOperatorName(event.target.value);
                            resetConnectionResult();
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smartair-password">Operator password</Label>
                        <Input
                          id="smartair-password"
                          type="password"
                          value={operatorPassword}
                          onChange={(event) => {
                            setOperatorPassword(event.target.value);
                            resetConnectionResult();
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smartair-app-type">Mobile credential type</Label>
                        <Select value={mobileAppType} onValueChange={setMobileAppType}>
                          <SelectTrigger id="smartair-app-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MOBILE_APP_TYPE_BLE">BLE</SelectItem>
                            <SelectItem value="MOBILE_APP_TYPE_MOBILEAPP">Mobile app</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="smartair-allow">Allow timetable</Label>
                          <Input id="smartair-allow" value={alwaysAllowCode} onChange={(event) => setAlwaysAllowCode(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smartair-deny">Deny timetable</Label>
                          <Input id="smartair-deny" value={noAccessCode} onChange={(event) => setNoAccessCode(event.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  {selectedProfile.key === 'cumulus' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="cumulus-api-key">API key</Label>
                        <Input id="cumulus-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cumulus-integrator-user">Integrator user ID</Label>
                        <Input id="cumulus-integrator-user" value={integratorUserId} onChange={(event) => setIntegratorUserId(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cumulus-access-key">Integrator access key</Label>
                        <Input id="cumulus-access-key" type="password" value={integratorAccessKey} onChange={(event) => setIntegratorAccessKey(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cumulus-system-id">System ID</Label>
                        <Input id="cumulus-system-id" value={systemId} onChange={(event) => setSystemId(event.target.value)} />
                      </div>
                    </>
                  )}

                  {!['smartair', 'cumulus'].includes(selectedProfile.key) && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="generic-provision">Provision path</Label>
                        <Input id="generic-provision" value={provisionPath} onChange={(event) => setProvisionPath(event.target.value)} placeholder="/provision" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="generic-command">Command path</Label>
                        <Input id="generic-command" value={commandPath} onChange={(event) => setCommandPath(event.target.value)} placeholder="/commands" />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-json">Configuration JSON override</Label>
                  <Textarea
                    id="provider-json"
                    value={providerJsonOverride}
                    onChange={(event) => {
                      setProviderJsonOverride(event.target.value);
                      resetConnectionResult();
                    }}
                    placeholder={providerConfigJson}
                    className="min-h-20 font-mono text-xs"
                  />
                </div>

                <Button
                  onClick={() => void handleTestProvider()}
                  disabled={
                    saving !== null ||
                    !providerBaseUrl.trim() ||
                    (selectedProfile.key === 'smartair' && (!operatorName.trim() || !operatorPassword.trim())) ||
                    (selectedProfile.key === 'cumulus' && !apiKey.trim())
                  }
                >
                  {saving === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Test connection
                </Button>

                {connectionResult && (
                  <Alert variant={connectionReady ? 'default' : 'destructive'}>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>{connectionResult.status}</AlertTitle>
                    <AlertDescription>
                      <p>{connectionResult.message}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {connectionResult.checks.map((check) => <Badge key={check} variant="outline">{check}</Badge>)}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {onboardingStep === 'inventory' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <Select value={effectiveOnboardingSiteId || 'none'} onValueChange={(value) => setOnboardingSiteId(value === 'none' ? '' : value)}>
                      <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No site</SelectItem>
                        {sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3 rounded-md border p-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={importDiscoveredDoors} onCheckedChange={(checked) => setImportDiscoveredDoors(checked === true)} />
                      Import discovered doors
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={createDefaultPolicy} onCheckedChange={(checked) => setCreateDefaultPolicy(checked === true)} />
                      Create default policy
                    </label>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Door</TableHead>
                        <TableHead>External ID</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discoveredDoors.length === 0 ? <EmptyRow colSpan={4} label="No provider doors discovered." /> : discoveredDoors.map((door) => {
                        const checked = selectedDoorIds.includes(door.externalId);
                        return (
                          <TableRow key={door.externalId}>
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  setSelectedDoorIds((current) => value === true
                                    ? Array.from(new Set([...current, door.externalId]))
                                    : current.filter((id) => id !== door.externalId));
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{door.name}</TableCell>
                            <TableCell>{door.externalId}</TableCell>
                            <TableCell><Badge variant="outline">{door.rawType ?? door.model ?? selectedProfile.model}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {onboardingStep === 'finish' && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-muted-foreground">Provider</div>
                    <div className="font-semibold">{defaultProviderName}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-muted-foreground">Doors</div>
                    <div className="font-semibold">{importDiscoveredDoors ? selectedDiscoveredDoors.length : 0}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-muted-foreground">Policy</div>
                    <div className="font-semibold">{createDefaultPolicy ? 'Default' : 'Skipped'}</div>
                  </div>
                </div>
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Ready to create</AlertTitle>
                  <AlertDescription>{connectionResult?.message}</AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setOnboardingStep(onboardingStep === 'finish' ? 'inventory' : onboardingStep === 'inventory' ? 'connection' : 'provider')}
              disabled={saving !== null || onboardingStep === 'provider'}
            >
              Back
            </Button>
            {onboardingStep !== 'finish' ? (
              <Button
                onClick={() => setOnboardingStep(onboardingStep === 'provider' ? 'connection' : onboardingStep === 'connection' ? 'inventory' : 'finish')}
                disabled={
                  saving !== null ||
                  (onboardingStep === 'provider' && !defaultProviderName.trim()) ||
                  (onboardingStep === 'connection' && !connectionReady) ||
                  (onboardingStep === 'inventory' && importDiscoveredDoors && (!effectiveOnboardingSiteId || selectedDiscoveredDoors.length === 0))
                }
              >
                Continue
              </Button>
            ) : (
              <Button onClick={() => void handleFinishOnboarding()} disabled={saving !== null || !connectionReady}>
                {saving === 'onboarding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Create setup
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
