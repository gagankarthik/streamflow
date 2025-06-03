
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { format, isValid, parseISO } from 'date-fns';
import { KanbanSquare, GripVertical, ServerCrash, ListChecks } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TaskForBoard {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  assignees?: { email: string; name: string; id?: string }[];
  projectId: string;
}

const TASK_STATUS_COLUMNS: { title: string; id: string; colorClass: string }[] = [
  { title: "To Do", id: "To Do", colorClass: "border-purple-500/50" },
  { title: "Planning", id: "Planning", colorClass: "border-sky-500/50" },
  { title: "In Progress", id: "In Progress", colorClass: "border-blue-500/50" },
  { title: "Completed", id: "Completed", colorClass: "border-green-500/50" },
  { title: "On Hold", id: "On Hold", colorClass: "border-yellow-500/50" },
];

const getPriorityPillClasses = (priority?: string): string => {
  if (!priority) return "bg-slate-100 text-slate-700 border-slate-300";
  switch (priority.toLowerCase()) {
    case "critical": return "bg-red-600/10 text-red-700 border-red-600/30";
    case "high": return "bg-orange-500/10 text-orange-600 border-orange-500/30";
    case "medium": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/30";
    case "low": return "bg-green-500/10 text-green-700 border-green-500/30";
    default: return "bg-slate-100 text-slate-600 border-slate-300";
  }
};

export default function ProjectBoardPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const projectId = params.projectId as string;

  const [tasks, setTasks] = useState<TaskForBoard[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !projectId) {
      if (!authLoading && !user) router.replace("/login");
      return;
    }

    setIsLoadingTasks(true);
    setError(null);
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
        } as TaskForBoard;
      });
      setTasks(fetchedTasks);
      setIsLoadingTasks(false);
    }, (err) => {
      console.error("Error fetching project tasks for board: ", err);
      setError("Failed to load tasks for the board.");
      setIsLoadingTasks(false);
    });

    return () => unsubscribe();
  }, [projectId, user, authLoading, router]);

  const tasksByStatus = useMemo(() => {
    const grouped: { [key: string]: TaskForBoard[] } = {};
    TASK_STATUS_COLUMNS.forEach(col => grouped[col.id] = []); // Initialize all columns
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        // If task status doesn't match predefined columns, put in 'To Do' or a default column
        (grouped["To Do"] = grouped["To Do"] || []).push(task);
      }
    });
    return grouped;
  }, [tasks]);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? parseISO(dateString + 'T00:00:00Z') : parseISO(dateString);
      if (!isValid(date)) return "Invalid Date";
      return format(date, "MMM dd");
    } catch (e) { return "N/A"; }
  };

  if (isLoadingTasks || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3 py-4">
        <LoadingSpinner size={32} />
        <p className="text-muted-foreground">Loading board...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3 text-center py-4">
        <ServerCrash className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-semibold text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4">
          {TASK_STATUS_COLUMNS.map((column) => (
            <div key={column.id} className={`w-72 min-w-[18rem] flex-shrink-0 rounded-lg bg-muted/40 border-2 ${column.colorClass} shadow-sm`}>
              <div className={`flex items-center justify-between p-3 border-b-2 ${column.colorClass} bg-card rounded-t-md`}>
                <h3 className="font-semibold text-foreground text-base">{column.title}</h3>
                <Badge variant="secondary" className="text-sm">{tasksByStatus[column.id]?.length || 0}</Badge>
              </div>
              <ScrollArea className="h-[calc(100vh-18rem)] p-1.5"> {/* Adjust height as needed */}
                <div className="space-y-2.5 p-1.5">
                {(tasksByStatus[column.id] || []).length === 0 ? (
                    <div className="text-center py-6">
                        <ListChecks className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2"/>
                        <p className="text-xs text-muted-foreground">No tasks in this column.</p>
                    </div>
                ) : (
                    (tasksByStatus[column.id] || []).map((task) => (
                    <Card key={task.id} className="shadow-md hover:shadow-lg transition-shadow bg-card">
                      <CardContent className="p-3">
                        <Link href={`/tasks/${task.id}`} className="block group">
                          <div className="flex items-start justify-between mb-1.5">
                            <p className="font-medium text-sm text-foreground group-hover:text-primary line-clamp-2 leading-snug">
                              {task.title}
                            </p>
                            {/* <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-1.5 -mt-0.5 text-muted-foreground hover:text-foreground">
                                <GripVertical className="h-4 w-4" />
                            </Button> */}
                          </div>
                          {task.priority && (
                            <Badge variant="outline" size="sm" className={cn("text-xs mb-1.5", getPriorityPillClasses(task.priority))}>
                              {task.priority}
                            </Badge>
                          )}
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
                    </Card>
                  )))}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
