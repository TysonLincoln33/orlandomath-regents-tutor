import * as React from "react";
import Link from "next/link";
import SignupForm from "../../src/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold">Create Your Account</h1>

        <p className="mb-6 text-sm text-gray-600">
          Sign up for OrlandoMath Regents Tutor.
        </p>

        <SignupForm />

        <p className="mt-6 text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}