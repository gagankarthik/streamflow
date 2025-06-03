
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, CheckCircle, Activity as ActivityIcon, Users2, ServerCrash, Home as HomeIcon, ChevronRight, PlusCircle, XSquare, Info, Edit3, ListChecks, FolderPlus, Link as LinkIcon } from "lucide-react";
import { Timestamp, doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { format, isValid, parseISO, isPast, formatDistanceToNow } from "date-fns";
import { AddTeamMemberForm, type AddTeamMemberFormValues } from "@/components/forms/add-team-member-form";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import type { TaskListItem } from "@/app/(app)/tasks/page";


interface ProjectTeamMember {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: "Viewer" | "Editor" | "Admin" | "Owner";
}

interface ProjectDetails {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  status: "To Do" | "In Progress" | "Completed";
  progress: number; // 0-100
  team?: ProjectTeamMember[];
  deadline?: string; // Expect 'YYYY-MM-DD' or ISO string
  imageUrl?: string;
  aiHint?: string;
}

interface ProjectOverviewStats {
  tasksCompleted: number;
  tasksTotal: number;
  upcomingDeadlines: number;
  teamSize: number;
}

interface ActivityItem {
  id: string;
  icon: React.ElementType;
  text: React.ReactNode;
  time: string; // Formatted relative time string
  timestamp: Date;
  targetType?: 'task' | 'project';
  targetId?: string;
}


const formatDateDisplay = (dateInput?: string | Timestamp): string => {
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
      return "Invalid Date Input";
    }
    return format(dateToFormat, "MMMM dd, yyyy");
  } catch (e) {
    console.warn("Date formatting error for value:", dateInput, e);
    return "N/A";
  }
};


