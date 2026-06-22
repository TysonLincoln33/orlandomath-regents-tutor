import ResetPasswordForm from "../../src/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-slate-900 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Reset Password</h1>

        <p className="mb-6 text-sm text-slate-700">
          Enter a new password for your OrlandoMath Regents Tutor account.
        </p>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
