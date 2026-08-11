
'use client'

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronsUpDown } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Site } from "@/lib/types";
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/providers/session-provider";


const formSchema = z.object({
  siteId: z.string({ required_error: "Please select a site." }),
  accessDate: z.date({
    required_error: "An access date is required.",
  }),
  reason: z.string().min(10, {
    message: "Reason must be at least 10 characters.",
  }).max(200, {
      message: "Reason must not be longer than 200 characters.",
  }),
});

interface NewRequestFormProps {
    currentUserId: string;
    onNewRequest: (request: {
        userId: string;
        userName: string;
        userAvatar: string;
        date: string;
        reason: string;
        siteId: string;
        siteName: string;
    }) => void;
    sites: Site[];
    isLoadingSites: boolean;
}

export function NewRequestForm({ currentUserId, onNewRequest, sites, isLoadingSites }: NewRequestFormProps) {
    const { toast } = useToast();
    const [userName, setUserName] = useState("User");
    const [userAvatar, setUserAvatar] = useState("");
    const { user } = useSession();

    useEffect(() => {
        if (!user || user.id !== currentUserId) return;
        setUserName(user.name);
        setUserAvatar(user.avatarUrl || "");
    }, [user, currentUserId]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            reason: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        const selectedSite = sites.find(s => s.id === values.siteId);
        if (!selectedSite) return;

        onNewRequest({
            userId: currentUserId,
            userName: userName,
            userAvatar: userAvatar,
            date: format(values.accessDate, "yyyy-MM-dd"),
            reason: values.reason,
            siteId: values.siteId,
            siteName: selectedSite.name,
        });

        toast({
            title: "Request Submitted!",
            description: "Your access request has been sent for approval.",
        });
        form.reset();
        form.setValue('siteId', '');
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Submit a New Access Request</CardTitle>
                <CardDescription>Fill out the details below to request access for a specific date and site.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="siteId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Site</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isLoadingSites}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isLoadingSites ? "Loading sites..." : "Select a site"} />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {sites.filter(site => site.requiresAccessApproval !== false).map(site => (
                                            <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="accessDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                    <FormLabel>Access Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            {field.value ? (
                                                format(field.value, "PPP")
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) =>
                                                date < new Date(new Date().setHours(0,0,0,0))
                                            }
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason for Access</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Scheduled maintenance on server room A." {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Please provide a clear and concise reason for your visit.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit">Submit Request</Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    )
}