export default function ProjectOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const projectId = params.projectId as string;
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectOverviewStats>({
    tasksCompleted: 0,
    tasksTotal: 0,
    upcomingDeadlines: 0,
    teamSize: 0,
  });
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isFetchingProject, setIsFetchingProject] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjectDataAndActivities = useCallback(async () => {
    if (authLoading || !user || !projectId) return;

    setIsFetchingProject(true);
    setError(null);
    const projectDocRef = doc(db, "projects", projectId);

    try {
      const docSnap = await getDoc(projectDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<ProjectDetails, "id">;
        const isOwner = data.ownerId === user.uid;
        const isInTeam = data.team?.some(member => member.id === user.uid || member.email === user.email);

        if (!isOwner && !isInTeam && data.ownerId !== user.uid) { // Double check ownerId condition
          setError("Access Denied: You are not authorized to view this project overview.");
          setProject(null);
          setRecentActivities([]);
        } else {
          const currentProject = { id: docSnap.id, ...data };
          setProject(currentProject);
          setProjectStats(prev => ({ ...prev, teamSize: currentProject.team?.length || 0 }));

          let activities: ActivityItem[] = [];
          // Project creation activity
          if (currentProject.createdAt) {
            activities.push({
              id: `${currentProject.id}_created`,
              icon: FolderPlus,
              text: <>Project <span className="font-semibold">{currentProject.name}</span> created</>,
              time: formatDistanceToNow(currentProject.createdAt.toDate(), { addSuffix: true }),
              timestamp: currentProject.createdAt.toDate(),
              targetType: 'project',
              targetId: currentProject.id,
            });
          }


          // Project update activity (if updatedAt is different and exists)
          if (currentProject.updatedAt && currentProject.createdAt && currentProject.updatedAt.toMillis() !== currentProject.createdAt.toMillis()) {
            activities.push({
              id: `${currentProject.id}_updated`,
              icon: Edit3,
              text: <>Project <span className="font-semibold">{currentProject.name}</span> details updated</>,
              time: formatDistanceToNow(currentProject.updatedAt.toDate(), { addSuffix: true }),
              timestamp: currentProject.updatedAt.toDate(),
              targetType: 'project',
              targetId: currentProject.id,
            });
          }

          // Fetch related tasks for stats and activities
          const tasksCol = collection(db, "tasks");
          const qTasks = query(tasksCol, where("projectId", "==", projectId), orderBy("updatedAt", "desc"), limit(10)); // Fetch more tasks for activity
          const tasksSnapshot = await getDocs(qTasks);
          
          let completedCount = 0;
          let upcomingCount = 0;
          const today = new Date();

          tasksSnapshot.forEach(taskDoc => {
            const taskData = taskDoc.data() as TaskListItem;
            if (taskData.status === "Completed") {
              completedCount++;
            }
            if (taskData.dueDate) {
              try {
                const dueDate = parseISO(taskData.dueDate);
                if (isValid(dueDate) && !isPast(dueDate) && taskData.status !== "Completed") {
                  upcomingCount++;
                }
              } catch (e) { console.warn("Invalid due date for task stat:", taskData.id, taskData.dueDate); }
            }
            
            // Task updated activity
            if (taskData.updatedAt && taskData.createdAt && taskData.updatedAt.toMillis() !== taskData.createdAt.toMillis()) {
                 activities.push({
                    id: `${taskDoc.id}_task_updated`,
                    icon: ListChecks,
                    text: <>Task <Link href={`/tasks/${taskDoc.id}`} className="font-semibold hover:underline">{taskData.title}</Link> updated</>,
                    time: formatDistanceToNow(taskData.updatedAt.toDate(), { addSuffix: true }),
                    timestamp: taskData.updatedAt.toDate(),
                    targetType: 'task',
                    targetId: taskDoc.id,
                });
            }
            // Task created activity (only if not also updated, or show both if distinct enough)
            // For simplicity, let's assume if it's updated, that's the more relevant recent activity.
            // If you want both, you'd add logic here. If a task was just created, updatedAt might be same as createdAt.
            else if (taskData.createdAt) {
                 activities.push({
                    id: `${taskDoc.id}_task_created`,
                    icon: PlusCircle,
                    text: <>Task <Link href={`/tasks/${taskDoc.id}`} className="font-semibold hover:underline">{taskData.title}</Link> created</>,
                    time: formatDistanceToNow(taskData.createdAt.toDate(), { addSuffix: true }),
                    timestamp: taskData.createdAt.toDate(),
                    targetType: 'task',
                    targetId: taskDoc.id,
                });
            }
          });
          
          setProjectStats(prev => ({
            ...prev,
            tasksCompleted: completedCount,
            tasksTotal: tasksSnapshot.size, // This is only for the last 10 tasks. For true total, another query is needed or count from project doc if stored.
                                            // For now, we'll assume the overview shows stats based on recent tasks.
            upcomingDeadlines: upcomingCount,
          }));

          // Sort all activities by timestamp and take the most recent ones (e.g., 5-7)
          activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          setRecentActivities(activities.slice(0, 7)); // Display latest 7 activities
        }
      } else {
        setError("Project not found for overview.");
        setProject(null);
        setRecentActivities([]);
      }
    } catch (err) {
      console.error("Error fetching project for overview: ", err);
      setError("Failed to load project details for overview.");
      setProject(null);
      setRecentActivities([]);
    } finally {
      setIsFetchingProject(false);
    }
  }, [projectId, user, authLoading]); // Added authLoading as dependency


  useEffect(() => {
    fetchProjectDataAndActivities();
  }, [fetchProjectDataAndActivities]);


  if (isFetchingProject || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <LoadingSpinner size={32} />
        <p className="text-muted-foreground">Loading project overview...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3 text-center">
        <ServerCrash className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-semibold text-destructive">
          {error || "Project overview data could not be loaded."}
        </p>
         <Button onClick={() => router.push('/projects')} variant="outline" className="mt-4">
            Back to Projects
          </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8"> 
      <section>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold text-foreground">Project Progress</h2>
          <span className="text-xl font-semibold text-foreground">{project.progress || 0}%</span>
        </div>
        <Progress value={project.progress || 0} className="h-2.5 w-full bg-border" indicatorClassName="bg-primary rounded-sm" />
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          <Card className="shadow-sm bg-card">
            <CardContent className="p-4 sm:p-6 flex flex-col items-start justify-center">
              <p className="text-sm text-muted-foreground mb-1">Tasks Completed</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{projectStats.tasksCompleted}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm bg-card">
             <CardContent className="p-4 sm:p-6 flex flex-col items-start justify-center">
              <p className="text-sm text-muted-foreground mb-1">Upcoming Deadlines</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{projectStats.upcomingDeadlines}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm bg-card">
            <CardContent className="p-4 sm:p-6 flex flex-col items-start justify-center">
              <p className="text-sm text-muted-foreground mb-1">Team Members</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{projectStats.teamSize}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
        {recentActivities.length > 0 ? (
          <div className="space-y-0">
            {recentActivities.map((activity, index) => (
              <div key={activity.id} className="grid grid-cols-[auto_1fr] items-start gap-x-3 sm:gap-x-4">
                <div className="flex flex-col items-center pt-1.5">
                  <activity.icon className="h-5 w-5 text-primary" />
                  {index < recentActivities.length - 1 && (
                    <div className="w-[2px] bg-border grow min-h-[2.5rem] my-1.5 rounded-full"></div>
                  )}
                </div>
                <div className={`pb-6 ${index < recentActivities.length - 1 ? 'border-transparent' : ''}`}>
                  <p className="text-sm font-medium text-foreground">{activity.text}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-card border border-dashed rounded-lg">
             <ActivityIcon className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No recent activity for this project.</p>
            <p className="text-xs text-muted-foreground">Updates will appear here as they happen.</p>
          </div>
        )}
      </section>
    </div>
  );
}
