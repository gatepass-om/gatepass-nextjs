'use client'

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs, Query } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AccessRequest, Operator } from '@/lib/types';
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

    useEffect(() => {
        if (!firestore) return;
        setLoading(true);

        const operatorsQuery = collection(firestore, 'operators');
        const operatorsUnsub = onSnapshot(operatorsQuery, (operatorsSnap) => {
            const operatorMap = new Map(operatorsSnap.docs.map(doc => [doc.id, (doc.data() as Operator).name]));
            
            let requestsQuery: Query = collection(firestore, 'accessRequests');
            
            if (operatorId !== 'all') {
                requestsQuery = query(requestsQuery, where('operatorId', '==', operatorId));
            }
            if (siteId !== 'all') {
                requestsQuery = query(requestsQuery, where('siteId', '==', siteId));
            }
            
            const requestsUnsub = onSnapshot(requestsQuery, (requestsSnap) => {
                const requests = requestsSnap.docs.map(d => d.data() as AccessRequest);
                
                const personnelCounts = requests.reduce((acc, req) => {
                    const opName = operatorMap.get(req.operatorId) || 'Unknown Operator';
                    const workerCount = req.workerIds ? req.workerIds.length : 0;
                    acc[opName] = (acc[opName] || 0) + workerCount;
                    return acc;
                }, {} as Record<string, number>);

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
            });

            return () => requestsUnsub();
        });

        return () => operatorsUnsub();
    }, [firestore, siteId, operatorId]);

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
                <CardTitle>Personnel in Access Requests by Operator</CardTitle>
                <CardDescription>Total number of personnel included in access requests, grouped by operator.</CardDescription>
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
                        No access request data available for this filter.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
