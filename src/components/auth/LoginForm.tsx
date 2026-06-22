"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail) {
        throw new Error("Please enter your email.");
      }

      if (!password) {
        throw new Error("Please enter your password.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong during login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    setResetLoading(true);
    setError("");
    setSuccess("");

    try {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail) {
        throw new Error("Please enter your email before requesting a password reset.");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        throw resetError;
      }

      setSuccess(
        "If an account exists for that email, a password reset link has been sent."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while requesting a password reset.";
      setError(message);
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-800">
          Email
        </label>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500"
          autoComplete="email"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label htmlFor="password" className="block text-sm font-medium text-slate-800">
            Password
          </label>

          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resetLoading || loading}
            className="text-sm font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetLoading ? "Sending..." : "Forgot password?"}
          </button>
        </div>

        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500"
          autoComplete="current-password"
        />
      </div>

      {success && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Logging In..." : "Log In"}
      </button>
    </form>
  );
}