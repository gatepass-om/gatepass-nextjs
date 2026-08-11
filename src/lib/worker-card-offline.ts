import type { WorkerCardOfflineManifest } from './api';

const cacheKey = (siteId: string) => `gatepass.worker-card-manifest.v1.${siteId}`;

export async function hashWorkerCardCredential(credential: string) {
  const bytes = new TextEncoder().encode(credential.trim());
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyWorkerCardOffline(
  credential: string,
  manifest: WorkerCardOfflineManifest,
  now = new Date(),
) {
  const denied = { authorizationGranted: false as const };
  if (
    manifest.schemaVersion !== 1
    || manifest.purpose !== 'IdentityOnly'
    || manifest.authorizationRequiresOnline !== true
  ) {
    return { kind: 'manifest-invalid' as const, ...denied };
  }
  if (new Date(manifest.expiresAtUtc).getTime() <= now.getTime()) {
    return { kind: 'manifest-expired' as const, ...denied };
  }

  const credentialHash = await hashWorkerCardCredential(credential);
  const entry = manifest.entries.find(candidate => candidate.credentialHash === credentialHash);
  if (!entry) return { kind: 'identity-not-found' as const, ...denied };
  if (entry.expiresAtUtc && new Date(entry.expiresAtUtc).getTime() <= now.getTime()) {
    return { kind: 'card-expired' as const, entry, ...denied };
  }
  return { kind: 'identity-match' as const, entry, ...denied };
}

export function cacheWorkerCardOfflineManifest(manifest: WorkerCardOfflineManifest) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(cacheKey(manifest.site.id), JSON.stringify(manifest));
}

export function readWorkerCardOfflineManifest(siteId: string): WorkerCardOfflineManifest | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(cacheKey(siteId));
  if (!value) return null;
  try {
    const manifest = JSON.parse(value) as WorkerCardOfflineManifest;
    return manifest.schemaVersion === 1 ? manifest : null;
  } catch {
    return null;
  }
}
