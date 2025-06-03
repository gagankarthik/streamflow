
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Save, Trash2, ServerCrash, Info, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, Timestamp, getDoc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { suggestProjectDescription } from "@/ai/flows/project-description-suggestion-flow";

const projectSettingsSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters.").max(100),
  description: z.string().max(500, "Description must not exceed 500 characters.").optional(),
  deadline: z.string().optional().refine(val => {
    if (!val) return true; // Optional field
    const date = new Date(val); // Check if it's a valid date string
    return !isNaN(date.getTime());
  }, { message: "Invalid date format for deadline."}),
  status: z.enum(["To Do", "In Progress", "Completed", "On Hold"]),
});

type ProjectSettingsFormValues = z.infer<typeof projectSettingsSchema>;

interface ProjectSettingsData {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  deadline?: string; // Stored as 'YYYY-MM-DD' string
  status: "To Do" | "In Progress" | "Completed" | "On Hold";
  team?: { id: string; email: string; role: string; name?: string; }[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  progress?: number;
  imageUrl?: string;
  aiHint?: string;
}


export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [project, setProject] = useState<ProjectSettingsData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  const { control, handleSubmit, reset, formState: { errors }, getValues, setValue } = useForm<ProjectSettingsFormValues>({
    resolver: zodResolver(projectSettingsSchema),
    // Default values will be set by reset() in useEffect
  });

  useEffect(() => {
    if (authLoading || !user || !projectId) {
      if (!authLoading && !user) router.replace("/login");
      return;
    }
    setIsLoadingProject(true);
    const projectDocRef = doc(db, "projects", projectId);
    const unsubscribe = onSnapshot(projectDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<ProjectSettingsData, "id">;
         if (data.ownerId !== user.uid) {
            toast({ variant: "destructive", title: "Access Denied", description: "You cannot edit this project's settings." });
            router.push(`/projects/${projectId}/overview`);
            setProject(null); 
            setIsLoadingProject(false);
            return;
        }
        const projectData = { id: docSnap.id, ...data };
        setProject(projectData);
        reset({
          name: projectData.name,
          description: projectData.description || "",
          deadline: projectData.deadline || "", 
          status: projectData.status || "To Do",
        });
      } else {
        toast({ variant: "destructive", title: "Not Found", description: "Project not found." });
        router.push("/projects");
        setProject(null); 
      }
      setIsLoadingProject(false);
    }, (error) => {
      console.error("Error fetching project for settings: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load project settings." });
      router.push("/projects");
      setProject(null);
      setIsLoadingProject(false);
    });
    return () => unsubscribe();
  }, [projectId, user, authLoading, reset, router, toast]);


  const handleUpdateProject = async (data: ProjectSettingsFormValues) => {
    if (!project || !user || project.ownerId !== user.uid) {
      toast({ variant: "destructive", title: "Unauthorized", description: "You cannot update this project." });
      return;
    }
    setIsSubmitting(true);
    try {
      const projectRef = doc(db, "projects", project.id);
      await updateDoc(projectRef, {
        name: data.name,
        description: data.description || "",
        deadline: data.deadline || "",
        status: data.status,
        updatedAt: Timestamp.now(),
      });
      toast({ title: "Project Updated", description: `"${data.name}" has been successfully updated.` });
    } catch (error: any) {
      console.error("Error updating project: ", error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project || !user || project.ownerId !== user.uid) {
        toast({ variant: "destructive", title: "Unauthorized", description: "You cannot delete this project." });
        return;
    }
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "projects", project.id));
      toast({ title: "Project Deleted", description: `"${project.name}" has been successfully deleted.` });
      router.push("/projects");
    } catch (error: any) {
      console.error("Error deleting project: ", error);
      toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAiSuggestDescription = async () => {
    if (!project) return;
    const currentDescription = getValues("description");
    setIsAiSuggesting(true);
    try {
        const result = await suggestProjectDescription({
            projectName: project.name,
            existingDescription: currentDescription || undefined,
        });
        if (result && result.suggestedDescription) {
            setValue("description", result.suggestedDescription);
            toast({
                title: "AI Suggestion Applied",
                description: "Project description updated with AI suggestion.",
            });
        } else {
            throw new Error("AI suggestion was empty.");
        }
    } catch (error: any) {
        console.error("Error getting AI project description suggestion:", error);
        toast({
            variant: "destructive",
            title: "AI Suggestion Failed",
            description: error.message || "Could not get AI suggestion for project description.",
        });
    } finally {
        setIsAiSuggesting(false);
    }
  };

  if (isLoadingProject || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3 py-4">
        <LoadingSpinner size={32} />
        <p className="text-muted-foreground">Loading project settings...</p>
      </div>
    );
  }

  if (!project) {
     return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3 text-center py-4">
        <ServerCrash className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Project Settings Unavailable</p>
        <p className="text-sm text-muted-foreground">
          The project settings could not be loaded. It might have been deleted, or you may not have access.
        </p>
      </div>
    );
  }
  
  const isOwner = project.ownerId === user?.uid;

  return (
    <div className="space-y-6 py-4">
      {isOwner ? (
        <>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center"><Info className="mr-2 h-5 w-5 text-primary"/>General Information</CardTitle>
              <CardDescription>Update your project's name, description, deadline and status.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(handleUpdateProject)}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="projectName">Project Name <span className="text-destructive">*</span></Label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => <Input id="projectName" {...field} disabled={isSubmitting || !isOwner} />}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="projectDescription">Project Description</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAiSuggestDescription}
                        disabled={isAiSuggesting || isSubmitting || !isOwner}
                        className="text-xs text-primary hover:text-primary/80 px-2 py-1 h-auto"
                    >
                        {isAiSuggesting ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        AI Suggestion
                    </Button>
                  </div>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => <Textarea id="projectDescription" {...field} value={field.value ?? ''} disabled={isSubmitting || !isOwner || isAiSuggesting} className="min-h-[100px]" />}
                  />
                  {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="deadline">Deadline</Label>
                        <Controller
                            name="deadline"
                            control={control}
                            render={({ field }) => <Input id="deadline" type="date" {...field} value={field.value ?? ''} disabled={isSubmitting || !isOwner} />}
                        />
                        {errors.deadline && <p className="text-xs text-destructive">{errors.deadline.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
                         <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <select {...field} id="status" disabled={isSubmitting || !isOwner} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="On Hold">On Hold</option>
                                </select>
                            )}
                        />
                        {errors.status && <p className="text-xs text-destructive">{errors.status.message}</p>}
                    </div>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isSubmitting || !isOwner || isAiSuggesting}>
                  {isSubmitting ? <LoadingSpinner className="mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4" />} Save Changes
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="border-destructive shadow-md">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center"><ShieldAlert className="mr-2 h-5 w-5"/>Danger Zone</CardTitle>
              <CardDescription>This action is permanent and cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeleting || !isOwner}>
                    {isDeleting ? <LoadingSpinner className="mr-2 h-4 w-4"/> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete Project
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently delete the project "{project.name}" and all of its associated data (tasks, etc.). This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProject} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                      {isDeleting ? <LoadingSpinner className="mr-2 h-4 w-4"/> : null}
                      Yes, delete project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </>
      ) : (
         <div className="flex flex-col items-center justify-center h-64 space-y-3 text-center py-4">
            <ShieldAlert className="w-12 h-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Access Denied</p>
            <p className="text-sm text-muted-foreground">
            You are not the owner of this project and cannot modify its settings.
            </p>
        </div>
      )}
    </div>
  );
}
