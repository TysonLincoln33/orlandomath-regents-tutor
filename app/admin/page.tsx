"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  canAccessAdminRoute,
  getEmailDomain,
  isAdminRole,
  isMasterRole,
} from "@/lib/auth/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AdminProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
};

type AccessState =
  | { status: "loading" }
  | { status: "allowed"; profile: AdminProfile; accessLabel: string }
  | { status: "pending"; profile: AdminProfile }
  | { status: "denied"; message: string };

export default function AdminFoundationPage() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<AccessState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    async function loadAdminAccess() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, email, full_name, role, requested_role, approval_status, email_domain",
          )
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (error || !data) {
          setAccessState({
            status: "denied",
            message: error?.message || "Could not load your profile.",
          });
          return;
        }

        const profile = data as AdminProfile;

        if (canAccessAdminRoute(profile.role, profile.approval_status)) {
          setAccessState({
            status: "allowed",
            profile,
            accessLabel: isMasterRole(profile.role)
              ? "Master access"
              : "Administrator access",
          });
          return;
        }

        if (
          profile.requested_role === "admin" &&
          profile.approval_status === "pending" &&
          !isAdminRole(profile.role)
        ) {
          setAccessState({ status: "pending", profile });
          return;
        }

        setAccessState({
          status: "denied",
          message: "Administrator access requires an approved administrator account.",
        });
      } catch (error) {
        if (!active) return;

        setAccessState({
          status: "denied",
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong while checking administrator access.",
        });
      }
    }

    void loadAdminAccess();

    return () => {
      active = false;
    };
  }, [router]);

  const domain = useMemo(() => {
    if (accessState.status !== "allowed" && accessState.status !== "pending") {
      return null;
    }

    return accessState.profile.email_domain ?? getEmailDomain(accessState.profile.email);
  }, [accessState]);

  if (accessState.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Administrator
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Checking access...
          </h1>
        </div>
      </main>
    );
  }

  if (accessState.status === "pending") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Approval pending
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Administrator approval pending
          </h1>
          <p className="mt-4 text-slate-700">
            Your administrator request has been received and is pending manual
            approval. You will not have administrator access until your account
            is approved.
          </p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Requested role:</span>{" "}
              {accessState.profile.requested_role}
            </p>
            <p>
              <span className="font-semibold">Approval status:</span>{" "}
              {accessState.profile.approval_status}
            </p>
            {domain && (
              <p>
                <span className="font-semibold">Email domain:</span> {domain}
              </p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Return to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (accessState.status === "denied") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
            Access denied
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Administrator access required
          </h1>
          <p className="mt-4 text-slate-700">{accessState.message}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Return to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-4 py-12">
      <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Administrator foundation
        </p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">
          Administrator access is active
        </h1>
        <p className="mt-4 max-w-3xl text-slate-700">
          This protected route confirms the administrator role foundation is in
          place. Dashboard, analytics, and management tools will be added in a
          future phase.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-500">Access type</p>
            <p className="mt-2 text-xl font-bold text-slate-950">
              {accessState.accessLabel}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-500">Email domain</p>
            <p className="mt-2 text-xl font-bold text-slate-950">
              {domain ?? "Not available"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
