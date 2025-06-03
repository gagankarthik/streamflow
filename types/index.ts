
export type ProjectRole = "Owner" | "Admin" | "Editor" | "Viewer";

export interface ProjectTeamMember {
  id: string; // Firebase User UID
  email: string;
  name: string;
  role: ProjectRole;
  firstName?: string; // Optional, if available
  lastName?: string; // Optional, if available
}

// Keep existing Assignee type if used elsewhere, or consolidate.
// For task assignment, we might primarily need email and name initially.
export interface Assignee {
  email: string;
  name: string;
  id?: string; // Firebase User UID, if resolved
  // Role here might be redundant if task permissions are derived from project roles.
}
