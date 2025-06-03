
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/icons";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to login. Please check your credentials.");
      toast({ variant: "destructive", title: "Login Failed", description: err.message || "Please check your credentials." });
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
          <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
          <CardDescription className="pt-1">Sign in to access your StreamFlow dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6 pt-4">
          <form onSubmit={handleLogin} className="space-y-4">
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive pt-1">{error}</p>}
            <Button type="submit" className="w-full !mt-6" disabled={isLoading}>
              {isLoading ? <LoadingSpinner className="mr-2" /> : null}
              Sign In with Email
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-3 pb-8">
          <Link href="/forgot-password" passHref legacyBehavior>
            <a className="text-sm text-primary hover:underline">Forgot password?</a>
          </Link>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" passHref legacyBehavior>
              <a className="font-semibold text-primary hover:underline">Sign up</a>
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
