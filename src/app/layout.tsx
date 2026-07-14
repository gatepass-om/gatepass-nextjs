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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
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
