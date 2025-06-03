
"use client";

import type { TaskListItem } from "@/app/(app)/tasks/page";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { XIcon, CalendarDays, Tag, CheckCircle2, Paperclip, MessageCircle, Send, Briefcase, UserCircle2, ListChecks } from "lucide-react";
import { format, isValid, parseISO } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/auth-context";

interface TaskDetailSidebarProps {
  task: TaskListItem;
  onClose: () => void;
  onUpdateTaskStatus: (taskId: string, newStatus: string) => Promise<void>;
  onUpdateTaskPriority: (taskId: string, newPriority: string) => Promise<void>;
}

// Re-using pill classes from tasks/page.tsx for consistency
const getStatusPillClasses = (status?: string): string => {
  if (!status) return "bg-slate-100 text-slate-700 border-slate-300";
   switch (status.toLowerCase()) {
    case "completed": return "bg-green-100 text-green-700 border-green-300";
    case "in progress": return "bg-blue-100 text-blue-700 border-blue-300";
    case "on hold": return "bg-orange-100 text-orange-700 border-orange-300";
    case "to do": return "bg-purple-100 text-purple-700 border-purple-300";
    case "planning": return "bg-sky-100 text-sky-700 border-sky-300";
    default: return "bg-slate-100 text-slate-600 border-slate-300";
  }
};

const getPriorityPillClasses = (priority?: string): string => {
    if (!priority) return "bg-slate-100 text-slate-700 border-slate-300";
    switch (priority.toLowerCase()) {
      case "critical": return "bg-red-100 text-red-700 border-red-300";
      case "high": return "bg-amber-100 text-amber-700 border-amber-300";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "low": return "bg-lime-100 text-lime-700 border-lime-300";
      default: return "bg-slate-100 text-slate-600 border-slate-300";
    }
  };


export function TaskDetailSidebar({ task, onClose, onUpdateTaskStatus, onUpdateTaskPriority }: TaskDetailSidebarProps) {
  const { user: currentUser } = useAuth();

  const formatDate = (dateString?: string, formatStr: string = "MMM dd, yyyy") => {
    if (!dateString) return "N/A";
    try {
      // Handle YYYY-MM-DD by parsing as UTC to avoid timezone issues
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (!isValid(date)) return "Invalid Date";
        return format(date, formatStr);
      }
      // Handle other ISO strings
      const parsedDate = parseISO(dateString);
      if (!isValid(parsedDate)) return "Invalid Date";
      return format(parsedDate, formatStr);
    } catch (e) {
      console.warn("Date formatting error for value:", dateString, e);
      return "N/A";
    }
  };

  const handleSubtaskToggle = (subtaskId: string, completed: boolean) => {
    console.log(`Subtask ${subtaskId} (task: ${task.id}) toggled to ${completed}`);
    // Placeholder for actual subtask update logic in Firestore
    // This would involve updating the 'subtasks' array within the parent task document.
    // Example:
    // const updatedSubtasks = task.subtasks?.map(st =>
    //   st.id === subtaskId ? { ...st, completed } : st
    // );
    // updateDoc(doc(db, "tasks", task.id), { subtasks: updatedSubtasks });
  };

  const currentUserFirstName = currentUser?.displayName?.split(" ")[0] || "";
  const currentUserLastName = currentUser?.displayName?.split(" ").slice(1).join(" ") || "";
  const currentUserEmail = currentUser?.email || undefined;

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground truncate pr-2" title={task.title}>{task.title}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <XIcon className="h-5 w-5" />
          <span className="sr-only">Close sidebar</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">

          {task.description && (
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Description</h3>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {task.description}
              </p>
            </section>
          )}

          <Separator/>

          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Details</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><CalendarDays className="h-4 w-4 opacity-70"/>Due Date</span>
                <span className="font-medium text-foreground">{formatDate(task.dueDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><Tag className="h-4 w-4 opacity-70"/>Priority</span>
                <Badge variant="outline" className={cn("text-xs px-2 py-0.5", getPriorityPillClasses(task.priority))}>
                  {task.priority || "N/A"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 opacity-70"/>Status</span>
                 <Badge variant="outline" className={cn("text-xs px-2 py-0.5", getStatusPillClasses(task.status))}>
                  {task.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><UserCircle2 className="h-4 w-4 opacity-70"/>Assignee</span>
                <div className="flex items-center gap-2">
                  {task.assigneeName ? (
                    <>
                      <UserAvatar
                        firstName={task.assigneeFirstName}
                        lastName={task.assigneeLastName}
                        fullName={task.assigneeName}
                        email={task.assigneeEmail} // Pass email for tooltip
                        className="h-5 w-5 text-xs"
                      />
                      <span className="font-medium text-foreground">{task.assigneeName}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </div>
              </div>
               {task.projectName && (
                  <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2"><Briefcase className="h-4 w-4 opacity-70"/>Project</span>
                      <span className="font-medium text-foreground truncate">{task.projectName}</span>
                  </div>
              )}
            </div>
          </section>

          {task.subtasks && task.subtasks.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 opacity-70" />
                    Subtasks ({task.subtasks.filter(st => st.completed).length}/{task.subtasks.length})
                </h3>
                <div className="space-y-1.5">
                  {task.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center space-x-2.5 p-1.5 rounded-md hover:bg-muted/30 transition-colors">
                      <Checkbox
                        id={`sidebar-subtask-${task.id}-${subtask.id}`}
                        checked={subtask.completed}
                        onCheckedChange={(checked) => handleSubtaskToggle(subtask.id, !!checked)}
                        aria-label={`Mark subtask ${subtask.title} as complete`}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor={`sidebar-subtask-${task.id}-${subtask.id}`}
                        className={cn("text-sm text-foreground flex-1 cursor-pointer", subtask.completed && "line-through text-muted-foreground")}
                      >
                        {subtask.title}
                      </label>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <Separator />

          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 opacity-70"/>Comments
            </h3>
            <div className="space-y-3 mb-4">
                 {/* Placeholder for actual comments listing */}
                 <p className="text-xs text-muted-foreground text-center py-2">No comments yet.</p>
            </div>
            <div className="flex items-start space-x-2.5 mt-2">
               <UserAvatar
                  firstName={currentUserFirstName}
                  lastName={currentUserLastName}
                  fullName={currentUser?.displayName || undefined}
                  email={currentUserEmail}
                  className="h-7 w-7 text-xs mt-1"
               />
               <div className="flex-1 relative">
                <Textarea placeholder="Add a comment..." className="text-sm min-h-[60px] pr-10 bg-background border-border focus:ring-primary"/>
                <Button variant="ghost" size="icon" className="absolute right-1 bottom-1 h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Paperclip className="h-4 w-4"/>
                    <span className="sr-only">Attach file</span>
                </Button>
               </div>
            </div>
             <div className="flex justify-end mt-2">
                <Button size="sm"><Send className="h-3.5 w-3.5 mr-1.5"/>Post Comment</Button>
             </div>
          </section>

        </div>
      </ScrollArea>
    </div>
  );
}
