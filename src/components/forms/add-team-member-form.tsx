
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { useState } from "react";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import type { ProjectRole } from "@/types";

const projectRoles: ProjectRole[] = ["Viewer", "Editor", "Admin"];


const addTeamMemberFormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  role: z.enum(projectRoles, {
    errorMap: () => ({ message: "Please select a role for the member." }),
  }),
});

export type AddTeamMemberFormValues = z.infer<typeof addTeamMemberFormSchema>;

interface AddTeamMemberFormProps {
  onSubmitSuccess: (values: AddTeamMemberFormValues) => Promise<void> | void;
  onDialogClose: () => void;
  isLoading?: boolean;
  currentTeamEmails?: string[]; // To prevent adding existing members
  projectOwnerEmail?: string;
}

export function AddTeamMemberForm({ 
  onSubmitSuccess, 
  onDialogClose, 
  isLoading: parentIsLoading,
  currentTeamEmails = [],
  projectOwnerEmail
}: AddTeamMemberFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddTeamMemberFormValues>({
    resolver: zodResolver(addTeamMemberFormSchema),
    defaultValues: {
      email: "",
      role: "Viewer",
    },
  });

  async function onSubmit(data: AddTeamMemberFormValues) {
    setIsSubmitting(true);
    if (data.email === projectOwnerEmail) {
      toast({
        variant: "destructive",
        title: "Cannot Add Owner",
        description: "The project owner is already part of the team and cannot be re-added.",
      });
      setIsSubmitting(false);
      return;
    }
    if (currentTeamEmails.includes(data.email)) {
       toast({
        variant: "destructive",
        title: "Member Exists",
        description: `${data.email} is already a member of this project.`,
      });
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmitSuccess(data);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add member",
        description: error.message || "An unexpected error occurred in the form.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const combinedIsLoading = isSubmitting || parentIsLoading;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Member Email <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input type="email" placeholder="member@example.com" {...field} disabled={combinedIsLoading} />
              </FormControl>
              <FormDescription>
                The email address of the person you want to invite.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={combinedIsLoading}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {projectRoles.map((role) => (
                    <SelectItem key={role} value={role} disabled={role === "Owner"}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Assign a role to determine their access level.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDialogClose} disabled={combinedIsLoading}>
                Cancel
            </Button>
            <Button type="submit" disabled={combinedIsLoading}>
                {combinedIsLoading ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                Add Member
            </Button>
        </div>
      </form>
    </Form>
  );
}
