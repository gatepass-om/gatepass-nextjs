
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

const formSchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

interface NewCompanyFormProps {
    companyType: 'operator' | 'contractor';
    onAddCompany: (name: string, type: 'operator' | 'contractor', externalType?: ExternalCompanyType) => Promise<boolean> | boolean | void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewCompanyForm({ companyType, onAddCompany, open, onOpenChange }: NewCompanyFormProps) {
    const [submitting, setSubmitting] = useState(false);
    const [externalType, setExternalType] = useState<ExternalCompanyType>(1);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "" },
    });

    const typeCapitalized = companyType.charAt(0).toUpperCase() + companyType.slice(1);

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const result = await onAddCompany(values.name, companyType, companyType === 'contractor' ? externalType : undefined);
            if (result !== false) {
                form.reset();
                onOpenChange(false);
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) { form.reset(); setExternalType(1); }
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add New {companyType === 'contractor' ? 'External Company' : typeCapitalized}</DialogTitle>
                    <DialogDescription>{companyType === 'contractor' ? 'Register a contractor, consultant, vendor, or other third-party company.' : 'Create a new operator company record.'}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
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
                        />
                        {companyType === 'contractor' && (
                            <div className="space-y-2">
                                <FormLabel>Relationship type</FormLabel>
                                <Select value={String(externalType)} onValueChange={(value) => setExternalType(Number(value) as ExternalCompanyType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{EXTERNAL_COMPANY_TYPES.map((type) => <SelectItem key={type.value} value={String(type.value)}>{type.label}</SelectItem>)}</SelectContent>
                                </Select>
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
                            <Button type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add {companyType === 'contractor' ? 'External Company' : typeCapitalized}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
