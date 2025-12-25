
'use client'

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs, Query } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, GateActivity, Operator, Contractor } from '@/lib/types';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import * as RechartsPrimitive from 'recharts';
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
                    activityQuery = null; // No sites match, so no activity
                }
            }

            if (!activityQuery) {
                setChartData([]);
                setLoading(false);
                return;
            }

            // Listen to activity, users, and operators
            unsubs.push(onSnapshot(activityQuery, (activitySnap) => {
                unsubs.push(onSnapshot(collection(firestore, 'users'), (usersSnap) => {
                    unsubs.push(onSnapshot(collection(firestore, 'operators'), (operatorsSnap) => {
                        unsubs.push(onSnapshot(collection(firestore, 'contractors'), (contractorsSnap) => {
                        
                            const activities = activitySnap.docs.map(d => d.data() as GateActivity);
                            const users = usersSnap.docs.map(d => ({...d.data(), id: d.id}) as User);
                            const operators = operatorsSnap.docs.map(d => ({...d.data(), id: d.id}) as Operator);
                            const contractors = contractorsSnap.docs.map(d => ({...d.data(), id: d.id}) as Contractor);
                            
                            const userMap = new Map(users.map(u => [u.id, u]));

                            const latestActivity: Record<string, GateActivity> = {};
                            activities.forEach(activity => {
                                const timestamp = typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp.toDate();
                                if (!latestActivity[activity.userId] || timestamp > (typeof latestActivity[activity.userId].timestamp === 'string' ? new Date(latestActivity[activity.userId].timestamp) : latestActivity[activity.userId].timestamp.toDate())) {
                                    latestActivity[activity.userId] = activity;
                                }
                            });

                            const onSiteUsers: User[] = [];
                            Object.values(latestActivity).forEach(activity => {
                                if (activity.type === 'Check-in') {
                                    const user = userMap.get(activity.userId);
                                    if (user) onSiteUsers.push(user);
                                }
                            });
                            
                            let companyCounts: Record<string, number>;

                            if (operatorId !== 'all') { // A specific operator is selected, group by contractor
                                companyCounts = onSiteUsers
                                    .filter(user => user.operatorId === operatorId)
                                    .reduce((acc, user) => {
                                        const contractorName = contractors.find(c => c.id === user.contractorId)?.name || user.company || 'Direct Hire';
                                        acc[contractorName] = (acc[contractorName] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>);
                            } else { // No operator selected (or "All"), group by operator
                                const operatorMap = new Map(operators.map(o => [o.id, o.name]));
                                companyCounts = onSiteUsers.reduce((acc, user) => {
                                    const opName = user.operatorId ? (operatorMap.get(user.operatorId) || 'Unknown Operator') : 'Unknown Operator';
                                    acc[opName] = (acc[opName] || 0) + 1;
                                    return acc;
                                }, {} as Record<string, number>);
                            }


                            const finalChartData = Object.entries(companyCounts)
                                .map(([name, count]) => ({ name, count }))
                                .sort((a, b) => b.count - a.count);

                            // Generate chart config
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
                <CardContent className="h-[200px]">
                    <Skeleton className="h-full w-full" />
                </CardContent>
            </Card>
        );
    }
  
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>On-Site by Company</CardTitle>
                <CardDescription>
                    {operatorId === 'all'
                      ? 'Breakdown of on-site personnel by operator.'
                      : 'Breakdown of on-site personnel by contractor.'
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {chartData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">
                        <BarChart layout="vertical" data={chartData} margin={{ left: 10, right: 30 }}>
                            <CartesianGrid horizontal={false} />
                            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={100} />
                            <XAxis type="number" hide />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="count" radius={4}>
                                {chartData.map((entry) => (
                                    <Cell key={`cell-${entry.name}`} fill={chartConfig[entry.name]?.color} />
                                ))}
                                {chartData.map((entry, index) => (
                                    <RechartsPrimitive.Label
                                        key={`label-${index}`}
                                        position="right"
                                        offset={10}
                                        content={({ x, y, width, height, value }) => 
                                            <text x={x! + width!} y={y! + height!/2} dy={4} className="fill-foreground text-sm font-medium">{value}</text>
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
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
