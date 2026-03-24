'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import RainbowBar from '@/components/progress/RainbowBar';
import { SECTIONS } from '@/lib/course/algebra1';
import {
  getSectionStatus,
  setSectionStatus,
  type SectionStatus,
} from '@/lib/progress/progress';

function completionPctFromStatus(status: SectionStatus): number {
  switch (status) {
    case 'complete':
      return 100;
    case 'in_progress':
      return 50;
    case 'not_started':
    default:
      return 0;
  }
}

export default function SectionClient({ sectionId }: { sectionId: string }) {
  const section = useMemo(() => SECTIONS.find((s) => s.id === sectionId), [sectionId]);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick((t) => t + 1);
  }, []);

  const status = useMemo(
    () => getSectionStatus(sectionId) ?? 'not_started',
    [sectionId, tick]
  );

  const pct = useMemo(() => completionPctFromStatus(status), [status]);

  if (!section) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="rounded-2xl border bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-bold">Section not found</h1>
          <p className="mt-2 text-slate-600">
            We couldn&apos;t find a section matching {sectionId}.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block text-blue-600 hover:underline"
          >
            Return to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{section.title}</h1>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {section.id}
              </span>

              <span
                className={
                  status === 'complete'
                    ? 'rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700'
                    : status === 'in_progress'
                      ? 'rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700'
                      : 'rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700'
                }
              >
                {status === 'complete'
                  ? 'Complete'
                  : status === 'in_progress'
                    ? 'In progress'
                    : 'Not started'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <Link
                href={`/chapter/${section.chapterId}`}
                className="text-blue-600 hover:underline"
              >
                Back to chapter
              </Link>
              <span className="text-slate-300">•</span>
              <Link href="/dashboard" className="text-blue-600 hover:underline">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSectionStatus(sectionId, 'not_started')}
              className={
                status === 'not_started'
                  ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white'
                  : 'rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
              }
            >
              Not started
            </button>

            <button
              type="button"
              onClick={() => setSectionStatus(sectionId, 'in_progress')}
              className={
                status === 'in_progress'
                  ? 'rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white'
                  : 'rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
              }
            >
              In progress
            </button>

            <button
              type="button"
              onClick={() => setSectionStatus(sectionId, 'complete')}
              className={
                status === 'complete'
                  ? 'rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white'
                  : 'rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
              }
            >
              Complete
            </button>
          </div>
        </div>

        <div className="mt-5">
          <RainbowBar
            value={pct}
            heightPx={12}
            labelLeft="Section progress"
            labelRight={`${pct}%`}
          />
        </div>
      </div>

      <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Section workspace</h2>
        <p className="mt-2 text-slate-600">
          This is where the practice, notes, and mini-assessments for{' '}
          <span className="font-semibold">{section.id}</span> will live.
        </p>
        <p className="mt-2 text-slate-600">
          Next step: drop in the section content component(s) and wire up per-problem
          progress so the bar reflects real completion.
        </p>
      </div>
    </main>
  );
}