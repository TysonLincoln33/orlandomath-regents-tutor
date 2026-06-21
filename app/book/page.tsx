import Link from "next/link";

export const metadata = {
  title: "Book Tutoring",
};

const CONTACT_EMAIL = "orlandomath.net@gmail.com";

const tutoringBenefits = [
  "Personalized Regents study plan",
  "Targeted skill gaps + practice set",
  "Algebra 1 support",
  "Strategy for maximizing points",
];

const chatBenefits = [
  "Ask questions before booking",
  "Discuss goals",
  "Decide whether tutoring is the right fit",
  "No commitment",
];

type BookingCardProps = {
  title: string;
  description: string;
  benefits: string[];
  buttonLabel: string;
  href: string;
  isExternalBookingLink: boolean;
};

function buildMailto(subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${CONTACT_EMAIL}?${params.toString()}`;
}

function BookingCard({
  title,
  description,
  benefits,
  buttonLabel,
  href,
  isExternalBookingLink,
}: BookingCardProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex-1">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <a
        href={href}
        target={isExternalBookingLink ? "_blank" : undefined}
        rel={isExternalBookingLink ? "noreferrer" : undefined}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm ring-1 ring-blue-300/40 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        {buttonLabel}
      </a>

      {!isExternalBookingLink && (
        <p className="mt-3 text-center text-xs text-slate-500">
          Scheduling link coming soon — this opens a prefilled email instead.
        </p>
      )}
    </section>
  );
}

export default function BookPage() {
  const tutoringBookingUrl =
    process.env.NEXT_PUBLIC_TUTORING_BOOKING_URL ||
    process.env.NEXT_PUBLIC_CALENDLY_URL ||
    "";
  const chatBookingUrl = process.env.NEXT_PUBLIC_CHAT_BOOKING_URL || "";

  const tutoringHref = tutoringBookingUrl || buildMailto(
    "Tutoring Session Request",
    "Hi OrlandoMath, I would like to book a tutoring session. Please send me the next available times."
  );
  const chatHref = chatBookingUrl || buildMailto(
    "Schedule Chat Request",
    "Hi OrlandoMath, I would like to schedule a quick chat to ask questions and discuss tutoring goals."
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
              Regents Algebra 1 Support
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Book Regents Tutoring
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Choose the path that fits where you are right now: book a tutoring
              session for focused Algebra 1 help, or schedule a no-pressure chat
              to ask questions first.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-6 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <BookingCard
            title="Book Tutoring Session"
            description="Schedule paid support for Regents prep, Algebra 1 skill gaps, homework help, and ongoing academic support."
            benefits={tutoringBenefits}
            buttonLabel="Book Tutoring Session"
            href={tutoringHref}
            isExternalBookingLink={Boolean(tutoringBookingUrl)}
          />

          <BookingCard
            title="Schedule Chat"
            description="Have questions before booking? Set up a quick consultation to discuss goals and decide whether tutoring is the right fit."
            benefits={chatBenefits}
            buttonLabel="Schedule Chat"
            href={chatHref}
            isExternalBookingLink={Boolean(chatBookingUrl)}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/80 p-5 text-sm text-slate-700">
          <p className="font-bold text-slate-900">Prefer email?</p>
          <p className="mt-1">
            Send a note to{" "}
            <a className="font-semibold text-blue-700 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{" "}
            and include your student&apos;s current Algebra 1 goals, Regents timeline,
            and what kind of support would help most.
          </p>
        </div>
      </div>
    </main>
  );
}
