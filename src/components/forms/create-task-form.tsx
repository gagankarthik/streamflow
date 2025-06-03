
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Users, XCircle, CheckCircle, Sparkles } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, updateDoc, doc } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import type { Project } from "@/app/(app)/projects/page";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { summarizeTask } from "@/ai/flows/task-summarization";

const taskStatusOptions = ["To Do", "Planning", "In Progress", "Completed", "On Hold"] as const;
const taskPriorityOptions = ["Low", "Medium", "High", "Critical"] as const;

const NO_PROJECT_VALUE = "__NONE__";

const assigneeSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  id: z.string().optional(),
  role: z.string().optional(),
});
export type Assignee = z.infer<typeof assigneeSchema>;

const taskFormSchema = z.object({
  title: z.string().min(3, {
    message: "Task title must be at least 3 characters.",
  }).max(100, {
    message: "Task title must not exceed 100 characters.",
  }),
  description: z.string().max(1000, {
    message: "Description must not exceed 1000 characters.",
  }).optional(),
  projectId: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(taskStatusOptions).default("To Do"),
  priority: z.enum(taskPriorityOptions).default("Medium"),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

interface CreateTaskFormProps {
  onFormSubmitSuccess?: (taskId: string) => void;
  onDialogOpenChange?: (open: boolean) => void;
}

async function updateProjectProgress(projectId: string) {
  if (!projectId) return;

  try {
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


export function CreateTaskForm({ onFormSubmitSuccess, onDialogOpenChange }: CreateTaskFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isAiSummarizing, setIsAiSummarizing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  const [selectedAssignees, setSelectedAssignees] = useState<Assignee[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [projectMembersAndOwner, setProjectMembersAndOwner] = useState<Assignee[]>([]);
  const [isAssigneePopoverOpen, setIsAssigneePopoverOpen] = useState(false);


  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: NO_PROJECT_VALUE,
      dueDate: "",
      status: "To Do",
      priority: "Medium",
    },
  });

  useEffect(() => {
    async function fetchProjects() {
      if (!user || !user.email) {
        setIsProjectsLoading(false);
        return;
      }
      setIsProjectsLoading(true);
      try {
        const projectsCol = collection(db, "projects");
        const q = query(projectsCol, where("memberEmails", "array-contains", user.email));
        const querySnapshot = await getDocs(q);
        const fetchedProjects = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                ownerName: data.ownerName || data.ownerEmail?.split('@')[0] || "Owner",
                team: data.team || []
            } as Project;
        });
        setProjects(fetchedProjects);
      } catch (error) {
        console.error("Error fetching projects for task form: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load projects." });
      } finally {
        setIsProjectsLoading(false);
      }
    }
    fetchProjects();
  }, [user, toast]);

  useEffect(() => {
    const selectedProjectId = form.getValues("projectId");
    let members: Assignee[] = [];
    if (selectedProjectId && selectedProjectId !== NO_PROJECT_VALUE) {
      const currentProject = projects.find(p => p.id === selectedProjectId);
      if (currentProject) {
        members = [...(currentProject.team || [])];
        if (currentProject.ownerEmail && currentProject.ownerId) {
          const ownerAsAssignee: Assignee = {
            id: currentProject.ownerId,
            email: currentProject.ownerEmail,
            name: currentProject.ownerName || currentProject.ownerEmail.split('@')[0],
            role: "Owner"
          };
          if (!members.some(m => m.email === ownerAsAssignee.email)) {
            members.push(ownerAsAssignee);
          }
        }
      }
    }
    setProjectMembersAndOwner(members);
    setSelectedAssignees([]);
    setAssigneeSearch("");
  }, [form.watch("projectId"), projects, form]);


  const handleAssigneeSelect = (member: Assignee) => {
    if (!selectedAssignees.find(a => a.email === member.email)) {
      setSelectedAssignees(prev => [...prev, member]);
    }
    setAssigneeSearch("");
    setIsAssigneePopoverOpen(false);
  };

  const handleAssigneeRemove = (emailToRemove: string) => {
    setSelectedAssignees(prev => prev.filter(a => a.email !== emailToRemove));
  };

  const filteredProjectMembers = projectMembersAndOwner.filter(member =>
    member.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    member.email.toLowerCase().includes(assigneeSearch.toLowerCase())
  ).filter(member => !selectedAssignees.some(sa => sa.email === member.email));

  const handleAiSummarize = async () => {
    const description = form.getValues("description");
    if (!description || description.trim().length < 10) { 
        toast({
            variant: "destructive",
            title: "Not Enough Text",
            description: "Please enter at least 10 characters in the description to summarize.",
        });
        return;
    }
    setIsAiSummarizing(true);
    try {
        const result = await summarizeTask({ text: description });
        if (result && result.summary) {
            form.setValue("description", result.summary);
            toast({
                title: "AI Suggestion Applied",
                description: "The description has been updated with an AI-generated summary.",
            });
        } else {
            throw new Error("AI summary was empty.");
        }
    } catch (error: any) {
        console.error("Error getting AI summary:", error);
        toast({
            variant: "destructive",
            title: "AI Summary Failed",
            description: error.message || "Could not get AI summary. Please try again.",
        });
    } finally {
        setIsAiSummarizing(false);
    }
  };

  async function onSubmit(data: TaskFormValues) {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
      return;
    }
    setIsLoading(true);

    let finalProjectId: string | null = null;
    let selectedProjectName: string | null = null;

    if (data.projectId && data.projectId !== NO_PROJECT_VALUE) {
      const selectedProject = projects.find(p => p.id === data.projectId);
      if (!selectedProject) {
          toast({ variant: "destructive", title: "Project Error", description: "Selected project not found." });
          setIsLoading(false);
          return;
      }
      finalProjectId = selectedProject.id;
      selectedProjectName = selectedProject.name;
    }

    const assigneeEmails = selectedAssignees.map(assignee => assignee.email);

    try {
      const docRef = await addDoc(collection(db, "tasks"), {
        title: data.title,
        description: data.description || "",
        projectId: finalProjectId,
        projectName: selectedProjectName,
        assignees: selectedAssignees,
        assigneeEmails: assigneeEmails,
        dueDate: data.dueDate || null,
        status: data.status,
        priority: data.priority,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        subtasks: [],
        relatedBugs: [],
      });

      toast({
        title: "Task Created!",
        description: `The task "${data.title}" has been successfully created.`,
      });
      
      if (finalProjectId) {
        await updateProjectProgress(finalProjectId);
      }


      if (onFormSubmitSuccess) {
        onFormSubmitSuccess(docRef.id);
      }
      form.reset();
      setSelectedAssignees([]);
      setAssigneeSearch("");
      if (onDialogOpenChange) {
        onDialogOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error creating task: ", error);
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the task. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2 pb-2">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Title <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="E.g., Implement user authentication" {...field} disabled={isLoading || isAiSummarizing} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Description</FormLabel>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAiSummarize}
                    disabled={isAiSummarizing || isLoading}
                    className="text-xs text-primary hover:text-primary/80 px-2 py-1 h-auto"
                >
                    {isAiSummarizing ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    AI Suggestion
                </Button>
              </div>
              <FormControl>
                <Textarea
                  placeholder="Provide details about the task (max 1000 characters)."
                  className="resize-none min-h-[100px]"
                  {...field}
                  disabled={isLoading || isAiSummarizing}
                />
              </FormControl>
               <FormDescription>
                Describe the task, or use AI Suggestion to summarize your thoughts.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project (Optional)</FormLabel>
              <Select
                onValueChange={(value) => {
                    field.onChange(value);
                }}
                value={field.value || NO_PROJECT_VALUE}
                disabled={isLoading || isProjectsLoading || isAiSummarizing}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isProjectsLoading ? "Loading projects..." : "Select a project (optional)"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_PROJECT_VALUE}>No Project (General Task)</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
            <FormLabel>Assignees</FormLabel>
            <div className="flex flex-wrap gap-2 mb-2">
                {selectedAssignees.map(assignee => (
                  <Badge key={assignee.email} variant="secondary" className="py-1 pl-1 pr-1 text-sm flex items-center gap-1">
                      <UserAvatar email={assignee.email} fullName={assignee.name} className="h-4 w-4 text-xs"/>
                      {assignee.name}
                      <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-0.5 h-4 w-4 text-muted-foreground hover:text-destructive hover:bg-transparent"
                          onClick={() => handleAssigneeRemove(assignee.email)}
                          disabled={isLoading || isAiSummarizing}
                      >
                          <XCircle className="h-3 w-3" />
                      </Button>
                  </Badge>
                ))}
            </div>
            <Popover open={isAssigneePopoverOpen} onOpenChange={setIsAssigneePopoverOpen}>
                <PopoverTrigger asChild>
                    <Input
                        type="text"
                        placeholder="Search by name or email..."
                        value={assigneeSearch}
                        onChange={(e) => {
                            setAssigneeSearch(e.target.value);
                            const projSelected = form.getValues("projectId") && form.getValues("projectId") !== NO_PROJECT_VALUE;
                            if (e.target.value.length > 0 && projSelected) {
                                setIsAssigneePopoverOpen(true);
                            } else {
                                setIsAssigneePopoverOpen(false);
                            }
                        }}
                        onFocus={() => {
                            const projSelected = form.getValues("projectId") && form.getValues("projectId") !== NO_PROJECT_VALUE;
                            if (assigneeSearch.length > 0 && projSelected) {
                                setIsAssigneePopoverOpen(true);
                            }
                        }}
                        disabled={isLoading || isAiSummarizing || (!form.getValues("projectId") || form.getValues("projectId") === NO_PROJECT_VALUE)}
                    />
                </PopoverTrigger>
                { (form.getValues("projectId") && form.getValues("projectId") !== NO_PROJECT_VALUE) && (
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Search project members & owner..."
                            value={assigneeSearch}
                            onValueChange={setAssigneeSearch}
                        />
                        <CommandList>
                            <CommandEmpty>{projectMembersAndOwner.length === 0 ? "No members/owner in this project." : "No matching members found."}</CommandEmpty>
                            <CommandGroup>
                                {filteredProjectMembers.map((member) => (
                                <CommandItem
                                    key={member.email}
                                    value={`${member.name} ${member.email}`}
                                    onSelect={() => handleAssigneeSelect(member)}
                                    className="cursor-pointer flex justify-between items-center"
                                >
                                  <div className="flex items-center gap-2">
                                    <UserAvatar email={member.email} fullName={member.name} className="h-5 w-5 text-xs"/>
                                    <div>
                                        <span className="text-sm font-medium">{member.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">{member.email}</span>
                                    </div>
                                  </div>
                                  <CheckCircle className={cn("h-4 w-4", selectedAssignees.find(a => a.email === member.email) ? "opacity-100 text-primary" : "opacity-0")}/>
                                </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
                )}
            </Popover>
            <FormDescription>
                Type to search for assignees by name or email. Select a project to see its members and owner.
            </FormDescription>
        </FormItem>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
             <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} disabled={isLoading || isAiSummarizing} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || isAiSummarizing}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {taskStatusOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
         <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || isAiSummarizing}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {taskPriorityOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        <div className="pt-4">
          <Button type="submit" className="w-full" disabled={isLoading || isProjectsLoading || isAiSummarizing}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Create Task
          </Button>
        </div>
      </form>
    </Form>
  );
}
    

    
