export type UserRole = "student" | "teacher" | "admin" | "master";
export type ApprovalStatus = "pending" | "approved" | "denied";

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  requested_role: Exclude<UserRole, "master">;
  approval_status: ApprovalStatus;
  email_domain: string | null;
  is_independent: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUserWithProfile {
  id: string;
  email: string | null;
  profile: Profile | null;
}
