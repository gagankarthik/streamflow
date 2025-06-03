
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card"; // Card is used for the filter bar container
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { CreateProjectForm } from "@/components/forms/create-project-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { PlusCircle, FolderKanban, Users, CalendarDays, Filter as FilterIcon, ListFilter, FolderPlus, Search as SearchIcon, ChevronDown, Check, GanttChartSquare, BarChartHorizontalBig, Eye } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { format, isPast, isToday, isThisWeek, startOfWeek, endOfWeek, addWeeks, parseISO, isValid, endOfDay } from 'date-fns';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import type { Assignee } from "@/components/forms/create-task-form";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  memberEmails?: string[];
  team?: Assignee[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  status: "To Do" | "In Progress" | "Completed" | "On Hold";
  progress: number;
  teamSize?: number;
  deadline?: string;
  imageUrl?: string;
  aiHint?: string;
}

type SortOption = "updatedAt-desc" | "updatedAt-asc" | "name-asc" | "name-desc";
type StatusFilterOption = "all" | "To Do" | "In Progress" | "Completed" | "On Hold";
type DueDateFilterOption = "all" | "pastDue" | "dueToday" | "dueThisWeek" | "dueNextWeek" | "noDeadline";
type ProgressFilterOption = "all" | "notStarted" | "earlyStage" | "midStage" | "lateStage" | "completed";


