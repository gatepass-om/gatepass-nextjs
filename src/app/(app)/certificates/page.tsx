
'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
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
import { FileBadge, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuthProtection } from '@/hooks/use-auth-protection';

const formSchema = z.object({
  name: z.string().min(3, { message: "Certificate name must be at least 3 characters." }),
});

export default function CertificatesPage() {
    const { firestoreUser, loading: authLoading, isAuthorized, UnauthorizedComponent } = useAuthProtection(['Admin']);
    const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const firestore = useFirestore();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "" },
    });

    useEffect(() => {
        if (!firestore || !firestoreUser) return;
        setLoading(true);
        const unsubscribe = onSnapshot(collection(firestore, "certificateTypes"), (snapshot) => {
            const certsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CertificateType));
            setCertificateTypes(certsData.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, firestoreUser]);

    const handleAddCertificate = async (values: z.infer<typeof formSchema>) => {
        if (!firestore) {
            toast({ variant: "destructive", title: "Error", description: "Database not available." });
            return;
        }
        try {
            await addDoc(collection(firestore, "certificateTypes"), {
                name: values.name,
                createdAt: serverTimestamp()
            });
            toast({ title: "Certificate Type Added", description: `"${values.name}" has been added.` });
            form.reset();
        } catch (error) {
            console.error("Error adding certificate type: ", error);
            toast({ variant: "destructive", title: "Creation Error", description: "Could not add certificate type." });
        }
    };

    const handleDeleteCertificate = async (certId: string, certName: string) => {
        if (!firestore) {
            toast({ variant: "destructive", title: "Error", description: "Database not available." });
            return;
        }
        // TODO: Add a check to see if this certificate is in use by any site before deleting.
        try {
            await deleteDoc(doc(firestore, "certificateTypes", certId));
            toast({ title: "Certificate Type Deleted", description: `"${certName}" has been removed.` });
        } catch (error) {
            console.error("Error deleting certificate type: ", error);
            toast({ variant: "destructive", title: "Deletion Error", description: "Could not remove certificate type." });
        }
    };
    
    if (authLoading || !firestoreUser) {
        return <div>Loading...</div>;
    }

    if (!isAuthorized) {
        return <UnauthorizedComponent />;
    }

    return (
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
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteCertificate(cert.id, cert.name)}>
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="sr-only">Delete</span>
                                                    </Button>
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
    );
}
