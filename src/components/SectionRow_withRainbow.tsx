'use client';

import * as React from 'react';
import RainbowBar from '@/components/progress/RainbowBar';

type SectionStatus = 'not_started' | 'in_progress' | 'complete';

export type SectionRowSection = {
  id: string;
  title: string;
  sublabel?: string;
  // Optional standards payload (only rendered when showStandards=true)
  standards?: string[]; // e.g., ["A1.A.1", "A1.A.2"]
  // Optional exam weight for the section (not required)
  points?: number;
};

export default function SectionRow(props: {
  section: SectionRowSection;
  status: SectionStatus;
  onStatusChange: (next: SectionStatus) => void;
  showStandards?: boolean;
}) {
  const { section, status, onStatusChange, showStandards } = props;

  // Nested "Russian-doll" rainbow progress bar for each section.
  // Since we don't yet track per-question progress, we map status -> %.
  const pct = status === 'complete' ? 100 : status === 'in_progress' ? 50 : 0;

  const pill = (label: string, active: boolean) =>
    `inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
    }`;

  const btn = (s: SectionStatus) =>
    `rounded-md border px-3 py-1.5 text-xs font-medium transition ${
      status === s
        ? 'border-blue-600 bg-blue-600 text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{section.title}</span>
            <span className={pill(section.id, false)}>{section.id}</span>
            {status === 'complete' && <span className={pill('Complete', true)}>Complete</span>}
            {status === 'in_progress' && <span className={pill('In progress', true)}>In progress</span>}
            {status === 'not_started' && <span className={pill('Not started', true)}>Not started</span>}
          </div>

          {section.sublabel && (
            <div className="mt-1 text-sm text-slate-600">
              {section.sublabel}
            </div>
          )}

          <div className="mt-3">
            <RainbowBar
              value={pct}
              heightPx={8}
              labelLeft="Section progress"
              labelRight={`${pct}%`}
            />
          </div>

          {showStandards && section.standards && section.standards.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {section.standards.map((st) => (
                <span key={st} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {st}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-xs text-slate-500">Status</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn('not_started')} onClick={() => onStatusChange('not_started')}>
              Not started
            </button>
            <button type="button" className={btn('in_progress')} onClick={() => onStatusChange('in_progress')}>
              In progress
            </button>
            <button type="button" className={btn('complete')} onClick={() => onStatusChange('complete')}>
              Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
