
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/icons";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Separator } from "@/components/ui/separator";

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password.length < 6) {
      setError("Password should be at least 6 characters long.");
      setIsLoading(false);
      toast({ variant: "destructive", title: "Signup Failed", description: "Password should be at least 6 characters long." });
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() });
      
      await sendEmailVerification(user);

      toast({ 
        title: "Signup Successful!", 
        description: "A verification email has been sent. Please check your inbox." 
      });
      router.push("/login"); 

    } catch (err: any) {
      setError(err.message || "Failed to sign up. Please try again.");
      toast({ variant: "destructive", title: "Signup Failed", description: err.message || "An error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/30 dark:from-background dark:via-background dark:to-secondary/30">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pt-8">
           <Link href="/" className="mx-auto mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
              <Icons.ProjectFlowLogo className="h-7 w-auto" />
            </div>
          </Link>
          <CardTitle className="text-3xl font-bold">Create your Account</CardTitle>
          <CardDescription className="pt-1">Join StreamFlow to manage your projects efficiently.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6 pt-4">
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="•••••••• (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive pt-1">{error}</p>}
            <Button type="submit" className="w-full !mt-6" disabled={isLoading}>
              {isLoading ? <LoadingSpinner className="mr-2" /> : null}
              Create Account with Email
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center pb-8">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" passHref legacyBehavior>
              <a className="font-semibold text-primary hover:underline">Sign in</a>
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
