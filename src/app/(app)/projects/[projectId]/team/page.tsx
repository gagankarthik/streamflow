
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase"; // Assuming auth is exported for user UID
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, Timestamp, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddTeamMemberForm, type AddTeamMemberFormValues } from "@/components/forms/add-team-member-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users as UsersIcon, XSquare, ServerCrash, Edit3, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ProjectTeamMember, ProjectRole } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label"; // Added Label import

interface ProjectDataForTeam {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  ownerName?: string; // Added ownerName for consistency
  team: ProjectTeamMember[];
}

const getRoleBadgeVariant = (role: ProjectTeamMember["role"]) => {
  switch (role) {
    case "Owner": return "default";
    case "Admin": return "destructive";
    case "Editor": return "secondary";
    case "Viewer": return "outline";
    default: return "outline";
  }
};

const availableRoles: ProjectRole[] = ["Viewer", "Editor", "Admin"];


export default function ProjectTeamPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const projectId = params.projectId as string;
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectDataForTeam | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectTeamMember | null>(null);
  const [memberToEditRole, setMemberToEditRole] = useState<ProjectTeamMember | null>(null);
  const [newRoleForEdit, setNewRoleForEdit] = useState<ProjectRole | "">("");
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !projectId) {
      if (!authLoading && !user) router.replace("/login");
      return;
    }

    setIsLoadingProject(true);
    const projectDocRef = doc(db, "projects", projectId);
    const unsubscribe = onSnapshot(projectDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
         setProject({
            id: docSnap.id,
            name: data.name || "Unnamed Project",
            ownerId: data.ownerId,
            ownerEmail: data.ownerEmail,
            ownerName: data.ownerName || data.ownerEmail?.split('@')[0] || "Owner", // Ensure ownerName is populated
            team: (data.team || []).map((member: any) => ({
                ...member,
                role: member.role || "Viewer"
            })),
        } as ProjectDataForTeam);
      } else {
        toast({ variant: "destructive", title: "Not Found", description: "Project not found." });
        setProject(null);
      }
      setIsLoadingProject(false);
    }, (error) => {
      console.error("Error fetching project for team page: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load project data." });
      setIsLoadingProject(false);
    });

    return () => unsubscribe();
  }, [projectId, user, authLoading, router, toast]);

  const handleAddTeamMember = async (values: AddTeamMemberFormValues) => {
    if (!project || !user || project.ownerId !== user.uid) {
      toast({ variant: "destructive", title: "Unauthorized", description: "Only project owners can add members." });
      return;
    }
    
    setIsUpdatingTeam(true);
    
    const newMember: ProjectTeamMember = {
        id: values.email, 
        email: values.email,
        name: values.email.split('@')[0], 
        role: values.role as ProjectRole
    };

    try {
      const projectRef = doc(db, "projects", projectId);
      await updateDoc(projectRef, {
        team: arrayUnion(newMember),
        memberEmails: arrayUnion(values.email), 
        updatedAt: Timestamp.now(),
      });
      toast({ title: "Member Added", description: `${values.email} has been added as a ${values.role}.` });
      setIsAddMemberDialogOpen(false);
    } catch (error: any) {
      console.error("Error adding team member: ", error);
      toast({ variant: "destructive", title: "Failed to Add Member", description: error.message });
    } finally {
      setIsUpdatingTeam(false);
    }
  };
  
  const confirmRemoveMember = (member: ProjectTeamMember) => {
    setMemberToRemove(member);
  };

  const handleRemoveTeamMember = async () => {
    if (!project || !memberToRemove || !user || project.ownerId !== user.uid) {
      toast({ variant: "destructive", title: "Unauthorized", description: "Cannot remove member." });
      setMemberToRemove(null);
      return;
    }
     if (memberToRemove.email === project.ownerEmail || memberToRemove.role === "Owner") {
        toast({ variant: "destructive", title: "Action Not Allowed", description: "The project owner cannot be removed or have their role changed here." });
        setMemberToRemove(null);
        return;
    }

    setIsUpdatingTeam(true);
    try {
      const projectRef = doc(db, "projects", projectId);
      const memberObjectToRemove = project.team.find(m => m.email === memberToRemove.email);

      if(memberObjectToRemove){
        await updateDoc(projectRef, {
            team: arrayRemove(memberObjectToRemove),
            memberEmails: arrayRemove(memberToRemove.email),
            updatedAt: Timestamp.now(),
        });
        toast({ title: "Member Removed", description: `${memberToRemove.email} has been removed.` });
      } else {
         toast({ title: "Error", description: `Could not find member ${memberToRemove.email} to remove.` });
      }
      setMemberToRemove(null);
    } catch (error: any) {
      console.error("Error removing team member: ", error);
      toast({ variant: "destructive", title: "Failed to Remove", description: error.message });
    } finally {
      setIsUpdatingTeam(false);
    }
  };

  const openEditRoleModal = (member: ProjectTeamMember) => {
    if (member.role === "Owner" || member.email === project?.ownerEmail) {
        toast({ title: "Action Not Allowed", description: "The project owner's role cannot be changed here." });
        return;
    }
    setMemberToEditRole(member);
    setNewRoleForEdit(member.role);
  };

  const handleUpdateMemberRole = async () => {
    if (!project || !memberToEditRole || !newRoleForEdit || !user || project.ownerId !== user.uid) {
      toast({ variant: "destructive", title: "Error", description: "Invalid data for role update or unauthorized." });
      return;
    }
    if (memberToEditRole.role === "Owner" || memberToEditRole.email === project.ownerEmail ) {
        toast({ variant: "destructive", title: "Action Not Allowed", description: "Cannot change the owner's role from this interface." });
        setMemberToEditRole(null);
        return;
    }

    setIsUpdatingTeam(true);
    try {
        const projectRef = doc(db, "projects", projectId);
        const currentTeam = project.team;
        const updatedTeam = currentTeam.map(member => 
            member.email === memberToEditRole.email ? { ...member, role: newRoleForEdit as ProjectRole } : member
        );

        await updateDoc(projectRef, {
            team: updatedTeam,
            updatedAt: Timestamp.now(),
        });
        toast({ title: "Role Updated", description: `${memberToEditRole.name}'s role changed to ${newRoleForEdit}.` });
        setMemberToEditRole(null);
    } catch (error: any) {
        console.error("Error updating member role:", error);
        toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
        setIsUpdatingTeam(false);
    }
  };


  if (isLoadingProject || authLoading) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner size={32} /> <span className="ml-2 text-muted-foreground">Loading team...</span></div>;
  }

  if (!project) {
    return (
      <div className="py-6 text-center">
        <ServerCrash className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-lg text-destructive">Project data unavailable.</p>
        <p className="text-sm text-muted-foreground">Could not load team management for this project.</p>
      </div>
    );
  }
  
  const isCurrentUserOwner = project.ownerId === user?.uid;
  const canManageTeam = isCurrentUserOwner;


  return (
    <div className="space-y-6 py-4">
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center"><UsersIcon className="mr-2 h-5 w-5 text-primary"/>Team Members ({project.team?.length || 0})</CardTitle>
            <CardDescription>Manage who has access to this project and their roles.</CardDescription>
          </div>
          {canManageTeam && (
            <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
              <DialogTrigger asChild>
                <Button className="mt-2 sm:mt-0 w-full sm:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Team Member</DialogTitle>
                  <DialogDescription>Invite by email and assign a role.</DialogDescription>
                </DialogHeader>
                <AddTeamMemberForm
                    onSubmitSuccess={handleAddTeamMember}
                    onDialogClose={() => setIsAddMemberDialogOpen(false)}
                    currentTeamEmails={project.team.map(m => m.email)}
                    projectOwnerEmail={project.ownerEmail}
                />
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {project.team && project.team.length > 0 ? (
            <div className="space-y-4">
              {project.team.map((member) => (
                <div key={member.id || member.email} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                        email={member.email}
                        fullName={member.name || member.email.split('@')[0]}
                        className="h-9 w-9"
                    />
                    <div>
                      <p className="font-medium text-foreground">{member.name || member.email.split('@')[0]}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize h-6 px-2.5 text-xs">
                      {member.role}
                    </Badge>
                    {canManageTeam && member.role !== "Owner" && member.email !== project.ownerEmail && (
                      <>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-8 w-8" onClick={() => openEditRoleModal(member)} disabled={isUpdatingTeam}>
                            <ShieldCheck className="h-4 w-4" />
                            <span className="sr-only">Edit role for {member.name}</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => confirmRemoveMember(member)} disabled={isUpdatingTeam}>
                            <XSquare className="h-4 w-4" />
                            <span className="sr-only">Remove {member.name}</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UsersIcon className="mx-auto h-10 w-10 mb-3" />
              <p className="text-lg">No team members added yet (besides the owner).</p>
               {canManageTeam && <p className="text-sm">Add members to collaborate on this project.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {memberToRemove && (
        <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
              <AlertDialogDescription>
                Remove <span className="font-semibold">{memberToRemove.name}</span> ({memberToRemove.email}) from the project? They will lose access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMemberToRemove(null)} disabled={isUpdatingTeam}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveTeamMember} className="bg-destructive hover:bg-destructive/90" disabled={isUpdatingTeam}>
                {isUpdatingTeam ? <LoadingSpinner className="mr-2 h-4 w-4"/> : null}
                Yes, remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {memberToEditRole && (
        <Dialog open={!!memberToEditRole} onOpenChange={(open) => !open && setMemberToEditRole(null)}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Change Role for {memberToEditRole.name}</DialogTitle>
                    <DialogDescription>Select a new role for {memberToEditRole.email}.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3">
                    <Label htmlFor="role-select">New Role</Label>
                    <Select value={newRoleForEdit} onValueChange={(value) => setNewRoleForEdit(value as ProjectRole)}>
                        <SelectTrigger id="role-select">
                            <SelectValue placeholder="Select new role" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableRoles.map(role => (
                                <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setMemberToEditRole(null)} disabled={isUpdatingTeam}>Cancel</Button>
                    <Button onClick={handleUpdateMemberRole} disabled={isUpdatingTeam || !newRoleForEdit || newRoleForEdit === memberToEditRole.role}>
                        {isUpdatingTeam ? <LoadingSpinner className="mr-2 h-4 w-4"/> : <ShieldCheck className="mr-2 h-4 w-4"/>}
                        Update Role
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

    