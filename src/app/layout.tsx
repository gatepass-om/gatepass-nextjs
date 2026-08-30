import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from '@/providers/session-provider';
import { LiveEventsProvider } from '@/providers/live-events-provider';

export const metadata: Metadata = {
  title: 'GatePass',
  description: 'Streamlined Access Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-body antialiased">
          <SessionProvider>
            <LiveEventsProvider>
              {children}
            </LiveEventsProvider>
          </SessionProvider>
          <Toaster />
      </body>
    </html>
  );
}
