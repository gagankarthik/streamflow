
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, orderBy, or, updateDoc, doc, serverTimestamp, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CreateTaskForm, type Assignee } from "@/components/forms/create-task-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { PlusCircle, ListChecks, Search as SearchIcon, Eye, Filter as FilterIcon, ChevronDown, CalendarDays, Briefcase, Tag as PriorityTagIcon, LayoutList, Columns, KanbanSquare, Edit2, Loader2, XCircle, Check } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { UserAvatar } from "@/components/user-avatar";
import { format, isValid, parseISO, isPast, isToday, isThisWeek, startOfWeek, endOfWeek, addWeeks, endOfDay } from 'date-fns';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Project } from "@/app/(app)/projects/page";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { useQuery } from '@tanstack/react-query';

export interface TaskListItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  projectId?: string;
  projectName?: string;
  ownerId: string;
  assignees?: Assignee[];
  assigneeEmails?: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

type StatusFilterOption = "all" | "To Do" | "Planning" | "In Progress" | "Completed" | "On Hold";
type PriorityFilterOption = "all" | "Low" | "Medium" | "High" | "Critical";
type ProjectFilterOption = string;
type DueDateFilterOption = "all" | "overdue" | "dueToday" | "dueThisWeek" | "dueNextWeek" | "noDeadline";
type ViewMode = "list" | "table" | "kanban";

const TASK_STATUS_OPTIONS = ["To Do", "Planning", "In Progress", "Completed", "On Hold"] as const;

const TASK_STATUS_COLUMNS_KANBAN: { title: string; id: TaskListItem['status']; colorClass: string }[] = [
  { title: "To Do", id: "To Do", colorClass: "border-purple-500/50" },
  { title: "Planning", id: "Planning", colorClass: "border-sky-500/50" },
  { title: "In Progress", id: "In Progress", colorClass: "border-blue-500/50" },
  { title: "Completed", id: "Completed", colorClass: "border-green-500/50" },
  { title: "On Hold", id: "On Hold", colorClass: "border-yellow-500/50" },
];

// Utility functions moved outside the component
const getStatusPillClasses = (status?: string): string => {
  if (!status) return "bg-secondary text-secondary-foreground border-border";
  switch (status.toLowerCase()) {
    case "completed": return "bg-green-100 text-green-700 border-green-300";
    case "in progress": return "bg-blue-100 text-blue-700 border-blue-300";
    case "on hold": return "bg-yellow-100 text-yellow-700 border-yellow-300";
    case "to do": return "bg-purple-100 text-purple-700 border-purple-300";
    case "planning": return "bg-sky-100 text-sky-700 border-sky-300";
    default: return "bg-slate-100 text-slate-600 border-slate-300";
  }
};

const getPriorityPillClasses = (priority?: string): string => {
  if (!priority) return "bg-secondary text-secondary-foreground border-border";
  switch (priority.toLowerCase()) {
    case "critical": return "bg-red-600/10 text-red-700 border-red-600/30";
    case "high": return "bg-orange-500/10 text-orange-600 border-orange-500/30";
    case "medium": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/30";
    case "low": return "bg-green-500/10 text-green-700 border-green-500/30";
    default: return "bg-slate-100 text-slate-600 border-slate-300";
  }
};

const formatDate = (dateInput?: string | Timestamp): string => {
  if (!dateInput) return "N/A";
  try {
    let dateToFormat: Date;
    if (dateInput instanceof Timestamp) {
      dateToFormat = dateInput.toDate();
    } else if (typeof dateInput === 'string') {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
        ? parseISO(dateInput + 'T00:00:00Z')
        : parseISO(dateInput);
      if (!isValid(date)) return "Invalid Date";
      dateToFormat = date;
    } else {
      return "N/A";
    }
    return format(dateToFormat, "MMM dd, yyyy");
  } catch (e) {
    return "N/A";
  }
};

