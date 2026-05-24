
'use client'

import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User, UserRole, Site, Contractor, Operator } from "@/lib/types";
import React, { useMemo } from "react";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  role: z.enum(['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Security', 'Visitor', 'Worker', 'Supervisor']),
  assignedSiteId: z.string().optional(),
  contractorId: z.string().optional(),
  operatorId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface NewUserFormProps {
    onNewUser: (user: Omit<User, 'id' | 'avatarUrl' | 'status' | 'idCardImageUrl' | 'idNumber' | 'certificates' | 'notes'>) => void;
    sites: Site[];
    contractors: Contractor[];
    operators: Operator[];
    isLoading: boolean;
    currentUserRole: UserRole;
    currentUserId: string;
    currentUserOperatorId?: string;
    currentUserContractorId?: string;
}

export function NewUserForm({ onNewUser, sites, contractors, operators, isLoading, currentUserRole, currentUserOperatorId, currentUserContractorId }: NewUserFormProps) {

    const availableRoles = useMemo<UserRole[]>(() => {
        if (currentUserRole === 'Admin') {
            return ['Operator Admin', 'Contractor Admin'];
        }
        if (currentUserRole === 'Operator Admin') {
            return ['Manager', 'Security', 'Worker'];
        }
        if (currentUserRole === 'Contractor Admin') {
            return ['Supervisor', 'Worker'];
        }
        return [];
    }, [currentUserRole]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            role: availableRoles[0] || "Worker",
            assignedSiteId: "",
            contractorId: "",
            operatorId: "",
        },
    });

    const selectedRole = useWatch({
      control: form.control,
      name: 'role'
    });

    async function onSubmit(values: FormValues) {
        let companyName: string | undefined;

        if (currentUserRole === 'Operator Admin') {
            companyName = operators.find(o => o.id === currentUserOperatorId)?.name;
        } else if (values.role === 'Operator Admin' || values.role === 'Manager') {
            companyName = operators.find(o => o.id === values.operatorId)?.name;
        } else if (values.role === 'Contractor Admin' || values.role === 'Supervisor' || values.role === 'Worker') {
            companyName = contractors.find(c => c.id === values.contractorId)?.name;
        }

        let operatorId = values.operatorId;
        if (currentUserRole === 'Operator Admin') {
            operatorId = currentUserOperatorId;
            companyName = operators.find(o => o.id === operatorId)?.name;
        }

        let contractorId = values.contractorId;
        if (currentUserRole === 'Contractor Admin') {
            contractorId = currentUserContractorId;
            companyName = contractors.find(c => c.id === contractorId)?.name;
        }

        const newUser: Omit<User, 'id' | 'avatarUrl' | 'status' | 'idCardImageUrl' | 'idNumber' | 'certificates' | 'notes'> = {
            name: values.name,
            email: values.email,
            role: values.role,
            operatorId: operatorId,
            contractorId: contractorId,
            company: companyName,
        };
        
        if (values.role === 'Security') {
            newUser.assignedSiteId = values.assignedSiteId;
        }


        onNewUser(newUser);
        form.reset();
    }

    const getRoleSpecificDescription = () => {
        switch(currentUserRole) {
            case 'Admin': return "Create a top-level administrator for an Operator or Contractor company.";
            case 'Operator Admin': return "Create a new Manager, Security, or Worker profile for your organization.";
            case 'Contractor Admin': return "Create a new Supervisor or Worker profile for your organization.";
            default: return "Enter the user's details. An email will be sent with a temporary password.";
        }
    }

    const operatorSites = useMemo(() => {
        if (currentUserRole === 'Operator Admin') {
            return sites.filter(site => site.operatorId === currentUserOperatorId);
        }
        return sites;
    }, [sites, currentUserRole, currentUserOperatorId]);


    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-4">
            <p className="text-sm text-muted-foreground">{getRoleSpecificDescription()}</p>
          <div className="space-y-6 overflow-y-visible sm:max-h-[70vh] sm:overflow-y-auto px-1 sm:pr-4">
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
                        {availableRoles.map((role) => (
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
               {(selectedRole === "Contractor Admin") && currentUserRole === 'Admin' && (
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
                 {(selectedRole === "Operator Admin" || (selectedRole === "Manager" && currentUserRole === 'Admin')) && (
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
                        {operatorSites.map((site) => (
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
          </div>
          <div className="flex justify-end pt-8">
            <Button type="submit">Create User Profile</Button>
          </div>
        </form>
      </Form>
    );
}
