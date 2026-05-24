
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { CertificateType } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FileBadge, Loader2, Plus, Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';
import { useSession } from '@/providers/session-provider';
import { createCertificateTypeRequest, deleteCertificateTypeRequest, listCertificateTypesRequest, updateCertificateTypeRequest } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const formSchema = z.object({
  name: z.string().min(3, { message: "Certificate name must be at least 3 characters." }),
});

export default function CertificatesPage() {
    const { firestoreUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin', 'Operator Admin']);
    const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<CertificateType | null>(null);
    const [editedName, setEditedName] = useState('');
    const { toast } = useToast();
    const { token } = useSession();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "" },
    });

    useEffect(() => {
        if (!token || !firestoreUser) return;
        setLoading(true);
        listCertificateTypesRequest(token)
            .then((certs) => {
                setCertificateTypes((certs as CertificateType[]).sort((a, b) => a.name.localeCompare(b.name)));
            })
            .catch((error) => {
                console.error("Error loading certificate types: ", error);
                toast({ variant: "destructive", title: "Load Error", description: "Could not load certificate types." });
            })
            .finally(() => setLoading(false));
    }, [token, firestoreUser, toast]);

    const handleAddCertificate = async (values: z.infer<typeof formSchema>) => {
        if (!token) {
            toast({ variant: "destructive", title: "Error", description: "Database not available." });
            return;
        }
        try {
            const trimmed = values.name.trim();
            await createCertificateTypeRequest(token, { name: trimmed });
            const updated = await listCertificateTypesRequest(token);
            setCertificateTypes((updated as CertificateType[]).sort((a, b) => a.name.localeCompare(b.name)));
            toast({ title: "Certificate Type Added", description: `"${trimmed}" has been added.` });
            form.reset();
        } catch (error: any) {
            console.error("Error adding certificate type: ", error);
            toast({ variant: "destructive", title: "Creation Error", description: error.message || "Could not add certificate type." });
        }
    };

    const handleDeleteCertificate = async (certId: string, certName: string) => {
        if (!token) {
            toast({ variant: "destructive", title: "Error", description: "Database not available." });
            return;
        }
        try {
            await deleteCertificateTypeRequest(token, certId);
            const updated = await listCertificateTypesRequest(token);
            setCertificateTypes((updated as CertificateType[]).sort((a, b) => a.name.localeCompare(b.name)));
            toast({ title: "Certificate Type Deleted", description: `"${certName}" has been removed.` });
        } catch (error: any) {
            console.error("Error deleting certificate type: ", error);
            toast({ variant: "destructive", title: "Deletion Error", description: error.message || "Could not remove certificate type." });
        }
    };

    const handleRenameCertificate = async () => {
        if (!token || !editingCert) return;
        const nextName = editedName.trim();
        if (!nextName) return;
        try {
            await updateCertificateTypeRequest(token, editingCert.id, { name: nextName });
            const updated = await listCertificateTypesRequest(token);
            setCertificateTypes((updated as CertificateType[]).sort((a, b) => a.name.localeCompare(b.name)));
            toast({ title: "Certificate Updated", description: "Certificate name updated." });
            setIsEditOpen(false);
        } catch (error: any) {
            console.error("Error renaming certificate type: ", error);
            toast({ variant: "destructive", title: "Update Error", description: error.message || "Could not update certificate type." });
        }
    };
    
    if (authLoading || !firestoreUser) {
        return <div>Loading...</div>;
    }

    if (!isAuthorized) {
        return <UnauthorizedComponent />;
    }

    return (
        <>
        <div className="space-y-4 md:space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Certificate Management</h1>
                <p className="text-muted-foreground">Manage the types of certificates available in the system.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Certificate Types</CardTitle>
                            <CardDescription>This is a list of all certificate types that can be required by sites or attached to user profiles.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center">
                                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : certificateTypes.length > 0 ? (
                                        certificateTypes.map((cert) => (
                                            <TableRow key={cert.id}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                    <FileBadge className="h-4 w-4 text-muted-foreground"/>
                                                    {cert.name}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">Actions</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onSelect={() => {
                                                                    setEditingCert(cert);
                                                                    setEditedName(cert.name);
                                                                    setIsEditOpen(true);
                                                                }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" /> Rename
                                                            </DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem
                                                                        onSelect={(event) => event.preventDefault()}
                                                                        className="text-destructive focus:text-destructive"
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Delete certificate?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This will remove "{cert.name}" if it is not required by any site.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteCertificate(cert.id, cert.name)}>
                                                                            Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center">
                                                No certificate types found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                     <Card>
                        <CardHeader>
                            <CardTitle>Add New Certificate Type</CardTitle>
                            <CardDescription>Create a new type of certificate that can be used across the application.</CardDescription>
                        </CardHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAddCertificate)}>
                                <CardContent className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Certificate Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., Hot Work Permit" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Certificate
                                    </Button>
                                </CardFooter>
                            </form>
                        </Form>
                    </Card>
                </div>
            </div>
        </div>

        <Dialog
            open={isEditOpen}
            onOpenChange={(open) => {
                setIsEditOpen(open);
                if (!open) {
                    setEditingCert(null);
                    setEditedName('');
                }
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Rename Certificate</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Input
                        value={editedName}
                        onChange={(event) => setEditedName(event.target.value)}
                        placeholder="Certificate name"
                    />
                    <Button onClick={handleRenameCertificate} disabled={!editedName.trim()}>
                        Save
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
