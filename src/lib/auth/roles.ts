export type AppRole = string | null | undefined;

export function isTeacherLikeRole(role: AppRole) {
  return role === "teacher" || role === "master";
}

export function isMasterRole(role: AppRole) {
  return role === "master";
}
