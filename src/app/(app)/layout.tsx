
"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  CalendarDays,
  Settings,
  Bell,
  LogOut,
  Search as SearchIcon,
  LifeBuoy,
  ArrowLeftIcon,
  ChevronDown,
  Activity,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { collection, query, where, onSnapshot, or, Timestamp } from "firebase/firestore";
import type { Project } from "@/app/(app)/projects/page";
import type { TaskListItem } from "@/app/(app)/tasks/page";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

interface SearchResultItem {
  id: string;
  name: string;
  type: "project" | "task";
  href: string;
  category?: string; // e.g., project name for a task
  icon: React.ElementType;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const isMobile = useIsMobile();

  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [isGlobalSearchPopoverOpen, setIsGlobalSearchPopoverOpen] = useState(false);
  const [globalProjects, setGlobalProjects] = useState<Project[]>([]);
  const [globalTasks, setGlobalTasks] = useState<TaskListItem[]>([]);
  const [isFetchingGlobalData, setIsFetchingGlobalData] = useState(true);


  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (user && user.email) {
      setIsFetchingGlobalData(true);
      let projectsUnsubscribe: (() => void) | null = null;
      let tasksUnsubscribe: (() => void) | null = null;
      let projectLoadComplete = false;
      let taskLoadComplete = false;

      const checkAllDataLoaded = () => {
        if (projectLoadComplete && taskLoadComplete) {
          setIsFetchingGlobalData(false);
        }
      };
      
      const projectsCol = collection(db, "projects");
      const qProjects = query(projectsCol, where("memberEmails", "array-contains", user.email));
      projectsUnsubscribe = onSnapshot(qProjects, (snapshot) => {
        const fetchedProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setGlobalProjects(fetchedProjects);
        projectLoadComplete = true;
        checkAllDataLoaded();
      }, (error) => {
        console.error("Error fetching global projects: ", error);
        projectLoadComplete = true;
        checkAllDataLoaded();
      });

      const tasksCol = collection(db, "tasks");
      const qTasks = query(tasksCol, or(where("ownerId", "==", user.uid), where("assigneeEmails", "array-contains", user.email)));
      tasksUnsubscribe = onSnapshot(qTasks, (snapshot) => {
        const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskListItem));
        setGlobalTasks(fetchedTasks);
        taskLoadComplete = true;
        checkAllDataLoaded();
      }, (error) => {
        console.error("Error fetching global tasks: ", error);
        taskLoadComplete = true;
        checkAllDataLoaded();
      });
      
      // Fallback to hide loader if data doesn't arrive in time
      const initialLoadTimeout = setTimeout(() => {
        if (isFetchingGlobalData) { // only if still fetching
           setIsFetchingGlobalData(false);
        }
      }, 3000); 

      return () => {
        if (projectsUnsubscribe) projectsUnsubscribe();
        if (tasksUnsubscribe) tasksUnsubscribe();
        clearTimeout(initialLoadTimeout);
      };
    } else if (!loading && !user) { // If user is not logged in and auth is not loading
      setIsFetchingGlobalData(false);
      setGlobalProjects([]);
      setGlobalTasks([]);
    }
  }, [user, loading]);


  const globalSearchResults = useMemo((): SearchResultItem[] => {
    if (!globalSearchTerm.trim()) return [];
    const term = globalSearchTerm.toLowerCase();

    const projectResults: SearchResultItem[] = globalProjects
      .filter(p => p.name.toLowerCase().includes(term))
      .map(p => ({
        id: p.id,
        name: p.name,
        type: "project",
        href: `/projects/${p.id}/overview`,
        icon: FolderKanban,
      }));

    const taskResults: SearchResultItem[] = globalTasks
      .filter(t => t.title.toLowerCase().includes(term))
      .map(t => ({
        id: t.id,
        name: t.title,
        type: "task",
        href: `/tasks/${t.id}`,
        category: t.projectName,
        icon: ListChecks,
      }));

    return [...projectResults, ...taskResults].slice(0, 10); // Limit total results
  }, [globalSearchTerm, globalProjects, globalTasks]);

  useEffect(() => {
    setIsGlobalSearchPopoverOpen(globalSearchTerm.length > 0 && globalSearchResults.length > 0 && !isFetchingGlobalData);
  }, [globalSearchTerm, globalSearchResults, isFetchingGlobalData]);


  const handleGlobalSearchSelect = (item: SearchResultItem) => {
    router.push(item.href);
    setGlobalSearchTerm("");
    setIsGlobalSearchPopoverOpen(false);
    if(isMobile) setIsMobileSearchOpen(false);
  };

  if (loading || (!user && !pathname.startsWith('/login') && !pathname.startsWith('/signup') && !pathname.startsWith('/forgot-password') && pathname !== '/')) {
    return <div className="flex h-screen items-center justify-center bg-background"><p>Loading application...</p></div>;
  }
  
  if (!user && (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password') || pathname === '/')) {
     // Render children directly for auth pages or landing if no user and not loading
     return <>{children}</>;
  }
  
  if (!user) return null; // Should be caught by the redirect above, but as a fallback


  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const userDisplayName = user.displayName || "User";
  const [firstName, ...lastNameParts] = userDisplayName.split(" ");
  const lastName = lastNameParts.join(" ");


  const SearchPopoverContent = () => (
    <PopoverContent
      className="w-[--radix-popover-trigger-width] p-0 mt-1"
      align="start"
      onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing
    >
      <Command>
        <CommandList>
          {(isFetchingGlobalData && !globalSearchResults.length) && <CommandEmpty>Loading results...</CommandEmpty>}
          {(!isFetchingGlobalData && globalSearchResults.length === 0 && globalSearchTerm) && <CommandEmpty>No results found for "{globalSearchTerm}".</CommandEmpty>}
          
          {globalProjects.filter(p => p.name.toLowerCase().includes(globalSearchTerm.toLowerCase())).length > 0 && (
            <CommandGroup heading="Projects">
              {globalSearchResults.filter(item => item.type === 'project').map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.type}-${item.name}`} // Ensure unique value for CMDK
                  onSelect={() => handleGlobalSearchSelect(item)}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {globalTasks.filter(t => t.title.toLowerCase().includes(globalSearchTerm.toLowerCase())).length > 0 && (
            <CommandGroup heading="Tasks">
              {globalSearchResults.filter(item => item.type === 'task').map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.type}-${item.name}`} // Ensure unique value for CMDK
                  onSelect={() => handleGlobalSearchSelect(item)}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                    {item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </PopoverContent>
  );


  if (isMobile && isMobileSearchOpen) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 whitespace-nowrap border-b border-border bg-background px-4 py-3 shadow-sm sm:px-6 lg:px-10">
          <Button variant="ghost" size="icon" onClick={() => setIsMobileSearchOpen(false)} className="h-9 w-9">
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div className="relative flex-1">
             <Popover open={isGlobalSearchPopoverOpen && globalSearchTerm.length > 0} onOpenChange={setIsGlobalSearchPopoverOpen}>
                <PopoverAnchor>
                    <Input
                        type="search"
                        placeholder="Search projects, tasks..."
                        className="h-9 w-full rounded-md bg-secondary focus:ring-0 border-none focus:border-none"
                        autoFocus
                        value={globalSearchTerm}
                        onChange={(e) => setGlobalSearchTerm(e.target.value)}
                        onFocus={() => setIsGlobalSearchPopoverOpen(globalSearchTerm.length > 0 && globalSearchResults.length > 0 && !isFetchingGlobalData)}
                    />
                </PopoverAnchor>
                {globalSearchResults.length > 0 && !isFetchingGlobalData && <SearchPopoverContent />}
            </Popover>
          </div>
        </header>
        <main className="flex-1 py-5 mb-16 md:mb-0">
            <div className="container mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
                {children}
            </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header
        className={cn(
          "sticky top-0 z-30 flex h-16 items-center justify-between whitespace-nowrap px-4 transition-all duration-300 ease-in-out sm:px-6 lg:px-10 py-3",
          isScrolled
            ? "bg-background shadow-md border-b border-border"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="flex items-center gap-3 sm:gap-8">
          <Link href="/" className="flex items-center gap-2.5 text-foreground">
            <Icons.ProjectFlowLogo className="h-6 w-auto text-primary" />
            <span className="text-base font-semibold tracking-tight hidden sm:inline">StreamFlow</span>
          </Link>
          <nav className="hidden items-center gap-4 xl:gap-7 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "text-sm font-medium leading-normal transition-colors hover:text-primary",
                  pathname.startsWith(item.href)
                    ? "text-primary font-semibold"
                    : "text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
          <div className="relative hidden h-9 max-w-xs items-center sm:flex">
            <Popover open={isGlobalSearchPopoverOpen && globalSearchTerm.length > 0} onOpenChange={setIsGlobalSearchPopoverOpen}>
                <PopoverAnchor>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <SearchIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input
                            type="search"
                            placeholder="Search projects, tasks..."
                            className="h-full rounded-md bg-secondary pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:ring-0 border-none focus:border-none"
                            value={globalSearchTerm}
                            onChange={(e) => setGlobalSearchTerm(e.target.value)}
                            onFocus={() => setIsGlobalSearchPopoverOpen(globalSearchTerm.length > 0 && globalSearchResults.length > 0 && !isFetchingGlobalData)}
                        />
                    </div>
                </PopoverAnchor>
                 {globalSearchResults.length > 0 && !isFetchingGlobalData && <SearchPopoverContent />}
            </Popover>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-md bg-secondary text-foreground hover:bg-secondary/80 sm:hidden"
            onClick={() => setIsMobileSearchOpen(true)}
          >
            <SearchIcon className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md bg-secondary text-foreground hover:bg-secondary/80">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="font-semibold">Notifications & Activity</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Placeholder for actual notifications */}
              <DropdownMenuItem disabled>
                <div className="py-4 text-center text-sm text-muted-foreground">No new notifications.</div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
               <DropdownMenuItem asChild>
                <Link href="/notifications" className="cursor-pointer flex items-center">
                  <Eye className="mr-2 h-4 w-4" /> View All Notifications
                </Link>
              </DropdownMenuItem>
               <DropdownMenuItem asChild>
                <Link href="/notifications" className="cursor-pointer flex items-center"> {/* Placeholder for activity feed */}
                  <Activity className="mr-2 h-4 w-4" /> View Recent Activity
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <UserAvatar firstName={firstName} lastName={lastName} className="h-9 w-9" email={user.email} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userDisplayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/support" className="cursor-pointer">
                  <LifeBuoy className="mr-2 h-4 w-4" /> Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
        <div className="flex h-16 items-center justify-around">
        {navItems.slice(0, 5).map((item) => (
            <Link
            key={`mobile-${item.label}`}
            href={item.href}
            className={cn(
                "flex flex-col items-center rounded-md px-2 py-1 text-xs font-medium transition-colors w-[calc(20%-0.5rem)]",
                pathname.startsWith(item.href)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            >
            <item.icon className="h-5 w-5 mb-0.5" />
            {item.label}
            </Link>
        ))}
        </div>
      </nav>

      <main className="flex-1 py-5 mb-16 md:mb-0">
        <div className="container mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            {children}
        </div>
      </main>
    </div>
  );
}
