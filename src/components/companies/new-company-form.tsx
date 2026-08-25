
'use client'

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { EXTERNAL_COMPANY_TYPES } from '@/components/compliance/compliance-model';
import type { ExternalCompanyType } from '@/lib/types';
import type { Operator } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  operatorId: z.string().optional(),
  contractNumber: z.string().optional(),
  contractValidFrom: z.string().optional(),
  contractValidTo: z.string().optional(),
  adminName: z.string().optional(),
  adminEmail: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface NewCompanyFormProps {
    companyType: 'operator' | 'contractor';
    onAddCompany: (input: {
        name: string;
        type: 'operator' | 'contractor';
        externalType?: ExternalCompanyType;
        operatorId?: string;
        contractNumber?: string;
        contractValidFromUtc?: string;
        contractValidToUtc?: string;
        adminName?: string;
        adminEmail?: string;
    }) => Promise<boolean> | boolean | void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    operators?: Operator[];
    currentOperatorId?: string;
}

export function NewCompanyForm({ companyType, onAddCompany, open, onOpenChange, operators = [], currentOperatorId }: NewCompanyFormProps) {
    const [submitting, setSubmitting] = useState(false);
    const [externalType, setExternalType] = useState<ExternalCompanyType>(1);
    const [step, setStep] = useState(0);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "", operatorId: "", contractNumber: "", contractValidFrom: "", contractValidTo: "", adminName: "", adminEmail: "" },
    });

    const typeCapitalized = companyType.charAt(0).toUpperCase() + companyType.slice(1);

    async function onSubmit(values: FormValues) {
        if (companyType === 'contractor') {
            if (!currentOperatorId && !values.operatorId) {
                form.setError('operatorId', { message: 'Select the operator registering this company.' });
                return;
            }
            if (!values.adminName?.trim()) {
                form.setError('adminName', { message: 'Administrator name is required.' });
                return;
            }
            if (!values.adminEmail?.trim() || !z.string().email().safeParse(values.adminEmail).success) {
                form.setError('adminEmail', { message: 'Enter a valid administrator email.' });
                return;
            }
            if (!values.contractNumber?.trim()) {
                form.setError('contractNumber', { message: 'Contract number is required.' });
                return;
            }
            if (!values.contractValidFrom) {
                form.setError('contractValidFrom', { message: 'Contract start date is required.' });
                return;
            }
            if (!values.contractValidTo || values.contractValidTo <= values.contractValidFrom) {
                form.setError('contractValidTo', { message: 'Contract end date must be after the start date.' });
                return;
            }
        }
        setSubmitting(true);
        try {
            const result = await onAddCompany({
                name: values.name,
                type: companyType,
                externalType: companyType === 'contractor' ? externalType : undefined,
                operatorId: currentOperatorId || values.operatorId || undefined,
                contractNumber: values.contractNumber?.trim(),
                contractValidFromUtc: values.contractValidFrom ? new Date(`${values.contractValidFrom}T00:00:00Z`).toISOString() : undefined,
                contractValidToUtc: values.contractValidTo ? new Date(`${values.contractValidTo}T23:59:59Z`).toISOString() : undefined,
                adminName: values.adminName?.trim(),
                adminEmail: values.adminEmail?.trim(),
            });
            if (result !== false) {
                form.reset();
                onOpenChange(false);
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function advance() {
        if (step === 0) {
            const nameValid = await form.trigger('name');
            if (!currentOperatorId && !form.getValues('operatorId')) {
                form.setError('operatorId', { message: 'Select the operator registering this company.' });
                return;
            }
            if (!nameValid) return;
        }
        if (step === 1) {
            const start = form.getValues('contractValidFrom');
            const end = form.getValues('contractValidTo');
            if (!form.getValues('contractNumber')?.trim()) form.setError('contractNumber', { message: 'Contract number is required.' });
            if (!start) form.setError('contractValidFrom', { message: 'Contract start date is required.' });
            if (!end || (start && end <= start)) form.setError('contractValidTo', { message: 'Contract end date must be after the start date.' });
            if (!form.getValues('contractNumber')?.trim() || !start || !end || end <= start) return;
        }
        setStep((current) => current + 1);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) { form.reset(); setExternalType(1); setStep(0); }
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add New {companyType === 'contractor' ? 'Contractor' : typeCapitalized}</DialogTitle>
                    <DialogDescription>{companyType === 'contractor' ? 'Register a contractor, consultant, vendor, or other third-party company.' : 'Create a new operator company record.'}</DialogDescription>
                    {companyType === 'contractor' && <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-medium">{['Company details', 'Contract details', 'Admin details'].map((label, index) => <div key={label} className={index === step ? 'text-foreground' : 'text-muted-foreground'}><div className={`mb-1 h-1 rounded-full ${index <= step ? 'bg-primary' : 'bg-muted'}`} />{label}</div>)}</div>}
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {(companyType === 'operator' || step === 0) && <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{typeCapitalized} Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder={`e.g., ${typeCapitalized} Inc.`} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />}
                        {companyType === 'contractor' && step === 0 && (
                            <>
                                <div className="space-y-2">
                                    <FormLabel>Relationship type</FormLabel>
                                    <Select value={String(externalType)} onValueChange={(value) => setExternalType(Number(value) as ExternalCompanyType)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{EXTERNAL_COMPANY_TYPES.map((type) => <SelectItem key={type.value} value={String(type.value)}>{type.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                {!currentOperatorId && (
                                    <FormField control={form.control} name="operatorId" render={({ field }) => (
                                        <FormItem><FormLabel>Register for operator</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger></FormControl><SelectContent>{operators.map((operator) => <SelectItem key={operator.id} value={operator.id}>{operator.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                    )} />
                                )}
                            </>
                        )}
                        {companyType === 'contractor' && step === 1 && (
                            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                <p className="text-sm font-medium">Contract details</p>
                                <FormField control={form.control} name="contractNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Contract number *</FormLabel><FormControl><Input placeholder="e.g. NWS-C-2026-014" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField control={form.control} name="contractValidFrom" render={({ field }) => (
                                        <FormItem><FormLabel>Valid from *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="contractValidTo" render={({ field }) => (
                                        <FormItem><FormLabel>Valid to *</FormLabel><FormControl><Input type="date" min={form.watch('contractValidFrom')} {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            </div>
                        )}
                        {companyType === 'contractor' && step === 2 && (
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <p className="mb-3 text-sm font-medium">Contractor administrator</p>
                                    <div className="space-y-4">
                                        <FormField control={form.control} name="adminName" render={({ field }) => (
                                            <FormItem><FormLabel>Administrator name</FormLabel><FormControl><Input autoComplete="name" placeholder="Full name" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="adminEmail" render={({ field }) => (
                                            <FormItem><FormLabel>Administrator email</FormLabel><FormControl><Input type="email" autoComplete="email" placeholder="admin@company.com" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <p className="mt-3 text-xs text-muted-foreground">GatePass sends a secure activation invitation after registration.</p>
                                </div>
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            {companyType === 'contractor' && step > 0 && <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={submitting}>Back</Button>}
                            {companyType === 'contractor' && step < 2 ? <Button type="button" onClick={() => void advance()}>Next</Button> : <Button type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {companyType === 'contractor' ? 'Register company & invite admin' : `Add ${typeCapitalized}`}
                            </Button>}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