async function updateProjectProgress(projectId: string): Promise<void> {
  if (!projectId) {
    console.warn("updateProjectProgress called with no projectId");
    return;
  }
  try {
    const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", projectId));
    const tasksSnapshot = await getDocs(tasksQuery);
    let completedTasks = 0;
    const totalTasks = tasksSnapshot.size;
    if (totalTasks === 0) {
      await updateDoc(doc(db, "projects", projectId), { progress: 0, updatedAt: serverTimestamp() });
      console.log(`Project ${projectId} progress updated to 0% (no tasks).`);
      return;
    }
    tasksSnapshot.forEach(taskDoc => {
      if (taskDoc.data().status === "Completed") {
        completedTasks++;
      }
    });
    const progress = Math.round((completedTasks / totalTasks) * 100);
    await updateDoc(doc(db, "projects", projectId), { progress, updatedAt: serverTimestamp() });
    console.log(`Project ${projectId} progress updated to ${progress}%.`);
  } catch (error) {
    console.error(`Error updating project progress for ${projectId}:`, error);
    throw new Error(`Failed to update project progress. ${(error as Error).message}`);
  }
}

// Memoized Task Item Components
interface TaskCardItemProps {
  task: TaskListItem;
  isEditingStatus: boolean;
  isUpdatingStatus: boolean;
  onEditStatusClick: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string, projectId?: string) => Promise<void>;
  onCancelEditStatus: () => void;
}

