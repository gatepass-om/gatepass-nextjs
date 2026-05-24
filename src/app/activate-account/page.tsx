'use client';

import { ShieldCheck, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { activateRequest } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import { useEffect } from 'react';

const formSchema = z.object({
  newPassword: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

export default function ActivateAccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { token, setSession, user, loading } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!loading && user && user.status === 'Active') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleActivation = async (values: z.infer<typeof formSchema>) => {
    if (!token) {
      toast({ variant: 'destructive', title: 'Session Missing', description: 'Please log in again before activating your account.' });
      router.push('/login');
      return;
    }

    try {
      const result = await activateRequest({ token, newPassword: values.newPassword });
      setSession(result.token, result.user);
      toast({ title: 'Account Activated!', description: 'Your password has been updated.' });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Account Activation Error', error);
      toast({ variant: 'destructive', title: 'Activation Failed', description: error.message || 'Could not update your password.' });
    }
  };

  if (loading) {
    return <div className="h-svh w-full bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center bg-primary rounded-2xl">
              <KeyRound className="text-primary-foreground h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-2xl">Activate Your Account</CardTitle>
          <CardDescription>To secure your account, please create a new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleActivation)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Activating...' : 'Set Password and Activate'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
