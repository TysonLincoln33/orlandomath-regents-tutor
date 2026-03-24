import Link from "next/link";

export const metadata = {
  title: "Book Tutoring",
};

export default function BookPage() {
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Book Tutoring
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Choose a time that works. After booking, you’ll get a confirmation email
              with the online session link.
            </p>
          </div>

          {/* IMPORTANT: Use Link (works in Server Components) */}
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-6 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-base font-semibold text-slate-900">What you’ll get</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>Personalized Regents study plan</li>
              <li>Targeted skill gaps + practice set</li>
              <li>Strategy for maximizing points</li>
              <li>A resume link to keep progress</li>
            </ul>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-900">
                Prefer a quick chat first?
              </div>
              <a
                href="mailto:orlandomath.net@gmail.com"
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
              >
                Email us →
              </a>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Pick a time</h2>
            <p className="mt-2 text-sm text-slate-600">
              This is a Calendly embed. Set <span className="font-mono">NEXT_PUBLIC_CALENDLY_URL</span>{" "}
              to your scheduling link.
            </p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              {calendlyUrl ? (
                <iframe
                  title="Calendly"
                  src={calendlyUrl}
                  className="h-[780px] w-full"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">
                  Calendly URL not set.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
