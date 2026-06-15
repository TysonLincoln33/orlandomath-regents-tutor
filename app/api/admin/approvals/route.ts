import { NextRequest, NextResponse } from "next/server";
import {
  approvalApiError,
  getApprovedMasterApprovalContext,
  toApprovalRequest,
  type ApprovalProfileRow,
} from "@/lib/admin/server/approvalAccess";

export async function GET(req: NextRequest) {
  try {
    const { adminClient } = await getApprovedMasterApprovalContext(req);
    const { data, error } = await adminClient
      .from("profiles")
      .select("id,email,full_name,role,requested_role,approval_status,email_domain,created_at")
      .eq("requested_role", "admin")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load pending administrator requests.");
    }

    const requests = ((data ?? []) as ApprovalProfileRow[]).map(toApprovalRequest);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("admin approvals list route error", error);
    return approvalApiError(error);
  }
}
