"use client";

import * as React from "react";
import { trackEvent } from "@/lib/analytics";
import { useRouter } from "next/navigation";

type ResumeOk = { ok: true; progress_json: any; created_at?: string | null };
type ResumeErr = { ok: false; code?: string; error: string };
type ResumeResponse = ResumeOk | ResumeErr;

function setResumeNotice(message: string, type: "success" | "error" | "info" = "info") {
  try {
    window.localStorage.setItem(
      "rt_resume_notice",
      JSON.stringify({ message, type, ts: Date.now() })
    );
  } catch {
    // ignore
  }
}

export default function ResumeClient({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = React.useState<string>("Restoring your progress...");
  const [detail, setDetail] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(`/api/resume?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });

        const data = (await res.json()) as ResumeResponse;

        if (!res.ok || !data || data.ok !== true) {
          const errMsg = (data as any)?.error || "Unable to restore progress.";
          const code = (data as any)?.code || (res.status === 404 ? "NOT_FOUND" : "ERROR");
          throw Object.assign(new Error(errMsg), { code, status: res.status });
        }

        // Restore Level-1 progress to localStorage (same key your app uses)
        const payload = {
          sections: data.progress_json?.sections ?? data.progress_json ?? {},
          updatedAt: Date.now(),
        };

        window.localStorage.setItem("rt_progress_v1", JSON.stringify(payload));

        if (cancelled) return;

        setStatus("done");
        setMessage("Progress restored! Redirecting to your dashboard...");

        setResumeNotice("Welcome back — your progress has been restored.", "success");

        // Guardrail: never keep users on /resume/* after success
        router.replace("/dashboard");
      } catch (err: any) {
        if (cancelled) return;

        setStatus("error");

        const code = err?.code || "ERROR";
        const msg = err?.message || "Unexpected error while restoring progress.";

        setMessage("We couldn't restore your progress.");
        setDetail(msg);

        // Helpful dashboard messaging
        if (code === "EXPIRED") {
          setResumeNotice("Your resume link expired. Please save again to get a fresh link.", "error");
        } else if (code === "NOT_FOUND") {
          setResumeNotice("That resume link is invalid or expired. Please save again to get a new one.", "error");
        } else if (code === "NO_PROGRESS") {
          setResumeNotice("We found your link, but no saved progress was attached to it.", "info");
        } else {
          setResumeNotice("We hit a problem restoring progress. Please try again.", "error");
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-slate-900">Resume your progress</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          {detail && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              {detail}
            </div>
          )}

          {status === "error" && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.replace("/dashboard")}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                Go to Dashboard
              </button>
              <button
                type="button"
                onClick={() => router.replace("/dashboard")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Save Again from Dashboard
              </button>
            </div>
          )}

          <div className="mt-8 text-xs text-slate-500">
            Token: <span className="font-mono">{token}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
