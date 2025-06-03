
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

export const metadata: Metadata = {
  title: 'StreamFlow - Effortless Project Management',
  description: 'StreamFlow: The simple and elegant SaaS for managing your projects with clarity and ease. Boost productivity and collaboration. Try it free!',
  keywords: ['project management', 'task management', 'team collaboration', 'saas', 'productivity tool', 'StreamFlow', 'simple project tool'],
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground dark:bg-oxford_blue-500 dark:text-tan-900">
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 dark:border-prussian_blue-300/50 dark:bg-oxford_blue-500/80">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Icons.ProjectFlowLogo className="h-7 w-auto text-primary dark:text-cambridge_blue-600" />
            <span className="text-xl font-semibold tracking-tight landing-page-gradient-text">StreamFlow</span>
          </Link>
          <nav className="hidden items-center space-x-2 md:flex">
            <Button variant="ghost" asChild className="text-foreground hover:text-primary dark:text-tan-800 dark:hover:text-cambridge_blue-600">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-medium dark:bg-cambridge_blue-600 dark:hover:bg-cambridge_blue-700 dark:text-oxford_blue-100">
              <Link href="/signup">Try it Free</Link>
            </Button>
          </nav>
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground dark:text-tan-800">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-6 bg-background dark:bg-oxford_blue-400 dark:border-prussian_blue-300">
                <SheetHeader className="mb-6 text-left">
                  <SheetTitle>
                    <Link href="/" className="flex items-center gap-2.5">
                      <Icons.ProjectFlowLogo className="h-7 w-auto text-primary dark:text-cambridge_blue-600" />
                      <span className="text-xl font-semibold tracking-tight landing-page-gradient-text">StreamFlow</span>
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col space-y-3">
                  <Button variant="outline" asChild className="w-full justify-start px-4 py-2 text-base border-border text-foreground hover:bg-secondary dark:border-prussian_blue-300 dark:text-tan-800 dark:hover:bg-prussian_blue-300">
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild className="w-full justify-start px-4 py-2 text-base bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-cambridge_blue-600 dark:hover:bg-cambridge_blue-700 dark:text-oxford_blue-100">
                    <Link href="/signup">Try it Free</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 bg-background py-10 text-card-foreground dark:border-prussian_blue-300/50 dark:bg-oxford_blue-500">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 text-center sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Icons.ProjectFlowLogo className="h-6 w-auto text-primary dark:text-cambridge_blue-600" />
            <span className="text-md font-semibold text-foreground dark:text-tan-800">StreamFlow</span>
          </div>
          <p className="text-sm text-muted-foreground dark:text-tan-700">
            &copy; {new Date().getFullYear()} StreamFlow Inc. All rights reserved.
          </p>
          <nav className="flex space-x-4">
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors dark:text-tan-700 dark:hover:text-cambridge_blue-600">
              Privacy
            </Link>
            <Link href="/terms-of-service" className="text-sm text-muted-foreground hover:text-primary transition-colors dark:text-tan-700 dark:hover:text-cambridge_blue-600">
              Terms
            </Link>
            <Link href="/support" className="text-sm text-muted-foreground hover:text-primary transition-colors dark:text-tan-700 dark:hover:text-cambridge_blue-600">
              Support
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
