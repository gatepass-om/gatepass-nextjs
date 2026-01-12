
'use client'

import { z } from "zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDown, PlusCircle, Trash2, UserCheck, Loader2, FileBadge, ShieldAlert } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Operator, Site, Contractor, User, Certificate } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useCallback, useEffect } from "react";
import { processAccessRequest } from "@/ai/flows/process-access-request-flow";
import { serverFetchWorkerData } from "@/app/actions/workerActions";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { format, parseISO, isBefore } from "date-fns";
import { Textarea } from "../ui/textarea";


const certificateSchema = z.object({
  name: z.string(),
  expiryDate: z.string().optional(),
});

const workerSchema = z.object({
  workerId: z.string().min(1, "Worker ID is required."),
  name: z.string().optional(),
  email: z.string().optional(),
  jobTitle: z.string().optional(),
  nationality: z.string().optional(),
  certificates: z.array(certificateSchema).optional(),
  status: z.enum(["unchecked", "loading", "found", "not_found"]).default("unchecked"),
});

const formSchema = z.object({
  operatorId: z.string({ required_error: "Please select an operator." }),
  siteId: z.string({ required_error: "Please select a site." }),
  contractNumber: z.string().min(1, { message: "Contract number is required." }),
  focalPoint: z.string().min(2, { message: "Focal point name is required." }),
  notes: z.string().optional(),
  workers: z.array(workerSchema).min(1, { message: "Please add at least one worker." }),
});

type FormValues = z.infer<typeof formSchema>;

interface SupervisorRequestFormProps {
    supervisor: User;
    operators: Operator[];
    sites: Site[];
    contractors: Contractor[];
    isLoading: boolean;
}

