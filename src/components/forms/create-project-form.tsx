
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { useState } from "react";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import type { ProjectTeamMember } from "@/types";

const projectFormSchema = z.object({
  name: z.string().min(3, {
    message: "Project name must be at least 3 characters.",
  }).max(100, {
    message: "Project name must not exceed 100 characters.",
  }),
  description: z.string().max(500, {
    message: "Description must not exceed 500 characters.",
  }).optional(),
  deadline: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

const placeholderImages = [
  { url: "https://placehold.co/600x400.png", hint: "abstract design" },
  { url: "https://placehold.co/600x400.png", hint: "nature landscape" },
  { url: "https://placehold.co/600x400.png", hint: "technology concept" },
  { url: "https://placehold.co/600x400.png", hint: "team collaboration" },
  { url: "https://placehold.co/600x400.png", hint: "modern architecture" },
];

interface CreateProjectFormProps {
  onFormSubmitSuccess?: (projectId: string) => void;
  onDialogOpenChange?: (open: boolean) => void;
}

export function CreateProjectForm({ onFormSubmitSuccess, onDialogOpenChange }: CreateProjectFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      deadline: "",
    },
  });

  async function onSubmit(data: ProjectFormValues) {
    if (!user || !user.uid || !user.email) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to create a project." });
      return;
    }
    setIsLoading(true);

    const randomImage = placeholderImages[Math.floor(Math.random() * placeholderImages.length)];

    const ownerTeamMember: ProjectTeamMember = {
      id: user.uid,
      email: user.email,
      name: user.displayName || user.email.split('@')[0],
      role: "Owner",
    };

    try {
      const docRef = await addDoc(collection(db, "projects"), {
        name: data.name,
        description: data.description || "",
        deadline: data.deadline || "",
        ownerId: user.uid,
        ownerName: user.displayName || user.email.split('@')[0],
        ownerEmail: user.email,
        memberEmails: [user.email], 
        team: [ownerTeamMember], // Initialize team with the owner
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "To Do",
        progress: 0,
        // teamSize will be derived from team.length later or can be 1 initially
        imageUrl: randomImage.url,
        aiHint: randomImage.hint,
      });

      toast({
        title: "Project Created!",
        description: `The project "${data.name}" has been successfully created.`,
      });

      if (onFormSubmitSuccess) {
        onFormSubmitSuccess(docRef.id);
      }
      form.reset();
      if (onDialogOpenChange) {
        onDialogOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error creating project: ", error);
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the project. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="E.g., Q1 Marketing Campaign" {...field} disabled={isLoading} />
              </FormControl>
              <FormDescription>
                A clear and descriptive name for your project.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Provide a brief overview (max 500 characters)."
                  className="resize-none min-h-[120px]"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deadline (Optional)</FormLabel>
              <FormControl>
                <Input type="date" {...field} disabled={isLoading} />
              </FormControl>
              <FormDescription>
                Target completion date for your project.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="pt-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <LoadingSpinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            Create Project
          </Button>
        </div>
      </form>
    </Form>
  );
}
