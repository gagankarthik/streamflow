
"use client";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";
import { updateProfile, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Save, KeyRound, ShieldAlert } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const displayName = user.displayName || "";
      const nameParts = displayName.split(" ");
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() });
      // If email is different, update email (requires re-authentication for security)
      if (email !== user.email) {
         toast({ title: "Email Update", description: "Email update requires re-authentication. This feature is complex and not fully implemented in this demo." });
        // Example: await updateEmail(user, email); // This would typically require re-authentication
      }
      toast({ title: "Profile Updated", description: "Your profile information has been saved." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    if (newPassword !== confirmNewPassword) {
      toast({ variant: "destructive", title: "Password Mismatch", description: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
        toast({ variant: "destructive", title: "Password Too Short", description: "New password must be at least 6 characters." });
        return;
    }
    setIsPasswordLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Password Change Failed", description: error.message });
    } finally {
      setIsPasswordLoading(false);
    }
  };


  if (!user) return <div className="flex h-full items-center justify-center"><LoadingSpinner size={32}/></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Manage your personal information and account settings." />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 shadow-lg">
          <CardHeader className="items-center text-center">
            <UserAvatar firstName={firstName} lastName={lastName} className="h-24 w-24 text-4xl mb-4" fallbackClassName="text-4xl"/>
            <CardTitle className="text-2xl">{user.displayName || "User Name"}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* More profile summary info can go here */}
            <p className="text-sm text-muted-foreground">Member since: {user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}</p>
          </CardContent>
        </Card>

        <div className="space-y-6 md:col-span-2">
          <Card className="shadow-lg">
            <form onSubmit={handleProfileUpdate}>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your first name, last name, and email address.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={isLoading} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
                   <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldAlert className="h-3 w-3"/>Changing email requires re-authentication (demo limitation).</p>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <LoadingSpinner className="mr-2"/> : <Save className="mr-2 h-4 w-4" />} Save Changes
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="shadow-lg">
             <form onSubmit={handleChangePassword}>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password. Ensure it's strong and unique.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isPasswordLoading} required/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isPasswordLoading} required/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <Input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={isPasswordLoading} required/>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isPasswordLoading}>
                  {isPasswordLoading ? <LoadingSpinner className="mr-2"/> : <KeyRound className="mr-2 h-4 w-4" />} Change Password
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
