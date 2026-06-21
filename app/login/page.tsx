import * as React from "react";
import Link from "next/link";
import LoginForm from "../../src/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-slate-900 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Log In</h1>

        <p className="mb-6 text-sm text-slate-700">
          Access your OrlandoMath Regents Tutor account.
        </p>

        <LoginForm />

        <p className="mt-6 text-sm text-slate-700">
          Need an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-blue-600 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}