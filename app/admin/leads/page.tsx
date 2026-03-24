import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

type LeadRow = {
  created_at: string;
  name: string;
  email: string;
  resume_token: string;
  goal: string | null;
  test_date: string | null;
};

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const key = searchParams?.key ?? "";
  const expected = process.env.ADMIN_KEY ?? "";

  // Simple protection (Step 10 MVP). If no ADMIN_KEY set, treat as locked.
  if (!expected || key !== expected) notFound();

  const { data, error } = await supabaseServer
    .from("progress_saves")
    .select("created_at,name,email,resume_token,goal,test_date")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as LeadRow[];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Leads</h1>
            <p className="text-sm text-slate-600">
              Latest Save-My-Progress submissions (max 200).
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {error ? (
          <div className="rounded-xl bg-white p-6 shadow ring-1 ring-slate-200">
            <p className="font-semibold text-red-600">Error loading leads</p>
            <pre className="mt-3 overflow-auto text-xs text-slate-700">{error.message}</pre>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Goal</th>
                  <th className="px-4 py-3">Test Date</th>
                  <th className="px-4 py-3">Resume</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.created_at + r.resume_token} className="border-t">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-4 py-3 text-slate-700">{r.email}</td>
                    <td className="px-4 py-3 text-slate-700">{r.goal ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.test_date ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="text-blue-700 underline"
                        href={`/resume/${r.resume_token}`}
                      >
                        /resume/{r.resume_token}
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-600" colSpan={6}>
                      No leads yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 rounded-xl bg-white p-5 text-sm text-slate-700 shadow ring-1 ring-slate-200">
          <p className="font-semibold">Access</p>
          <p className="mt-1">
            This page is protected by a query key. Set <code className="rounded bg-slate-100 px-1">ADMIN_KEY</code>{" "}
            in <code className="rounded bg-slate-100 px-1">.env.local</code>, then visit:
          </p>
          <p className="mt-2 font-mono text-xs">
            /admin/leads?key=YOUR_ADMIN_KEY
          </p>
        </div>
      </div>
    </div>
  );
}
