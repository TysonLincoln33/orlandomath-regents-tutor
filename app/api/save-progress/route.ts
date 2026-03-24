import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { sendSaveProgressEmail } from "@/lib/email";

type Body = {
  name: string;
  email: string;
  goal?: string;
  testDate?: string; // "YYYY-MM-DD" (or any ISO date string)
  progressJson: any; // snapshot object from client
  leadContext?: any;
  sendWelcomeEmail?: boolean;
};

function makeToken() {
  // 24 chars URL-safe
  return crypto.randomBytes(18).toString("base64url");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // Basic validation
    if (!body?.name?.trim() || !body?.email?.trim()) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    const resume_token = makeToken();

    const insertPayload = {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      goal: body.goal?.trim() || null,
      test_date: body.testDate || null,
      progress_json: {
        ...(body.progressJson ?? {}),
        _leadContext: body.leadContext ?? null,
      },
      resume_token,
    };

    const { error } = await supabaseServer.from("progress_saves").insert(insertPayload);

    if (error) {
      // Helpful server log for debugging
      console.error("[save-progress] supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Step 10.2: confirmation email (server-side; secrets stay on server)
    if (body.sendWelcomeEmail) {
      const host =
        req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
      const proto = req.headers.get("x-forwarded-proto") ?? "http";
      const baseUrl = host ? `${proto}://${host}` : "";

      const resumeUrlAbs = baseUrl
        ? `${baseUrl}/resume/${resume_token}`
        : `/resume/${resume_token}`;
      const dashboardUrlAbs = baseUrl ? `${baseUrl}/dashboard` : `/dashboard`;

      // Fire-and-forget; do not block API response on email
      sendSaveProgressEmail({
        to: insertPayload.email,
        name: insertPayload.name,
        resumeUrl: resumeUrlAbs,
        dashboardUrl: dashboardUrlAbs,
      }).catch((e) => {
        console.error("[save-progress] email send failed:", e);
      });
    }

    return NextResponse.json({
      ok: true,
      resume_token,
      resume_url: `/resume/${resume_token}`,
    });
  } catch (e: any) {
    console.error("[save-progress] unhandled error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
