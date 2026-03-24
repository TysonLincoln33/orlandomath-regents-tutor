import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/resume?token=...
 *
 * Responses:
 * - 200: { ok: true, progress_json: <json>, created_at?: <iso> }
 * - 400: { ok: false, code: "MISSING_TOKEN" | "INVALID_TOKEN", error: string }
 * - 404: { ok: false, code: "NOT_FOUND", error: string }
 * - 410: { ok: false, code: "EXPIRED", error: string }
 * - 422: { ok: false, code: "NO_PROGRESS", error: string }
 *
 * Notes:
 * - no-store caching so links always restore latest saved progress.
 * - permissive token validation (tokens are generated server-side).
 */
const RESUME_LINK_TTL_DAYS = 30;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store",
    },
  });
}

function json(
  body: Record<string, any>,
  status: number,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(extraHeaders || {}) },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return json(
        { ok: false, code: "MISSING_TOKEN", error: "Missing resume token." },
        400
      );
    }

    // Light sanity check
    if (token.length < 8) {
      return json(
        { ok: false, code: "INVALID_TOKEN", error: "Invalid resume token." },
        400
      );
    }

    // Fetch progress + (optionally) created_at for expiry checks.
    // If created_at doesn't exist in your table, Supabase will error — so we fall back to progress_json only.
    let data: any = null;

    // Try with created_at first
    const attempt1 = await supabaseServer
      .from("progress_saves")
      .select("progress_json, created_at")
      .eq("resume_token", token)
      .single();

    if (!attempt1.error && attempt1.data) {
      data = attempt1.data;
    } else {
      // Fallback: older schema without created_at selected
      const attempt2 = await supabaseServer
        .from("progress_saves")
        .select("progress_json")
        .eq("resume_token", token)
        .single();

      if (attempt2.error || !attempt2.data) {
        // Not found
        console.warn("[resume] token not found", { token });
        return json(
          { ok: false, code: "NOT_FOUND", error: "Invalid or expired link." },
          404
        );
      }

      data = attempt2.data;
    }

    const progress = data?.progress_json ?? {};

    // Expiry (only if we have created_at)
    if (data?.created_at) {
      const created = new Date(data.created_at);
      const ttlMs = RESUME_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;
      if (!isNaN(created.getTime()) && Date.now() - created.getTime() > ttlMs) {
        console.warn("[resume] token expired", { token, created_at: data.created_at });
        return json(
          {
            ok: false,
            code: "EXPIRED",
            error: "This resume link has expired. Please save your progress again to get a fresh link.",
          },
          410
        );
      }
    }

    // Empty progress check
    const isEmpty =
      progress == null ||
      (typeof progress === "object" &&
        !Array.isArray(progress) &&
        Object.keys(progress).length === 0);

    if (isEmpty) {
      console.warn("[resume] no progress for token", { token });
      return json(
        {
          ok: false,
          code: "NO_PROGRESS",
          error: "We found your link, but there was no saved progress attached to it.",
        },
        422
      );
    }

    return json(
      { ok: true, progress_json: progress, created_at: data?.created_at || null },
      200
    );
  } catch (err: any) {
    console.error("[resume] server error", err);
    return json(
      { ok: false, code: "SERVER_ERROR", error: err?.message || "Server error" },
      500
    );
  }
}
