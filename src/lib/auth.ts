import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase/admin";
import type { Profile, UserRole } from "../types/auth";

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