
'use client'

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs, Query } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, GateActivity, Operator, Contractor } from '@/lib/types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
    const [title, setTitle] = useState("On-Site by Operator");
    const [description, setDescription] = useState("Breakdown of on-site personnel by operator.");

    useEffect(() => {
        if (!firestore || !firestoreUser) return;
        setLoading(true);

        const unsubs: (() => void)[] = [];

        const setupListeners = async () => {
            let activityQuery: Query | null = collection(firestore, 'gateActivity');

            // Determine sites to filter activity by
            let applicableSiteIds: string[] = [];
            if (siteId !== 'all') {
                applicableSiteIds = [siteId];
            } else if (operatorId !== 'all') {
                const sitesQuery = query(collection(firestore, 'sites'), where('operatorId', '==', operatorId));
                const siteSnap = await getDocs(sitesQuery);
                applicableSiteIds = siteSnap.docs.map(d => d.id);
            } else { // All operators, all sites (respecting user role)
                 if (firestoreUser.role === 'Manager') {
                    const sitesQuery = query(collection(firestore, 'sites'), where('managerIds', 'array-contains', firestoreUser.id));
                    const siteSnap = await getDocs(sitesQuery);
                    applicableSiteIds = siteSnap.docs.map(d => d.id);
                } else if (firestoreUser.role === 'Operator Admin') {
                    const sitesQuery = query(collection(firestore, 'sites'), where('operatorId', '==', firestoreUser.operatorId));
                    const siteSnap = await getDocs(sitesQuery);
                    applicableSiteIds = siteSnap.docs.map(d => d.id);
                }
            }

            if (applicableSiteIds.length > 0) {
                 activityQuery = query(activityQuery, where('siteId', 'in', applicableSiteIds));
            } else if (siteId !== 'all' || operatorId !== 'all' ) {
                activityQuery = null; // No sites match filter, so no activity
            }
           
            if (!activityQuery) {
                setChartData([]);
                setLoading(false);
                return;
            }

            unsubs.push(onSnapshot(activityQuery, (activitySnap) => {
                const activities = activitySnap.docs.map(d => d.data() as GateActivity);

                // Get latest activity for each user
                const latestActivity: Record<string, GateActivity> = {};
                activities.forEach(activity => {
                    const timestamp = typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp.toDate();
                    if (!latestActivity[activity.userId] || timestamp > (typeof latestActivity[activity.userId].timestamp === 'string' ? new Date(latestActivity[activity.userId].timestamp) : latestActivity[activity.userId].timestamp.toDate())) {
                        latestActivity[activity.userId] = activity;
                    }
                });
                
                const onSiteUserIds = Object.values(latestActivity)
                    .filter(act => act.type === 'Check-in')
                    .map(act => act.userId);

                if (onSiteUserIds.length === 0) {
                    setChartData([]);
                    setLoading(false);
                    return;
                }

                // Fetch all users, operators, contractors
                const usersQuery = query(collection(firestore, 'users'), where('__name__', 'in', onSiteUserIds));
                unsubs.push(onSnapshot(usersQuery, (usersSnap) => {
                unsubs.push(onSnapshot(collection(firestore, 'operators'), (operatorsSnap) => {
                unsubs.push(onSnapshot(collection(firestore, 'contractors'), (contractorsSnap) => {
                    const onSiteUsers = usersSnap.docs.map(d => d.data() as User);
                    const operators = operatorsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Operator);
                    const contractors = contractorsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Contractor);

                    let personnelCounts: Record<string, number>;
                    
                    if (operatorId === 'all') {
                        setTitle("On-Site by Operator");
                        setDescription("Breakdown of on-site personnel by operator.");
                        const operatorMap = new Map(operators.map(o => [o.id, o.name]));
                        personnelCounts = onSiteUsers.reduce((acc, user) => {
                            const opName = user.operatorId ? operatorMap.get(user.operatorId) || 'Unknown Operator' : 'Contractor/Other';
                            acc[opName] = (acc[opName] || 0) + 1;
                            return acc;
                        }, {} as Record<string, number>);

                    } else { // A specific operator is selected
                        setTitle("On-Site by Contractor");
                        setDescription("Breakdown of on-site contractors for the selected operator.");
                        const contractorMap = new Map(contractors.map(c => [c.id, c.name]));
                        personnelCounts = onSiteUsers.reduce((acc, user) => {
                            // This chart should only show contractors for the selected operator
                            const contractorName = user.contractorId ? contractorMap.get(user.contractorId) || user.company || 'Direct Hire' : 'Direct Hire';
                            acc[contractorName] = (acc[contractorName] || 0) + 1;
                            return acc;
                        }, {} as Record<string, number>);
                    }

                    const finalChartData = Object.entries(personnelCounts)
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
                }));
                }));
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
                <CardContent className="h-[200px] flex justify-center items-center">
                    <Skeleton className="h-40 w-40 rounded-full" />
                </CardContent>
            </Card>
        );
    }
  
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
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
                        No on-site personnel data available for this filter.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

    

    