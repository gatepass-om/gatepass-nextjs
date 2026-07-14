
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
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

interface NewCompanyFormProps {
    companyType: 'operator' | 'contractor';
    onAddCompany: (name: string, type: 'operator' | 'contractor') => Promise<boolean> | boolean | void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewCompanyForm({ companyType, onAddCompany, open, onOpenChange }: NewCompanyFormProps) {
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "" },
    });

    const typeCapitalized = companyType.charAt(0).toUpperCase() + companyType.slice(1);

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const result = await onAddCompany(values.name, companyType);
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
                if (!next) form.reset();
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add New {typeCapitalized}</DialogTitle>
                    <DialogDescription>Create a new {companyType} company record.</DialogDescription>
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
                                Add {typeCapitalized}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
