
'use client'

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Site, User, CertificateType, Operator, UserRole } from "@/lib/types";
import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";

const formSchema = z.object({
  name: z.string().min(2, { message: "Site name must be at least 2 characters." }),
  operatorId: z.string().optional(),
  managerIds: z.array(z.string()).min(1, { message: "At least one manager must be selected." }),
  requiredCertificates: z.array(z.string()).optional(),
  requiresAccessApproval: z.boolean(),
  usesSecurityCheckpoints: z.boolean(),
  usesSmartAccess: z.boolean(),
  maximumOccupancy: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.coerce.number().int().positive().optional(),
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface EditSiteFormProps {
    site: Site;
    onUpdateSite: (siteId: string, data: Omit<Site, 'id'>) => Promise<boolean>;
    users: User[];
    certificateTypes: CertificateType[];
    operators: Operator[];
    isLoadingUsers: boolean;
    isLoadingCerts: boolean;
    isLoadingOperators: boolean;
    currentUserRole: UserRole;
    closeDialog: () => void;
}

export function EditSiteForm({
    site,
    onUpdateSite,
    users,
    certificateTypes,
    operators,
    isLoadingUsers,
    isLoadingCerts,
    isLoadingOperators,
    currentUserRole,
    closeDialog,
}: EditSiteFormProps) {
    const [operatorOpen, setOperatorOpen] = useState(false);
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: site.name,
            operatorId: site.operatorId,
            managerIds: site.managerIds,
            requiredCertificates: site.requiredCertificates || [],
            requiresAccessApproval: site.requiresAccessApproval ?? true,
            usesSecurityCheckpoints: site.usesSecurityCheckpoints ?? true,
            usesSmartAccess: site.usesSmartAccess ?? true,
            maximumOccupancy: site.maximumOccupancy,
        },
    });

    const managers = users.filter(u => u.role === 'Manager');

    async function onSubmit(values: FormValues) {
        if (currentUserRole === 'Admin' && !values.operatorId) {
            form.setError("operatorId", { message: "Please select an operator." });
            return;
        }

        const success = await onUpdateSite(site.id, {
            name: values.name,
            operatorId: values.operatorId || site.operatorId,
            managerIds: values.managerIds,
            requiredCertificates: values.requiredCertificates || [],
            requiresAccessApproval: values.requiresAccessApproval,
            usesSecurityCheckpoints: values.usesSecurityCheckpoints,
            usesSmartAccess: values.usesSmartAccess,
            maximumOccupancy: values.maximumOccupancy,
        });
        if (success) {
            closeDialog();
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-4">
                 <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="e.g., Main Headquarters" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />

                    {currentUserRole === 'Admin' && (
                        <FormField
                            control={form.control}
                            name="operatorId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Operator</FormLabel>
                                    <Popover open={operatorOpen} onOpenChange={setOperatorOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn(
                                                        "w-full justify-between h-auto min-h-10",
                                                        !field.value?.length && "text-muted-foreground"
                                                    )}
                                                    disabled={isLoadingOperators}
                                                >
                                                    {isLoadingOperators
                                                        ? "Loading operators..."
                                                        : field.value
                                                            ? operators.find((op) => op.id === field.value)?.name
                                                            : "Select operator..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search operators..." />
                                                <CommandList>
                                                    <CommandEmpty>No operators found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {operators.map((operator) => (
                                                            <CommandItem
                                                                value={operator.name}
                                                                key={operator.id}
                                                                onSelect={() => {
                                                                    form.setValue("operatorId", operator.id, { shouldValidate: true });
                                                                    setOperatorOpen(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        field.value === operator.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {operator.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <div className="space-y-4 rounded-md border p-4">
                        <div>
                            <h3 className="font-medium">Site operating model</h3>
                            <p className="text-sm text-muted-foreground">Security and access controls are optional and configured per site.</p>
                        </div>
                        <FormField control={form.control} name="requiresAccessApproval" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-4">
                                <div><FormLabel>Require access approval</FormLabel><p className="text-sm text-muted-foreground">Workers need an approved access request.</p></div>
                                <FormControl><Switch aria-label="Require access approval" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="usesSecurityCheckpoints" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-4">
                                <div><FormLabel>Guarded security checkpoint</FormLabel><p className="text-sm text-muted-foreground">Guards or inspectors record entry and exit scans.</p></div>
                                <FormControl><Switch aria-label="Guarded security checkpoint" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="usesSmartAccess" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-4">
                                <div><FormLabel>Smart locks or mobile credentials</FormLabel><p className="text-sm text-muted-foreground">Connected devices enforce physical access.</p></div>
                                <FormControl><Switch aria-label="Smart locks or mobile credentials" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="maximumOccupancy" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Maximum occupancy (optional)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={1}
                                        inputMode="numeric"
                                        placeholder="Leave blank when no meaningful limit applies"
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                    />
                                </FormControl>
                                <p className="text-sm text-muted-foreground">Used only for capacity statistics and alerts.</p>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <FormField
                        control={form.control}
                        name="managerIds"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Site Managers</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between h-auto min-h-10",
                                            !field.value?.length && "text-muted-foreground"
                                        )}
                                        disabled={isLoadingUsers}
                                        >
                                        <div className="flex flex-wrap gap-1">
                                            {isLoadingUsers ? "Loading managers..." :
                                                field.value?.length > 0 ? (
                                                    users.filter(u => field.value.includes(u.id)).map(user => (
                                                        <Badge key={user.id} variant="secondary" className="mr-1">
                                                            {user.name}
                                                        </Badge>
                                                    ))
                                                ) : "Select managers..."}
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                  <CommandInput placeholder="Search managers..." />
                                  <CommandList>
                                    <CommandEmpty>No managers found.</CommandEmpty>
                                    <CommandGroup>
                                    {managers.map((manager) => (
                                        <CommandItem
                                        value={manager.name}
                                        key={manager.id}
                                        onSelect={() => {
                                            const currentValues = form.getValues("managerIds");
                                            const newValue = currentValues.includes(manager.id)
                                                ? currentValues.filter(id => id !== manager.id)
                                                : [...currentValues, manager.id];
                                            form.setValue("managerIds", newValue, { shouldValidate: true });
                                        }}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value.includes(manager.id)
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                        />
                                        {manager.name}
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                    />

                     <FormField
                        control={form.control}
                        name="requiredCertificates"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Required Certificates</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between h-auto min-h-10",
                                            !field.value?.length && "text-muted-foreground"
                                        )}
                                        disabled={isLoadingCerts}
                                        >
                                        <div className="flex flex-wrap gap-1">
                                            {isLoadingCerts ? "Loading certificates..." :
                                                (field.value ?? []).length > 0 ? (
                                                    certificateTypes.filter(cert => (field.value ?? []).includes(cert.name)).map(cert => (
                                                        <Badge key={cert.id} variant="secondary" className="mr-1">
                                                            {cert.name}
                                                        </Badge>
                                                    ))
                                                ) : "Select required certificates..."}
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                  <CommandInput placeholder="Search certificates..." />
                                  <CommandList>
                                    <CommandEmpty>No certificates found.</CommandEmpty>
                                    <CommandGroup>
                                    {certificateTypes.map((cert) => (
                                        <CommandItem
                                        value={cert.name}
                                        key={cert.id}
                                        onSelect={() => {
                                            const currentValues = form.getValues("requiredCertificates") || [];
                                            const newValue = currentValues.includes(cert.name)
                                                ? currentValues.filter(c => c !== cert.name)
                                                : [...currentValues, cert.name];
                                            form.setValue("requiredCertificates", newValue, { shouldValidate: true });
                                        }}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value?.includes(cert.name)
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                        />
                                        {cert.name}
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="flex justify-end pt-8">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
