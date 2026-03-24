"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  /**
   * Called when the modal should close.
   * Kept for backward compatibility.
   */
  onClose?: () => void;
  /**
   * Optional controlled-state callback (Shadcn-style).
   * If provided, we call onOpenChange(false) when the modal closes.
   */
  onOpenChange?: (open: boolean) => void;
};

type EmailStatus =
  | { attempted: false; reason: string }
  | { attempted: true; sent: true; id?: string }
  | { attempted: true; sent: false; error: string };

function getLocalProgress() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("rt_progress_v1");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function toAbsoluteUrl(maybeRelativeUrl: string) {
  if (typeof window === "undefined") return maybeRelativeUrl;
  if (!maybeRelativeUrl) return maybeRelativeUrl;
  // If API returns "/resume/abc", turn it into "http://localhost:3000/resume/abc"
  if (maybeRelativeUrl.startsWith("http://") || maybeRelativeUrl.startsWith("https://")) return maybeRelativeUrl;
  if (maybeRelativeUrl.startsWith("/")) return window.location.origin + maybeRelativeUrl;
  return window.location.origin + "/" + maybeRelativeUrl;
}

export default function SaveMyProgressModal({ open, onClose, onOpenChange }: Props) {
  const close = () => {
    onOpenChange?.(false);
    onClose?.();
  };
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goal, setGoal] = useState("");
  const [testDate, setTestDate] = useState("");

  // Optional: prefill the email field from a locally-stored value (set in the top bar).
  useEffect(() => {
    if (!open) return;
    if (email) return;
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("rt_user_email") || "";
      if (stored) setEmail(stored);
    } catch {
      // ignore
    }
  }, [open, email]);


  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [resumeUrl, setResumeUrl] = useState<string>("");
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);

  const absoluteResumeUrl = useMemo(() => toAbsoluteUrl(resumeUrl), [resumeUrl]);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setErrorMsg("");
      setResumeUrl("");
      setEmailStatus(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    setResumeUrl("");

    const progressJson = getLocalProgress();

    try {
      const res = await fetch("/api/save-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          goal,
          testDate: testDate || undefined,
          progressJson,
          // Backend should send the email (recommended) so the client never handles secrets.
          // Your API can ignore this if you haven't added email sending yet.
          sendWelcomeEmail: true,
        }),
      });

      // Some errors can return empty bodies; guard JSON parsing
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data?.error || "Something went wrong while saving.");
        return;
      }

      setStatus("success");
      setResumeUrl(data?.resumeUrlAbs || data?.resume_url || data?.resumeUrl || "");
      setEmailStatus(data?.email || null);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Network error while saving.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="font-semibold text-slate-900">Save My Progress</div>
          <button onClick={close} className="text-slate-500 hover:text-slate-900" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-slate-600 text-sm">
            Save your progress and get a resume link you can use on any device. We’ll also email you the link so you don’t
            lose it.
          </p>

          <div className="grid gap-3">
            <label className="text-sm text-slate-700">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              Email
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              Goal (optional)
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Pass the Regents in June"
              />
            </label>

            <label className="text-sm text-slate-700">
              Test date (optional)
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                type="date"
              />
            </label>
          </div>

          {status === "success" && (
            <div className="text-sm rounded-lg px-3 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 space-y-2">
              <div className="font-medium">Saved!</div>
              <div>
                Your resume link is ready
                {emailStatus ? (
                  emailStatus.attempted === false ? (
                    <>
                      . Email not sent: <span className="font-medium">{emailStatus.reason}</span>
                    </>
                  ) : emailStatus.sent ? (
                    <>
                      , and has been emailed to <span className="font-medium">{email}</span>.
                    </>
                  ) : (
                    <>
                      . Email failed: <span className="font-medium">{emailStatus.error}</span>
                    </>
                  )
                ) : (
                  <>.</>
                )}
              </div>
              {resumeUrl ? (
                <a className="underline" href={absoluteResumeUrl}>
                  Resume your progress
                </a>
              ) : (
                <div className="text-emerald-800/80">Resume link missing from server response.</div>
              )}
              <div className="text-emerald-800/80">
                Tip: bookmark the link. If email delivery is flaky during development, it will still work.
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-sm rounded-lg px-3 py-2 bg-rose-50 text-rose-800 border border-rose-200">
              {errorMsg}
            </div>
          )}

          {status === "loading" && (
            <div className="text-sm rounded-lg px-3 py-2 bg-slate-50 text-slate-700 border border-slate-200">
              Saving...
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-lg px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {status === "loading" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
