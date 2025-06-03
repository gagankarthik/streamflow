
"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// This page component's sole purpose is to redirect to the default 'overview' tab.
export default function ProjectBasePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}/overview`);
    }
  }, [projectId, router]);

  // Optionally, render a loading state or null while redirecting
  return null; 
}