const getStatusBadgeClasses = (status?: Project["status"]): string => {
  switch (status) {
    case "Completed":
      return "bg-green-100 text-green-700 border-green-300";
    case "In Progress":
      return "bg-blue-100 text-blue-700 border-blue-300";
    case "To Do":
      return "bg-purple-100 text-purple-700 border-purple-300";
    case "On Hold":
      return "bg-yellow-100 text-yellow-700 border-yellow-300";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
};


export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updatedAt-desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("all");
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilterOption>("all");
  const [progressFilter, setProgressFilter] = useState<ProgressFilterOption>("all");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);


  useEffect(() => {
    if (user && user.email) {
      setIsLoadingProjects(true);
      const projectsCol = collection(db, "projects");
      const q = query(projectsCol, where("memberEmails", "array-contains", user.email));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProjects = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            ownerName: data.ownerName || data.ownerEmail?.split('@')[0] || "Owner",
            team: data.team || [],
            createdAt: data.createdAt || Timestamp.now(),
            updatedAt: data.updatedAt,
          } as Project;
        });
        setProjects(fetchedProjects);
        setIsLoadingProjects(false);
      }, (error) => {
        console.error("Error fetching projects: ", error);
        setProjects([]);
        setIsLoadingProjects(false);
      });

      return () => unsubscribe();
    } else {
      setProjects([]);
      setIsLoadingProjects(false);
    }
  }, [user]);

  const suggestedProjects = useMemo(() => {
    if (!searchTerm.trim()) {
      return [];
    }
    return projects
      .filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 5); // Limit to 5 suggestions
  }, [projects, searchTerm]);

  useEffect(() => {
    if (searchTerm.trim().length > 0 && suggestedProjects.length > 0) {
      setIsSuggestionsOpen(true);
    } else {
      setIsSuggestionsOpen(false);
    }
  }, [searchTerm, suggestedProjects]);


  const processedProjects = useMemo(() => {
    let tempProjects = [...projects];
    const today = endOfDay(new Date());

    if (statusFilter !== "all") {
      tempProjects = tempProjects.filter(project => project.status === statusFilter);
    }

    if (dueDateFilter !== "all") {
        tempProjects = tempProjects.filter(project => {
            if (!project.deadline) return dueDateFilter === "noDeadline";
            if (dueDateFilter === "noDeadline") return false;

            try {
                const deadlineDate = parseISO(project.deadline);
                if (!isValid(deadlineDate)) return false;

                if (dueDateFilter === "pastDue") return isPast(deadlineDate) && !isToday(deadlineDate) && project.status !== "Completed";
                if (dueDateFilter === "dueToday") return isToday(deadlineDate);
                if (dueDateFilter === "dueThisWeek") return isThisWeek(deadlineDate, { weekStartsOn: 1 });

                const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
                const startOfNextWeek = addWeeks(startOfThisWeek, 1);
                const endOfNextWeek = endOfWeek(startOfNextWeek, { weekStartsOn: 1 });
                if (dueDateFilter === "dueNextWeek") return deadlineDate >= startOfNextWeek && deadlineDate <= endOfNextWeek;

            } catch (e) { return false; }
            return true;
        });
    }

    if (progressFilter !== "all") {
        tempProjects = tempProjects.filter(project => {
            const progress = project.progress;
            if (progressFilter === "notStarted") return progress === 0;
            if (progressFilter === "earlyStage") return progress > 0 && progress <= 25;
            if (progressFilter === "midStage") return progress > 25 && progress <= 75;
            if (progressFilter === "lateStage") return progress > 75 && progress < 100;
            if (progressFilter === "completed") return progress === 100;
            return true;
        });
    }

    if (searchTerm) {
      tempProjects = tempProjects.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    switch (sortOption) {
      case "name-asc":
        tempProjects.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        tempProjects.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "updatedAt-asc":
        tempProjects.sort((a, b) => (a.updatedAt || a.createdAt).toMillis() - (b.updatedAt || b.createdAt).toMillis());
        break;
      case "updatedAt-desc":
      default:
        tempProjects.sort((a, b) => (b.updatedAt || b.createdAt).toMillis() - (a.updatedAt || a.createdAt).toMillis());
        break;
    }
    return tempProjects;
  }, [projects, searchTerm, statusFilter, sortOption, dueDateFilter, progressFilter]);

  const handleProjectCreated = (projectId: string) => {
    setIsCreateProjectDialogOpen(false);
  };

  const formatDate = (timestamp?: Timestamp | string): string => {
    if (!timestamp) return "N/A";
    try {
      let dateToFormat: Date;
      if (timestamp instanceof Timestamp) {
        dateToFormat = timestamp.toDate();
      } else if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
        const [year, month, day] = timestamp.split('-').map(Number);
        dateToFormat = new Date(Date.UTC(year, month - 1, day));
      } else if (typeof timestamp === 'string') {
        dateToFormat = new Date(timestamp);
      } else {
        return "Invalid Date Input";
      }

      if (!isValid(dateToFormat)) return "Invalid Date";
      return format(dateToFormat, "MMM dd, yyyy");
    } catch (e) {
      console.warn("Date formatting error for value:", timestamp, e);
      return "N/A";
    }
  };

  const handleSuggestionSelect = (projectName: string) => {
    setSearchTerm(projectName);
    setIsSuggestionsOpen(false);
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        actions={
          <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FolderPlus className="h-5 w-5" />
                  Create New Project
                </DialogTitle>
                <DialogDescription>
                  Fill in the details below to start a new project. Required fields are marked with an asterisk (*).
                </DialogDescription>
              </DialogHeader>
              <CreateProjectForm
                onDialogOpenChange={setIsCreateProjectDialogOpen}
                onFormSubmitSuccess={handleProjectCreated}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-4 shadow">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full flex-grow md:max-w-md">
                <Popover open={isSuggestionsOpen} onOpenChange={setIsSuggestionsOpen}>
                    <PopoverAnchor asChild>
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search projects by name..."
                                className="h-10 rounded-md bg-secondary pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:ring-0 border-none focus:border-none w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => {
                                    if (searchTerm.trim().length > 0 && suggestedProjects.length > 0) {
                                        setIsSuggestionsOpen(true);
                                    }
                                }}
                            />
                        </div>
                    </PopoverAnchor>
                    {suggestedProjects.length > 0 && (
                        <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0 mt-1"
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <Command>
                                <CommandList>
                                    <CommandGroup heading="Suggestions">
                                        {suggestedProjects.map((project) => (
                                        <CommandItem
                                            key={project.id}
                                            value={project.name}
                                            onSelect={() => handleSuggestionSelect(project.name)}
                                            className="cursor-pointer"
                                        >
                                            {project.name}
                                        </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    )}
                </Popover>
            </div>
            <div className="flex gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="h-10 w-full md:w-auto">
                        <ListFilter className="mr-2 h-4 w-4 text-muted-foreground" /> Sort <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                      <DropdownMenuRadioItem value="updatedAt-desc">Last Updated (Newest)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="updatedAt-asc">Last Updated (Oldest)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name-asc">Project Name (A-Z)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name-desc">Project Name (Z-A)</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="h-10 w-full md:w-auto">
                        <FilterIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Filter <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilterOption)}>
                      <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="To Do">To Do</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="In Progress">In Progress</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="Completed">Completed</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="On Hold">On Hold</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="secondary" className="h-10 w-full md:w-auto">
                            <GanttChartSquare className="mr-2 h-4 w-4 text-muted-foreground" /> Advanced <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Advanced Filters</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <CalendarDays className="mr-2 h-4 w-4" /> Filter by Due Date
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={dueDateFilter} onValueChange={(value) => setDueDateFilter(value as DueDateFilterOption)}>
                                    <DropdownMenuRadioItem value="all">All Due Dates</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="noDeadline">No Deadline</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="pastDue">Past Due</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="dueToday">Due Today</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="dueThisWeek">Due This Week</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="dueNextWeek">Due Next Week</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                               <BarChartHorizontalBig className="mr-2 h-4 w-4" /> Filter by Progress
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                 <DropdownMenuRadioGroup value={progressFilter} onValueChange={(value) => setProgressFilter(value as ProgressFilterOption)}>
                                    <DropdownMenuRadioItem value="all">All Progress</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="notStarted">Not Started (0%)</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="earlyStage">Early Stage (1-25%)</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="midStage">Mid Stage (26-75%)</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="lateStage">Late Stage (76-99%)</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="completed">Completed (100%)</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
      </Card>
      
      <div className="mt-6">
        <div className="overflow-x-auto rounded-lg border bg-card shadow">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-card">
                        <TableHead className="w-[30%] px-4 py-3">Project Name</TableHead>
                        <TableHead className="w-[12%] px-4 py-3 hidden sm:table-cell">Status</TableHead>
                        <TableHead className="w-[18%] px-4 py-3">Progress</TableHead>
                        <TableHead className="w-[15%] px-4 py-3 hidden md:table-cell">Deadline</TableHead>
                        <TableHead className="w-[15%] px-4 py-3 hidden lg:table-cell">Team</TableHead>
                        <TableHead className="w-[10%] px-4 py-3 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoadingProjects ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                <div className="flex justify-center items-center">
                                <LoadingSpinner size={24} />
                                <p className="ml-2 text-muted-foreground">Loading projects...</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : processedProjects.length > 0 ? (
                        processedProjects.map((project) => (
                            <TableRow key={project.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium px-4 py-3">
                                    <Link href={`/projects/${project.id}/overview`} className="hover:text-primary line-clamp-1" title={project.name}>
                                        {project.name}
                                    </Link>
                                     {project.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                            {project.description}
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell className="px-4 py-3 hidden sm:table-cell">
                                    <Badge variant="outline" className={cn("text-xs px-2 py-0.5 h-5 min-w-[80px] flex items-center justify-center", getStatusBadgeClasses(project.status))}>
                                        {project.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center">
                                        <Progress value={project.progress || 0} className="h-2.5 w-full sm:w-24 flex-grow" indicatorClassName="bg-primary rounded-sm" />
                                        <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">{project.progress || 0}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground px-4 py-3 hidden md:table-cell">{formatDate(project.deadline) || "N/A"}</TableCell>
                                <TableCell className="px-4 py-3 hidden lg:table-cell">
                                    <div className="flex -space-x-2">
                                        {project.team && project.team.length > 0 ? (
                                        project.team.slice(0, 3).map(member => (
                                            <UserAvatar
                                            key={member.email}
                                            fullName={member.name}
                                            email={member.email}
                                            className="h-6 w-6 text-xs border-2 border-card hover:z-10"
                                            />
                                        ))
                                        ) : (
                                        project.ownerEmail && ( 
                                            <UserAvatar
                                            fullName={project.ownerName}
                                            email={project.ownerEmail}
                                            className="h-6 w-6 text-xs border-2 border-card hover:z-10"
                                            />
                                        )
                                        )}
                                        {project.team && project.team.length > 3 && (
                                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs border-2 border-card">
                                            +{project.team.length - 3}
                                        </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-right">
                                    <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                                        <Link href={`/projects/${project.id}/overview`}>
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">View Project</span>
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                <div className="flex flex-col items-center justify-center py-10">
                                    <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                    <p className="text-lg font-medium text-foreground mb-1">
                                        {searchTerm || statusFilter !== 'all' || dueDateFilter !== 'all' || progressFilter !== 'all' ? "No projects match your criteria." : "No projects yet."}
                                    </p>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        {searchTerm || statusFilter !== 'all' || dueDateFilter !== 'all' || progressFilter !== 'all' ? "Try adjusting your search or filters." : "Get started by creating your first project!"}
                                    </p>
                                    {!(searchTerm || statusFilter !== 'all' || dueDateFilter !== 'all' || progressFilter !== 'all') && (
                                        <Button onClick={() => setIsCreateProjectDialogOpen(true)} size="sm">
                                            <PlusCircle className="mr-2 h-4 w-4" /> Create Project
                                        </Button>
                                    )}
                                    {(searchTerm || statusFilter !== 'all' || dueDateFilter !== 'all' || progressFilter !== 'all') && (
                                        <Button variant="outline" onClick={() => { setSearchTerm(""); setStatusFilter("all"); setDueDateFilter("all"); setProgressFilter("all");}} size="sm">
                                            Clear All Filters
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
      </div>
    </div>
  );
}

    
