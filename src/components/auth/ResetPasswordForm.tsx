"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function ResetPasswordForm() {
  const supabase = getSupabaseBrowserClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess("Password updated. You can now log in with your new password.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while resetting your password.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div>
        <label
          htmlFor="newPassword"
          className="mb-1 block text-sm font-medium text-slate-800"
        >
          New Password
        </label>

        <input
          id="newPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1 block text-sm font-medium text-slate-800"
        >
          Confirm New Password
        </label>

        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500"
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Updating Password..." : "Update Password"}
      </button>

      <p className="text-center text-sm text-slate-700">
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Back to Log In
        </Link>
      </p>
    </form>
  );
}