const TaskCardItem = React.memo(function TaskCardItem({ task, isEditingStatus, isUpdatingStatus, onEditStatusClick, onStatusChange, onCancelEditStatus }: TaskCardItemProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">
          <Link href={`/tasks/${task.id}`} className="hover:text-primary line-clamp-2">{task.title}</Link>
        </CardTitle>
        {task.projectName && (
          <CardDescription className="text-xs">
            In Project: <Link href={`/projects/${task.projectId}/overview`} className="text-primary/80 hover:underline">{task.projectName}</Link>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Status:</span>
          {isEditingStatus ? (
            <div className="flex items-center gap-1">
              <Select
                defaultValue={task.status}
                onValueChange={async (newStatus) => await onStatusChange(task.id, newStatus, task.projectId)}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger className="h-7 text-xs w-[110px] bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map(col => (
                    <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isUpdatingStatus && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelEditStatus} disabled={isUpdatingStatus}>
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Badge
              variant="outline"
              className={cn("text-xs cursor-pointer hover:ring-1 hover:ring-primary/50", getStatusPillClasses(task.status))}
              onClick={() => { if (!isUpdatingStatus) onEditStatusClick(task.id); }}
            >
              {task.status}
            </Badge>
          )}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Priority:</span>
          <Badge variant="outline" className={cn("text-xs", getPriorityPillClasses(task.priority))}>{task.priority || "N/A"}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Due:</span>
          <span>{formatDate(task.dueDate)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Assignees:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {task.assignees && task.assignees.length > 0 ? (
              task.assignees.slice(0, 3).map(assignee => (
                <UserAvatar key={assignee.email} fullName={assignee.name} email={assignee.email} className="h-6 w-6 text-xs border border-card" />
              ))
            ) : (<span className="text-xs italic text-muted-foreground">Unassigned</span>)}
            {task.assignees && task.assignees.length > 3 && <Badge variant="secondary">+{task.assignees.length - 3}</Badge>}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" asChild className="w-full">
          <Link href={`/tasks/${task.id}`}><Eye className="mr-2 h-4 w-4" />View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
});

interface TaskRowItemProps {
  task: TaskListItem;
  isEditingStatus: boolean;
  isUpdatingStatus: boolean;
  onEditStatusClick: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string, projectId?: string) => Promise<void>;
  onCancelEditStatus: () => void;
}
const TaskRowItem = React.memo(function TaskRowItem({ task, isEditingStatus, isUpdatingStatus, onEditStatusClick, onStatusChange, onCancelEditStatus }: TaskRowItemProps) {
 return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-foreground hover:text-primary line-clamp-1">
          {task.title}
        </Link>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground hidden md:table-cell">
        {task.projectId ? (
          <Link href={`/projects/${task.projectId}/overview`} className="hover:underline hover:text-primary truncate line-clamp-1">
            {task.projectName || "N/A"}
          </Link>
        ) : (
          <span className="italic">General Task</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {isEditingStatus ? (
          <div className="flex items-center gap-1 w-full max-w-[150px]">
            <Select
              defaultValue={task.status}
              onValueChange={async (newStatus) => await onStatusChange(task.id, newStatus, task.projectId)}
              disabled={isUpdatingStatus}
            >
              <SelectTrigger className="h-7 text-xs bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUS_OPTIONS.map(col => (
                  <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isUpdatingStatus && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelEditStatus} disabled={isUpdatingStatus}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Badge
            variant="outline"
            className={cn("text-xs px-2 py-0.5 h-5 min-w-[70px] flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-primary/50", getStatusPillClasses(task.status))}
            onClick={() => { if (!isUpdatingStatus) onEditStatusClick(task.id); }}
          >
            {task.status}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
        <Badge variant="outline" className={cn("text-xs px-2 py-0.5 h-5 min-w-[60px] flex items-center justify-center", getPriorityPillClasses(task.priority))}>
          {task.priority || "N/A"}
        </Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{formatDate(task.dueDate)}</td>
      <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
        <div className="flex -space-x-2 overflow-hidden">
          {task.assignees && task.assignees.length > 0 ? (
            task.assignees.slice(0, 3).map(assignee => (
              <UserAvatar
                key={assignee.email}
                fullName={assignee.name}
                email={assignee.email}
                className="h-6 w-6 text-xs border-2 border-card hover:z-10"
              />
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">Unassigned</span>
          )}
          {task.assignees && task.assignees.length > 3 && (
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs border-2 border-card font-semibold">
              +{task.assignees.length - 3}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
        <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80">
          <Link href={`/tasks/${task.id}`}>
            <Eye className="h-4 w-4" />
            <span className="sr-only">View task {task.title}</span>
          </Link>
        </Button>
      </td>
    </tr>
  );
});

interface TaskKanbanCardItemProps {
  task: TaskListItem;
  onEditStatusClick: (task: TaskListItem) => void;
}

const TaskKanbanCardItem = React.memo(function TaskKanbanCardItem({ task, onEditStatusClick }: TaskKanbanCardItemProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow bg-card group relative">

      <CardContent className="p-3.5">
        <Link href={`/tasks/${task.id}`} className="block">
          <p className="font-medium text-sm text-foreground group-hover:text-primary line-clamp-2 leading-snug mb-1.5">
            {task.title}
          </p>
          {task.priority && (
            <Badge variant="outline" size="sm" className={cn("text-xs mb-1.5", getPriorityPillClasses(task.priority))}>
              {task.priority}
            </Badge>
          )}
          {task.projectName && <p className="text-xs text-muted-foreground/80 truncate mb-1">Project: {task.projectName}</p>}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(task.dueDate)}</span>
            {task.assignees && task.assignees.length > 0 && (
              <div className="flex -space-x-1.5">
                {task.assignees.slice(0, 2).map(assignee => (
                  <UserAvatar
                    key={assignee.email}
                    fullName={assignee.name}
                    email={assignee.email}
                    className="h-5 w-5 text-xs border-background border"
                  />
                ))}
                {task.assignees.length > 2 && (
                  <div className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] border-background border">
                    +{task.assignees.length - 2}
                  </div>
                )}
              </div>
            )}
          </div>
        </Link>
      </CardContent>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onEditStatusClick(task);
        }}
      >
        <Edit2 className="h-3.5 w-3.5" />
        <span className="sr-only">Edit Status</span>
      </Button>
    </Card>
  );
});


export default function AllTasksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterOption>("all");
  const [projectFilter, setProjectFilter] = useState<ProjectFilterOption>("all");
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilterOption>("all");
  const [activeView, setActiveView] = useState<ViewMode>("table");

  
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

  const [editingStatusTaskId, setEditingStatusTaskId] = useState<string | null>(null);
  const [editingKanbanTask, setEditingKanbanTask] = useState<TaskListItem | null>(null);
  const [newStatusForKanbanTask, setNewStatusForKanbanTask] = useState<TaskListItem['status'] | "">("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch projects for filter using React Query
  const { data: projectsForFilter = [], isLoading: isProjectsLoadingForFilter } = useQuery<Project[]>({
    queryKey: ['userProjectsForFilter', user?.uid],
    queryFn: async () => {
      if (!user?.email) return [];
      const projectsQuery = query(collection(db, "projects"), where("memberEmails", "array-contains", user.email));
      const snapshot = await getDocs(projectsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
    },
    enabled: !!user?.email, // Only run the query if user email is available
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    onError: (error) => {
      console.error("Error fetching projects for filter:", error);
    }
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user || !user.email || !user.uid) {
      setTasks([]);
      setIsProjectsLoadingForFilter(false);
      router.replace("/login");
      return;
    }

    setIsLoadingTasks(true);
    const tasksCol = collection(db, "tasks");
    const qTasks = query(
      tasksCol,
      or(
        where("ownerId", "==", user.uid),
        where("assigneeEmails", "array-contains", user.email)
      ),
      orderBy("createdAt", "desc")
    );

    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskListItem));
      setTasks(fetchedTasks);
      setIsLoadingTasks(false);
    }, (error) => {
      console.error("Error fetching all tasks: ", error);
      setTasks([]); 
      setIsLoadingTasks(false);
    });

    return () => {
      unsubscribeTasks();
    };
  }, [user, authLoading, router]);

  const suggestedTasks = useMemo(() => {
    if (!searchTerm.trim()) {
      return [];
    }
    return tasks
      .filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 5); 
  }, [tasks, searchTerm]);

  useEffect(() => {
    if (searchTerm.trim().length > 0 && suggestedTasks.length > 0) {
      setIsSuggestionsOpen(true);
    } else {
      setIsSuggestionsOpen(false);
    }
  }, [searchTerm, suggestedTasks]);

  const handleSuggestionSelect = (taskTitle: string) => {
    setSearchTerm(taskTitle);
    setIsSuggestionsOpen(false);
  };

  const filteredTasks = useMemo(() => {
    let tempTasks = [...tasks];
    const today = endOfDay(new Date());

    if (statusFilter !== "all") {
      tempTasks = tempTasks.filter(task => task.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      tempTasks = tempTasks.filter(task => task.priority === priorityFilter);
    }
    if (projectFilter !== "all") {
      tempTasks = tempTasks.filter(task => task.projectId === projectFilter);
    }
    if (dueDateFilter !== "all") {
      tempTasks = tempTasks.filter(task => {
        if (!task.dueDate) return dueDateFilter === "noDeadline";
        if (dueDateFilter === "noDeadline") return false;
        try {
          const dueDateObj = /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate as string)
            ? parseISO((task.dueDate as string) + 'T00:00:00Z')
            : parseISO(task.dueDate as string);
          if (!isValid(dueDateObj)) return false;
          if (dueDateFilter === "overdue") return isPast(dueDateObj) && !isToday(dueDateObj) && task.status !== "Completed";
          if (dueDateFilter === "dueToday") return isToday(dueDateObj);
          if (dueDateFilter === "dueThisWeek") return isThisWeek(dueDateObj, { weekStartsOn: 1 });
          const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
          const startOfNextWeek = addWeeks(startOfThisWeek, 1);
          const endOfNextWeek = endOfWeek(startOfNextWeek, { weekStartsOn: 1 });
          if (dueDateFilter === "dueNextWeek") return dueDateObj >= startOfNextWeek && dueDateObj <= endOfNextWeek;
        } catch (e) { return false; }
        return true;
      });
    }
    if (searchTerm) {
      tempTasks = tempTasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.projectName && task.projectName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (task.assignees && task.assignees.some(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.email.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }
    return tempTasks;
  }, [tasks, searchTerm, statusFilter, priorityFilter, projectFilter, dueDateFilter]);

  const tasksByStatusForKanban = useMemo(() => {
    const grouped: { [key: string]: TaskListItem[] } = {};
    TASK_STATUS_COLUMNS_KANBAN.forEach(col => grouped[col.id] = []);
    filteredTasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        (grouped["To Do"] = grouped["To Do"] || []).push(task);
      }
    });
    return grouped;
  }, [filteredTasks]);

  const handleTaskCreated = useCallback(() => {
    setIsCreateTaskDialogOpen(false);
  }, []);
  
  const handleUpdateTaskStatus = useCallback(async (taskIdToUpdate: string, newStatus: TaskListItem['status'], taskProjectId?: string) => {
    setIsUpdatingStatus(true);
    const taskDocRef = doc(db, "tasks", taskIdToUpdate);
    let projectProgressUpdatedSuccessfully = true;
    let progressUpdateErrorMessage: string | null = null;

    try {
      await updateDoc(taskDocRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Task Status Updated", description: `Task status changed to ${newStatus}.`});
      
      if (taskProjectId) {
        try {
          await updateProjectProgress(taskProjectId);
          toast({ title: "Project Progress Recalculated", description: `Progress for the associated project has been updated.` });
        } catch (projectError: any) {
          projectProgressUpdatedSuccessfully = false;
          progressUpdateErrorMessage = projectError.message || "Unknown error updating project progress.";
          console.error("Project progress update failed:", progressUpdateErrorMessage);
          toast({ 
            variant: "destructive",
            title: "Project Progress Update Failed", 
            description: `Task status updated, but failed to update project progress. ${progressUpdateErrorMessage ? `Details: ${progressUpdateErrorMessage}` : ''}` 
          });
        }
      }

    } catch (taskError: any) {
      console.error("Error updating task status:", taskError);
      toast({ variant: "destructive", title: "Task Update Failed", description: `Could not update task status. ${taskError.message}` });
    } finally {
      setIsUpdatingStatus(false);
      setEditingStatusTaskId(null); 
      if (editingKanbanTask && editingKanbanTask.id === taskIdToUpdate) {
        setEditingKanbanTask(null);
        setNewStatusForKanbanTask("");
        // After successful update, optimistically update the local state
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.id === taskIdToUpdate ? { ...task, status: newStatus } : task
            )
        );
      }
    }
  }, [toast, editingKanbanTask]);

  const handleOnDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || destination.droppableId === source.droppableId) {
      return;
    }
    // draggableId is the taskId, destination.droppableId is the new status
    await handleUpdateTaskStatus(draggableId, destination.droppableId as TaskListItem['status'], tasks.find(t => t.id === draggableId)?.projectId);
  }, [handleUpdateTaskStatus, tasks]);

  const handleKanbanEditStatusClick = useCallback((task: TaskListItem) => {
    setEditingKanbanTask(task);
    setNewStatusForKanbanTask(task.status);
  }, []);

  const showPageLevelSpinner = authLoading || (isLoadingTasks && tasks.length === 0) || (isProjectsLoadingForFilter && projectsForFilter.length === 0 && tasks.length > 0);

  if (showPageLevelSpinner) {
    let loadingMessage = "Loading...";
    if (authLoading) {
      loadingMessage = "Authenticating...";
    } else if (isLoadingTasks && tasks.length === 0 && isProjectsLoadingForFilter && projectsForFilter.length === 0) {
      loadingMessage = "Loading tasks and project data...";
    } else if (isLoadingTasks && tasks.length === 0) {
      loadingMessage = "Loading tasks...";
    } else if (isProjectsLoadingForFilter && projectsForFilter.length === 0) {
      loadingMessage = "Loading project data for filters...";
    }
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <LoadingSpinner size={32} />
        <p className="text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  return (
 <div className="space-y-6">
 <PageHeader
 title="All Tasks"
 description="View and manage all your tasks across projects."
 actions={
 <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
 <DialogTrigger asChild>
 <Button>
 <PlusCircle className="mr-2 h-4 w-4" /> New Task
 </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" />Create New Task</DialogTitle>
 <DialogDescription>Fill in the details to create a new task.</DialogDescription>
 </DialogHeader>
 <CreateTaskForm onDialogOpenChange={setIsCreateTaskDialogOpen} onFormSubmitSuccess={handleTaskCreated} />
 </DialogContent>
 </Dialog>
 }
 />

 <div className="flex flex-col gap-4 rounded-lg bg-card p-4 shadow md:flex-row md:items-center md:justify-between">
 <div className="relative w-full flex-grow md:max-w-md">
 <Popover open={isSuggestionsOpen} onOpenChange={setIsSuggestionsOpen}>
 <PopoverAnchor asChild>
 <div className="relative">
 <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 type="search"
 placeholder="Search tasks by title..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 onFocus={() => {
 if (searchTerm.trim().length > 0 && suggestedTasks.length > 0) {
 setIsSuggestionsOpen(true);
 }
 }}
 className="pl-10 bg-secondary border-none focus:ring-primary h-10"
 />
 </div>
 </PopoverAnchor>
 {suggestedTasks.length > 0 && (
 <PopoverContent 
 className="w-[--radix-popover-trigger-width] p-0 mt-1" 
 align="start"
 onOpenAutoFocus={(e) => e.preventDefault()}
 >
 <Command>
 <CommandList>
 <CommandEmpty>No matching tasks found.</CommandEmpty>
 <CommandGroup heading="Suggestions">
 {suggestedTasks.map((task) => (
 <CommandItem
 key={task.id}
 value={task.title}
 onSelect={() => handleSuggestionSelect(task.title)}
 className="cursor-pointer"
 >
 {task.title}
 {task.projectName && <span className="text-xs text-muted-foreground ml-2 truncate">({task.projectName})</span>}
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
 <ListChecks className="mr-2 h-4 w-4 text-muted-foreground" /> Status <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56">
 <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuRadioGroup value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilterOption)}>
 <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="To Do">To Do</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="Planning">Planning</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="In Progress">In Progress</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="Completed">Completed</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="On Hold">On Hold</DropdownMenuRadioItem>
 </DropdownMenuRadioGroup>
 </DropdownMenuContent>
 </DropdownMenu>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="secondary" className="h-10 w-full md:w-auto">
 <PriorityTagIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Priority <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56">
 <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuRadioGroup value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilterOption)}>
 <DropdownMenuRadioItem value="all">All Priorities</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="Low">Low</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="Medium">Medium</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="High">High</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="Critical">Critical</DropdownMenuRadioItem>
 </DropdownMenuRadioGroup>
 </DropdownMenuContent>
 </DropdownMenu>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="secondary" className="h-10 w-full md:w-auto" disabled={isProjectsLoadingForFilter && projectsForFilter.length === 0}>
 <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" /> Project <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-60">
 <DropdownMenuLabel>Filter by Project</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuRadioGroup value={projectFilter} onValueChange={(value) => setProjectFilter(value as ProjectFilterOption)}>
 <DropdownMenuRadioItem value="all">All Projects</DropdownMenuRadioItem>
 {projectsForFilter.map(p => (
 <DropdownMenuRadioItem key={p.id} value={p.id}>{p.name}</DropdownMenuRadioItem>
 ))}
 </DropdownMenuRadioGroup>
 </DropdownMenuContent>
 </DropdownMenu>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="secondary" className="h-10 w-full md:w-auto">
 <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /> Due Date <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56">
 <DropdownMenuLabel>Filter by Due Date</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuRadioGroup value={dueDateFilter} onValueChange={(value) => setDueDateFilter(value as DueDateFilterOption)}>
 <DropdownMenuRadioItem value="all">All Due Dates</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="noDeadline">No Deadline</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="overdue">Overdue</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="dueToday">Due Today</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="dueThisWeek">Due This Week</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="dueNextWeek">Due Next Week</DropdownMenuRadioItem>
 </DropdownMenuRadioGroup>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as ViewMode)} className="w-full">
        <div className="flex justify-end mb-4">
            <TabsList className="grid grid-cols-3 w-full sm:w-auto max-w-xs">
                <TabsTrigger value="list" className="data-[state=active]:shadow-sm"><LayoutList className="h-4 w-4 mr-1.5 sm:mr-2"/>List</TabsTrigger>
                <TabsTrigger value="table" className="data-[state=active]:shadow-sm"><Columns className="h-4 w-4 mr-1.5 sm:mr-2"/>Table</TabsTrigger>
                <TabsTrigger value="kanban" className="data-[state=active]:shadow-sm"><KanbanSquare className="h-4 w-4 mr-1.5 sm:mr-2"/>Kanban</TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="list">
            {isLoadingTasks && tasks.length === 0 ? (
                 <div className="flex justify-center items-center h-64"><LoadingSpinner size={32} /><p className="ml-2 text-muted-foreground">Loading tasks...</p></div>
            ) : filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTasks.map((task) => (
                        <TaskCardItem
                          key={task.id}
                          task={task}
                          isEditingStatus={editingStatusTaskId === task.id}
                          isUpdatingStatus={isUpdatingStatus && editingStatusTaskId === task.id}
                          onEditStatusClick={setEditingStatusTaskId}
                          onStatusChange={handleUpdateTaskStatus}
                          onCancelEditStatus={() => setEditingStatusTaskId(null)}
                        />
                    ))}
                </div>
            ) : renderNoTasksMessage()}
        </TabsContent>

        <TabsContent value="table">
            {isLoadingTasks && tasks.length === 0 ? (
                <div className="flex justify-center items-center h-64"><LoadingSpinner size={32} /><p className="ml-2 text-muted-foreground">Loading tasks...</p></div>
            ) : filteredTasks.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border bg-card shadow">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[30%]">Task Title</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[15%] hidden md:table-cell">Project</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">Status</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%] hidden sm:table-cell">Priority</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[15%]">Due Date</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[15%] hidden lg:table-cell">Assignees</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-[5%]">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                    {filteredTasks.map((task) => (
                        <TaskRowItem
                          key={task.id}
                          task={task}
                          isEditingStatus={editingStatusTaskId === task.id}
                          isUpdatingStatus={isUpdatingStatus && editingStatusTaskId === task.id}
                          onEditStatusClick={setEditingStatusTaskId}
                          onStatusChange={handleUpdateTaskStatus}
                          onCancelEditStatus={() => setEditingStatusTaskId(null)}
                        />
                    ))}
                    </tbody>
                </table>
                </div>
            ) : renderNoTasksMessage()}
        </TabsContent>

        <TabsContent value="kanban">
             {isLoadingTasks && tasks.length === 0 ? (
                 <div className="flex justify-center items-center h-64"><LoadingSpinner size={32} /><p className="ml-2 text-muted-foreground">Loading tasks for kanban...</p></div>
            ) : filteredTasks.length > 0 ? ( // Only render DND context if there are tasks to potentially display
                <ScrollArea className="w-full whitespace-nowrap pb-4">
                    <DragDropContext onDragEnd={handleOnDragEnd}>
                        <div className="flex gap-4 h-full"> {/* Ensure flex container has height */}
                            {TASK_STATUS_COLUMNS_KANBAN.map((column) => (
                                <Droppable key={column.id} droppableId={column.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`w-80 min-w-[20rem] flex-shrink-0 rounded-lg bg-muted/40 border-2 ${column.colorClass} shadow-sm flex flex-col transition-colors ${snapshot.isDraggingOver ? 'border-primary/50 bg-muted' : ''}`}
                                        >
                                            <div className={`flex items-center justify-between p-3 border-b-2 ${column.colorClass} bg-card rounded-t-md`}>
                                                <h3 className="font-semibold text-foreground text-base">{column.title}</h3>
                                                <Badge variant="secondary" className="text-sm">{tasksByStatusForKanban[column.id]?.length || 0}</Badge>
                                            </div>
                                            <ScrollArea className="flex-grow p-1.5"> {/* Use flex-grow here */}
                                                <div className="space-y-2.5 p-1.5 min-h-[100px]"> {/* Add min-height */}
                                                    {(tasksByStatusForKanban[column.id] || []).length === 0 ? (
                                                        <div className="text-center py-6">
                                                            <ListChecks className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2"/>
                                                            <p className="text-xs text-muted-foreground">No tasks in this column.</p>
                                                        </div>
                                                    ) : (
                                                        (tasksByStatusForKanban[column.id] || []).map((task, index) => (
                                                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                                                {(provided, snapshot) => (
                                                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.8 : 1 }}>
                                                                        <TaskKanbanCardItem task={task} onEditStatusClick={handleKanbanEditStatusClick} />
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))
                                                    )}
                                                    {provided.placeholder} {/* Important for Droppable */}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </DragDropContext>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            ) : renderNoTasksMessage()}
        </TabsContent>
      </Tabs>

      {editingKanbanTask && (
        <Dialog open={!!editingKanbanTask} onOpenChange={() => { setEditingKanbanTask(null); setNewStatusForKanbanTask(""); }}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle>Change Status: {editingKanbanTask.title}</DialogTitle>
                    <DialogDescription>Select a new status for this task.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Select
                        value={newStatusForKanbanTask}
                        onValueChange={(value) => setNewStatusForKanbanTask(value as TaskListItem['status'])}
                        disabled={isUpdatingStatus}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select new status" />
                        </SelectTrigger>
                        <SelectContent>
                            {TASK_STATUS_OPTIONS.map(col => (
                                <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { setEditingKanbanTask(null); setNewStatusForKanbanTask(""); }} disabled={isUpdatingStatus}>Cancel</Button>
                    <Button
                        onClick={async () => {
                            if (newStatusForKanbanTask && editingKanbanTask) {
                                await handleUpdateTaskStatus(editingKanbanTask.id, newStatusForKanbanTask, editingKanbanTask.projectId);
                            }
                        }}
                        disabled={isUpdatingStatus || !newStatusForKanbanTask || newStatusForKanbanTask === editingKanbanTask.status}
                    >
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                        Update Status
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
    
    

