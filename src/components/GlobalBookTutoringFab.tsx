'use client';

import { useRouter, usePathname } from 'next/navigation';

export default function GlobalBookTutoringFab() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide the lower-left button on the dashboard page
  if (pathname?.startsWith('/dashboard')) return null;

  return (
    <button
      onClick={() => router.back()}
      className="no-print fixed bottom-6 left-6 z-[9999] rounded-full bg-blue-600 text-white px-5 py-3 shadow-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold"
    >
      ← Back
    </button>
  );
}
