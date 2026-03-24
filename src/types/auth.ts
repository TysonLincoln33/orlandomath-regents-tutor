export type UserRole = "student" | "teacher" | "admin";

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  is_independent: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUserWithProfile {
  id: string;
  email: string | null;
  profile: Profile | null;
}