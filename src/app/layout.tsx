
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseAuthProvider } from "@/contexts/auth-context";
import { QueryClientProvider } from "@/lib/react-query.tsx";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'StreamFlow - Simplify Your Workflow',
  description: 'StreamFlow helps you manage projects, tasks, and teams with ease. Features Kanban boards, bug tracking, and AI-powered summaries for ultimate productivity.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/_next/static/media/geist-sans-vietnamese-subset.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/_next/static/media/geist-mono-vietnamese-subset.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <QueryClientProvider>
          <FirebaseAuthProvider>
            {children}
            <Toaster />
          </FirebaseAuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
