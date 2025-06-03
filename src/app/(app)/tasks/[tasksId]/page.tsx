
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, ChevronRight, Info, MessageCircle, ListChecks, Send, Loader2, CalendarDays, Tag, Users2, Briefcase, Edit2, Trash2, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { doc, getDoc, Timestamp, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, getDocs, writeBatch, deleteDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import type { Assignee, ProjectTeamMember, ProjectRole } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface ProjectForTaskContext {
  id: string;
  name: string;
  ownerId: string;
  team: ProjectTeamMember[];
}

interface TaskDocument {
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  assignees?: Assignee[];
  dueDate?: string;
  status?: string;
  priority?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  subtasks?: Subtask[];
  ownerId: string; // User ID of the task creator
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface TaskDetailsPageData {
  id: string;
  title: string;
  description?: string;
  project?: { id: string; name: string; };
  assignees?: Assignee[];
  dueDate?: string;
  status: string;
  priority: string;
  subtasks: Subtask[];
  ownerId: string; // Task creator's ID
  currentUser?: { firstName?: string; lastName?: string; avatarUrl?: string; email?: string; displayName?: string; uid: string; };
}

interface CommentEntry {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail?: string;
  text: string;
  createdAt: Timestamp;
}

const taskStatusOptions = ["To Do", "Planning", "In Progress", "Completed", "On Hold"] as const;
const taskPriorityOptions = ["Low", "Medium", "High", "Critical"] as const;

const getStatusPillClasses = (status?: string): string => {
  if (!status) return "bg-slate-100 text-slate-700 border-slate-300";
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
    if (!priority) return "bg-slate-100 text-slate-700 border-slate-300";
    switch (priority.toLowerCase()) {
      case "critical": return "bg-red-600/10 text-red-700 border-red-600/30";
      case "high": return "bg-orange-500/10 text-orange-600 border-orange-500/30";
      case "medium": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/30";
      case "low": return "bg-green-500/10 text-green-700 border-green-500/30";
      default: return "bg-slate-100 text-slate-600 border-slate-300";
    }
  };

async function updateProjectProgress(projectId: string) {
  if (!projectId) return;

  try {
    const projectDocRef = doc(db, "projects", projectId);
    const projectDocSnap = await getDoc(projectDocRef);

    if (!projectDocSnap.exists()) {
      console.warn("Project document not found for ID:", projectId);
      return; // Exit if project document doesn't exist
    }
    const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", projectId));
    const tasksSnapshot = await getDocs(tasksQuery);

    let completedTasks = 0;
    const totalTasks = tasksSnapshot.size;

    if (totalTasks === 0) {
      await updateDoc(doc(db, "projects", projectId), { progress: 0, updatedAt: serverTimestamp() });
      return;
    }

    tasksSnapshot.forEach(taskDoc => {
      if (taskDoc.data().status === "Completed") {
        completedTasks++;
      }
    });

    const progress = Math.round((completedTasks / totalTasks) * 100);
    await updateDoc(doc(db, "projects", projectId), { progress, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error("Error updating project progress:", error);
  }
}


export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.taskId as string;
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [task, setTask] = useState<TaskDetailsPageData | null>(null);
  const [projectContext, setProjectContext] = useState<ProjectForTaskContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isUpdatingSubtask, setIsUpdatingSubtask] = useState<string | null>(null);


  const userProjectRole: ProjectRole | undefined = useMemo(() => {
    if (!authUser || !projectContext) return undefined;
    if (projectContext.ownerId === authUser.uid) return "Owner";
    const teamMember = projectContext.team.find(member => member.id === authUser.uid || member.email === authUser.email);
    return teamMember?.role;
  }, [authUser, projectContext]);

  const canUpdateTaskDetails = useMemo(() => {
    if (!authUser || !task) return false;
    if (task.ownerId === authUser.uid && !task.project) return true; // Task not in project, owner can edit
    if (!projectContext) return task.ownerId === authUser.uid; // Task in project, but project context not loaded (fallback to owner)

    return userProjectRole === "Owner" || userProjectRole === "Admin" || userProjectRole === "Editor";
  }, [authUser, task, projectContext, userProjectRole]);

  const canDeleteTask = useMemo(() => {
     if (!authUser || !task) return false;
     if (task.ownerId === authUser.uid && !task.project) return true;
     if (!projectContext) return task.ownerId === authUser.uid;

    return userProjectRole === "Owner" || userProjectRole === "Admin";
  }, [authUser, task, projectContext, userProjectRole]);


  useEffect(() => {
    if (taskId) {
      setLoading(true);
      setError(null);
      const taskDocRef = doc(db, "tasks", taskId);

      const unsubscribeTask = onSnapshot(taskDocRef, async (taskDocSnap) => {
        if (taskDocSnap.exists()) {
          const data = taskDocSnap.data() as TaskDocument;

          let currentUserDetails: TaskDetailsPageData['currentUser'] = undefined;
          if(authUser && authUser.uid) {
              const nameParts = authUser.displayName?.split(" ") || ["User"];
              currentUserDetails = {
                  uid: authUser.uid,
                  firstName: nameParts[0],
                  lastName: nameParts.slice(1).join(" ") || "",
                  displayName: authUser.displayName || "Anonymous",
                  email: authUser.email || undefined,
              };
          }

          const currentTaskData: TaskDetailsPageData = {
            id: taskDocSnap.id,
            title: data.title,
            description: data.description,
            project: data.projectId && data.projectName ? { id: data.projectId, name: data.projectName } : undefined,
            assignees: data.assignees || [],
            dueDate: data.dueDate,
            status: data.status || "To Do",
            priority: data.priority || "Medium",
            subtasks: (data.subtasks || []).map((st, index) => ({ ...st, id: st.id || `${Date.now()}-${index}`})),
            ownerId: data.ownerId,
            currentUser: currentUserDetails,
          };
          setTask(currentTaskData);

          if (data.projectId) {
            try {
              const projectDoc = await getDoc(doc(db, "projects", data.projectId));
              if (projectDoc.exists()) {
                const projectData = projectDoc.data();
                setProjectContext({
                  id: projectDoc.id,
                  name: projectData.name,
                  ownerId: projectData.ownerId,
                  team: projectData.team || [],
                });
              } else {
                console.warn("Project associated with task not found.");
                setProjectContext(null);
              }
            } catch (projErr) {
              console.error("Error fetching project context:", projErr);
              setProjectContext(null);
            }
          } else {
            setProjectContext(null);
          }
          setError(null);
        } else {
          setError("Task not found.");
          setTask(null);
          setProjectContext(null);
        }
        setLoading(false);
      }, (err) => {
        console.error("Error fetching task:", err);
        setError("Failed to load task data.");
        setLoading(false);
      });

      setIsLoadingComments(true);
      const commentsQuery = query(collection(db, "tasks", taskId, "comments"), orderBy("createdAt", "asc"));
      const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
        const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommentEntry));
        setComments(fetchedComments);
        setIsLoadingComments(false);
      }, (err) => {
        console.error("Error fetching comments:", err);
        toast({ variant: "destructive", title: "Error", description: "Could not load comments." });
        setIsLoadingComments(false);
      });

      return () => {
        unsubscribeTask();
        unsubscribeComments();
      };

    } else {
      setError("No Task ID provided.");
      setLoading(false);
      setIsLoadingComments(false);
    }
  }, [taskId, authUser, toast]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !task || !task.currentUser || !task.currentUser.uid) {
      toast({ variant: "destructive", title: "Error", description: "Comment cannot be empty or user not identified." });
      return;
    }
    setIsPostingComment(true);
    try {
      await addDoc(collection(db, "tasks", taskId, "comments"), {
        userId: task.currentUser.uid,
        userDisplayName: task.currentUser.displayName || "Anonymous",
        userEmail: task.currentUser.email || undefined,
        text: newComment.trim(),
        createdAt: serverTimestamp(),
      });
      setNewComment("");
      toast({ title: "Comment Posted", description: "Your comment has been added." });
    } catch (err) {
      console.error("Error posting comment:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to post comment." });
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!task || !canUpdateTaskDetails) {
        toast({variant: "destructive", title: "Permission Denied", description: "You cannot update this task's status."});
        return;
    }
    setIsUpdatingStatus(true);
    const taskDocRef = doc(db, "tasks", taskId);
    try {
 await updateDoc(taskDocRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Status Updated", description: `Task status changed to ${newStatus}.` });
      setIsEditingStatus(false); // Close select after update
      if (task.project?.id) {
        await updateProjectProgress(task.project.id);
      }
    } catch (error) {
      console.error("Error updating task status:", error);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update task status." });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!task || !canUpdateTaskDetails) {
        toast({variant: "destructive", title: "Permission Denied", description: "You cannot update this task's priority."});
        return;
    }
    setIsUpdatingPriority(true);
    const taskDocRef = doc(db, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, { priority: newPriority, updatedAt: serverTimestamp() });
      toast({ title: "Priority Updated", description: `Task priority changed to ${newPriority}.` });
      setIsEditingPriority(false); // Close select after update
    } catch (error) {
      console.error("Error updating task priority:", error);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update task priority." });
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task || !canDeleteTask) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You cannot delete this task." });
        return;
    }
    setIsDeletingTask(true);
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      toast({ title: "Task Deleted", description: `Task "${task.title}" has been deleted.` });
      if (task.project?.id) {
        await updateProjectProgress(task.project.id);
      }
      router.push(task.project?.id ? `/projects/${task.project.id}/tasks` : '/tasks');
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!task || !canUpdateTaskDetails || !newSubtaskTitle.trim()) {
      if (!newSubtaskTitle.trim()) toast({ variant: "destructive", title: "Input Error", description: "Subtask title cannot be empty." });
      else toast({variant: "destructive", title: "Permission Denied", description: "You cannot add subtasks."});
      return;
    }
    setIsAddingSubtask(true);
    const newSubtask: Subtask = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    try {
      const taskDocRef = doc(db, "tasks", taskId);
      const updatedSubtasks = [...(task.subtasks || []), newSubtask];
      await updateDoc(taskDocRef, { subtasks: updatedSubtasks, updatedAt: serverTimestamp() });
      toast({ title: "Subtask Added", description: `Subtask "${newSubtask.title}" created.` });
      setNewSubtaskTitle("");
    } catch (error) {
      console.error("Error adding subtask:", error);
      toast({ variant: "destructive", title: "Failed to Add", description: "Could not add subtask." });
    } finally {
      setIsAddingSubtask(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!task || !canUpdateTaskDetails) {
      toast({variant: "destructive", title: "Permission Denied", description: "You cannot update subtasks."});
      return;
    }
    setIsUpdatingSubtask(subtaskId);
    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    try {
      const taskDocRef = doc(db, "tasks", taskId);
      await updateDoc(taskDocRef, { subtasks: updatedSubtasks, updatedAt: serverTimestamp() });
      const changedSubtask = updatedSubtasks.find(st => st.id === subtaskId);
      toast({ title: "Subtask Updated", description: `"${changedSubtask?.title}" marked as ${changedSubtask?.completed ? 'complete' : 'incomplete'}.`});
    } catch (error) {
      console.error("Error toggling subtask:", error);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update subtask." });
    } finally {
      setIsUpdatingSubtask(null);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task || !canUpdateTaskDetails) {
      toast({variant: "destructive", title: "Permission Denied", description: "You cannot delete subtasks."});
      return;
    }
    setIsUpdatingSubtask(subtaskId);
    const subtaskToDelete = task.subtasks.find(st => st.id === subtaskId);
    const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
    try {
      const taskDocRef = doc(db, "tasks", taskId);
      await updateDoc(taskDocRef, { subtasks: updatedSubtasks, updatedAt: serverTimestamp() });
      toast({ title: "Subtask Deleted", description: `Subtask "${subtaskToDelete?.title}" removed.`});
    } catch (error) {
      console.error("Error deleting subtask:", error);
      toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete subtask." });
    } finally {
      setIsUpdatingSubtask(null);
    }
  };

  const formatDateDisplay = (dateInput?: string): string => {
    if (!dateInput) return "N/A";
    try {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
          ? parseISO(dateInput + 'T00:00:00Z') // Treat as UTC if only date
          : parseISO(dateInput);
        if (!isValid(date)) return "Invalid Date";
        return format(date, "MMM dd, yyyy");
    } catch (e) {
        return "N/A";
    }
  };

  const assigneeSummary = useMemo(() => {
    if (!task?.assignees || task.assignees.length === 0) return "Unassigned";
    if (task.assignees.length === 1) return task.assignees[0].name;
    return `${task.assignees[0].name} + ${task.assignees.length - 1} more`;
  }, [task?.assignees]);


  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center h-[calc(100vh-10rem)]">
        <LoadingSpinner size={32} />
        <p className="ml-2 text-muted-foreground">Loading task details...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="list-none p-0 inline-flex">
              <li className="flex items-center">
                <Link href="/tasks" className="hover:text-primary">All Tasks</Link>
                <ChevronRight className="h-4 w-4 mx-1" />
              </li>
              <li className="flex items-center">
                <span className="font-medium text-foreground">Task Not Found</span>
              </li>
            </ol>
          </nav>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-destructive">Task Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-10">
              {error || "The task you are looking for does not exist or could not be loaded."}
            </p>
             <Button onClick={() => router.push('/tasks')} variant="outline" className="mt-4 block mx-auto">
                Back to All Tasks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex flex-wrap items-center">
            <li className="flex items-center">
              <Link href={task.project ? `/projects/${task.project.id}/tasks` : "/tasks"} className="hover:text-primary">
                {task.project ? "Project Tasks" : "All Tasks"}
              </Link>
              <ChevronRight className="h-4 w-4 mx-1 shrink-0" />
            </li>
            {task.project && (
              <li className="flex items-center">
                <Link href={`/projects/${task.project.id}/overview`} className="hover:text-primary truncate max-w-[150px] sm:max-w-xs">
                  {task.project.name}
                </Link>
                <ChevronRight className="h-4 w-4 mx-1 shrink-0" />
              </li>
            )}
            <li className="flex items-center">
              <span className="font-medium text-foreground truncate max-w-[150px] sm:max-w-xs md:max-w-md">{task.title}</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">{task.title}</h1>
              {(task.assignees && task.assignees.length > 0 || task.dueDate) && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {task.assignees && task.assignees.length > 0 && (
                    <span>Assigned to: {assigneeSummary}</span>
                  )}
                  {task.assignees && task.assignees.length > 0 && task.dueDate && <span className="mx-1.5">&middot;</span>}
                  {task.dueDate && <span>Due: {formatDateDisplay(task.dueDate)}</span>}
                </p>
              )}
            </div>
            {canDeleteTask && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="shrink-0" disabled={isDeletingTask}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Task
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will permanently delete the task "{task.title}". This cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingTask}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive hover:bg-destructive/90" disabled={isDeletingTask}>
                            {isDeletingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Yes, delete task
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
          </div>


          {task.description && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2"><Info className="h-5 w-5 text-primary"/>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line">
                  <p>{task.description}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/>Subtasks</CardTitle>
            </CardHeader>
            <CardContent>
              {task.subtasks && task.subtasks.length > 0 ? (
                <div className="space-y-3">
                  {task.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center space-x-3 p-3 border rounded-lg bg-card hover:bg-muted/50">
                      <Checkbox
                        id={`subtask-${subtask.id}`}
                        checked={subtask.completed}
                        onCheckedChange={() => handleToggleSubtask(subtask.id)}
                        disabled={!canUpdateTaskDetails || isUpdatingSubtask === subtask.id}
                        aria-label={`Mark subtask ${subtask.title} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                      />
                      <label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm font-medium text-foreground ${subtask.completed ? 'line-through text-muted-foreground' : ''} cursor-pointer`}>
                        {subtask.title}
                      </label>
                      {isUpdatingSubtask === subtask.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {canUpdateTaskDetails && isUpdatingSubtask !== subtask.id && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteSubtask(subtask.id)} disabled={isUpdatingSubtask === subtask.id}>
                          <Trash2 className="h-3.5 w-3.5"/>
                          <span className="sr-only">Delete subtask</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No subtasks for this task.</p>
              )}
              {canUpdateTaskDetails && (
                <div className="flex gap-2 mt-4 items-center border-t pt-4">
                  <Input
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add new subtask..."
                    disabled={isAddingSubtask}
                    className="h-9 flex-1 text-sm"
                  />
                  <Button onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim() || isAddingSubtask} size="sm" className="h-9">
                    {isAddingSubtask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-1.5 h-4 w-4" />}
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary"/>Comments</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto pr-2">
                {isLoadingComments ? (
                    <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size={24} />
                    <p className="ml-2 text-sm text-muted-foreground">Loading comments...</p>
                    </div>
                ) : comments.length > 0 ? (
                    comments.map(comment => (
                    <div key={comment.id} className="flex items-start space-x-3">
                        <UserAvatar
                        fullName={comment.userDisplayName}
                        email={comment.userEmail}
                        className="h-9 w-9 mt-1 shrink-0"
                        />
                        <div className="flex-1 bg-muted/40 p-3 rounded-lg shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold text-foreground">{comment.userDisplayName}</p>
                              <p className="text-xs text-muted-foreground">
                              {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                              </p>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-line">{comment.text}</p>
                        </div>
                    </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4 italic">No comments yet.</p>
                )}
                </div>

                <div className="flex items-start space-x-3 pt-4 border-t">
                    <UserAvatar
                      fullName={task.currentUser?.displayName}
                      email={task.currentUser?.email}
                      className="h-9 w-9 mt-1 shrink-0"
                    />
                    <div className="flex-1">
                    <Textarea
                        placeholder="Add a comment..."
                        className="mb-2 bg-card border-border focus:ring-primary text-sm"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        disabled={isPostingComment}
                        rows={3}
                    />
                    <div className="flex justify-end">
                        <Button onClick={handlePostComment} disabled={isPostingComment || !newComment.trim()} size="sm">
                        {isPostingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                        Comment
                        </Button>
                    </div>
                    </div>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm sticky top-20"> {/* Added sticky top for better UX on scroll */}
            <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><Info className="h-5 w-5 text-primary"/>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                 {!canUpdateTaskDetails && userProjectRole && (
                    <div className="p-2.5 mb-3 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-md flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0"/>
                        <span>Your role ({userProjectRole}) has limited edit permissions for this task.</span>
                    </div>
                 )}
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    {isEditingStatus && canUpdateTaskDetails ? (
                        <div className="flex items-center gap-1">
                             <Select onValueChange={handleStatusChange} defaultValue={task.status} disabled={isUpdatingStatus}>
                                <SelectTrigger className="h-8 text-xs w-[130px]">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                {taskStatusOptions.map(option => (
                                    <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditingStatus(false)} disabled={isUpdatingStatus}>
                                <XCircle className="h-4 w-4"/>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={cn("font-medium px-2 py-0.5 text-xs", getStatusPillClasses(task.status))}>{task.status}</Badge>
                            {canUpdateTaskDetails && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setIsEditingStatus(true)}>
                                <Edit2 className="h-3.5 w-3.5"/>
                            </Button>
                            )}
                        </div>
                    )}
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Priority</span>
                     {isEditingPriority && canUpdateTaskDetails ? (
                        <div className="flex items-center gap-1">
                             <Select onValueChange={handlePriorityChange} defaultValue={task.priority} disabled={isUpdatingPriority}>
                                <SelectTrigger className="h-8 text-xs w-[130px]">
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                {taskPriorityOptions.map(option => (
                                    <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditingPriority(false)} disabled={isUpdatingPriority}>
                                <XCircle className="h-4 w-4"/>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={cn("font-medium px-2 py-0.5 text-xs", getPriorityPillClasses(task.priority))}>{task.priority}</Badge>
                             {canUpdateTaskDetails && (
                             <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setIsEditingPriority(true)}>
                                <Edit2 className="h-3.5 w-3.5"/>
                            </Button>
                             )}
                        </div>
                    )}
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Due Date</span>
                    <span className="font-medium text-foreground">{formatDateDisplay(task.dueDate)}</span>
                </div>
                <Separator />
                <div className="space-y-1.5">
                    <span className="text-muted-foreground block">Assignees</span>
                    {task.assignees && task.assignees.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                        {task.assignees.map(assignee => (
                            <div key={assignee.email} className="flex items-center gap-2 bg-muted/30 px-2.5 py-1 rounded-md" title={`${assignee.name} (${assignee.email})`}>
                            <UserAvatar email={assignee.email} fullName={assignee.name} className="h-5 w-5 text-xs"/>
                            <span className="text-sm font-medium text-foreground truncate max-w-[120px]">{assignee.name}</span>
                            </div>
                        ))}
                        </div>
                    ) : (
                        <span className="font-medium text-foreground italic">Unassigned</span>
                    )}
                </div>
                 {task.project && (
                    <>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Project</span>
                        <Link href={`/projects/${task.project.id}/overview`} className="font-medium text-primary hover:underline truncate max-w-[150px]">{task.project.name}</Link>
                    </div>
                    </>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

