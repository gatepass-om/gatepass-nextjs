
'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/qr-code';
import { WorkerBadge } from '@/components/worker-badge';
import { WorkerDocuments } from '@/components/workers/worker-documents';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, AlertTriangle, KeyRound, RefreshCw, Clock } from 'lucide-react';
import { format, isBefore, parseISO, differenceInSeconds } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useSession } from '@/providers/session-provider';
import { fetchQrCredential } from '@/lib/api';

const QR_REFRESH_BUFFER_SECONDS = 60; // refresh 60s before expiry

function useTimeBoundQr(authToken: string | null) {
    const [qrToken, setQrToken] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refresh = useCallback(async () => {
        if (!authToken) return;
        setLoading(true);
        setError(null);
        try {
            const resp = await fetchQrCredential(authToken);
            setQrToken(resp.token);
            const exp = new Date(resp.expiresAt);
            setExpiresAt(exp);

            // Schedule next refresh
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            const msUntilRefresh = Math.max(0, (resp.expiresInSeconds - QR_REFRESH_BUFFER_SECONDS) * 1000);
            refreshTimerRef.current = setTimeout(refresh, msUntilRefresh);
        } catch {
            setError('Failed to fetch QR credential. Tap refresh to try again.');
        } finally {
            setLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        if (authToken) refresh();
        return () => {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [authToken, refresh]);

    // Countdown ticker
    useEffect(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (!expiresAt) return;
        countdownRef.current = setInterval(() => {
            const s = differenceInSeconds(expiresAt, new Date());
            setSecondsLeft(Math.max(0, s));
        }, 1000);
        return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }, [expiresAt]);

    return { qrToken, secondsLeft, loading, error, refresh };
}


function ProfileSkeleton() {
    return (
         <div className="space-y-4 md:space-y-6">
            <header>
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </header>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 flex flex-col items-center justify-center p-6 md:p-8 text-center">
                    <Skeleton className="h-24 w-24 rounded-full mb-4" />
                    <Skeleton className="h-7 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-6 w-16 mt-4 rounded-full" />
                </Card>
                 <Card className="md:col-span-2">
                    <CardHeader>
                         <Skeleton className="h-7 w-1/2" />
                         <Skeleton className="h-4 w-full mt-2" />
                    </CardHeader>
                    <CardContent className="flex items-center justify-center p-4 sm:p-8">
                        <Skeleton className="w-48 h-48 sm:w-64 sm:h-64" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { user: sessionUser, token, loading: sessionLoading } = useSession();
    const router = useRouter();
    const { qrToken, secondsLeft, loading: qrLoading, error: qrError, refresh: refreshQr } = useTimeBoundQr(token);

    useEffect(() => {
        if (sessionLoading) return;
        setUser(sessionUser ?? null);
        setLoading(false);
    }, [sessionUser, sessionLoading]);

    const isCertificateExpired = (expiryDate?: string) => {
        if (!expiryDate) return false;
        return isBefore(parseISO(expiryDate), new Date());
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const formatCountdown = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    if (loading) return <ProfileSkeleton />;

    if (!user) {
        return (
             <div className="space-y-4 md:space-y-6">
                <header>
                    <h1 className="text-3xl font-bold tracking-tight">My Profile & QR Code</h1>
                    <p className="text-muted-foreground">Present this QR code at any gate for scanning.</p>
                </header>
                <Card>
                    <CardContent className="p-8 text-center">
                        <p>User profile not found.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">My Profile & QR Code</h1>
            <p className="text-muted-foreground">Present this QR code at any gate for scanning.</p>
        </div>
        <Button onClick={() => router.push('/activate-account')}>
            <KeyRound className="mr-2 h-4 w-4"/>
            Change Password
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 flex flex-col items-center justify-center p-6 md:p-8 text-center">
            <div className="h-24 w-24 mb-4 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-4xl">
              {getInitials(user.name)}
            </div>
            <h2 className="text-2xl font-semibold">{user.name}</h2>
            <p className="text-muted-foreground">{user.email || 'No email set'}</p>
            <Badge className="mt-4" variant="default">{user.role}</Badge>
        </Card>

        <Card className="md:col-span-2">
            <CardHeader>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <CardTitle>Your Access QR Code</CardTitle>
                        <CardDescription>
                            Time-limited credential — valid for 15 minutes. Auto-refreshes before expiry.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <WorkerBadge
                            name={user.name}
                            subtitle={user.role}
                            workerCode={user.idNumber ?? null}
                            qrToken={qrToken}
                        />
                        <Button variant="ghost" size="sm" onClick={refreshQr} disabled={qrLoading}>
                            <RefreshCw className={`h-4 w-4 ${qrLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 p-4 sm:p-8">
                {qrError ? (
                    <div className="text-destructive text-sm text-center">{qrError}</div>
                ) : qrLoading && !qrToken ? (
                    <Skeleton className="w-48 h-48 sm:w-64 sm:h-64" />
                ) : qrToken ? (
                    <>
                        <div className="w-48 h-48 sm:w-64 sm:h-64 p-4 border rounded-lg bg-white">
                            <QrCode value={qrToken} />
                        </div>
                        <div className={`flex items-center gap-1.5 text-sm font-medium ${secondsLeft < 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <Clock className="h-4 w-4" />
                            {secondsLeft > 0
                                ? `Expires in ${formatCountdown(secondsLeft)}`
                                : 'Expired — refreshing…'}
                        </div>
                    </>
                ) : null}
            </CardContent>
        </Card>
      </div>

       <WorkerDocuments workerId={user.id} canManage={user.role !== 'Worker'} />

       {user.certificates && user.certificates.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle>My Certificates</CardTitle>
                <CardDescription>These are the certificate records associated with your profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {user.certificates.map((cert, index) => {
                    const isExpired = isCertificateExpired(cert.expiryDate);
                    return (
                        <Card key={index} className="flex flex-col">
                            <CardHeader className="flex-row items-start gap-3 space-y-0">
                                <ShieldCheck className="h-6 w-6 text-primary mt-1" />
                                <div className="flex-1">
                                    <CardTitle className="text-lg">{cert.name}</CardTitle>
                                    {cert.expiryDate ? (
                                        <CardDescription className={isExpired ? "text-destructive font-semibold" : ""}>
                                            Expires: {format(parseISO(cert.expiryDate), 'PPP')}
                                        </CardDescription>
                                    ) : (
                                        <CardDescription>No expiry date</CardDescription>
                                    )}
                                </div>
                                 {isExpired && <AlertTriangle className="h-5 w-5 text-destructive" />}
                            </CardHeader>
                        </Card>
                    );
                })}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
