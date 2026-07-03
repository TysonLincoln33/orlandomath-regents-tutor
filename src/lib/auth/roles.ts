export type AppRole = string | null | undefined;
export type ApprovalStatus = string | null | undefined;

export function isTeacherLikeRole(role: AppRole) {
  return role === "teacher" || role === "master";
}

export function isMasterRole(role: AppRole) {
  return role === "master";
}

export function isAdminRole(role: AppRole) {
  return role === "admin";
}

export function canUsePrintControls(role: AppRole) {
  return isTeacherLikeRole(role) || isAdminRole(role);
}

export function isApprovedStatus(approvalStatus: ApprovalStatus) {
  return approvalStatus === "approved";
}

export function canAccessAdminRoute(
  role: AppRole,
  approvalStatus: ApprovalStatus,
) {
  return (
    isApprovedStatus(approvalStatus) &&
    (isAdminRole(role) || isMasterRole(role))
  );
}

export function getEmailDomain(email: string | null | undefined) {
  const trimmedEmail = email?.trim().toLowerCase();

  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return null;
  }

  const domain = trimmedEmail.split("@").pop()?.trim();

  return domain || null;
}
