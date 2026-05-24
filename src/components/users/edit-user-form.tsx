
'use client'

import { z } from "zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { User, UserRole, Certificate, CertificateType, Site, UserStatus, Contractor, Operator } from "@/lib/types";
import { CalendarIcon, FileText, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Calendar } from "../ui/calendar";
import { useMediaQuery } from "react-responsive";
import { useSession } from "@/providers/session-provider";
import { listCertificateTypesRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";


const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  idNumber: z.string().optional(),
  nationality: z.string().optional(),
  role: z.enum(['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Security', 'Visitor', 'Worker', 'Supervisor']),
  status: z.enum(['Active', 'Inactive']),
  notes: z.string().optional(),
  certificates: z.array(z.object({
      name: z.string({ required_error: "Please select a certificate type."}).min(1, "Certificate name is required."),
      expiryDate: z.date().optional(),
  })).optional(),
  assignedSiteId: z.string().optional(),
  contractorId: z.string().optional(),
  operatorId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditUserFormProps {
    user: User;
    onUpdateUser: (userId: string, originalUser: User, updatedData: Omit<User, 'id' >) => Promise<boolean>;
    sites: Site[];
    contractors: Contractor[];
    operators: Operator[];
    isLoading: boolean;
    closeDialog: () => void;
}

export function EditUserForm({ user, onUpdateUser, sites, contractors, operators, isLoading, closeDialog }: EditUserFormProps) {
    const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
    const [loadingCerts, setLoadingCerts] = useState(true);
    const { token } = useSession();
    const { toast } = useToast();
    const roles: UserRole[] = ['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Security', 'Visitor', 'Worker', 'Supervisor'];
    const statuses: UserStatus[] = ['Active', 'Inactive'];

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: user.name || "",
            email: user.email || "",
            idNumber: user.idNumber || "",
            nationality: user.nationality || "",
            notes: user.notes || "",
            role: user.role || "Worker",
            status: user.status || "Inactive",
            certificates: user.certificates?.map(c => ({...c, expiryDate: c.expiryDate ? parseISO(c.expiryDate) : undefined})) || [],
            assignedSiteId: user.assignedSiteId || "",
            contractorId: user.contractorId || "",
            operatorId: user.operatorId || "",
        },
    });
    
    const selectedRole = useWatch({
      control: form.control,
      name: 'role'
    });

    useEffect(() => {
        if (!token) {
            setLoadingCerts(false);
            return;
        }
        let isActive = true;
        setLoadingCerts(true);
        listCertificateTypesRequest(token)
            .then((certsData) => {
                if (!isActive) return;
                setCertificateTypes(certsData as CertificateType[]);
            })
            .catch((error) => {
                console.error('Failed to load certificate types', error);
                if (isActive) {
                    toast({
                        variant: "destructive",
                        title: "Certificate Load Failed",
                        description: "Could not load certificate types.",
                    });
                }
            })
            .finally(() => {
                if (isActive) setLoadingCerts(false);
            });
        return () => {
            isActive = false;
        };
    }, [token, toast]);


    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "certificates",
    });

    async function onSubmit(values: FormValues) {
        const emptyToNull = (value?: string) => (value && value.trim() ? value.trim() : null);
        const certificates: Certificate[] = values.certificates ? values.certificates.map(cert => ({
            name: cert.name,
            expiryDate: cert.expiryDate ? format(cert.expiryDate, "yyyy-MM-dd") : undefined,
        })) : [];

        const selectedContractor = contractors.find(c => c.id === values.contractorId);
        const selectedOperator = operators.find(o => o.id === values.operatorId);

        const isContractorRole = ['Worker', 'Supervisor', 'Contractor Admin'].includes(values.role);
        const isOperatorRole = ['Manager', 'Operator Admin', 'Admin'].includes(values.role);

        const contractorIdValue = isContractorRole
            ? values.contractorId || null
            : null;
        const operatorIdValue = isOperatorRole
            ? values.operatorId || null
            : null;
        const assignedSiteIdValue = values.role === 'Security'
            ? values.assignedSiteId || null
            : null;

        let companyValue: string | null = null;
        if (isContractorRole) {
            companyValue = selectedContractor?.name ?? null;
        } else if (isOperatorRole) {
            companyValue = selectedOperator?.name ?? null;
        } else if (values.role === 'Visitor') {
            companyValue = user.company ?? null;
        }

        const updatedData: Omit<User, 'id' | 'idCardImageUrl'> = {
            name: values.name,
            role: values.role,
            status: values.status,
            email: values.email || undefined,
            notes: emptyToNull(values.notes),
            idNumber: emptyToNull(values.idNumber),
            nationality: emptyToNull(values.nationality),
            assignedSiteId: assignedSiteIdValue,
            contractorId: contractorIdValue,
            operatorId: operatorIdValue,
            company: companyValue,
            certificates: certificates,
        };

        const success = await onUpdateUser(user.id, user, updatedData);

        if (success) {
            closeDialog();
        }
    }

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-4">
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john.doe@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(selectedRole === "Worker" || selectedRole === "Supervisor" || selectedRole === "Contractor Admin") && (
                <FormField
                    control={form.control}
                    name="contractorId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contractor Company</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isLoading}>
                            <FormControl><SelectTrigger>
                                <SelectValue placeholder={isLoading ? "Loading..." : "Assign a contractor"}/>
                            </SelectTrigger></FormControl>
                            <SelectContent>
                                {contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}
                {(selectedRole === "Manager" || selectedRole === "Operator Admin") && (
                <FormField
                    control={form.control}
                    name="operatorId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Operator Company</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isLoading}>
                            <FormControl><SelectTrigger>
                                <SelectValue placeholder={isLoading ? "Loading..." : "Assign an operator"}/>
                            </SelectTrigger></FormControl>
                            <SelectContent>
                                {operators.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="idNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>ID Number (optional)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Driver's License #" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="nationality"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nationality (optional)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Omani" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
            </div>


            {selectedRole === "Security" && (
              <FormField
                control={form.control}
                name="assignedSiteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Site</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoading
                                ? "Loading sites..."
                                : "Select a site to assign"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Assign this security user to a specific site.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Senior project manager for the new construction wing."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Certificates (Optional)</FormLabel>
              <FormDescription>
                Log certificates like safety training or work permits.
              </FormDescription>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-end gap-4 p-4 border rounded-md relative"
                >
                  <FormField
                    control={form.control}
                    name={`certificates.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Certificate Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={loadingCerts}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  loadingCerts
                                    ? "Loading..."
                                    : "Select certificate type"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {certificateTypes.map((type) => (
                              <SelectItem key={type.id} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`certificates.${index}.expiryDate`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Expiry Date</FormLabel>
                        {(() => {
                          const isMobile = useMediaQuery({ maxWidth: 768 });

                          return isMobile ? (
                            <FormControl>
                              <input
                                type="date"
                                value={
                                  field.value
                                    ? format(field.value, "yyyy-MM-dd")
                                    : ""
                                }
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value
                                      ? new Date(e.target.value)
                                      : undefined
                                  )
                                }
                                className="w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                              />
                            </FormControl>
                          ) : (
                            <Popover.Root>
                              <Popover.Trigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-[200px] pl-3 text-left font-normal",
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
                              </Popover.Trigger>
                              <Popover.Portal>
                                <Popover.Content
                                  className="w-auto p-0"
                                  align="start"
                                >
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </Popover.Content>
                              </Popover.Portal>
                            </Popover.Root>
                          );
                        })()}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: "" })}
              >
                <FileText className="mr-2 h-4 w-4" />
                Add Certificate Record
              </Button>
            </div>
          </div>
          <div className="flex justify-end pt-8">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    );
}
