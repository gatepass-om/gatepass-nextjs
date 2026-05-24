'use client';

import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useSession } from '@/providers/session-provider';
import type { UserRole } from '@/lib/types';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

const getHomepageForRole = (role?: UserRole): string => {
  switch (role) {
    case 'Contractor Admin':
      return '/access-requests';
    default:
      return '/dashboard';
  }
};

export default function LoginPage() {
  const router = useRouter();
  const { login, user: sessionUser, loading: sessionLoading } = useSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (sessionLoading) return;
    if (sessionUser) {
      if (sessionUser.status === 'Inactive') {
        router.push('/activate-account');
      } else {
        router.push(getHomepageForRole(sessionUser.role));
      }
    }
  }, [sessionUser, sessionLoading, router]);

  const handleSignIn = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const user = await login({ email: values.email, password: values.password });
      if (user.status === 'Inactive') {
        router.push('/activate-account');
        toast({ title: 'Account Inactive', description: 'Please set a password to activate your account.' });
      } else {
        router.push(getHomepageForRole(user.role));
        toast({ title: 'Login Successful', description: 'Welcome back!' });
      }
    } catch (error: any) {
      console.error('Authentication Error', error);
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message || 'Invalid email or password. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionLoading) {
    return <div className="h-svh w-full bg-background" />;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center bg-primary rounded-2xl">
              <ShieldCheck className="text-primary-foreground h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to GatePass</CardTitle>
          <CardDescription>Sign in to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignIn)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@gatepass.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
