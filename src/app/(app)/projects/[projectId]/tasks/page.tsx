
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link"; 
import { db } from "@/lib/firebase"; 
import { collection, query, where, onSnapshot, Timestamp, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { CreateTaskForm, type Assignee } from "@/components/forms/create-task-form"; 
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { PlusCircle, ListChecks, Search as SearchIcon, Eye } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { format, isValid, parseISO } from 'date-fns';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ProjectTaskItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string; 
  assignees?: Assignee[]; 
  projectId: string;
  createdAt: Timestamp; // Made non-optional as it's used for orderBy
}

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

export default function ProjectTasksPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const projectId = params.projectId as string;

  const [tasks, setTasks] = useState<ProjectTaskItem[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (authLoading || !user || !projectId) {
      if (!authLoading && !user) router.replace("/login");
      return;
    }

    setIsLoadingTasks(true);
    const tasksCol = collection(db, "tasks");
    
    const q = query(
      tasksCol,
      where("projectId", "==", projectId),
      orderBy("createdAt", "desc") 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "Untitled Task",
          status: data.status || "To Do",
          priority: data.priority,
          dueDate: data.dueDate, 
          assignees: data.assignees || [], 
          projectId: data.projectId,
          createdAt: data.createdAt, 
        } as ProjectTaskItem;
      });
      setTasks(fetchedTasks);
      setIsLoadingTasks(false);
    }, (error) => {
      console.error("Error fetching project tasks: ", error);
      setIsLoadingTasks(false);
      // Optionally, show a toast message for the error
    });

    return () => unsubscribe();
  }, [projectId, user, authLoading, router]);

  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    return tasks.filter(task =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.assignees && task.assignees.some(a => a.name.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [tasks, searchTerm]);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
          ? parseISO(dateString + 'T00:00:00Z') 
          : parseISO(dateString); 
      if (!isValid(date)) return "Invalid Date";
      return format(date, "MMM dd, yyyy");
    } catch (e) {
      return "N/A";
    }
  };
  
  const handleTaskCreated = () => {
    setIsCreateTaskDialogOpen(false);
  };

  if (authLoading && isLoadingTasks && tasks.length === 0) { 
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size={32} /></div>;
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
            type="search"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border focus:ring-primary" 
            />
        </div>
        <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" />Create New Task</DialogTitle>
              <DialogDescription>Fill in the details below to add a new task to this project.</DialogDescription>
            </DialogHeader>
            <CreateTaskForm onDialogOpenChange={setIsCreateTaskDialogOpen} onFormSubmitSuccess={handleTaskCreated} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoadingTasks && tasks.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={32} />
          <p className="ml-2 text-muted-foreground">Loading tasks...</p>
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-card">
                <TableHead className="w-[35%] px-4 py-3">Task</TableHead>
                <TableHead className="w-[15%] px-4 py-3 hidden md:table-cell">Status</TableHead>
                <TableHead className="w-[15%] px-4 py-3 hidden lg:table-cell">Priority</TableHead>
                <TableHead className="w-[15%] px-4 py-3">Due Date</TableHead>
                <TableHead className="w-[15%] px-4 py-3 hidden sm:table-cell">Assignees</TableHead>
                <TableHead className="w-[5%] px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium px-4 py-3">
                     <Link href={`/tasks/${task.id}`} className="hover:text-primary">{task.title}</Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline" className={cn("min-w-[90px] h-6 px-2.5 text-xs font-semibold rounded-md flex items-center justify-center", getStatusPillClasses(task.status))}>
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden lg:table-cell">
                    <Badge variant="outline" className={cn("min-w-[70px] h-6 px-2.5 text-xs font-semibold rounded-md flex items-center justify-center", getPriorityPillClasses(task.priority))}>
                      {task.priority || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-4 py-3">{formatDate(task.dueDate)}</TableCell>
                  <TableCell className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex -space-x-2">
                        {task.assignees && task.assignees.length > 0 ? (
                            task.assignees.slice(0,3).map(assignee => (
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
                             <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs border-2 border-card">
                                +{task.assignees.length - 3}
                            </div>
                        )}
                    </div>
                  </TableCell>
                   <TableCell className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                       <Link href={`/tasks/${task.id}`}>
                         <Eye className="h-4 w-4" /> <span className="sr-only">View Task</span>
                       </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-10 bg-card rounded-lg shadow min-h-[200px] flex flex-col items-center justify-center">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl font-semibold text-foreground mb-2">
            {searchTerm ? "No tasks match your search." : "No tasks for this project yet."}
          </p>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            {searchTerm ? "Try a different search term." : "Get started by adding the first task to this project!"}
          </p>
           {!searchTerm && (
            <Button onClick={() => setIsCreateTaskDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Task
            </Button>
           )}
        </div>
      )}
    </div>
  );
}

