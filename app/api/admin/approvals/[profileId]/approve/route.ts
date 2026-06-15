import { NextRequest, NextResponse } from "next/server";
import {
  AdminApprovalApiError,
  approvalApiError,
  getApprovedMasterApprovalContext,
} from "@/lib/admin/server/approvalAccess";

type RouteParams = {
  params: Promise<{ profileId: string }>;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { profileId } = await params;

    if (!profileId) {
      throw new AdminApprovalApiError("Missing profile id.", 400);
    }

    const { adminClient } = await getApprovedMasterApprovalContext(req);
    const { data, error } = await adminClient
      .from("profiles")
      .update({ role: "admin", approval_status: "approved" })
      .eq("id", profileId)
      .eq("requested_role", "admin")
      .eq("approval_status", "pending")
      .select("id,role,requested_role,approval_status")
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to approve administrator request.");
    }

    if (!data) {
      throw new AdminApprovalApiError("Pending administrator request not found.", 404);
    }

    return NextResponse.json({
      message: "Administrator request approved.",
      profile: {
        id: data.id,
        role: data.role,
        requestedRole: data.requested_role,
        approvalStatus: data.approval_status,
      },
    });
  } catch (error) {
    console.error("admin approval approve route error", error);
    return approvalApiError(error);
  }
}
