
'use client'

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs, Query } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, GateActivity } from '@/lib/types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { serverFetchWorkerData } from '@/app/actions/workerActions';

interface ChartProps {
  className?: string;
  operatorId: string;
  siteId: string;
}

export function OnSiteByNationalityChart({ className, operatorId, siteId }: ChartProps) {
    const { firestoreUser, loading: authLoading } = useAuthProtection(['Admin', 'Operator Admin', 'Manager']);
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<any[]>([]);
    const [chartConfig, setChartConfig] = useState<ChartConfig>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !firestoreUser) return;
        setLoading(true);

        const unsubs: (() => void)[] = [];

        const setupListeners = async () => {
            let activityQuery: Query | null = collection(firestore, 'gateActivity');
            let sitesQuery: Query | null = null;
            
            if (siteId !== 'all') {
                sitesQuery = query(collection(firestore, 'sites'), where('__name__', '==', siteId));
            } else if (operatorId !== 'all') {
                sitesQuery = query(collection(firestore, 'sites'), where('operatorId', '==', operatorId));
            } else if (firestoreUser.role === 'Manager') {
                sitesQuery = query(collection(firestore, 'sites'), where('managerIds', 'array-contains', firestoreUser.id));
            } else if (firestoreUser.role === 'Operator Admin') {
                sitesQuery = query(collection(firestore, 'sites'), where('operatorId', '==', firestoreUser.operatorId));
            }

            if (sitesQuery) {
                const siteSnap = await getDocs(sitesQuery);
                const siteIds = siteSnap.docs.map(d => d.id);
                if (siteIds.length > 0) {
                    activityQuery = query(activityQuery, where('siteId', 'in', siteIds));
                } else {
                    activityQuery = null;
                }
            }

            if (!activityQuery) {
                setChartData([]);
                setLoading(false);
                return;
            }

            unsubs.push(onSnapshot(activityQuery, async (activitySnap) => {
                const usersSnap = await getDocs(collection(firestore, 'users'));
                
                const activities = activitySnap.docs.map(d => d.data() as GateActivity);
                const users = usersSnap.docs.map(d => ({...d.data(), id: d.id}) as User);
                
                const userMap = new Map(users.map(u => [u.id, u]));

                const latestActivity: Record<string, GateActivity> = {};
                activities.forEach(activity => {
                    const timestamp = typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp.toDate();
                    if (!latestActivity[activity.userId] || timestamp > (typeof latestActivity[activity.userId].timestamp === 'string' ? new Date(latestActivity[activity.userId].timestamp) : latestActivity[activity.userId].timestamp.toDate())) {
                        latestActivity[activity.userId] = activity;
                    }
                });

                const onSiteUserIds: string[] = [];
                Object.values(latestActivity).forEach(activity => {
                    if (activity.type === 'Check-in') {
                        onSiteUserIds.push(activity.userId);
                    }
                });

                // Fetch external data for on-site users
                const workerDataPromises = onSiteUserIds.map(userId => {
                    const user = userMap.get(userId);
                    if (user && user.idNumber) {
                        return serverFetchWorkerData({ workerId: user.idNumber });
                    }
                    return Promise.resolve(null);
                });

                const workersData = await Promise.all(workerDataPromises);

                const nationalityCounts = workersData.reduce((acc, worker) => {
                    if (worker) {
                        const nationality = worker.nationality || 'Unknown';
                        acc[nationality] = (acc[nationality] || 0) + 1;
                    }
                    return acc;
                }, {} as Record<string, number>);

                // Handle users on-site who might not be in the external DB
                const onSiteUsersNotInExternalDb = onSiteUserIds.filter(userId => {
                    const user = userMap.get(userId);
                    return !user?.idNumber;
                });
                
                if (onSiteUsersNotInExternalDb.length > 0) {
                    nationalityCounts['Unknown'] = (nationalityCounts['Unknown'] || 0) + onSiteUsersNotInExternalDb.length;
                }

                const finalChartData = Object.entries(nationalityCounts)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value);

                const newChartConfig: ChartConfig = {};
                const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
                finalChartData.forEach((item, index) => {
                    newChartConfig[item.name] = {
                        label: item.name,
                        color: colors[index % colors.length],
                    };
                });
                
                setChartConfig(newChartConfig);
                setChartData(finalChartData);
                setLoading(false);
            }));
        };

        setupListeners();
        return () => unsubs.forEach(unsub => unsub());
    }, [firestore, firestoreUser, siteId, operatorId]);

     if (authLoading || loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent className="flex justify-center items-center h-[200px]">
                    <Skeleton className="h-40 w-40 rounded-full" />
                </CardContent>
            </Card>
        );
    }
  
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>On-Site by Nationality</CardTitle>
                <CardDescription>
                    Nationality breakdown of all on-site personnel.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {chartData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">
                        <PieChart>
                             <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} strokeWidth={5}>
                                {chartData.map((entry) => (
                                    <Cell key={`cell-${entry.name}`} fill={chartConfig[entry.name]?.color} />
                                ))}
                            </Pie>
                             <ChartLegend
                                content={<ChartLegendContent nameKey="name" />}
                                className="-mt-4"
                            />
                        </PieChart>
                    </ChartContainer>
                ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        No on-site personnel data available.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
