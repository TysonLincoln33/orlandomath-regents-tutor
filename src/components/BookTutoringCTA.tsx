"use client";

import Link from "next/link";
import * as React from "react";
import { trackEvent } from "@/lib/analytics";

type Props = {
  variant?: "primary" | "secondary";
  className?: string;
  label?: string;
};

export default function BookTutoringCTA({
  variant = "primary",
  className = "",
  label = "Book Tutoring",
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-3 font-semibold transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300";
  const primary =
    "bg-blue-600 text-white hover:bg-blue-700 ring-1 ring-blue-300/40";
  const secondary =
    "bg-white text-blue-700 hover:bg-blue-50 ring-1 ring-blue-200";

  const style = variant === "primary" ? primary : secondary;

  return (
    <Link
      href="/book"
      onClick={() => trackEvent("book_clicked", { placement: "cta" })}
      className={`${base} ${style} ${className}`}
    >
      {label}
    </Link>
  );
}