export function SupervisorRequestForm({ supervisor, operators, sites, contractors, isLoading }: SupervisorRequestFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const isOperatorAdmin = supervisor.role === 'Operator Admin';

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            operatorId: isOperatorAdmin ? supervisor.operatorId : "",
            siteId: "",
            contractNumber: "",
            focalPoint: "",
            notes: "",
            workers: [{ workerId: "", status: 'unchecked' }],
        },
    });

    useEffect(() => {
        if (isOperatorAdmin && supervisor.operatorId) {
            form.setValue('operatorId', supervisor.operatorId);
        }
    }, [isOperatorAdmin, supervisor.operatorId, form]);

    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "workers"
    });
    
    const selectedOperatorId = form.watch("operatorId");
    const availableSites = useMemo(() => {
        return sites.filter(site => site.operatorId === selectedOperatorId);
    }, [sites, selectedOperatorId]);

    const handleCheckWorkerId = useCallback(async (index: number) => {
        const workerId = form.getValues(`workers.${index}.workerId`);
        if (!workerId) {
            toast({ variant: "destructive", title: "Missing ID", description: "Please enter a worker ID to check." });
            return;
        }

        form.setValue(`workers.${index}.status`, 'loading');
        try {
            const result = await serverFetchWorkerData({ workerId });
            if (result && result.name) {
                form.setValue(`workers.${index}.name`, result.name);
                form.setValue(`workers.${index}.email`, result.email);
                form.setValue(`workers.${index}.jobTitle`, result.jobTitle);
                form.setValue(`workers.${index}.nationality`, result.nationality);
                form.setValue(`workers.${index}.certificates`, result.certificates);
                form.setValue(`workers.${index}.status`, 'found');
            } else {
                form.setValue(`workers.${index}.name`, '');
                form.setValue(`workers.${index}.email`, '');
                form.setValue(`workers.${index}.jobTitle`, '');
                form.setValue(`workers.${index}.nationality`, '');
                form.setValue(`workers.${index}.certificates`, []);
                form.setValue(`workers.${index}.status`, 'not_found');
            }
        } catch (error) {
            console.error("Error fetching worker data:", error);
            form.setValue(`workers.${index}.status`, 'not_found');
        }
    }, [form, toast]);


    async function onSubmit(values: FormValues) {
        const contractorId = isOperatorAdmin ? supervisor.id : supervisor.contractorId;

        if (!contractorId) {
             toast({ variant: "destructive", title: "Error", description: "Your user profile is not linked to a contractor or operator."});
            return;
        }

        const verifiedWorkers = values.workers.filter(w => w.status === 'found');
        if (verifiedWorkers.length === 0) {
            toast({ variant: "destructive", title: "No Verified Workers", description: "Please add and verify at least one worker."});
            return;
        }
        
        // ** Certificate Validation Logic **
        const selectedSite = sites.find(s => s.id === values.siteId);
        const requiredCerts = selectedSite?.requiredCertificates || [];

        if (requiredCerts.length > 0) {
            for (const worker of verifiedWorkers) {
                for (const requiredCertName of requiredCerts) {
                    const workerCert = worker.certificates?.find(c => c.name === requiredCertName);
                    
                    if (!workerCert) {
                        toast({
                            variant: "destructive",
                            title: "Submission Failed: Certificate Missing",
                            description: `Worker ${worker.name} (${worker.workerId}) is missing the required certificate: "${requiredCertName}".`,
                            duration: 7000,
                        });
                        return; // Halt submission
                    }
                    
                    if (workerCert.expiryDate && isBefore(parseISO(workerCert.expiryDate), new Date())) {
                        toast({
                            variant: "destructive",
                            title: "Submission Failed: Certificate Expired",
                            description: `Worker ${worker.name}'s (${worker.workerId}) certificate "${requiredCertName}" has expired.`,
                            duration: 7000,
                        });
                        return; // Halt submission
                    }
                }
            }
        }


        setIsSubmitting(true);
        try {
            const result = await processAccessRequest({
                supervisorId: supervisor.id,
                supervisorName: supervisor.name,
                contractorId: contractorId,
                operatorId: values.operatorId,
                siteId: values.siteId,
                contractNumber: values.contractNumber,
                focalPoint: values.focalPoint,
                notes: values.notes,
                workerList: verifiedWorkers.map(w => ({ 
                    id: w.workerId, 
                    name: w.name!, 
                    email: w.email!,
                    nationality: w.nationality,
                    certificates: w.certificates,
                })),
            });

            if (result.success) {
                toast({
                    title: "Request Submitted!",
                    description: `Access request for ${result.workersProcessed} worker(s) has been sent for approval.`,
                });
                form.reset();
                 // Reset field array to a single empty row
                form.control._reset();
            } else {
                throw new Error(result.error || "Failed to process the request.");
            }

        } catch (error: any) {
            console.error("Error submitting group access request:", error);
            toast({ variant: "destructive", title: "Submission Error", description: error.message || "Could not submit your request." });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Submit Group Access Request</CardTitle>
                <CardDescription>Fill out the contract details and provide the list of workers requiring access.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField
                                control={form.control}
                                name="operatorId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Operator</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isLoading || isOperatorAdmin}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isLoading ? "Loading..." : "Select an operator"} />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {operators.map(op => (
                                            <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="siteId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Site</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!selectedOperatorId || isLoading}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={!selectedOperatorId ? "Select an operator first" : "Select a site"} />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {availableSites.map(site => (
                                            <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="contractNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contract Number</FormLabel>
                                        <FormControl><Input placeholder="e.g., C-123-XYZ" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="focalPoint"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Operator Focal Point</FormLabel>
                                        <FormControl><Input placeholder="e.g., Site Manager Name" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                         <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Add any relevant comments, instructions, or context for the approver..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <div className="space-y-4">
                          <FormLabel>Workers</FormLabel>
                          <FormDescription>Enter each worker's ID and verify their details from the external system.</FormDescription>
                           {fields.map((field, index) => {
                             const worker = form.watch(`workers.${index}`);
                             return (
                              <div key={field.id} className={cn("flex flex-col gap-3 p-4 rounded-md border", {
                                "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800": worker.status === 'found',
                                "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800": worker.status === 'not_found',
                              })}>
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-start gap-4">
                                  <FormField
                                    control={form.control}
                                    name={`workers.${index}.workerId`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className={cn("text-xs", index > 0 && "sm:hidden")}>Worker ID</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Enter ID..." {...field} disabled={worker.status === 'found'} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <Button type="button" size="sm" onClick={() => handleCheckWorkerId(index)} disabled={worker.status === 'loading' || worker.status === 'found'} className="self-end">
                                    {worker.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {worker.status !== 'loading' && "Check ID"}
                                  </Button>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 col-span-1 md:col-span-1 gap-4">
                                    <FormItem>
                                      <FormLabel className={cn("text-xs", index > 0 && "sm:hidden")}>Name</FormLabel>
                                      <Input readOnly value={worker.name || (worker.status === 'not_found' ? 'Not Found' : '')} placeholder="Name (auto-filled)" />
                                    </FormItem>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-dashed">
                                    <FormItem>
                                        <FormLabel className="text-xs">Email</FormLabel>
                                        <Input readOnly value={worker.email || ''} placeholder="Email (auto-filled)" />
                                    </FormItem>
                                     <FormItem>
                                        <FormLabel className="text-xs">Job Title</FormLabel>
                                        <Input readOnly value={worker.jobTitle || ''} placeholder="Job Title (auto-filled)" />
                                    </FormItem>
                                     <FormItem>
                                        <FormLabel className="text-xs">Nationality</FormLabel>
                                        <Input readOnly value={worker.nationality || ''} placeholder="Nationality (auto-filled)" />
                                    </FormItem>
                                </div>
                                <div>
                                    <FormLabel className="text-xs">Certificates</FormLabel>
                                    <div className="mt-2 flex flex-wrap gap-2 min-h-6 p-2 rounded-md bg-muted/50 text-sm">
                                        {(worker.certificates && worker.certificates.length > 0) ? worker.certificates.map(cert => {
                                            const isExpired = cert.expiryDate && isBefore(parseISO(cert.expiryDate), new Date());
                                            return (
                                                <Badge key={cert.name} variant={isExpired ? "destructive" : "secondary"} className="font-normal">
                                                    {isExpired ? <ShieldAlert className="h-3 w-3 mr-1.5" /> : <FileBadge className="h-3 w-3 mr-1.5" />}
                                                    {cert.name} {isExpired ? '(Expired)' : ''}
                                                </Badge>
                                            )
                                        }) : <span className="text-muted-foreground">Certificates (auto-filled)</span>}
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10" disabled={fields.length <= 1}>
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                             )
                           })}
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ workerId: "", status: 'unchecked' })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Worker
                            </Button>
                        </div>
                        <FormField
                            name="workers"
                            render={()=>(<FormMessage/>)}
                        />

                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Submitting..." : "Submit Group Request"}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    )
}
