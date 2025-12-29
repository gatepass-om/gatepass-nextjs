
'use client'

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs, Query } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateActivity, User, Operator, Contractor } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { useAuthProtection } from '@/hooks/use-auth-protection';

interface ChartProps {
  className?: string;
  operatorId: string;
  siteId: string;
}

export function OnSiteByCompanyChart({ className, operatorId, siteId }: ChartProps) {
    const { firestoreUser, loading: authLoading } = useAuthProtection(['Admin', 'Operator Admin', 'Manager']);
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<any[]>([]);
    const [chartConfig, setChartConfig] = useState<ChartConfig>({});
    const [loading, setLoading] = useState(true);

    const isDrillDownView = operatorId !== 'all';

    useEffect(() => {
        if (!firestore || !firestoreUser) return;
        setLoading(true);

        const unsubs: (() => void)[] = [];

        const setupListeners = async () => {
            let activityQuery: Query | null = collection(firestore, 'gateActivity');
            let sitesToFilter: string[] = [];

            // Determine which sites to query based on user role and filters
            if (siteId !== 'all') {
                sitesToFilter = [siteId];
            } else if (operatorId !== 'all') {
                const sitesSnap = await getDocs(query(collection(firestore, 'sites'), where('operatorId', '==', operatorId)));
                sitesToFilter = sitesSnap.docs.map(d => d.id);
            } else if (firestoreUser.role === 'Manager') {
                const sitesSnap = await getDocs(query(collection(firestore, 'sites'), where('managerIds', 'array-contains', firestoreUser.id)));
                sitesToFilter = sitesSnap.docs.map(d => d.id);
            } else if (firestoreUser.role === 'Operator Admin') {
                const sitesSnap = await getDocs(query(collection(firestore, 'sites'), where('operatorId', '==', firestoreUser.operatorId)));
                sitesToFilter = sitesSnap.docs.map(d => d.id);
            }
            
            // If we have specific sites to filter by (and it's not the admin 'all' view), apply the 'where' clause
            if (sitesToFilter.length > 0) {
                 activityQuery = query(activityQuery, where('siteId', 'in', sitesToFilter));
            } else if (siteId !== 'all' || operatorId !== 'all') {
                 // If filters are selected but result in no sites, there can be no activity
                 activityQuery = null;
            }

            if (!activityQuery) {
                setChartData([]);
                setLoading(false);
                return;
            }

            unsubs.push(onSnapshot(activityQuery, async (activitySnap) => {
                const [usersSnap, operatorsSnap, contractorsSnap] = await Promise.all([
                    getDocs(collection(firestore, 'users')),
                    getDocs(collection(firestore, 'operators')),
                    getDocs(collection(firestore, 'contractors'))
                ]);
                
                const activities = activitySnap.docs.map(d => d.data() as GateActivity);
                const userMap = new Map(usersSnap.docs.map(d => [d.id, {...d.data(), id: d.id} as User]));
                const operatorMap = new Map(operatorsSnap.docs.map(d => [d.id, d.data().name as string]));
                const contractorMap = new Map(contractorsSnap.docs.map(d => [d.id, d.data().name as string]));

                // Find the latest activity for each user
                const latestActivity: Record<string, GateActivity> = {};
                activities.forEach(activity => {
                    const timestamp = typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp.toDate();
                    if (!latestActivity[activity.userId] || timestamp > (typeof latestActivity[activity.userId].timestamp === 'string' ? new Date(latestActivity[activity.userId].timestamp) : latestActivity[activity.userId].timestamp.toDate())) {
                        latestActivity[activity.userId] = activity;
                    }
                });

                // Get on-site users
                const onSiteUserIds = Object.values(latestActivity)
                    .filter(activity => activity.type === 'Check-in')
                    .map(activity => activity.userId);

                // Group on-site users by company
                const companyCounts = onSiteUserIds.reduce((acc, userId) => {
                    const user = userMap.get(userId);
                    if (!user) return acc;
                    
                    let companyName: string;

                    if (isDrillDownView) {
                        // When an Operator is selected, group by Contractor
                        companyName = user.contractorId 
                            ? (contractorMap.get(user.contractorId) || 'Unknown Contractor') 
                            : 'Direct Hire';
                    } else {
                        // When "All Operators" is selected, group by Operator
                        companyName = user.operatorId
                            ? (operatorMap.get(user.operatorId) || 'Unknown Operator')
                            : 'Contractors / Other';
                    }
                    
                    acc[companyName] = (acc[companyName] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                const finalChartData = Object.entries(companyCounts)
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
    }, [firestore, firestoreUser, siteId, operatorId, isDrillDownView]);

     if (authLoading || loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent className="h-[200px] flex justify-center items-center">
                    <Skeleton className="h-40 w-40 rounded-full" />
                </CardContent>
            </Card>
        );
    }
  
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>
                    {isDrillDownView ? 'On-Site by Contractor' : 'On-Site by Operator'}
                </CardTitle>
                <CardDescription>
                    {isDrillDownView 
                        ? 'Breakdown of on-site contractors for the selected operator.'
                        : 'Breakdown of on-site personnel by parent operator company.'
                    }
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
                            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5} >
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
                        No on-site personnel data available for this filter.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

