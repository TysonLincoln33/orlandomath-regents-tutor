import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase/admin";
import type { Profile, UserRole } from "../types/auth";
import {
  canAccessAdminRoute,
  getEmailDomain,
  isAdminRole,
  isApprovedStatus,
} from "./auth/roles";

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", error.message);
    return null;
  }

  return data as Profile | null;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile by email:", error.message);
    return null;
  }

  return data as Profile | null;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile by username:", error.message);
    return null;
  }

  return data as Profile | null;
}


export function getProfileEmailDomain(
  profile: Pick<Profile, "email" | "email_domain"> | null,
): string | null {
  return profile?.email_domain ?? getEmailDomain(profile?.email);
}

export function isApprovedProfile(
  profile: Pick<Profile, "approval_status"> | null,
): boolean {
  return isApprovedStatus(profile?.approval_status);
}

export function isAdminProfile(
  profile: Pick<Profile, "role"> | null,
): boolean {
  return isAdminRole(profile?.role);
}

export function canProfileAccessAdmin(
  profile: Pick<Profile, "role" | "approval_status"> | null,
): boolean {
  return canAccessAdminRoute(profile?.role, profile?.approval_status);
}

export function getUserRole(profile: Profile | null): UserRole | null {
  return profile?.role ?? null;
}

export function isRole(profile: Profile | null, role: UserRole): boolean {
  return profile?.role === role;
}

export function hasAnyRole(profile: Profile | null, roles: UserRole[]): boolean {
  if (!profile) return false;
  return roles.includes(profile.role);
}

export function requireAuthenticatedUser(user: User | null): asserts user is User {
  if (!user) {
    throw new Error("User is not authenticated.");
  }
}

export function requireProfile(profile: Profile | null): asserts profile is Profile {
  if (!profile) {
    throw new Error("Profile not found.");
  }
}

export function requireRole(profile: Profile | null, role: UserRole): asserts profile is Profile {
  if (!profile || profile.role !== role) {
    throw new Error(`Access denied. Required role: ${role}`);
  }
}