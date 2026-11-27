
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
import type { Contractor, ExternalCompanyType, Operator, User } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  logoUrl: z.string().url({ message: "Enter a valid logo URL." }).or(z.literal("")).optional(),
  operatorId: z.string().optional(),
  focalPointUserId: z.string().optional(),
  parentContractorId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const COMPANY_WIZARD_STEPS = ['Company details', 'Focal point', 'Review & submit'];

interface NewCompanyFormProps {
    companyType: 'operator' | 'contractor';
    onAddCompany: (input: {
        name: string;
        logoUrl?: string;
        type: 'operator' | 'contractor';
        externalType?: ExternalCompanyType;
        operatorId?: string;
        focalPointUserId?: string;
        parentContractorId?: string;
    }) => Promise<boolean> | boolean | void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    operators?: Operator[];
    currentOperatorId?: string;
    /** Legacy contractor administrators request subcontractors for operator approval. */
    subcontractorRegistrationOnly?: boolean;
    /** Active managers who can be chosen as the company's focal point. */
    focalPointCandidates?: User[];
    /**
     * Set when a focal-point manager registers a subcontractor: the main contractors they look after. They become
     * the new subcontractor's focal point, so there is nobody to choose.
     */
    focalPointParentCompanies?: Contractor[];
}

export function NewCompanyForm({ companyType, onAddCompany, open, onOpenChange, operators = [], currentOperatorId, subcontractorRegistrationOnly = false, focalPointCandidates = [], focalPointParentCompanies }: NewCompanyFormProps) {
    const registeringAsFocalPoint = Boolean(focalPointParentCompanies);
    const subcontractorOnly = subcontractorRegistrationOnly || registeringAsFocalPoint;
    const [submitting, setSubmitting] = useState(false);
    const [externalType, setExternalType] = useState<ExternalCompanyType>(subcontractorOnly ? 4 : 1);
    const [step, setStep] = useState(0);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "", logoUrl: "", operatorId: "", focalPointUserId: "", parentContractorId: "" },
    });

    const typeCapitalized = companyType.charAt(0).toUpperCase() + companyType.slice(1);
    const wizardSteps = registeringAsFocalPoint ? ['Company details', 'Main contractor', 'Review & submit'] : COMPANY_WIZARD_STEPS;
    const selectedOperatorId = currentOperatorId || form.watch('operatorId');
    const candidates = focalPointCandidates.filter((manager) => manager.role === 'Manager'
        && (manager.status === undefined || manager.status === 'Active')
        && (!selectedOperatorId || manager.operatorId === selectedOperatorId));

    function closeForm() {
        if (submitting) return;
        form.reset(); setStep(0); setExternalType(subcontractorOnly ? 4 : 1);
        onOpenChange(false);
    }

    function validateFocalStep(): boolean {
        form.clearErrors(['focalPointUserId', 'parentContractorId']);
        if (registeringAsFocalPoint) {
            if (form.getValues('parentContractorId')) return true;
            form.setError('parentContractorId', { message: 'Select the main contractor this subcontractor works under.' });
            return false;
        }
        if (subcontractorRegistrationOnly || form.getValues('focalPointUserId')) return true;
        form.setError('focalPointUserId', { message: 'Select the manager who will be the focal point.' });
        return false;
    }

    async function onSubmit(values: FormValues) {
        if (companyType === 'contractor' && step < 2) { await advance(); return; }
        if (companyType === 'contractor') {
            if (!registeringAsFocalPoint && !currentOperatorId && !values.operatorId) {
                form.setError('operatorId', { message: 'Select the operator registering this company.' });
                return;
            }
            if (!validateFocalStep()) { setStep(1); return; }
        }
        setSubmitting(true);
        try {
            const result = await onAddCompany({
                name: values.name,
                logoUrl: values.logoUrl?.trim() || undefined,
                type: companyType,
                externalType: companyType === 'contractor' ? (subcontractorOnly ? 4 : externalType) : undefined,
                operatorId: currentOperatorId || values.operatorId || undefined,
                focalPointUserId: registeringAsFocalPoint || subcontractorRegistrationOnly ? undefined : values.focalPointUserId || undefined,
                parentContractorId: registeringAsFocalPoint ? values.parentContractorId || undefined : undefined,
            });
            if (result !== false) {
                form.reset();
                setStep(0);
                setExternalType(subcontractorOnly ? 4 : 1);
                onOpenChange(false);
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function advance() {
        if (step === 0) {
            const nameValid = await form.trigger(['name', 'logoUrl']);
            if (!registeringAsFocalPoint && !currentOperatorId && !form.getValues('operatorId')) {
                form.setError('operatorId', { message: 'Select the operator registering this company.' });
                return;
            }
            if (!nameValid) return;
        }
        if (step === 1 && !validateFocalStep()) return;
        setStep((current) => current + 1);
    }

    const focalPointName = registeringAsFocalPoint
        ? 'You'
        : candidates.find((manager) => manager.id === form.getValues('focalPointUserId'))?.name;
    const parentName = focalPointParentCompanies?.find((company) => company.id === form.getValues('parentContractorId'))?.name;
    const reviewRows: Array<[string, string | undefined]> = [
        ['Company', form.getValues('name')],
        ['Operator', operators.find((operator) => operator.id === selectedOperatorId)?.name || 'Your operator'],
        ['Relationship', subcontractorOnly ? 'Subcontractor' : EXTERNAL_COMPANY_TYPES.find((type) => type.value === externalType)?.label],
        ...(registeringAsFocalPoint ? [['Main contractor', parentName] as [string, string | undefined]] : []),
        ...(subcontractorRegistrationOnly ? [] : [['Focal point', focalPointName] as [string, string | undefined]]),
    ];
    const description = subcontractorRegistrationOnly
        ? 'Submit the company for operator approval. It remains inactive until approved.'
        : registeringAsFocalPoint
            ? 'Register a subcontractor under a main contractor you look after. You become its focal point.'
            : companyType === 'contractor'
                ? 'Register a contractor, consultant, vendor, or other third-party company, and choose the Nama manager who looks after it.'
                : 'Create a new operator company record.';

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) closeForm();
                else onOpenChange(next);
            }}
        >
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{subcontractorRegistrationOnly ? 'Request subcontractor registration' : registeringAsFocalPoint ? 'Register a subcontractor' : `Add New ${companyType === 'contractor' ? 'Contractor' : typeCapitalized}`}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                    {companyType === 'contractor' && <ol aria-label="Registration progress" className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">{wizardSteps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={index === step ? 'font-semibold text-primary' : 'text-muted-foreground'}>{index + 1}. {label}</li>)}</ol>}
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {(companyType === 'operator' || step === 0) && <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{subcontractorOnly ? 'Subcontractor company name' : `${typeCapitalized} Name`}</FormLabel>
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
                                    <Select disabled={subcontractorOnly} value={String(externalType)} onValueChange={(value) => setExternalType(Number(value) as ExternalCompanyType)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{(subcontractorOnly ? EXTERNAL_COMPANY_TYPES.filter(type => type.value === 4) : EXTERNAL_COMPANY_TYPES).map((type) => <SelectItem key={type.value} value={String(type.value)}>{type.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <FormField control={form.control} name="logoUrl" render={({ field }) => (
                                    <FormItem><FormLabel>Contractor logo URL</FormLabel><FormControl><Input type="url" placeholder="https://company.example/logo.png" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                {!currentOperatorId && !registeringAsFocalPoint && (
                                    <FormField control={form.control} name="operatorId" render={({ field }) => (
                                        <FormItem><FormLabel>Register for operator</FormLabel><Select value={field.value} onValueChange={(value) => { field.onChange(value); form.setValue('focalPointUserId', ''); }}><FormControl><SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger></FormControl><SelectContent>{operators.map((operator) => <SelectItem key={operator.id} value={operator.id}>{operator.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                    )} />
                                )}
                            </>
                        )}
                        {companyType === 'contractor' && step === 1 && registeringAsFocalPoint && (
                            <FormField control={form.control} name="parentContractorId" render={({ field }) => (
                                <FormItem><FormLabel>Main contractor</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select main contractor" /></SelectTrigger></FormControl><SelectContent>{focalPointParentCompanies!.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )} />
                        )}
                        {companyType === 'contractor' && step === 1 && !registeringAsFocalPoint && (
                            <div className="rounded-lg border bg-muted/30 p-4">
                                {subcontractorRegistrationOnly ? (
                                    <p className="text-sm text-muted-foreground">Your company’s Nama focal point will also look after this subcontractor once the operator approves it.</p>
                                ) : (
                                    <>
                                        <FormField control={form.control} name="focalPointUserId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Focal point</FormLabel>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a manager" /></SelectTrigger></FormControl>
                                                    <SelectContent>{candidates.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <p className="mt-3 text-sm text-muted-foreground">The focal point is the Nama manager who keeps this company’s profile current and creates its supervisors. Supervisors then register their own workers.</p>
                                        {candidates.length === 0 && <p role="status" className="mt-2 text-sm text-destructive">There are no active managers for this operator yet. Add a manager first.</p>}
                                    </>
                                )}
                            </div>
                        )}
                        {companyType === 'contractor' && step === 2 && <section aria-label="Review registration request" className="space-y-5">
                            <h3 className="font-semibold">Review before submitting</h3>
                            <dl className="grid gap-4 text-sm sm:grid-cols-2">
                                {reviewRows.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
                            </dl>
                            {subcontractorRegistrationOnly && <p className="rounded-md bg-muted p-4 text-sm">Your request will be sent to the selected operator for approval. The subcontractor cannot register personnel or receive project access before approval.</p>}
                        </section>}
                        <DialogFooter className="border-t pt-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={closeForm}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            {companyType === 'contractor' && step > 0 && <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={submitting}>Back</Button>}
                            {companyType === 'contractor' && <span className="self-center text-sm text-muted-foreground">Step {step + 1} of 3</span>}
                            {companyType === 'contractor' && step < 2 ? <Button key="next" type="button" onClick={(event) => { event.preventDefault(); void advance(); }}>Next</Button> : <Button key="submit" type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {subcontractorRegistrationOnly ? 'Submit registration request' : companyType === 'contractor' ? 'Register company' : `Add ${typeCapitalized}`}
                            </Button>}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
