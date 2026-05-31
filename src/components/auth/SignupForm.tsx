"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<
    "student" | "teacher" | "admin"
  >("student");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const trimmedName = fullName.trim();
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedName) {
        throw new Error("Please enter your full name.");
      }

      if (!trimmedEmail) {
        throw new Error("Please enter your email.");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            requested_role: accountType,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        if (accountType === "teacher") {
          setSuccess(
            "Teacher signup submitted. Your account is pending approval. Redirecting to login..."
          );
        } else if (accountType === "admin") {
          setSuccess(
            "Administrator signup submitted. Your account is pending approval. Redirecting to login..."
          );
        } else {
          setSuccess("Account created successfully. Redirecting to login...");
        }

        setFullName("");
        setEmail("");
        setPassword("");
        setAccountType("student");

        setTimeout(() => {
          router.push("/login");
        }, 1200);
      } else {
        setSuccess(
          "Signup submitted. Please check your email if confirmation is required."
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong during signup.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div>
        <label
          htmlFor="fullName"
          className="mb-1 block text-sm font-medium text-black"
        >
          Full Name
        </label>

        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black outline-none focus:border-blue-500"
          autoComplete="name"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-black"
        >
          Email
        </label>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black outline-none focus:border-blue-500"
          autoComplete="email"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-black"
        >
          Password
        </label>

        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black outline-none focus:border-blue-500"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-black">
          Account Type
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <label className="flex items-center gap-2 text-sm text-black">
            <input
              type="radio"
              name="accountType"
              value="student"
              checked={accountType === "student"}
              onChange={() => setAccountType("student")}
            />
            Student
          </label>

          <label className="flex items-center gap-2 text-sm text-black">
            <input
              type="radio"
              name="accountType"
              value="teacher"
              checked={accountType === "teacher"}
              onChange={() => setAccountType("teacher")}
            />
            Teacher (requires approval)
          </label>

          <label className="flex items-center gap-2 text-sm text-black">
            <input
              type="radio"
              name="accountType"
              value="admin"
              checked={accountType === "admin"}
              onChange={() => setAccountType("admin")}
            />
            Administrator (requires approval)
          </label>
        </div>
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
        {loading ? "Creating Account..." : "Create Account"}
      </button>
    </form>
  );
}